/**
 * Valida un ZIP de exportación A3: equilibrio de asientos, cuentas genéricas
 * y subcuentas no enlazadas.
 *
 * Uso:
 *   npx tsx scripts/validate-a3-import.ts ruta/al/export.zip
 *   npx tsx scripts/validate-a3-import.ts ruta/al/export.zip --json
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parseA3ZipBuffer } from "@/lib/imports/a3/parse-a3-zip"
import {
  aggregateAccountTotals,
  summarizeImportValidation,
  validateA3ImportPreview,
} from "@/lib/accounting/import-validation"

async function main() {
  const args = process.argv.slice(2)
  const jsonOutput = args.includes("--json")
  const filePath = args.find((arg) => !arg.startsWith("--"))

  if (!filePath) {
    console.error("Uso: npx tsx scripts/validate-a3-import.ts <archivo.zip> [--json]")
    process.exit(1)
  }

  const absolutePath = resolve(filePath)
  const buffer = readFileSync(absolutePath)
  const preview = await parseA3ZipBuffer(buffer, absolutePath.split("/").pop() ?? "import.zip")
  const issues = validateA3ImportPreview(preview)
  const summary = summarizeImportValidation(issues)
  const accountTotals = aggregateAccountTotals(preview.entries)

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          file: absolutePath,
          importMode: preview.contents.importMode,
          entryCount: preview.entryCount,
          subaccountCount: preview.subaccountCount,
          summary,
          issues,
          topAccounts: accountTotals.slice(0, 20),
        },
        null,
        2,
      ),
    )
    process.exit(summary.isValid ? 0 : 1)
  }

  console.log(`\nValidación A3: ${absolutePath}`)
  console.log(`Modo: ${preview.contents.importMode}`)
  console.log(`Asientos: ${preview.entryCount} | Subcuentas: ${preview.subaccountCount}`)
  console.log(`Errores: ${summary.errorCount} | Avisos: ${summary.warningCount}\n`)

  if (issues.length === 0) {
    console.log("✓ Sin problemas detectados.")
    return
  }

  for (const issue of issues) {
    const icon = issue.severity === "error" ? "✗" : "⚠"
    const cuenta = issue.cuenta ? ` [${issue.cuenta}]` : ""
    console.log(`${icon} ${issue.code}${cuenta}: ${issue.message}`)
  }

  console.log("\n--- Top cuentas por movimiento ---")
  for (const row of accountTotals.slice(0, 15)) {
    console.log(`  ${row.cuenta}  debe=${row.totalDebe.toFixed(2)}  haber=${row.totalHaber.toFixed(2)}  saldo=${row.saldo.toFixed(2)}`)
  }

  process.exit(summary.isValid ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
