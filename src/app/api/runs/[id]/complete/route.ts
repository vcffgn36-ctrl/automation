import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RunFinalState } from '@/lib/automation-types'

/**
 * Callback endpoint invoked by the automation mini-service when a run finishes.
 * Persists the final state (logs, screenshots, extracts, status, error,
 * sessionState) to the database.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    let body: RunFinalState
    try {
      body = (await req.json()) as RunFinalState
    } catch {
      return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
    }

    const run = await db.run.findUnique({ where: { id } })
    if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 })

    await db.run.update({
      where: { id },
      data: {
        status: body.status,
        error: body.error,
        logs: JSON.stringify(body.logs ?? []),
        screenshots: JSON.stringify(body.screenshots ?? []),
        extracts: JSON.stringify(body.extracts ?? []),
        finishedAt: new Date(),
      },
    })

    // If login succeeded and the service captured a fresh session state,
    // persist it on the profile so subsequent runs can reuse it.
    if (body.sessionState) {
      await db.profile.update({
        where: { id: run.profileId },
        data: {
          sessionState: body.sessionState,
          sessionUpdatedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
