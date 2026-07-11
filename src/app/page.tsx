'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Globe,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Plus,
  Layers,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProfileFormDialog } from '@/components/automation/profile-form-dialog'
import { ProfileCard } from '@/components/automation/profile-card'
import { StatCard } from '@/components/automation/stat-card'
import { RecentRunsTable } from '@/components/automation/recent-runs-table'
import { RunViewerDialog } from '@/components/automation/run-viewer-dialog'
import { EmptyState } from '@/components/automation/empty-state'
import {
  useProfiles,
  useRuns,
  useStats,
  useDeleteProfile,
} from '@/hooks/use-automation'
import type { Profile } from '@/lib/automation-types'

export default function Home() {
  const profilesQuery = useProfiles()
  const runsQuery = useRuns()
  const stats = useStats()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [runViewerOpen, setRunViewerOpen] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)

  const deleteProfile = useDeleteProfile()

  const profiles = profilesQuery.data?.profiles ?? []
  const runs = runsQuery.data?.runs ?? []

  // Map of profileId → most recent run summary
  const lastRunByProfile = useMemo(() => {
    const m = new Map<string, (typeof runs)[number]>()
    for (const r of runs) {
      const prev = m.get(r.profileId)
      if (!prev || new Date(r.startedAt) > new Date(prev.startedAt)) {
        m.set(r.profileId, r)
      }
    }
    return m
  }, [runs])

  function openNewProfile() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEditProfile(p: Profile) {
    setEditing(p)
    setEditorOpen(true)
  }

  function openRunForProfile(p: Profile) {
    setActiveProfileId(p.id)
    setActiveRunId(null)
    setRunViewerOpen(true)
  }

  function openRunHistory(_p: Profile) {
    // Show most recent run for the profile (if any) by scrolling to the runs
    // table — keep it simple for v1.
    document.getElementById('recent-runs')?.scrollIntoView({ behavior: 'smooth' })
  }

  function openExistingRun(runId: string) {
    setActiveProfileId(null)
    setActiveRunId(runId)
    setRunViewerOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">
                Browser Automation Framework
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Log into any website and run a list of tasks with Playwright Firefox
              </p>
            </div>
          </div>
          <Button
            onClick={openNewProfile}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Profiles"
            value={stats.data?.totalProfiles ?? '—'}
            icon={<Layers className="h-5 w-5" />}
            accent="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            label="Total Runs"
            value={stats.data?.totalRuns ?? '—'}
            icon={<PlayCircle className="h-5 w-5" />}
            accent="bg-slate-100 text-slate-700"
          />
          <StatCard
            label="Successful Runs"
            value={stats.data?.successfulRuns ?? '—'}
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            label="Failed Runs"
            value={stats.data?.failedRuns ?? '—'}
            icon={<XCircle className="h-5 w-5" />}
            accent="bg-rose-100 text-rose-700"
          />
        </section>

        {/* Profiles grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Profiles</h2>
              <p className="text-sm text-muted-foreground">
                Each profile is one website&apos;s login recipe + post-login task list.
              </p>
            </div>
          </div>

          {profilesQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              title="No profiles yet"
              hint="Create a profile to define a website's login + task list."
              action={
                <Button
                  onClick={openNewProfile}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create your first profile
                </Button>
              }
            />
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {profiles.map((p) => (
                <ProfileCard
                  key={p.id}
                  profile={p}
                  lastRun={lastRunByProfile.get(p.id)}
                  onRun={() => openRunForProfile(p)}
                  onEdit={() => openEditProfile(p)}
                  onHistory={() => openRunHistory(p)}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </motion.div>
          )}
        </section>

        {/* Recent runs */}
        <section id="recent-runs" className="space-y-3 scroll-mt-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Recent Runs</h2>
            </div>
            <span className="text-xs text-muted-foreground">Last 20</span>
          </div>
          {runsQuery.isLoading ? (
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          ) : (
            <RecentRunsTable runs={runs} onSelect={openExistingRun} limit={20} />
          )}
        </section>
      </main>

      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>Browser Automation Framework &bull; Built with Next.js + Playwright Firefox &bull; Sandbox demo</div>
          <div className="font-mono">{profiles.length} profiles &middot; {runs.length} runs</div>
        </div>
      </footer>

      {/* Dialogs */}
      <ProfileFormDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        profile={editing}
      />

      <RunViewerDialog
        open={runViewerOpen}
        onOpenChange={setRunViewerOpen}
        profileId={activeProfileId}
        existingRunId={activeRunId}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot;, its tasks, and all
              associated runs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteProfile.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
