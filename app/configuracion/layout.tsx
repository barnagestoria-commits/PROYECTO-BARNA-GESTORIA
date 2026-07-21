"use client"

import type { ReactNode } from "react"
import { DashboardShell } from "@/components/dashboard-shell"

export default function ConfiguracionLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
