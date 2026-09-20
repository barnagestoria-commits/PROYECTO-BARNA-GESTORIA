import type { UserRole } from "@/lib/types/auth"

export interface GestoriaTeamMemberDto {
  id: string
  name: string
  email: string
  role: UserRole
  assignedCompanyIds: string[]
}

export interface GestoriaTeamSnapshot {
  members: GestoriaTeamMemberDto[]
  maxSeats: number
  usedSeats: number
  remainingSeats: number
  clients: Array<{ id: string; name: string; cif: string | null }>
}

export interface GestoriaHonorariosInvoice {
  id: string
  fecha: string
  invoiceNumber: string | null
  concepto: string
  amount: number
}
