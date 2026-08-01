import {
  formatA3Date,
  isSuenlaceRecord,
  normalizeAccountCode,
  parseA3Amount,
  sliceField,
  splitFixedRecords,
} from "@/lib/imports/a3/fixed-record"
import type { ImportBytes } from "@/lib/imports/a3/import-bytes"
import type { A3JournalEntry, A3JournalLine, A3Subaccount } from "@/lib/imports/a3/types"

const JOURNAL_RECORD_TYPES = new Set(["0", "1", "2", "9"])

function parseJournalLine(record: string, recordType: string): A3JournalLine | null {
  const fecha = formatA3Date(sliceField(record, 7, 8))
  const cuenta = normalizeAccountCode(sliceField(record, 16, 12))
  if (!fecha || !cuenta) return null

  const dhType = sliceField(record, 58, 1).toUpperCase()
  const importe = parseA3Amount(sliceField(record, 100, 14))
  const concepto = sliceField(record, 70, 30) || sliceField(record, 28, 30)
  const documento = sliceField(record, 59, 10)
  const lineMarker = sliceField(record, 69, 1).toUpperCase() as A3JournalLine["lineMarker"]

  let debe = 0
  let haber = 0

  if (recordType === "9") {
    const cargoAbono = dhType
    if (cargoAbono === "A") haber = importe
    else debe = importe
  } else if (recordType === "1" || recordType === "2") {
    debe = importe
  } else {
    if (dhType === "H") haber = importe
    else debe = importe
  }

  return {
    fecha,
    cuenta,
    concepto,
    debe,
    haber,
    documento: documento || undefined,
    lineMarker: lineMarker === "I" || lineMarker === "M" || lineMarker === "U" ? lineMarker : undefined,
  }
}

function parseSubaccountRecord(record: string): A3Subaccount | null {
  const recordType = sliceField(record, 15, 1).toUpperCase()
  if (recordType !== "C") return null

  const ampliacion = sliceField(record, 73, 1)
  if (ampliacion && ampliacion !== "" && ampliacion !== " ") return null

  const accountCode = normalizeAccountCode(sliceField(record, 16, 12))
  const name = sliceField(record, 28, 30)
  if (!accountCode || !name) return null

  const nif = sliceField(record, 78, 14) || undefined
  return { accountCode, name, nif }
}

function groupLinesIntoEntries(lines: Array<A3JournalLine & { recordType: string }>): A3JournalEntry[] {
  const entries: A3JournalEntry[] = []
  let current: A3JournalEntry | null = null

  const flush = () => {
    if (current && current.lines.length > 0) {
      entries.push(current)
    }
    current = null
  }

  for (const line of lines) {
    const marker = line.lineMarker
    const startsEntry = marker === "I" || (!marker && !current)

    if (startsEntry) {
      flush()
      current = {
        fecha: line.fecha,
        documento: line.documento ?? "",
        concepto: line.concepto,
        lines: [],
        recordTypes: [line.recordType],
      }
    } else if (!current) {
      current = {
        fecha: line.fecha,
        documento: line.documento ?? "",
        concepto: line.concepto,
        lines: [],
        recordTypes: [line.recordType],
      }
    } else if (!current.recordTypes.includes(line.recordType)) {
      current.recordTypes.push(line.recordType)
    }

    current!.lines.push({
      fecha: line.fecha,
      cuenta: line.cuenta,
      concepto: line.concepto,
      debe: line.debe,
      haber: line.haber,
      documento: line.documento,
      lineMarker: line.lineMarker,
    })

    if (marker === "U") {
      flush()
    }
  }

  flush()

  if (entries.length === 0 && lines.length > 0) {
    const byKey = new Map<string, A3JournalEntry>()
    for (const line of lines) {
      const key = `${line.fecha}|${line.documento ?? ""}|${line.concepto}`
      const existing = byKey.get(key)
      if (existing) {
        existing.lines.push(line)
        if (!existing.recordTypes.includes(line.recordType)) {
          existing.recordTypes.push(line.recordType)
        }
      } else {
        byKey.set(key, {
          fecha: line.fecha,
          documento: line.documento ?? "",
          concepto: line.concepto,
          lines: [line],
          recordTypes: [line.recordType],
        })
      }
    }
    return [...byKey.values()]
  }

  return entries
}

export function parseSuenlaceBuffer(buffer: ImportBytes): {
  entries: A3JournalEntry[]
  subaccounts: A3Subaccount[]
  companyCode: string | null
  recordTypes: string[]
} {
  const records = splitFixedRecords(buffer)
  const journalLines: Array<A3JournalLine & { recordType: string }> = []
  const subaccounts: A3Subaccount[] = []
  const recordTypes = new Set<string>()
  let companyCode: string | null = null

  for (const record of records) {
    if (!isSuenlaceRecord(record)) continue

    if (!companyCode) {
      companyCode = sliceField(record, 2, 5) || null
    }

    const recordType = sliceField(record, 15, 1).toUpperCase()
    if (!recordType) continue
    recordTypes.add(recordType)

    if (recordType === "C") {
      const sub = parseSubaccountRecord(record)
      if (sub) subaccounts.push(sub)
      continue
    }

    if (!JOURNAL_RECORD_TYPES.has(recordType)) continue

    const line = parseJournalLine(record, recordType)
    if (line && (line.debe > 0 || line.haber > 0)) {
      journalLines.push({ ...line, recordType })
    }
  }

  return {
    entries: groupLinesIntoEntries(journalLines),
    subaccounts,
    companyCode,
    recordTypes: [...recordTypes],
  }
}
