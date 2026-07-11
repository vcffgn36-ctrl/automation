import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ProfileInput, TaskInput, Profile, Task, TaskType, LoginMode } from '@/lib/automation-types'
import { TASK_TYPES, TASK_TYPE_NEEDS_SELECTOR, TASK_TYPE_NEEDS_VALUE } from '@/lib/automation-types'

function validateProfileInput(body: unknown): { ok: true; data: ProfileInput } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'body must be an object' }
  const b = body as Record<string, unknown>
  const required: string[] = [
    'name', 'siteUrl', 'loginUrl',
    'usernameSelector', 'passwordSelector', 'submitSelector',
    'username', 'password',
  ]
  for (const k of required) {
    if (typeof b[k] !== 'string' || (b[k] as string).trim() === '') {
      return { ok: false, error: `field "${k}" is required` }
    }
  }
  if (!Array.isArray(b.tasks)) return { ok: false, error: 'tasks must be an array' }
  for (let i = 0; i < b.tasks.length; i++) {
    const t = b.tasks[i] as TaskInput
    if (!t || typeof t !== 'object') return { ok: false, error: `tasks[${i}] must be an object` }
    if (!TASK_TYPES.includes(t.type as TaskType)) return { ok: false, error: `tasks[${i}].type is invalid: ${t.type}` }
    if (TASK_TYPE_NEEDS_SELECTOR[t.type as TaskType] && !t.selector) {
      return { ok: false, error: `tasks[${i}] (${t.type}) requires a selector` }
    }
    if (TASK_TYPE_NEEDS_VALUE[t.type as TaskType] && !t.value) {
      return { ok: false, error: `tasks[${i}] (${t.type}) requires a value` }
    }
  }
  const data: ProfileInput = {
    name: String(b.name),
    siteUrl: String(b.siteUrl),
    loginUrl: String(b.loginUrl),
    usernameSelector: String(b.usernameSelector),
    passwordSelector: String(b.passwordSelector),
    submitSelector: String(b.submitSelector),
    username: String(b.username),
    password: String(b.password),
    headless: b.headless !== false,
    viewportWidth: Number(b.viewportWidth) || 1280,
    viewportHeight: Number(b.viewportHeight) || 800,
    userAgent: typeof b.userAgent === 'string' && b.userAgent ? b.userAgent : null,
    locale: typeof b.locale === 'string' && b.locale ? b.locale : null,
    loginMode: (b.loginMode === 'multistep' ? 'multistep' : 'single') as LoginMode,
    useProxy: b.useProxy === true,
    proxyServer: typeof b.proxyServer === 'string' && b.proxyServer ? b.proxyServer : null,
    proxyUsername: typeof b.proxyUsername === 'string' && b.proxyUsername ? b.proxyUsername : null,
    proxyPassword: typeof b.proxyPassword === 'string' && b.proxyPassword ? b.proxyPassword : null,
    tasks: (b.tasks as TaskInput[]).map((t) => ({
      type: t.type as TaskType,
      selector: t.selector || null,
      value: t.value || null,
      description: t.description || null,
      waitMs: Number(t.waitMs) || 0,
      timeoutMs: Number(t.timeoutMs) || 30000,
    })),
  }
  return { ok: true, data }
}

function serializeProfile(p: {
  id: string
  name: string
  siteUrl: string
  loginUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  loginMode: string
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
  sessionUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  tasks: Array<{
    id: string
    profileId: string
    order: number
    type: string
    selector: string | null
    value: string | null
    description: string | null
    waitMs: number
    timeoutMs: number
    createdAt: Date
  }>
}): Profile {
  return {
    id: p.id,
    name: p.name,
    siteUrl: p.siteUrl,
    loginUrl: p.loginUrl,
    usernameSelector: p.usernameSelector,
    passwordSelector: p.passwordSelector,
    submitSelector: p.submitSelector,
    loginMode: (p.loginMode === 'multistep' ? 'multistep' : 'single') as LoginMode,
    username: p.username,
    password: p.password,
    headless: p.headless,
    viewportWidth: p.viewportWidth,
    viewportHeight: p.viewportHeight,
    userAgent: p.userAgent,
    locale: p.locale,
    useProxy: p.useProxy,
    proxyServer: p.proxyServer,
    proxyUsername: p.proxyUsername,
    proxyPassword: p.proxyPassword,
    sessionState: p.sessionState,
    sessionUpdatedAt: p.sessionUpdatedAt ? p.sessionUpdatedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    tasks: p.tasks.map((t): Task => ({
      id: t.id,
      profileId: t.profileId,
      order: t.order,
      type: t.type as TaskType,
      selector: t.selector,
      value: t.value,
      description: t.description,
      waitMs: t.waitMs,
      timeoutMs: t.timeoutMs,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const profile = await db.profile.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: 'asc' } } },
    })
    if (!profile) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ profile: serializeProfile(profile) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
    }
    const v = validateProfileInput(body)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const data = v.data

    // Replace tasks atomically: delete existing then create new ones.
    const updated = await db.$transaction(async (tx) => {
      await tx.task.deleteMany({ where: { profileId: id } })
      return tx.profile.update({
        where: { id },
        data: {
          name: data.name,
          siteUrl: data.siteUrl,
          loginUrl: data.loginUrl,
          usernameSelector: data.usernameSelector,
          passwordSelector: data.passwordSelector,
          submitSelector: data.submitSelector,
          loginMode: data.loginMode,
          username: data.username,
          password: data.password,
          headless: data.headless,
          viewportWidth: data.viewportWidth,
          viewportHeight: data.viewportHeight,
          userAgent: data.userAgent,
          locale: data.locale,
          useProxy: data.useProxy,
          proxyServer: data.proxyServer,
          proxyUsername: data.proxyUsername,
          proxyPassword: data.proxyPassword,
          tasks: {
            create: data.tasks.map((t, i) => ({
              order: i,
              type: t.type,
              selector: t.selector,
              value: t.value,
              description: t.description,
              waitMs: t.waitMs,
              timeoutMs: t.timeoutMs,
            })),
          },
        },
        include: { tasks: { orderBy: { order: 'asc' } } },
      })
    })

    return NextResponse.json({ profile: serializeProfile(updated) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    await db.profile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
