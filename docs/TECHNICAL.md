# CanETF — Technical Documentation

How the project is put together, how to set it up and run it, and what to watch out for.
For what the product is meant to do, see [CanETF_Product_Specification.md](CanETF_Product_Specification.md).

**Contents**

1. [Overview](#1-overview)
2. [Requirements](#2-requirements)
3. [Setup](#3-setup)
4. [Running](#4-running)
5. [Scheduled updates](#5-scheduled-updates)
6. [Project structure](#6-project-structure)
7. [Databases](#7-databases)
8. [Data pipeline](#8-data-pipeline)
9. [Website](#9-website)
10. [Configuration](#10-configuration)
11. [Things to be aware of](#11-things-to-be-aware-of)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

CanETF has two parts that share one SQLite database file:

```
 Yahoo Finance ──(yfinance)──► Python pipeline (search/) ──writes──► search/stocks.db
                                                                          │
                                                          reads (read-only)
                                                                          ▼
                      Browser ◄────────── Next.js website (app/, components/, lib/)
                                                     │
                                          reads/writes data/app.db (accounts, watch lists)
```

- **Data pipeline** (`search/`, Python): downloads prices, company profiles and ETF
  compositions from Yahoo Finance with the `yfinance` library and stores them in
  `search/stocks.db`. Run by hand (notebooks) or every hour (scheduled task).
- **Website** (Next.js 16, React 19, Tailwind 4, TypeScript): reads `stocks.db` with Node's
  built-in `node:sqlite`, never writes to it. User accounts, sessions, questionnaire answers
  and watch lists live in a separate database, `data/app.db`, created automatically.

The database currently holds about 426 entries: 5 starting stocks, 120 Canadian ETFs
(`search/etfs.py`), the companies those ETFs hold (`search/holding_companies.py`), and the
funds/companies held by those funds (added automatically).

## 2. Requirements

| Tool | Version | Why |
|---|---|---|
| Node.js | **22.5 or newer** (developed on 24) | `node:sqlite` is built into Node from 22.5 |
| npm | comes with Node | installs the website's packages |
| Python | **3.12 or newer** (developed on 3.12 Linux / 3.14 Windows) | data pipeline |
| Python packages | `search/requirements.txt`: yfinance 1.7.x, pandas 3.x, ipykernel | pipeline + notebooks |
| VS Code (optional) | with the Jupyter extension | runs the `.ipynb` notebooks |

An internet connection is needed to build or update the database (Yahoo Finance).

## 3. Setup

### 3.1 Website

From the project root:

```bash
npm ci        # installs exactly what package-lock.json lists
```

Prefer `npm ci` over `npm install`: it keeps `node_modules` identical to the lockfile.
An out-of-date `node_modules` has broken the build before (see [§11](#11-things-to-be-aware-of)).

### 3.2 Python environment

Use a virtual environment in `.venv/` (it is git-ignored).

**Linux / macOS**

```bash
sudo apt install python3.12-venv            # Debian/Ubuntu/Mint, once
python3 -m venv .venv
.venv/bin/pip install -r search/requirements.txt
```

**Windows (PowerShell)**

```powershell
py -m venv .venv
.venv\Scripts\pip install -r search\requirements.txt
```

In VS Code, open a notebook in `search/`, click the kernel picker (top right) and choose `.venv`.
When adding a Python package, also add it to `search/requirements.txt`.

### 3.3 Build the database

The database file is not in git; each machine builds its own. Either run the cells of
`search/Database.ipynb` in order, or from the project root:

```bash
# Linux/macOS: .venv/bin/python   Windows: .venv\Scripts\python
.venv/bin/python -c "
import sys; sys.path.insert(0, 'search')
from StockUtils import build_database, add_missing_holdings
from etfs import ETFS
from holding_companies import HOLDING_COMPANIES
build_database(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'])
build_database(ETFS)                  # 120 ETFs, with their compositions
build_database(HOLDING_COMPANIES)     # the companies they hold
add_missing_holdings(limit=None)      # funds held by funds, and their holdings
"
```

A full build takes a few minutes. Run `add_missing_holdings(limit=None)` again until it adds
nothing (each fund it adds can bring new holdings).

`data/app.db` needs no setup: the website creates it on first use.

## 4. Running

### 4.1 Website

| Command | What it does |
|---|---|
| `npm run dev` | development server at http://localhost:3000, reloads on change |
| `npm run build` then `npm start` | production build and server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | type check |

Sign up at `/signup` to use the Watch List and Account pages.

### 4.2 Data pipeline

| How | What it does |
|---|---|
| `search/Database.ipynb` | builds the database (stocks, ETFs, held companies) |
| `search/UpdateDatabase.ipynb` | `list_companies()` (what's stored, how fresh) and `update_database()` |
| `python search/update.py` | one update run; exits with status 1 if any company failed |

Useful functions in `search/StockUtils.py` (import with `from StockUtils import *` inside `search/`):

| Function | Use |
|---|---|
| `build_database(symbols)` | add or fully refresh companies/ETFs (1 year of prices by default) |
| `update_database()` | refresh everything already stored (what the scheduled task runs) |
| `list_companies()` | table of stored companies and how fresh each is |
| `search_symbol("name")` | find a ticker on Yahoo by company name |
| `get_etf_breakdown("XIU.TO")` | an ETF's composition straight from Yahoo |
| `missing_holdings()` | ETF holdings that aren't in the database, and why |
| `add_missing_holdings(limit=None)` | add them now instead of 15 per update |

To add a company or ETF: `build_database(["TICKER"])`. TSX listings need `.TO`
(e.g. `XEQT.TO`). To make an ETF part of the standard set, add it to `search/etfs.py`.

## 5. Scheduled updates

`update_database()` should run every hour so prices stay current.

**Windows** — this machine has a Task Scheduler task named **CanETF hourly update** that runs
`update.py` with `pythonw.exe` (no window). Output is appended to `search/update.log`.

```powershell
# Create it (adjust the two paths)
$py  = "C:\path\to\python\pythonw.exe"
$dir = "C:\path\to\canetf\search"
$action   = New-ScheduledTaskAction -Execute $py -Argument "`"$dir\update.py`"" -WorkingDirectory $dir
$trigger  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 1)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "CanETF hourly update" -Action $action -Trigger $trigger -Settings $settings

Start-ScheduledTask   -TaskName "CanETF hourly update"   # run now
Disable-ScheduledTask -TaskName "CanETF hourly update"   # pause
Enable-ScheduledTask  -TaskName "CanETF hourly update"   # resume
Unregister-ScheduledTask -TaskName "CanETF hourly update" -Confirm:$false   # remove
```

The task runs only while the computer is on and you're logged in.

**Linux / macOS** — a cron entry (`crontab -e`):

```
0 * * * * cd /path/to/canetf && .venv/bin/python search/update.py >> search/update.log 2>&1
```

**What one run does** (about 3–4 minutes for ~430 entries):

1. Prices for every entry: new daily bars, the last 5 days of 5-minute bars, the latest price.
2. For up to 60 entries whose profile is more than 20 hours old: the profile (name, market
   cap, 52-week range, average volume) and, for ETFs, the composition.
3. Retries anything that failed once, after 60 seconds.
4. Adds up to 15 ETF holdings that aren't in the database yet.

Each line of `update.log` says what happened to one entry (`✓`, `✗`, `+` added,
`- ` no listing), and ends with `Done.` and any warnings (`⚠ No composition …`).

## 6. Project structure

```
app/                      Next.js App Router
  page.tsx                landing page
  search/page.tsx         company/ETF viewer: chart, key stats, ETF composition
  watchlist/page.tsx      per-user watch list
  account/                account info, investor profile, change password
  login/ signup/ onboarding/
  actions/                server actions: auth, profile, companies (search), watchlist
  template.tsx            page-to-page transition (React <ViewTransition>)
  layout.tsx, globals.css global layout, Tailwind, all animation CSS
components/
  CompanyPicker.tsx       symbol search with animated dropdown
  PriceChart.tsx          SVG price chart (1D … 1Y), hover, range morphing
  KeyStats.tsx            stats table under the chart
  EtfBreakdown.tsx        ETF pie chart + holdings list
  WatchlistTable.tsx      watch list table (add/remove animations)
  Navbar.tsx, AuthForm.tsx, ChangePasswordForm.tsx, OnboardingQuiz.tsx
lib/
  db.ts                   read-only access to stocks.db
  appDb.ts                app.db (accounts, sessions, profiles, watch lists) + schema
  session.ts, password.ts login sessions, scrypt password hashing
  money.ts                currency formatting
  questions.ts            onboarding questionnaire
search/                   Python data pipeline
  StockUtils.py           everything: fetching, schema, build/update
  update.py               one update run (used by the scheduled task)
  etfs.py                 the 120 ETFs
  holding_companies.py    companies held by those ETFs
  Database.ipynb          build the database
  UpdateDatabase.ipynb    inspect/update it
docs/                     product spec, development log, this document
next.config.ts            redirects, experimental view transitions
```

## 7. Databases

### 7.1 `search/stocks.db` (pipeline writes, website reads)

| Table | One row per | Columns |
|---|---|---|
| `companies` | company/ETF | `symbol` (PK), `name`, `sector`, `industry`, `currency`, `market_cap`, `pe_trailing`, `pe_forward`, `week52_high`, `week52_low`, `updated_at` (when the profile was last refreshed) |
| `quotes` | company (latest only) | `symbol` (PK), `fetched_at`, `price`, `avg_volume` |
| `prices` | company per trading day | `symbol`, `date`, `open`, `high`, `low`, `close`, `volume` |
| `intraday` | 5-minute bar, last 5 trading days | `symbol`, `ts` (exchange-local time with offset), `date`, OHLC, `volume` |
| `etf_breakdown` | ETF part | `etf`, `kind` (`holding` or `rating`), `rank`, `label`, `symbol`, `weight` (0–1) |
| `holding_symbols` | ETF holding ticker | `holding` (as the ETF lists it), `symbol` (where it's stored here, NULL = no listing), `checked_at` |

Design rules:

- No duplicated data: the day's open/high/low/volume and the previous close come from
  `prices`; `quotes` only holds what nothing else does.
- `init_db()` creates missing tables and migrates older layouts (e.g. the old `quotes`
  table with one row per run is rebuilt), so an old database keeps working.
- Each company is written all-or-nothing; a failed download leaves its old data in place.

### 7.2 `data/app.db` (website)

| Table | Contents |
|---|---|
| `users` | `username` (case-insensitive), scrypt `password_hash`, `created_at` |
| `sessions` | SHA-256 of the session token (never the token), `user_id`, `expires_at` (7 days) |
| `profiles` | latest questionnaire answers (JSON) per user |
| `watchlist` | `user_id`, `symbol`, `added_at` |

Created and migrated by `lib/appDb.ts` on first use. It holds real accounts: back it up,
never commit it.

## 8. Data pipeline

- **Source:** Yahoo Finance through `yfinance`, an unofficial library. Quote data is delayed.
- **Build vs update:** `build_database` downloads a full year and the profile; `update_database`
  downloads only what's missing (`choose_period`: 1d, 5d, 1mo… since the last stored day) and
  re-downloads a full year if the data is more than about a year old.
- **ETF composition** (`get_etf_breakdown`): Yahoo's **top 10 holdings** with weights. Bond
  funds usually have no holdings list, so their **split by credit rating** is stored instead.
  Funds of funds (XEQT, VGRO, …) list the ETFs they hold.
- **Holdings → companies** (`resolve_holding`): tickers in holdings lists don't always match
  Yahoo's. The rules: preferred shares use Yahoo's spelling (`TRP.PR.D` → `TRP-PD.TO`),
  Canadian companies use their TSX listing (`TD` → `TD.TO`), and a holding that is another
  listing or share class of a stored company maps to it (preferred shares → common shares,
  `GOOG` → `GOOGL`). The result is remembered in `holding_symbols`.
- **Rate limits:** Yahoo rejects bursts ("Too Many Requests"). The update keeps to about two
  requests per entry per hour; see the constants at the top of `StockUtils.py`
  (`PROFILES_PER_RUN`, `UPDATE_PAUSE_SECONDS`, `HOLDINGS_PER_RUN`, …) before raising load.

## 9. Website

### 9.1 Pages

| Route | Login | Contents |
|---|---|---|
| `/` | no | landing page |
| `/search?symbol=XIU.TO` | no | symbol search; chart (1D, 5D, 1M, 6M, YTD, 1Y), key stats, ETF composition |
| `/watchlist` | yes | add/remove companies and ETFs |
| `/account`, `/account/password` | yes | account info, investor profile, change password |
| `/login`, `/signup`, `/onboarding` | no | auth and questionnaire |

`/company` → `/search` and `/companies` → `/watchlist` redirect (`next.config.ts`).

### 9.2 How things work

- **Data access** is in `lib/db.ts` (server only). Pages are server components; interactive
  parts (`CompanyPicker`, `PriceChart`, `EtfBreakdown`, `WatchlistTable`) are client components.
- **Mutations** use server actions in `app/actions/` and call `refresh()` from `next/cache`.
- **Auth:** scrypt password hashes; a random session token in an httpOnly cookie, stored only
  as a SHA-256 hash; sessions last 7 days.
- **Prices in minor units** (London in pence `GBp`, also `ZAc`, `ILA`) are converted to the
  main unit in `lib/db.ts`, so the chart, stats and watch list all show e.g. £119.98.
- **Charts** are hand-written SVG (no chart library). 1D/5D times are the exchange's local time.
- **Animations** are CSS in `app/globals.css`; every one is turned off under
  `prefers-reduced-motion`. Page changes use React's `<ViewTransition>` (`app/template.tsx`).

## 10. Configuration

| Setting | Default | Where |
|---|---|---|
| `CANETF_DB_PATH` | `search/stocks.db` | used by both the pipeline and the website |
| `CANETF_APP_DB_PATH` | `data/app.db` | website |
| `experimental.viewTransition` | `true` | `next.config.ts` |
| Pipeline pacing | see top of `StockUtils.py` | `PROFILE_MAX_AGE`, `PROFILES_PER_RUN`, `HOLDINGS_PER_RUN`, `UPDATE_PAUSE_SECONDS` |

Secrets (API keys, tokens) go in `.env.local`, which is git-ignored, as are `docs/API.txt`
and `docs/Token.txt`.

## 11. Things to be aware of

**Data**

- **Yahoo Finance is unofficial and free.** Fields can be missing, data is delayed, and it
  rate-limits. Treat numbers as informational. A failed run keeps the previous data.
- **Composition is the top 10 only** for stock ETFs; the page says how much of the fund those
  cover. Global X "corporate class" ETFs (HXT, HXS, …) have no composition on Yahoo and were
  left out.
- **Some holdings can't be priced** (cash funds, some preferred shares); `missing_holdings()`
  lists them, and they're looked up again monthly.
- **Prices are in each listing's own currency** (USD, EUR, ¥, …); there is no conversion to CAD.
- **The 1D chart assumes a 6.5-hour session** (TSX/NYSE hours) when drawing a partial day.

**Development**

- **This is Next.js 16** with breaking changes from older versions. Read the guides in
  `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`).
- **`node:sqlite` rows have a null prototype.** Copy them into plain objects (`{ ...row }`)
  before passing them to a client component or returning them from a server action, or React
  throws "Only plain objects … can be passed to Client Components".
- **Don't run `next build` while `next dev` is running** in the same folder. It has left the
  dev server serving a stale `globals.css` (new CSS classes missing). Fix: make any real edit to
  `app/globals.css` and save, or restart `npm run dev`.
- **Keep `node_modules` in sync with the lockfile** (`npm ci`). An old `@types/node` made
  `npx tsc` / `next build` fail with "Cannot find module 'node:sqlite'".
- **Pause the scheduled task during big builds.** Two processes writing `stocks.db` at once can
  hit "database is locked". `Disable-ScheduledTask` / `Enable-ScheduledTask` (Windows) or
  comment out the cron line.
- **Windows consoles using a legacy code page (e.g. GBK)** can't print `✓`/`✗`. `update.py`
  copes; for other scripts set `PYTHONIOENCODING=utf-8`.
- **Tables and animations:** don't put a `transform` on a `<tr>` (it changes column widths), and
  keep table cards from scrolling vertically (`overflow-y-hidden`); both made text re-wrap. The
  watch list table uses fixed column widths for the same reason.
- **Keys must be unique among siblings** in React. Keyed siblings with the same value (e.g.
  two elements both keyed by a symbol) broke rendering on the Search page.
- **After renaming a route**, `.next/types` can keep a reference to the old page and `tsc`
  reports it; it clears on the next `npm run build` / `npm run dev`.
- **Existing lint errors** in `components/OnboardingQuiz.tsx` predate this work; `npm run lint`
  reports them.
- **Database files are git-ignored** (`*.db`, `data/`). Each developer builds their own
  `stocks.db`; `app.db` holds accounts and must never be committed.

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Search finds nothing / "No company with the symbol … in our database" | `stocks.db` not built, the symbol isn't stored, or `CANETF_DB_PATH` points elsewhere | build it ([§3.3](#33-build-the-database)), or `build_database(["SYMBOL"])` |
| `update.log` shows many `✗ … 'currency'` or "Too Many Requests" | Yahoo rate limit | wait; the next run retries. Don't lower the pacing constants |
| New CSS (animations, classes) not showing in dev | stale dev-server CSS | edit and save `app/globals.css`, or restart `npm run dev` |
| `Cannot find module 'node:sqlite'` | old `@types/node` or Node < 22.5 | `npm ci`; check `node -v` |
| "Only plain objects … Client Components" | passing a `node:sqlite` row to the client | copy it: `{ ...row }` |
| "database is locked" | two writers at once | pause the scheduled task while building |
| An ETF has no composition | Yahoo has none for it | check `get_etf_breakdown("SYMBOL")`; the update keeps any previous one |
| Login redirects back to `/login` | session expired (7 days) or `app.db` replaced | log in again |
