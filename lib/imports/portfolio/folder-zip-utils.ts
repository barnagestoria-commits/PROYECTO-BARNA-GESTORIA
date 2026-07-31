import JSZip from "jszip"

function basename(path: string): string {
  return path.split("/").pop()?.toLowerCase() ?? path.toLowerCase()
}

/** Extrae carpetas de un ZIP → Map<folderName, Map<fileName, Buffer>> */
export async function extractZipFolderMap(buffer: Buffer): Promise<Map<string, Map<string, Buffer>>> {
  const zip = await JSZip.loadAsync(buffer)
  const folderFiles = new Map<string, Map<string, Buffer>>()

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const parts = path.split("/").filter(Boolean)
    const topFolder = parts.length > 1 ? parts[0] : "_root_"
    const fileMap = folderFiles.get(topFolder) ?? new Map<string, Buffer>()
    fileMap.set(basename(path), await entry.async("nodebuffer"))
    folderFiles.set(topFolder, fileMap)
  }

  return folderFiles
}

/** Reconstruye un ZIP de una sola carpeta para reutilizar el parser A3 existente. */
export async function buildFolderZipBuffer(
  folderPath: string,
  files: Map<string, Buffer>,
): Promise<Buffer> {
  const zip = new JSZip()
  const folder = zip.folder(folderPath.replace(/\/$/, ""))!

  for (const [name, buffer] of files) {
    folder.file(name, buffer)
  }

  const output = await zip.generateAsync({ type: "uint8array" })
  return Buffer.from(output)
}

export function folderHasAccountingData(files: Map<string, Buffer>): boolean {
  const names = [...files.keys()]
  return names.some(
    (name) =>
      /^e\d+\.exp$/i.test(name) ||
      /004586\dA\.dat/i.test(name) ||
      name.endsWith("cu.dat") ||
      name === "diario.txt" ||
      name === "subcuent.txt" ||
      name === "suenlace.dat" ||
      name.endsWith(".dat"),
  )
}
