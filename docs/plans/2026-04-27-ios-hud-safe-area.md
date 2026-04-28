# Integrated iOS HUD Safe Area Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Extend the HUD background to the top of the screen on native iOS to eliminate the sky gap.

**Architecture:** Modify the `#cockpit-ui` styling in the mobile media query to start at `top: 0` and use `padding-top` with `env(safe-area-inset-top)` to push content down. This ensures the dark background covers the notch area.

**Tech Stack:** Vanilla CSS.

---

### Task 1: Update HUD Styling in `style.css`

**Files:**
- Modify: `style.css:742-754`

**Step 1: Modify the `#cockpit-ui` selector in the mobile media query**

Update the styling to anchor to the top and use padding for the safe area.

```css
    #cockpit-ui {
        top: 0;
        bottom: auto;
        left: 0;
        transform: none;
        width: 100%;
        border-radius: 0;
        border-top: none;
        border-left: none;
        border-right: none;
        justify-content: center;
        padding: calc(env(safe-area-inset-top, 0px) + 5px) 10px 5px 10px;
    }
```

**Step 2: Save the file**

**Step 3: Commit**

```bash
git add style.css
git commit -m "style: extend cockpit HUD to top on mobile for iOS safe area"
```

### Task 2: Manual Verification

**Step 1: Instruct user to verify**
The user should run the app on their iOS device/simulator to confirm:
1. The dark background extends to the top of the screen.
2. The cockpit values (TIME, POS, etc.) are below the notch.
