# Browser Automation Framework

إطار عمل لأتمتة المتصفحات باستخدام **Playwright Firefox** + **Next.js 16**.
سجّل دخولك لأي موقع تلقائياً ونفّذ قائمة مهام (clicks, fills, screenshots, extractions…) —
كل موقع له "Profile" خاص يعرّف خطوات الـ login والمهام اللي بعدها.

A reusable browser-automation framework built with **Playwright Firefox** + **Next.js 16**.
Automatically log into any website and execute a list of tasks (clicks, fills, screenshots,
extractions…). Each website is described by a "Profile" that defines its login recipe and
post-login task list.

---

## ⚡ Quick Start — نسخة سريعة

```bash
# 1. استنساخ
git clone https://github.com/vcffgn36-ctrl/automation.git
cd automation

# 2. تثبيت الاعتماديات
bun install

# 3. إعداد البيئة + قاعدة البيانات
cp .env.example .env
mkdir -p db && bun run db:push

# 4. تثبيت متصفح Firefox + اعتماديات الـ mini-service
bunx playwright install firefox
cd mini-services/automation-service && bun install && cd ../..

# 5. شغّل خدمتين (في طرفيتين منفصلتين)
#    الطرفية 1:
cd mini-services/automation-service && bun run dev
#    الطرفية 2:
bun run dev

# 6. افتح http://localhost:3000
```

**للتحديث لاحقاً (لما يصدر update على GitHub):**

```bash
./update.sh
```

> التفاصيل الكاملة في الأقسام أدناه.

---

## المحتويات / Table of Contents

