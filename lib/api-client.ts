import type { AuthSession } from "@/lib/types/auth"

export class ApiRequestError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "ApiRequestError"
    this.code = code
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? ""
  const raw = await response.text()

  if (!raw) {
    if (!response.ok) {
      throw new Error(`Error del servidor (${response.status}).`)
    }
    return {} as T
  }

  if (contentType.includes("application/json") || raw.trimStart().startsWith("{")) {
    try {
      return JSON.parse(raw) as T
    } catch {
      throw new Error(
        response.ok
          ? "La respuesta del servidor no es JSON válido."
          : `Error del servidor (${response.status}): ${raw.slice(0, 180)}`,
      )
    }
  }

  if (!response.ok) {
    const snippet = raw.replace(/\s+/g, " ").trim().slice(0, 180)
    if (response.status === 413) {
      throw new Error("El archivo ZIP es demasiado grande para subirlo. Prueba con un export más pequeño.")
    }
    if (response.status === 504 || snippet.includes("FUNCTION_INVOCATION_TIMEOUT")) {
      throw new Error(
        "La operación tardó demasiado y el servidor la interrumpió. Vuelve a intentarlo; si el fichero es muy grande, divídelo por ejercicios.",
      )
    }
    throw new Error(snippet || `Error del servidor (${response.status}).`)
  }

  throw new Error("Respuesta inesperada del servidor.")
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })

  const data = await parseApiResponse<{ error?: string; success?: boolean; code?: string } & T>(response)

  if (!response.ok) {
    throw new ApiRequestError(data.error ?? "Error en la solicitud.", data.code)
  }

  return data as T
}

export async function apiFormFetch<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  })

  const data = await parseApiResponse<{ error?: string; success?: boolean; code?: string } & T>(response)

  if (!response.ok) {
    throw new ApiRequestError(data.error ?? "Error en la solicitud.", data.code)
  }

  return data as T
}

export type SessionResponse = { success: true; session: AuthSession }
