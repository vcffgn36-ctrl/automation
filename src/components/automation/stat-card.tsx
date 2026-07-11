'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: number | string
  icon: ReactNode
  /** Tailwind classes for the icon tile color (bg + text). */
  accent?: string
}

export function StatCard({ label, value, icon, accent = 'bg-emerald-100 text-emerald-700' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg shrink-0', accent)}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
            <div className="text-xs text-muted-foreground truncate">{label}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
