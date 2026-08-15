# 🎨 Tubewell Bill System — Design System

> A comprehensive design reference for building a **premium, light-themed** billing dashboard.  
> Every decision below is informed by 2025/2026 industry best practices for modern SaaS and utility management interfaces.

---

## 1. Design Philosophy

| Principle | Description |
|:---|:---|
| **Premium Minimalism** | Clean, spacious layouts that let data breathe. The interface should feel like a premium SaaS product, not a government form. |
| **Data-First Hierarchy** | Color and typography exist to serve the data. Bills, amounts, and statuses are the heroes — the chrome (sidebar, headers) fades into the background. |
| **Functional Motion** | Every animation has a purpose: provide feedback, guide attention, or explain a transition. Zero decorative motion. |
| **Accessible by Default** | All contrast ratios meet WCAG 2.2 AA standards. Respects `prefers-reduced-motion`. |

---

## 2. Color Palette (Light Theme)

We use a **"Sophisticated Slate"** palette — a cool-toned, professional scheme that conveys trust and clarity for a billing/financial application.

### 2.1 Base Colors

| Token | Hex | Usage |
|:---|:---|:---|
| `--bg-canvas` | `#F4F6F9` | Page background (soft gray, avoids harsh pure white) |
| `--bg-surface` | `#FFFFFF` | Cards, modals, and elevated containers |
| `--bg-surface-hover` | `#F8FAFC` | Surface hover state |
| `--bg-surface-active` | `#EEF2F7` | Surface active/pressed state |
| `--bg-muted` | `#E8ECF1` | Disabled backgrounds, divider zones |

### 2.2 Text Colors

| Token | Hex | Usage |
|:---|:---|:---|
| `--text-primary` | `#1A1D26` | Headings, primary labels (deep charcoal, NOT pure black) |
| `--text-secondary` | `#4B5563` | Body text, descriptions |
| `--text-tertiary` | `#9CA3AF` | Placeholder text, timestamps, muted info |
| `--text-inverse` | `#FFFFFF` | Text on dark/colored backgrounds |

### 2.3 Brand / Accent Colors

| Token | Hex | Preview | Usage |
|:---|:---|:---|:---|
| `--primary` | `#2563EB` | 🔵 | Primary buttons, active navigation, links |
| `--primary-hover` | `#1D4ED8` | 🔵 | Primary button hover |
| `--primary-light` | `#EFF6FF` | 🔵 | Primary tinted backgrounds (selected rows, badges) |
| `--secondary` | `#6366F1` | 🟣 | Secondary actions, charts accent |
| `--secondary-light` | `#EEF2FF` | 🟣 | Secondary tinted backgrounds |

### 2.4 Semantic / Status Colors

| Token | Hex | Usage |
|:---|:---|:---|
| `--success` | `#16A34A` | Paid bills, successful operations |
| `--success-light` | `#F0FDF4` | Success badge backgrounds |
| `--warning` | `#D97706` | Pending bills, overdue warnings |
| `--warning-light` | `#FFFBEB` | Warning badge backgrounds |
| `--danger` | `#DC2626` | Unpaid/overdue bills, destructive actions |
| `--danger-light` | `#FEF2F2` | Danger badge backgrounds |
| `--info` | `#0EA5E9` | Informational tooltips, help text |
| `--info-light` | `#F0F9FF` | Info badge backgrounds |

### 2.5 Border & Shadow

| Token | Value | Usage |
|:---|:---|:---|
| `--border-default` | `#E5E7EB` | Card borders, input borders |
| `--border-hover` | `#D1D5DB` | Border on hover |
| `--border-focus` | `#2563EB` | Focused input border (matches primary) |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle card shadow |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Elevated cards, dropdowns |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.12)` | Modals, floating panels |

---

## 3. Typography

We use the **Inter + Outfit** font pairing — the industry-standard combination for premium dashboard design.

### 3.1 Font Stack

```css
/* Headings — geometric, modern, warm */
--font-heading: 'Outfit', system-ui, -apple-system, sans-serif;

/* Body & UI — optimized for screen readability */
--font-body: 'Inter', system-ui, -apple-system, sans-serif;

/* Monospace — for numbers, amounts, data */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### 3.2 Type Scale

