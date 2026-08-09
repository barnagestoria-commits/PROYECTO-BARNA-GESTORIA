#!/usr/bin/env python3
"""
Extracción estructurada de justificantes PDF AEAT.

- No persiste datos en base de datos.
- Por defecto imprime JSON a stdout; usar --output-dir solo para depuración local.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

from pypdf import PdfReader

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

JUSTIFICANTE_HDR = r"N[úu]mero(?:\s+de)?\s+justificante:\s*\S+\s*\n"
PERIODO_RE = r"(?:\dT|\dA|0A|1P|\dP)"
AMOUNT_TOKEN_RE = re.compile(r"-?[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}")
SECTION_ROW_RE = re.compile(r"^(\d+)\s+([\d.,]+)\s+([\d.,]+)$")
TOTAL_ROW_RE = re.compile(r"^([\d.,]+)$")
NIF_NAME_PROV_RE = re.compile(r"^([A-Z0-9]{9})\s+(.+?)\s+(\d{1,2})$")
NIF_NAME_LINE_RE = re.compile(r"^([A-Z0-9]{8,9})\s+(.+)$")
PROV_CLAVE_RE = re.compile(r"^(\d{2})\s+([A-G])$")
FOREIGN_CLAVE_RE = re.compile(r"^(\d{2})\s+([A-Z]{2})\s+([A-G])$")
CLAVE_LINE_RE = re.compile(r"^([A-Z])\s+(\d{2})$")
CLAVE_SINGLE_RE = re.compile(r"^([A-G])$")
SKIP_NIFS = frozenset({"B67330225", "B65658429", "934448174", "675831352"})
SKIP_RE = re.compile(
    r"^(Nro de justificante|Número identificativo|La autenticidad|--|\d+ of \d+ --|"
    r"Declaración|Agencia|Modelo|347|190|193|hoja|Pág\.|Datos identificativos)",
    re.I,
)


def parse_amount(raw: str) -> float | None:
    s = raw.strip()
    if not s or s == "-":
        return None
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(raw: str) -> int | None:
    s = raw.strip().replace(".", "")
    try:
        return int(s)
    except ValueError:
        return None


def pdf_text(path: Path) -> str:
    return "\n".join((page.extract_text() or "") for page in PdfReader(str(path)).pages)


def parse_header(text: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    m = re.search(
        r"Presentación realizada el:\s*(\d{2})-(\d{2})-(\d{4})\s*a\s*las\s*(\d{2}:\d{2}:\d{2})",
        text,
    )
    if m:
        out["fecha_presentacion"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)} {m.group(4)}"
    for key, pattern in [
        ("numero_registro", r"Expediente/Referencia[^:]*:\s*(\S+)"),
        ("csv", r"Código Seguro de Verificación:\s*(\S+)"),
        ("justificante", r"N[úu]mero(?:\s+de)?\s+justificante:\s*(\S+)"),
        ("presentador_nif", r"NIF Presentador:\s*(\S+)"),
        ("presentador_razon_social", r"Apellidos y Nombre / Razón social:\s*(.+)"),
        ("presentador_calidad", r"En calidad de:\s*(.+)"),
        ("via_entrada", r"Vía de entrada:\s*(.+)"),
    ]:
        m = re.search(pattern, text, re.I)
        if m:
            out[key] = m.group(1).strip()
    return out


def parse_declarante_periodo(text: str) -> dict[str, Any]:
    m = re.search(
        JUSTIFICANTE_HDR
        + r"([A-Z0-9]{9})\s+(.+?)\s*\n"
        + r"(\d{4})\s+(" + PERIODO_RE + r")\s*\n",
        text,
        re.I,
    )
    if not m:
        return {}
    return {
        "nif": m.group(1),
        "nombre_razon_social": m.group(2).strip(),
        "ejercicio": int(m.group(3)),
        "periodo": m.group(4),
    }


def parse_annual_declarante(text: str) -> dict[str, Any]:
    m = re.search(r"(20\d{2})\s*\n([A-Z0-9]{9})\s*\n(.+?)\s*\n", text)
    if m:
        decl: dict[str, Any] = {
            "ejercicio": int(m.group(1)),
            "nif": m.group(2),
            "nombre_razon_social": m.group(3).strip(),
        }
    else:
        m = re.search(r"([A-Z0-9]{9})\s+(.+?)\s*\n(20\d{2})\s*\n", text)
        if m:
            decl = {
                "ejercicio": int(m.group(3)),
                "nif": m.group(1),
                "nombre_razon_social": m.group(2).strip(),
            }
        else:
            return parse_declarante_periodo(text)
    tel = re.search(r"(\d{9})\s*\n([^\n]+)\s*\n(?:Nro de justificante|Número identificativo)", text)
    if tel:
        decl["telefono"] = tel.group(1)
        decl["persona_contacto"] = tel.group(2).strip()
    return decl


def parse_domiciliacion(text: str) -> dict[str, Any]:
    iban_m = re.search(r"(ES\d{22})", text)
    if not iban_m:
        return {}
    return {
        "iban": iban_m.group(1),
        "forma_pago": "DOMICILIACIÓN" if re.search(r"DOMICILIACI[ÓO]N", text, re.I) else None,
    }


def parse_ingreso(text: str) -> dict[str, Any]:
    nrc_m = re.search(r"NRC:\s*(\S+)\s+IMPORTE:\s*([\d.,]+)", text, re.I)
    if not nrc_m:
        return {}
    return {"nrc": nrc_m.group(1), "importe": parse_amount(nrc_m.group(2))}


def casilla_entry(
    code: str,
    label: str,
    *,
    base: float | None = None,
    cuota: float | None = None,
    importe: float | None = None,
    perceptores: int | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "label": label,
        "base_imponible": base,
        "cuota": cuota,
        "importe": importe,
        "perceptores": perceptores,
    }


def _classify_amount_line(line: str) -> tuple[str, list[float]]:
    amounts: list[float] = []
    for token in line.split():
        val = parse_amount(token)
        if val is not None:
            amounts.append(val)
    if len(amounts) >= 3:
        return "triple", amounts[:3]
    if len(amounts) == 2:
        return "pair", amounts
    if len(amounts) == 1:
        return "single", amounts
    return "other", amounts


def _extract_liquidation_block(text: str, end_pattern: str = r"La autenticidad") -> list[str]:
    m = re.search(
        JUSTIFICANTE_HDR
        + r"[A-Z0-9]{9}\s+.+\s*\n"
        + r"\d{4}\s+" + PERIODO_RE + r"\s*\n"
        + rf"(.*?)\n(?:ES\d{{22}}|DOMICILIACI[ÓO]N|{end_pattern})",
        text,
        re.S | re.I,
    )
    if not m:
        m = re.search(
            JUSTIFICANTE_HDR
            + r"[A-Z0-9]{9}\s+.+\s*\n"
            + r"\d{4}\s+" + PERIODO_RE + r"\s*\n"
            + rf"(.*?)\n{end_pattern}",
            text,
            re.S | re.I,
        )
    if not m:
        return []
    return [ln.strip() for ln in m.group(1).split("\n") if ln.strip()]


def _amounts_after_nif(text: str, nif: str | None = None) -> list[float]:
    if not nif:
        m = re.search(r"([A-Z0-9]{9})\s+[^\n]+\n", text)
        nif = m.group(1) if m else ""
    block = text.split(nif)[-1] if nif and nif in text else text
    block = block.split("La autenticidad")[0]
    return [a for a in (parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(block)) if a is not None]


def _page_blocks(text: str, nif: str) -> list[list[float]]:
    blocks: list[list[float]] = []
    for chunk in text.split(nif):
        if "La autenticidad" not in chunk:
            continue
        part = chunk.split("La autenticidad")[0]
        amounts = [a for a in (parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(part)) if a is not None]
        if amounts:
            blocks.append(amounts)
    return blocks


# ---------------------------------------------------------------------------
# Modelo 303
# ---------------------------------------------------------------------------

MODEL_303_PAIR_SLOTS: list[tuple[str, str, str]] = [
    ("04", "06", "Régimen general 10%"),
    ("07", "09", "Régimen general 4%"),
    ("10", "11", "Adquisiciones intracomunitarias devengado"),
    ("28", "29", "Cuotas soportadas interiores corrientes"),
    ("30", "31", "Cuotas soportadas bienes de inversión"),
    ("32", "33", "Importaciones corrientes"),
    ("34", "35", "Importaciones bienes de inversión"),
    ("36", "37", "Adq. intracomunitarias corrientes deducible"),
    ("38", "39", "Adq. intracomunitarias inversión deducible"),
    ("40", "41", "Rectificación de deducciones"),
]

MODEL_303_PAGE2_SINGLE_SLOTS: list[tuple[str, str]] = [
    ("27", "Total cuota devengada"),
    ("45", "Total a deducir"),
    ("46", "Resultado régimen general (27 − 45)"),
]

MODEL_303_PAGE3_SLOTS: list[tuple[str, str]] = [
    ("62", "Criterio de caja — entregas"),
    ("63", "Criterio de caja — adquisiciones"),
    ("110", "Cuotas a compensar pendientes periodos anteriores"),
    ("78", "Cuotas compensadas aplicadas en este periodo"),
    ("71", "Resultado de la liquidación"),
]


def _extract_page3_amounts(text: str) -> list[float]:
    page3 = text.split("Página 3")[-1] if "Página 3" in text else text
    page3 = page3.split("La autenticidad")[0]
    return [a for a in (parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(page3)) if a is not None]


def parse_303(text: str) -> dict[str, Any]:
    decl = parse_declarante_periodo(text)
    result: dict[str, Any] = {
        "modelo": "303",
        "ejercicio": decl.get("ejercicio"),
        "periodo": decl.get("periodo"),
        "presentacion": parse_header(text),
        "declarante": {k: decl[k] for k in ("nif", "nombre_razon_social") if k in decl},
        "ingreso": parse_ingreso(text),
        "casillas": [],
    }

    casillas: dict[str, dict[str, Any]] = {}
    lines = _extract_liquidation_block(text)
    pair_idx = 0
    single_idx = 0
    skip_tipo_remaining = 2

    for line in lines:
        kind, values = _classify_amount_line(line)
        if kind == "other":
            continue
        if kind == "single" and len(values) == 1 and abs(values[0]) < 100 and skip_tipo_remaining > 0:
            skip_tipo_remaining -= 1
            continue
        if kind == "single" and len(values) == 1 and abs(values[0]) < 20:
            continue
        if kind == "triple":
            casillas["01"] = casilla_entry("01", "Régimen general 21% — base", base=values[0], importe=values[0])
            casillas["03"] = casilla_entry("03", "Régimen general 21% — cuota", cuota=values[2], importe=values[2])
            continue
        if kind == "pair" and pair_idx < len(MODEL_303_PAIR_SLOTS):
            base_code, cuota_code, label = MODEL_303_PAIR_SLOTS[pair_idx]
            casillas[base_code] = casilla_entry(base_code, f"{label} — base", base=values[0], importe=values[0])
            casillas[cuota_code] = casilla_entry(cuota_code, f"{label} — cuota", cuota=values[1], importe=values[1])
            pair_idx += 1
            continue
        if kind == "single" and single_idx < len(MODEL_303_PAGE2_SINGLE_SLOTS):
            code, label = MODEL_303_PAGE2_SINGLE_SLOTS[single_idx]
            casillas[code] = casilla_entry(code, label, importe=values[0])
            single_idx += 1

    for code, label in MODEL_303_PAGE3_SLOTS:
        page3_amounts = _extract_page3_amounts(text)
        if not page3_amounts:
            break
        casillas[code] = casilla_entry(code, label, importe=page3_amounts.pop(0))

    nrc_importe = result["ingreso"].get("importe")
    if nrc_importe is not None:
        casillas["71"] = casilla_entry("71", "Resultado de la liquidación", importe=nrc_importe)

    ordered = ["01", "03", "04", "06", "07", "09", "10", "11", "27", "28", "29", "30", "31", "32", "33", "45", "46", "62", "63", "110", "78", "71"]
    result["casillas"] = [casillas[c] for c in ordered if c in casillas]
    result["validacion"] = _validate_303(casillas, result.get("ingreso"))
    return result


def _validate_303(casillas: dict[str, dict[str, Any]], ingreso: dict[str, Any] | None = None) -> dict[str, Any]:
    v: dict[str, Any] = {}
    c27, c45, c46 = [casillas.get(k, {}).get("importe") for k in ("27", "45", "46")]
    if c27 is not None and c45 is not None and c46 is not None:
        v["46_coherente"] = abs(c46 - (c27 - c45)) < 0.02
    c71, nrc = casillas.get("71", {}).get("importe"), (ingreso or {}).get("importe")
    if c71 is not None and nrc is not None:
        v["71_nrc_coherente"] = abs(c71 - nrc) < 0.02
    return v


# ---------------------------------------------------------------------------
# Modelo 111
# ---------------------------------------------------------------------------

MODEL_111_SECTIONS: list[tuple[str, str, str, str]] = [
    ("01", "02", "03", "I. Rendimientos del trabajo"),
    ("04", "05", "06", "II. Rendimientos actividades económicas"),
    ("07", "08", "09", "III. Premios"),
    ("10", "11", "12", "IV. Ganancias patrimoniales montes"),
    ("13", "14", "15", "V. Cesión derechos de imagen"),
]

MODEL_111_TOTALS: list[tuple[str, str]] = [
    ("28", "Suma de retenciones e ingresos a cuenta"),
    ("29", "A deducir (autoliquidación complementaria)"),
    ("30", "Resultado a ingresar"),
]


def parse_111(text: str) -> dict[str, Any]:
    decl = parse_declarante_periodo(text)
    result: dict[str, Any] = {
        "modelo": "111",
        "ejercicio": decl.get("ejercicio"),
        "periodo": decl.get("periodo"),
        "presentacion": parse_header(text),
        "declarante": {k: decl[k] for k in ("nif", "nombre_razon_social") if k in decl},
        "domiciliacion": parse_domiciliacion(text),
        "casillas": [],
    }

    lines = _extract_liquidation_block(text)
    casillas: dict[str, dict[str, Any]] = {}
    section_idx = total_idx = 0

    for line in lines:
        sec = SECTION_ROW_RE.match(line)
        if sec and section_idx < len(MODEL_111_SECTIONS):
            p_code, i_code, r_code, label = MODEL_111_SECTIONS[section_idx]
            casillas[p_code] = casilla_entry(p_code, f"{label} — perceptores", perceptores=parse_int(sec.group(1)), importe=float(parse_int(sec.group(1)) or 0))
            casillas[i_code] = casilla_entry(i_code, f"{label} — percepciones", importe=parse_amount(sec.group(2)))
            casillas[r_code] = casilla_entry(r_code, f"{label} — retenciones/ingresos a cuenta", importe=parse_amount(sec.group(3)))
            section_idx += 1
            continue
        tot = TOTAL_ROW_RE.match(line)
        if tot and total_idx < len(MODEL_111_TOTALS):
            code, label = MODEL_111_TOTALS[total_idx]
            casillas[code] = casilla_entry(code, label, importe=parse_amount(tot.group(1)))
            total_idx += 1

    ordered = [c for group in MODEL_111_SECTIONS for c in group[:3]] + [c for c, _ in MODEL_111_TOTALS]
    result["casillas"] = [casillas[c] for c in ordered if c in casillas]
    result["validacion"] = _validate_111(casillas)
    return result


def _validate_111(casillas: dict[str, dict[str, Any]]) -> dict[str, Any]:
    keys = ["03", "06", "09", "12", "15"]
    total_ret = sum(casillas[k]["importe"] for k in keys if k in casillas and casillas[k].get("importe") is not None)
    c28 = casillas.get("28", {}).get("importe")
    v: dict[str, Any] = {}
    if c28 is not None and total_ret > 0:
        v["28_coherente"] = abs(c28 - total_ret) < 0.02
    return v


# ---------------------------------------------------------------------------
# Modelo 123
# ---------------------------------------------------------------------------

MODEL_123_INT_ROWS = ("01", "04")
MODEL_123_BASE_ROWS = ("02", "05")
MODEL_123_RET_ROWS = ("03", "06")
MODEL_123_TOTALS = [("09", "Total retenciones"), ("11", "Suma retenciones + regularización"), ("14", "Resultado a ingresar")]


def parse_123(text: str) -> dict[str, Any]:
    decl = parse_declarante_periodo(text)
    result: dict[str, Any] = {
        "modelo": "123",
        "ejercicio": decl.get("ejercicio"),
        "periodo": decl.get("periodo"),
        "presentacion": parse_header(text),
        "declarante": {k: decl[k] for k in ("nif", "nombre_razon_social") if k in decl},
        "domiciliacion": parse_domiciliacion(text),
        "casillas": [],
    }

    lines = _extract_liquidation_block(text)
    casillas: dict[str, dict[str, Any]] = {}
    int_idx = base_idx = ret_idx = total_idx = 0

    for line in lines:
        ints = [parse_int(t) for t in line.split() if parse_int(t) is not None and "." not in t and "," not in t]
        if len(ints) == 2 and int_idx < len(MODEL_123_INT_ROWS):
            for code, val in zip(MODEL_123_INT_ROWS[int_idx:], ints):
                casillas[code] = casilla_entry(code, f"Número de rentas ({code})", perceptores=val, importe=float(val))
            int_idx += 1
            continue
        kind, values = _classify_amount_line(line)
        if kind == "pair":
            if base_idx < len(MODEL_123_BASE_ROWS):
                for code, val in zip(MODEL_123_BASE_ROWS[base_idx:], values):
                    casillas[code] = casilla_entry(code, f"Base retenciones ({code})", base=val, importe=val)
                base_idx += 1
                continue
            if ret_idx < len(MODEL_123_RET_ROWS):
                for code, val in zip(MODEL_123_RET_ROWS[ret_idx:], values):
                    casillas[code] = casilla_entry(code, f"Retenciones ({code})", importe=val)
                ret_idx += 1
                continue
        if kind == "single" and total_idx < len(MODEL_123_TOTALS):
            code, label = MODEL_123_TOTALS[total_idx]
            casillas[code] = casilla_entry(code, label, importe=values[0])
            total_idx += 1

    ordered = list(MODEL_123_INT_ROWS) + list(MODEL_123_BASE_ROWS) + list(MODEL_123_RET_ROWS) + [c for c, _ in MODEL_123_TOTALS]
    result["casillas"] = [casillas[c] for c in ordered if c in casillas]
    return result


# ---------------------------------------------------------------------------
# Modelo 349
# ---------------------------------------------------------------------------

OPERADOR_RE = re.compile(
    r"^([A-Z]{2})\s+([A-Z0-9]{2,15})\s+(.+?)\s+([A-Z])\s+([\d.,]+)$"
)


def parse_349(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    result: dict[str, Any] = {
        "modelo": "349",
        "ejercicio": decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": decl,
        "periodo": None,
        "resumen": {},
        "operadores": [],
        "casillas": [],
    }

    m = re.search(
        r"N[úu]mero(?:\s+de)?\s+justificante:\s*\S+\s*\n(\dT|\dA|0A|\dP)\s*\n(\d+)\s*\n([\d.,]+)",
        text,
        re.I,
    )
    if m:
        result["periodo"] = m.group(1)
        result["resumen"] = {
            "total_operadores_casilla_01": int(m.group(2)),
            "importe_total_casilla_02": parse_amount(m.group(3)),
        }
        result["casillas"] = [
            casilla_entry("01", "Número total de operadores intracomunitarios", perceptores=int(m.group(2)), importe=float(m.group(2))),
            casilla_entry("02", "Importe de las operaciones intracomunitarias", importe=parse_amount(m.group(3))),
        ]

    for line in text.split("\n"):
        line = line.strip()
        op = OPERADOR_RE.match(line)
        if op:
            result["operadores"].append({
                "pais": op.group(1),
                "nif_iva": op.group(2),
                "nombre": op.group(3).strip(),
                "clave": op.group(4),
                "base_imponible": parse_amount(op.group(5)),
            })

    return result


# ---------------------------------------------------------------------------
# Modelo 390
# ---------------------------------------------------------------------------


def parse_390(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    nif = decl.get("nif", "")
    result: dict[str, Any] = {
        "modelo": "390",
        "ejercicio": decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": {k: decl[k] for k in ("nif", "nombre_razon_social") if k in decl},
        "casillas": [],
    }

    casillas: dict[str, dict[str, Any]] = {}
    best_pair: tuple[float, float] | None = None
    for a, b in re.findall(r"(-?[\d.,]+)\s+(-?[\d.,]+)", text):
        base, cuota = parse_amount(a), parse_amount(b)
        if base is None or cuota is None or base <= 1_000_000:
            continue
        ratio = cuota / base if base else 0
        if 0.18 <= ratio <= 0.22 and (best_pair is None or base > best_pair[0]):
            best_pair = (base, cuota)
    if best_pair:
        base, cuota = best_pair
        casillas["01"] = casilla_entry("01", "Régimen general — base anual", base=base, importe=base)
        casillas["03"] = casilla_entry("03", "Régimen general — cuota anual", cuota=cuota, importe=cuota)
        casillas["27"] = casilla_entry("27", "Total cuota devengada anual", importe=cuota)

    page6 = text.split("Página 6")[-1] if "Página 6" in text else text
    m46 = re.search(r"([\d.,]+)\s*\n([\d.,]+)\s*\nLa autenticidad", page6)
    if m46:
        c47, c64 = parse_amount(m46.group(1)), parse_amount(m46.group(2))
        if c47 is not None and c64 is not None:
            casillas["47"] = casilla_entry("47", "Total cuota devengada", importe=c47)
            casillas["64"] = casilla_entry("64", "Total a deducir", importe=c64)
            casillas["65"] = casilla_entry("65", "Resultado régimen general", importe=c47 - c64)
            casillas["45"] = casilla_entry("45", "Total a deducir (alias 64)", importe=c64)
            casillas["46"] = casilla_entry("46", "Resultado (alias 65)", importe=c47 - c64)

    page7 = text.split("Total volumen de operaciones")[-1] if "Total volumen de operaciones" in text else ""
    page7 = page7.split("La autenticidad")[0]
    page7_singles = [parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(page7) if parse_amount(x) is not None]
    if len(page7_singles) >= 8:
        slots = ["84", "658", "86", "695", "99", "103", "653", "108"]
        labels = [
            "Suma de resultados", "Regularización art. 80.Cinco.5ª", "Resultado liquidación",
            "Importe período anterior", "Operaciones régimen general", "Entregas intracomunitarias",
            "Criterio de caja devengado", "Total volumen de operaciones",
        ]
        for code, label, val in zip(slots, labels, page7_singles[-8:]):
            casillas[code] = casilla_entry(code, label, importe=val)
        casillas["71"] = casilla_entry("71", "Resultado anual", importe=page7_singles[-8 + 2])

    ordered = ["01", "03", "27", "47", "64", "65", "45", "46", "84", "658", "86", "71", "99", "103", "653", "108"]
    result["casillas"] = [casillas[c] for c in ordered if c in casillas]
    if casillas.get("47") and casillas.get("64") and casillas.get("65"):
        result["validacion"] = {"65_coherente": abs(casillas["65"]["importe"] - (casillas["47"]["importe"] - casillas["64"]["importe"])) < 0.02}
    return result


# ---------------------------------------------------------------------------
# Modelos 347 / 190 / 193 — informativas con detalle
# ---------------------------------------------------------------------------


def _parse_347_declarados(text: str, decl_nif: str) -> list[dict[str, Any]]:
    declarados: list[dict[str, Any]] = []
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    i = 0
    while i < len(lines):
        if SKIP_RE.match(lines[i]):
            i += 1
            continue
        foreign = FOREIGN_CLAVE_RE.match(lines[i])
        if foreign and i > 0:
            declarados.append({
                "nif": None,
                "nombre": lines[i - 1],
                "provincia": foreign.group(1),
                "pais": foreign.group(2),
                "clave": foreign.group(3),
                "importe": parse_amount(lines[i + 1]) if i + 1 < len(lines) else None,
            })
            i += 2
            continue
        m = NIF_NAME_LINE_RE.match(lines[i])
        if m and m.group(1) not in SKIP_NIFS and "Agencia" not in m.group(2):
            if i + 2 < len(lines) and PROV_CLAVE_RE.match(lines[i + 1]):
                pk = PROV_CLAVE_RE.match(lines[i + 1])
                amt = parse_amount(lines[i + 2])
                if amt is not None:
                    declarados.append({
                        "nif": m.group(1),
                        "nombre": m.group(2).strip(),
                        "provincia": pk.group(1),
                        "clave": pk.group(2),
                        "importe": amt,
                    })
                    i += 3
                    continue
        i += 1
    return declarados


def parse_347(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    result: dict[str, Any] = {
        "modelo": "347",
        "ejercicio": decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": decl,
        "resumen": {},
        "declarados": _parse_347_declarados(text, decl.get("nif", "")),
    }
    m = re.search(r"(\d+)\s*\n([\d]{1,3}(?:\.[\d]{3})*,[\d]{2})\s*\nLa autenticidad", text)
    if m:
        result["resumen"] = {
            "total_entidades_casilla_01": int(m.group(1)),
            "importe_total_anual_casilla_02": parse_amount(m.group(2)),
        }
        result["casillas"] = [
            casilla_entry("01", "Número total de declarados", perceptores=int(m.group(1)), importe=float(m.group(1))),
            casilla_entry("02", "Importe total anual de operaciones", importe=parse_amount(m.group(2))),
        ]
    result["validacion"] = {
        "declarados_extraidos": len(result["declarados"]),
        "declarados_coherente": len(result["declarados"]) == result["resumen"].get("total_entidades_casilla_01"),
    }
    return result


def _parse_190_percepciones(text: str) -> list[dict[str, Any]]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        m = NIF_NAME_PROV_RE.match(lines[i])
        if not m or m.group(1) in SKIP_NIFS:
            i += 1
            continue
        nif, name, prov = m.group(1), m.group(2), m.group(3)
        clave_line = lines[i + 1] if i + 1 < len(lines) else ""
        cl_m = CLAVE_LINE_RE.match(clave_line) or CLAVE_SINGLE_RE.match(clave_line)
        if not cl_m:
            i += 1
            continue
        amt_line = lines[i + 2] if i + 2 < len(lines) else ""
        amts = [parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(amt_line)]
        amts = [a for a in amts if a is not None]
        if not amts:
            i += 1
            continue
        entry: dict[str, Any] = {
            "nif": nif,
            "nombre": name.strip(),
            "provincia": prov.zfill(2),
            "situacion_familiar": cl_m.group(1),
            "clave": cl_m.group(2) if cl_m.lastindex and cl_m.lastindex >= 2 else cl_m.group(1),
            "percepcion_integra": amts[0],
            "retenciones": amts[1] if len(amts) > 1 else None,
        }
        out.append(entry)
        i += 3
    return out


def parse_190(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    result: dict[str, Any] = {
        "modelo": "190",
        "ejercicio": decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": decl,
        "resumen": {},
        "percepciones": _parse_190_percepciones(text),
        "casillas": [],
    }
    m = re.search(r"(\d+)\s*\n([\d.,]+)\s*\n([\d.,]+)\s*\n[\w.+-]+@", text)
    if m:
        result["resumen"] = {
            "total_percepciones_casilla_01": int(m.group(1)),
            "importe_total_percepciones_casilla_02": parse_amount(m.group(2)),
            "importe_total_retenciones_casilla_03": parse_amount(m.group(3)),
        }
        result["casillas"] = [
            casilla_entry("01", "Número total de perceptores", perceptores=int(m.group(1)), importe=float(m.group(1))),
            casilla_entry("02", "Importe total de percepciones", importe=parse_amount(m.group(2))),
            casilla_entry("03", "Importe total de retenciones", importe=parse_amount(m.group(3))),
        ]
    result["validacion"] = {
        "percepciones_extraidas": len(result["percepciones"]),
        "percepciones_coherente": len(result["percepciones"]) == result["resumen"].get("total_percepciones_casilla_01"),
    }
    return result


def _parse_193_perceptores(text: str) -> list[dict[str, Any]]:
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    out: list[dict[str, Any]] = []
    i = 0
    while i < len(lines):
        m = NIF_NAME_PROV_RE.match(lines[i])
        if not m or m.group(1) in SKIP_NIFS:
            i += 1
            continue
        if i + 3 >= len(lines):
            break
        meta = lines[i + 1]
        base_line = lines[i + 2]
        detail = lines[i + 3]
        amts = [parse_amount(x) for x in AMOUNT_TOKEN_RE.findall(detail)]
        amts = [a for a in amts if a is not None]
        if len(amts) >= 3:
            out.append({
                "nif": m.group(1),
                "nombre": m.group(2).strip(),
                "provincia": m.group(3).zfill(2),
                "meta": meta,
                "base_retenciones": amts[0],
                "tipo_retencion": amts[1],
                "retenciones": amts[2],
            })
            i += 4
            continue
        i += 1
    return out


def parse_193(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    result: dict[str, Any] = {
        "modelo": "193",
        "ejercicio": decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": decl,
        "resumen": {},
        "perceptores": _parse_193_perceptores(text),
        "casillas": [],
    }
    m = re.search(
        r"N[úu]mero identificativo:\s*\S+\s*\n(\d+)\s*\n([\d.,]+)\s*\n([\d.,]+)\s*\n([\d.,]+)",
        text,
        re.I,
    )
    if m:
        result["resumen"] = {
            "total_perceptores_casilla_01": int(m.group(1)),
            "base_retenciones_casilla_02": parse_amount(m.group(2)),
            "retenciones_casilla_03": parse_amount(m.group(3)),
            "retenciones_ingresadas_casilla_04": parse_amount(m.group(4)),
        }
        result["casillas"] = [
            casilla_entry("01", "Número total de perceptores", perceptores=int(m.group(1)), importe=float(m.group(1))),
            casilla_entry("02", "Base retenciones e ingresos a cuenta", importe=parse_amount(m.group(2))),
            casilla_entry("03", "Retenciones e ingresos a cuenta", importe=parse_amount(m.group(3))),
            casilla_entry("04", "Retenciones ingresadas", importe=parse_amount(m.group(4))),
        ]
    return result


# ---------------------------------------------------------------------------
# Modelo 200 — resumen liquidación IS
# ---------------------------------------------------------------------------

MODEL_200_SUMMARY_SLOTS: list[tuple[str, str]] = [
    ("00548", "Base imponible positiva"),
    ("00562", "Cuota íntegra"),
    ("00585", "Cuota líquida / Resultado a ingresar"),
]


def parse_200(text: str) -> dict[str, Any]:
    decl = parse_annual_declarante(text)
    m_block = re.search(
        r"MINISTERIO\s*\nDE HACIENDA\s*\n(\d{4})\s*\n\d+\s+(\d{2}/\d{2}/\d{2})\s+(\d{2}/\d{2}/\d{2})\s*\n"
        r"([A-Z0-9]{9})\s+(.+?)\s*\n"
        r"([\d.,]+)\s*\n([\d.,]+)\s*\n([\d.,]+)",
        text,
        re.S,
    )
    result: dict[str, Any] = {
        "modelo": "200",
        "ejercicio": int(m_block.group(1)) if m_block else decl.get("ejercicio"),
        "presentacion": parse_header(text),
        "declarante": {
            "nif": m_block.group(4) if m_block else decl.get("nif"),
            "nombre_razon_social": (m_block.group(5).strip() if m_block else decl.get("nombre_razon_social")),
        },
        "periodo_impositivo": {
            "inicio": m_block.group(2) if m_block else None,
            "fin": m_block.group(3) if m_block else None,
        },
        "domiciliacion": parse_domiciliacion(text),
        "casillas": [],
    }
    if m_block:
        amounts = [parse_amount(m_block.group(i)) for i in range(6, 9)]
        codes = ["00548", "00562", "00585"]
        labels = ["Base imponible", "Cuota íntegra", "Resultado a ingresar"]
        result["casillas"] = [
            casilla_entry(code, label, importe=amt)
            for code, label, amt in zip(codes, labels, amounts)
            if amt is not None
        ]
    return result


# ---------------------------------------------------------------------------
# Modelo 202 — pagos fraccionados IS
# ---------------------------------------------------------------------------

MODEL_202_SLOTS: list[tuple[str, str]] = [
    ("01", "Base imponible último periodo impositivo"),
    ("03", "Cuota resultante (modalidad art. 40.2 LIS)"),
    ("34", "Importe a ingresar"),
]


def parse_202(text: str) -> dict[str, Any]:
    decl = parse_declarante_periodo(text)
    result: dict[str, Any] = {
        "modelo": "202",
        "ejercicio": decl.get("ejercicio"),
        "periodo": decl.get("periodo"),
        "presentacion": parse_header(text),
        "declarante": {k: decl[k] for k in ("nif", "nombre_razon_social") if k in decl},
        "domiciliacion": parse_domiciliacion(text),
        "casillas": [],
    }

    m = re.search(
        JUSTIFICANTE_HDR
        + r"([A-Z0-9]{9})\s+(.+?)\s*\n"
        + r"(\d{4})\s+(" + PERIODO_RE + r")\s*\n"
        + r"(\d{2}/\d{2}/\d{4})\s*\n"
        + r"(\d+)\s*\n"
        + r"(?:X\s*\n)*"
        + r"(\d+)\s*\n"
        + r"(?:X\s*\n)*"
        + r"([\d.,]+)\s*\n([\d.,]+)",
        text,
        re.S | re.I,
    )
    if m:
        result["fecha_inicio_periodo"] = m.group(5)
        result["cnae"] = m.group(6)
        result["casillas"] = [
            casilla_entry("01", "Base imponible último periodo impositivo", importe=parse_amount(m.group(8))),
            casilla_entry("03", "Cuota resultante", importe=parse_amount(m.group(9))),
            casilla_entry("34", "Importe a ingresar", importe=parse_amount(m.group(9))),
        ]
    else:
        amounts = _extract_liquidation_block(text)
        nums = []
        for line in amounts:
            kind, vals = _classify_amount_line(line)
            if kind == "single":
                nums.extend(vals)
        if len(nums) >= 2:
            result["casillas"] = [
                casilla_entry(code, label, importe=val)
                for (code, label), val in zip(MODEL_202_SLOTS[:2], nums[-2:])
            ]
    return result


PARSERS = {
    "111": parse_111,
    "123": parse_123,
    "190": parse_190,
    "193": parse_193,
    "200": parse_200,
    "202": parse_202,
    "303": parse_303,
    "347": parse_347,
    "349": parse_349,
    "390": parse_390,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Extraer datos estructurados de justificantes PDF AEAT")
    parser.add_argument("pdfs", nargs="*", help="Rutas a PDFs")
    parser.add_argument("--output-dir", help="Solo depuración: escribir JSON (no usar en producción)")
    args = parser.parse_args()

    pdfs = args.pdfs or []
    if not pdfs:
        parser.print_help()
        sys.exit(1)

    outputs: list[dict[str, Any]] = []
    for pdf_path in pdfs:
        path = Path(pdf_path)
        if not pdf_path or not path.exists():
            print(f"SKIP missing: {path}", file=sys.stderr)
            continue
        text = pdf_text(path)
        model = path.name.split("_")[0]
        parse_fn = PARSERS.get(model)
        if parse_fn:
            data = parse_fn(text)
        else:
            data = {"modelo": model, "archivo": path.name, "presentacion": parse_header(text), "nota": "Parser pendiente"}
        outputs.append(data)

        if args.output_dir:
            out_dir = Path(args.output_dir)
            out_dir.mkdir(parents=True, exist_ok=True)
            (out_dir / f"{path.stem}.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(outputs if len(outputs) > 1 else outputs[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
