#!/usr/bin/env python3
import re
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
        count = sum(
            1
            for pos in range(start, len(data) - RECORD, RECORD)
            if re.search(rb"[DH]\d{11,14}", data[pos : pos + RECORD])
        )
        if count > best[1]:
            best = (trial, count)
    start = abs_pos - best[0]
    lines = []
    pos = start
    while pos + RECORD <= len(data):
        rec = data[pos : pos + RECORD]
        m = re.search(rb"([DH])(\d{11,14})", rec)
        if m:
            amount = int(m.group(2).decode()) / 100
            text = rec.decode("latin1", errors="replace")
            concept = text[15 : m.start()].replace("\x00", " ").strip()
            lines.append(
                {
                    "entry_key": rec[0:10].hex(),
                    "subtype": rec[10],
                    "dh": m.group(1).decode(),
                    "amount": amount,
                    "concept": concept,
                }
            )
        pos += RECORD
    return lines


def main():
    lines = parse_lines(ROOT / "0045861A.DAT")
    by_sub = {}
    for l in lines:
        by_sub.setdefault(l["subtype"], []).append(l["concept"][:50])

    for sub, concepts in sorted(by_sub.items()):
        print(f"\nSubtype {sub} ({len(concepts)} lines):")
        for c in concepts[:8]:
            print(f"  {c!r}")

    entries = Counter(l["entry_key"] for l in lines)
    print(f"\nUnique entries in 1A: {len(entries)}")
    sizes = Counter()
    from itertools import groupby
    for key, group in groupby(lines, key=lambda x: x["entry_key"]):
        sizes[len(list(group))] += 1
    print("Lines per entry:", dict(sorted(sizes.items())))


if __name__ == "__main__":
    main()
