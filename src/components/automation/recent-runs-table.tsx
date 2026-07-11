'use client'

import { motion } from 'framer-motion'
import { EmptyState } from './empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { RunSummary } from '@/lib/automation-types'
import { formatDistanceToNow, format } from 'date-fns'

interface RecentRunsTableProps {
  runs: RunSummary[]
  onSelect: (runId: string) => void
  limit?: number
}

function statusBadge(status: RunSummary['status']) {
  switch (status) {
    case 'success':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Success</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    case 'running':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Running</Badge>
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
  }
}

function durationLabel(start: string, end: string | null): string {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

export function RecentRunsTable({ runs, onSelect, limit = 20 }: RecentRunsTableProps) {
  const visible = runs.slice(0, limit)

  if (visible.length === 0) {
    return <EmptyState title="No runs yet" hint="Click Run on a profile to start your first automation." />
  }

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <div className="max-h-[28rem] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <TableRow>
              <TableHead className="w-[28%]">Profile</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[180px]">Started</TableHead>
              <TableHead className="w-[90px]">Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileHover={{ backgroundColor: 'rgba(16,185,129,0.06)' }}
                onClick={() => onSelect(r.id)}
                className="cursor-pointer border-b transition-colors last:border-0"
              >
                <TableCell className="font-medium truncate">{r.profileName}</TableCell>
                <TableCell>{statusBadge(r.status)}</TableCell>
                <TableCell className="text-xs text-muted-foreground" title={format(new Date(r.startedAt), 'PPpp')}>
                  {formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-xs tabular-nums">{durationLabel(r.startedAt, r.finishedAt)}</TableCell>
                <TableCell className="text-xs text-destructive truncate max-w-[20rem]">{r.error ?? ''}</TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
