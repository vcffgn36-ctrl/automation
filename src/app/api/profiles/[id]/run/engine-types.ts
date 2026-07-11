/**
 * Local-only types for the engine payload sent to the mini-service.
 * (Kept here so the API route doesn't need to import from the mini-service.)
 */

export interface EngineProfile {
  id: string
  name: string
  siteUrl: string
  loginUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  username: string
  password: string
  headless: boolean
  viewportWidth: number
  viewportHeight: number
  userAgent: string | null
  locale: string | null
  useProxy: boolean
  proxyServer: string | null
  proxyUsername: string | null
  proxyPassword: string | null
  sessionState: string | null
}

export interface EngineTask {
  id: string
  order: number
  type: string
  selector: string | null
  value: string | null
  description: string | null
  waitMs: number
  timeoutMs: number
}
