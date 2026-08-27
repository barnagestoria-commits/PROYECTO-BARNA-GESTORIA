export function createBlankRecord(length: number): string[] {
  return Array.from({ length }, () => " ")
}

export function writeAt(record: string[], position: number, value: string, length: number): void {
  const start = position - 1
  const normalized = value.slice(0, length).padEnd(length, " ")
  for (let i = 0; i < length; i += 1) {
    record[start + i] = normalized[i] ?? " "
  }
}

export function recordToString(record: string[]): string {
  return record.join("")
}
