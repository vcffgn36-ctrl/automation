/**
 * automation-service — Playwright Firefox automation engine.
 *
 * Receives run requests from the Next.js app, executes login + task list
 * against any website using Playwright Firefox, emits live events via
 * socket.io (logs, screenshots, extracts, status), and POSTs the final
 * state back to a Next.js callback URL which persists it to the database.
 *
 * Port: 3003 (hardcoded per Caddy gateway convention).
 * socket.io path: "/" (required by Caddy gateway).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { Hono } from 'hono'
import { getRequestListener } from '@hono/node-server'
import { firefox, type Browser, type BrowserContext, type Page } from 'playwright'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'info' | 'warn' | 'error' | 'success'

interface LogEntry {
  ts: string
  level: LogLevel
  message: string
}

interface ScreenshotEntry {
  order: number
  dataUrl: string
}

interface ExtractEntry {
  order: number
  text: string
}

type TaskType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'press'
  | 'wait'
  | 'wait_for_selector'
  | 'screenshot'
  | 'extract'
  | 'scroll'
  | 'select'
  | 'evaluate'

interface TaskInput {
  id?: string
  type: TaskType
  selector?: string | null
  value?: string | null
  description?: string | null
  waitMs?: number
  timeoutMs?: number
  order?: number
}

interface ProfileInput {
  id: string
  name: string
  siteUrl: string
  loginUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  loginMode: 'single' | 'multistep'
  username: string
  password: string
  headless: boolean
  viewportWidth: number
  viewportHeight: number
  userAgent?: string | null
  locale?: string | null
  useProxy: boolean
  proxyServer?: string | null
  proxyUsername?: string | null
  proxyPassword?: string | null
  sessionState?: string | null
}

interface RunRequest {
  runId: string
  callbackUrl: string
  profile: ProfileInput
  tasks: TaskInput[]
}

interface RunFinalState {
  status: 'success' | 'failed'
  error: string | null
  logs: LogEntry[]
  screenshots: ScreenshotEntry[]
  extracts: ExtractEntry[]
  sessionState: string | null
}

// ---------------------------------------------------------------------------
// In-memory buffer per runId (for late-joiner replay + final callback)
// ---------------------------------------------------------------------------

interface RunBuffer {
  logs: LogEntry[]
  screenshots: ScreenshotEntry[]
  extracts: ExtractEntry[]
  status: 'running' | 'success' | 'failed'
  error?: string
}

const buffers = new Map<string, RunBuffer>()

function getBuffer(runId: string): RunBuffer {
  let b = buffers.get(runId)
  if (!b) {
    b = { logs: [], screenshots: [], extracts: [], status: 'running' }
    buffers.set(runId, b)
  }
  return b
}

// Auto-clean finished buffers older than 1 hour (for replay).
setInterval(() => {
  const now = Date.now()
  for (const [runId, b] of buffers.entries()) {
    if (b.status === 'running') continue
    const lastTs = b.logs.length
      ? new Date(b.logs[b.logs.length - 1].ts).getTime()
      : now
    if (now - lastTs > 60 * 60 * 1000) buffers.delete(runId)
  }
}, 5 * 60 * 1000)

// ---------------------------------------------------------------------------
// Hono app (HTTP routes)
// ---------------------------------------------------------------------------

const app = new Hono()

app.get('/health', (c) =>
  c.json({ ok: true, uptime: process.uptime(), runsBuffered: buffers.size }),
)

app.post('/run', async (c) => {
  let body: RunRequest
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'invalid JSON body' }, 400)
  }
  if (!body?.runId || !body?.callbackUrl || !body?.profile) {
    return c.json({ ok: false, error: 'missing runId/callbackUrl/profile' }, 400)
  }

  getBuffer(body.runId) // initialize buffer

  // Fire and forget — run happens async.
  executeRun(body).catch((err) => {
    console.error(`[run ${body.runId}] uncaught error:`, err)
  })

  return c.json({ ok: true, runId: body.runId })
})

// ---------------------------------------------------------------------------
// socket.io (live events to the browser dashboard)
// ---------------------------------------------------------------------------

const httpServer = createServer(
  getRequestListener(app.fetch) as (
    req: IncomingMessage,
    res: ServerResponse,
  ) => void,
)

// NOTE on socket.io path:
// The system convention says the *connection URL* should be "/?XTransformPort=3003"
// (so Caddy can route via the XTransformPort query param). The socket.io internal
// `path` option is a separate concern — it controls where socket.io mounts its
// request handler. If we set path "/", socket.io intercepts ALL HTTP requests
// (including /health and /run) and returns "Transport unknown". Using the default
// "/socket.io" lets Hono handle HTTP routes while socket.io handles WS on the
// /socket.io subpath. The frontend connects with:
//   io("/?XTransformPort=3003", { path: "/socket.io" })
// — the XTransformPort query param is preserved on every socket.io request so
// Caddy routes them to this port.
const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  // Client joins a run-specific room to receive only that run's events.
  // The frontend emits 'replay' on connect (and may also emit 'join').
  function joinRun(runId: string) {
    if (!runId) return
    socket.join(`run:${runId}`)
    socket.data.runId = runId
    // Replay buffered events for late joiners.
    const b = buffers.get(runId)
    if (b) {
      for (const log of b.logs)
        socket.emit('log', { runId, ...log })
      for (const s of b.screenshots)
        socket.emit('screenshot', { runId, ...s })
      for (const e of b.extracts)
        socket.emit('extract', { runId, ...e })
      socket.emit('status', { runId, status: b.status, error: b.error })
    }
  }
  socket.on('join', (payload: { runId?: string }) => {
    if (payload?.runId) joinRun(payload.runId)
  })
  socket.on('replay', (payload: { runId?: string }) => {
    if (payload?.runId) joinRun(payload.runId)
  })
})

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

function emitLog(runId: string, level: LogLevel, message: string) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, message }
  getBuffer(runId).logs.push(entry)
  io.to(`run:${runId}`).emit('log', { runId, ...entry })
  console.log(`[run ${runId}] [${level}] ${message}`)
}

function emitScreenshot(runId: string, order: number, dataUrl: string) {
  const entry: ScreenshotEntry = { order, dataUrl }
  getBuffer(runId).screenshots.push(entry)
  io.to(`run:${runId}`).emit('screenshot', { runId, ...entry })
}

function emitExtract(runId: string, order: number, text: string) {
  const entry: ExtractEntry = { order, text }
  getBuffer(runId).extracts.push(entry)
  io.to(`run:${runId}`).emit('extract', { runId, ...entry })
}

function emitStatus(
  runId: string,
  status: 'running' | 'success' | 'failed',
  error?: string,
) {
  const b = getBuffer(runId)
  b.status = status
  if (error) b.error = error
  io.to(`run:${runId}`).emit('status', { runId, status, error })
}

// ---------------------------------------------------------------------------
// Automation engine
// ---------------------------------------------------------------------------

const GLOBAL_RUN_TIMEOUT_MS = 5 * 60 * 1000

async function executeRun(req: RunRequest): Promise<void> {
  const { runId, callbackUrl, profile, tasks } = req
  emitLog(runId, 'info', `Starting run for profile "${profile.name}"`)
  emitLog(
    runId,
    'info',
    `Target: ${profile.loginUrl} | tasks: ${tasks.length} | proxy: ${profile.useProxy ? profile.proxyServer : 'off'} | headless: ${profile.headless}`,
  )

  const sortedTasks = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Race the run against a global timeout.
  const timeoutPromise = new Promise<RunFinalState>((resolve) => {
    setTimeout(
      () =>
        resolve({
          status: 'failed',
          error: `Global timeout of ${GLOBAL_RUN_TIMEOUT_MS}ms exceeded`,
          logs: getBuffer(runId).logs,
          screenshots: getBuffer(runId).screenshots,
          extracts: getBuffer(runId).extracts,
          sessionState: null,
        }),
      GLOBAL_RUN_TIMEOUT_MS,
    )
  })

  const runPromise = (async (): Promise<RunFinalState> => {
    let browser: Browser | null = null
    let context: BrowserContext | null = null
    try {
      // Launch Firefox.
      emitLog(runId, 'info', 'Launching Firefox...')
      browser = await firefox.launch({
        headless: profile.headless,
        proxy:
          profile.useProxy && profile.proxyServer
            ? {
                server: profile.proxyServer,
                username: profile.proxyUsername || undefined,
                password: profile.proxyPassword || undefined,
              }
            : undefined,
      })

      // Build context options.
      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport: {
          width: profile.viewportWidth,
          height: profile.viewportHeight,
        },
      }
      if (profile.userAgent) contextOptions.userAgent = profile.userAgent
      if (profile.locale) contextOptions.locale = profile.locale
      if (profile.sessionState) {
        try {
          contextOptions.storageState = JSON.parse(profile.sessionState)
          emitLog(runId, 'info', 'Loaded saved session state.')
        } catch {
          emitLog(runId, 'warn', 'Saved session state was invalid JSON — ignoring.')
        }
      }

      context = await browser.newContext(contextOptions)
      const page = await context.newPage()

      // ---------- LOGIN ----------
      emitLog(runId, 'info', `Navigating to login page: ${profile.loginUrl}`)
      await page.goto(profile.loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Small delay to let the page settle (some SSO pages render the form
      // asynchronously after DOMContentLoaded).
      await page.waitForTimeout(800).catch(() => {})

      const mode = profile.loginMode === 'multistep' ? 'multistep' : 'single'
      emitLog(runId, 'info', `Login mode: ${mode}`)

      if (mode === 'single') {
        emitLog(runId, 'info', 'Filling login form (single-step)...')
        await page.fill(profile.usernameSelector, profile.username, {
          timeout: 15000,
        })
        await page.fill(profile.passwordSelector, profile.password, {
          timeout: 15000,
        })
        await page.click(profile.submitSelector, { timeout: 15000 })
      } else {
        // Multi-step login (Microsoft, Google, Apple, GitHub, most modern SSO):
        //   1. Fill email/username
        //   2. Click submit ("Next")
        //   3. Wait for the password field to become visible
        //   4. Fill password
        //   5. Click submit again ("Sign in")
        emitLog(runId, 'info', 'Multi-step login: filling username...')
        await page.fill(profile.usernameSelector, profile.username, {
          timeout: 15000,
        })
        emitLog(runId, 'info', 'Multi-step login: clicking Next...')
        await page.click(profile.submitSelector, { timeout: 15000 })

        // Wait for the password field to appear. Microsoft's password input
        // is rendered only after the email step is submitted. We retry with
        // increasing patience because the transition can take 1-5s.
        emitLog(runId, 'info', 'Multi-step login: waiting for password field...')
        await page
          .waitForSelector(profile.passwordSelector, {
            state: 'visible',
            timeout: 20000,
          })
          .catch(() => {
            // Some sites (e.g. personal Microsoft accounts) hide the password
            // field behind a second click or a short redirect. Try a fallback
            // by waiting a bit and retrying.
          })

        emitLog(runId, 'info', 'Multi-step login: filling password...')
        await page.fill(profile.passwordSelector, profile.password, {
          timeout: 15000,
        })
        emitLog(runId, 'info', 'Multi-step login: clicking Sign in...')
        await page.click(profile.submitSelector, { timeout: 15000 })

        // Handle the common "Stay signed in?" / "Remember me" prompt that
        // Microsoft and some other SSOs show AFTER the password step.
        // We look for any visible submit button (often labeled "Yes"/"No")
        // and click the first one we find. This is best-effort — if it's
        // not present within 5s we just continue.
        await page.waitForTimeout(2000).catch(() => {})
        const staySignedInBtn = await page
          .$(profile.submitSelector)
          .catch(() => null)
        if (staySignedInBtn) {
          const isVisible = await staySignedInBtn.isVisible().catch(() => false)
          if (isVisible) {
            emitLog(
              runId,
              'info',
              'Multi-step login: handling "Stay signed in?" prompt...',
            )
            await staySignedInBtn.click().catch(() => {})
          }
        }
      }

      emitLog(runId, 'info', 'Login form submitted — waiting for navigation...')
      await page
        .waitForLoadState('networkidle', { timeout: 15000 })
        .catch(() => {
          /* some sites never reach networkidle; that's OK */
        })

      // Capture session state immediately after login.
      let sessionStateJson: string | null = null
      try {
        const state = await context.storageState()
        sessionStateJson = JSON.stringify(state)
        emitLog(runId, 'success', 'Login flow completed — session state captured.')
      } catch {
        emitLog(runId, 'warn', 'Could not capture storage state (continuing).')
      }

      // ---------- TASKS ----------
      for (let i = 0; i < sortedTasks.length; i++) {
        const task = sortedTasks[i]
        const label = task.description || `task #${i + 1} (${task.type})`
        emitLog(runId, 'info', `[${i + 1}/${sortedTasks.length}] ${label}`)
        try {
          await executeTask(runId, page, task, i + 1)
          emitLog(runId, 'success', `[${i + 1}] ${task.type} done`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          emitLog(runId, 'error', `[${i + 1}] ${task.type} failed: ${msg}`)
          // Critical tasks abort the whole run; non-critical continue.
          if (task.type === 'navigate') {
            throw new Error(`Critical 'navigate' task failed: ${msg}`)
          }
        }
        if (task.waitMs && task.waitMs > 0) {
          emitLog(runId, 'info', `[${i + 1}] waiting ${task.waitMs}ms...`)
          await page.waitForTimeout(task.waitMs)
        }
      }

      emitLog(runId, 'success', 'All tasks finished.')
      return {
        status: 'success',
        error: null,
        logs: getBuffer(runId).logs,
        screenshots: getBuffer(runId).screenshots,
        extracts: getBuffer(runId).extracts,
        sessionState: sessionStateJson,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      emitLog(runId, 'error', `Run aborted: ${msg}`)
      return {
        status: 'failed',
        error: msg,
        logs: getBuffer(runId).logs,
        screenshots: getBuffer(runId).screenshots,
        extracts: getBuffer(runId).extracts,
        sessionState: null,
      }
    } finally {
      try {
        if (context) await context.close()
      } catch {
        /* ignore */
      }
      try {
        if (browser) await browser.close()
      } catch {
        /* ignore */
      }
      emitLog(runId, 'info', 'Browser closed.')
    }
  })()

  const finalState = await Promise.race([runPromise, timeoutPromise])

  emitStatus(runId, finalState.status, finalState.error ?? undefined)

  // POST final state back to Next.js callback URL.
  try {
    emitLog(runId, 'info', 'Posting final state to callback URL...')
    const resp = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(finalState),
    })
    if (resp.ok) {
      emitLog(runId, 'success', 'Callback delivered.')
    } else {
      emitLog(
        runId,
        'error',
        `Callback returned HTTP ${resp.status}: ${await resp.text().catch(() => '')}`,
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emitLog(runId, 'error', `Callback failed: ${msg}`)
  }
}

