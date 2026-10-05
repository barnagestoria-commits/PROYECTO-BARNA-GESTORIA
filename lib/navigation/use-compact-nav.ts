"use client"

import { useLayoutEffect, useState } from "react"

/**
 * Solo el escritorio con ratón/trackpad usa la barra con desplegables hover.
 * Teléfono vertical, teléfono girado y tablet táctil se quedan en modo compacto.
 */
export const DESKTOP_NAV_MEDIA_QUERY =
  "(hover: hover) and (pointer: fine) and (min-width: 768px) and (min-height: 520px)"

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useLayoutEffect(() => {
    const media = window.matchMedia(query)
    const apply = () => setMatches(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [query])

  return matches
}

export function useIsCompactNav() {
  return !useMediaQuery(DESKTOP_NAV_MEDIA_QUERY)
}
