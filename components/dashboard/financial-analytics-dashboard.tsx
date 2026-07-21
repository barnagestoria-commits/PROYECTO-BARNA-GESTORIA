"use client"

import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarRange,
  CircleDollarSign,
  Info,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  DATE_RANGE_OPTIONS,
  formatEuro,
  formatPercent,
  getFinancialDashboardData,
  type DateRangeKey,
  type FinancialAlert,
  type KpiMetric,
  type RecentTransaction,
} from "@/lib/dashboard/mock-financial-data"

interface FinancialAnalyticsDashboardProps {
  userName: string
  companyName?: string
  onUploadClick?: () => void
}

function TrendBadge({ changePercent, invertColors = false }: { changePercent: number; invertColors?: boolean }) {
  const isPositive = changePercent >= 0
  const isGood = invertColors ? !isPositive : isPositive

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
        isGood ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
      )}
    >
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formatPercent(changePercent)}
    </span>
  )
}

function KpiCard({
  metric,
  icon,
  invertTrend,
  accentClass,
}: {
  metric: KpiMetric
  icon: ReactNode
  invertTrend?: boolean
  accentClass?: string
}) {
  return (
    <Card className="rounded-xl border-sand-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-graphite-600">{metric.label}</CardTitle>
        <div className={cn("rounded-lg bg-sand-100 p-2 text-emerald-800", accentClass)}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
          {formatEuro(metric.value)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <TrendBadge changePercent={metric.changePercent} invertColors={invertTrend} />
          <span className="text-xs text-graphite-500">vs. periodo anterior</span>
        </div>
        {metric.count !== undefined && (
          <p className="mt-2 text-xs text-graphite-500">
            {metric.count} facturas · {metric.subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: RecentTransaction["status"] }) {
  const styles = {
    pagada: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pendiente: "border-amber-200 bg-amber-50 text-amber-800",
    cancelada: "border-graphite-200 bg-graphite-50 text-graphite-600",
  }
  const labels = {
    pagada: "Pagada",
    pendiente: "Pendiente",
    cancelada: "Cancelada",
  }

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", styles[status])}>
      {labels[status]}
    </Badge>
  )
}

function AlertIcon({ severity }: { severity: FinancialAlert["severity"] }) {
  if (severity === "urgent") return <AlertTriangle className="h-4 w-4 text-red-600" />
  if (severity === "warning") return <Bell className="h-4 w-4 text-amber-600" />
  return <Info className="h-4 w-4 text-emerald-700" />
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-graphite-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatEuro(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function FinancialAnalyticsDashboard({
  userName,
  companyName,
  onUploadClick,
}: FinancialAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRangeKey>("this_month")
  const data = useMemo(() => getFinancialDashboardData(dateRange), [dateRange])

  const firstName = userName.split(" ")[0] || userName
  const totalExpenses = data.expenseCategories.reduce((sum, c) => sum + c.value, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-sand-200 bg-gradient-to-br from-white via-sand-50/50 to-emerald-50/30 p-4 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-emerald-700">Panel financiero</p>
          <h2 className="text-2xl font-bold tracking-tight text-pine-900 sm:text-3xl">
            Hola, {firstName} 👋
          </h2>
          <p className="text-sm text-graphite-600">
            {companyName
              ? `Resumen de ${companyName} · ${data.rangeLabel}`
              : `Resumen financiero · ${data.rangeLabel}`}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeKey)}
              className="h-10 w-full appearance-none rounded-xl border border-sand-300 bg-white pl-10 pr-8 text-sm font-medium text-pine-900 shadow-sm transition-colors hover:border-emerald-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:w-auto"
              aria-label="Rango de fechas"
            >
              {DATE_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            className="h-10 rounded-xl bg-emerald-800 px-4 shadow-sm hover:bg-pine-900"
            onClick={onUploadClick}
          >
            <Upload className="mr-2 h-4 w-4" />
            Subir factura / extracto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          metric={data.kpis.ingresos}
          icon={<TrendingUp className="h-4 w-4" />}
          accentClass="bg-emerald-50"
        />
        <KpiCard
          metric={data.kpis.gastos}
          icon={<TrendingDown className="h-4 w-4" />}
          invertTrend
          accentClass="bg-gold-100/60"
        />
        <KpiCard
          metric={data.kpis.beneficio}
          icon={<Wallet className="h-4 w-4" />}
          accentClass="bg-pine-50"
        />
        <KpiCard
          metric={data.kpis.pendientes}
          icon={<Receipt className="h-4 w-4" />}
          accentClass="bg-amber-50"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-xl border-sand-200 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-pine-900">Evolución ingresos vs gastos</CardTitle>
            <CardDescription>Comparativa mensual del periodo seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full sm:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.evolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ingresosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#145A32" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#145A32" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gastosGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C2A878" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#C2A878" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EAE3D2" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#6a6a6a", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6a6a6a", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 12 }}
                    formatter={(value) => (
                      <span className="text-sm text-graphite-600">{value}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="#145A32"
                    strokeWidth={2}
                    fill="url(#ingresosGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="gastos"
                    name="Gastos"
                    stroke="#C2A878"
                    strokeWidth={2}
                    fill="url(#gastosGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-pine-900">Gastos por categoría</CardTitle>
            <CardDescription>Distribución del periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expenseCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {data.expenseCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatEuro(Number(value ?? 0))}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #EAE3D2",
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-2">
              {data.expenseCategories.map((cat) => (
                <li key={cat.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-graphite-700">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>
                  <span className="font-medium text-pine-900">
                    {Math.round((cat.value / totalExpenses) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: transactions + alerts */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-xl border-sand-200 shadow-sm xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg text-pine-900">Facturas recientes</CardTitle>
              <CardDescription>Últimas transacciones registradas</CardDescription>
            </div>
            <CircleDollarSign className="h-5 w-5 text-emerald-700" />
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-sand-200 hover:bg-transparent">
                    <TableHead className="text-graphite-600">Cliente / Proveedor</TableHead>
                    <TableHead className="hidden text-graphite-600 sm:table-cell">Referencia</TableHead>
                    <TableHead className="text-graphite-600">Fecha</TableHead>
                    <TableHead className="text-graphite-600">Estado</TableHead>
                    <TableHead className="text-right text-graphite-600">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-sand-100">
                      <TableCell className="font-medium text-pine-900">{tx.counterparty}</TableCell>
                      <TableCell className="hidden text-graphite-500 sm:table-cell">{tx.reference}</TableCell>
                      <TableCell className="text-graphite-600">
                        {new Date(tx.date).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          tx.amount >= 0 ? "text-emerald-700" : "text-graphite-800",
                        )}
                      >
                        {formatEuro(tx.amount, { signed: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-sand-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-pine-900">Alertas y recordatorios</CardTitle>
            <CardDescription>Próximas acciones recomendadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex gap-3 rounded-xl border p-3 transition-colors",
                  alert.severity === "urgent" && "border-red-200 bg-red-50/50",
                  alert.severity === "warning" && "border-amber-200 bg-amber-50/40",
                  alert.severity === "info" && "border-emerald-200 bg-emerald-50/40",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <AlertIcon severity={alert.severity} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-pine-900">{alert.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-graphite-600">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-graphite-400">
        Datos de demostración · Conecta contabilidad real para métricas en vivo
      </p>
    </div>
  )
}
