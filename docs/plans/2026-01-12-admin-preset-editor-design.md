# Admin Preset Editor — Design Document

**Date:** 2026-01-12
**Status:** Approved

## Overview

Admin-only interface for editing visual presets (Bloodborne, Elden Ring). Accessible via hidden trigger on ProfileList page, requires admin code authentication.

## Key Decisions

| Question | Decision |
|----------|----------|
| Location | Both Web and Desktop (shared components) |
| Authentication | Hidden trigger → admin code → modal |
| Storage | JSON file on server (`presets.json`) |
| Create new presets | No (only edit), but extensible for future |
| Live preview | Yes |
| Update propagation | Automatic to all profiles using the preset |

## Architecture

### Access Flow

```
ProfileList
    └── [hidden trigger: 5x click on title]
            └── AdminCodeInput modal
                    └── POST /api/bb-admin/verify
                            └── Success → AdminPanel modal
```

### Data Flow

```
Admin edits color
    │
    ▼
Local state updates (live preview)
    │
    ▼
Admin clicks Save
    │
    ▼
PUT /api/bb-presets/:slug
    │
    ▼
Server saves to presets.json
    │
    ▼
WebSocket broadcast: bb-preset-updated
    │
    ▼
All clients update cached presets
    │
    ▼
UI re-renders with new themeColors
```

## Storage

**File:** `/opt/cinesync-ws/presets.json`

```json
{
  "presets": {
    "bloodborne": {
      "displayName": "Bloodborne",
      "description": "Dark Victorian horror aesthetic",
      "updatedAt": "2026-01-12T...",
      "config": {
        "colors": {
          "primary": "#F0ECE4",
          "accent": "#C43030",
          "secondary": "#D4A84B",
          "background": "#0B0B0C",
          "cardBg": "#1a1512"
        },
        "timeline": {
          "death": "#C43030",
          "boss": "#D4A84B",
          "milestone": "#8FBAA8",
          "stats": "#808080",
          "progressBar": "#3a2a2a",
          "panelBg": "#1a1512f8"
        },
        "logo": { "enabled": false, "url": null, "position": "top-left", "size": 32 },
        "background": { "type": "color", "color": "#0B0B0C", "imageUrl": null, "blur": 0, "opacity": 0.85 },
        "transparency": 0.75,
        "font": "'Liberation Serif', serif"
      }
    },
    "elden-ring": { ... }
  }
}
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/bb-presets` | No | Get all presets |
| POST | `/api/bb-admin/verify` | No | Verify admin code, get token |
| PUT | `/api/bb-presets/:slug` | Token | Update preset config |

### POST /api/bb-admin/verify

```javascript
// Request
{ "code": "secret-admin-code" }

// Response 200
{ "success": true, "token": "random-token-string" }

// Response 401
{ "success": false, "error": "Invalid code" }
```

### PUT /api/bb-presets/:slug

```javascript
// Headers
Authorization: Bearer <admin-token>

// Request
{ "config": { "colors": {...}, "timeline": {...}, ... } }

// Response 200
{ "success": true }

// Side effect: WebSocket broadcast
{ "type": "bb-preset-updated", "slug": "bloodborne", "config": {...} }
```

## UI Components

```
AdminPanel
├── PresetSelector      (left sidebar - list of presets)
├── ColorEditor         (5 main colors with pickers)
├── TimelineEditor      (6 timeline colors)
├── AdminControls       (Reset to Default, Save buttons)
└── PresetPreview       (mini tracker preview)
```

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  ✕  Admin: Visual Presets                               │
├─────────────┬───────────────────────────────────────────┤
│             │  Colors                                   │
│ Bloodborne  │  [primary] [accent] [secondary] [bg] [card]│
│ ○           │                                           │
│             │  Timeline Colors                          │
│ Elden Ring  │  [death] [boss] [milestone] [stats]       │
│ ●           │                                           │
│             │  [Reset to Default]  [Save]              │
├─────────────┴───────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │  PREVIEW: 12:34:56    42    Boss Mode           │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Styling Requirements

All components must use Tauri WebView normalized styles:

1. **Tailwind classes** with `!important` fixes from `styles.css`
2. **Inline styles** for colors: `style={{ backgroundColor: COLORS.nearBlack }}`
3. **No Tailwind opacity classes** like `bg-black/85` — use `rgba(0, 0, 0, 0.85)`
4. **Fonts inline**: `fontFamily: "'Times New Roman', serif"`

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/presetsApi.ts` | API calls: fetch, verify, update |
| `src/hooks/usePresets.ts` | Load, cache, WebSocket updates |
| `src/components/admin/AdminPanel.tsx` | Main container |
| `src/components/admin/AdminCodeInput.tsx` | Code input modal |
| `src/components/admin/PresetSelector.tsx` | Preset list |
| `src/components/admin/ColorEditor.tsx` | Color pickers |
| `src/components/admin/TimelineEditor.tsx` | Timeline color pickers |
| `src/components/admin/PresetPreview.tsx` | Live preview |

## Files to Modify

| File | Changes |
|------|---------|
| `ws-server.js` (VPS) | Add 3 endpoints + WebSocket handler |
| `src/components/ProfileList.tsx` | Add hidden admin trigger |
| `src/lib/presetUtils.ts` | Use server presets with fallback |
| `src/App.tsx` | Connect usePresets hook |

## Implementation Order

1. **Server**: presets.json + API endpoints
2. **Server**: WebSocket broadcast
3. **Client**: presetsApi.ts + usePresets.ts
4. **Client**: Admin UI components
5. **Client**: Integration in ProfileList
6. **Test**: Full flow
7. **Web**: Sync codebase

## Fallback Behavior

- If server unavailable → use hardcoded `VISUAL_PRESETS` from `types.ts`
- Ensures offline desktop functionality
