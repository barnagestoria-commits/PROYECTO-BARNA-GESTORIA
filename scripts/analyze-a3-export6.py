#!/usr/bin/env python3
import re
import struct
from collections import Counter
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")
RECORD = 132
HEADER = 512


def parse_lines(path: Path):
    data = path.read_bytes()
    first = re.search(rb"[DH]\d{11,14}", data[HEADER:])
    abs_pos = HEADER + first.start()
    best = (0, 0)
    for trial in range(RECORD):
        start = abs_pos - trial
        if start < HEADER:
            continue
        count = 0
        pos = start
        while pos + RECORD <= len(data):
            if re.search(rb"[DH]\d{11,14}", data[pos : pos + RECORD]):
                count += 1
            pos += RECORD
        if count > best[1]:
            best = (trial, count)
    offset, _ = best
    start = abs_pos - offset
    lines = []
    pos = start
    while pos + RECORD <= len(data):
        rec = data[pos : pos + RECORD]
        m = re.search(rb"([DH])(\d{11,14})", rec)
        if m:
            amount = int(m.group(2).decode()) / 100
            text = rec.decode("latin1", errors="replace")
            concept = text[15 : m.start()].replace("\x00", " ").strip()
            key8 = rec[0:8].hex()
            key4 = struct.unpack("<I", rec[0:4])[0]
            key4b = struct.unpack("<I", rec[4:8])[0]
            subtype = rec[10]
            lines.append(
                {
                    "key8": key8,
                    "key4a": key4,
                    "key4b": key4b,
                    "subtype": subtype,
                    "dh": m.group(1).decode(),
                    "amount": amount,
                    "concept": concept[-45:],
                    "raw0": rec[0:16].hex(),
                }
            )
        pos += RECORD
    return lines


def parse_cu_accounts(path: Path):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")
    found = []
    # pattern like 505.5  NAME or 400000000402
    for m in re.finditer(r"(\d{3,3}\.\d{1,4})\s{1,3}([\x20-\x7E\u00C0-\u00FF]{4,40})", text):
        found.append((m.group(1).replace(".", ""), m.group(2).strip()[:30]))
    for m in re.finditer(r"(?<!\d)([1-7]\d{11})([\x20-\x7E\u00C0-\u00FF]{4,30})", text):
        found.append((m.group(1), m.group(2).strip()[:30]))
    uniq = {}
    for code, name in found:
        if code not in uniq:
            uniq[code] = name
    return uniq


def parse_da_accounts(path: Path):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")
    found = []
    for m in re.finditer(r"(\d{3,3}\.\d{1,4})\s{1,3}([\x20-\x7E\u00C0-\u00FF]{4,40})", text):
        found.append((m.group(1).replace(".", ""), m.group(2).strip()[:30]))
    for m in re.finditer(r"(?<!\d)([1-7]\d{5,11})([\x20-\x7E\u00C0-\u00FF]{4,30})", text):
        found.append((m.group(1), m.group(2).strip()[:30]))
    return found[:30]


def main():
    lines = parse_lines(ROOT / "0045861A.DAT")
    print(f"lines: {len(lines)}")
    print("subtype counts:", Counter(l["subtype"] for l in lines))
    print("unique key8 sample:", len({l["key8"] for l in lines}))
    for l in lines[:12]:
        print(f"  sub={l['subtype']:3} {l['dh']} {l['amount']:>10.2f} key={l['raw0']} concept={l['concept']!r}")

    cu = parse_cu_accounts(ROOT / "004586CU.DAT")
    print(f"\nCU accounts: {len(cu)}")
    for code, name in sorted(cu.items())[:20]:
        print(f"  {code} -> {name!r}")

    print("\nDA sample accounts:")
    for code, name in parse_da_accounts(ROOT / "004586DA.Dat")[:20]:
        print(f"  {code} -> {name!r}")

    # correlate subtype with account types from concept
    iva = [l for l in lines if "IVA" in l["concept"].upper()]
    gasto = [l for l in lines if "Gasto" in l["concept"] or "gasto" in l["concept"]]
    print(f"\nIVA lines: {len(iva)}, Gasto lines: {len(gasto)}")
    if iva:
        print(" IVA subtypes:", Counter(l["subtype"] for l in iva))
    if gasto:
        print(" Gasto subtypes:", Counter(l["subtype"] for l in gasto))


if __name__ == "__main__":
    main()
