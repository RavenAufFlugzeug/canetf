# CanETF Selector
# Development Log


---

# Day 1
## Environment Setup + Frontend Foundation


Date:

July 13, 2026


---

# Created Next.js Application


Command:


npx create-next-app@latest canetf


Configuration:


TypeScript:

Enabled


ESLint:

Enabled


Tailwind:

Enabled


App Router:

Enabled


---

# First Successful Run


Command:


npm run dev


Result:


Application available at:


http://localhost:3000


Milestone:

Next.js application running.


---

# Built Landing Page


Modified:


app/page.tsx


Created:


- CanETF title
- Product description
- Call-to-action button


Learned:


- JSX
- React components
- Tailwind styling


---

# Created Navbar Component


Created:


components/Navbar.tsx


Learned:


- Component reuse
- Importing components


---

# Created Onboarding Prototype


Created:


app/onboarding/page.tsx


Purpose:


Begin investor questionnaire.


Implemented:


- Card layout
- Account selection


---

# Created Quiz Engine


Created:


components/OnboardingQuiz.tsx


Implemented:


- React state
- Step navigation
- Dynamic rendering


---

# Created Question Data File


Created:


lib/questions.ts


Purpose:


Separate questionnaire data from UI.


---

# Bug Fixed


Problem:


option variable unavailable outside map function.


Cause:


Variable scope issue.


Solution:


Created selectAnswer() function.


---

# Features Completed


✅ Next.js setup

✅ Tailwind setup

✅ Landing page

✅ Navbar

✅ Routing

✅ Questionnaire component

✅ Dynamic questions

✅ Answer storage

✅ Progress bar

✅ Back/Next navigation


---

# Lessons Learned


React:

- Components
- State
- Props
- Event handling


Next.js:

- File routing
- App Router


TypeScript:

- Data typing


---

# Day 2
## Onboarding Pages


Date:

July 20, 2026


---

# Updated Onboarding


Modified:


- components/OnboardingQuiz.tsx (questionnaire flow)
- lib/questions.ts (questions)
- app/onboarding/page.tsx, app/page.tsx, app/layout.tsx
- components/Navbar.tsx


Created:


app/login/page.tsx (first version)


---

# Day 3
## Data Pipeline + Database


Date:

October 3, 2026


---

# Created Data Pipeline


Created:


- StockUtils.py (yfinance helpers: quotes, company info, price history)
- Database.ipynb (build the database)
- UpdateDatabase.ipynb (update it)
- stocks.db (SQLite)


Location at the time:

app/Search/ (moved to search/ on Day 4)


---

# Day 4
## User Accounts + Companies Page


Date:

October 5, 2026


---

# Created User Accounts


Implemented:


- Sign up, log in, log out (username + password)
- Passwords hashed with scrypt
- Database-backed sessions: the cookie holds a random token, the database stores only its hash
- /account page with the saved investor profile
- /account/password page (changing the password signs out other devices)
- Onboarding answers saved to the account and validated on the server


Database:

data/app.db (git-ignored), separate from stocks.db


---

# Reorganized Data Pipeline


- Moved app/Search to search/ (out of the Next.js app router)
- Shared database path: CANETF_DB_PATH
- update.py for scheduled runs
- requirements.txt and a project virtual environment (.venv)


---

# Created Companies Page


/companies read search/stocks.db through node:sqlite (replaced by the Watch List on Day 6)


---

# Repo Cleanup


- Stopped tracking stocks.db, __pycache__ and the API key/token files
- Spec updated for Linux Mint, versions and venv setup


---

# Day 5
## Company Lookup Page


Date:

October 7, 2026


---

# Created Company Lookup (/company, later /search)


Implemented:


- Symbol search with a dropdown (prefix match: "A" finds AAPL, AMZN)
- Price chart in SVG: 1D, 5D, 1M, 6M, YTD, 1Y
- Hover crosshair and tooltip; previous-close line with its own tooltip
- Key stats table: previous close, open, day's range, 52-week range, volume, average volume
- Company viewer moved off the account page into its own page


Data pipeline:


