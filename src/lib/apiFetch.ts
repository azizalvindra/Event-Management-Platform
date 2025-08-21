// src/lib/apiFetch.ts
import { supabase } from './supabaseClient'

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  json?: unknown
  formData?: FormData
  requireAuth?: boolean
}

// Bentuk error yang akan dilempar
export interface ApiError extends Error {
  status: number
  details?: unknown
}

interface ErrorResponse {
  error?: string
  message?: string
  details?: unknown
  [key: string]: unknown
}

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  opts: ApiFetchOptions = {}
): Promise<T> {
  const { json, formData, requireAuth = true, ...rest } = opts

  const existingHeaders = (rest.headers as HeadersInit) ?? {}
  const headers = new Headers(existingHeaders)

  if (requireAuth) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (token) headers.set('Authorization', `Bearer ${token}`)
    } catch (e) {
      console.warn('apiFetch: failed to read session', e)
    }
  }

  let body: BodyInit | undefined = undefined

  if (formData) {
    body = formData
  } else if (typeof json !== 'undefined') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  }

  const res = await fetch(input, {
    ...rest,
    headers,
    body,
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const parsed = (data ?? {}) as ErrorResponse
    const err: ApiError = Object.assign(new Error(), {
      name: 'ApiError',
      message: parsed.error || parsed.message || `Request failed with status ${res.status}`,
      status: res.status,
      details: parsed.details ?? data,
    })
    throw err
  }

  return data as T
}
