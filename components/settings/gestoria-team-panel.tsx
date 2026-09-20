"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Trash2, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api-client"
import { getRoleLabel } from "@/lib/auth/permissions"
import type { GestoriaTeamSnapshot } from "@/lib/gestoria/team-types"

export function GestoriaTeamPanel() {
  const [team, setTeam] = useState<GestoriaTeamSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyIds: [] as string[],
  })

  const loadTeam = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiFetch<{ success: true; team: GestoriaTeamSnapshot }>("/api/gestoria/team")
      setTeam(data.team)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el equipo.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  const toggleCompany = (companyId: string, selected: string[]) =>
    selected.includes(companyId)
      ? selected.filter((id) => id !== companyId)
      : [...selected, companyId]

  const handleInvite = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await apiFetch("/api/gestoria/team", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setForm({ name: "", email: "", password: "", companyIds: [] })
      setSuccessMessage("Técnico creado. Ya puede entrar con su email y su contraseña.")
      await loadTeam()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el técnico.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAssign = async (userId: string, companyIds: string[]) => {
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await apiFetch(`/api/gestoria/team/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ companyIds }),
      })
      await loadTeam()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la cartera.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(`¿Eliminar a ${name} del equipo de la gestoría?`)) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await apiFetch(`/api/gestoria/team/${userId}`, { method: "DELETE" })
      await loadTeam()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar el usuario.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-sand-200 shadow-sm">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-emerald-700" />
          <div>
            <CardTitle className="text-lg text-pine-900">Equipo de la gestoría</CardTitle>
            <CardDescription>
              Puestos nominativos de la licencia. Cada técnico entra con su correo y su contraseña, y
              solo ve los clientes que le asignes. No accede a los libros, balances ni impuestos de la
              gestoría.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {successMessage || errorMessage ? (
          <div
            className={
              successMessage
                ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            }
          >
            {successMessage ?? errorMessage}
          </div>
        ) : null}

        {isLoading || !team ? (
          <p className="text-sm text-graphite-500">Cargando equipo…</p>
        ) : (
          <>
            <p className="text-sm text-graphite-600">
              {team.usedSeats} de {team.maxSeats} puestos ocupados
              {team.remainingSeats > 0 ? ` · ${team.remainingSeats} libres` : " · licencia completa"}
            </p>

            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-sand-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-pine-900">{member.name}</p>
                      <p className="text-sm text-graphite-500">{member.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-emerald-800">
                        {getRoleLabel(member.role)}
                      </p>
                    </div>
                    {member.role === "GESTOR" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-700"
                        onClick={() => void handleRemove(member.id, member.name)}
                        disabled={isSaving}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Quitar
                      </Button>
                    ) : null}
                  </div>

                  {member.role === "GESTOR" ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {team.clients.map((client) => {
                        const checked = member.assignedCompanyIds.includes(client.id)
                        return (
                          <label
                            key={client.id}
                            className="flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSaving}
                              onChange={() =>
                                void handleAssign(
                                  member.id,
                                  toggleCompany(client.id, member.assignedCompanyIds),
                                )
                              }
                            />
                            <span className="min-w-0 truncate">{client.name}</span>
                          </label>
                        )
                      })}
                      {team.clients.length === 0 ? (
                        <p className="text-sm text-graphite-500">Aún no hay clientes en la cartera.</p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-graphite-500">
                      Acceso completo, incluida la contabilidad propia de la gestoría.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-pine-900">
                <UserPlus className="h-4 w-4" />
                Invitar técnico
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tech-name">Nombre</Label>
                  <Input
                    id="tech-name"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tech-email">Email de empresa</Label>
                  <Input
                    id="tech-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="tech-password">Contraseña propia</Label>
                  <Input
                    id="tech-password"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </div>
              </div>
              {team.clients.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {team.clients.map((client) => (
                    <label
                      key={client.id}
                      className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.companyIds.includes(client.id)}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            companyIds: toggleCompany(client.id, current.companyIds),
                          }))
                        }
                      />
                      <span className="min-w-0 truncate">{client.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <Button
                type="button"
                className="mt-4"
                onClick={() => void handleInvite()}
                disabled={isSaving || team.remainingSeats <= 0}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Crear puesto
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
