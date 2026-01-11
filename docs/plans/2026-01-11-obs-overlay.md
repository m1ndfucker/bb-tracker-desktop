# OBS Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OBS overlay support with two options: copy web overlay URL and native transparent Tauri window.

**Architecture:**
1. Web overlay URL copying uses existing `overlayToken` from WebSocket state
2. Native overlay opens a new transparent Tauri window via `WebviewWindow` API
3. Overlay page is a new React route (`/overlay`) with minimal UI synced via WebSocket

**Tech Stack:** Tauri 2.0 WebviewWindow API, React, TypeScript, WebSocket

---

## Part 1: Web Overlay URL Copy Button

### Task 1: Add Overlay URL Section to UI

**Files:**
- Modify: `src/App.tsx` (after Save/Load/Export buttons section, around line 2836)

**Step 1: Add overlay URL state and copy handler**

Find the save/load buttons section and add overlay controls above it. Add these after the `handleExport` callback (around line 604):

```typescript
const handleCopyOverlayUrl = useCallback(() => {
  const token = state?.overlayToken
  const baseUrl = `https://watch.home.kg/bloodborne/${profileName}/overlay`
  const url = token ? `${baseUrl}?token=${token}` : baseUrl
  navigator.clipboard.writeText(url)
  toast('Overlay URL copied!')
}, [profileName, state?.overlayToken, toast])

const handleGenerateToken = useCallback(() => {
  requireAuth(() => send('bb-generate-token'))
}, [requireAuth, send])
```

**Step 2: Add UI for overlay URL**

Find the `{/* Save/Load/Export buttons */}` section (around line 2836) and add overlay section BEFORE it:

```tsx
{/* OBS Overlay Section */}
<div className="fixed bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity z-50">
  <span className="text-xs" style={{ color: COLORS.fogGray }}>OBS:</span>
  <motion.button
    onClick={handleCopyOverlayUrl}
    className="text-xs px-2 py-0.5 rounded"
    style={{
      color: COLORS.coldGray,
      border: `1px solid ${COLORS.fogGray}40`
    }}
    whileHover={{ borderColor: COLORS.bossAmber, color: COLORS.bossAmber }}
  >
    Copy URL
  </motion.button>
  <motion.button
    onClick={handleGenerateToken}
    className="text-xs px-2 py-0.5 rounded"
    style={{
      color: COLORS.coldGray,
      border: `1px solid ${COLORS.fogGray}40`
    }}
    whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.bloodRed }}
  >
    {state?.overlayToken ? 'Regenerate' : 'Generate'} Token
  </motion.button>
</div>
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 4: Test manually**

Run: `npm run tauri dev`
Expected: OBS section visible at bottom center, Copy URL and Generate Token buttons work

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add OBS overlay URL copy button"
```

---

## Part 2: Native Tauri Overlay Window

### Task 2: Add Tauri Window Permissions

**Files:**
- Modify: `src-tauri/capabilities/default.json`

**Step 1: Add window creation permissions**

Replace the entire file:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": [
    "main",
    "overlay"
  ],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-close",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-decorations",
    "core:window:allow-set-size",
    "core:window:allow-set-position",
    "core:window:allow-show",
    "core:window:allow-hide",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "global-shortcut:allow-unregister-all",
    "global-shortcut:allow-is-registered"
  ]
}
```

**Step 2: Commit**

```bash
git add src-tauri/capabilities/default.json
git commit -m "feat: add Tauri window permissions for overlay"
```

---

### Task 3: Create Overlay Component

**Files:**
- Create: `src/pages/Overlay.tsx`

**Step 1: Create the overlay component file**

