import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Upload, Download, Shield } from "lucide-react"
import { ContactInfo } from "@/components/contact-info"
import { ResponsiveLogo } from "@/components/responsive-logo"
import { ProcessAnimation } from "@/components/process-animation"

export default function HomePage() {
  return (
    <div className="min-h-screen elegant-gradient">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-sand-300 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="md" />
            <h1 className="text-lg md:text-2xl font-bold text-pine-900">
              <span className="hidden sm:inline">Barna Gestoría</span>
              <span className="sm:hidden">Barna</span>
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#inicio" className="text-pine-800 hover:text-emerald-800 font-medium transition-colors">
              Inicio
            </Link>
            <Link href="#servicios" className="text-pine-800 hover:text-emerald-800 font-medium transition-colors">
              Servicios
            </Link>
            <Link href="/contact" className="text-pine-800 hover:text-emerald-800 font-medium transition-colors">
              Contacto
            </Link>
          </nav>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-emerald-700 text-emerald-800 hover:bg-emerald-50 bg-white/80 transition-all"
              asChild
            >
              <Link href="/login">Iniciar Sesión</Link>
            </Button>
            <Button className="bg-emerald-800 hover:bg-pine-900 transition-all shadow-lg" asChild>
              <Link href="/register">Registrarse</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl lg:text-6xl font-bold text-pine-900 leading-tight">
                Gestoría
                <br />
                <span className="text-emerald-800">Contable, Fiscal</span>
                <br />
                <span className="text-pine-800">y Laboral</span>
              </h2>
              <p className="text-xl text-graphite-700 max-w-lg">
                Servicios de gestoría en Barcelona para empresas y autónomos.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                size="lg"
                className="bg-emerald-800 hover:bg-pine-900 text-white px-8 py-4 text-lg rounded-2xl shadow-lg transition-all hover:shadow-xl"
                asChild
              >
                <Link href="/register">Consultar</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-gold-600 text-gold-800 hover:bg-gold-50 px-8 py-4 text-lg rounded-2xl bg-white/80 transition-all hover:shadow-lg"
                asChild
              >
                <Link href="/admin">Mi panel de empresa</Link>
              </Button>
            </div>
          </div>

          {/* Process Animation */}
          <div className="relative">
            <ProcessAnimation />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="servicios" className="bg-white py-16 lg:py-24 relative z-10">
        <div className="container mx-auto px-4">
          <h3 className="text-4xl font-bold text-center mb-4 text-pine-900">¿Cómo funciona?</h3>
          <p className="text-center text-graphite-600 mb-12 text-lg">
            Proceso simple y seguro para gestionar tus documentos.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-white border-sand-300 hover:shadow-xl transition-all duration-300 hover:border-gold-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Upload className="h-8 w-8 text-emerald-800" />
                </div>
                <CardTitle className="text-pine-900">1. Sube tus Documentos</CardTitle>
                <CardDescription className="text-graphite-600">
                  Facturas recibidas, emitidas y extractos bancarios de forma segura.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white border-sand-300 hover:shadow-xl transition-all duration-300 hover:border-gold-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <FileText className="h-8 w-8 text-gold-800" />
                </div>
                <CardTitle className="text-pine-900">2. Organizamos</CardTitle>
                <CardDescription className="text-graphite-600">
                  Categorizamos y organizamos toda tu documentación fiscal.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-white border-sand-300 hover:shadow-xl transition-all duration-300 hover:border-gold-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-pine-100 to-pine-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
                  <Download className="h-8 w-8 text-pine-800" />
                </div>
                <CardTitle className="text-pine-900">3. Contabilizamos</CardTitle>
                <CardDescription className="text-graphite-600">
                  Procesamos tu información y mantenemos tu contabilidad al día.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-gradient-to-br from-sand-50 to-sand-100 py-16 lg:py-24 relative z-10">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Shield className="h-10 w-10 text-emerald-800" />
          </div>
          <h3 className="text-4xl font-bold mb-6 text-pine-900">Seguridad Garantizada</h3>
          <p className="text-graphite-700 max-w-2xl mx-auto text-lg">
            Todos tus documentos están protegidos con encriptación de nivel bancario. Cumplimos con todas las normativas
            de protección de datos y RGPD.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="pine-gradient text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 md:gap-3 mb-4">
                <ResponsiveLogo size="sm" className="brightness-0 invert" />
                <span className="text-lg md:text-xl font-bold">
                  <span className="hidden sm:inline">Barna Gestoría</span>
                  <span className="sm:hidden">Barna</span>
                </span>
              </div>
              <p className="text-sand-200">
                Gestoría Contable, Fiscal y Laboral especializada en empresas y autónomos en Barcelona.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gold-200">Servicios</h4>
              <ul className="space-y-2 text-sand-200">
                <li>• Contabilidad</li>
                <li>• Asesoría Fiscal</li>
                <li>• Gestión Laboral</li>
                <li>• Constitución de Empresas</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gold-200">Contacto</h4>
              <ContactInfo variant="footer" showIcons={false} />
            </div>
          </div>

          <div className="border-t border-emerald-700 mt-8 pt-8 text-center text-sand-200">
            <p>&copy; 2024 Barna Gestoría. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
