#!/bin/bash
# update.sh — Pull latest updates from GitHub and refresh local environment.
# Run this whenever the project is updated on GitHub.
#
# Usage:
#   ./update.sh
#
# What it does:
#   1. Backs up your local database (db/custom.db → db/custom.db.backup)
#   2. Stashes any uncommitted local changes
#   3. Pulls latest from origin/main
#   4. Re-installs dependencies (main project + automation-service)
#   5. Updates Prisma schema (preserves your data)
#   6. Updates Playwright Firefox browser
#   7. Restores your stashed changes (if any)
#
# After running, restart both dev servers:
#   Terminal 1: cd mini-services/automation-service && bun run dev
#   Terminal 2: bun run dev

set -e

cd "$(dirname "$0")"

echo "========================================"
echo "  Automation Framework — Update Script"
echo "========================================"
echo ""

# 1. Backup database
if [ -f "db/custom.db" ]; then
  echo "→ [1/6] Backing up database..."
  cp db/custom.db "db/custom.db.backup.$(date +%Y%m%d%H%M%S)"
  echo "  ✓ Database backed up to db/"
else
  echo "→ [1/6] No database found (skipping backup)"
fi
echo ""

# 2. Stash local changes
HAS_CHANGES=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  HAS_CHANGES=true
  echo "→ [2/6] Stashing local changes..."
  git stash push -m "auto-stash before update $(date +%Y%m%d%H%M%S)"
  echo "  ✓ Changes stashed"
else
  echo "→ [2/6] No local changes to stash"
fi
echo ""

# 3. Pull updates
echo "→ [3/6] Pulling latest updates from origin/main..."
git fetch origin
git pull origin main
echo "  ✓ Updates pulled"
echo ""

# 4. Install dependencies
echo "→ [4/6] Installing dependencies..."
echo "  - Main project..."
bun install
echo "  - Automation service..."
cd mini-services/automation-service
bun install
cd ../..
echo "  ✓ Dependencies installed"
echo ""

# 5. Update database schema (preserves data)
echo "→ [5/6] Updating database schema..."
bun run db:push
echo "  ✓ Schema updated"
echo ""

# 6. Update Playwright Firefox
echo "→ [6/6] Updating Playwright Firefox..."
bunx playwright install firefox 2>/dev/null || echo "  (skipped — already up to date)"
echo ""

# 7. Restore stashed changes
if [ "$HAS_CHANGES" = true ]; then
  echo "→ Restoring local changes..."
  git stash pop || echo "  ⚠ Could not auto-restore — run 'git stash list' to see your stashes"
fi
echo ""

echo "========================================"
echo "  ✓ Update complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Restart the automation service:"
echo "     cd mini-services/automation-service && bun run dev"
echo ""
echo "  2. In a new terminal, restart the dashboard:"
echo "     bun run dev"
echo ""
echo "  3. Open http://localhost:3000 in your browser"
echo ""