| Level | Font | Size | Weight | Line Height | Usage |
|:---|:---|:---|:---|:---|:---|
| **Display** | Outfit | 32px | 700 | 1.2 | Page titles ("Dashboard", "Generate Bill") |
| **H1** | Outfit | 24px | 600 | 1.3 | Section headers |
| **H2** | Outfit | 20px | 600 | 1.35 | Card titles |
| **H3** | Inter | 16px | 600 | 1.4 | Sub-section headers |
| **Body** | Inter | 14px | 400 | 1.6 | Standard body text, descriptions |
| **Body Small** | Inter | 13px | 400 | 1.5 | Secondary info, help text |
| **Caption** | Inter | 12px | 500 | 1.4 | Labels, timestamps, table headers |
| **Amount** | JetBrains Mono | 18px | 600 | 1.3 | Currency amounts (₨ 12,500) |
| **Amount Large** | JetBrains Mono | 28px | 700 | 1.2 | KPI numbers on dashboard cards |

### 3.3 Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
```

---

## 4. Spacing System (8pt Grid)

All spacing follows an **8-point grid** for visual consistency.

| Token | Value | Usage |
|:---|:---|:---|
| `--space-1` | `4px` | Tight gaps (icon + label) |
| `--space-2` | `8px` | Inline element gaps |
| `--space-3` | `12px` | Small padding (badges, chips) |
| `--space-4` | `16px` | Standard padding (inputs, buttons) |
| `--space-5` | `20px` | Medium gaps between elements |
| `--space-6` | `24px` | Card inner padding |
| `--space-8` | `32px` | Section gaps |
| `--space-10` | `40px` | Large section separation |
| `--space-12` | `48px` | Page-level padding |

---

## 5. Border Radius

| Token | Value | Usage |
|:---|:---|:---|
| `--radius-sm` | `6px` | Badges, chips, small elements |
| `--radius-md` | `10px` | Buttons, inputs |
| `--radius-lg` | `14px` | Cards, containers |
| `--radius-xl` | `20px` | Modals, large panels |
| `--radius-full` | `9999px` | Avatars, circular elements |

---

## 6. Component Specifications

### 6.1 Cards (Data Containers)

```
Background:      var(--bg-surface)  →  #FFFFFF
Border:          1px solid var(--border-default)  →  #E5E7EB
Border Radius:   var(--radius-lg)  →  14px
Padding:         var(--space-6)  →  24px
Shadow:          var(--shadow-sm)  →  0 1px 2px rgba(0,0,0,0.05)

Hover State:
  Shadow:        var(--shadow-md)  →  0 4px 12px rgba(0,0,0,0.08)
  Transform:     translateY(-1px)
  Transition:    all 0.2s cubic-bezier(0.4, 0, 0.2, 1)
```

### 6.2 Buttons

#### Primary Button
```
Background:      var(--primary)  →  #2563EB
Text:            var(--text-inverse)  →  #FFFFFF
Font:            Inter, 14px, weight 600
Padding:         12px 24px
Border Radius:   var(--radius-md)  →  10px
Shadow:          0 1px 3px rgba(37, 99, 235, 0.3)

Hover:
  Background:    var(--primary-hover)  →  #1D4ED8
  Shadow:        0 4px 12px rgba(37, 99, 235, 0.35)
  Transform:     translateY(-1px)

Active/Press:
  Transform:     translateY(0) scale(0.98)
  Shadow:        0 1px 2px rgba(37, 99, 235, 0.2)
```

#### Secondary Button (Ghost)
```
Background:      transparent
Border:          1px solid var(--border-default)
Text:            var(--text-primary)

Hover:
  Background:    var(--bg-surface-hover)
  Border-color:  var(--border-hover)
```

#### Danger Button
```
Background:      var(--danger)  →  #DC2626
Text:            #FFFFFF

Hover:
  Background:    #B91C1C
```

### 6.3 Input Fields

```
Background:      var(--bg-surface)  →  #FFFFFF
Border:          1.5px solid var(--border-default)  →  #E5E7EB
Border Radius:   var(--radius-md)  →  10px
Padding:         12px 16px
Font:            Inter, 14px, weight 400
Color:           var(--text-primary)
Placeholder:     var(--text-tertiary)

Focus:
  Border-color:  var(--border-focus)  →  #2563EB
  Box-shadow:    0 0 0 3px rgba(37, 99, 235, 0.12)
  Outline:       none

Label:
  Font:          Inter, 13px, weight 500
  Color:         var(--text-secondary)
  Margin-bottom: 6px
