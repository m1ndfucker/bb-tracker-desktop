# BB Tracker Desktop

Tauri 2.0 desktop app for Bloodborne Death Tracker.

## Development

### Start dev server
```bash
# From Claude Code (PATH may not include cargo):
PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" npm run tauri dev

# From regular terminal:
npm run tauri dev
```

### Build
```bash
npm run build        # TypeScript + Vite only
npm run tauri build  # Full production build
```

## Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Desktop:** Tauri 2.0 (Rust)
- **Animations:** Framer Motion
- **WebSocket:** wss://watch.home.kg/ws

## Key Files
- `src/App.tsx` - Main tracker UI
- `src/components/ProfileList.tsx` - Profile selection page
- `src/hooks/useWebSocket.ts` - WebSocket connection with auth
- `src/hooks/useHotkeys.ts` - Global keyboard shortcuts
- `src/lib/constants.ts` - Colors, URLs, defaults
- `src/lib/types.ts` - TypeScript types

## Auth Flow
1. Profile selected -> password loaded from localStorage (`bb-password-{name}`)
2. useWebSocket receives password -> auto-sends `bb-auth` if `canEdit=false`
3. Edit action without `canEdit` -> Auth modal appears
4. Successful auth -> password saved to localStorage

## Global Hotkeys
- `Ctrl+Shift+D` - Death
- `Ctrl+Shift+Space` - Toggle timer
- `Ctrl+Shift+B` - Boss toggle
- `Ctrl+Shift+M` - Add milestone
