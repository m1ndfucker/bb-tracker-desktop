// bb-tracker-desktop/src/lib/constants.ts

// Bloodborne color palette - gothic but readable
export const COLORS = {
  nearBlack: '#0b0b0c',
  coldGray: '#b0b0b0',
  boneWhite: '#f0ece4',
  bloodRed: '#c43030',
  bloodRedDark: '#8a2020',
  bloodRedGlow: '#6a1818',
  ashGray: '#808080',
  fogGray: '#4a4a4a',
  bossAmber: '#8fbaa8',      // Pale teal (like "PREY SLAUGHTERED" text)
  bossAmberDark: '#6a9a88',
}

// Always use production server (server is only on production)
export const BASE_URL = 'https://watch.home.kg'
export const WS_URL = 'wss://watch.home.kg/ws'

export const DEFAULT_HOTKEYS = {
  death: 'CommandOrControl+Shift+D',
  timer: 'CommandOrControl+Shift+Space',
  boss: 'CommandOrControl+Shift+B',
  milestone: 'CommandOrControl+Shift+M',
  enabled: true,
}

export const DEFAULT_WINDOW_CONFIG = {
  startMinimized: false,
  alwaysOnTop: false,
  launchAtStartup: false,
}

export const MILESTONE_ICONS = ['★', '⚑', '🔑', '💎', '🗡️', '📍', '🏆', '🎯']

export const STAT_ICONS: Record<string, string> = {
  level: '/images/stats/level.webp',
  vitality: '/images/stats/vitality.webp',
  endurance: '/images/stats/endurance.webp',
  strength: '/images/stats/strength.webp',
  skill: '/images/stats/skill.webp',
  bloodtinge: '/images/stats/bloodtinge.webp',
  arcane: '/images/stats/arcane.webp',
  bloodEchoes: '/images/stats/echoes.webp',
  insight: '/images/stats/insight.webp'
}

// Time formatting
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
