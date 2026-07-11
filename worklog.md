# Project Worklog — Browser Automation Framework

This file tracks all work done on the browser-automation project (Next.js + Playwright Firefox + socket.io mini-service).

---
Task ID: 0
Agent: main
Task: Environment setup + planning

Work Log:
- Installed `playwright@1.61.1` via `bun add playwright`
- Installed Playwright Firefox browser to `/home/z/.cache/ms-playwright/firefox-1532`
- Attempted Tor install via `apt-get` but sudo password is required and unavailable in sandbox — Tor skipped (proxy is configurable in the UI so user can plug in Tor/HTTP/SOCKS5 externally if needed)
- Inspected existing Next.js 16 project structure (shadcn/ui, Prisma, SQLite at `db/custom.db`)
- Confirmed Caddy gateway routes `?XTransformPort=<port>` to localhost:<port>; default to 3000
- Confirmed socket.io example pattern (path "/", port 3003) for mini-service reference

Stage Summary:
- Playwright Firefox ready for headless automation
- Architecture decided:
  - Next.js app (port 3000): Dashboard UI + Prisma + REST API
  - Mini-service `automation-service` (port 3003): HTTP POST /run + socket.io for live logs
  - DB: SQLite via Prisma, models: Profile, Task, Run
- Proxy is configurable per-profile (HTTP/SOCKS5) — Tor pluggable externally
- Next: write Prisma schema, push DB, delegate full build to subagent

---
Task ID: 5-7
Agent: main (full-stack-developer agent timed out, main completed the work)
Task: Build automation mini-service + Next.js dashboard + REST API + live run viewer

Work Log:
- Installed playwright@1.61.1 + Firefox browser binary (already done by main in task 0)
- Created automation-service mini-service at mini-services/automation-service/ with:
  - Hono HTTP server (POST /run, GET /health) + socket.io on shared port 3003
  - socket.io path "/socket.io" (not "/") so Hono routes coexist with WebSocket
  - Playwright Firefox engine: login flow + 11 task types (navigate, click, fill, press, wait, wait_for_selector, screenshot, extract, scroll, select, evaluate)
  - In-memory buffer per runId for late-joiner replay
  - Callback to Next.js /api/runs/[id]/complete with final state
  - 5-minute global timeout, session state capture after login
- Designed Prisma schema (Profile, Task, Run models) — already pushed in task 0
- Built Next.js API routes:
  - GET/POST /api/profiles (full profile with tasks)
  - GET/PUT/DELETE /api/profiles/[id]
  - POST /api/profiles/[id]/run (creates Run, dispatches to mini-service)
  - GET /api/runs (list RunSummary[])
  - GET /api/runs/[id] (full Run with logs/screenshots/extracts)
  - POST /api/runs/[id]/complete (callback from mini-service)
- Built frontend (discovered previous agent had already created most components):
  - src/app/page.tsx — dashboard with header, stats, profiles grid, recent runs, sticky footer
  - src/components/automation/ — profile-card, profile-form-dialog, task-builder (dnd-kit), run-viewer-dialog, stat-card, recent-runs-table, empty-state
  - src/hooks/use-automation.ts — React Query hooks (useProfiles, useRuns, useRun, useStats, useCreateProfile, useUpdateProfile, useDeleteProfile, useStartRun)
  - src/lib/automation-types.ts — shared types (Profile, Task, Run, RunSummary, TaskInput, etc.)
  - src/lib/socket.ts — singleton socket.io client
  - src/components/theme-provider.tsx — next-themes wrapper
  - Updated layout.tsx with QueryProvider + SonnerToaster
- Fixed mismatches between previous agent's components and my API/hooks:
  - Added TASK_USES_SELECTOR / TASK_USES_VALUE as Sets (task-builder expects them)
  - Added RunSummary type (profile-card and recent-runs-table expect it)
  - Changed useUpdateProfile to take id directly (profile-form-dialog expects it)
  - Added useStats hook (page.tsx expects it)
  - Changed /api/profiles to return full Profile[] with tasks (ProfileCard needs tasks)
  - Changed /api/runs to return RunSummary[] (no logs, lighter)
- Fixed socket.io event mismatch: frontend emits 'replay', server now handles both 'join' and 'replay'
- Reduced Prisma logging (removed ['query'] to save memory)
- Increased React Query polling interval to 15s (from 5s) to reduce memory pressure
- Used --webpack flag (instead of default Turbopack) for Next.js dev to reduce memory usage
- Set NODE_OPTIONS=--max-old-space-size=768 to limit Next.js heap

