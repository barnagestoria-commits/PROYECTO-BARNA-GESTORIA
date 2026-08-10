#!/usr/bin/env python3
"""Elimina datos de muestra de plantillas AEAT extraídas de justificantes."""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError:
    print("Instala pymupdf: .venv-pdf/bin/pip install pymupdf", file=sys.stderr)
    sys.exit(1)


def should_redact(text: str, size: float) -> bool:
    text = text.strip()
    if not text:
        return False
    if "justificante" in text.lower():
        return True
    if size < 8:
        return False
    if text.endswith("T") and len(text) <= 3 and text[0].isdigit():
        return True
    if text.isdigit() and len(text) == 4 and text.startswith("20"):
        return True
    if len(text) >= 8 and text[0].isalpha() and sum(c.isdigit() for c in text[:9]) >= 7:
        return True
    if any(c.isdigit() for c in text) and "," in text:
        return True
    return False


def sanitize_pdf(path: Path) -> int:
    doc = pymupdf.open(path)
    redacted = 0
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    size = float(span.get("size", 0))
                    if should_redact(text, size):
                        page.add_redact_annot(pymupdf.Rect(span["bbox"]), fill=(1, 1, 1))
                        redacted += 1
        page.apply_redactions()
    tmp = path.with_suffix(".tmp.pdf")
    doc.save(tmp, deflate=True, garbage=4)
    doc.close()
    shutil.move(tmp, path)
    return redacted


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="Rutas a PDF plantilla")
    args = parser.parse_args()
    for raw in args.paths:
        path = Path(raw)
        count = sanitize_pdf(path)
        print(f"{path.name}: {count} redacciones")


if __name__ == "__main__":
    main()
