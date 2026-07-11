'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, X, ImageOff, ExternalLink, CheckCircle2, XCircle, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getAutomationSocket } from '@/lib/socket'
import { useStartRun, useRun } from '@/hooks/use-automation'
import type {
  LogEntry,
  ScreenshotEntry,
  ExtractEntry,
  RunStatus,
} from '@/lib/automation-types'
import { cn } from '@/lib/utils'

interface RunViewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Profile to run. Required when opening for a fresh run. */
  profileId: string | null
  /** When set, view an existing run instead of starting a new one. */
  existingRunId?: string | null
}

type LiveStatus = RunStatus | 'idle'

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info: 'text-muted-foreground',
  success: 'text-emerald-600',
  warn: 'text-amber-600',
  error: 'text-destructive',
}

function statusBadge(status: LiveStatus) {
  switch (status) {
    case 'running':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Running</Badge>
    case 'success':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Success</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    default:
      return <Badge variant="outline">Idle</Badge>
  }
}

export function RunViewerDialog({
  open,
  onOpenChange,
  profileId,
  existingRunId,
}: RunViewerDialogProps) {
  const [runId, setRunId] = useState<string | null>(existingRunId ?? null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([])
  const [extracts, setExtracts] = useState<ExtractEntry[]>([])
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const startRun = useStartRun()
  const runQuery = useRun(runId)

  const logBottomRef = useRef<HTMLDivElement>(null)
  const startRunMutateRef = useRef(startRun.mutateAsync)
  startRunMutateRef.current = startRun.mutateAsync

  // Start a new run when opened with a profileId (and no existing run)
  useEffect(() => {
    if (!open) return
    if (existingRunId) {
      setRunId(existingRunId)
      return
    }
    if (!profileId) return
    let cancelled = false
    setLogs([])
    setScreenshots([])
    setExtracts([])
    setLiveStatus('running')
    setLiveError(null)
    startRunMutateRef.current(profileId).then((res) => {
      if (!cancelled) setRunId(res.runId)
    })
    return () => {
      cancelled = true
    }
  }, [open, profileId, existingRunId])

  // When the dialog closes, clear local state so a future open starts fresh
  useEffect(() => {
    if (!open) {
      setRunId(null)
      setLogs([])
      setScreenshots([])
      setExtracts([])
      setLiveStatus('idle')
      setLiveError(null)
    }
  }, [open])

  // After runId is set, prefer the persisted run (for replay viewing of
  // historical runs) — but live socket events take precedence during an
  // active run.
  useEffect(() => {
    if (!runId) return
    // If we already have live data, don't clobber it with a persisted fetch.
    if (logs.length > 0 || screenshots.length > 0 || extracts.length > 0) return
    if (!runQuery.data) return
    const r = runQuery.data.run
    setLogs(r.logs)
    setScreenshots(r.screenshots)
    setExtracts(r.extracts)
    setLiveStatus(r.status)
    setLiveError(r.error)
  }, [runId, runQuery.data])

  // Socket.io subscriptions
  useEffect(() => {
    if (!open || !runId) return
    const sock = getAutomationSocket()

    function onConnect() {
      setConnected(true)
      sock.emit('replay', { runId })
    }
    function onDisconnect() {
      setConnected(false)
    }
    function onLog(payload: { runId?: string } & LogEntry) {
      if (payload.runId !== runId) return
      setLogs((prev) => [...prev, { ts: payload.ts, level: payload.level, message: payload.message }])
    }
    function onScreenshot(payload: { runId?: string } & ScreenshotEntry) {
      if (payload.runId !== runId) return
      setScreenshots((prev) => [...prev, { order: payload.order, dataUrl: payload.dataUrl }])
    }
    function onExtract(payload: { runId?: string } & ExtractEntry) {
      if (payload.runId !== runId) return
      setExtracts((prev) => [...prev, { order: payload.order, text: payload.text }])
    }
    function onStatus(payload: { runId?: string; status: LiveStatus; error?: string | null }) {
      if (payload.runId !== runId) return
      setLiveStatus(payload.status)
      setLiveError(payload.error ?? null)
    }

    sock.on('connect', onConnect)
    sock.on('disconnect', onDisconnect)
    sock.on('log', onLog)
    sock.on('screenshot', onScreenshot)
    sock.on('extract', onExtract)
    sock.on('status', onStatus)

    if (sock.connected) onConnect()
    else sock.connect()

    return () => {
      sock.off('connect', onConnect)
      sock.off('disconnect', onDisconnect)
      sock.off('log', onLog)
      sock.off('screenshot', onScreenshot)
      sock.off('extract', onExtract)
      sock.off('status', onStatus)
    }
  }, [open, runId])

  // Auto-scroll the log to bottom on new entries
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  const finished = liveStatus === 'success' || liveStatus === 'failed'

  const onLightboxKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setLightbox(null)
  }, [])

  useEffect(() => {
    if (lightbox) {
      window.addEventListener('keydown', onLightboxKeyDown)
      return () => window.removeEventListener('keydown', onLightboxKeyDown)
    }
  }, [lightbox, onLightboxKeyDown])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b flex-row items-center justify-between space-y-0">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              Run viewer
              {connected && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  live
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs font-mono truncate">
              {runId ?? 'starting…'}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge(liveStatus)}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Finished banner */}
        <AnimatePresence>
          {finished && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                'px-5 py-2 text-sm flex items-center gap-2 border-b',
                liveStatus === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-destructive/10 text-destructive border-destructive/20',
              )}
            >
              {liveStatus === 'success' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>
                Run finished {liveStatus === 'success' ? 'successfully' : 'with errors'}
                {liveError ? `: ${liveError}` : ''}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-0 overflow-hidden">
          {/* Log console */}
          <div className="flex flex-col min-h-0 border-b md:border-b-0 md:border-r">
            <div className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
              Live log
            </div>
            <ScrollArea className="flex-1 min-h-[200px]">
              <div className="p-3 font-mono text-xs space-y-1">
                {logs.length === 0 && (
                  <div className="text-muted-foreground italic p-4 text-center">
                    {startRun.isPending ? 'Dispatching run…' : 'Waiting for log output…'}
                  </div>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="text-muted-foreground/70 shrink-0 tabular-nums">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                    <span className={cn('break-all', LEVEL_COLOR[l.level])}>{l.message}</span>
                  </div>
                ))}
                {!finished && logs.length > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground pt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>running…</span>
                  </div>
                )}
                <div ref={logBottomRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Screenshots + extracts */}
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground border-b bg-muted/40">
              Screenshots ({screenshots.length}) &amp; extracts ({extracts.length})
            </div>
            <ScrollArea className="flex-1 min-h-[200px]">
              <div className="p-3 space-y-3">
                {screenshots.length === 0 && extracts.length === 0 && (
                  <div className="text-muted-foreground italic p-4 text-center text-xs flex flex-col items-center gap-2">
                    <ImageOff className="h-5 w-5" />
                    No screenshots or extractions yet.
                  </div>
                )}

                {screenshots.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {screenshots.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightbox(s.dataUrl)}
                        className="group relative aspect-video overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-emerald-400 transition"
                      >
                        <img
                          src={s.dataUrl}
                          alt={`Screenshot ${s.order}`}
                          className="h-full w-full object-cover object-top"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white font-mono opacity-0 group-hover:opacity-100 transition">
                          #{s.order}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {extracts.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Extracted data ({extracts.length})
                    </div>
                    {extracts.map((e, i) => {
                      // Render based on extract type.
                      const etype = e.type || 'text'

                      // --- TEXT (default, backward compatible) ---
                      if (etype === 'text') {
                        return (
                          <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                            <div className="text-[10px] text-muted-foreground font-mono mb-1">#{e.order} · text</div>
                            <pre className="whitespace-pre-wrap break-words font-mono text-foreground/90">{e.text}</pre>
                          </div>
                        )
                      }

                      // --- LIST (extract_all: email subjects, table rows, etc.) ---
                      if (etype === 'list') {
                        const items = e.items || []
                        return (
                          <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                            <div className="text-[10px] text-muted-foreground font-mono mb-1.5 flex items-center justify-between">
                              <span>#{e.order} · list</span>
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{items.length} items</span>
                            </div>
                            {items.length === 0 ? (
                              <p className="text-muted-foreground italic">No items found.</p>
                            ) : (
                              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                                {items.map((item, idx) => (
                                  <div key={idx} className="flex gap-2 items-start rounded border-l-2 border-emerald-400 bg-background/60 px-2 py-1.5">
                                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5 tabular-nums">{idx + 1}.</span>
                                    <span className="break-words text-foreground/90">{item.substring(0, 500)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // --- LINKS (extract_links: activation links, etc.) ---
                      if (etype === 'links') {
                        const links = e.links || []
                        return (
                          <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                            <div className="text-[10px] text-muted-foreground font-mono mb-1.5 flex items-center justify-between">
                              <span>#{e.order} · links</span>
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{links.length} links</span>
                            </div>
                            {links.length === 0 ? (
                              <p className="text-muted-foreground italic">No links found.</p>
                            ) : (
                              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                                {links.map((link, idx) => (
                                  <a
                                    key={idx}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col gap-0.5 rounded border-l-2 border-sky-400 bg-background/60 px-2 py-1.5 hover:bg-emerald-50 transition-colors"
                                  >
                                    <span className="text-foreground/90 font-medium break-words">
                                      {link.text || '(no text)'}
                                    </span>
                                    <span className="text-[10px] text-sky-600 font-mono break-all">{link.href}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // --- MATCHES (extract_regex: activation codes, etc.) ---
                      if (etype === 'matches') {
                        const matches = e.matches || []
                        const contexts = e.contexts || []
                        return (
                          <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                            <div className="text-[10px] text-muted-foreground font-mono mb-1.5 flex items-center justify-between">
                              <span>#{e.order} · regex matches</span>
                              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{matches.length} found</span>
                            </div>
                            <div className="mb-2 text-[10px] text-muted-foreground font-mono">
                              pattern: <code className="text-amber-600">{e.pattern}</code>
                            </div>
                            {matches.length === 0 ? (
                              <p className="text-muted-foreground italic">No matches found.</p>
                            ) : (
                              <div className="space-y-1.5">
                                {matches.map((m, idx) => (
                                  <div key={idx} className="rounded border-l-2 border-amber-400 bg-background/60 px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{idx + 1}.</span>
                                      <code className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{m}</code>
                                    </div>
                                    {contexts[idx]?.context && (
                                      <div className="mt-1 text-[10px] text-muted-foreground italic break-words pl-5">
                                        …{contexts[idx].context}…
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      }

                      // Fallback (shouldn't happen)
                      return (
                        <div key={i} className="rounded-md border bg-muted/40 p-2 text-xs">
                          <div className="text-[10px] text-muted-foreground font-mono mb-1">#{e.order}</div>
                          <pre className="whitespace-pre-wrap break-words font-mono text-foreground/90">{e.text || JSON.stringify(e, null, 2)}</pre>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
            onClick={() => setLightbox(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              onClick={() => setLightbox(null)}
              aria-label="Close screenshot"
            >
              <X className="h-6 w-6" />
            </button>
            <a
              href={lightbox}
              download={`screenshot-${Date.now()}.png`}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 left-4 text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"
            >
              <Download className="h-4 w-4" /> Download
            </a>
            <motion.img
              src={lightbox}
              alt="Screenshot enlarged"
              className="max-h-full max-w-full object-contain rounded-md shadow-2xl"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            />
            <a
              href={lightbox}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 text-white/80 hover:text-white inline-flex items-center gap-1 text-sm"
            >
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
