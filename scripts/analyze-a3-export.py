#!/usr/bin/env python3
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "/Users/soniamac/Downloads/E0045826")


def analyze(path: Path, label: str) -> None:
    data = path.read_bytes()
    print(f"\n=== {label} ({path.name}) size={len(data)} ===")
    text = data.decode("latin1", errors="replace")

    accounts = sorted(set(re.findall(r"[1-7]\d{11}", text)))
    print(f"12-digit accounts: {len(accounts)} unique")
    if accounts:
        print(f"  sample: {accounts[:8]}")

    dates = sorted(set(re.findall(r"202[0-9]{5}", text)))
    print(f"dates AAAAMMDD: {len(dates)} unique")
    if dates:
        print(f"  sample: {dates[:8]}")

    # readable spans
    spans = re.findall(r"[\x20-\x7E\u00C0-\u00FF]{8,40}", text)
    print(f"readable spans: {len(spans)}")
    for span in spans[:15]:
        print(f"  {span!r}")

    for header in [256, 512, 768, 1024, 1280, 1536]:
        body = len(data) - header
        if body <= 0:
            continue
        for rec in [64, 128, 192, 256, 320, 384, 512]:
            if body % rec == 0:
                print(f"  header={header} record={rec} count={body // rec}")


def dump_region(path: Path, offset: int, length: int = 256) -> None:
    data = path.read_bytes()[offset : offset + length]
    print(f"\n--- hex {path.name} @ {offset} ---")
    for i in range(0, len(data), 32):
        chunk = data[i : i + 32]
        hexpart = " ".join(f"{b:02x}" for b in chunk)
        ascpart = "".join(chr(b) if 32 <= b < 127 else "." for b in chunk)
        print(f"{offset+i:08x}  {hexpart:<96}  {ascpart}")


def main() -> None:
    files = {
        "004586CU.DAT": "CU cuentas",
        "004586DA.Dat": "DA diario",
        "0045861A.DAT": "1A enero",
        "004586DC.DAT": "DC",
        "TCLIPRO.DAT": "clientes/proveedores",
    }

    for name, label in files.items():
        path = ROOT / name
        if path.exists():
            analyze(path, label)

    cu = ROOT / "004586CU.DAT"
    da = ROOT / "004586DA.Dat"
    if cu.exists():
        dump_region(cu, 512)
        dump_region(cu, 1024)
        dump_region(cu, 1536)
    if da.exists():
        dump_region(da, 512)
        dump_region(da, 1024)


if __name__ == "__main__":
    main()
