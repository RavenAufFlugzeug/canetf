# CanETF Selector
## Product Specification

Version:
0.1

Status:
Development

---

# 1. Product Overview

## Product Name

CanETF Selector

## Market

Canada

## Audience

Canadian retail investors seeking:

- Low-fee passive investing
- Hands-off portfolio management
- Simple ETF recommendations
- Automated contribution guidance

---

# 2. Product Vision

CanETF Selector converts investor goals into a simple investing action plan.

The user should never need to ask:

"What ETF should I buy?"

or

"How do I rebalance?"

The system answers:

- What portfolio should I own?
- How much should I contribute?
- What should I buy this month?
- When should I rebalance?

---

# 3. Product Roadmap

## Phase 1

Standalone web application.

Features:

- Investor onboarding
- ETF recommendation engine
- Monthly buy calculator
- Portfolio tracking
- Drift detection
- Rebalancing instructions


## Phase 2

Broker integration.

Potential integrations:

- Wealthsimple
- Questrade
- SnapTrade

Goal:

Fully automated investing.

---

# 4. Core Modules


# Module 1
## Investor Profiling


One-question-per-screen questionnaire.

Inputs:

## Account Type

- TFSA
- RRSP
- FHSA
- Non-Registered


## Investment Capital

- Initial investment
- Monthly contribution


## Time Horizon

- Short term
- Medium term
- Long term


## Risk

- Conservative
- Balanced
- Growth
- Aggressive


## Preferences

- ESG
- Fossil fuel exclusion
- Dividend focus


---

# Module 2

## ETF Recommendation Engine


The engine maps investor data into ETF portfolios.


Inputs:

- Risk
- Time horizon
- Capital
- Preferences
- Account type


Outputs:

- ETF portfolio
- Allocation percentages
- Monthly buy instructions


---

# Portfolio Routing Rules


## Small Portfolio

Condition:

Initial < $10,000

OR

Monthly contribution < $500


Strategy:

Single all-in-one ETF.


Examples:

Aggressive:

- VEQT
- XEQT


Growth:

- VGRO
- XGRO


---

## Large Portfolio

Condition:

Initial >= $10,000

AND

Monthly >= $500


Strategy:

Core-satellite portfolio.


---

# Module 3

## Monthly Contribution Engine


Purpose:

Generate exact purchase instructions.


Formula:


Monthly contribution × Target allocation


Output example:


Deposit:

$500


Buy:

$350 XEQT

$150 VAB


---

# Module 4

## Portfolio Health System


Tracks:

Current allocation

Target allocation


Drift formula:


|Actual allocation - Target allocation|


Threshold:

5%


---

# Rebalancing


## Method A

Cash-flow rebalancing.

Redirect new deposits toward underweight assets.


## Method B

Trade recommendation.

Generate:

Sell ETF A

Buy ETF B


---

# Dashboard


Components:

- Autopilot instruction card
- Allocation charts
- Portfolio health indicator
- Monthly action plan
- Export function


---

# Technical Architecture


Infrastructure:

- Linux Mint 22.3
- Git 2.43.0
- Tools installed directly on the host (no containers)


Frontend (package.json):

- Node.js 24.21.0
- npm 11.19.0
- Next.js 16.2.10
- React 19.2.4
- React DOM 19.2.4
- TypeScript 5.9.3
- Tailwind CSS 4.3.2 (@tailwindcss/postcss 4.3.2)
- ESLint 9.39.5 (eslint-config-next 16.2.10)
- @types/node 24.19.1
- @types/react 19.2.17
- @types/react-dom 19.2.3


Data pipeline (search/, search/requirements.txt):

- Python 3.12.3 (project virtual environment in .venv/)
- pip 26.2.1
- yfinance 1.7.0
- pandas 3.0.6
- ipykernel 7.4.0 (runs the .ipynb notebooks in VS Code)
- Jupyter notebooks + update.py script


Main packages installed with yfinance:

- numpy 2.5.3
- curl_cffi 0.16.3
- requests 2.34.2
- lxml 6.1.3
- beautifulsoup4 4.15.0
- protobuf 7.36.2
- websockets 17.2
- peewee 4.5.2


Database:

- SQLite (search/stocks.db), written by the data pipeline
- Read by Next.js server code through Node's built-in node:sqlite (lib/db.ts, SQLite 3.53.4)
- Python side uses the standard sqlite3 module (SQLite 3.45.1)
- Location shared through the CANETF_DB_PATH environment variable


Planned:

- FastAPI backend
- PostgreSQL database (replacing SQLite once the site is hosted)


---

# Development Setup


One-time system package (needed to create virtual environments):

    sudo apt install python3.12-venv


Website:

    npm install
    npm run dev


Create the Python virtual environment (first time, from the project root):

    python3 -m venv .venv
    .venv/bin/pip install -r search/requirements.txt


Enter the virtual environment:

    source .venv/bin/activate

The prompt now starts with (.venv), and python / pip use the project's packages.


Leave the virtual environment:

    deactivate


Run without entering it:

    .venv/bin/python search/update.py


Notebooks in VS Code:

- Open a .ipynb file in search/
- Click the kernel picker (top right)
- Choose .venv


Add a new Python package:

    source .venv/bin/activate
    pip install <package>

Then add it to search/requirements.txt.


---

# Current Development Status


Completed:

- Development environment
- Next.js application
- Landing page
- Navbar
- Onboarding prototype
- Company data pipeline (yfinance → SQLite)
- Companies page reading from the database


In progress:

- Complete questionnaire system

Next:

- User accounts
- ETF data in the pipeline
- Recommendation engine