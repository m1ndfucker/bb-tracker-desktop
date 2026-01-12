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

// ============================================================================
// Character Stats (Game-specific)
// ============================================================================

// Bloodborne character stats
export interface CharacterStats {
  id: string
  type: 'stats'
  game?: 'bloodborne'  // Optional for backward compatibility with existing data
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

// Elden Ring character stats
export interface EldenRingCharacterStats {
  id: string
  type: 'stats'
  game: 'elden-ring'
  timestamp: number
  level: number
  vigor: number
  mind: number
  endurance: number
  strength: number
  dexterity: number
  intelligence: number
  faith: number
  arcane: number
  runes: number
  notes?: string
  createdAt: string
}

// Union type for any game's character stats
export type GameCharacterStats = CharacterStats | EldenRingCharacterStats

export interface DeathTimestamp {
  timestamp: number
  deathNumber: number
  createdAt?: string
}

// ============================================================================
// Stats Delta (Game-specific, for showing stat changes)
// ============================================================================

// Bloodborne stats delta
export interface StatsDelta {
  level: number
  vitality: number
  endurance: number
  strength: number
  skill: number
  bloodtinge: number
  arcane: number
}

// Elden Ring stats delta
export interface EldenRingStatsDelta {
  level: number
  vigor: number
  mind: number
  endurance: number
  strength: number
  dexterity: number
  intelligence: number
  faith: number
  arcane: number
}

// Union type for any game's stats delta
export type GameStatsDelta = StatsDelta | EldenRingStatsDelta

// ============================================================================
// Type Guards for Game Stats
// ============================================================================

/**
 * Type guard to check if stats are Bloodborne stats
 * Returns true if game is 'bloodborne' or undefined (for backward compatibility)
 */
export function isBloodborneStats(stats: GameCharacterStats): stats is CharacterStats {
  return stats.game === 'bloodborne' || stats.game === undefined
}

/**
 * Type guard to check if stats are Elden Ring stats
 */
export function isEldenRingStats(stats: GameCharacterStats): stats is EldenRingCharacterStats {
  return stats.game === 'elden-ring'
}

/**
 * Type guard to check if delta is Bloodborne stats delta
 */
export function isBloodborneStatsDelta(delta: GameStatsDelta): delta is StatsDelta {
  return 'vitality' in delta && 'skill' in delta && 'bloodtinge' in delta
}

/**
 * Type guard to check if delta is Elden Ring stats delta
 */
export function isEldenRingStatsDelta(delta: GameStatsDelta): delta is EldenRingStatsDelta {
  return 'vigor' in delta && 'mind' in delta && 'dexterity' in delta
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

  // Visual configuration
  // NEW: Preset reference (preferred)
  presetId?: string | null
  presetSlug?: PresetSlug | null
  // LEGACY: Embedded settings (for backward compatibility)
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
// Visual Preset System (Admin-controlled)
// ============================================================================

// Preset type identifier
export type PresetSlug = 'bloodborne' | 'elden-ring' | 'custom'

// ============================================================================
// Visual Configuration Components
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
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  size: number    // maxWidth в пикселях (48-300px)
  offset: number  // отступ от края (8-48px, default 16)
}

// Background configuration
export interface ProfileBackground {
  type: 'color' | 'image'
  color: string
  imageUrl: string | null
  blur: number     // 0-20px
  opacity: number  // 0-1
}

// Timeline colors configuration
export interface TimelineColors {
  death: string       // 💀 death points (#c43030)
  boss: string        // ⚔ boss points (#8fbaa8)
  milestone: string   // 🏆 milestone points (#22c55e)
  stats: string       // 📊 stats points (#ec4899)
  progressBar: string // progress bar fill (#4a4a4a)
  panelBg: string     // panel background (#0b0b0cf8)
}

// Visual configuration data (all visual parameters)
// This is the core visual data, used both in legacy ProfileSettings and new VisualPreset
export interface VisualConfig {
  colors: ProfileColors
  timeline: TimelineColors
  logo: ProfileLogo
  background: ProfileBackground
  transparency: number  // 0-1
  font: string
}

// Complete profile settings (LEGACY - for backward compatibility)
// Will be replaced by presetId reference in new system
export interface ProfileSettings extends VisualConfig {
  preset: PresetSlug
}

// ============================================================================
// Visual Preset (NEW - Admin-controlled)
// ============================================================================

// Full visual preset entity with metadata
export interface VisualPreset {
  // Metadata
  id: string              // Unique identifier (e.g., "preset_bloodborne_v1")
  slug: PresetSlug        // URL-friendly name: "bloodborne"
  displayName: string     // UI display: "Bloodborne"
  description?: string    // Optional description
  version: number         // For safe updates (starts at 1)
  createdAt: string       // ISO timestamp
  updatedAt: string       // ISO timestamp

