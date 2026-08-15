# اردو / Urdu — Bilingual Typography & Language Guide

> Comprehensive reference for building a **bilingual (English + Urdu)** interface.  
> Covers font selection, RTL layout strategy, CSS implementation, and language switching.

---

## 1. Language Strategy Overview

This app supports **two languages**:

| Property | English | Urdu (اردو) |
|:---|:---|:---|
| **Direction** | LTR (Left-to-Right) | RTL (Right-to-Left) |
| **Script** | Latin | Nastaliq (نستعلیق) |
| **Default** | Yes (fallback) | User-switchable |
| **Locale Code** | `en` | `ur` |

> [!IMPORTANT]
> The entire layout must **mirror** when switching to Urdu. Sidebar moves to the right, text aligns right, icons flip horizontally. This is achieved through CSS Logical Properties — NOT by manually writing separate RTL stylesheets.

---

## 2. Font Selection

### 2.1 The Decision: Nastaliq vs Naskh

Urdu can be rendered in two script styles. Here is the critical difference:

| Feature | Nastaliq (نستعلیق) | Naskh (نسخ) |
|:---|:---|:---|
| **Look** | Flowing, calligraphic, diagonal baseline | Geometric, horizontal baseline |
| **Cultural Feel** | Authentic, traditional, "real Urdu" | Generic Arabic-style, feels foreign |
| **Readability** | Excellent for native Urdu readers | Good for small UI text |
| **Performance** | Heavier (complex ligatures) | Lightweight, fast rendering |
| **Pakistani User Expectation** | This is what they expect | This feels like "Arabic, not Urdu" |

**Our Decision:** We use a **hybrid approach**:
- **Gulzar** (Nastaliq) — for headings, card titles, and prominent labels
- **Noto Nastaliq Urdu** (Nastaliq) — for body text and descriptions
- **Noto Sans Arabic** (Naskh) — ONLY as a fallback if Nastaliq fails to load

This gives us the authentic Pakistani look while maintaining web performance.

### 2.2 Recommended Urdu Fonts