- intraday table: 5-minute bars for the last 5 trading days (for 1D and 5D)
- Average volume stored with each quote


---

# Added Animations


- Line reshapes between time ranges; change figures count to the new values
- Tooltips glide with the pointer and travel between the price line and the previous-close line
- Dropdown opens with options appearing one at a time
- Chart draws itself in when a company is chosen
- All animations off when the system asks for reduced motion


---

# Bugs Fixed


Problem:

Search dropdown never showed results.

Cause:

node:sqlite rows have a null prototype; React can't send them to the browser.

Solution:

Copy rows into plain objects ({ ...row }).


Problem:

Two elements with the same React key (picker and company section both keyed by symbol).

Solution:

Distinct prefixes: picker-AMZN, company-AMZN.


Problem:

npm run build failed: "Cannot find module 'node:sqlite'".

Cause:

node_modules out of date (@types/node 20 installed, lockfile says 24).

Solution:

Reinstall from the lockfile.


Problem:

New animations didn't show in the browser.

Cause:

Running next build next to next dev left the dev server serving an old globals.css.

Solution:

Edit and save globals.css (or restart npm run dev).


---

# Day 6
## ETFs, Watch List, Scheduled Updates


Date:

October 9, 2026


---

# Cleaned Up the Database Schema


- quotes keeps one row per company with only price and average volume;
  open, day's range, volume and previous close come from prices
- Found that the stored previous close disagreed with Yahoo; the change % is now
  computed from daily prices (AAPL: +0.84% → correct +0.91%)
- Bid/ask removed
- Old databases are migrated automatically (init_db)


---

# Scheduled Hourly Updates


- Windows Task Scheduler task "CanETF hourly update" runs update.py (no window)
- Output appended to search/update.log


---

# Added ETF Data


- 120 Canadian ETFs (search/etfs.py), chosen from 154 candidates checked on Yahoo
- etf_breakdown table: top 10 holdings, or credit ratings for bond funds
- Search page shows an ETF's composition: pie chart + list with hover tooltips
- The companies the ETFs hold (201, search/holding_companies.py) and the funds held
  by funds (100 more) added: about 426 companies and ETFs in total
- New holdings are added automatically by the hourly update (holding_symbols table)


---

# Created Watch List


- /companies became /watchlist: each user's own list, empty by default
- Add with the symbol search; remove with a button
- Rows unfold in with a highlight when added and fold away when removed


---

# Other Changes


- Company lookup renamed Search (/search); old links redirect
- Page-to-page transitions (React ViewTransition)
- Prices quoted in pence (London) shown in pounds; yen/won without decimals
- Technical documentation: docs/TECHNICAL.md


---

# Bugs Fixed


Problem:

Hourly update failed for 53 of 326 companies.

Cause:

Yahoo rate limit ("Too Many Requests"); each company cost 6-10 requests.

Solution:

Prices every hour (2 requests each); profile and composition once a day, at most
60 per run; short pause between companies; failed ones retried after a minute.


Problem:

Watch list names re-wrapped (3 lines → 2, 4 → 7) when returning to the page or adding a company.

Cause:

A vertical scrollbar flickered in the table card during the row animation, and
column widths followed the content.

Solution:

Card never scrolls vertically; fixed column widths.


Problem:

Remove button pushed against the card edge with many rows.

Cause:

overflow: hidden let the table squeeze that column below its content.

Solution:

overflow: clip.


---

# Lessons Learned


Data:

- Yahoo Finance via yfinance is free but unofficial: fields go missing and it rate-limits
- Holdings tickers don't always match Yahoo's (TRP.PR.D is TRP-PD.TO; TD is TD.TO)
- Store each fact once; derive the rest


Next.js / React:

- Server actions and client components need plain objects
- Keys must be unique among siblings
- Don't run next build alongside next dev


CSS:

- A transform on a table row changes column widths
- A scrollbar appearing takes width and makes text re-wrap


---

# Next Development Session


Goals:


- Recommendation engine: investor profile → ETF portfolio (Module 2)
- Monthly contribution engine (Module 3)
