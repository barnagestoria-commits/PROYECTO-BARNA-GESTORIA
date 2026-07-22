"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ContactActionsMenu } from "@/components/contacts/contact-actions-menu"
import { ContactAvatar } from "@/components/contacts/contact-avatar"
import { ContactTypeBadge } from "@/components/contacts/contact-type-badge"
import { NewContactModal, contactToForm } from "@/components/contacts/new-contact-modal"
import { cn } from "@/lib/utils"
import {
  MOCK_CONTACTS,
  contactFromForm,
  createEmptyContactForm,
  filterContactsByTab,
  searchContacts,
} from "@/lib/contacts/mock-contacts"
import type { Contact, ContactTabFilter, NewContactFormData } from "@/lib/contacts/types"

function formatEuro(amount: number): string {
  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Math.abs(amount))
  if (amount > 0) return `+${formatted}`
  if (amount < 0) return `-${formatted}`
  return formatted
}

function formatAccounts(contact: Contact): string {
  const parts: string[] = []
  if (contact.cuentaCliente) parts.push(contact.cuentaCliente)
  if (contact.cuentaProveedor) parts.push(contact.cuentaProveedor)
  return parts.join(" · ") || "—"
}

export function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ContactTabFilter>("todos")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const filteredContacts = useMemo(() => {
    const byTab = filterContactsByTab(contacts, activeTab)
    return searchContacts(byTab, searchQuery)
  }, [contacts, activeTab, searchQuery])

  const counts = useMemo(
    () => ({
      todos: contacts.length,
      clientes: filterContactsByTab(contacts, "clientes").length,
      proveedores: filterContactsByTab(contacts, "proveedores").length,
    }),
    [contacts],
  )

  const openCreateModal = () => {
    setEditingContact(null)
    setModalOpen(true)
  }

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact)
    setModalOpen(true)
  }

  const handleSubmit = (data: NewContactFormData) => {
    if (editingContact) {
      setContacts((prev) =>
        prev.map((c) =>
          c.id === editingContact.id ? { ...contactFromForm(data, c.id), saldoPendiente: c.saldoPendiente } : c,
        ),
      )
    } else {
      setContacts((prev) => [...prev, contactFromForm(data, String(Date.now()))])
    }
    setModalOpen(false)
    setEditingContact(null)
  }

  const handleDelete = (contact: Contact) => {
    if (!window.confirm(`¿Eliminar a ${contact.razonSocial}?`)) return
    setContacts((prev) => prev.filter((c) => c.id !== contact.id))
  }

  const invoiceHref =
    (contact: Contact) =>
      contact.tipo === "proveedor" || contact.tipo === "ambos"
        ? "/dashboard/compras/facturas-recibidas"
        : "/dashboard/ventas/facturas-emitidas"

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Users className="h-4 w-4" />
            Directorio comercial
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
            Clientes y Proveedores
          </h1>
          <p className="mt-1 text-sm text-graphite-500">
            {contacts.length} contactos registrados · datos de demostración
          </p>
        </div>

        <Button
          className="h-11 shrink-0 rounded-xl bg-emerald-800 px-5 hover:bg-pine-900"
          onClick={openCreateModal}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo contacto
        </Button>
      </div>

      {/* Buscador + tabs */}
      <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, NIF o email..."
            className="h-11 rounded-xl border-sand-200 pl-10"
            aria-label="Buscar contactos"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContactTabFilter)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-sand-100 p-1 sm:inline-flex sm:w-auto">
            <TabsTrigger value="todos" className="rounded-lg data-[state=active]:bg-white">
              Todos
              <span className="ml-1.5 rounded-full bg-sand-200 px-1.5 py-0.5 text-[10px] font-bold text-graphite-600">
                {counts.todos}
              </span>
            </TabsTrigger>
            <TabsTrigger value="clientes" className="rounded-lg data-[state=active]:bg-white">
              Clientes
              <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                {counts.clientes}
              </span>
            </TabsTrigger>
            <TabsTrigger value="proveedores" className="rounded-lg data-[state=active]:bg-white">
              Proveedores
              <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                {counts.proveedores}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl border border-sand-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-sand-200 bg-sand-50/80 hover:bg-sand-50/80">
                <TableHead className="min-w-[200px] text-graphite-600">Contacto / Razón social</TableHead>
                <TableHead className="text-graphite-600">NIF / CIF</TableHead>
                <TableHead className="text-graphite-600">Tipo</TableHead>
                <TableHead className="hidden text-graphite-600 md:table-cell">Cuenta contable</TableHead>
                <TableHead className="hidden text-graphite-600 lg:table-cell">Email & Teléfono</TableHead>
                <TableHead className="text-right text-graphite-600">Saldo pendiente</TableHead>
                <TableHead className="w-12 text-graphite-600">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-graphite-500">
                    No hay contactos que coincidan con la búsqueda.
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-sand-100">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ContactAvatar name={contact.razonSocial} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-pine-900">{contact.razonSocial}</p>
                          <p className="truncate text-xs text-graphite-500 lg:hidden">
                            {contact.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-graphite-700">{contact.nif}</TableCell>
                    <TableCell>
                      <ContactTypeBadge tipo={contact.tipo} />
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-graphite-600 md:table-cell">
                      {formatAccounts(contact)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="truncate text-sm text-graphite-700">{contact.email}</p>
                      <p className="truncate text-xs text-graphite-500">{contact.telefono}</p>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        contact.saldoPendiente > 0 && "text-emerald-700",
                        contact.saldoPendiente < 0 && "text-red-600",
                        contact.saldoPendiente === 0 && "text-graphite-400",
                      )}
                    >
                      {formatEuro(contact.saldoPendiente)}
                    </TableCell>
                    <TableCell>
                      <ContactActionsMenu
                        contactName={contact.razonSocial}
                        onEdit={() => openEditModal(contact)}
                        onCreateInvoice={() => router.push(invoiceHref(contact))}
                        onDelete={() => handleDelete(contact)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NewContactModal
        key={editingContact?.id ?? "new"}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingContact(null)
        }}
        onSubmit={handleSubmit}
        existingContacts={contacts}
        initialData={
          editingContact ? contactToForm(editingContact) : createEmptyContactForm(contacts)
        }
        mode={editingContact ? "edit" : "create"}
      />
    </div>
  )
}
