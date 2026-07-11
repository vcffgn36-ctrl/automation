import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const AUTOMATION_SERVICE_URL = 'http://localhost:3003/run'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const profile = await db.profile.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: 'asc' } } },
    })
    if (!profile) {
      return NextResponse.json({ error: 'profile not found' }, { status: 404 })
    }

    // Create a pending Run row.
    const run = await db.run.create({
      data: { profileId: id, status: 'pending' },
    })

    // Build the payload for the automation mini-service.
    const callbackUrl = `http://localhost:3000/api/runs/${run.id}/complete`
    const payload = {
      runId: run.id,
      callbackUrl,
      profile: {
        id: profile.id,
        name: profile.name,
        siteUrl: profile.siteUrl,
        loginUrl: profile.loginUrl,
        usernameSelector: profile.usernameSelector,
        passwordSelector: profile.passwordSelector,
        submitSelector: profile.submitSelector,
        username: profile.username,
        password: profile.password,
        headless: profile.headless,
        viewportWidth: profile.viewportWidth,
        viewportHeight: profile.viewportHeight,
        userAgent: profile.userAgent,
        locale: profile.locale,
        useProxy: profile.useProxy,
        proxyServer: profile.proxyServer,
        proxyUsername: profile.proxyUsername,
        proxyPassword: profile.proxyPassword,
        sessionState: profile.sessionState,
      },
      tasks: profile.tasks.map((t) => ({
        id: t.id,
        type: t.type,
        selector: t.selector,
        value: t.value,
        description: t.description,
        waitMs: t.waitMs,
        timeoutMs: t.timeoutMs,
        order: t.order,
      })),
    }

    // Mark the run as running before dispatching.
    await db.run.update({
      where: { id: run.id },
      data: { status: 'running' },
    })

    // Dispatch to the automation mini-service (server-to-server, no Caddy).
    try {
      const resp = await fetch(AUTOMATION_SERVICE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        await db.run.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: `automation-service HTTP ${resp.status}: ${errText}`,
            finishedAt: new Date(),
            logs: JSON.stringify([
              { ts: new Date().toISOString(), level: 'error', message: `automation-service HTTP ${resp.status}` },
            ]),
          },
        })
        return NextResponse.json(
          { error: `automation-service error: HTTP ${resp.status}` },
          { status: 502 },
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await db.run.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: `cannot reach automation-service: ${msg}`,
          finishedAt: new Date(),
          logs: JSON.stringify([
            { ts: new Date().toISOString(), level: 'error', message: `cannot reach automation-service: ${msg}` },
          ]),
        },
      })
      return NextResponse.json(
        { error: `cannot reach automation-service: ${msg}` },
        { status: 502 },
      )
    }

    return NextResponse.json({ runId: run.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
