'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Globe, Pencil, Play, Trash2, History, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Profile, RunSummary } from '@/lib/automation-types'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProfileCardProps {
  profile: Profile
  lastRun?: RunSummary
  onRun: () => void
  onEdit: () => void
  onHistory: () => void
  onDelete: () => void
}

function statusBadge(status?: RunSummary['status']) {
  switch (status) {
    case 'success':
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Success</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    case 'running':
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Running</Badge>
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    default:
      return <Badge variant="outline">No runs</Badge>
  }
}

export function ProfileCard({
  profile,
  lastRun,
  onRun,
  onEdit,
  onHistory,
  onDelete,
}: ProfileCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden border-border/70 hover:border-emerald-300 transition-colors">
        <CardHeader className="pb-3 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600 shrink-0" />
                <h3 className="font-semibold truncate text-foreground">{profile.name}</h3>
              </div>
              <a
                href={profile.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-700 truncate max-w-full"
              >
                <span className="truncate">{profile.siteUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
            {statusBadge(lastRun?.status)}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-4 pt-1">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-muted/60 p-2">
              <div className="text-muted-foreground">Tasks</div>
              <div className="font-medium tabular-nums">{profile.tasks.length}</div>
            </div>
            <div className="rounded-md bg-muted/60 p-2">
              <div className="text-muted-foreground">Headless</div>
              <div className="font-medium">{profile.headless ? 'Yes' : 'No'}</div>
            </div>
            {profile.useProxy && (
              <div className="col-span-2 rounded-md bg-amber-50 text-amber-800 p-2">
                Proxy: {profile.proxyServer}
              </div>
            )}
            {profile.sessionUpdatedAt && (
              <div className="col-span-2 flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Session saved {new Date(profile.sessionUpdatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              onClick={onRun}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="h-4 w-4 mr-1" />
              Run
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onEdit} aria-label="Edit profile">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onHistory} aria-label="Run history">
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>History</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDelete}
                    aria-label="Delete profile"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
