"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import type { EventData, Step } from "react-joyride"
import { STATUS } from "react-joyride"
import {
  markOnboardingCompleted,
  ONBOARDING_START_EVENT,
  ONBOARDING_STORAGE_KEY,
} from "@/lib/onboarding"

const Joyride = dynamic(() => import("react-joyride").then((mod) => mod.Joyride), { ssr: false })

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="a3-toolbar"]',
    title: "Barra de herramientas A3",
    content:
      "Desde aquí accedes a listados contables, modelos fiscales, certificados, inmovilizado y utilidades. Es tu menú principal de consulta.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="pagar-devolver"]',
    title: "Saldo A pagar / devolver",
    content:
      "Este panel resume el trimestre en curso combinando IVA (cuentas 472/477) y retenciones. Se actualiza automáticamente con cada asiento.",
    placement: "bottom",
  },
  {
    target: '[data-tour="scan-invoice"]',
    title: "Escanear facturas",
    content:
      "Sube archivos o usa la cámara para fotografiar facturas recibidas. La IA extraerá proveedor, CIF e importes para validarlos.",
    placement: "top",
  },
]

const joyrideLocale = {
  back: "Atrás",
  close: "Cerrar",
  last: "¡Empezar!",
  next: "Siguiente",
  skip: "Omitir tour",
  nextWithProgress: "Siguiente ({current} de {total})",
}

interface DashboardOnboardingTourProps {
  enabled: boolean
}

export function DashboardOnboardingTour({ enabled }: DashboardOnboardingTourProps) {
  const [run, setRun] = useState(false)

  const beginTour = useCallback(() => {
    setRun(true)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!completed) {
      const timer = window.setTimeout(beginTour, 900)
      return () => window.clearTimeout(timer)
    }
  }, [enabled, beginTour])

  useEffect(() => {
    if (!enabled) return

    function handleStart() {
      beginTour()
    }

    window.addEventListener(ONBOARDING_START_EVENT, handleStart)
    return () => window.removeEventListener(ONBOARDING_START_EVENT, handleStart)
  }, [enabled, beginTour])

  const handleEvent = useCallback((data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      markOnboardingCompleted()
      setRun(false)
    }
  }, [])

  if (!enabled || !run) return null

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={joyrideLocale}
      options={{
        showProgress: true,
        skipBeacon: true,
        primaryColor: "#145A32",
        textColor: "#2C2C2C",
        arrowColor: "#ffffff",
        zIndex: 10000,
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: { borderRadius: 12, padding: 4 },
        tooltipTitle: { fontSize: "1rem", fontWeight: 700, color: "#0F3D2E" },
        buttonPrimary: { backgroundColor: "#145A32", borderRadius: 8, fontSize: "0.875rem" },
        buttonBack: { color: "#145A32", fontSize: "0.875rem" },
        buttonSkip: { color: "#6b7280", fontSize: "0.8rem" },
      }}
    />
  )
}
