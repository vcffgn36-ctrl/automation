'use client'

import { useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Lightbulb } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TaskBuilder } from './task-builder'
import { useCreateProfile, useUpdateProfile } from '@/hooks/use-automation'
import type { Profile, ProfileInput, TaskInput } from '@/lib/automation-types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  siteUrl: z.string().min(1, 'Site URL is required').url('Must be a valid URL'),
  loginUrl: z.string().min(1, 'Login URL is required').url('Must be a valid URL'),
  usernameSelector: z.string().min(1, 'Required'),
  passwordSelector: z.string().min(1, 'Required'),
  submitSelector: z.string().min(1, 'Required'),
  username: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
  headless: z.boolean(),
  viewportWidth: z.coerce.number().int().min(320).max(4096),
  viewportHeight: z.coerce.number().int().min(240).max(4096),
  userAgent: z.string().optional().nullable(),
  locale: z.string().optional().nullable(),
  useProxy: z.boolean(),
  proxyServer: z.string().optional().nullable(),
  proxyUsername: z.string().optional().nullable(),
  proxyPassword: z.string().optional().nullable(),
})

type FormValues = z.infer<typeof schema>

interface ProfileFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, edit this profile; otherwise create new. */
  profile?: Profile | null
}

const DEFAULTS: FormValues = {
  name: '',
  siteUrl: 'https://',
  loginUrl: 'https://',
  usernameSelector: "input[type='email']",
  passwordSelector: "input[type='password']",
  submitSelector: "button[type='submit']",
  username: '',
  password: '',
  headless: true,
  viewportWidth: 1280,
  viewportHeight: 800,
  userAgent: null,
  locale: null,
  useProxy: false,
  proxyServer: null,
  proxyUsername: null,
  proxyPassword: null,
}

function fromProfile(p: Profile): FormValues {
  return {
    name: p.name,
    siteUrl: p.siteUrl,
    loginUrl: p.loginUrl,
    usernameSelector: p.usernameSelector,
    passwordSelector: p.passwordSelector,
    submitSelector: p.submitSelector,
    username: p.username,
    password: p.password,
    headless: p.headless,
    viewportWidth: p.viewportWidth,
    viewportHeight: p.viewportHeight,
    userAgent: p.userAgent,
    locale: p.locale,
    useProxy: p.useProxy,
    proxyServer: p.proxyServer,
    proxyUsername: p.proxyUsername,
    proxyPassword: p.proxyPassword,
  }
}

function tasksFromProfile(p: Profile): TaskInput[] {
  return [...p.tasks]
    .sort((a, b) => a.order - b.order)
    .map((t) => ({
      type: t.type,
      selector: t.selector,
      value: t.value,
      description: t.description,
      waitMs: t.waitMs,
      timeoutMs: t.timeoutMs,
    }))
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>
}

/**
 * Inner form component. Mounted fresh (via key) whenever the dialog opens so
 * `useState` lazy initializers can be used to seed the form from `profile` —
 * avoiding setState-in-effect.
 */
