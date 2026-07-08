"use client"

import { formatAmount, formatEuro } from "@/lib/reports/format"
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Barna Gestoría</p>
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

function SectionTable({
  title,
  sections,
}: {
  title: string
  sections: Array<{
    title: string
    rows: Array<{ cuenta: string; label: string; amount: number; level: number }>
    subtotal: number
  }>
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
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-900 hover:bg-emerald-900">
                  <TableHead className="w-24 text-white">Cuenta</TableHead>
                  <TableHead className="text-white">Descripción</TableHead>
                  <TableHead className="w-32 text-right text-white">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => (
                  <TableRow key={row.cuenta}>
                    <TableCell className="font-mono text-xs">{row.cuenta}</TableCell>
                    <TableCell className="text-sm">
                      <IndentLabel text={row.label} level={row.level} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatAmount(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-emerald-50 font-semibold">
                  <TableCell colSpan={2}>Subtotal {section.title}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatAmount(section.subtotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
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
                  <TableCell className="font-mono text-xs">{row.cuenta}</TableCell>
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
  return (
    <div className="space-y-6">
      <ReportHeader meta={data.data.meta} />
      <SectionTable title="Activo" sections={data.data.activo} />
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-950">
        <span>Total activo</span>
        <span className="font-mono tabular-nums">{formatEuro(data.data.totalActivo)}</span>
      </div>
      <SectionTable title="Patrimonio neto y pasivo" sections={data.data.pasivo} />
      <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-950">
        <span>Total patrimonio neto y pasivo</span>
        <span className="font-mono tabular-nums">{formatEuro(data.data.totalPasivo)}</span>
      </div>
    </div>
  )
}

function PygPreview({ data }: { data: SerializedPreview & { type: "pyg" } }) {
  return (
    <div className="space-y-6">
      <ReportHeader meta={data.data.meta} />
      <SectionTable title="Ingresos" sections={data.data.ingresos} />
      <div className="flex items-center justify-between rounded-md border px-4 py-2 font-semibold">
        <span>Total ingresos</span>
        <span className="font-mono tabular-nums">{formatEuro(data.data.totalIngresos)}</span>
      </div>
      <SectionTable title="Gastos" sections={data.data.gastos} />
      <div className="flex items-center justify-between rounded-md border px-4 py-2 font-semibold">
        <span>Total gastos</span>
        <span className="font-mono tabular-nums">{formatEuro(data.data.totalGastos)}</span>
      </div>
      <div
        className={cn(
          "flex items-center justify-between rounded-lg px-4 py-3 text-lg font-bold",
          data.data.resultado >= 0 ? "bg-emerald-100 text-emerald-900" : "bg-red-50 text-red-800",
        )}
      >
        <span>Resultado del ejercicio</span>
        <span className="font-mono tabular-nums">{formatEuro(data.data.resultado)}</span>
      </div>
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
