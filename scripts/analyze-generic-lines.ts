#!/usr/bin/env node
import { execSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isGenericProviderCode } from "../lib/imports/a3/native-account-code"
import { parseA3ZipBuffer } from "../lib/imports/a3/parse-a3-zip"

async function main() {
  const source = process.argv[2] ?? "/Users/soniamac/Downloads/E0045826"
  const tempDir = mkdtempSync(join(tmpdir(), "a3-"))
  const zipPath = join(tempDir, "E.zip")
  execSync(`cd "${source}/.." && zip -r "${zipPath}" "$(basename "${source}")"`, { stdio: "ignore" })
  const preview = await parseA3ZipBuffer(readFileSync(zipPath), "E.zip")
  rmSync(tempDir, { recursive: true, force: true })

  const generic = preview.entries.flatMap((e) => e.lines).filter((l) => isGenericProviderCode(l.cuenta))
  console.log("Generic lines:", generic.length)
  for (const line of generic.slice(0, 40)) {
    console.log(" ", line.concepto.slice(0, 80))
  }
}

main().catch(console.error)