```

### 6.4 Status Badges

```
Paid:      bg: var(--success-light)  text: var(--success)    → green
Pending:   bg: var(--warning-light)  text: var(--warning)    → amber
Unpaid:    bg: var(--danger-light)   text: var(--danger)     → red

Font:      Inter, 12px, weight 600
Padding:   4px 10px
Radius:    var(--radius-full)  →  9999px (pill shape)
```

### 6.5 Data Tables

```
Header Row:
  Background:    var(--bg-canvas)  →  #F4F6F9
  Font:          Inter, 12px, weight 600, uppercase
  Letter-spacing: 0.05em
  Color:         var(--text-tertiary)
  Padding:       12px 16px

Body Row:
  Background:    var(--bg-surface)  →  #FFFFFF
  Border-bottom: 1px solid var(--border-default)
  Padding:       14px 16px
  Font:          Inter, 14px, weight 400

Row Hover:
  Background:    var(--bg-surface-hover)  →  #F8FAFC

Amounts Column:
  Font:          JetBrains Mono, 14px, weight 600
  Text-align:    right
```

### 6.6 Navigation / Sidebar

```
Background:      #FFFFFF
Width:           260px (desktop), hidden on mobile
Border-right:    1px solid var(--border-default)

Nav Item:
  Padding:       10px 16px
  Border-radius: var(--radius-md)  →  10px
  Font:          Inter, 14px, weight 500
  Color:         var(--text-secondary)
  Margin:        2px 8px

Nav Item Active:
  Background:    var(--primary-light)  →  #EFF6FF
  Color:         var(--primary)  →  #2563EB
  Font-weight:   600

Nav Item Hover:
  Background:    var(--bg-surface-hover)
