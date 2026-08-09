import { describe, expect, it } from "vitest"
import JSZip from "jszip"
import { ZipWriter, BlobWriter, TextReader, BlobReader, ZipReader, Uint8ArrayWriter } from "@zip.js/zip.js"
import { extractZipFiles } from "@/lib/imports/a3/extract-zip-files"
import {
  ZipPasswordIncorrectError,
  ZipPasswordRequiredError,
  isJsZipEncryptedLoadError,
} from "@/lib/imports/a3/zip-password-errors"

async function buildZip(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content)
  }
  return zip.generateAsync({ type: "uint8array" })
}

async function buildEncryptedZip(password: string): Promise<Uint8Array> {
  const blobWriter = new BlobWriter("application/zip")
  const zipWriter = new ZipWriter(blobWriter)
  await zipWriter.add("diario.txt", new TextReader("linea 1"), { password })
  await zipWriter.close()
  const blob = await blobWriter.getData()
  return new Uint8Array(await blob.arrayBuffer())
}

describe("extractZipFiles", () => {
  it("ignora metadatos __MACOSX y ._*", async () => {
    const zipBytes = await buildZip({
      "E0045826/TCLIPRO.DAT": "real",
      "__MACOSX/E0045826/._TCLIPRO.DAT": "junk",
      "E0045826/TPREDEFI.Dat": "defaults",
    })
    const { byBase, paths } = await extractZipFiles(zipBytes)
    expect(paths).toHaveLength(2)
    expect(byBase.get("tclipro.dat")?.[0]).toBe("r".charCodeAt(0))
    expect(byBase.get("tpredefi.dat")?.[0]).toBe("d".charCodeAt(0))
    expect(byBase.has("._tclipro.dat")).toBe(false)
  })

  it("detects encrypted zip without password", async () => {
    const zipBytes = await buildEncryptedZip("a3-secret")
    await expect(extractZipFiles(zipBytes)).rejects.toBeInstanceOf(ZipPasswordRequiredError)
  })

  it("extracts encrypted zip with correct password", async () => {
    const zipBytes = await buildEncryptedZip("a3-secret")
    const { byBase, paths } = await extractZipFiles(zipBytes, "a3-secret")
    expect(paths).toContain("diario.txt")
    expect(byBase.get("diario.txt")).toBeTruthy()
  })

  it("rejects encrypted zip with wrong password", async () => {
    const zipBytes = await buildEncryptedZip("a3-secret")
    await expect(extractZipFiles(zipBytes, "wrong")).rejects.toBeInstanceOf(ZipPasswordIncorrectError)
  })
})

describe("isJsZipEncryptedLoadError", () => {
  it("matches JSZip encrypted message", () => {
    expect(isJsZipEncryptedLoadError(new Error("Encrypted zip are not supported"))).toBe(true)
  })
})

describe("zip.js sanity", () => {
  it("creates encrypted entries", async () => {
    const zipBytes = await buildEncryptedZip("test")
    const reader = new ZipReader(new BlobReader(new Blob([zipBytes])))
    const entries = await reader.getEntries()
    await expect(entries[0]!.getData(new Uint8ArrayWriter())).rejects.toThrow(/encrypted/i)
    await reader.close()
  })
})
