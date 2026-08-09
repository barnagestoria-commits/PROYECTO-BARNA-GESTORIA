"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Search, Users } from "lucide-react"
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
import { useRequireAuth } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { isDemoNif, MOCK_CONTACTS } from "@/lib/contacts/demo-contacts"
import {
  contactFromForm,
  createEmptyContactForm,
  filterContactsByTab,
  searchContacts,
} from "@/lib/contacts/mock-contacts"
import {
  formatContactAccounts,
  mapThirdPartiesToContacts,
  type ThirdPartyListItem,
} from "@/lib/contacts/third-party-contacts"
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

interface ThirdPartiesResponse {
  success: true
  hasRealData: boolean
  thirdParties: ThirdPartyListItem[]
}

export function ContactsPage() {
  const router = useRouter()
  const { session, activeCompany } = useRequireAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<ContactTabFilter>("todos")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    if (!session?.activeCompanyId) {
      setContacts([])
      setIsDemoMode(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const data = await apiFetch<ThirdPartiesResponse>("/api/accounting/third-parties")
      const realContacts = mapThirdPartiesToContacts(data.thirdParties)

      if (data.hasRealData || realContacts.length > 0) {
        setContacts(realContacts)
        setIsDemoMode(false)
      } else {
        setContacts(MOCK_CONTACTS)
        setIsDemoMode(true)
      }
    } catch (error) {
      setContacts([])
      setIsDemoMode(false)
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron cargar los contactos.",
      )
    } finally {
      setIsLoading(false)
    }
  }, [session?.activeCompanyId])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts, activeCompany?.id])

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

  const persistThirdParty = async (data: NewContactFormData) => {
    const requests: Promise<unknown>[] = []

    if (data.tipo === "cliente" || data.tipo === "ambos") {
      requests.push(
        apiFetch("/api/accounting/third-parties", {
          method: "POST",
          body: JSON.stringify({
            accountPrefix: "430",
            cif: data.nif,
            name: data.razonSocial,
          }),
        }),
      )
    }

    if (data.tipo === "proveedor" || data.tipo === "ambos") {
      requests.push(
        apiFetch("/api/accounting/third-parties", {
          method: "POST",
          body: JSON.stringify({
            accountPrefix: "400",
            cif: data.nif,
            name: data.razonSocial,
          }),
        }),
      )
    }

    await Promise.all(requests)
  }

  const handleSubmit = async (data: NewContactFormData) => {
    if (isDemoMode && !isDemoNif(data.nif)) {
      setIsSaving(true)
      try {
        await persistThirdParty(data)
        await loadContacts()
        setModalOpen(false)
        setEditingContact(null)
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo guardar el contacto.",
        )
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (!isDemoMode && !editingContact && !isDemoNif(data.nif)) {
      setIsSaving(true)
      try {
        await persistThirdParty(data)
        await loadContacts()
        setModalOpen(false)
        setEditingContact(null)
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo guardar el contacto.",
        )
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (editingContact) {
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === editingContact.id
            ? { ...contactFromForm(data, contact.id), saldoPendiente: contact.saldoPendiente }
            : contact,
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
    setContacts((prev) => prev.filter((contactItem) => contactItem.id !== contact.id))
  }

  const invoiceHref = (contact: Contact) =>
    contact.tipo === "proveedor" || contact.tipo === "ambos"
      ? "/dashboard/compras/facturas-recibidas"
      : "/dashboard/ventas/facturas-emitidas"

  return (
    <div className="space-y-6">
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
            {isLoading
              ? "Cargando contactos..."
              : isDemoMode
                ? `${contacts.length} contactos de ejemplo · se ocultarán al registrar datos reales`
                : `${contacts.length} contactos registrados`}
          </p>
        </div>

        <Button
          className="h-11 shrink-0 rounded-xl bg-emerald-800 px-5 hover:bg-pine-900"
          onClick={openCreateModal}
          data-tour="onboarding-new-account"
          disabled={isLoading || isSaving}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo contacto
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Buscar por nombre, NIF o email..."
            className="h-11 rounded-xl border-sand-200 pl-10"
            aria-label="Buscar contactos"
          />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ContactTabFilter)}>
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

      <div className="overflow-hidden rounded-xl border border-sand-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-graphite-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando directorio...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-sand-200 bg-sand-50/80 hover:bg-sand-50/80">
                  <TableHead className="min-w-[200px] text-graphite-600">
                    Contacto / Razón social
                  </TableHead>
                  <TableHead className="text-graphite-600">NIF / CIF</TableHead>
                  <TableHead className="text-graphite-600">Tipo</TableHead>
                  <TableHead className="hidden text-graphite-600 md:table-cell">
                    Cuenta contable
                  </TableHead>
                  <TableHead className="hidden text-graphite-600 lg:table-cell">
                    Email & Teléfono
                  </TableHead>
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
                        {formatContactAccounts(contact)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <p className="truncate text-sm text-graphite-700">{contact.email || "—"}</p>
                        <p className="truncate text-xs text-graphite-500">{contact.telefono || "—"}</p>
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
        )}
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