```

---

## 7. Motion & Animation

### 7.1 Timing Tokens

| Token | Value | Usage |
|:---|:---|:---|
| `--duration-fast` | `150ms` | Hover state changes, toggles |
| `--duration-normal` | `250ms` | Card transitions, element reveals |
| `--duration-slow` | `400ms` | Page transitions, modal open/close |
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard easing (Material Design) |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Slight overshoot for playful feedback |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |

### 7.2 Animation Patterns

| Pattern | Properties | When to Use |
|:---|:---|:---|
| **Card Hover Lift** | `translateY(-1px)` + shadow increase | Hovering over any card |
| **Button Press** | `scale(0.98)` + shadow decrease | Clicking any button |
| **Fade In Up** | `opacity 0→1` + `translateY(8px→0)` | New content appearing |
| **Skeleton Shimmer** | Gradient sweep animation | While data is loading |
| **Input Focus Glow** | Box-shadow ring expand | Focusing an input field |
| **Status Pulse** | Subtle scale pulse (1→1.05→1) | Drawing attention to a new status |

### 7.3 Skeleton Loading

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-muted) 25%,
    var(--bg-surface-hover) 50%,
    var(--bg-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite ease-in-out;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 7.4 Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Layout Structure

### 8.1 Desktop Layout (≥ 1024px)

```
┌──────────────────────────────────────────────────┐
│  HEADER (64px height)                            │
│  Logo   │   Page Title   │   Search   │  Avatar  │
├─────────┼────────────────────────────────────────┤
│         │                                        │
│  SIDE   │  MAIN CONTENT                          │
│  NAV    │                                        │
│  260px  │  ┌─────────┐  ┌─────────┐  ┌────────┐ │
│         │  │ KPI Card │  │ KPI Card│  │KPI Card│ │
│  • Dash │  └─────────┘  └─────────┘  └────────┘ │
│  • Bills│                                        │
│  • Users│  ┌────────────────────────────────────┐ │
│  • Sett │  │  DATA TABLE / BILL LIST            │ │
│         │  │                                    │ │
│         │  │  Row 1                             │ │
│         │  │  Row 2                             │ │
│         │  │  Row 3                             │ │
│         │  └────────────────────────────────────┘ │
│         │                                        │
└─────────┴────────────────────────────────────────┘
```

### 8.2 Mobile Layout (< 768px)

```
┌──────────────────────┐
│  HEADER              │
│  ☰  │  Title │ Avatar│
├──────────────────────┤
│                      │
│  ┌────────────────┐  │
│  │   KPI Card 1   │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │   KPI Card 2   │  │
│  └────────────────┘  │
│                      │
│  ┌────────────────┐  │
│  │ Bill List Card │  │
│  │  • Row 1       │  │
│  │  • Row 2       │  │
│  └────────────────┘  │
│                      │
├──────────────────────┤
│  BOTTOM NAV (56px)   │
│  🏠  📄  ➕  ⚙️      │
└──────────────────────┘
```

### 8.3 Breakpoints

| Name | Value | Layout |
|:---|:---|:---|
| Mobile | `< 768px` | Single column, bottom nav, stacked cards |
| Tablet | `768px – 1023px` | Collapsed sidebar (icon-only), 2-column grid |
| Desktop | `≥ 1024px` | Full sidebar + main content area |

---

## 9. Iconography

Use **Lucide Icons** (open-source, consistent stroke width, React-friendly).

```bash
npm install lucide-react
```

| Context | Recommended Icons |
|:---|:---|
| Dashboard | `LayoutDashboard`, `BarChart3`, `TrendingUp` |
| Bills | `Receipt`, `FileText`, `Printer` |
| Users | `Users`, `UserPlus`, `UserCheck` |
| Status | `CheckCircle2`, `Clock`, `AlertCircle` |
| Actions | `Plus`, `Edit3`, `Trash2`, `Download` |
| Navigation | `ChevronRight`, `Menu`, `X`, `Search` |

**Icon sizing:**
- Navigation: `20px`
- Inline: `16px`
- KPI Cards: `24px`
- Empty States: `48px`

> [!IMPORTANT]
> ### 🚫 No Emojis — Ever
> **This application must NEVER use emojis anywhere in the UI.** No emoji in buttons, labels, headings, status indicators, navigation, toasts, or any other user-facing element. Always use **Lucide React icons** instead. Emojis render inconsistently across devices and operating systems and immediately destroy the premium, professional feel of the interface.

---

## 10. UX Patterns & Best Practices

### 10.1 Empty States
Never show a blank screen. Display:
- A friendly illustration or icon (48px, muted color)
- A clear message: *"No bills generated yet"*
- A primary CTA button: *"+ Generate First Bill"*

### 10.2 Loading States
- Use **skeleton screens** (shimmer effect) instead of spinners
- Show skeleton shapes that match the expected content layout
- Duration: if data takes > 300ms, show skeleton

### 10.3 Error States
- Use `--danger-light` background with `--danger` text
- Show a clear message + retry action
- Never show raw error codes to the user

### 10.4 Confirmation Dialogs
- Destructive actions (delete bill) require a confirmation modal
- Modal uses `--shadow-lg` for dramatic elevation
- Primary action button is red for destructive, blue for constructive

### 10.5 Toast Notifications
- Appear at bottom-right of the screen
- Auto-dismiss after 4 seconds
- Slide in from right with `--ease-out`
- Color-coded border: green (success), amber (warning), red (error)

### 10.6 Form Validation
- Validate on blur (when user leaves the field), not on every keystroke
- Show error message below the field in `--danger` color
- Shake animation (subtle translateX) on submit with invalid fields

---

## 11. Quick Reference: CSS Custom Properties

```css
:root {
  /* Colors */
  --bg-canvas: #F4F6F9;
  --bg-surface: #FFFFFF;
  --bg-surface-hover: #F8FAFC;
  --bg-surface-active: #EEF2F7;
  --bg-muted: #E8ECF1;

  --text-primary: #1A1D26;
  --text-secondary: #4B5563;
  --text-tertiary: #9CA3AF;
  --text-inverse: #FFFFFF;

  --primary: #2563EB;
  --primary-hover: #1D4ED8;
  --primary-light: #EFF6FF;
  --secondary: #6366F1;
  --secondary-light: #EEF2FF;

  --success: #16A34A;
  --success-light: #F0FDF4;
  --warning: #D97706;
  --warning-light: #FFFBEB;
  --danger: #DC2626;
  --danger-light: #FEF2F2;
  --info: #0EA5E9;
  --info-light: #F0F9FF;

  --border-default: #E5E7EB;
  --border-hover: #D1D5DB;
  --border-focus: #2563EB;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.12);

  /* Typography */
  --font-heading: 'Outfit', system-ui, -apple-system, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Motion */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
}
```

---

> **Next Step:** Once `npm install` finishes and the dev server is running, we will translate this design system into actual React components and CSS — starting with the Login page or Dashboard.
