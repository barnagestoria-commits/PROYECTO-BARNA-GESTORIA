#!/usr/bin/env python3
import re
import struct
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")
REC = 512


def dump_tclipro_records(limit=5):
    data = (ROOT / "TCLIPRO.DAT").read_bytes()
    shown = 0
    for i in range(0, len(data), REC):
        rec = data[i : i + REC]
        text = rec.decode("latin1", errors="replace")
        if not re.search(r"[A-Z]\d{7,8}", text):
            continue
        print(f"\n--- TCLIPRO @ {i} ---")
        for off in range(0, REC, 32):
            chunk = rec[off : off + 32]
            asc = chunk.decode("latin1", errors="replace").replace("\x00", ".")
            print(f"  {off:3d}: {asc!r}")
        shown += 1
        if shown >= limit:
            break


def find_account_in_rec(rec: bytes):
    text = rec.decode("latin1", errors="replace")
    # common A3 account storage
    for off in range(0, 128, 4):
        val = rec[off : off + 4]
        if val == b"\x00\x00\x00\x00":
            continue
        # try ascii digits
        s = val.decode("latin1", errors="replace")
        if s.isdigit() and len(s) >= 3:
            print(f"    ascii@{off}: {s!r}")


def parse_cu_subaccounts():
    data = (ROOT / "004586CU.DAT").read_bytes()
    found = []
    for i in range(512, len(data), 512):
        rec = data[i : i + 512]
        text = rec.decode("latin1", errors="replace")
        # look for 3-digit group + sub at offset ~0x78-0x90
        name = text[0x80:0xB0].strip()
        code_part = text[0x60:0x80]
        digits = re.sub(r"\D", "", code_part)
        dotted = re.search(r"(\d{3})\s*(\d{1,7})", text)
        if name and len(name) > 3 and "0000000" not in name:
            acct = digits if len(digits) >= 3 else ""
            if dotted:
                acct = dotted.group(1) + dotted.group(2).zfill(9 - len(dotted.group(1)))
            found.append((acct, name, code_part.strip(), i))
    print(f"CU subaccounts from 512-rec: {len(found)}")
    for acct, name, cp, off in found[:25]:
        print(f"  @{off} acct={acct!r} name={name!r} raw={cp!r}")


def decode_line_account(rec: bytes) -> str:
    # bytes 12-15 often 00 00 00 47/49/45
    b15 = rec[15]
    subtype = rec[10]
    # search 3-byte account prefix in header
    for off in range(16, 32):
        chunk = rec[off : off + 6]
        if re.fullmatch(r"\d{3,6}", chunk.decode("latin1", errors="ignore") or ""):
            return chunk.decode("latin1", errors="ignore")
    return f"sub{subtype}_b15_{b15}"


def main():
    dump_tclipro_records(3)
    parse_cu_subaccounts()

    data = (ROOT / "0045861A.DAT").read_bytes()
    rec = data[656:656+132]
    print("\nSample line account decode:", decode_line_account(rec))


if __name__ == "__main__":
    main()
