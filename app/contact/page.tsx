import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ContactInfo } from "@/components/contact-info"
import { WhatsAppIntegration } from "@/components/whatsapp-integration"
import { ArrowLeft, Send } from "lucide-react"
import Link from "next/link"
import { ResponsiveLogo } from "@/components/responsive-logo"

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <ResponsiveLogo size="md" />
            <h1 className="text-lg md:text-2xl font-bold text-emerald-800">
              <span className="hidden sm:inline">Barna Gestoría</span>
              <span className="sm:hidden">Barna</span>
            </h1>
          </div>
          <Button
            variant="outline"
            className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 bg-transparent"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-emerald-800 mb-4">Contacta con Nosotros</h1>
            <p className="text-xl text-emerald-600 max-w-2xl mx-auto">
              Estamos aquí para ayudarte con todas tus necesidades contables, fiscales y laborales
            </p>
          </div>

          {/* WhatsApp Integration */}
          <div className="mb-12">
            <WhatsAppIntegration />
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Información de contacto */}
            <div className="space-y-8">
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-emerald-800">Información de Contacto</CardTitle>
                  <CardDescription>Ponte en contacto con nuestro equipo profesional</CardDescription>
                </CardHeader>
                <CardContent>
                  <ContactInfo variant="card" />
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-emerald-800">Horarios de Atención</CardTitle>
                  <CardDescription>Nuestros horarios de oficina</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium">Lunes - Viernes:</span>
                    <span className="text-emerald-700">9:00 - 18:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Sábados:</span>
                    <span className="text-emerald-700">9:00 - 14:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Domingos:</span>
                    <span className="text-gray-500">Cerrado</span>
                  </div>
                  <div className="pt-3 border-t">
                    <p className="text-sm text-emerald-600">
                      📱 <strong>WhatsApp disponible 24/7</strong> - Respuesta garantizada en horario laboral
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-emerald-800">Servicios Principales</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-emerald-700">
                    <li>• Contabilidad y Administración</li>
                    <li>• Asesoría Fiscal y Tributaria</li>
                    <li>• Gestión Laboral y Nóminas</li>
                    <li>• Constitución de Empresas</li>
                    <li>• Trámites con Hacienda y Seguridad Social</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Formulario de contacto */}
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle className="text-emerald-800">Envíanos un Mensaje</CardTitle>
                <CardDescription>Te responderemos lo antes posible</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input id="name" placeholder="Tu nombre completo" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" placeholder="tu@email.com" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input id="phone" type="tel" placeholder="+34 600 000 000" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" placeholder="Nombre de tu empresa" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Asunto *</Label>
                    <Input id="subject" placeholder="¿En qué podemos ayudarte?" required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Mensaje *</Label>
                    <Textarea
                      id="message"
                      placeholder="Cuéntanos más detalles sobre tu consulta..."
                      rows={5}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Mensaje
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
