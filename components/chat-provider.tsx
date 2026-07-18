"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { ChatWidget } from "./chat-widget"

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const pathname = usePathname()
  const { session, isLoading } = useAuth()
  const showChat = pathname === "/" && !isLoading && !session

  return (
    <>
      {children}
      {showChat && <ChatWidget />}
    </>
  )
}
