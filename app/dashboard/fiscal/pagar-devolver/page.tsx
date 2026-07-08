import { redirect } from "next/navigation"

export default function PagarDevolverIndexPage() {
  const year = new Date().getFullYear()
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3)
  redirect(`/dashboard/fiscal/pagar-devolver/${year}/${quarter}`)
}
