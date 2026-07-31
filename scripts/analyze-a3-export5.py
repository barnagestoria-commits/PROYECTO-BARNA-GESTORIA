#!/usr/bin/env python3
import re
import struct
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")
RECORD = 132
HEADER = 512


def parse_amount_field(raw: str) -> float:
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 5:
        return 0.0
    return int(digits[-11:].rjust(11, "0")[:11]) / 100


def parse_journal_line(rec: bytes) -> dict | None:
    text = rec.decode("latin1", errors="replace")
    m = re.search(r"([DH])(\d{11,14})", text)
    if not m:
        return None

    amount = parse_amount_field(m.group(2))
    if amount <= 0:
        return None

    dh = m.group(1)
    dh_pos = m.start()

    concept_block = text[:dh_pos].replace("\x00", " ").strip()
    # concept often: optional prefix + description + doc
    doc_m = re.search(r"([A-Z0-9/\-]{3,15})\s*$", concept_block)
    doc = doc_m.group(1) if doc_m else ""
    concept = concept_block
    if doc_m:
        concept = concept_block[: doc_m.start()].strip()

    # account code: 4 bytes little-endian int at offset 4? or digits before concept
    acct_bytes = rec[4:8]
    acct_int = struct.unpack("<I", acct_bytes)[0] if len(acct_bytes) == 4 else 0

    # search 6-12 digit account in record
    accts = re.findall(r"(?<!\d)(\d{6,12})(?!\d)", text)
    account = ""
    for a in accts:
        if a.startswith(("1", "2", "3", "4", "5", "6", "7")) and len(a) >= 6:
            account = a
            break

    # date from header area bytes 8-16?
    date_raw = rec[8:16].decode("latin1", errors="replace")

    return {
        "dh": dh,
        "amount": amount,
        "account": account,
        "doc": doc,
        "concept": concept[-40:].strip(),
        "acct_int": acct_int,
        "date_raw": date_raw,
    }


def parse_1a_file(path: Path):
    data = path.read_bytes()
    lines = []

    # align: find first DH after header, backstep to record boundary
    first = re.search(rb"[DH]\d{11,14}", data[HEADER:])
    if not first:
        return lines
    abs_pos = HEADER + first.start()
    # try offsets 0..131 before dh marker within record
    best_offset = 0
    best_count = 0
    for trial in range(RECORD):
        start = abs_pos - trial
        if start < HEADER:
            continue
        count = 0
        pos = start
        while pos + RECORD <= len(data):
            rec = data[pos : pos + RECORD]
            if parse_journal_line(rec):
                count += 1
            pos += RECORD
        if count > best_count:
            best_count = count
            best_offset = trial

    start = abs_pos - best_offset
    pos = start
    while pos + RECORD <= len(data):
        rec = data[pos : pos + RECORD]
        parsed = parse_journal_line(rec)
        if parsed:
            parsed["offset"] = pos
            lines.append(parsed)
        pos += RECORD

    return lines, best_offset, start


def group_entries(lines, month: int, year: int):
    entries = []
    current = None

    for line in lines:
        if current is None:
            current = {"doc": line["doc"], "concept": line["concept"], "lines": []}

        current["lines"].append(line)
        # heuristic: new entry when doc changes and we have balanced-ish group, or every N lines
        # Better: use marker in record - byte at offset 12-14 showed 04 03, 06 01 patterns

    return entries


def dump_record(rec: bytes):
    text = rec.decode("latin1", errors="replace")
    print("RAW:", repr(text))
    for i in range(0, RECORD, 16):
        chunk = rec[i : i + 16]
        print(f"  {i:3d}: {' '.join(f'{b:02x}' for b in chunk)}  {chunk.decode('latin1', errors='replace')!r}")


def main():
    path = ROOT / "0045861A.DAT"
    data = path.read_bytes()

    lines, offset, start = parse_1a_file(path)
    print(f"{path.name}: {len(lines)} lines, align offset={offset}, start={start}")

    for ln in lines[:15]:
        print(
            f"  {ln['dh']} {ln['amount']:>10.2f} acct={ln['account']!r:14} doc={ln['doc']!r} concept={ln['concept']!r}"
        )

    # dump a few aligned records
    pos = start
    for i in range(3):
        print(f"\nRecord {i} @ {pos}:")
        dump_record(data[pos : pos + RECORD])
        pos += RECORD

    # parse CU for subaccounts using TCLIPRO linkage
    print("\n--- TCLIPRO accounts ---")
    tp = ROOT / "TCLIPRO.DAT"
    tdata = tp.read_bytes()
    for i in range(0, min(len(tdata), 512 * 30), 512):
        rec = tdata[i : i + 512].decode("latin1", errors="replace")
        nif_m = re.search(r"\b([A-Z]\d{8}|[A-Z]\d{7}[A-Z]|\d{8}[A-Z])\b", rec)
        if not nif_m:
            continue
        nif = nif_m.group(1)
        name = rec[nif_m.end() : nif_m.end() + 35].strip()
        accts = re.findall(r"(?<!\d)(4\d{8,11}|43\d{8,10})(?!\d)", rec)
        if name:
            print(f"  {nif} -> {name[:30]!r} accounts={accts[:2]}")

    # monthly totals
    total_lines = 0
    for p in sorted(ROOT.glob("004586[1-7]A.DAT")):
        ls, _, _ = parse_1a_file(p)
        total_lines += len(ls)
        month = p.name[5]
        print(f"  month {p.name}: {len(ls)} lines")
    print(f"Total: {total_lines} lines")


if __name__ == "__main__":
    main()
