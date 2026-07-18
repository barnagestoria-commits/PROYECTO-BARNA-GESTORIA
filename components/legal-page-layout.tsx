import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResponsiveLogo } from "@/components/responsive-logo"

interface LegalPageLayoutProps {
  title: string
  description: string
  lastUpdated?: string
  children: ReactNode
}

export function LegalPageLayout({
  title,
  description,
  lastUpdated = "Pendiente de revisión legal",
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      <header className="border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="md" />
            <span className="text-lg font-bold text-emerald-800 md:text-xl">Barna Gestoría</span>
          </div>
          <Button
            variant="outline"
            className="border-emerald-600 bg-transparent text-emerald-700 hover:bg-emerald-50"
            asChild
          >
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 space-y-3">
          <p className="text-sm text-graphite-500">Última actualización: {lastUpdated}</p>
          <h1 className="text-3xl font-bold text-emerald-900 md:text-4xl">{title}</h1>
          <p className="text-lg text-graphite-600">{description}</p>
        </div>

        <article className="space-y-8 rounded-xl border border-sand-300 bg-white p-6 shadow-sm md:p-10">
          {children}
        </article>

        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-graphite-500">
          <Link href="/politica-privacidad" className="hover:text-emerald-700 hover:underline">
            Política de privacidad
          </Link>
          <Link href="/terminos-servicio" className="hover:text-emerald-700 hover:underline">
            Términos del servicio
          </Link>
          <Link href="/contact" className="hover:text-emerald-700 hover:underline">
            Contacto
          </Link>
        </footer>
      </main>
    </div>
  )
}

interface LegalSectionProps {
  title: string
  placeholder: string
  children?: ReactNode
}

export function LegalSection({ title, placeholder, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-pine-900">{title}</h2>
      {children ?? (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          [PLACEHOLDER] {placeholder}
        </p>
      )}
    </section>
  )
}
