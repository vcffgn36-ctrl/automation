/**
 * Ready-made templates for profiles and task presets.
 *
 * Users can pick a template instead of filling in every field by hand.
 * After applying a template, they can still edit any field before saving.
 */

import type { ProfileInput, TaskInput, LoginMode } from '@/lib/automation-types'

// ---------------------------------------------------------------------------
// Profile templates
// ---------------------------------------------------------------------------

export interface ProfileTemplate {
  id: string
  name: string
  description: string
  /** Partial profile input — only the fields the template sets. */
  values: Partial<ProfileInput>
}

export const PROFILE_TEMPLATES: ProfileTemplate[] = [
  {
    id: 'empty',
    name: 'Empty (start from scratch)',
    description: 'No pre-filled values',
    values: {},
  },
  {
    id: 'ms365',
    name: 'Microsoft 365 / Business',
    description: 'login.microsoftonline.com — for work/school accounts',
    values: {
      name: 'Microsoft 365',
      siteUrl: 'https://account.microsoft.com',
      loginUrl: 'https://login.microsoftonline.com/',
      usernameSelector: "input#i0116",
      passwordSelector: "input#passwordEntry",
      submitSelector: 'button[type="submit"]',
      loginMode: 'multistep' as LoginMode,
    },
  },
  {
    id: 'outlook',
    name: 'Outlook.com (personal)',
    description: 'login.live.com — for personal @outlook/@hotmail accounts',
    values: {
      name: 'Outlook.com',
      siteUrl: 'https://outlook.com',
      loginUrl: 'https://login.live.com/',
      usernameSelector: "input#usernameEntry",
      passwordSelector: "input#passwordEntry",
      submitSelector: 'button[type="submit"]',
      loginMode: 'multistep' as LoginMode,
    },
  },
  {
    id: 'gmail',
    name: 'Gmail / Google',
    description: 'accounts.google.com — multi-step Google login',
    values: {
      name: 'Gmail',
      siteUrl: 'https://mail.google.com',
      loginUrl: 'https://accounts.google.com/signin',
      usernameSelector: "input[type='email']",
      passwordSelector: "input[type='password']",
      submitSelector: '#identifierNext, button[type="submit"]',
      loginMode: 'multistep' as LoginMode,
    },
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'linkedin.com — single-page login',
    values: {
      name: 'LinkedIn',
      siteUrl: 'https://linkedin.com',
      loginUrl: 'https://www.linkedin.com/login',
      usernameSelector: "#username",
      passwordSelector: "#password",
      submitSelector: 'button[type="submit"]',
      loginMode: 'single' as LoginMode,
    },
  },
  {
    id: 'facebook',
    name: 'Facebook',
    description: 'facebook.com — single-page login',
    values: {
      name: 'Facebook',
      siteUrl: 'https://facebook.com',
      loginUrl: 'https://www.facebook.com/login',
      usernameSelector: "#email",
      passwordSelector: "#pass",
      submitSelector: '[data-testid="royal_login_button"], button[name="login"]',
      loginMode: 'single' as LoginMode,
    },
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    description: 'x.com — multi-step login',
    values: {
      name: 'Twitter / X',
      siteUrl: 'https://x.com',
      loginUrl: 'https://x.com/i/flow/login',
      usernameSelector: "input[autocomplete='username']",
      passwordSelector: "input[type='password']",
      submitSelector: 'button[type="submit"]',
      loginMode: 'multistep' as LoginMode,
    },
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'github.com — single-page login',
    values: {
      name: 'GitHub',
      siteUrl: 'https://github.com',
      loginUrl: 'https://github.com/login',
      usernameSelector: "#login_field",
      passwordSelector: "#password",
      submitSelector: 'input[type="submit"], button[type="submit"]',
      loginMode: 'single' as LoginMode,
    },
  },
]

// ---------------------------------------------------------------------------
// Task presets
// ---------------------------------------------------------------------------

export interface TaskPreset {
  id: string
  name: string
  description: string
  /** Tasks to add when this preset is selected. */
  tasks: TaskInput[]
}

export const TASK_PRESETS: TaskPreset[] = [
  {
    id: 'screenshot-after-login',
    name: 'Screenshot after login',
    description: 'Wait 3s + take a screenshot',
    tasks: [
      { type: 'wait', value: '3000', description: 'Wait for page to load' },
      { type: 'screenshot', description: 'Screenshot after login' },
    ],
  },
  {
    id: 'read-inbox',
    name: 'Read email inbox (list all emails)',
    description: 'Navigate to Outlook inbox + extract all email rows',
    tasks: [
      { type: 'wait', value: '3000', description: 'Wait for inbox to load' },
      { type: 'navigate', value: 'https://outlook.live.com/mail/0/inbox', description: 'Go to inbox' },
      { type: 'wait', value: '5000', description: 'Wait for emails to render' },
      { type: 'extract_all', selector: '[role="option"]', description: 'Extract all email rows' },
    ],
  },
  {
    id: 'extract-activation-codes',
    name: 'Find activation codes (4-8 digits)',
    description: 'Scan the page for 4-8 digit numeric codes (OTP/verification)',
    tasks: [
      { type: 'extract_regex', value: '\\d{4,8}', description: 'Find activation codes (4-8 digits)' },
    ],
  },
  {
    id: 'extract-activation-links',
    name: 'Find activation links',
    description: 'Extract all clickable links from the page (activation URLs)',
    tasks: [
      { type: 'extract_links', description: 'Extract all activation links' },
    ],
  },
  {
    id: 'read-email-open-first',
    name: 'Open first email + read body + extract codes',
    description: 'Click the first email, wait, then extract body text, links, and codes',
    tasks: [
      { type: 'wait_for_selector', selector: '[role="option"]', timeoutMs: 10000, description: 'Wait for email list' },
      { type: 'click', selector: '[role="option"]:first-child', description: 'Open first email' },
      { type: 'wait', value: '3000', description: 'Wait for email body to load' },
      { type: 'extract', selector: '[role="document"]', description: 'Extract email body text' },
      { type: 'extract_links', selector: '[role="document"]', description: 'Extract links from email body' },
      { type: 'extract_regex', selector: '[role="document"]', value: '\\d{4,8}', description: 'Find codes in email body' },
    ],
  },
  {
    id: 'outlook-full-flow',
    name: 'Outlook: login → inbox → extract everything',
    description: 'Full flow: navigate to inbox, extract email list + links + codes + screenshot',
    tasks: [
      { type: 'wait', value: '3000', description: 'Wait for inbox to load' },
      { type: 'navigate', value: 'https://outlook.live.com/mail/0/inbox', description: 'Go to inbox' },
      { type: 'wait', value: '5000', description: 'Wait for emails to render' },
      { type: 'extract_all', selector: '[role="option"]', description: 'Extract all email rows' },
      { type: 'extract_links', description: 'Extract all links from inbox' },
      { type: 'extract_regex', value: '\\d{4,8}', description: 'Find activation codes (4-8 digits)' },
      { type: 'screenshot', description: 'Final inbox view' },
    ],
  },
  {
    id: 'scroll-and-screenshot',
    name: 'Scroll down + screenshot',
    description: 'Scroll the page down 500px then take a screenshot',
    tasks: [
      { type: 'scroll', value: '500', description: 'Scroll down 500px' },
      { type: 'wait', value: '1000', description: 'Wait for content to load' },
      { type: 'screenshot', description: 'Screenshot after scroll' },
    ],
  },
]
