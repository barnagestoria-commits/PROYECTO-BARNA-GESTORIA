import { ASSISTED_IMPORT_EMAIL } from "@/lib/imports/assisted-import"

export function AssistedImportNotice() {
  const subject = encodeURIComponent("Migración de contabilidad")
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
      <p>
        Este archivo supera los 3 MB. A partir de ese tamaño la importación la hacemos en Taxlyn, para
        revisar el diario antes de que entre en la contabilidad.
      </p>
      <a
        href={`mailto:${ASSISTED_IMPORT_EMAIL}?subject=${subject}`}
        className="mt-2 inline-block font-semibold text-emerald-800 underline"
      >
        Escribir a {ASSISTED_IMPORT_EMAIL}
      </a>
    </div>
  )
}
