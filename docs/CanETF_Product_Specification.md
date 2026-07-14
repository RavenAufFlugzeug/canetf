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


Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS


Backend:

- FastAPI


Database:

- PostgreSQL


Infrastructure:

- Podman
- Bazzite
- Toolbox


---

# Current Development Status


Completed:

- Development environment
- Next.js application
- Landing page
- Navbar
- Onboarding prototype


In progress:

- Complete questionnaire system

Next:

- User accounts
- Database
- Recommendation engine