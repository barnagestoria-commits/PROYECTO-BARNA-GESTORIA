/** Binary payload compatible with Node Buffer and browser Uint8Array. */
export type ImportBytes = Uint8Array | Buffer

export function toUint8Array(data: ArrayBuffer | ImportBytes): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    const nodeBuffer = data as Buffer
    return new Uint8Array(nodeBuffer.buffer, nodeBuffer.byteOffset, nodeBuffer.byteLength)
  }
  return new Uint8Array(data as ArrayBuffer)
}

export function decodeLatin1(buffer: ImportBytes): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
    return buffer.toString("latin1")
  }
  let result = ""
  for (let i = 0; i < buffer.length; i++) {
    result += String.fromCharCode(buffer[i]!)
  }
  return result
}

let cp850Decoder: TextDecoder | null | undefined

function getCp850Decoder(): TextDecoder | null {
  if (cp850Decoder !== undefined) return cp850Decoder
  try {
    cp850Decoder = new TextDecoder("ibm850")
  } catch {
    cp850Decoder = null
  }
  return cp850Decoder
}

/** Texto de ficheros binarios A3/COBOL (CP850, con fallback Latin-1). */
export function decodeA3Text(buffer: ImportBytes): string {
  const bytes = toUint8Array(buffer)
  const decoder = getCp850Decoder()
  if (decoder) return decoder.decode(bytes)
  return decodeLatin1(bytes)
}

export function decodeA3TextSlice(buffer: ImportBytes, start: number, end: number): string {
  return decodeA3Text(toUint8Array(buffer).subarray(start, end))
}

export function bytesToHex(buffer: ImportBytes): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
    return buffer.toString("hex")
  }
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
