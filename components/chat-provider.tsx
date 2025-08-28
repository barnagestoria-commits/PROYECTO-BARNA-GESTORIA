"use client"

import type React from "react"

import { ChatWidget } from "./chat-widget"

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  )
}
