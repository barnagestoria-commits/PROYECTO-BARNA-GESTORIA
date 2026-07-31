#!/usr/bin/env python3
import re
import struct
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")


def parse_amount(raw: str) -> float:
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return 0.0
    return int(digits[-11:].rjust(11, "0")[:11]) / 100


def analyze_1a_record(path: Path):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")

    # Find all D/H + 11 digit amounts
    pattern = re.compile(
        r"(.{0,120}?)"  # prefix
        r"([DH])(\d{11})",
        re.DOTALL,
    )

    entries = []
    current_doc = ""
    current_date = ""

    for m in pattern.finditer(text):
        prefix, dh, amount_raw = m.group(1), m.group(2), m.group(3)
        amount = parse_amount(amount_raw)
        if amount <= 0:
            continue

        prefix_clean = prefix.replace("\x00", " ")
        # extract concept/doc from prefix
        doc_m = re.search(r"([A-Z0-9/\-]{4,15})\s{2,}$", prefix_clean)
        concept_m = re.search(r"([\x20-\x7E\u00C0-\u00FF\.\,\"]{8,40})\s{2,}[A-Z0-9/\-]{4,15}\s{2,}$", prefix_clean)
        concept = concept_m.group(1).strip() if concept_m else ""
        doc = doc_m.group(1).strip() if doc_m else ""

        # account code in last 20 chars before DH - often 6-12 digits
        tail = prefix_clean[-40:]
        accounts = re.findall(r"\b(\d{6,12})\b", tail)
        account = accounts[-1] if accounts else ""

        pos = m.start()
        raw_before = data[max(0, pos - 32) : pos + 14]
        entries.append(
            {
                "pos": pos,
                "dh": dh,
                "amount": amount,
                "account": account,
                "doc": doc,
                "concept": concept[:40],
                "hex": raw_before.hex(),
            }
        )

    print(f"{path.name}: {len(entries)} lines with amount")
    for e in entries[:20]:
        print(
            f"  {e['dh']} {e['amount']:>10.2f} acct={e['account']!r:14} doc={e['doc']!r} concept={e['concept']!r}"
        )
        print(f"    hex={e['hex']}")

    # dedupe by position clusters -> entries
    return entries


def find_cu_subaccounts(path: Path):
    data = path.read_bytes()
    header = 512
    rec_size = 512
    found = []

    for i in range(header, len(data), rec_size):
        rec = data[i : i + rec_size]
        # scan for pattern: short code at ~0x78 and long code
        chunk = rec.decode("latin1", errors="replace")
        # Subaccounts often have format like 629000000001 in file
        for m in re.finditer(r"(\d{3})(\d{9})([\x20-\x7E\u00C0-\u00FF]{4,40})", chunk):
            parent, seq, name = m.group(1), m.group(2), m.group(3).strip()
            code = parent + seq
            if name and not name.startswith("000"):
                found.append((code, name[:30]))

    # also search whole file for 12-digit + name patterns
    text = data.decode("latin1", errors="replace")
    for m in re.finditer(r"(4\d{11}|6\d{11}|2\d{11}|1\d{11}|3\d{11}|5\d{11}|7\d{11})([\x20-\x7E\u00C0-\u00FF\.]{4,35})", text):
        code, name = m.group(1), m.group(2).strip()
        if len(name) >= 4 and not name.startswith("000"):
            found.append((code, name[:30]))

    uniq = {}
    for code, name in found:
        if code not in uniq and len(code) >= 6:
            uniq[code] = name

    print(f"\n{path.name}: {len(uniq)} subaccount candidates")
    for code, name in sorted(uniq.items())[:25]:
        print(f"  {code} -> {name!r}")


def parse_tclipro_accounts(path: Path):
    data = path.read_bytes()
    rec_size = 512
    header = 0
    print(f"\nTCLIPRO record scan:")
    for i in range(header, min(len(data), header + rec_size * 20), rec_size):
        rec = data[i : i + rec_size].decode("latin1", errors="replace")
        nif_m = re.search(r"([A-Z]\d{8}|\d{8}[A-Z]|[A-Z]{2}\d+)", rec)
        if nif_m:
            nif = nif_m.group(1)
            name = rec[nif_m.end() : nif_m.end() + 40].strip()
            accts = re.findall(r"\d{9,12}", rec)
            print(f"  nif={nif} name={name[:30]!r} accts={accts[:3]}")


def main():
    analyze_1a_record(ROOT / "0045861A.DAT")
    find_cu_subaccounts(ROOT / "004586CU.DAT")
    parse_tclipro_accounts(ROOT / "TCLIPRO.DAT")

    # sum all monthly A files
    total = 0
    for p in sorted(ROOT.glob("004586*A.DAT")):
        data = p.read_bytes().decode("latin1", errors="replace")
        n = len(re.findall(r"[DH]\d{11}", data))
        total += n
        print(f"{p.name}: ~{n} journal lines")
    print(f"Total A-file lines: {total}")


if __name__ == "__main__":
    main()
