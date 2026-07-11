import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RunSummary } from '@/lib/automation-types'

export async function GET() {
  try {
    const runs = await db.run.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { profile: { select: { name: true } } },
    })
    const summaries: RunSummary[] = runs.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      profileName: r.profile.name,
      status: r.status as RunSummary['status'],
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      error: r.error,
      createdAt: r.createdAt.toISOString(),
    }))
    return NextResponse.json({ runs: summaries })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