  // Visual configuration (all 22 parameters)
  config: VisualConfig
}

// Preset reference in profile (what users select)
export interface PresetReference {
  presetId: string        // References VisualPreset.id
  presetSlug: PresetSlug  // For quick display without fetching
}

// ============================================================================
// Visual Preset Definitions (Admin-controlled, centralized)
// ============================================================================

// Default visual config (Bloodborne base)
const DEFAULT_VISUAL_CONFIG: VisualConfig = {
  colors: {
    primary: '#f0ece4',
    accent: '#c43030',
    secondary: '#8fbaa8',
    background: '#0b0b0c',
    cardBg: '#1a1a1a'
  },
  timeline: {
    death: '#c43030',
    boss: '#8fbaa8',
    milestone: '#f0ece4',
    stats: '#a89984',
    progressBar: '#4a4a4a',
    panelBg: '#0b0b0cf8'
  },
  logo: {
    enabled: false,
    url: null,
    position: 'top-left',
    size: 128,
    offset: 16
  },
  background: {
    type: 'color',
    color: '#0b0b0c',
    imageUrl: null,
    blur: 0,
    opacity: 0.85
  },
  transparency: 0.75,
  font: "'Liberation Serif', serif"
}

// Full visual presets with metadata (NEW SYSTEM)
export const VISUAL_PRESETS: Record<PresetSlug, VisualPreset> = {
  'bloodborne': {
    id: 'preset_bloodborne_v1',
    slug: 'bloodborne',
    displayName: 'Bloodborne',
    description: 'Dark Victorian horror aesthetic with blood red accents',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    config: {
      colors: {
        primary: '#f0ece4',     // Bone white
        accent: '#c43030',      // Blood red
        secondary: '#8fbaa8',   // Hunter teal
        background: '#0b0b0c',  // Yharnam night
        cardBg: '#1a1a1a'
      },
      timeline: {
        death: '#c43030',       // = accent
        boss: '#8fbaa8',        // = secondary
        milestone: '#f0ece4',   // = primary
        stats: '#a89984',
        progressBar: '#4a4a4a',
        panelBg: '#0b0b0cf8'
      },
      logo: {
        enabled: false,
        url: null,
        position: 'top-left',
        size: 128,
        offset: 16
      },
      background: {
        type: 'color',
        color: '#0b0b0c',
        imageUrl: null,
        blur: 0,
        opacity: 0.85
      },
      transparency: 0.75,
      font: "'Liberation Serif', serif"
    }
  },
  'elden-ring': {
    id: 'preset_elden_ring_v1',
    slug: 'elden-ring',
    displayName: 'Elden Ring',
    description: 'Golden age fantasy with muted earth tones',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    config: {
      colors: {
        primary: '#D6D1C4',     // Aged parchment
        accent: '#C9A24D',      // Erdtree gold
        secondary: '#5E6A6F',   // Ashen grey
        background: '#0B0B0B',  // Void black
        cardBg: '#1C1612'       // Dark umber
      },
      timeline: {
        death: '#C9A24D',       // = accent (gold)
        boss: '#5E6A6F',        // = secondary
        milestone: '#D6D1C4',   // = primary
        stats: '#8a7f6d',
        progressBar: '#3a3530',
        panelBg: '#1C1612f8'
      },
      logo: {
        enabled: false,
        url: null,
        position: 'top-left',
        size: 128,
        offset: 16
      },
      background: {
        type: 'color',
        color: '#0B0B0B',
        imageUrl: null,
        blur: 0,
        opacity: 0.85
      },
      transparency: 0.75,
      font: "'Liberation Serif', serif"
    }
  },
  'custom': {
    id: 'preset_custom_v1',
    slug: 'custom',
    displayName: 'Custom',
    description: 'User-customized preset (legacy)',
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    config: DEFAULT_VISUAL_CONFIG
  }
}

// Default preset ID
export const DEFAULT_PRESET_ID = 'preset_bloodborne_v1'
export const DEFAULT_PRESET_SLUG: PresetSlug = 'bloodborne'

// Get preset by ID or slug
export function getPresetById(id: string): VisualPreset | null {
  return Object.values(VISUAL_PRESETS).find(p => p.id === id) || null
}

export function getPresetBySlug(slug: PresetSlug): VisualPreset {
  return VISUAL_PRESETS[slug] || VISUAL_PRESETS['bloodborne']
}

// ============================================================================
// Legacy Support (backward compatibility)
// ============================================================================

// Default settings (LEGACY - for backward compatibility)
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  ...DEFAULT_VISUAL_CONFIG,
  preset: 'bloodborne'
}

// Theme presets (LEGACY - for backward compatibility with old code)
export const PROFILE_PRESETS: Record<string, Partial<ProfileSettings>> = {
  'bloodborne': {
    ...VISUAL_PRESETS['bloodborne'].config,
    preset: 'bloodborne'
  },
  'elden-ring': {
    ...VISUAL_PRESETS['elden-ring'].config,
    preset: 'elden-ring'
  }
}
