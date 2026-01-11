// bb-tracker-desktop/src/lib/types.ts

export interface BossFightSegment {
  start: number
  end: number
}

export interface BossAttempt {
  id: string
  startTime: number
  endTime: number
  duration: number
  deathsInAttempt: number
  success: boolean
  createdAt: string
}

export interface BossFight {
  id: string
  name: string
  segments: BossFightSegment[]
  duration: number
  deathsOnBoss: number
  deathsTotalBefore: number
  createdAt: string
  startTime: number
  endTime: number
  attempts?: BossAttempt[]
}

export interface Milestone {
  id: string
  type: 'milestone'
  name: string
  timestamp: number
  icon: string
  createdAt: string
}

export interface CharacterStats {
  id: string
  type: 'stats'
  timestamp: number
  level: number
  vitality: number
  endurance: number
  strength: number
  skill: number
  bloodtinge: number
  arcane: number
  bloodEchoes: number
  insight: number
  notes?: string
  createdAt: string
}

export interface DeathTimestamp {
  timestamp: number
  deathNumber: number
  createdAt?: string
}

export interface StatsDelta {
  level: number
  vitality: number
  endurance: number
  strength: number
  skill: number
  bloodtinge: number
  arcane: number
}

export interface DailyStats {
  date: string              // "2026-01-09" ISO date
  displayDate: string       // "9 января" Russian format
  playtime: number          // milliseconds
  deaths: number
  stats: CharacterStats | null
  statsDelta: StatsDelta | null
  bosses: BossFight[]
  milestones: Milestone[]
}

export interface PendingBoss {
  bossStartTime: number
  bossStartDeaths: number
  bossDeaths: number
  bossSegments?: { start: number; end: number | null }[]
  bossPaused?: boolean
}

export interface ProfileState {
  profileName: string
  displayName: string
  canEdit: boolean
  isPublic: boolean
  elapsed: number
  isRunning: boolean
  deaths: number
  deathTimestamps: DeathTimestamp[]
  bossFightMode: boolean
  bossStartTime: number | null
  bossDeaths: number
  bossPaused: boolean
  bossSegments: { start: number; end: number | null }[]
  bossFights: BossFight[]
  pendingBoss: PendingBoss | null
  milestones: Milestone[]
  characterStats: CharacterStats[]
  overlayToken?: string | null
  profileSettings?: ProfileSettings | null
}

export interface AppSettings {
  lastProfile: string
  savedCredentials: Record<string, { password: string; rememberMe: boolean }>
  hotkeys: HotkeyConfig
  window: WindowConfig
}

export interface HotkeyConfig {
  death: string
  timer: string
  boss: string
  milestone: string
  enabled: boolean
}

export interface WindowConfig {
  startMinimized: boolean
  alwaysOnTop: boolean
  launchAtStartup: boolean
  bounds?: { x: number; y: number; width: number; height: number }
}

// Timeline interactive point types
export interface DeathPoint {
  index: number
  deathNumber: number  // chronological number (1st, 2nd, etc.)
}

export interface TimelinePoint {
  id: string
  type: 'boss' | 'milestone' | 'stats' | 'death'
  time: number        // position on timeline (ms)
  endTime?: number    // only for boss (end of fight)
  data: BossFight | Milestone | CharacterStats | DeathPoint
}

// ============================================================================
// Profile Settings / Theming
// ============================================================================

// Color settings for UI theming
export interface ProfileColors {
  primary: string      // Timer, main text (#f0ece4)
  accent: string       // Deaths, important (#c43030)
  secondary: string    // Boss info, hints (#8fbaa8)
  background: string   // Background color (#0b0b0c)
  cardBg: string       // Card backgrounds (#1a1a1a)
}

// Logo configuration
export interface ProfileLogo {
  enabled: boolean
  url: string | null
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  size: number  // 24-128px
}

// Background configuration
export interface ProfileBackground {
  type: 'color' | 'image'
  color: string
  imageUrl: string | null
  blur: number     // 0-20px
  opacity: number  // 0-1
}

// Complete profile settings
export interface ProfileSettings {
  colors: ProfileColors
  logo: ProfileLogo
  background: ProfileBackground
  transparency: number  // 0-1
  font: string
  preset: 'bloodborne' | 'elden-ring' | 'dark-souls' | 'sekiro' | 'custom'
}

// Default settings (Bloodborne theme)
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  colors: {
    primary: '#f0ece4',
    accent: '#c43030',
    secondary: '#8fbaa8',
    background: '#0b0b0c',
    cardBg: '#1a1a1a'
  },
  logo: {
    enabled: false,
    url: null,
    position: 'top-left',
    size: 32
  },
  background: {
    type: 'color',
    color: '#0b0b0c',
    imageUrl: null,
    blur: 0,
    opacity: 0.85
  },
  transparency: 0.75,
  font: "'Liberation Serif', serif",
  preset: 'bloodborne'
}

// Theme presets
export const PROFILE_PRESETS: Record<string, Partial<ProfileSettings>> = {
  'bloodborne': {
    colors: { primary: '#f0ece4', accent: '#c43030', secondary: '#8fbaa8', background: '#0b0b0c', cardBg: '#1a1a1a' },
    preset: 'bloodborne'
  },
  'elden-ring': {
    colors: { primary: '#d4af37', accent: '#8b0000', secondary: '#c9a227', background: '#0a0a0a', cardBg: '#1a1510' },
    preset: 'elden-ring'
  },
  'dark-souls': {
    colors: { primary: '#ff6600', accent: '#cc0000', secondary: '#ffcc00', background: '#0d0d0d', cardBg: '#1a1a1a' },
    preset: 'dark-souls'
  },
  'sekiro': {
    colors: { primary: '#e63946', accent: '#1d3557', secondary: '#f1faee', background: '#0a0a0a', cardBg: '#1a1a1a' },
    preset: 'sekiro'
  }
}
