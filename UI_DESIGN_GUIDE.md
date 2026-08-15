# AquaBill — UI/UX Design Sense Guide

> A comprehensive reference document for building a premium, modern dashboard.
> Feed this to the AI assistant so every component it builds follows these rules.

---

## 1. Global Layout Architecture

### 1.1 The Sidebar
The sidebar is the **spine** of the application. It must feel permanent, trustworthy, and effortless to scan.

| Property | Value | Rationale |
|---|---|---|
| Width | **240px** (desktop) | Divisible by 8pt grid. Enough room for icon + label. |
| Background | `--bg-surface` (#FFFFFF) | Clean, light, doesn't compete with content. |
| Border | Right border only, `1px solid --border-default` | Subtle separation from main content. No shadow. |
| Position | `position: sticky; top: 0; height: 100vh` | Sidebar stays fixed while content scrolls. |
| Collapse (mobile) | Slide-in drawer with overlay | On screens < 768px, sidebar becomes a hamburger drawer. |

### 1.2 Sidebar Internal Structure
The sidebar must be divided into **three visual zones**, separated by subtle `1px` border lines:

```
┌─────────────────────┐
│   LOGO AREA         │  ← 60px height, centered vertically
│   (AquaBill logo)   │
├─────────────────────┤
│                     │
│   NAV ITEMS         │  ← flex: 1 (takes remaining space)
│   (grouped links)   │
│                     │
├─────────────────────┤
│   FOOTER AREA       │  ← Login button or user avatar
│   (Admin Login)     │
└─────────────────────┘
```

### 1.3 Navigation Item Anatomy
Each nav item is **not** just a text button. It must have this precise structure:

```
┌───────────────────────────────┐
│  [icon]  [12px gap]  [label] │
│                               │
│  padding: 10px 16px           │
│  border-radius: 8px           │
│  font-size: 14px              │
│  font-weight: 500 (normal)    │
│  color: --text-secondary      │
└───────────────────────────────┘
```

**Active state:**
- Background: `--primary-light` (#EFF6FF)
- Text color: `--primary` (#2563EB)
- Font weight: 600
- Left accent: `3px solid --primary` (inside the border-radius)
- Icon: filled variant or same primary color

**Hover state (non-active):**
- Background: `--bg-surface-hover` (#F8FAFC)
- Transition: `background 0.15s ease`
- NO transform, NO scale, NO bounce. Just a calm background shift.

**RULE: Every nav item MUST have an icon next to its label.** Use Lucide React icons. Never use emoji. Never use text-only nav items. Icons make scanning 3x faster.

---

## 2. Icons — Mandatory Rules

### 2.1 Icon Library
Use **Lucide React** (`lucide-react` package) exclusively. It is free, MIT-licensed, consistent, and designed for modern UIs.

### 2.2 Icon Usage Rules
| Rule | Detail |
|---|---|
| Always pair icon + label | Never use icon-only navigation (except collapsed sidebar rail mode). |
| Size | **20px** for sidebar nav, **16px** for inline/table use, **24px** for page headers. |
| Stroke width | Use the default (2px). Do not customize stroke width. |
| Color | Icons inherit text color from their parent. Do NOT hardcode icon colors separately. |
| No emoji | Emoji are banned. They look unprofessional and inconsistent across devices. |
| Active icon style | Use the same icon but in `--primary` color. Do not swap to a "filled" variant. |

### 2.3 Recommended Icon Mapping for AquaBill

| Feature | Lucide Icon Name | Reasoning |
|---|---|---|
| Weekly Schedule | `CalendarClock` | Represents time-based scheduling |
| Members Directory | `Users` | Universal "people" icon |
| Billing / Bills | `Receipt` | Invoicing / financial records |
| Dashboard / Home | `LayoutDashboard` | Standard dashboard icon |
| Settings | `Settings` | Universal gear icon |
| Admin Login | `LogIn` | Standard login/auth icon |
| Add New | `Plus` | Universal "create" action |
| Edit | `Pencil` | Standard edit action |
| Delete | `Trash2` | Standard delete action |
| Search | `Search` | Standard search icon |
| Paid status | `CircleCheck` | Green checkmark for success |
| Pending status | `Clock` | Waiting / in-progress |
| Overdue status | `AlertTriangle` | Warning / attention needed |

---

## 3. Content Area — The Main Stage

### 3.1 Page Header Pattern
Every page (tab content) must begin with a consistent **Page Header** block:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  [Page Title]                     [Action Button(s)] │
│  [Subtitle / description text]                       │
│                                                      │
│  margin-bottom: 32px                                 │
└──────────────────────────────────────────────────────┘
```

- **Title**: `font-family: Outfit`, `font-size: 24px`, `font-weight: 700`, `color: --text-primary`
- **Subtitle**: `font-family: Inter`, `font-size: 14px`, `color: --text-secondary`
- **Action buttons** (like "Add Member"): Aligned to the right, only visible to authenticated admins.

### 3.2 Card Design Rules
Cards are the primary container for content. Every card must follow these rules:

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;              /* --radius-lg */
  padding: 20px;                    /* consistent internal padding */
  box-shadow: none;                 /* NO shadow by default */
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);   /* very subtle lift */
  transform: translateY(-1px);                /* micro-lift, barely visible */
}
```

**CRITICAL RULES:**
- Cards must **never** have a shadow by default. Shadow only appears on hover.
- Cards must **never** have colored backgrounds. They are always white (`--bg-surface`).
- Cards must **never** have thick borders. Always `1px solid --border-default`.
- Internal padding must be consistent: `20px` on all sides.

### 3.3 Data Display: Schedule List Item
Each schedule turn should be displayed as a **horizontal card row**, not a generic div:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Circle: #]   [Time Block]                    [Duration]   │
│                 SUN 06:00 → SUN 23:00                       │
│                 Zahid Javed            [Leased Badge]       │
│                                                             │
│  Left accent bar: 3px solid (green if active, gray if not)  │
└─────────────────────────────────────────────────────────────┘
```

- The circle with the turn number should be **36px**, centered, with a subtle background.
- Time text: `font-size: 12px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.5px`, `color: --text-tertiary`.
- Name text: `font-size: 16px`, `font-weight: 600`, `color: --text-primary`.
- Duration: Right-aligned, `font-family: Outfit`, `font-weight: 600`, `color: --primary`.

### 3.4 Data Display: Member Card
Each member in the grid should follow this anatomy:

```
┌─────────────────────────────────────┐
│                                     │
│  [Avatar Circle: Initials]          │
│  [Name]              [Leased badge] │
│  [ID: 03]                           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Weekly Share: 12h 15m      │    │  ← muted background sub-card
│  └─────────────────────────────┘    │
│                                     │
│  ── TENANTS ──────────────────────  │  ← thin border-top separator
│  • Zamaan                           │
│  • Imran                            │
│                                     │
└─────────────────────────────────────┘
```

- **Avatar circle**: 44px, uses the member's initials (first letter of first and last name), with a pastel-colored background generated from the user code (e.g., code "01" → blue, code "05" → green). This adds personality without needing actual photos.
- Grid: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` with `gap: 20px`.

---

## 4. Micro-Interactions & Motion

### 4.1 The Golden Rule of Animation
> "If the user doesn't notice it consciously, but the interface *feels* smooth — you've done it right."

### 4.2 Approved Transitions
| Element | Property | Duration | Easing |
|---|---|---|---|
| Button hover | `background-color`, `box-shadow` | `0.15s` | `ease` |
| Card hover | `box-shadow`, `transform` | `0.2s` | `ease` |
| Nav item hover | `background-color` | `0.15s` | `ease` |
| Active tab highlight | `background-color`, `color` | `0.2s` | `ease` |
| Badge appear | `opacity`, `transform` | `0.2s` | `ease-out` |

### 4.3 Banned Animations
- **NO** bouncing or spring physics on hover.
- **NO** scale transforms larger than `1.02`.
- **NO** color transitions longer than `0.3s`.
- **NO** layout-shifting animations (width, height, margin changes on hover).
- **NO** blinking, pulsing, or attention-grabbing loops.

---

## 5. Spacing & Whitespace

### 5.1 The 8pt Grid (Reminder)
All spacing must be a multiple of 4px or 8px:
- `4px` — tightest (between icon and label)
- `8px` — small (between badge items)
- `12px` — compact (inside dense areas like table cells)
- `16px` — default (standard padding, gaps)
- `20px` — card internal padding
- `24px` — section margins
- `32px` — between major sections (page header to content)
- `48px` — page-level vertical breathing room

### 5.2 Whitespace Philosophy
> "Whitespace is not wasted space. It is the breathing room that makes premium feel premium."

- **Between cards in a grid**: `20px` gap
- **Between a page header and content**: `32px`
- **Between sidebar nav items**: `4px`
- **Sidebar section group gap**: `24px` (e.g., between "Main" group and "Settings" group)
- **Internal card padding**: `20px` on all four sides

---

## 6. Typography Pairing Reminders

| Use Case | Font | Size | Weight |
|---|---|---|---|
| Page titles | Outfit | 24px | 700 |
| Card titles | Outfit | 16px | 600 |
| Body text | Inter | 14px | 400 |
| Labels / captions | Inter | 12px | 500 |
| Amounts / KPIs | Outfit | 20px | 700 |
| Buttons | Inter | 14px | 600 |
| Nav items | Inter | 14px | 500 (normal) / 600 (active) |
| Badge text | Inter | 11px | 600 |

---

## 7. Summary Checklist — Before Shipping Any Component

Before writing any component, verify against this list:

- [ ] Does every nav item have a Lucide icon + text label?
- [ ] Are all spacings multiples of 4px or 8px?
- [ ] Do cards have NO default shadow (shadow only on hover)?
- [ ] Are hover transitions ≤ 0.2s with `ease` easing?
- [ ] Is the page header present with title + subtitle?
- [ ] Are amounts/durations using Outfit font?
- [ ] Are labels/captions using Inter 12px weight 500?
- [ ] Is `--text-secondary` used for secondary information (not a random gray)?
- [ ] Are there ZERO emojis anywhere in the UI?
- [ ] Does the active nav state use `--primary-light` background + `--primary` text?
