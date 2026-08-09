"use client"

import { Fragment, useMemo } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import { isAnnualModel, isQuarterlyModel } from "@/lib/fiscal/fiscal-settings"
import type {
  FiscalPanoramaCell,
  FiscalPanoramaResponse,
  FiscalPanoramaScope,
  FiscalPeriodKey,
} from "@/lib/types/fiscal-panorama"
import {
  FISCAL_ANNUAL_PERIOD_COLUMNS,
  FISCAL_QUARTERLY_PERIOD_COLUMNS,
} from "@/lib/types/fiscal-panorama"
import { cn } from "@/lib/utils"

function statusBadgeClass(status: FiscalPanoramaCell["status"]): string {
  switch (status) {
    case "presentado":
      return "border-emerald-300 bg-emerald-100 text-emerald-800"
    case "pendiente":
      return "border-red-300 bg-red-100 text-red-800"
    case "sin_datos":
      return "border-red-300 bg-red-50 text-red-700"
  }
}

function cellBackgroundClass(status: FiscalPanoramaCell["status"]): string {
  switch (status) {
    case "presentado":
      return "bg-emerald-50/40"
    case "pendiente":
      return "bg-red-50/30"
    case "sin_datos":
      return "bg-gray-50"
  }
}

function PanoramaCell({ cell }: { cell: FiscalPanoramaCell }) {
  const content = (
    <div className="flex min-w-[120px] flex-col items-end gap-1">
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          cell.amount < 0 ? "text-blue-700" : cell.amount > 0 ? "text-gray-900" : "text-gray-400",
        )}
      >
        {formatFiscalAmount(cell.amount)}
      </span>
      <Badge
        variant="outline"
        className={cn("px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide", statusBadgeClass(cell.status))}
      >
        {cell.statusLabel}
      </Badge>
    </div>
  )

  return (
    <Link
      href={cell.href}
      className="block rounded-md px-2 py-1 transition-colors hover:bg-emerald-100/60 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      {content}
    </Link>
  )
}

interface FiscalPanoramaMatrixProps {
  panorama: FiscalPanoramaResponse
  scope?: FiscalPanoramaScope
}

export function FiscalPanoramaMatrix({ panorama, scope = "trimestral" }: FiscalPanoramaMatrixProps) {
  const periodColumns =
    scope === "trimestral" ? FISCAL_QUARTERLY_PERIOD_COLUMNS : FISCAL_ANNUAL_PERIOD_COLUMNS
  const periodKeys = periodColumns.map((column) => column.key)

  const blocks = useMemo(() => {
    const predicate =
      scope === "trimestral"
        ? (modelCode: string) => isQuarterlyModel(modelCode as never)
        : (modelCode: string) => isAnnualModel(modelCode as never)

    return panorama.blocks
      .map((block) => ({
        ...block,
        rows: block.rows.filter((row) => predicate(row.modelCode)),
      }))
      .filter((block) => block.rows.length > 0)
  }, [panorama.blocks, scope])

  const showSummary = scope === "trimestral"

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-graphite-600">
        {scope === "trimestral"
          ? "No hay modelos trimestrales activos para esta empresa."
          : "No hay modelos anuales activos para esta empresa."}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-emerald-900 hover:bg-emerald-900">
            <TableHead className="min-w-[220px] font-semibold text-white">Modelo</TableHead>
            {periodColumns.map((column) => (
              <TableHead key={column.key} className="text-right font-semibold text-white">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {blocks.map((block) => (
            <Fragment key={block.id}>
              <TableRow className="bg-sand-100 hover:bg-sand-100">
                <TableCell
                  colSpan={periodColumns.length + 1}
                  className="py-2 text-xs font-bold uppercase tracking-wider text-emerald-900"
                >
                  {block.label}
                </TableCell>
              </TableRow>
              {block.rows.map((row) => (
                <TableRow key={row.modelCode}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900">{row.modelLabel}</p>
                      <p className="text-xs text-gray-500">{row.description}</p>
                    </div>
                  </TableCell>
                  {periodKeys.map((periodKey) => (
                    <TableCell
                      key={`${row.modelCode}-${periodKey}`}
                      className={cn("align-top text-right", cellBackgroundClass(row.cells[periodKey].status))}
                    >
                      <PanoramaCell cell={row.cells[periodKey]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}

          {showSummary && (
            <TableRow className="border-t-2 border-emerald-700 bg-emerald-50 font-semibold hover:bg-emerald-50">
              <TableCell className="text-emerald-900">{panorama.summary.label}</TableCell>
              {periodKeys.map((periodKey: FiscalPeriodKey) => (
                <TableCell
                  key={`summary-${periodKey}`}
                  className={cn("text-right", cellBackgroundClass(panorama.summary.cells[periodKey].status))}
                >
                  <PanoramaCell cell={panorama.summary.cells[periodKey]} />
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
