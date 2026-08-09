"use client"

import type { DraftCasilla, DraftSection } from "@/lib/fiscal/model-draft/types"
import { formatFiscalAmount } from "@/lib/fiscal/panorama"
import { cn } from "@/lib/utils"

const AEAT_BORDER = "border-[#1a4480]"
const AEAT_SECTION_BG = "bg-[#b8c9d9]"
const AEAT_HEADER_BG = "bg-[#dce6ef]"

function CasillaBox({ code, className }: { code: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.25rem] items-center justify-center border border-black bg-white px-1.5 py-0.5 font-mono text-xs font-bold leading-none text-black",
        className,
      )}
    >
      {code}
    </span>
  )
}

function AmountBox({
  value,
  onClick,
  className,
  empty = false,
}: {
  value: string
  onClick?: () => void
  className?: string
  empty?: boolean
}) {
  const content = (
    <span
      className={cn(
        "inline-flex min-w-[7.5rem] items-center justify-end border border-black bg-white px-2 py-1 font-mono text-sm tabular-nums text-black",
        empty && "text-neutral-400",
        className,
      )}
    >
      {value}
    </span>
  )
  if (!onClick) return content
  return (
    <button type="button" onClick={onClick} className="hover:opacity-80">
      {content}
    </button>
  )
}

function SectionTitleBar({ title }: { title: string }) {
  return (
    <div
      className={cn(
        "border-x border-b border-black px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#1a4480]",
        AEAT_SECTION_BG,
      )}
    >
      {title}
    </div>
  )
}

