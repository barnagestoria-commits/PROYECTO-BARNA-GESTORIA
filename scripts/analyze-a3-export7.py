#!/usr/bin/env python3
import re
import struct
from pathlib import Path

ROOT = Path("/Users/soniamac/Downloads/E0045826")


def scan_file(path: Path, label: str):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")
    print(f"\n=== {label} ({path.name}) {len(data)} bytes ===")

    # dotted accounts
    dotted = re.findall(r"\d{3}\.\d{1,4}\s+[\x20-\x7E\u00C0-\u00FF]{4,35}", text)
    print(f"dotted accounts: {len(dotted)}")
    for x in dotted[:15]:
        print(f"  {x.strip()!r}")

    # 12-digit
    long_accts = sorted(set(re.findall(r"(?<!\d)([124567]\d{11})(?!\d)", text)))
    print(f"12-digit: {len(long_accts)} sample {long_accts[:10]}")

    # records 512
    if len(data) > 1024:
        for i in range(512, min(512 + 512 * 5, len(data)), 512):
            rec = data[i : i + 512]
            t = rec.decode("latin1", errors="replace").replace("\x00", " ")
            if re.search(r"\d{3}\.\d|\d{6,12}[A-Z]", t):
                print(f"  rec@{i}: {t[0:120].strip()!r}")


def parse_dc_mapping(path: Path):
    data = path.read_bytes()
    text = data.decode("latin1", errors="replace")
    # look for pairs of internal key + account
    pairs = re.findall(r"(40800135[\dA-Fa-f]{16,24})\s*(\d{3,12})", text)
    print(f"DC key-account pairs: {len(pairs)}")

    # binary search: 8-byte keys from 1A file
    keys = set()
    a1 = (ROOT / "0045861A.DAT").read_bytes()
    for m in re.finditer(rb"\x40\x80\x01[\x00-\xff]{5}", a1):
        keys.add(a1[m.start() : m.start() + 8].hex())

    print(f"unique 8-byte keys in 1A: {len(keys)}")
    for key in sorted(keys)[:5]:
        kbytes = bytes.fromhex(key)
        idx = data.find(kbytes)
        if idx >= 0:
            ctx = data[idx : idx + 64].decode("latin1", errors="replace")
            print(f"  key {key} found in DC @ {idx}: {ctx[:50]!r}")


def infer_account_from_line(subtype: int, concept: str, dh: str) -> str:
    upper = concept.upper()
    if subtype == 3 or "IVA S." in upper or "IVA S/" in upper:
        return "472000000000"
    if subtype == 2 and dh == "H":
        return "572000000000"
    if subtype == 6 or "GASTO A" in upper or upper.startswith("GASTO"):
        return "629000000000"
    if "PAGO FRA" in upper or "ADEUDO" in upper:
        return "572000000000"
    if subtype == 1:
        return "555000000000"
    return "999000000000"


def main():
    scan_file(ROOT / "004586DC.DAT", "DC")
    scan_file(ROOT / "004586DA.Dat", "DA")
    parse_dc_mapping(ROOT / "004586DC.DAT")

    # build third party map from TCLIPRO
    tp = ROOT / "TCLIPRO.DAT"
    text = tp.read_bytes().decode("latin1", errors="replace")
    vendors = {}
    for m in re.finditer(
        r"([A-Z]\d{8}|[A-Z]\d{7}[A-Z0-9]|\d{8}[A-Z0-9])\s{2,}([\x20-\x7E\u00C0-\u00FF\.,&\-]{5,40})",
        text,
    ):
        nif, name = m.group(1), m.group(2).strip()
        if len(name) > 4 and not name.startswith("CL"):
            key = name.split(",")[0].strip().upper()[:20]
            vendors[key] = name[:40]

    print(f"\nTCLIPRO vendors: {len(vendors)}")
    for k, v in list(vendors.items())[:8]:
        print(f"  {k!r} -> {v!r}")


if __name__ == "__main__":
    main()