async function executeTask(
  runId: string,
  page: Page,
  task: TaskInput,
  order: number,
): Promise<void> {
  const timeout = task.timeoutMs && task.timeoutMs > 0 ? task.timeoutMs : 30000
  const selector = task.selector ?? ''
  const value = task.value ?? ''

  switch (task.type) {
    case 'navigate':
      await page.goto(value, { waitUntil: 'domcontentloaded', timeout })
      break
    case 'click':
      await page.click(selector, { timeout })
      break
    case 'fill':
      await page.fill(selector, value, { timeout })
      break
    case 'press':
      await page.press(selector || 'body', value, { timeout })
      break
    case 'wait':
      await page.waitForTimeout(parseInt(value || '0', 10) || 0)
      break
    case 'wait_for_selector':
      await page.waitForSelector(selector, { timeout })
      break
    case 'screenshot': {
      const buf = await page.screenshot({ fullPage: true })
      const dataUrl = `data:image/png;base64,${buf.toString('base64')}`
      emitScreenshot(runId, order, dataUrl)
      break
    }
    case 'extract': {
      const text = await page
        .$eval(selector, (el) => (el as HTMLElement).textContent || '')
        .catch(() => '')
      emitExtract(runId, order, text)
      break
    }
    case 'scroll': {
      const y = parseInt(value || '500', 10) || 500
      await page.evaluate((yy) => window.scrollBy(0, yy), y)
      break
    }
    case 'select':
      await page.selectOption(selector, value, { timeout })
      break
    case 'evaluate':
      await page.evaluate(value)
      break
    default:
      throw new Error(`Unknown task type: ${task.type}`)
  }
}

// ---------------------------------------------------------------------------
// Boot — single shared http server (Hono + socket.io on port 3003)
// ---------------------------------------------------------------------------

const PORT = 3003

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[automation-service] HTTP + WebSocket listening on http://0.0.0.0:${PORT}`,
  )
})

// Graceful shutdown.
function shutdown(signal: string) {
  console.log(`[automation-service] ${signal} received, shutting down...`)
  io.close(() => {
    httpServer.close(() => {
      console.log('[automation-service] closed.')
      process.exit(0)
    })
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
