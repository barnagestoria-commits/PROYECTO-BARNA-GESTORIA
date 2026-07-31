#!/usr/bin/env python3
import re
import statistics
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")


def amount_after_dh(s: str) -> float:
    m = re.match(r"([DH])(\d{14})", s)
    if not m:
        m = re.match(r"([DH])(\d{11})", s)
    if not m:
        return 0.0
    return int(m.group(2)[-11:]) / 100


def line_markers(path: Path):
    data = path.read_bytes()
    positions = []
    for m in re.finditer(rb"[DH]\d{11,14}", data):
        positions.append(m.start())
    print(f"\n{path.name}: {len(positions)} DH markers")
    if len(positions) >= 3:
        gaps = [positions[i + 1] - positions[i] for i in range(min(50, len(positions) - 1))]
        common = {}
        for g in gaps:
            common[g] = common.get(g, 0) + 1
        top = sorted(common.items(), key=lambda x: -x[1])[:8]
        print(f"  top gaps: {top}")
        print(f"  median gap: {statistics.median(gaps):.0f}")


def inspect_line_record(path: Path, pos: int):
    data = path.read_bytes()
    start = pos - 128
    chunk = data[start : pos + 32]
    text = chunk.decode("latin1", errors="replace")
    print(f"\n--- record @ {pos} ---")
    for i in range(0, len(chunk), 32):
        off = start + i
        row = chunk[i : i + 32]
        hexpart = " ".join(f"{b:02x}" for b in row)
        asc = row.decode("latin1", errors="replace").replace("\x00", ".")
        print(f"{off:06x}  {hexpart}  {asc!r}")


def try_parse_1a_lines(path: Path, record_size: int, header: int = 512):
    data = path.read_bytes()
    lines = []
    for off in range(header, len(data) - record_size, record_size):
        rec = data[off : off + record_size]
        text = rec.decode("latin1", errors="replace")
        m = re.search(r"([DH])(\d{11,14})", text)
        if not m:
            continue
        amount = amount_after_dh(m.group(0))
        if amount <= 0:
            continue
        dh = m.group(1)
        # account candidates at fixed offsets
        acct_a = re.sub(r"\D", "", text[0:16])
        acct_b = re.sub(r"\D", "", text[16:32])
        acct_c = re.sub(r"\D", "", text[32:48])
        concept = text[0:40].replace("\x00", " ").strip()
        doc = re.search(r"([A-Z0-9/\-]{3,15})\s*$", text[0:80])
        lines.append(
            {
                "off": off,
                "dh": dh,
                "amount": amount,
                "concept": concept[:35],
                "doc": doc.group(1) if doc else "",
                "a": acct_a,
                "b": acct_b,
                "c": acct_c,
            }
        )
    return lines


def main():
    path = ROOT / "0045861A.DAT"
    line_markers(path)

    # inspect a known line
    data = path.read_bytes()
    pos = data.find(b"D00000000035060")
    inspect_line_record(path, pos)

    for rec in [128, 160, 192, 256, 320, 384, 512]:
        lines = try_parse_1a_lines(path, rec)
        if len(lines) > 50:
            print(f"\nrecord={rec}: {len(lines)} parsed lines")
            for ln in lines[:8]:
                print(f"  {ln['dh']} {ln['amount']:>10.2f} doc={ln['doc']!r} a={ln['a']!r} b={ln['b']!r} c={ln['c']!r} concept={ln['concept']!r}")


if __name__ == "__main__":
    main()
