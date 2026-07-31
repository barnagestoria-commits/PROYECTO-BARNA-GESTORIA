#!/usr/bin/env python3
import re
import struct
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")


def find_dh_lines(data: bytes):
    text = data.decode("latin1", errors="replace")
    for m in re.finditer(r"([DH])(\d{11,14})", text):
        marker, amount_raw = m.group(1), m.group(2)
        # amounts often stored as integer cents * 100?
        if len(amount_raw) >= 11:
            val = int(amount_raw[:11]) / 100
        else:
            val = int(amount_raw) / 100
        start = max(0, m.start() - 80)
        context = text[start : m.start()].replace("\x00", " ").strip()
        print(f"{marker} {val:>12.2f}  ctx={context[-50:]!r}")


def scan_record_sizes(path: Path):
    data = path.read_bytes()
    print(f"\n{path.name} len={len(data)}")
    for header in range(0, 2048, 256):
        body = len(data) - header
        if body <= 0:
            continue
        hits = []
        for rec in range(64, 1025, 64):
            if body % rec == 0:
                hits.append(f"{rec}x{body//rec}")
        if hits:
            print(f"  header={header}: {', '.join(hits)}")


def parse_1a_entries(path: Path, limit=10):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")

    # concept lines often end with doc ref like A/250185
    concepts = list(re.finditer(r"([\x20-\x7E\u00C0-\u00FF]{10,38})\s{2,}([A-Z0-9/\-]{4,12})\s{2,}", text))
    print(f"\n{path.name}: {len(concepts)} concept blocks")
    for m in concepts[:limit]:
        concept, doc = m.group(1).strip(), m.group(2).strip()
        tail = text[m.end() : m.end() + 80]
        dh = re.findall(r"([DH])(\d{11,14})", tail[:60])
        print(f"  doc={doc!r} concept={concept!r} lines={dh[:4]}")


def parse_cu_records(path: Path, limit=15):
    data = path.read_bytes()
    header = 512
    rec_size = 512
    records = [data[i : i + rec_size] for i in range(header, len(data), rec_size)]
    print(f"\n{path.name}: {len(records)} records of {rec_size}B")

    count = 0
    for rec in records:
        text = rec.decode("latin1", errors="replace")
        # look for subaccount pattern: digits + name
        m = re.search(r"(\d{3,12})\s{0,4}([\x20-\x7E\u00C0-\u00FF]{4,30})", text)
        if not m:
            # alternate: name at fixed offset ~0x80
            name = text[0x80:0xB0].strip()
            code_area = text[0x60:0x80]
            digits = re.findall(r"\d{3,12}", code_area)
            if name and len(name) > 3:
                print(f"  code_area={code_area!r} name={name!r}")
                count += 1
        else:
            print(f"  code={m.group(1)!r} name={m.group(2).strip()!r}")
            count += 1
        if count >= limit:
            break


def parse_tclipro(path: Path, limit=8):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")
    # NIF pattern
    for m in re.finditer(r"([A-Z0-9]{8,12})\s{5,}([A-Z0-9][\x20-\x7E\u00C0-\u00FF\.]{5,35})\s{2,}", text):
        print(f"  nif={m.group(1)!r} name={m.group(2).strip()!r}")
        limit -= 1
        if limit <= 0:
            break


def main():
    for name in ["0045861A.DAT", "004586DA.Dat", "004586CU.DAT", "004586DC.DAT"]:
        scan_record_sizes(ROOT / name)

    parse_1a_entries(ROOT / "0045861A.DAT")
    parse_cu_records(ROOT / "004586CU.DAT")
    print("\nTCLIPRO sample:")
    parse_tclipro(ROOT / "TCLIPRO.DAT")

    print("\nDH amounts in 1A:")
    find_dh_lines((ROOT / "0045861A.DAT").read_bytes())


if __name__ == "__main__":
    main()
