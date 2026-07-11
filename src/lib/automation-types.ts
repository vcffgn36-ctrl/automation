/**
 * Shared TypeScript types for the automation framework.
 * Used by both the Next.js API routes and the React frontend.
 */

export type TaskType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'press'
  | 'wait'
  | 'wait_for_selector'
  | 'screenshot'
  | 'extract'
  | 'extract_all'
  | 'extract_links'
  | 'extract_regex'
  | 'scroll'
  | 'select'
  | 'evaluate'

export const TASK_TYPES: TaskType[] = [
  'navigate',
  'click',
  'fill',
  'press',
  'wait',
  'wait_for_selector',
  'screenshot',
  'extract',
  'extract_all',
  'extract_links',
  'extract_regex',
  'scroll',
  'select',
  'evaluate',
]

export const TASK_TYPE_DESCRIPTIONS: Record<TaskType, string> = {
  navigate: 'Go to a URL',
  click: 'Click an element',
  fill: 'Type text into an input',
  press: 'Press a keyboard key',
  wait: 'Pause for N ms',
  wait_for_selector: 'Wait for an element to appear',
  screenshot: 'Capture a full-page screenshot',
  extract: 'Read text from an element',
  extract_all: 'Read text from ALL matching elements (e.g. email list)',
  extract_links: 'Extract all links (URLs) from page or element',
  extract_regex: 'Extract text matching a regex pattern (e.g. activation codes)',
  scroll: 'Scroll the page down by N px',
  select: 'Choose an <option> in a <select>',
  evaluate: 'Run arbitrary JS in the page',
}

export const TASK_TYPE_NEEDS_SELECTOR: Record<TaskType, boolean> = {
  navigate: false,
  click: true,
  fill: true,
  press: false,
  wait: false,
  wait_for_selector: true,
  screenshot: false,
  extract: true,
  extract_all: true,
  extract_links: false,
  extract_regex: false,
  scroll: false,
  select: true,
  evaluate: false,
}

export const TASK_TYPE_NEEDS_VALUE: Record<TaskType, boolean> = {
  navigate: true,
  click: false,
  fill: true,
  press: true,
  wait: true,
  wait_for_selector: false,
  screenshot: false,
  extract: false,
  extract_all: false,
  extract_links: false,
  extract_regex: true,
  scroll: true,
  select: true,
  evaluate: true,
}

/** Set of task types that need a CSS selector (used by the TaskBuilder UI). */
export const TASK_USES_SELECTOR: Set<TaskType> = new Set(
  (Object.keys(TASK_TYPE_NEEDS_SELECTOR) as TaskType[]).filter(
    (t) => TASK_TYPE_NEEDS_SELECTOR[t],
  ),
)

/** Set of task types that need a value (used by the TaskBuilder UI). */
export const TASK_USES_VALUE: Set<TaskType> = new Set(
  (Object.keys(TASK_TYPE_NEEDS_VALUE) as TaskType[]).filter(
    (t) => TASK_TYPE_NEEDS_VALUE[t],
  ),
)

export type LoginMode = 'single' | 'multistep'

export const LOGIN_MODES: LoginMode[] = ['single', 'multistep']

export const LOGIN_MODE_LABELS: Record<LoginMode, string> = {
  single: 'Single page (email + password + submit together)',
  multistep: 'Multi-step (email → Next → password → Sign in)',
}

export interface Task {
  id: string
  profileId: string
  order: number
  type: TaskType
  selector: string | null
  value: string | null
  description: string | null
  waitMs: number
  timeoutMs: number
  createdAt: string
}

export interface Profile {
  id: string
  name: string
  siteUrl: string
  loginUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  loginMode: LoginMode
  username: string
  password: string
  headless: boolean
  viewportWidth: number
  viewportHeight: number
  userAgent: string | null
  locale: string | null
  useProxy: boolean
  proxyServer: string | null
  proxyUsername: string | null
  proxyPassword: string | null
  sessionState: string | null
  sessionUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  tasks: Task[]
}

export type RunStatus = 'pending' | 'running' | 'success' | 'failed'

/** Lightweight run metadata (no logs/screenshots/extracts). */
export interface RunSummary {
  id: string
  profileId: string
  profileName: string
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  error: string | null
  createdAt: string
}

/** Full run with logs/screenshots/extracts. */
export interface Run extends RunSummary {
  logs: LogEntry[]
  screenshots: ScreenshotEntry[]
  extracts: ExtractEntry[]
}

export interface LogEntry {
  ts: string
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export interface ScreenshotEntry {
  order: number
  dataUrl: string
}

export interface ExtractEntry {
  order: number
  /** Plain text extract (backward compatible — used by `extract` task). */
  text?: string
  /** Type of structured extract. Defaults to 'text' for backward compatibility. */
  type?: 'text' | 'list' | 'links' | 'matches'
  /** For type='list': array of text items (e.g. email subjects). */
  items?: string[]
  /** For type='links': array of link objects. */
  links?: Array<{ text: string; href: string }>
  /** For type='matches': regex pattern used. */
  pattern?: string
  /** For type='matches': array of matched strings. */
  matches?: string[]
  /** For type='matches': optional context — the text around each match. */
  contexts?: Array<{ match: string; context: string }>
}

export interface ProfileInput {
  name: string
  siteUrl: string
  loginUrl: string
  usernameSelector: string
  passwordSelector: string
  submitSelector: string
  loginMode: LoginMode
  username: string
  password: string
  headless: boolean
  viewportWidth: number
  viewportHeight: number
  userAgent?: string | null
  locale?: string | null
  useProxy: boolean
  proxyServer?: string | null
  proxyUsername?: string | null
  proxyPassword?: string | null
  tasks: TaskInput[]
}

export interface TaskInput {
  type: TaskType
  selector?: string | null
  value?: string | null
  description?: string | null
  waitMs?: number
  timeoutMs?: number
}

export interface RunFinalState {
  status: 'success' | 'failed'
  error: string | null
  logs: LogEntry[]
  screenshots: ScreenshotEntry[]
  extracts: ExtractEntry[]
  sessionState: string | null
}

export interface Stats {
  totalProfiles: number
  totalRuns: number
  successfulRuns: number
  failedRuns: number
}
