import type { AuthSession } from "@/lib/types/auth"

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? "Error en la solicitud.")
  }

  return data as T
}

export async function apiFormFetch<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? "Error en la solicitud.")
  }

  return data as T
}

export type SessionResponse = { success: true; session: AuthSession }
