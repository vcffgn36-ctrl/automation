'use client'

import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, hint, icon, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-dashed border-border p-6 sm:p-8 text-center flex flex-col items-center gap-2 bg-muted/20"
    >
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div>
        <div className="font-medium text-foreground">{title}</div>
        {hint && <div className="text-sm text-muted-foreground mt-1">{hint}</div>}
      </div>
      {action}
    </motion.div>
  )
}
