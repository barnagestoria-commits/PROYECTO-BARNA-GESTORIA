#!/usr/bin/env node
/**
 * Extrae las páginas de formulario de justificantes AEAT y genera plantillas en assets/aeat-templates/.
 *
 * Uso:
 *   node scripts/build-aeat-templates.mjs /ruta/al/justificante.pdf 303 1,2,3
 *
 * Si no se indican páginas, se omiten la portada de presentación (página 1).
 */
import { PDFDocument } from "pdf-lib"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [, , sourcePath, modelCode, pagesArg] = process.argv

if (!sourcePath || !modelCode) {
  console.error("Uso: node scripts/build-aeat-templates.mjs <justificante.pdf> <modelo> [paginas]")
  process.exit(1)
}

const srcBytes = readFileSync(sourcePath)
const src = await PDFDocument.load(srcBytes)
const total = src.getPageCount()
const pageIndices = pagesArg
  ? pagesArg.split(",").map((value) => Number.parseInt(value.trim(), 10) - 1)
  : Array.from({ length: total - 1 }, (_, index) => index + 1)

const dst = await PDFDocument.create()
const copied = await dst.copyPages(src, pageIndices)
for (const page of copied) dst.addPage(page)

const outDir = join(process.cwd(), "assets", "aeat-templates")
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `modelo-${modelCode}.pdf`)
writeFileSync(outPath, await dst.save())

const sanitizer = join(process.cwd(), "scripts", "sanitize-aeat-template.py")
const python = join(process.cwd(), ".venv-pdf", "bin", "python3")
try {
  execFileSync(python, [sanitizer, outPath], { stdio: "inherit" })
} catch {
  console.warn("Aviso: no se pudo sanitizar la plantilla (¿.venv-pdf con pymupdf?).")
}

console.log(`Plantilla generada: ${outPath} (${pageIndices.length} páginas)`)
