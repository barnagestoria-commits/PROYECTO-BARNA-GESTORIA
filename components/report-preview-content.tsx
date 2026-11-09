"use client"

import { formatAmount, formatChangePercent } from "@/lib/reports/format"
import type { StatementColumn } from "@/lib/reports/statement-layout"
import { formatAccountCodeDisplay } from "@/lib/accounting/third-party-types"
import type {
  BalanceReportData,
  PygReportData,
  ReportMeta,
  SumasSaldosReportData,
} from "@/lib/reports/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SerializedReportMeta = Omit<ReportMeta, "generatedAt"> & { generatedAt: string }

type SerializedPreview =
  | { type: "sumas-saldos"; data: Omit<SumasSaldosReportData, "meta"> & { meta: SerializedReportMeta } }
  | { type: "balance"; data: Omit<BalanceReportData, "meta"> & { meta: SerializedReportMeta } }
  | { type: "pyg"; data: Omit<PygReportData, "meta"> & { meta: SerializedReportMeta } }

function ReportHeader({ meta }: { meta: SerializedReportMeta }) {
  return (
    <div className="border-b border-emerald-200 pb-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Taxlyn</p>
      <h2 className="mt-1 text-xl font-bold text-emerald-950">{meta.reportTitle}</h2>
      <div className="mt-3 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
        <p>
          <span className="font-medium text-gray-800">Empresa:</span> {meta.companyName}
        </p>
        <p>
          <span className="font-medium text-gray-800">NIF:</span> {meta.companyCif ?? "—"}
        </p>
        <p>
          <span className="font-medium text-gray-800">Ejercicio:</span> {meta.year}
        </p>
        <p>
          <span className="font-medium text-gray-800">Periodo:</span> {meta.periodLabel}
        </p>
      </div>
    </div>
  )
}

function IndentLabel({ text, level }: { text: string; level: number }) {
  return <span style={{ paddingLeft: `${level * 12}px` }}>{text}</span>
}

function columnsFor(
  columns: StatementColumn[] | undefined,
  year: number,
  compareYear?: number | null,
): StatementColumn[] {
  if (columns && columns.length > 0) return columns
  if (compareYear) {
    return [
      { id: "current", label: String(year), kind: "amount" },
      { id: "compare", label: String(compareYear), kind: "amount" },
    ]
  }
  return [{ id: "amount", label: "Importe", kind: "amount" }]
}

function valuesFor(
  row: { amount: number; compareAmount?: number; values?: Array<number | null> },
  columns: StatementColumn[],
  compareYear?: number | null,
): Array<number | null> {
  if (row.values && row.values.length === columns.length) return row.values
  if (compareYear) return [row.amount, row.compareAmount ?? 0]
  return [row.amount]
}

function ColumnValue({ column, value }: { column: StatementColumn; value: number | null }) {
  if (column.kind === "percent") {
    return (
      <span className={cn(value !== null && value < 0 && "text-red-700", value !== null && value > 0 && "text-emerald-800")}>
        {formatChangePercent(value)}
      </span>
    )
  }
  return <>{formatAmount(value ?? 0)}</>
}