export function AeatOfficialFormHeader({
  modelCode,
  modelLabel,
  nif,
  companyName,
  year,
  periodLabel,
  statusLabel,
  statusClassName,
}: {
  modelCode: string
  modelLabel: string
  nif: string
  companyName: string
  year: number
  periodLabel: string
  statusLabel: string
  statusClassName: string
}) {
  return (
    <div className={cn("border border-black", AEAT_HEADER_BG)}>
      <div className="flex items-center justify-between border-b border-black px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="border border-black bg-white px-3 py-1">
            <span className="text-[10px] font-bold uppercase text-[#1a4480]">Modelo</span>
            <span className="ml-2 font-mono text-xl font-bold text-black">{modelCode}</span>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-[#1a4480]">Agencia Estatal de Administración Tributaria</p>
            <p className="text-sm font-bold text-black">{modelLabel}</p>
          </div>
        </div>
        <span className={cn("rounded border px-2 py-0.5 text-xs font-bold uppercase", statusClassName)}>
          {statusLabel}
        </span>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="border-b border-r border-black p-3 md:border-b-0">
          <p className="mb-2 border-b border-black pb-1 text-[10px] font-bold uppercase text-[#1a4480]">
            Identificación — Sujeto pasivo / Declarante
          </p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="w-24 py-1 pr-2 align-top text-xs font-bold uppercase text-black">N.I.F.</td>
                <td className="py-1">
                  <span className="inline-block min-w-[9rem] border border-black bg-white px-2 py-1 font-mono font-bold">
                    {nif}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-2 align-top text-xs font-bold uppercase text-black">Apellidos y nombre<br />o Razón social</td>
                <td className="py-1">
                  <span className="inline-block min-h-[2rem] w-full border border-black bg-white px-2 py-1 font-semibold leading-snug">
                    {companyName}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-3">
          <p className="mb-2 border-b border-black pb-1 text-[10px] font-bold uppercase text-[#1a4480]">
            Devengo
          </p>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="w-24 py-1 pr-2 text-xs font-bold uppercase text-black">Ejercicio</td>
                <td className="py-1">
                  <span className="inline-block min-w-[5rem] border border-black bg-white px-2 py-1 text-center font-mono font-bold">
                    {year}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-xs font-bold uppercase text-black">Período</td>
                <td className="py-1">
                  <span className="inline-block min-w-[5rem] border border-black bg-white px-2 py-1 text-center font-mono font-bold">
                    {periodLabel}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function AeatOfficialIvaSection({
  section,
  onOpenDetail,
}: {
  section: DraftSection
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  const showBaseColumn = section.casillas.some((cell) => cell.baseAmount !== undefined || cell.relatedCode)

  return (
    <div className="border-x border-b border-black bg-white">
      <SectionTitleBar title={section.title} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {showBaseColumn ? (
            <thead>
              <tr className="border-b border-black bg-[#eef3f8] text-[10px] font-bold uppercase text-[#1a4480]">
                <th className="w-24 border-r border-black px-2 py-1 text-center">Casilla</th>
                <th className="border-r border-black px-2 py-1 text-left">Concepto</th>
                <th className="w-36 border-r border-black px-2 py-1 text-center">Base imponible</th>
                <th className="w-36 px-2 py-1 text-center">Cuota</th>
              </tr>
            </thead>
          ) : null}
          <tbody>
            {section.casillas.map((cell) => (
              <AeatOfficialIvaRow key={cell.id} cell={cell} showBaseColumn={showBaseColumn} onOpenDetail={onOpenDetail} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AeatOfficialIvaRow({
  cell,
  showBaseColumn,
  onOpenDetail,
}: {
  cell: DraftCasilla
  showBaseColumn: boolean
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  return (
    <tr className="border-b border-black last:border-b-0">
      <td className="border-r border-black px-2 py-2 align-middle">
        <div className="flex flex-wrap items-center justify-center gap-1">
          <CasillaBox code={cell.code} />
          {cell.relatedCode ? (
            <>
              <span className="text-xs text-neutral-500">/</span>
              <CasillaBox code={cell.relatedCode} />
            </>
          ) : null}
        </div>
      </td>
      <td className="border-r border-black px-3 py-2 align-middle text-black">
        <button
          type="button"
          className="text-left text-sm hover:underline"
          onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — [${cell.code}]`)}
        >
          {cell.label}
        </button>
        {cell.description ? <p className="mt-0.5 text-[11px] text-neutral-600">{cell.description}</p> : null}
      </td>
      {showBaseColumn ? (
        <td className="border-r border-black px-2 py-2 text-center align-middle">
          {cell.baseAmount !== undefined ? (
            <AmountBox
              value={formatFiscalAmount(cell.baseAmount)}
              onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — Base [${cell.code}]`)}
            />
          ) : (
            <AmountBox value="—" empty />
          )}
        </td>
      ) : null}
      <td className="px-2 py-2 text-center align-middle">
        <AmountBox
          value={formatFiscalAmount(cell.amount)}
          onClick={() =>
            onOpenDetail(
              cell.sectionKey,
              `${cell.label} — ${cell.relatedCode ? `Cuota [${cell.relatedCode}]` : `Casilla [${cell.code}]`}`,
            )
          }
        />
      </td>
    </tr>
  )
}

function isCountCasilla(cell: DraftCasilla): boolean {
  const label = cell.label.toLowerCase()
  return (
    label.includes("número") ||
    label.includes("numero") ||
    label.includes("perceptores") ||
    label.includes("declarados") ||
    label.includes("operadores")
  )
}

function formatCellAmount(cell: DraftCasilla): string {
  if (isCountCasilla(cell)) return String(Math.round(cell.amount))
  return formatFiscalAmount(cell.amount)
}

export function AeatOfficialSingleAmountSection({
  section,
  onOpenDetail,
}: {
  section: DraftSection
  onOpenDetail: (sectionKey?: string, title?: string) => void
}) {
  return (
    <div className="border-x border-b border-black bg-white">
      <SectionTitleBar title={section.title} />
      <table className="w-full border-collapse text-sm">
        <tbody>
          {section.casillas.map((cell) => (
            <tr key={cell.id} className="border-b border-black last:border-b-0">
              <td className="w-24 border-r border-black px-2 py-2 text-center align-middle">
                <CasillaBox code={cell.code} />
              </td>
              <td className="border-r border-black px-3 py-2 align-middle text-black">
                <button
                  type="button"
                  className="text-left text-sm hover:underline"
                  onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — [${cell.code}]`)}
                >
                  {cell.label}
                </button>
                {cell.description ? <p className="mt-0.5 text-[11px] text-neutral-600">{cell.description}</p> : null}
              </td>
              <td className="px-2 py-2 text-center align-middle">
                <AmountBox
                  value={formatCellAmount(cell)}
                  onClick={() => onOpenDetail(cell.sectionKey, `${cell.label} — [${cell.code}]`)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AeatOfficialResultRow({
  label,
  amount,
  onOpenDetail,
}: {
  label: string
  amount: number
  onOpenDetail: () => void
}) {
  return (
    <div className={cn("flex items-center justify-between border border-black px-4 py-3", AEAT_SECTION_BG)}>
      <span className="text-sm font-bold uppercase text-[#1a4480]">{label}</span>
      <AmountBox value={formatFiscalAmount(amount)} onClick={onOpenDetail} className="min-w-[9rem] text-base font-bold" />
    </div>
  )
}

export { AEAT_BORDER, AEAT_HEADER_BG, AEAT_SECTION_BG }
