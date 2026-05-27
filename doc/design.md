# GracePulse - Design System & UI Specifications

## 1. Design Concept
**Premium FinTech Glassmorphism (Deep Theme).** The UI must project trust, accuracy, and high-end financial technology. It avoids flat design in favor of depth, transparency, and subtle glowing accents over a dark universe background.

## 2. Color Palette
- **Global Background:** Deep Navy to Teal Gradient (`linear-gradient(135deg, #070b14 0%, #0f1c2e 100%)`).
- **Primary Text:** Crisp White / Off-White (`#f8fafc`).
- **Muted Text:** Cool Gray (`#94a3b8`).
- **Brand Primary:** Royal Blue (`#2563eb`).
- **Success / Lock:** Elegant Emerald (`#059669`).
- **Danger / Grace Deduction:** Deep Crimson (`#dc2626`).
- **Accent (Buttons/Highlights):** Ocean Blue (`#0284c7`).

## 3. Typography
- **Headings / Numbers:** `Rubik`, sans-serif. Used for prominent balances, month titles, and stat boxes to provide a structured, geometric financial look.
- **Body / Labels:** `Assistant`, sans-serif. Used for readable, clean Hebrew text in inputs and data rows.

## 4. Glassmorphism Specifications
Core containers (`.sticky-header`, `.ledger-card`, `.bottom-sheet`) must utilize the following CSS parameters to achieve the frosted glass effect:
- **Background:** `rgba(255, 255, 255, 0.04)` (Very low opacity for subtle frost).
- **Backdrop Filter:** `blur(20px)` (High blur to diffuse the background gradient).
- **Border:** `1px solid rgba(255, 255, 255, 0.08)` (Barely visible structural edge).
- **Box Shadow:** `0 10px 30px -5px rgba(0, 0, 0, 0.5)` (Deep, dark shadow for elevation without neon glow).

## 5. UI Components
- **Sticky Dashboard:** Fixed at the top, displaying critical aggregates (Liquidity, Contractor Debt, Final Projected Balance).
- **Ledger Cards:** Accordion-style cards. Locked months display a green border and lock icon. Unlocked months display orange clock icons and input fields.
- **Bottom Sheet:** Mobile-native slide-up modal with a dark overlay (`rgba(0,0,0,0.6)` and `blur(4px)`) for the IndexGuard calculator.