#### Primary: Gulzar (Google Fonts)
- **Type:** Modern Nastaliq, engineered for digital
- **Why:** Built specifically for web. Clean curves, consistent terminals, excellent legibility at various sizes. Maintained by Google, so it loads from their fast CDN.
- **Best for:** Headings, card titles, prominent labels, KPI values in Urdu
- **Available on:** [Google Fonts](https://fonts.google.com/specimen/Gulzar)

#### Secondary: Noto Nastaliq Urdu (Google Fonts)
- **Type:** Traditional Nastaliq, comprehensive character set
- **Why:** Covers the widest range of Urdu characters and ligatures. Slightly heavier than Gulzar but more complete for edge-case text.
- **Best for:** Body text, descriptions, long-form content
- **Available on:** [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Nastaliq+Urdu)

#### Fallback: Noto Sans Arabic (Google Fonts)
- **Type:** Naskh sans-serif
- **Why:** Ultra-lightweight and renders perfectly in tiny UI elements. Acts as a safety net if Nastaliq fonts fail.
- **Best for:** Emergency fallback only
- **Available on:** [Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+Arabic)

### 2.3 Font Stack (CSS)

```css
/* Urdu Headings — modern Nastaliq, premium feel */
--font-heading-ur: 'Gulzar', 'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif;

/* Urdu Body — traditional Nastaliq for comfortable reading */
--font-body-ur: 'Noto Nastaliq Urdu', 'Gulzar', 'Noto Sans Arabic', serif;

/* Urdu Monospace / Numbers — for currency amounts (₨) */
--font-mono-ur: 'Noto Sans Arabic', 'Noto Nastaliq Urdu', sans-serif;
```

### 2.4 Google Fonts Import (Combined English + Urdu)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gulzar&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
```

---

## 3. Urdu Typography Scale

Urdu Nastaliq requires **significantly more vertical space** than English. The script flows diagonally, and letters overlap vertically. Standard English line heights will cause clipping and collisions.

### 3.1 Type Scale — Urdu Mode

| Level | Font | Size | Weight | Line Height | Usage |
|:---|:---|:---|:---|:---|:---|
| **Display** | Gulzar | 36px | 700 | 2.2 | Page titles (ڈیش بورڈ، بل بنائیں) |
| **H1** | Gulzar | 28px | 600 | 2.0 | Section headers |
| **H2** | Gulzar | 22px | 600 | 2.0 | Card titles |
| **H3** | Noto Nastaliq Urdu | 18px | 600 | 1.9 | Sub-section headers |
| **Body** | Noto Nastaliq Urdu | 16px | 400 | 2.2 | Standard body text |
| **Body Small** | Noto Nastaliq Urdu | 15px | 400 | 2.0 | Secondary info |
| **Caption** | Noto Nastaliq Urdu | 14px | 400 | 1.8 | Labels, timestamps |
| **Amount** | Noto Sans Arabic | 20px | 600 | 1.6 | Currency (₨ ۱۲,۵۰۰) |
| **Amount Large** | Noto Sans Arabic | 30px | 700 | 1.5 | KPI numbers |

> [!WARNING]
> ### Line Height is Critical
> Never use a `line-height` below **1.8** for Nastaliq text. Anything lower will cause letters to clip into the line above. For body text, **2.0 – 2.2** is the safe range. Always test with real Urdu sentences, not placeholder text.

### 3.2 Size Comparison: English vs Urdu

Because Nastaliq glyphs are taller and wider than Latin glyphs, Urdu text at the same `font-size` will appear visually different. Here are the adjustments:

| Level | English Size | Urdu Size | Reason |
|:---|:---|:---|:---|
| Display | 32px | 36px | Nastaliq needs ~10-15% larger to match visual weight |
| Body | 14px | 16px | Nastaliq ligatures become unreadable below 15px |
| Caption | 12px | 14px | Minimum safe size for Nastaliq on screens |

---

## 4. RTL Layout System

### 4.1 The Golden Rule: CSS Logical Properties

**Never use physical CSS properties** (`margin-left`, `padding-right`, `text-align: left`). They break in RTL mode. Always use **logical properties** that automatically flip:

| Physical (DO NOT USE) | Logical (USE THIS) |
|:---|:---|
| `margin-left: 16px` | `margin-inline-start: 16px` |
| `margin-right: 16px` | `margin-inline-end: 16px` |
| `padding-left: 24px` | `padding-inline-start: 24px` |
| `padding-right: 24px` | `padding-inline-end: 24px` |
| `left: 0` | `inset-inline-start: 0` |
| `right: 0` | `inset-inline-end: 0` |
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |
| `float: left` | `float: inline-start` |
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |
| `border-radius: 10px 0 0 10px` | `border-start-start-radius: 10px` etc. |

### 4.2 Layout Mirroring

When the app switches to Urdu (`dir="rtl"`), the following should automatically mirror:

| Element | LTR (English) | RTL (Urdu) |
|:---|:---|:---|
| Sidebar | Left side | Right side |
| Text alignment | Left-aligned | Right-aligned |
| Back arrow icon | ← Points left | → Points right |
| Progress bars | Fill left → right | Fill right → left |
| Breadcrumbs | Home > Bills > Detail | Detail < Bills < Home |
| Form labels | Above-left of input | Above-right of input |
| Close (X) button | Top-right of modal | Top-left of modal |
| Checkboxes | Left of label | Right of label |

### 4.3 Flexbox & Grid (Auto-Mirroring)

Flexbox and CSS Grid automatically respect `dir="rtl"`:

```css
/* This sidebar layout automatically flips in RTL! */
.app-layout {
  display: flex;
  /* No need for flex-direction changes — it mirrors automatically */
}

.sidebar {
  width: 260px;
  /* Use logical properties for padding */
  padding-inline-start: 16px;
  padding-inline-end: 8px;
  border-inline-end: 1px solid var(--border-default);
}
```

### 4.4 Icons That Must Flip

Some icons are **directional** and must be mirrored in RTL. Others are **universal** and stay the same.

| Must Flip in RTL | Do NOT Flip |
|:---|:---|
| `ChevronRight` / `ChevronLeft` (navigation) | `Search` (magnifying glass) |
| `ArrowRight` / `ArrowLeft` (back/forward) | `Plus` / `Minus` |
| `ExternalLink` (open link) | `Trash2` (delete) |
| `Undo` / `Redo` | `Settings` (gear) |
| `LogOut` (exit) | `Download` / `Upload` |

```css
/* Auto-flip directional icons in RTL */
[dir="rtl"] .icon-directional {
  transform: scaleX(-1);
}
```

---

## 5. Language Switching Implementation

### 5.1 Architecture

```
User clicks language toggle
        ↓
Update i18n locale (en ↔ ur)
        ↓
Update document.documentElement.dir (ltr ↔ rtl)
        ↓
Update document.documentElement.lang (en ↔ ur)
        ↓
CSS Logical Properties auto-mirror the layout
        ↓
Font stack switches via CSS [lang="ur"] selectors
```

### 5.2 CSS Language-Aware Font Switching

```css
/* Default: English fonts */
body {
  font-family: var(--font-body);
  direction: ltr;
}

h1, h2, h3, .heading {
  font-family: var(--font-heading);
}

/* Urdu mode: switch fonts automatically */
:lang(ur) body,
[lang="ur"] body {
  font-family: var(--font-body-ur);
  direction: rtl;
}

:lang(ur) h1,
:lang(ur) h2,
:lang(ur) h3,
:lang(ur) .heading,
[lang="ur"] h1,
[lang="ur"] h2,
[lang="ur"] h3,
[lang="ur"] .heading {
  font-family: var(--font-heading-ur);
}

/* Adjust line heights for Nastaliq */
:lang(ur) p,
:lang(ur) li,
:lang(ur) td,
[lang="ur"] p,
[lang="ur"] li,
[lang="ur"] td {
  line-height: 2.2;
}

:lang(ur) .caption,
[lang="ur"] .caption {
  line-height: 1.8;
}
```

### 5.3 Language Toggle UI

```
┌─────────────────────┐
│  English  |  اردو   │   ← Segmented control in the header
└─────────────────────┘
```

**Rules for the toggle:**
- Display language names in their **native script** ("English" and "اردو"), NOT as flags
- Never use country flags (Pakistani flag ≠ Urdu language)
- Place in the header bar, right side (English mode) or left side (Urdu mode)
- Persist the user's choice in `localStorage`

---

## 6. Handling Mixed Content (Bidirectional Text)

When English words appear inside Urdu text (or vice versa), the browser can scramble the order. Use the `<bdi>` element to isolate them.

### 6.1 Common Mixed-Content Scenarios

| Scenario | Example | Solution |
|:---|:---|:---|
| English brand name in Urdu sentence | ٹیوب ویل نمبر **TW-0042** | Wrap `TW-0042` in `<bdi>` |
| Phone number in Urdu | رابطہ نمبر: **0300-1234567** | Wrap number in `<bdi>` |
| Email in Urdu context | ای میل: **admin@example.com** | Wrap email in `<bdi>` |
| Currency with Latin digits | رقم: **₨ 12,500** | Wrap amount in `<bdi>` |

### 6.2 Implementation

```jsx
// React component for safe bidirectional text
function BidiText({ children }) {
  return <bdi>{children}</bdi>;
}

// Usage
<p>ٹیوب ویل نمبر <BidiText>TW-0042</BidiText> کا بل</p>
```

---

## 7. Number Formatting

### 7.1 Decision: Western vs Eastern Arabic Numerals

| System | Example | Usage |
|:---|:---|:---|
| Western Arabic (0-9) | ₨ 12,500 | Default — familiar to Pakistani users in digital context |
| Eastern Arabic (۰-۹) | ₨ ۱۲,۵۰۰ | Optional — more traditional feel |

**Our Decision:** Use **Western Arabic numerals (0-9)** even in Urdu mode. Pakistani users are accustomed to seeing Western digits on screens, mobile apps, and banking interfaces. Eastern Arabic numerals can be offered as a future option.

### 7.2 Currency Formatting

| Language | Format | Example |
|:---|:---|:---|
| English | `PKR 12,500` or `₨ 12,500` | Prefix, comma-separated |
| Urdu | `₨ 12,500` or `12,500 روپے` | Same format, Urdu label optional |

---

## 8. Translation Key Structure

Organize translation keys by feature/screen, not by language:

```
/src/locales/
  ├── en.json          ← English translations
  └── ur.json          ← Urdu translations
```

### 8.1 Example Translation Files

**en.json**
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "bills": "Bills",
    "users": "Users",
    "settings": "Settings"
  },
  "dashboard": {
    "title": "Dashboard",
    "totalBills": "Total Bills",
    "totalRevenue": "Total Revenue",
    "pendingBills": "Pending Bills",
    "unpaidBills": "Unpaid Bills"
  },
  "bill": {
    "generate": "Generate Bill",
    "tubewellId": "Tubewell ID",
    "ownerName": "Owner Name",
    "unitsConsumed": "Units Consumed",
    "amountDue": "Amount Due",
    "status": "Status",
    "paid": "Paid",
    "pending": "Pending",
    "unpaid": "Unpaid"
  }
}
```

**ur.json**
```json
{
  "nav": {
    "dashboard": "ڈیش بورڈ",
    "bills": "بل",
    "users": "صارفین",
    "settings": "ترتیبات"
  },
  "dashboard": {
    "title": "ڈیش بورڈ",
    "totalBills": "کل بل",
    "totalRevenue": "کل آمدنی",
    "pendingBills": "زیر التوا بل",
    "unpaidBills": "غیر ادا شدہ بل"
  },
  "bill": {
    "generate": "بل بنائیں",
    "tubewellId": "ٹیوب ویل نمبر",
    "ownerName": "مالک کا نام",
    "unitsConsumed": "استعمال شدہ یونٹس",
    "amountDue": "واجب الادا رقم",
    "status": "حالت",
    "paid": "ادا شدہ",
    "pending": "زیر التوا",
    "unpaid": "غیر ادا شدہ"
  }
}
```

---

## 9. Testing Checklist

Before shipping any screen, verify both languages:

- [ ] All text renders in correct font (Outfit/Inter for English, Gulzar/Noto Nastaliq for Urdu)
- [ ] No Nastaliq text is clipped or overlapping (check line heights)
- [ ] Sidebar mirrors to the right side in Urdu mode
- [ ] All directional icons (chevrons, arrows) are flipped in RTL
- [ ] Non-directional icons (search, trash, settings) remain unchanged
- [ ] Mixed content (English words in Urdu text) renders correctly with `<bdi>`
- [ ] Currency amounts are legible and properly formatted
- [ ] Input fields accept RTL text and cursor appears on the right
- [ ] Language toggle persists after page reload
- [ ] Buttons and cards do not overflow with longer Urdu text
- [ ] Mobile bottom navigation mirrors correctly
- [ ] Modal close button moves from top-right (EN) to top-left (UR)

---

## 10. Quick Reference: Urdu CSS Custom Properties

```css
:root {
  /* Urdu Font Stacks */
  --font-heading-ur: 'Gulzar', 'Noto Nastaliq Urdu', 'Noto Sans Arabic', serif;
  --font-body-ur: 'Noto Nastaliq Urdu', 'Gulzar', 'Noto Sans Arabic', serif;
  --font-mono-ur: 'Noto Sans Arabic', 'Noto Nastaliq Urdu', sans-serif;

  /* Urdu-Specific Line Heights */
  --lh-display-ur: 2.2;
  --lh-heading-ur: 2.0;
  --lh-body-ur: 2.2;
  --lh-caption-ur: 1.8;
  --lh-amount-ur: 1.6;

  /* Minimum Font Sizes for Nastaliq Legibility */
  --min-size-body-ur: 16px;
  --min-size-caption-ur: 14px;
}
```

---

> **Next Step:** When building components, always use the CSS Logical Properties from Section 4 and the `[lang="ur"]` font selectors from Section 5. This ensures every component automatically supports both languages without any extra RTL-specific code.
