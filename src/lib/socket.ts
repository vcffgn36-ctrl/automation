/**
 * Singleton socket.io client for live automation run events.
 *
 * Per the system convention, the connection URL is "/?XTransformPort=3003"
 * (relative URL with the XTransformPort query param so Caddy routes it to
 * the automation mini-service on port 3003). The socket.io internal `path`
 * option is set to "/socket.io" to match the server (see
 * mini-services/automation-service/index.ts for why we don't use path "/").
 */

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getAutomationSocket(): Socket {
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    })
  }
  return socket
}

export interface LogEvent {
  runId: string
  ts: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface ScreenshotEvent {
  runId: string
  order: number
  dataUrl: string
}

export interface ExtractEvent {
  runId: string
  order: number
  text: string
}

export interface StatusEvent {
  runId: string
  status: 'running' | 'success' | 'failed'
  error?: string
}
