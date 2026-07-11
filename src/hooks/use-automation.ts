'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  ProfileInput,
  Profile,
  RunSummary,
  Run,
  Stats,
} from '@/lib/automation-types'

// --------------------------------------------------------------------------
// Profiles
// --------------------------------------------------------------------------

export function useProfiles() {
  return useQuery<{ profiles: Profile[] }>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const r = await fetch('/api/profiles')
      if (!r.ok) throw new Error(`failed to load profiles: ${r.status}`)
      return r.json()
    },
    refetchInterval: 15000,
  })
}

export function useProfile(id: string | null) {
  return useQuery<{ profile: Profile }>({
    queryKey: ['profile', id],
    queryFn: async () => {
      const r = await fetch(`/api/profiles/${id}`)
      if (!r.ok) throw new Error(`failed to load profile: ${r.status}`)
      return r.json()
    },
    enabled: !!id,
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const r = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error(err.error || 'failed to create profile')
      }
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile created')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/**
 * Returns a mutation that takes a ProfileInput and updates the profile with
 * the given id. Signature matches the ProfileFormDialog usage:
 *   const update = useUpdateProfile(profile?.id ?? '')
 *   update.mutateAsync(values)
 */
export function useUpdateProfile(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      const r = await fetch(`/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error(err.error || 'failed to update profile')
      }
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      qc.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Profile saved')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/profiles/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('failed to delete profile')
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Profile deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// --------------------------------------------------------------------------
// Runs
// --------------------------------------------------------------------------

export function useRuns() {
  return useQuery<{ runs: RunSummary[] }>({
    queryKey: ['runs'],
    queryFn: async () => {
      const r = await fetch('/api/runs')
      if (!r.ok) throw new Error(`failed to load runs: ${r.status}`)
      return r.json()
    },
    refetchInterval: 15000,
  })
}

export function useRun(id: string | null) {
  return useQuery<{ run: Run }>({
    queryKey: ['run', id],
    queryFn: async () => {
      const r = await fetch(`/api/runs/${id}`)
      if (!r.ok) throw new Error(`failed to load run: ${r.status}`)
      return r.json()
    },
    enabled: !!id,
  })
}

export function useStartRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (profileId: string): Promise<{ runId: string }> => {
      const r = await fetch(`/api/profiles/${profileId}/run`, { method: 'POST' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }))
        throw new Error(err.error || 'failed to start run')
      }
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] })
      qc.invalidateQueries({ queryKey: ['profiles'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

// --------------------------------------------------------------------------
// Stats (derived from profiles + runs queries — no extra endpoint needed)
// --------------------------------------------------------------------------

export function useStats() {
  const profilesQ = useProfiles()
  const runsQ = useRuns()
  return useQuery<Stats>({
    queryKey: ['stats', profilesQ.dataUpdatedAt, runsQ.dataUpdatedAt],
    queryFn: () => {
      const profiles = profilesQ.data?.profiles ?? []
      const runs = runsQ.data?.runs ?? []
      return {
        totalProfiles: profiles.length,
        totalRuns: runs.length,
        successfulRuns: runs.filter((r) => r.status === 'success').length,
        failedRuns: runs.filter((r) => r.status === 'failed').length,
      }
    },
    enabled: profilesQ.isSuccess && runsQ.isSuccess,
  })
}

// Re-export types for convenience
export type { Profile, RunSummary, Run, Stats }
