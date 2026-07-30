#!/usr/bin/env node
/**
 * Prueba el parser con la carpeta nativa E0045826 (comprimida en ZIP).
 * Uso: npx tsx scripts/test-a3-native-export.ts [/ruta/a/E0045826]
 */
import { execSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseA3ZipBuffer } from "../lib/imports/a3/parse-a3-zip"

async function main() {
  const source = process.argv[2] ?? "/Users/soniamac/Downloads/E0045826"
  const tempDir = mkdtempSync(join(tmpdir(), "a3-export-"))
  const zipPath = join(tempDir, "E0045826.zip")

  execSync(`cd "${source}/.." && zip -r "${zipPath}" "$(basename "${source}")"`, {
    stdio: "ignore",
  })

  const buffer = readFileSync(zipPath)
  const preview = await parseA3ZipBuffer(buffer, "E0045826.zip")

  console.log(
    JSON.stringify(
      {
        format: preview.contents.linkFormat,
        companyCode: preview.companyCode,
        fiscalYear: preview.fiscalYear,
        entries: preview.entryCount,
        subaccounts: preview.subaccountCount,
        recordTypes: preview.recordTypes,
        thirdPartyCount: preview.thirdPartyCount,
        matchedLines: preview.entries.reduce(
          (count, entry) => count + entry.lines.filter((line) => line.vendorCif).length,
          0,
        ),
        warnings: preview.warnings,
        firstEntry: preview.entries[0],
      },
      null,
      2,
    ),
  )

  rmSync(tempDir, { recursive: true, force: true })

  if (preview.entryCount < 100) {
    throw new Error(`Se esperaban cientos de asientos, solo se detectaron ${preview.entryCount}.`)
  }

  console.log("\nOK — export nativo E0045826 parseado.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
