#!/bin/bash
# Watchdog: keeps Next.js (port 3000) and automation-service (port 3003) alive.
# The sandbox process reaper kills long-running processes after ~30-60s, so we
# restart them whenever they disappear.

cd /home/z/my-project

LOG_NEXT=/tmp/nextjs_wd.log
LOG_AUTO=/tmp/automation_wd.log

start_next() {
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 1
  setsid bash -c 'NODE_OPTIONS="--max-old-space-size=768" /home/z/my-project/node_modules/.bin/next dev --webpack -p 3000 > '"$LOG_NEXT"' 2>&1' < /dev/null > /dev/null 2>&1 &
  disown
  echo "[$(date)] started next dev (pid $!)"
}

start_auto() {
  pkill -9 -f "automation-service/index.ts" 2>/dev/null
  sleep 1
  setsid bash -c 'cd /home/z/my-project/mini-services/automation-service && bun --hot index.ts > '"$LOG_AUTO"' 2>&1' < /dev/null > /dev/null 2>&1 &
  disown
  echo "[$(date)] started automation-service (pid $!)"
}

# Initial start.
start_next
start_auto
sleep 12  # give them time to boot

while true; do
  # Check Next.js
  if ! curl -s -o /dev/null -m 3 http://localhost:3000/ 2>/dev/null; then
    echo "[$(date)] Next.js not responding — restarting..."
    start_next
    sleep 10
  fi
  # Check automation-service
  if ! curl -s -o /dev/null -m 3 http://localhost:3003/health 2>/dev/null; then
    echo "[$(date)] automation-service not responding — restarting..."
    start_auto
    sleep 5
  fi
  sleep 10
done
