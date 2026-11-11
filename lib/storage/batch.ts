export const DB_INSERT_CHUNK_SIZE = 400

export function chunkArray<T>(items: T[], size = DB_INSERT_CHUNK_SIZE): T[][] {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
