import { NextResponse } from "next/server"
import {
  isValidSpanishTaxId,
  lookupCifByTaxId,
  normalizeTaxId,
} from "@/lib/contacts/cif-lookup"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawCif = searchParams.get("cif")?.trim()

  if (!rawCif) {
    return NextResponse.json({ success: false, error: "Indica un NIF o CIF." }, { status: 400 })
  }

  const cif = normalizeTaxId(rawCif)

  if (!isValidSpanishTaxId(cif)) {
    return NextResponse.json(
      { success: false, error: "El NIF/CIF introducido no es válido." },
      { status: 400 },
    )
  }

  const data = lookupCifByTaxId(cif)

  if (!data) {
    return NextResponse.json(
      {
        success: false,
        error: "No se encontraron datos automáticos para este CIF.",
        cif,
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success: true,
    cif,
    data,
    source: "mock-einforma",
  })
}
