# Professional UI Redesign — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Visual reskin only — no layout structure, routing, or data changes

---

## Goal

Give MyATS a distinct, enterprise-grade visual identity that differentiates it from its source project. The current UI uses a white nav bar, pastel-fill badges, and a scattered multi-color icon palette that reads as generic. The target look is a polished, corporate SaaS product in the style of Greenhouse, Lever, or Workday.

No menu structure changes. No component logic changes. CSS/Tailwind class changes only.

---

## Design Decisions

| Topic | Choice | Rationale |
|---|---|---|
| Nav bar background | Deep navy (`slate-900` / `#0f172a`) | Highest-impact single change; immediately reads enterprise |
| Page background | `slate-50` (`#f8fafc`) | Cooler tone; pairs with navy better than `gray-50` |
| Cards | White, `shadow-sm`, no border | Removes the default/generic bordered look |
| Icon backgrounds | All unified `slate-100` | Eliminates the rainbow scatter; cohesive |
| Status badges | Outlined (border + text, transparent fill) | Airy on white cards; pairs well with bold nav |
| Primary button | `slate-800` / `slate-900` | Ties CTAs to the brand; stops the blue-on-blue competition |
| Bar chart fill | `slate-700` (`#334155`) | On-brand; matches navy family |
| Typography | `slate-*` scale, `tracking-tight` on headings | Cooler, more premium feel |

---

## Token Map

All changes are Tailwind class swaps — no custom CSS required.

### Navigation Bar (`App.tsx` — `<nav>`)

| Element | Before | After |
|---|---|---|
| Nav background | `bg-white border-b shadow-sm` | `bg-slate-900 border-b border-slate-800` |
| Brand logo text | `text-blue-600` | `text-white` |
| Nav link default | `text-gray-600 hover:bg-gray-100` | `text-slate-300 hover:bg-slate-800 hover:text-white` |
| Nav link active | `bg-blue-50 text-blue-700` | `bg-slate-700 text-white` |
| Profile name text | `text-gray-700` | `text-slate-200` |
| Profile chevron | `text-gray-400` | `text-slate-400` |
| Profile button hover | `hover:bg-gray-100` | `hover:bg-slate-800` |
| Avatar initials bg | `bg-blue-100 text-blue-700` | `bg-slate-600 text-white` |
| Profile dropdown | `bg-white border rounded-xl shadow-lg` | unchanged (dropdown is white — correct) |

### Page Background

| Element | Before | After |
|---|---|---|
| Root layout bg | `bg-gray-50` | `bg-slate-50` |

### Stat Cards (Dashboard + all list pages)

| Element | Before | After |
|---|---|---|
| Card container | `bg-white border rounded-xl` | `bg-white rounded-xl shadow-sm` |
| Icon wrapper | e.g. `bg-blue-50 text-blue-600`, `bg-purple-50 text-purple-600`, etc. | `bg-slate-100` wrapper; keep individual icon color class |
| Stat number | `text-gray-900` | unchanged |
| Stat label | `text-gray-500` | `text-slate-500` |

### Status Badges

Replace all soft pastel fill badges with outlined variants.

| Status | Before | After |
|---|---|---|
| `applied` | `bg-blue-100 text-blue-700` | `border border-blue-400 text-blue-600 bg-transparent` |
| `screening` | `bg-purple-100 text-purple-700` | `border border-purple-400 text-purple-600 bg-transparent` |
| `interview` | `bg-yellow-100 text-yellow-700` | `border border-amber-400 text-amber-600 bg-transparent` |
| `offer` | `bg-orange-100 text-orange-700` | `border border-orange-400 text-orange-600 bg-transparent` |
| `hired` | `bg-green-100 text-green-700` | `border border-green-500 text-green-700 bg-transparent` |
| `rejected` | `bg-red-100 text-red-600` | `border border-red-400 text-red-500 bg-transparent` |
| `draft` (job) | `bg-gray-100 text-gray-600` | `border border-slate-400 text-slate-600 bg-transparent` |
| `published` (job) | `bg-green-100 text-green-700` | `border border-green-500 text-green-700 bg-transparent` |
| `closed` (job) | `bg-red-100 text-red-600` | `border border-red-400 text-red-500 bg-transparent` |
| `archived` (job) | `bg-yellow-100 text-yellow-700` | `border border-amber-400 text-amber-600 bg-transparent` |

### Primary Buttons

| Element | Before | After |
|---|---|---|
| Background | `bg-blue-600 hover:bg-blue-700` | `bg-slate-800 hover:bg-slate-900` |
| Text | `text-white` | `text-white` (unchanged) |

### Typography

| Element | Before | After |
|---|---|---|
| Page `<h1>` | `text-2xl font-bold text-gray-900` | `text-3xl font-semibold text-slate-900 tracking-tight` |
| Section headings | `font-semibold text-gray-900` | `font-semibold text-slate-900 tracking-tight` |
| Subtitle/meta text | `text-gray-500` | `text-slate-500` |
| Tertiary/timestamp | `text-gray-400` | `text-slate-400` |

### Charts (Dashboard)

| Element | Before | After |
|---|---|---|
| Bar chart fill | `fill="#3b82f6"` | `fill="#334155"` (slate-700) |
| Pipeline funnel bar | `bg-blue-500` | `bg-slate-700` |
| Pipeline background | `bg-gray-100` | `bg-slate-100` |

---

## Files to Change

| File | What changes |
|---|---|
| `packages/frontend/src/App.tsx` | Nav bar classes, profile menu classes, active link classes |
| `packages/frontend/src/pages/Dashboard.tsx` | Stat card classes, badge map, chart fill color, pipeline bar color, heading, subtitle |
| `packages/frontend/src/pages/Jobs.tsx` | Job card classes, STATUS_STYLE badge map, heading, button |
| `packages/frontend/src/pages/JobDetail.tsx` | Badge classes, heading, card classes, button |
| `packages/frontend/src/pages/HiringBoard.tsx` | Stage badge classes, card classes, heading |
| `packages/frontend/src/pages/Candidates.tsx` | Card classes, heading, button |
| `packages/frontend/src/pages/CandidateDetail.tsx` | Badge classes, heading, card classes |
| `packages/frontend/src/pages/Placements.tsx` | Badge classes, heading, card classes, button |
| `packages/frontend/src/pages/PlacementDetail.tsx` | Badge classes, heading, card classes |
| `packages/frontend/src/pages/Providers.tsx` | Card classes, heading, button |
| `packages/frontend/src/pages/Employers.tsx` | Card classes, heading, button |
| `packages/frontend/src/pages/AdminUsers.tsx` | Card/table classes, heading, button |
| `packages/frontend/src/pages/AdminDepartments.tsx` | Card classes, heading, button |
| `packages/frontend/src/pages/AdminLocations.tsx` | Card classes, heading, button |
| `packages/frontend/src/pages/Login.tsx` | Button, card, heading classes |
| `packages/frontend/src/pages/Profile.tsx` | Card, button, heading classes |

---

## Out of Scope

- No nav menu structure changes (links, ordering, grouping)
- No routing or component logic changes
- No new shadcn/ui components
- No custom CSS or new Tailwind config entries
- No font changes (system font stack stays)
- No dark mode support
- No mobile-specific layout changes

---

## Success Criteria

- Top nav is deep navy — visually distinct from any white-nav ATS
- All pages use `slate-*` color tokens instead of `gray-*` where applicable
- Zero pastel-fill badges remain — all outlined
- Primary buttons are slate-800, not blue
- Charts use slate-700 fill
- Cards use shadow-sm, no border
- The app is visually unrecognizable as the source project at first glance
