"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/auth-provider"
import { filterStaticCommandItems } from "@/lib/search/command-palette-index"
import type { CommandPaletteItem } from "@/lib/search/command-palette-types"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  Building2,
  Calculator,
  Command,
  Hash,
  Loader2,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react"

interface SearchApiResponse {
  success: true
  query: string
  results: {
    navigation: CommandPaletteItem[]
    actions: CommandPaletteItem[]
    thirdParties: CommandPaletteItem[]
    accounts: CommandPaletteItem[]
    companies: CommandPaletteItem[]
  }
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ResultGroup {
  id: string
  label: string
  items: CommandPaletteItem[]
}

const GROUP_ICONS: Record<string, typeof Search> = {
  actions: Zap,
  navigation: ArrowRight,
  thirdParties: Users,
  accounts: Hash,
  companies: Building2,
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const { session, setActiveCompany } = useAuth()
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [remoteGroups, setRemoteGroups] = useState<Omit<SearchApiResponse["results"], never> | null>(
    null,
  )
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebouncedValue(query, 180)

  const staticGroups = useMemo(() => {
    const filtered = filterStaticCommandItems(debouncedQuery, 12)
    return {
      actions: filtered.filter((item) => item.kind === "action"),
      navigation: filtered.filter((item) => item.kind === "navigation"),
    }
  }, [debouncedQuery])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setActiveIndex(0)
      setRemoteGroups(null)
      return
    }

    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || !session?.activeCompanyId) return

    let cancelled = false
    setIsSearching(true)

    apiFetch<SearchApiResponse>(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((data) => {
        if (!cancelled) setRemoteGroups(data.results)
      })
      .catch(() => {
        if (!cancelled) setRemoteGroups(null)
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, open, session?.activeCompanyId])

  const groups = useMemo<ResultGroup[]>(() => {
    const merged = {
      actions: remoteGroups?.actions.length ? remoteGroups.actions : staticGroups.actions,
      navigation: remoteGroups?.navigation.length ? remoteGroups.navigation : staticGroups.navigation,
      thirdParties: remoteGroups?.thirdParties ?? [],
      accounts: remoteGroups?.accounts ?? [],
      companies: remoteGroups?.companies ?? [],
    }

    return [
      { id: "actions", label: "Acciones rápidas", items: merged.actions },
      { id: "navigation", label: "Navegación", items: merged.navigation },
      { id: "thirdParties", label: "Proveedores y clientes", items: merged.thirdParties },
      { id: "accounts", label: "Subcuentas", items: merged.accounts },
      { id: "companies", label: "Empresas", items: merged.companies },
    ].filter((group) => group.items.length > 0)
  }, [remoteGroups, staticGroups.actions, staticGroups.navigation])

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups])

  const handleSelect = useCallback(
    async (item: CommandPaletteItem) => {
      onOpenChange(false)

      if (item.action === "switch-company" && item.companyId) {
        await setActiveCompany(item.companyId)
        return
      }

      if (item.href) {
        router.push(item.href)
      }
    },
    [onOpenChange, router, setActiveCompany],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
        return
      }

      if (flatItems.length === 0) return

      if (event.key === "ArrowDown") {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % flatItems.length)
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        setActiveIndex((current) => (current - 1 + flatItems.length) % flatItems.length)
      }

      if (event.key === "Enter") {
        event.preventDefault()
        const item = flatItems[activeIndex]
        if (item) void handleSelect(item)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange, flatItems, activeIndex, handleSelect])

  useEffect(() => {
    const container = listRef.current
    const activeElement = container?.querySelector('[data-active="true"]')
    activeElement?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 px-3 py-[12vh] sm:px-4">
      <button
        type="button"
        aria-label="Cerrar buscador"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-emerald-700" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar secciones, acciones, proveedores o subcuentas..."
            className="h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
          {isSearching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700" />
          ) : (
            <kbd className="hidden rounded border bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-500 sm:inline">
              ESC
            </kbd>
          )}
        </div>

        <div ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              No hay resultados para &quot;{query}&quot;.
            </div>
          ) : (
            groups.map((group) => {
              const Icon = GROUP_ICONS[group.id] ?? Sparkles
              return (
                <div key={group.id} className="pb-2">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70">
                    {group.label}
                  </p>
                  <ul>
                    {group.items.map((item) => {
                      runningIndex += 1
                      const itemIndex = runningIndex
                      const isActive = itemIndex === activeIndex

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            data-active={isActive ? "true" : "false"}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => void handleSelect(item)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                              isActive ? "bg-emerald-50 text-emerald-950" : "hover:bg-gray-50",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{item.title}</span>
                              {item.subtitle && (
                                <span className="mt-0.5 block text-xs text-gray-500">{item.subtitle}</span>
                              )}
                            </span>
                            {item.kind === "action" && (
                              <Calculator className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          <span className="hidden sm:inline">Navega con ↑ ↓ y pulsa Enter</span>
          <span className="sm:hidden">Toca un resultado para ir</span>
          <span className="inline-flex items-center gap-1">
            <Command className="h-3 w-3" />
            K
          </span>
        </div>
      </div>
    </div>
  )
}

interface CommandPaletteTriggerProps {
  onOpen: () => void
  className?: string
}

export function CommandPaletteTrigger({ onOpen, className }: CommandPaletteTriggerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpen()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpen])

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 text-left text-sm text-gray-500 transition-colors hover:border-emerald-200 hover:bg-white hover:text-gray-700",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-emerald-700" />
      <span className="min-w-0 flex-1 truncate">Buscar acciones, secciones o terceros...</span>
      <kbd className="hidden shrink-0 rounded border bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-500 sm:inline-flex sm:items-center sm:gap-0.5">
        <Command className="h-3 w-3" />
        K
      </kbd>
    </button>
  )
}
