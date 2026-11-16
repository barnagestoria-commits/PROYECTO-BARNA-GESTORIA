import { redirect } from "next/navigation"

// La antigua pantalla /admin mostraba datos inventados y no estaba protegida.
// El panel real del operador está en /admin/pagos (protegido).
export default function AdminIndexPage() {
  redirect("/admin/pagos")
}
