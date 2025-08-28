"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Smartphone,
  Monitor,
  UserPlus,
  Upload,
  FileText,
  CheckCircle,
  Download,
  Play,
  Pause,
  RotateCcw,
  Leaf,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ResponsiveLogo } from "./responsive-logo"

interface ProcessAnimationProps {
  className?: string
}

type DeviceType = "desktop" | "mobile"
type AnimationStep = "homepage" | "register" | "upload" | "process" | "complete"

export function ProcessAnimation({ className }: ProcessAnimationProps) {
  const [currentDevice, setCurrentDevice] = useState<DeviceType>("desktop")
  const [currentStep, setCurrentStep] = useState<AnimationStep>("homepage")
  const [isPlaying, setIsPlaying] = useState(true)
  const [animationKey, setAnimationKey] = useState(0)

  const steps = [
    {
      id: "homepage" as AnimationStep,
      title: "1. Página de Inicio",
      description: "Conoce nuestros servicios",
      icon: Monitor,
      duration: 4000,
    },
    {
      id: "register" as AnimationStep,
      title: "2. Registro",
      description: "Crea tu cuenta en segundos",
      icon: UserPlus,
      duration: 3000,
    },
    {
      id: "upload" as AnimationStep,
      title: "3. Subir Documentos",
      description: "Arrastra tus facturas y extractos",
      icon: Upload,
      duration: 3000,
    },
    {
      id: "process" as AnimationStep,
      title: "4. Procesamiento",
      description: "Organizamos tu información",
      icon: FileText,
      duration: 3000,
    },
    {
      id: "complete" as AnimationStep,
      title: "5. Listo",
      description: "Tu contabilidad al día",
      icon: CheckCircle,
      duration: 3000,
    },
  ]

  useEffect(() => {
    if (!isPlaying) return

    const currentStepIndex = steps.findIndex((step) => step.id === currentStep)
    const currentStepData = steps[currentStepIndex]

    const timer = setTimeout(() => {
      const nextIndex = (currentStepIndex + 1) % steps.length
      setCurrentStep(steps[nextIndex].id)
    }, currentStepData.duration)

    return () => clearTimeout(timer)
  }, [currentStep, isPlaying])

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const resetAnimation = () => {
    setCurrentStep("homepage")
    setAnimationKey((prev) => prev + 1)
    setIsPlaying(true)
  }

  const switchDevice = (device: DeviceType) => {
    setCurrentDevice(device)
    setAnimationKey((prev) => prev + 1)
  }

  return (
    <div className={cn("relative w-full max-w-4xl mx-auto", className)}>
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg">
          <Button
            variant={currentDevice === "desktop" ? "default" : "ghost"}
            size="sm"
            onClick={() => switchDevice("desktop")}
            className={cn("rounded-full", currentDevice === "desktop" && "bg-emerald-600 hover:bg-emerald-700")}
          >
            <Monitor className="h-4 w-4 mr-2" />
            Desktop
          </Button>
          <Button
            variant={currentDevice === "mobile" ? "default" : "ghost"}
            size="sm"
            onClick={() => switchDevice("mobile")}
            className={cn("rounded-full", currentDevice === "mobile" && "bg-emerald-600 hover:bg-emerald-700")}
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Móvil
          </Button>
        </div>

        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-lg">
          <Button variant="ghost" size="sm" onClick={togglePlayPause} className="rounded-full">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetAnimation} className="rounded-full">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Animation Container */}
      <div className="relative bg-gradient-to-br from-white/90 to-sand-100/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-sand-200">
        {/* Device Frame */}
        <div className="flex items-center justify-center">
          {currentDevice === "desktop" ? (
            <DesktopFrame currentStep={currentStep} animationKey={animationKey} />
          ) : (
            <MobileFrame currentStep={currentStep} animationKey={animationKey} />
          )}
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          {steps.map((step, index) => {
            const StepIcon = step.icon
            const isActive = step.id === currentStep
            const isCompleted = steps.findIndex((s) => s.id === currentStep) > index

            return (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col items-center gap-2 p-2 rounded-xl transition-all duration-500",
                  isActive && "bg-emerald-100 scale-110",
                  isCompleted && "bg-green-50",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500",
                    isActive && "bg-emerald-600 text-white shadow-lg",
                    isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-sand-200 text-graphite-600",
                  )}
                >
                  <StepIcon className="h-4 w-4" />
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      "text-xs font-medium transition-colors",
                      isActive && "text-emerald-800",
                      isCompleted && "text-green-700",
                      !isActive && !isCompleted && "text-graphite-600",
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-graphite-500 hidden sm:block">{step.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DesktopFrame({ currentStep, animationKey }: { currentStep: AnimationStep; animationKey: number }) {
  return (
    <div className="relative">
      {/* Monitor Frame */}
      <div className="w-[500px] h-80 bg-graphite-800 rounded-t-2xl p-4 shadow-2xl">
        <div className="w-full h-full bg-white rounded-lg overflow-hidden relative">
          {/* Browser Bar */}
          <div className="h-8 bg-sand-100 flex items-center px-3 gap-2 border-b">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-red-400 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            </div>
            <div className="flex-1 bg-white rounded px-2 py-1 text-xs text-graphite-600">
              {currentStep === "homepage" && "barnagestoria.com"}
              {currentStep === "register" && "barnagestoria.com/register"}
              {currentStep === "upload" && "barnagestoria.com/dashboard"}
              {(currentStep === "process" || currentStep === "complete") && "barnagestoria.com/dashboard"}
            </div>
          </div>

          {/* Content */}
          <div className="h-full overflow-hidden">
            <DesktopStepContent step={currentStep} animationKey={animationKey} />
          </div>

          {/* Animated Cursor */}
          <AnimatedCursor step={currentStep} animationKey={animationKey} />
        </div>
      </div>

      {/* Monitor Stand */}
      <div className="w-24 h-6 bg-graphite-700 mx-auto rounded-b-lg"></div>
      <div className="w-32 h-3 bg-graphite-600 mx-auto rounded-full"></div>
    </div>
  )
}

function AnimatedCursor({ step, animationKey }: { step: AnimationStep; animationKey: number }) {
  const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 })
  const [isClicking, setIsClicking] = useState(false)

  useEffect(() => {
    if (step === "homepage") {
      // Mover cursor al botón de registrarse
      setTimeout(() => setCursorPosition({ x: 400, y: 120 }), 1000)
      setTimeout(() => {
        setIsClicking(true)
        setTimeout(() => setIsClicking(false), 200)
      }, 2500)
    } else if (step === "register") {
      // Mover cursor por el formulario
      setTimeout(() => setCursorPosition({ x: 250, y: 150 }), 500)
      setTimeout(() => setCursorPosition({ x: 250, y: 180 }), 1000)
      setTimeout(() => setCursorPosition({ x: 250, y: 240 }), 1500)
      setTimeout(() => {
        setIsClicking(true)
        setTimeout(() => setIsClicking(false), 200)
      }, 2000)
    } else if (step === "upload") {
      // Mover cursor al área de drag & drop
      setTimeout(() => setCursorPosition({ x: 250, y: 180 }), 500)
      setTimeout(() => {
        setIsClicking(true)
        setTimeout(() => setIsClicking(false), 200)
      }, 1500)
    }
  }, [step, animationKey])

  return (
    <div
      className={cn(
        "absolute w-4 h-4 pointer-events-none transition-all duration-1000 ease-out z-50",
        isClicking && "scale-75",
      )}
      style={{
        left: `${cursorPosition.x}px`,
        top: `${cursorPosition.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-lg">
        <path
          d="M0 0L0 11L4 8L6 12L8 11L6 7L11 7L0 0Z"
          fill="white"
          stroke="black"
          strokeWidth="0.5"
          className={cn("transition-all duration-200", isClicking && "fill-emerald-500")}
        />
      </svg>
    </div>
  )
}

function MobileFrame({ currentStep, animationKey }: { currentStep: AnimationStep; animationKey: number }) {
  return (
    <div className="relative">
      {/* Phone Frame */}
      <div className="w-64 h-96 bg-graphite-800 rounded-3xl p-2 shadow-2xl">
        <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
          {/* Status Bar */}
          <div className="h-6 bg-sand-50 flex items-center justify-between px-4 text-xs">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 border border-graphite-400 rounded-sm">
                <div className="w-3 h-1 bg-green-500 rounded-sm"></div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 h-full">
            <MobileStepContent step={currentStep} animationKey={animationKey} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DesktopStepContent({ step, animationKey }: { step: AnimationStep; animationKey: number }) {
  return (
    <div key={animationKey} className="h-full">
      {step === "homepage" && (
        <div className="h-full animate-fade-in">
          {/* Header */}
          <div className="bg-white/95 border-b border-sand-300 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ResponsiveLogo size="sm" />
              <span className="font-bold text-pine-900 text-sm">Barna Gestoría</span>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 border border-emerald-700 text-emerald-800 rounded text-xs">Iniciar Sesión</div>
              <div className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs animate-pulse">
                Mi panel de empresa
              </div>
            </div>
          </div>

          {/* Hero Content */}
          <div className="p-4 bg-gradient-to-br from-sand-50 to-sand-100">
            <div className="grid grid-cols-2 gap-4 h-full">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-pine-900 leading-tight animate-fade-in">
                  Gestoría
                  <br />
                  <span className="text-emerald-800">Contable, Fiscal</span>
                  <br />
                  <span className="text-pine-800">y Laboral</span>
                </h2>
                <p className="text-sm text-graphite-700 animate-fade-in delay-500">
                  Servicios de gestoría en Barcelona para empresas y autónomos.
                </p>
              </div>

              {/* Illustration */}
              <div className="relative bg-gradient-to-br from-sand-100 to-sand-200 rounded-2xl p-4">
                <div className="absolute top-2 right-2">
                  <ResponsiveLogo size="sm" className="opacity-30" />
                </div>
                <div className="absolute top-3 left-3 w-8 h-8 bg-emerald-800/80 rounded-full"></div>
                <div className="absolute bottom-3 right-3 w-6 h-6 bg-pine-800/80 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-sand-100" />
                </div>
                <div className="absolute bottom-4 right-8">
                  <Leaf className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="absolute bottom-8 left-6 flex items-end gap-1">
                  <div className="w-1 h-4 bg-emerald-700/80 rounded-t"></div>
                  <div className="w-1 h-6 bg-emerald-600/80 rounded-t"></div>
                  <div className="w-1 h-3 bg-gold-500/80 rounded-t"></div>
                </div>
              </div>
            </div>

            {/* Features Preview */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <Upload className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                <p className="text-xs font-medium">Sube Documentos</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <FileText className="h-4 w-4 mx-auto text-gold-600 mb-1" />
                <p className="text-xs font-medium">Organizamos</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <Download className="h-4 w-4 mx-auto text-pine-600 mb-1" />
                <p className="text-xs font-medium">Contabilizamos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "register" && (
        <div className="h-full bg-gradient-to-br from-sand-50 to-sand-100 animate-fade-in">
          <div className="flex items-center justify-center h-full p-4">
            <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ResponsiveLogo size="sm" />
                  <span className="font-bold text-pine-900">Barna Gestoría</span>
                </div>
                <h3 className="font-bold text-pine-900">Crear Cuenta</h3>
                <p className="text-xs text-graphite-600">Regístrate para comenzar</p>
              </div>
              <div className="space-y-3">
                <div className="h-8 bg-sand-100 rounded animate-pulse"></div>
                <div className="h-8 bg-sand-100 rounded animate-pulse delay-200"></div>
                <div className="h-8 bg-sand-100 rounded animate-pulse delay-400"></div>
                <div className="h-8 bg-sand-100 rounded animate-pulse delay-600"></div>
                <div className="h-10 bg-emerald-600 rounded text-white flex items-center justify-center animate-bounce delay-1000">
                  <UserPlus className="h-4 w-4 mr-2" />
                  <span className="text-sm">Crear Cuenta</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div className="h-full bg-gray-50 animate-fade-in">
          {/* Dashboard Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ResponsiveLogo size="sm" />
              <span className="font-bold text-emerald-800 text-sm">Panel Cliente</span>
            </div>
            <div className="text-xs text-gray-500">Cerrar Sesión</div>
          </div>

          <div className="p-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold">3</div>
                <div className="text-xs text-gray-500">Documentos</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-emerald-600">2</div>
                <div className="text-xs text-gray-500">Procesados</div>
              </div>
              <div className="bg-white rounded-lg p-2 text-center shadow-sm">
                <div className="text-lg font-bold text-amber-600">1</div>
                <div className="text-xs text-gray-500">Pendientes</div>
              </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4 text-emerald-600" />
                Subir Documentos
              </h4>
              <div className="border-2 border-dashed border-emerald-300 rounded-lg p-6 text-center animate-pulse">
                <Upload className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                <p className="text-xs text-emerald-700">Arrastra archivos aquí</p>
              </div>
              <div className="space-y-1 mt-3">
                <div className="flex items-center gap-2 animate-slide-in delay-500">
                  <FileText className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs">factura_001.pdf</span>
                </div>
                <div className="flex items-center gap-2 animate-slide-in delay-700">
                  <FileText className="h-3 w-3 text-emerald-600" />
                  <span className="text-xs">extracto_enero.pdf</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "process" && (
        <div className="h-full bg-gray-50 animate-fade-in">
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ResponsiveLogo size="sm" />
              <span className="font-bold text-emerald-800 text-sm">Panel Cliente</span>
            </div>
          </div>

          <div className="p-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-sm mb-4">Procesando Documentos...</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Categorizando documentos</span>
                </div>
                <div className="flex items-center gap-2 animate-fade-in delay-1000">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs">Facturas organizadas</span>
                </div>
                <div className="flex items-center gap-2 animate-fade-in delay-1500">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs">Extractos procesados</span>
                </div>
                <div className="flex items-center gap-2 animate-fade-in delay-2000">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs">Contabilidad actualizada</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="h-full bg-gray-50 animate-fade-in">
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ResponsiveLogo size="sm" />
              <span className="font-bold text-emerald-800 text-sm">Panel Cliente</span>
            </div>
          </div>

          <div className="p-4">
            <div className="bg-white rounded-lg p-4 shadow-sm text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3 animate-bounce" />
              <h4 className="font-bold text-green-800 mb-2">¡Completado!</h4>
              <p className="text-sm text-green-700 mb-4">Tu contabilidad está al día</p>
              <div className="h-8 bg-green-600 rounded text-white flex items-center justify-center">
                <Download className="h-4 w-4 mr-2" />
                <span className="text-sm">Descargar Reportes</span>
              </div>
            </div>

            {/* Documents List */}
            <div className="bg-white rounded-lg p-4 shadow-sm mt-4">
              <h4 className="font-medium text-sm mb-3">Documentos Procesados</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-green-600" />
                    <span className="text-xs">factura_001.pdf</span>
                  </div>
                  <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Procesado</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3 text-green-600" />
                    <span className="text-xs">extracto_enero.pdf</span>
                  </div>
                  <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Procesado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileStepContent({ step, animationKey }: { step: AnimationStep; animationKey: number }) {
  return (
    <div key={animationKey} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <ResponsiveLogo size="sm" />
        <span className="font-bold text-emerald-800 text-sm">Barna Gestoría</span>
      </div>

      {step === "homepage" && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-emerald-800 text-lg">Gestoría Digital</h3>
          <p className="text-xs text-graphite-600">Contable, Fiscal y Laboral</p>
          <div className="space-y-2">
            <div className="h-8 bg-emerald-600 rounded text-white flex items-center justify-center animate-pulse">
              <span className="text-sm">Registrarse</span>
            </div>
            <div className="h-8 border border-emerald-600 rounded text-emerald-700 flex items-center justify-center">
              <span className="text-sm">Iniciar Sesión</span>
            </div>
          </div>
        </div>
      )}

      {step === "register" && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-emerald-800 text-sm">Crear Cuenta</h3>
          <div className="space-y-2">
            <div className="h-8 bg-sand-100 rounded animate-pulse"></div>
            <div className="h-8 bg-sand-100 rounded animate-pulse delay-200"></div>
            <div className="h-8 bg-sand-100 rounded animate-pulse delay-400"></div>
          </div>
          <div className="h-10 bg-emerald-600 rounded text-white flex items-center justify-center animate-bounce delay-1000">
            <UserPlus className="h-4 w-4 mr-2" />
            <span className="text-sm">Registrarse</span>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-emerald-800 text-sm">Subir Documentos</h3>
          <div className="border-2 border-dashed border-emerald-300 rounded-lg p-6 text-center animate-pulse">
            <Upload className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
            <p className="text-xs text-emerald-700">Toca para subir</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 animate-slide-in delay-500">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span className="text-xs">factura_001.pdf</span>
            </div>
            <div className="flex items-center gap-2 animate-slide-in delay-700">
              <FileText className="h-4 w-4 text-emerald-600" />
              <span className="text-xs">extracto_enero.pdf</span>
            </div>
          </div>
        </div>
      )}

      {step === "process" && (
        <div className="space-y-3 animate-fade-in">
          <h3 className="font-bold text-emerald-800 text-sm">Procesando...</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Categorizando documentos</span>
            </div>
            <div className="flex items-center gap-2 animate-fade-in delay-1000">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs">Facturas organizadas</span>
            </div>
            <div className="flex items-center gap-2 animate-fade-in delay-1500">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs">Extractos procesados</span>
            </div>
          </div>
        </div>
      )}

      {step === "complete" && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="font-bold text-green-800 text-sm">¡Completado!</h3>
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3 animate-bounce" />
            <p className="text-sm text-green-700">Tu contabilidad está al día</p>
          </div>
          <div className="h-10 bg-green-600 rounded text-white flex items-center justify-center">
            <Download className="h-4 w-4 mr-2" />
            <span className="text-sm">Ver Reportes</span>
          </div>
        </div>
      )}
    </div>
  )
}