function ProfileForm({
  profile,
  onClose,
}: {
  profile: Profile | null
  onClose: () => void
}) {
  const isEdit = !!profile
  const create = useCreateProfile()
  const update = useUpdateProfile(profile?.id ?? '')

  const initial: FormValues = profile ? fromProfile(profile) : DEFAULTS

  const [tasks, setTasks] = useState<TaskInput[]>(() =>
    profile ? tasksFromProfile(profile) : [],
  )

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  })

  const useProxy = useWatch({ control, name: 'useProxy' })

  async function onSubmit(values: FormValues) {
    const payload: ProfileInput = {
      ...values,
      userAgent: values.userAgent || null,
      locale: values.locale || null,
      proxyServer: values.useProxy ? values.proxyServer || null : null,
      proxyUsername: values.useProxy ? values.proxyUsername || null : null,
      proxyPassword: values.useProxy ? values.proxyPassword || null : null,
      tasks,
    }
    if (isEdit && profile) {
      await update.mutateAsync(payload)
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const pending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
      {/* Site */}
      <section className="space-y-3">
        <SectionTitle>Site</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Profile name</Label>
            <Input id="name" placeholder="e.g. Acme Corp Dashboard" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteUrl">Site URL</Label>
            <Input id="siteUrl" placeholder="https://example.com" {...register('siteUrl')} />
            {errors.siteUrl && <p className="text-xs text-destructive">{errors.siteUrl.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loginUrl">Login URL</Label>
            <Input id="loginUrl" placeholder="https://example.com/login" {...register('loginUrl')} />
            {errors.loginUrl && <p className="text-xs text-destructive">{errors.loginUrl.message}</p>}
          </div>
        </div>
      </section>

      <Separator />

      {/* Login selectors */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <SectionTitle>Login form selectors</SectionTitle>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground max-w-[16rem]">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <span>
              Right-click the form field in your browser → Inspect → copy its CSS selector.
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="usernameSelector">Username selector</Label>
            <Input id="usernameSelector" className="font-mono text-xs" {...register('usernameSelector')} />
            {errors.usernameSelector && <p className="text-xs text-destructive">{errors.usernameSelector.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="passwordSelector">Password selector</Label>
            <Input id="passwordSelector" className="font-mono text-xs" {...register('passwordSelector')} />
            {errors.passwordSelector && <p className="text-xs text-destructive">{errors.passwordSelector.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="submitSelector">Submit button selector</Label>
            <Input id="submitSelector" className="font-mono text-xs" {...register('submitSelector')} />
            {errors.submitSelector && <p className="text-xs text-destructive">{errors.submitSelector.message}</p>}
          </div>
        </div>
      </section>

      <Separator />

      {/* Credentials */}
      <section className="space-y-3">
        <SectionTitle>Credentials</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="off" {...register('username')} />
            {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </div>
      </section>

      <Separator />

      {/* Browser options */}
      <section className="space-y-3">
        <SectionTitle>Browser options</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="headless">Headless mode</Label>
              <p className="text-xs text-muted-foreground">Run browser without a visible window</p>
            </div>
            <Controller
              control={control}
              name="headless"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="viewportWidth">Viewport width</Label>
              <Input id="viewportWidth" type="number" {...register('viewportWidth')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="viewportHeight">Viewport height</Label>
              <Input id="viewportHeight" type="number" {...register('viewportHeight')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="userAgent">User agent (optional)</Label>
            <Input id="userAgent" placeholder="Mozilla/5.0 ..." {...register('userAgent')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locale">Locale (optional)</Label>
            <Controller
              control={control}
              name="locale"
              render={({ field }) => (
                <Select
                  value={field.value ?? '__none'}
                  onValueChange={(v) => field.onChange(v === '__none' ? null : v)}
                >
                  <SelectTrigger id="locale">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Default</SelectItem>
                    <SelectItem value="en-US">en-US</SelectItem>
                    <SelectItem value="en-GB">en-GB</SelectItem>
                    <SelectItem value="ar">ar</SelectItem>
                    <SelectItem value="fr-FR">fr-FR</SelectItem>
                    <SelectItem value="de-DE">de-DE</SelectItem>
                    <SelectItem value="es-ES">es-ES</SelectItem>
                    <SelectItem value="ja-JP">ja-JP</SelectItem>
                    <SelectItem value="zh-CN">zh-CN</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* Proxy */}
      <section className="space-y-3">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <SectionTitle>Proxy (optional)</SectionTitle>
            <p className="text-xs text-muted-foreground">Route browser traffic through an HTTP/SOCKS5 proxy</p>
          </div>
          <Controller
            control={control}
            name="useProxy"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
        {useProxy && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-1.5">
              <Label htmlFor="proxyServer">Proxy server</Label>
              <Input id="proxyServer" placeholder="http://host:port" {...register('proxyServer')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proxyUsername">Username</Label>
              <Input id="proxyUsername" autoComplete="off" {...register('proxyUsername')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proxyPassword">Password</Label>
              <Input id="proxyPassword" type="password" autoComplete="new-password" {...register('proxyPassword')} />
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Tasks */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionTitle>Tasks (after login)</SectionTitle>
          <span className="text-xs text-muted-foreground">{tasks.length} task(s)</span>
        </div>
        <TaskBuilder value={tasks} onChange={setTasks} />
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create profile'}
        </Button>
      </div>
    </form>
  )
}

export function ProfileFormDialog({ open, onOpenChange, profile }: ProfileFormDialogProps) {
  // Mount the form fresh on every open so initial state is derived from
  // `profile` via lazy useState — no setState-in-effect needed.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit profile' : 'New profile'}</DialogTitle>
          <DialogDescription>
            Define a website&apos;s login recipe and the list of tasks to run after login.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProfileForm
            key={profile?.id ?? 'new'}
            profile={profile ?? null}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