```tsx
// src/pages/Overlay.tsx
// Transparent overlay for OBS window capture

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const COLORS = {
  bone: '#f0ece4',
  red: '#c43030',
  teal: '#8fbaa8',
  gray: '#808080',
}

const WS_URL = 'wss://watch.home.kg/ws'

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

interface OverlayState {
  elapsed: number
  isRunning: boolean
  deaths: number
  bossFightMode: boolean
  bossDeaths: number
  lastBoss?: {
    name: string
    deaths: number
    duration: number
  }
}

interface OverlayProps {
  profileName: string
  token?: string
  style?: 'minimal' | 'compact' | 'full'
}

export function Overlay({ profileName, token, style = 'compact' }: OverlayProps) {
  const [state, setState] = useState<OverlayState | null>(null)
  const [connected, setConnected] = useState(false)
  const [deathFlash, setDeathFlash] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const serverElapsedRef = useRef(0)
  const serverTimeRef = useRef(Date.now())
  const prevDeathsRef = useRef(0)

  // WebSocket connection
  useEffect(() => {
    const url = `${WS_URL}?bloodborne=true&profile=${encodeURIComponent(profileName)}${token ? `&overlay_token=${encodeURIComponent(token)}` : ''}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'bb-state') {
          serverElapsedRef.current = msg.elapsed
          serverTimeRef.current = Date.now()

          const bossFights = msg.bossFights || []
          const lastBoss = bossFights.length > 0 ? bossFights[bossFights.length - 1] : null

          setState({
            elapsed: msg.elapsed,
            isRunning: msg.isRunning,
            deaths: msg.deaths,
            bossFightMode: msg.bossFightMode,
            bossDeaths: msg.bossDeaths || 0,
            lastBoss: lastBoss ? {
              name: lastBoss.name,
              deaths: lastBoss.deathsOnBoss,
              duration: lastBoss.duration,
            } : undefined,
          })
        }
      } catch (e) {
        console.error('[Overlay] Parse error:', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current === ws) wsRef.current = null
      }, 3000)
    }

    return () => ws.close()
  }, [profileName, token])

  // Update elapsed time locally
  useEffect(() => {
    if (!state?.isRunning) return
    const interval = setInterval(() => {
      const elapsed = serverElapsedRef.current + (Date.now() - serverTimeRef.current)
      setState(prev => prev ? { ...prev, elapsed } : null)
    }, 100)
    return () => clearInterval(interval)
  }, [state?.isRunning])

  // Death flash
  useEffect(() => {
    if (state && state.deaths > prevDeathsRef.current && prevDeathsRef.current > 0) {
      setDeathFlash(true)
      setTimeout(() => setDeathFlash(false), 500)
    }
    if (state) prevDeathsRef.current = state.deaths
  }, [state?.deaths])

  if (!connected || !state) {
    return (
      <div style={{
        color: COLORS.gray,
        padding: '15px 25px',
        fontFamily: "'Liberation Serif', serif"
      }}>
        Connecting...
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Liberation Serif', serif" }}>
      {/* Death flash overlay */}
      {deathFlash && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(196, 48, 48, 0.3)',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}

      <div style={{ padding: '15px 25px' }}>
        {/* Main stats row */}
        <div style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'center',
          fontSize: style === 'minimal' ? '20px' : '24px',
          marginBottom: state.bossFightMode && style !== 'minimal' ? '8px' : 0,
        }}>
          <span style={{ color: COLORS.bone }}>
            ⏱ {formatTime(state.elapsed)}
          </span>
          <span style={{ color: COLORS.red }}>
            💀 {state.deaths}
          </span>
        </div>

        {/* Boss fight info */}
        {state.bossFightMode && style !== 'minimal' && (
          <div style={{ color: COLORS.teal, fontSize: '16px' }}>
            ⚔ Boss Fight ({state.bossDeaths} deaths)
          </div>
        )}

        {/* Last boss (full style only) */}
        {!state.bossFightMode && state.lastBoss && style === 'full' && (
          <div style={{ color: COLORS.gray, fontSize: '14px', marginTop: '4px' }}>
            Last: {state.lastBoss.name} ✓ ({state.lastBoss.deaths} deaths)
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/pages/Overlay.tsx
git commit -m "feat: add Overlay component for native window"
```

---

### Task 4: Create Overlay Window Page

**Files:**
- Create: `src/pages/OverlayWindow.tsx`

**Step 1: Create wrapper page that reads URL params**

```tsx
// src/pages/OverlayWindow.tsx
// Entry point for overlay Tauri window

import { useEffect } from 'react'
import { Overlay } from './Overlay'

export function OverlayWindow() {
  const params = new URLSearchParams(window.location.search)
  const profileName = params.get('profile') || ''
  const token = params.get('token') || undefined
  const style = (params.get('style') || 'compact') as 'minimal' | 'compact' | 'full'

  // Make body transparent for OBS capture
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    // Disable window dragging except on specific elements
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  if (!profileName) {
    return (
      <div style={{
        color: '#c43030',
        padding: '20px',
        fontFamily: "'Liberation Serif', serif"
      }}>
        No profile specified
      </div>
    )
  }

  return <Overlay profileName={profileName} token={token} style={style} />
}
```

**Step 2: Commit**

```bash
git add src/pages/OverlayWindow.tsx
git commit -m "feat: add OverlayWindow entry point"
```

---

### Task 5: Add Overlay Route

**Files:**
- Modify: `src/App.tsx` (add route handling at the very top of the component)

**Step 1: Import OverlayWindow**

Add import at top of file (after other imports, around line 10):

```typescript
import { OverlayWindow } from './pages/OverlayWindow'
```

**Step 2: Add route check at start of App component**

Right after `function App() {` (around line 115), add:

```typescript
  // Check if this is the overlay window
  if (window.location.pathname === '/overlay' || window.location.search.includes('overlay=true')) {
    return <OverlayWindow />
  }
```

**Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add overlay route handling"
```

---

### Task 6: Add Open Overlay Window Button

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add Tauri window import**

Add at the very top of the file (after React imports):

```typescript
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
```

**Step 2: Add open overlay handler**

After `handleGenerateToken` callback (around line 608), add:

```typescript
const handleOpenOverlay = useCallback(async () => {
  const token = state?.overlayToken
  const url = `/overlay?profile=${encodeURIComponent(profileName || '')}&style=compact${token ? `&token=${encodeURIComponent(token)}` : ''}`

  try {
    // Check if overlay window already exists
    const existing = await WebviewWindow.getByLabel('overlay')
    if (existing) {
      await existing.show()
      await existing.setFocus()
      return
    }

    // Create new overlay window
    new WebviewWindow('overlay', {
      url,
      title: 'BB Tracker Overlay',
      width: 350,
      height: 80,
      resizable: true,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
    })
  } catch (e) {
    console.error('Failed to open overlay:', e)
    toast('Failed to open overlay window')
  }
}, [profileName, state?.overlayToken, toast])
```

**Step 3: Add button to UI**

Update the OBS Overlay Section (from Task 1) to include the new button:

```tsx
{/* OBS Overlay Section */}
<div className="fixed bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-40 hover:opacity-80 transition-opacity z-50">
  <span className="text-xs" style={{ color: COLORS.fogGray }}>OBS:</span>
  <motion.button
    onClick={handleOpenOverlay}
    className="text-xs px-2 py-0.5 rounded"
    style={{
      color: COLORS.boneWhite,
      border: `1px solid ${COLORS.fogGray}40`,
      backgroundColor: `${COLORS.fogGray}20`
    }}
    whileHover={{ borderColor: COLORS.bossAmber, color: COLORS.bossAmber }}
  >
    Open Window
  </motion.button>
  <motion.button
    onClick={handleCopyOverlayUrl}
    className="text-xs px-2 py-0.5 rounded"
    style={{
      color: COLORS.coldGray,
      border: `1px solid ${COLORS.fogGray}40`
    }}
    whileHover={{ borderColor: COLORS.bossAmber, color: COLORS.bossAmber }}
  >
    Copy URL
  </motion.button>
  <motion.button
    onClick={handleGenerateToken}
    className="text-xs px-2 py-0.5 rounded"
    style={{
      color: COLORS.coldGray,
      border: `1px solid ${COLORS.fogGray}40`
    }}
    whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.bloodRed }}
  >
    {state?.overlayToken ? 'New Token' : 'Get Token'}
  </motion.button>
</div>
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add Open Overlay Window button with Tauri integration"
```

---

### Task 7: Configure Transparent Window in Tauri

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Enable transparent windows**

Update the `app` section:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "BB Tracker",
  "version": "0.1.0",
  "identifier": "com.cinesync.bb-tracker",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Bloodborne Death Tracker",
        "width": 800,
        "height": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    },
    "macOSPrivateApi": true
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

Note: `macOSPrivateApi: true` is required for transparent windows on macOS.

**Step 2: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: enable macOSPrivateApi for transparent overlay windows"
```

---

### Task 8: Add Overlay Window to Tray Menu

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Add overlay menu item**

Update the tray menu creation:

```rust
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let overlay_item = MenuItem::with_id(app, "overlay", "Toggle Overlay", true, None::<&str>)?;
            let separator = MenuItem::with_id(app, "sep", "─────────", false, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &overlay_item, &separator, &quit_item])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("BB Tracker")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "overlay" => {
                        // Toggle overlay window
                        if let Some(window) = app.get_webview_window("overlay") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 2: Build Tauri to verify**

Run: `cd src-tauri && cargo build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add Toggle Overlay to tray menu"
```

---

### Task 9: Final Integration Test

**Step 1: Full rebuild**

Run: `npm run build && cd src-tauri && cargo build`
Expected: Both builds succeed

**Step 2: Run application**

Run: `npm run tauri dev`

**Step 3: Test checklist**

- [ ] OBS section visible at bottom center of main window
- [ ] "Copy URL" copies overlay URL to clipboard
- [ ] "Get Token" generates new overlay token
- [ ] "Open Window" opens transparent overlay window
- [ ] Overlay window shows timer and deaths
- [ ] Overlay window stays on top
- [ ] Overlay window has no decorations (frameless)
- [ ] Tray menu "Toggle Overlay" shows/hides overlay
- [ ] Death in main window triggers flash in overlay

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete OBS overlay implementation"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Overlay URL copy button | `App.tsx` |
| 2 | Tauri window permissions | `capabilities/default.json` |
| 3 | Overlay component | `pages/Overlay.tsx` |
| 4 | Overlay window page | `pages/OverlayWindow.tsx` |
| 5 | Overlay route | `App.tsx` |
| 6 | Open overlay button | `App.tsx` |
| 7 | Transparent window config | `tauri.conf.json` |
| 8 | Tray menu integration | `lib.rs` |
| 9 | Integration test | - |
