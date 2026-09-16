import { formatAccountCodeStored } from "@/lib/accounting/third-party-types"
import { accountCodeLookupVariants } from "@/lib/accounting/account-code-edit"
import { normalizeCuenta } from "@/lib/reports/format"
import { prisma } from "@/lib/db"

export interface TransferAccountMovementsInput {
  fromAccountCode: string
  toAccountCode: string
  lineIds: string[]
}

export interface TransferredAccountMovements {
  fromAccountCode: string
  toAccountCode: string
  formattedToAccountCode: string
  linesUpdated: number
}

export async function transferAccountMovements(
  companyId: string,
  input: TransferAccountMovementsInput,
): Promise<TransferredAccountMovements> {
  const fromDigits = normalizeCuenta(input.fromAccountCode)
  const toDigits = normalizeCuenta(input.toAccountCode)
  const lineIds = [...new Set(input.lineIds.map((id) => id.trim()).filter(Boolean))]

  if (!fromDigits) {
    throw new Error("Indica la cuenta de origen.")
  }
  if (!toDigits) {
    throw new Error("Indica la cuenta destino del traspaso.")
  }
  if (fromDigits === toDigits) {
    throw new Error("La cuenta destino debe ser distinta de la cuenta actual.")
  }
  if (lineIds.length === 0) {
    throw new Error("Selecciona al menos un movimiento para traspasar.")
  }

  const fromVariants = accountCodeLookupVariants(fromDigits)
  const toFormatted = formatAccountCodeStored(toDigits)

  const lines = await prisma.entryLine.findMany({
    where: {
      id: { in: lineIds },
      entry: { companyId },
    },
    select: { id: true, cuenta: true },
  })

  if (lines.length === 0) {
    throw new Error("No se encontraron los movimientos seleccionados.")
  }

  const transferableIds = lines
    .filter((line) => {
      const digits = normalizeCuenta(line.cuenta)
      return digits === fromDigits || fromVariants.includes(line.cuenta)
    })
    .map((line) => line.id)

  if (transferableIds.length === 0) {
    throw new Error("Los movimientos seleccionados no pertenecen a esta cuenta.")
  }

  await prisma.entryLine.updateMany({
    where: { id: { in: transferableIds } },
    data: { cuenta: toFormatted },
  })

  return {
    fromAccountCode: fromDigits,
    toAccountCode: toDigits,
    formattedToAccountCode: toFormatted,
    linesUpdated: transferableIds.length,
  }
}