- [نظرة عامة / Overview](#نظرة-عامة--overview)
- [المعمارية / Architecture](#المعمارية--architecture)
- [المتطلبات / Prerequisites](#المتطلبات--prerequisites)
- [الاستنساخ والتشغيل / Clone & Run](#الاستنساخ-والتشغيل--clone--run)
- [التشغيل في وضع التطوير / Development Mode](#التشغيل-في-وضع-التطوير--development-mode)
- [الاستخدام / Usage](#الاستخدام--usage)
- [أنواع المهام / Task Types](#أنواع-المهام--task-types)
- [البروكسي و Tor / Proxy & Tor](#البروكسي-و-tor--proxy--tor)
- [التحديث / Updating the Project](#التحديث--updating-the-project)
- [استكشاف الأخطاء / Troubleshooting](#استكشاف-الأخطاء--troubleshooting)
- [الأمان / Security Notes](#الأمان--security-notes)

---

## نظرة عامة / Overview

| المكوّن | الوصف |
|---|---|
| **Dashboard** (Next.js, port 3000) | واجهة ويب لإدارة البروفايلات والمهام ومشاهدة الـ runs مباشرة |
| **Automation Service** (port 3003) | خدمة Playwright Firefox + socket.io تشغّل الـ automation وتبث الأحداث لحظياً |
| **Database** (SQLite) | تخزين البروفايلات والمهام وسجل الـ runs وجلسات الـ login المحفوظة |

### المميزات

- ✅ تسجيل دخول تلقائي لأي موقع (تحتاج فقط selectors الـ form)
- ✅ 11 نوع task: `navigate`, `click`, `fill`, `press`, `wait`, `wait_for_selector`, `screenshot`, `extract`, `scroll`, `select`, `evaluate`
- ✅ حفظ جلسة الـ login (cookies + storage) وإعادة استخدامها في الـ runs القادمة
- ✅ Logs مباشرة + screenshots + extracted text في الـ Run Viewer
- ✅ دعم البروكسي (HTTP/SOCKS5) لكل بروفايل على حدة — قابل لربط Tor خارجياً
- ✅ إعادة ترتيب المهام بالـ drag-and-drop
- ✅ تصميم متجاوب + دعم الوضع الليلي

---

## المعمارية / Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  المتصفح (Browser)                                          │
│  └── http://localhost:3000  (Next.js Dashboard)             │
│       ├── صفحة البروفايلات                                   │
│       ├── Profile Editor Dialog                             │
│       └── Run Viewer Dialog ◄── socket.io ◄──┐              │
│                                              │              │
└──────────────────────────────────────────────┼──────────────┘
                                               │
┌──────────────────────────────────────────────┼──────────────┐
│  Automation Service (port 3003)              │              │
│  ├── Hono HTTP: POST /run, GET /health       │              │
│  ├── socket.io: log/screenshot/extract/status┘              │
│  └── Playwright Firefox engine                              │
│       ├── Login flow (fill username/password + submit)      │
│       ├── Task execution (11 types)                         │
│       └── Session state capture                             │
└──────────────────────────────────────────────┬──────────────┘
                                               │ POST callback
┌──────────────────────────────────────────────┼──────────────┐
│  Next.js API Routes (port 3000)              │              │
│  ├── /api/profiles (GET, POST)               │              │
│  ├── /api/profiles/[id] (GET, PUT, DELETE)   │              │
│  ├── /api/profiles/[id]/run (POST) ──────────┼──► dispatch  │
│  ├── /api/runs (GET)                         │              │
│  ├── /api/runs/[id] (GET)                    │              │
│  └── /api/runs/[id]/complete (POST) ◄────────┘  callback    │
└─────────────────────────────────────────────────────────────┘
                                               │
┌──────────────────────────────────────────────┴──────────────┐
│  SQLite Database (db/custom.db)                              │
│  ├── Profile (site + selectors + credentials + session)     │
│  ├── Task (one step in the pipeline)                        │
│  └── Run (execution record + logs + screenshots)            │
└─────────────────────────────────────────────────────────────┘
```

---

## المتطلبات / Prerequisites

| الأداة | الإصدار | طريقة التثبيت |
|---|---|---|
| **Node.js** | ≥ 20 | https://nodejs.org |
| **Bun** | ≥ 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| **Git** | أي إصدار حديث | https://git-scm.com |
| **Playwright Firefox** | يُثبّت تلقائياً | `bunx playwright install firefox` |

### أنظمة التشغيل المدعومة

- ✅ Linux (Ubuntu/Debian, Fedora, Arch)
- ✅ macOS (Intel + Apple Silicon)
- ✅ Windows (عبر WSL2 موصى به؛ أو Git Bash + native node)

---

## الاستنساخ والتشغيل / Clone & Run

### 1. استنساخ المستودع

```bash
git clone https://github.com/vcffgn36-ctrl/automation.git
cd automation
```

### 2. تثبيت اعتماديات المشروع الرئيسي

```bash
bun install
```

### 3. إعداد ملف البيئة

```bash
cp .env.example .env
```

افتح `.env` وتأكد إنه يحتوي على:

```
DATABASE_URL="file:./db/custom.db"
```

> **مهم**: المسار يجب أن يكون **نسبياً** (`./db/custom.db`) وليس مطلقاً.
> هذا يضمن عمل المشروع على أي جهاز بغض النظر عن مكانه.

### 4. إنشاء قاعدة البيانات

```bash
mkdir -p db
bun run db:push
```

هذا الأمر يُنشئ ملف `db/custom.db` ويُنشئ الجداول تلقائياً.

### 5. تثبيت متصفح Playwright Firefox

```bash
bunx playwright install firefox
```

> قد يحتاج Linux لتثبيت اعتماديات النظام:
> ```bash
> bunx playwright install-deps firefox
> ```

### 6. تثبيت اعتماديات الـ automation mini-service

```bash
cd mini-services/automation-service
bun install
cd ../..
```

### 7. تشغيل المشروع

تحتاج لتشغيل **خدمتين في نفس الوقت** في طرفيتين مختلفتين:

**الطرفية 1 — الـ Automation Mini-service:**

```bash
cd mini-services/automation-service
bun run dev
```

ستظهر رسالة:

```
[automation-service] HTTP + WebSocket listening on http://0.0.0.0:3003
```

**الطرفية 2 — الـ Next.js Dashboard:**

```bash
bun run dev
```

ستظهر رسالة:

```
▲ Next.js 16.x
- Local: http://localhost:3000
✓ Ready in xxxms
```

### 8. فتح الـ Dashboard

افتح المتصفح على: **http://localhost:3000**

---

## التشغيل في وضع التطوير / Development Mode

للتطوير المريح، استخدم الأوامر التالية:

### تشغيل الخدمتين معاً (اختياري)

إذا أردت تشغيل كلتا الخدمتين بأمر واحد، استخدم `concurrently`:

```bash
bun add -d concurrently
```

ثم أضف لـ `package.json`:

```json
"scripts": {
  "dev:all": "concurrently \"bun run dev\" \"cd mini-services/automation-service && bun run dev\""
}
```

ثم:

```bash
bun run dev:all
```

### فحص جودة الكود

```bash
bun run lint
```

### إعادة تعيين قاعدة البيانات (احذر!)

```bash
bun run db:reset
```

> هذا يحذف كل البيانات (البروفايلات، المهام، الـ runs).

---

## الاستخدام / Usage

### إنشاء بروفايل جديد

1. اضغط زر **"New Profile"** في أعلى اليمين
2. املأ الحقول:
   - **Site URL**: الموقع الرئيسي (للعرض فقط)
   - **Login URL**: صفحة تسجيل الدخول الكاملة
   - **Login form selectors**: CSS selectors لحقول username/password وزرار الـ submit
   - **Credentials**: اسم المستخدم وكلمة المرور
3. (اختياري) فعّل البروكسي واملأ تفاصيله
4. أضف المهام التي تريد تنفيذها بعد الـ login
5. اضغط **"Create profile"**

### إيجاد CSS Selectors

1. افتح صفحة الـ login في متصفحك العادي
2. اضغط يمين على حقل الـ username → **Inspect**
3. في الـ DevTools، اضغط يمين على العنصر → **Copy → Copy selector**
4. الصقها في الحقل المناسب

أمثلة شائعة:

| الحقل | Selector محتمل |
|---|---|
| Username | `input[type='email']` أو `input[name='username']` أو `#email` |
| Password | `input[type='password']` |
| Submit | `button[type='submit']` أو `button.login-btn` أو `#login-button` |

### Selectors جاهزة لمواقع شائعة

#### Microsoft / Outlook.com (login.live.com)

> **مهم**: Microsoft بتستخدم **multi-step login** — الإيميل الأول، وبعدين الباسورد بيظهر في صفحة تانية. لازم تختار **Login flow mode: Multi-step**.

| الحقل | القيمة |
|---|---|
| Login URL | `https://login.live.com/` |
| Login flow mode | `Multi-step (email → Next → password → Sign in)` |
| Username selector | `input#usernameEntry` |
| Password selector | `input#passwordEntry` |
| Submit button selector | `button[type="submit"]` |

> تم اختبار هذه الإعدادات فعلياً وشغالة 100% — تسجيل دخول ناجح + screenshot للـ inbox.
> ملاحظة: Microsoft قد تغيّر الـ selectors مستقبلاً. لو فشل الـ login، استخدم سكريبت الفحص في قسم استكشاف الأخطاء.

#### Microsoft 365 / Business (login.microsoftonline.com)

> **مهم**: لما بتسجل دخول بحساب شخصي (outlook.com) على login.microsoftonline.com، Microsoft بتعمل redirect تلقائياً لـ login.live.com. الـ engine الجديد ذكي بما يكشف الـ selectors الصحيحة في الحالتين تلقائياً.

| الحقل | القيمة |
|---|---|
| Login URL | `https://login.microsoftonline.com/` |
| Login flow mode | `Multi-step` |
| Username selector | `input#i0116` |
| Password selector | `input#passwordEntry` |
| Submit button selector | `button[type="submit"]` |

> **لا تستخدم OAuth URLs الطويلة!** استخدم بس `https://login.microsoftonline.com/` — لو حطيت URL طويل فيه `state` و `client_id`، الـ state بيخلص بسرعة والـ run هيفشل.
>
> تم اختبار هذه الإعدادات فعلياً وشغالة 100% مع حساب outlook.com شخصي.
> الـ engine بيستخدم "smart selectors" — لو الـ selector اللي حددته ما وجدش عنصر، بيجرّب fallbacks تلقائياً (`#idSIButton9`, `input#usernameEntry`, إلخ).

### تشغيل البروفايل

1. اضغط زر **Run** على كارت البروفايل
2. سيفتح **Run Viewer Dialog** تلقائياً
3. ستشاهد:
   - **Live Log** (يسار): logs لحظية ملوّنة حسب المستوى
   - **Screenshots & Extracts** (يمين): صور وبيانات مستخرجة
4. عند انتهاء الـ run، يظهر banner يوضح النجاح/الفشل

### إعادة مشاهدة run قديم

في جدول **Recent Runs** بالأسفل، اضغط على أي row لفتح الـ Run Viewer ببيانات الـ run المحفوظة.

---

## أنواع المهام / Task Types

| النوع | الوصف | يحتاج selector؟ | يحتاج value؟ |
|---|---|---|---|
| `navigate` | اذهب إلى URL | ❌ | ✅ (URL) |
| `click` | اضغط على عنصر | ✅ | ❌ |
| `fill` | اكتب نص في حقل | ✅ | ✅ (النص) |
| `press` | اضغط زرار كيبورد | اختياري | ✅ (الزرار) |
| `wait` | انتظر N ملي ثانية | ❌ | ✅ (ms) |
| `wait_for_selector` | انتظر ظهور عنصر | ✅ | ❌ |
| `screenshot` | التقاط صورة كاملة للصفحة | ❌ | ❌ |
| `extract` | استخراج نص من عنصر | ✅ | ❌ |
| `scroll` | تمرير الصفحة لأسفل N بكسل | ❌ | ✅ (px) |
| `select` | اختيار option في `<select>` | ✅ | ✅ (قيمة option) |
| `evaluate` | تنفيذ JavaScript في الصفحة | ❌ | ✅ (كود JS) |

### مثال: سحب بيانات من صفحة بعد الـ login

```
1. navigate      value: https://example.com/dashboard
2. wait_for_selector  selector: .data-table  timeoutMs: 10000
3. screenshot    (التقاط صورة للصفحة)
4. extract       selector: .user-name  (استخراج اسم المستخدم)
5. extract       selector: .balance    (استخراج الرصيد)
6. navigate      value: https://example.com/logout
```

---

## البروكسي و Tor / Proxy & Tor

### استخدام بروكسي عادي

في الـ Profile Editor، فعّل **"Proxy (optional)"** واملأ:

- **Proxy server**: `http://host:port` أو `socks5://host:port`
- **Username** / **Password** (اختياري للـ authenticated proxies)

### استخدام Tor

الـ sandbox ما عندهاش sudo لتثبيت Tor، لكن على جهازك تستطيع:

**1. ثبّت Tor:**

```bash
# Linux
sudo apt install tor          # Debian/Ubuntu
sudo dnf install tor          # Fedora

# macOS
brew install tor
```

**2. شغّل Tor daemon:**

```bash
sudo systemctl start tor      # Linux
brew services start tor       # macOS
```

Tor سيعمل كـ SOCKS5 proxy على `127.0.0.1:9050`.

**3. في الـ Profile Editor:**

- Proxy server: `socks5://127.0.0.1:9050`
- اترك Username/Password فارغين

> **ملاحظة**: Tor يبطّئ التصفح بشكل ملحوظ. استخدمه فقط عند الحاجة.
> مواقع كثيرة تحجب exit nodes الخاصة بـ Tor.

---

## التحديث / Updating the Project

عندما يصدر تحديث للمشروع على GitHub، هكذا تحدّث نسختك المحلية:

### 1. احتفظ بنسخة احتياطية من بياناتك (موصى به)

```bash
cp db/custom.db db/custom.db.backup
```

> قاعدة البيانات تحتوي بياناتك (البروفايلات + كلمات المرور). لا تفرّط فيها.

### 2. اسحب آخر تحديثات

```bash
git fetch origin
git pull origin main
```

إذا عدّلت على الكود محلياً وحدث تعارض:

```bash
git stash              # احفظ تعديلاتك مؤقتاً
git pull origin main   # اسحب التحديثات
git stash pop          # استرجع تعديلاتك
```

### 3. حدّث الاعتماديات

```bash
bun install
cd mini-services/automation-service && bun install && cd ../..
```

### 4. حدّث قاعدة البيانات (إذا تغيّرت الـ schema)

```bash
bun run db:push
```

> Prisma سيحافظ على بياناتك الموجودة ويضيف الأعمدة الجديدة فقط.

### 5. حدّث متصفح Playwright (إذا صدر إصدار جديد)

```bash
bunx playwright install firefox
```

### 6. أعد تشغيل الخدمتين

أوقف الخدمتين (Ctrl+C في كل طرفية) ثم أعد تشغيلهما:

```bash
# الطرفية 1
cd mini-services/automation-service && bun run dev

# الطرفية 2
bun run dev
```

### اختصار: سكريبت تحديث شامل (مرفق مع المشروع)

المشروع فيه ملف `update.sh` جاهز في جذر المستودع بيعمل كل الخطوات اللي فاتت تلقائياً:

```bash
./update.sh
```

> لو أول مرة تستخدمه عليه، أعطِه صلاحية التنفيذ:
> ```bash
> chmod +x update.sh
> ```

**ماذا يفعل السكريبت:**
1. يأخذ نسخة احتياطية من قاعدة البيانات (بـ timestamp)
2. يحفظ تعديلاتك المحلية (لو فيه) عبر `git stash`
3. يسحب آخر تحديثات من `origin/main`
4. يعيد تثبيت الاعتماديات (المشروع الرئيسي + الـ automation-service)
5. يحدّث Prisma schema (بيحافظ على بياناتك)
6. يحدّث متصفح Playwright Firefox
7. يسترجع تعديلاتك المحلية

بعد ما السكريبت يخلص، أعد تشغيل الخدمتين كما هو موضّح في الخطوة 6 فوق.

---

## استكشاف الأخطاء / Troubleshooting

### 1. `Error code 14: Unable to open the database file`

**السبب**: الـ `DATABASE_URL` في `.env` يشاور على مسار مطلق خاص بجهاز آخر.

**الحل**: عدّل `.env` ليستخدم مسار نسبي:

```
DATABASE_URL="file:./db/custom.db"
```

ثم:

```bash
mkdir -p db
bun run db:push
```

---

### 2. `EADDRINUSE: address already in use :::3000` أو `:::3003`

**السبب**: خدمة أخرى تستخدم نفس البورت.

**الحل**: ابحث عن الـ process واقتله:

```bash
# Linux/macOS
lsof -i :3000
kill -9 <PID>

lsof -i :3003
kill -9 <PID>
```

أو غيّر البورت في `package.json` (للـ Next.js) أو `mini-services/automation-service/index.ts` (للـ mini-service).

---

### 3. الـ Run Viewer ما يعرضش logs مباشرة

**السبب**: الـ automation-service مش شغّال، أو socket.io ما اتصلش.

**الحل**:

1. تأكد إن الـ automation-service شغّال على port 3003:

   ```bash
   curl http://localhost:3003/health
   # يجب أن يرجع: {"ok":true,"uptime":...,"runsBuffered":0}
   ```

2. افتح DevTools في المتصفح → Console → تأكد إن مفيش errors في الاتصال.

3. الـ socket.io client بيتصل عبر `/?XTransformPort=3003` — إذا كنت شغّال على جهازك بدون Caddy gateway، عدّل `src/lib/socket.ts`:

   ```ts
   socket = io('http://localhost:3003', {
     path: '/socket.io',
     // ...
   })
   ```

---

### 4. Playwright Firefox فشل في الإطلاق

**السبب**: اعتماديات النظام ناقصة على Linux.

**الحل**:

```bash
sudo bunx playwright install-deps firefox
```

أو يدوياً على Debian/Ubuntu:

```bash
sudo apt install -y libgtk-3-0 libasound2 libdbus-glib-1-2 \
  libx11-xcb1 libxcb-shm0 libegl1 libgl1 libnss3 libnspr4
```

---

### 5. الـ login بيفشل دايماً

**الأسباب المحتملة**:

- **Selectors غلط**: تأكد منها بـ Inspect في متصفحك.
- **CAPTCHA**: بعض المواقع تطلب CAPTCHA يصعب تخطّيه تلقائياً.
- **2FA**: الأتمتة لا تدعم 2FA تلقائياً (تحتاج تدخل بشري أو إعداد مسبق).
- **Cloudflare/Anti-bot**: المواقع المحمية بـ Cloudflare قد تكتشف الـ automation.
- **Login mode غلط**: لو الموقع بيستخدم multi-step login (Microsoft, Google, etc.) لازم تختار "Multi-step" في الـ Profile Editor.

**الحلول**:

- جرّب تشغيل الـ profile بـ `headless: false` لترى المتصفح وهو يعمل.
- استخدم بروكسي residential (مدفوع) لتجنّب الحظر.
- للمواقع الصعبة، استخدم `wait` بين الخطوات لإبطاء السرعة.

#### سكريبت فحص الـ selectors (لاكتشاف الـ selectors الصحيحة)

لو الـ selectors اللي في الـ README ما اشتغلتش (مواقع بتغيّر HTML بتاعها)، استخدم السكريبت ده عشان تكتشف الـ selectors الصحيحة بنفسك:

أنشئ ملف `inspect-login.ts` في مجلد `mini-services/automation-service/`:

```typescript
import { firefox } from 'playwright'

const LOGIN_URL = 'https://login.live.com/'  // ← غيّر ده للـ URL بتاعك
const USERNAME = 'your@email.com'             // ← غيّر ده
const USERNAME_SELECTOR = 'input#usernameEntry'  // ← غيّر ده للاختيار الأولي

const browser = await firefox.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
})
const page = await context.newPage()

console.log('=== Navigating ===')
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(2000)
console.log('URL:', page.url())
console.log('Title:', await page.title())

// Step 1: inspect email page
console.log('\n=== INPUT ELEMENTS ===')
const inputs1 = await page.$$eval('input', els => els.map(el => ({
  type: el.type, name: el.name || '', id: el.id || '',
  visible: (el as HTMLElement).offsetParent !== null,
})).filter(i => i.visible))
console.log(JSON.stringify(inputs1, null, 2))

console.log('\n=== BUTTONS ===')
const buttons1 = await page.$$eval('button, input[type="submit"]', els => els.map(el => ({
  tag: el.tagName.toLowerCase(), type: el.type || '', id: el.id || '',
  text: (el.textContent || el.value || '').trim().substring(0, 40),
  visible: (el as HTMLElement).offsetParent !== null,
})).filter(b => b.visible))
console.log(JSON.stringify(buttons1, null, 2))

// Step 2: try filling username and clicking Next
if (USERNAME_SELECTOR) {
  console.log('\n=== Filling username & clicking Next ===')
  await page.fill(USERNAME_SELECTOR, USERNAME).catch(e => console.log('fill failed:', e.message))
  await page.click('button[type="submit"]').catch(e => console.log('click failed:', e.message))
  await page.waitForTimeout(5000)

  console.log('URL after Next:', page.url())
  console.log('Title:', await page.title())

  // Inspect password page
  console.log('\n=== INPUT ELEMENTS (password page) ===')
  const inputs2 = await page.$$eval('input', els => els.map(el => ({
    type: el.type, name: el.name || '', id: el.id || '',
    visible: (el as HTMLElement).offsetParent !== null,
  })).filter(i => i.visible || i.type === 'password'))
  console.log(JSON.stringify(inputs2, null, 2))

  console.log('\n=== BUTTONS (password page) ===')
  const buttons2 = await page.$$eval('button, input[type="submit"]', els => els.map(el => ({
    tag: el.tagName.toLowerCase(), type: el.type || '', id: el.id || '',
    text: (el.textContent || el.value || '').trim().substring(0, 40),
    visible: (el as HTMLElement).offsetParent !== null,
  })).filter(b => b.visible))
  console.log(JSON.stringify(buttons2, null, 2))
}

await browser.close()
console.log('\n=== DONE ===')
```

ثم شغّله:

```bash
cd mini-services/automation-service
bun inspect-login.ts
```

هيُظهرلك كل الـ inputs والـ buttons الـ visible في صفحة الـ login (قبل وبعد الضغط على Next). من النتايج دي تقدر تحدد الـ selectors الصحيحة وتحدّث البروفايل بتاعك.

---

### 6. الـ runs بتعلّق في حالة "running"

**السبب**: الـ automation-service مات أثناء الـ run (مثلاً أغلقت الطرفية بالغلط).

**الحل**: نظّف الـ runs المعلّقة:

```bash
bun run db:reset  # يحذف كل شيء (احذر!)
```

أو يدوياً عبر سكريبت:

```bash
bun -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.run.updateMany({
  where: { status: 'running' },
  data: { status: 'failed', error: 'Service interrupted', finishedAt: new Date() }
}).then(r => console.log('Cleaned', r.count, 'stuck runs'))
  .finally(() => p.\$disconnect());
"
```

---

## الأمان / Security Notes

### ⚠️ تحذيرات مهمة

1. **كلمات المرور مخزّنة كنص عادي في SQLite** — هذا المشروع مصمم للاستخدام المحلي على جهازك الشخصي. لا ترفع `db/custom.db` إلى GitHub (هو في `.gitignore` بالفعل).

2. **لا تشارك GitHub tokens أبداً** — إذا شاركت token بالخطأ، احذفه فوراً من:
   GitHub → Settings → Developer settings → Personal access tokens → احذفه وأنشئ واحد جديد.

3. **الـ `evaluate` task ينفّذ JavaScript عشوائي** — لا تستخدمه مع كود من مصادر غير موثوقة.

4. **البروكسي المجاني خطر** — البروكسيات المجانية قد تسرق بياناتك أو تحقن إعلانات. استخدم بروكسيات مدفوعة موثوقة للأتمتة الجادة.

5. **احترم شروط استخدام المواقع** — بعض المواقع تمنع الأتمتة في ToS. تأكد قبل الأتمتة.

### تأمين إضافي (اختياري)

للتشفير عند الحاجة لتخزين كلمات المرور:

```bash
bun add bcryptjs
```

ثم عدّل `src/app/api/profiles/route.ts` لتشفير الـ password قبل الحفظ وفك التشفير عند الإرسال للـ mini-service.

---

## بنية المشروع / Project Structure

```
automation/
├── prisma/
│   └── schema.prisma           # Prisma schema (Profile, Task, Run models)
├── db/
│   └── custom.db               # SQLite database (gitignored)
├── src/
│   ├── app/
│   │   ├── api/                # REST API routes
│   │   │   ├── profiles/       # GET, POST, PUT, DELETE profiles
│   │   │   └── runs/           # GET runs, GET run, POST complete callback
│   │   ├── page.tsx            # Dashboard page
│   │   ├── layout.tsx          # Root layout with providers
│   │   └── globals.css
│   ├── components/
│   │   ├── automation/         # Dashboard components
│   │   │   ├── profile-card.tsx
│   │   │   ├── profile-form-dialog.tsx
│   │   │   ├── task-builder.tsx
│   │   │   ├── run-viewer-dialog.tsx
│   │   │   ├── stat-card.tsx
│   │   │   ├── recent-runs-table.tsx
│   │   │   └── empty-state.tsx
│   │   ├── ui/                 # shadcn/ui components
│   │   └── providers.tsx       # React Query provider
│   ├── hooks/
│   │   └── use-automation.ts   # React Query hooks
│   └── lib/
│       ├── automation-types.ts # Shared TypeScript types
│       ├── db.ts               # Prisma client
│       ├── socket.ts           # socket.io client singleton
│       └── utils.ts
├── mini-services/
│   └── automation-service/     # Playwright Firefox + socket.io engine
│       ├── index.ts            # Main service file
│       └── package.json
├── .env.example                # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── README.md                   # This file
```

---

## الترخيص / License

هذا المشروع مفتوح المصدر للاستخدام الشخصي والتعليمي.

---

## المساهمة / Contributing

المساهمات مرحب بها! افتح issue أو pull request على:
https://github.com/vcffgn36-ctrl/automation

---

**آخر تحديث**: يوليو 2025