function SectionTable({
  title,
  sections,
  columns,
}: {
  title: string
  sections: Array<{
    title: string
    rows: Array<{ cuenta: string; label: string; amount: number; compareAmount?: number; values?: Array<number | null>; level: number }>
    subtotal: number
    compareSubtotal?: number
    subtotals?: Array<number | null>
  }>
  columns: StatementColumn[]
}) {
  if (sections.length === 0) {
    return <p className="text-sm italic text-gray-500">Sin datos en {title.toLowerCase()}.</p>
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-900">{title}</h3>
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <p className="text-sm font-semibold text-gray-800">{section.title}</p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-900 hover:bg-emerald-900">
                  <TableHead className="w-24 text-white">Cuenta</TableHead>
                  <TableHead className="min-w-40 text-white">Descripción</TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.id} className="min-w-24 text-right text-white">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => {
                  const values = valuesFor(row, columns)
                  return (
                    <TableRow key={row.cuenta}>
                      <TableCell className="font-mono text-xs">{formatAccountCodeDisplay(row.cuenta)}</TableCell>
                      <TableCell className="text-sm">
                        <IndentLabel text={row.label} level={row.level} />
                      </TableCell>
                      {columns.map((column, index) => (
                        <TableCell key={column.id} className="text-right font-mono text-sm tabular-nums">
                          <ColumnValue column={column} value={values[index] ?? null} />
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
                <TableRow className="bg-emerald-50 font-semibold">
                  <TableCell colSpan={2}>Subtotal {section.title}</TableCell>
                  {columns.map((column, index) => (
                    <TableCell key={column.id} className="text-right font-mono tabular-nums">
                      <ColumnValue
                        column={column}
                        value={section.subtotals?.[index] ?? (index === 0 ? section.subtotal : section.compareSubtotal ?? 0)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  )
}

function TotalLine({ label, values, columns }: { label: string; values?: Array<number | null>; columns: StatementColumn[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-950">
      <span>{label}</span>
      <span className="flex flex-wrap justify-end gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
        {columns.map((column, index) => (
          <span key={column.id} className="text-right">
            <span className="mr-1 text-[10px] font-sans font-medium uppercase tracking-wide text-emerald-700">
              {column.label}
            </span>
            <ColumnValue column={column} value={values?.[index] ?? null} />
          </span>
        ))}
      </span>
    </div>
  )
}

function SumasSaldosPreview({ data }: { data: SerializedPreview & { type: "sumas-saldos" } }) {
  const rows = data.data.rows.filter(
    (row) => row.totalDebe !== 0 || row.totalHaber !== 0 || row.saldo !== 0,
  )

  return (
    <div className="space-y-4">
      <ReportHeader meta={data.data.meta} />
      {rows.length === 0 ? (
        <p className="text-sm italic text-gray-500">No hay movimientos contables en el periodo.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-emerald-900 hover:bg-emerald-900">
                <TableHead className="w-24 text-white">Cuenta</TableHead>
                <TableHead className="text-white">Descripción</TableHead>
                <TableHead className="w-28 text-right text-white">Debe</TableHead>
                <TableHead className="w-28 text-right text-white">Haber</TableHead>
                <TableHead className="w-28 text-right text-white">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.cuenta}>
                  <TableCell className="font-mono text-xs">{formatAccountCodeDisplay(row.cuenta)}</TableCell>
                  <TableCell className="text-sm">
                    <IndentLabel text={row.label} level={row.level} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatAmount(row.totalDebe)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatAmount(row.totalHaber)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatAmount(row.saldo)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-emerald-50 font-semibold">
                <TableCell colSpan={2}>TOTALES</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatAmount(data.data.totalDebe)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatAmount(data.data.totalHaber)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatAmount(data.data.totalDebe - data.data.totalHaber)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function BalancePreview({ data }: { data: SerializedPreview & { type: "balance" } }) {
  const columns = columnsFor(data.data.meta.columns, data.data.meta.year, data.data.meta.compareYear)
  return (
    <div className="space-y-6">
      <ReportHeader meta={data.data.meta} />
      <SectionTable title="Activo" sections={data.data.activo} columns={columns} />
      <TotalLine label="Total activo" values={data.data.totalActivoValues ?? [data.data.totalActivo]} columns={columns} />
      <SectionTable title="Patrimonio neto y pasivo" sections={data.data.pasivo} columns={columns} />
      <TotalLine
        label="Total patrimonio neto y pasivo"
        values={data.data.totalPasivoValues ?? [data.data.totalPasivo]}
        columns={columns}
      />
    </div>
  )
}

function PygPreview({ data }: { data: SerializedPreview & { type: "pyg" } }) {
  const columns = columnsFor(data.data.meta.columns, data.data.meta.year, data.data.meta.compareYear)
  return (
    <div className="space-y-6">
      <ReportHeader meta={data.data.meta} />
      <SectionTable title="Ingresos" sections={data.data.ingresos} columns={columns} />
      <TotalLine label="Total ingresos" values={data.data.totalIngresosValues ?? [data.data.totalIngresos]} columns={columns} />
      <SectionTable title="Gastos" sections={data.data.gastos} columns={columns} />
      <TotalLine label="Total gastos" values={data.data.totalGastosValues ?? [data.data.totalGastos]} columns={columns} />
      <TotalLine label="Resultado del ejercicio" values={data.data.resultadoValues ?? [data.data.resultado]} columns={columns} />
    </div>
  )
}

export function ReportPreviewContent({ preview }: { preview: SerializedPreview }) {
  switch (preview.type) {
    case "sumas-saldos":
      return <SumasSaldosPreview data={preview} />
    case "balance":
      return <BalancePreview data={preview} />
    case "pyg":
      return <PygPreview data={preview} />
  }
}

export type { SerializedPreview }
