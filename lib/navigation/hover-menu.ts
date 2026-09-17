import { useCallback, useEffect, useReducer, useRef } from "react"

export const HOVER_MENU_OPEN_DELAY_MS = 60
export const HOVER_MENU_CLOSE_DELAY_MS = 240
export const MORE_MENU_ID = "__more__"

/** Une el botón del menú con el panel para que el cursor no “caiga” en un hueco. */
export const HOVER_MENU_PANEL_CLASS = "absolute left-0 top-full z-50 pt-2"

export type HoverMenuAction =
  | { type: "open"; id: string }
  | { type: "toggle"; id: string }
  | { type: "close"; id: string }
  | { type: "close-all" }

export function hoverMenuReducer(
  currentId: string | null,
  action: HoverMenuAction,
): string | null {
  switch (action.type) {
    case "open":
      return action.id
    case "toggle":
      return currentId === action.id ? null : action.id
    case "close":
      return currentId === action.id ? null : currentId
    case "close-all":
      return null
    default:
      return currentId
  }
}

export function useHoverMenu() {
  const [openId, dispatch] = useReducer(hoverMenuReducer, null)
  const openIdRef = useRef(openId)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  openIdRef.current = openId

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const open = useCallback(
    (id: string) => {
      clearTimer()
      dispatch({ type: "open", id })
    },
    [clearTimer],
  )

  const scheduleOpen = useCallback(
    (id: string) => {
      clearTimer()
      if (openIdRef.current) {
        dispatch({ type: "open", id })
        return
      }
      timerRef.current = setTimeout(() => {
        dispatch({ type: "open", id })
      }, HOVER_MENU_OPEN_DELAY_MS)
    },
    [clearTimer],
  )

  const scheduleClose = useCallback(() => {
    clearTimer()
    timerRef.current = setTimeout(() => {
      dispatch({ type: "close-all" })
    }, HOVER_MENU_CLOSE_DELAY_MS)
  }, [clearTimer])

  const toggle = useCallback(
    (id: string) => {
      clearTimer()
      dispatch({ type: "toggle", id })
    },
    [clearTimer],
  )

  const close = useCallback(() => {
    clearTimer()
    dispatch({ type: "close-all" })
  }, [clearTimer])

  useEffect(() => () => clearTimer(), [clearTimer])

  return { openId, open, scheduleOpen, scheduleClose, cancelClose: clearTimer, toggle, close }
}


