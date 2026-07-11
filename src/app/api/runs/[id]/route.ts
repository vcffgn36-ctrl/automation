import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Run, LogEntry, ScreenshotEntry, ExtractEntry } from '@/lib/automation-types'

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  try {
    const r = await db.run.findUnique({
      where: { id },
      include: { profile: { select: { name: true } } },
    })
    if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const run: Run = {
      id: r.id,
      profileId: r.profileId,
      profileName: r.profile.name,
      status: r.status as Run['status'],
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
      logs: safeParse<LogEntry[]>(r.logs, []),
      screenshots: safeParse<ScreenshotEntry[]>(r.screenshots, []),
      extracts: safeParse<ExtractEntry[]>(r.extracts, []),
    }
    return NextResponse.json({ run })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
