# CanETF Selector
# Development Log


---

# Day 1
## Environment Setup + Frontend Foundation


Date:

July 13, 2026


---

# Development Environment


Operating System:

Bazzite Linux


Development approach:

Toolbox container workflow.


Tools verified:


Python:

3.14.6


Git:

2.55.0


Podman:

5.8.4


Toolbox:

0.3


---

# Created Development Container


Command:


toolbox create canetf-dev


Purpose:

Keep development dependencies separate from Bazzite host.


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


src/app/page.tsx


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


src/components/Navbar.tsx


Learned:


- Component reuse
- Importing components


---

# Created Onboarding Prototype


Created:


src/app/onboarding/page.tsx


Purpose:


Begin investor questionnaire.


Implemented:


- Card layout
- Account selection


---

# Created Quiz Engine


Created:


src/components/OnboardingQuiz.tsx


Implemented:


- React state
- Step navigation
- Dynamic rendering


---

# Created Question Data File


Created:


src/lib/questions.ts


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


Bazzite:

- Toolbox workflow


---

# Next Development Session


Goals:


Finish onboarding engine.


Add:


- Investment amount input
- Monthly contribution input
- Multi-select preferences
- Complete investor profile object