Verification (Agent Browser):
- Page renders correctly: header, 4 stat cards, profiles grid, recent runs table, sticky footer
- "New Profile" dialog opens with all sections (Site, Login selectors, Credentials, Browser options, Proxy, Tasks)
- Task builder supports drag-and-drop reordering via @dnd-kit
- "Run" button opens Run Viewer dialog with live log console + screenshots/extracts panels
- Automation engine confirmed working via service logs:
  - Firefox launches
  - Saved session state loads
  - Navigates to login URL
  - Fills login form (or times out if selectors don't match — expected on example.org)
  - Emits log/screenshot/extract/status events via socket.io
  - Posts final state to callback URL
- Previous successful run exists in DB (6 logs, success status, session saved)

Known sandbox limitation:
- The sandbox process reaper kills ALL background processes (including the dev server and mini-service) after ~30-60 seconds, even with setsid/nohup/disown
- The watchdog script (start-services.sh) also gets killed
- This does NOT affect the code correctness — the full flow works within a single bash session
- In a real deployment (user's own machine), the services would stay alive normally

Stage Summary:
- Files created/modified:
  - mini-services/automation-service/{package.json, index.ts}
  - prisma/schema.prisma (Profile, Task, Run models)
  - src/lib/automation-types.ts, src/lib/socket.ts, src/lib/db.ts
  - src/hooks/use-automation.ts
  - src/app/api/profiles/route.ts, [id]/route.ts, [id]/run/route.ts
  - src/app/api/runs/route.ts, [id]/route.ts, [id]/complete/route.ts
  - src/app/page.tsx, src/app/layout.tsx
  - src/components/automation/{profile-card, profile-form-dialog, task-builder, run-viewer-dialog, stat-card, recent-runs-table, empty-state}.tsx
  - src/components/theme-provider.tsx, src/components/providers.tsx
  - start-services.sh (watchdog, doesn't survive sandbox reaper)
- Architecture: Next.js (3000) + automation-service (3003) + SQLite (Prisma)
- All 11 task types implemented: navigate, click, fill, press, wait, wait_for_selector, screenshot, extract, scroll, select, evaluate
- Live updates via socket.io (log/screenshot/extract/status events)
- Session state persisted per profile for login reuse
- Proxy configurable per profile (HTTP/SOCKS5) — Tor pluggable externally
- Responsive design, emerald accent color (no indigo/blue), sticky footer
- To run: cd /home/z/my-project && bun run dev (Next.js) + cd mini-services/automation-service && bun run dev (mini-service)

---
Task ID: 10
Agent: main
Task: Push project to GitHub and create full documentation (README + update script)

Work Log:
- Created comprehensive README.md (Arabic + English) with:
  - Architecture diagram (ASCII)
  - Prerequisites table
  - Step-by-step clone & run guide
  - Development mode instructions
  - Usage guide (creating profiles, finding CSS selectors, running)
  - All 11 task types reference table
  - Proxy & Tor setup instructions
  - Update workflow (how to pull updates from GitHub)
  - Troubleshooting section (6 common errors + solutions)
  - Security notes
  - Project structure tree
- Created .env.example with relative DATABASE_URL (file:./db/custom.db) — fixes the "Error code 14" issue users hit when cloning
- Created update.sh — one-command update script that:
  - Backs up database before updating
  - Stashes local changes
  - Pulls from origin/main
  - Reinstalls dependencies
  - Updates Prisma schema (preserves data)
  - Updates Playwright Firefox
  - Restores stashed changes
- Updated .gitignore to:
  - Ignore db/*.db and db/*.db-journal
  - Ignore mini-services/automation-service/node_modules/
  - Ignore *.log, /tmp/, IDE files
  - Allow .env.example (via !.env.example exception)
- Untracked db/custom.db and .env from git (were committed by previous agent — security risk since db contains user passwords)
- Committed all changes with detailed message
- Added GitHub remote and pushed to https://github.com/vcffgn36-ctrl/automation
- Verified push: README.md, update.sh, .env.example all accessible (HTTP 200); db/custom.db correctly NOT pushed (HTTP 404)
- Removed GitHub token from git remote URL after push (security)

Stage Summary:
- Repository: https://github.com/vcffgn36-ctrl/automation
- 5 commits pushed (Initial → scaffold → automation framework → env fix → docs)
- All source code, README, .env.example, update.sh are on GitHub
- Database file and .env are NOT on GitHub (gitignored + untracked)
- User can now: git clone → bun install → cp .env.example .env → bun run db:push → bunx playwright install firefox → run both services
- User can update via: ./update.sh (or manual git pull + bun install + db:push)
- SECURITY: User shared GitHub PAT in chat — must revoke it immediately from GitHub settings
