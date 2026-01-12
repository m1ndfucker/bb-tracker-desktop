// bb-tracker-desktop/src/lib/presetUtils.ts
// Utility functions for the Visual Preset System

import {
  VisualConfig,
  VisualPreset,
  ProfileSettings,
  ProfileState,
  PresetSlug,
  VISUAL_PRESETS,
  DEFAULT_PROFILE_SETTINGS,
  getPresetById,
  getPresetBySlug
} from './types'

// ============================================================================
// Visual Config Resolution
// ============================================================================

/**
 * Resolves visual configuration from ProfileState
 * Handles both NEW (presetId) and LEGACY (profileSettings) systems
 *
 * Priority:
 * 1. If presetId exists → fetch preset and use its config
 * 2. If profileSettings exists → use legacy embedded settings
 * 3. Fallback → default preset config
 */
export function resolveVisualConfig(state: ProfileState | null): VisualConfig {
  if (!state) {
    return VISUAL_PRESETS['bloodborne'].config
  }

  // NEW SYSTEM: Use preset reference
  if (state.presetId) {
    const preset = getPresetById(state.presetId)
    if (preset) {
      return preset.config
    }
  }

  // Also check presetSlug as fallback
  if (state.presetSlug) {
    const preset = getPresetBySlug(state.presetSlug)
    return preset.config
  }

  // LEGACY SYSTEM: Use embedded profileSettings
  if (state.profileSettings) {
    // Extract VisualConfig from ProfileSettings (remove 'preset' field)
    // Merge with defaults to ensure all fields exist (old profiles may lack 'timeline')
    const defaultConfig = VISUAL_PRESETS['bloodborne'].config
    const { preset: _, ...partialConfig } = state.profileSettings
    return {
      colors: { ...defaultConfig.colors, ...(partialConfig.colors || {}) },
      timeline: { ...defaultConfig.timeline, ...(partialConfig.timeline || {}) },
      logo: { ...defaultConfig.logo, ...(partialConfig.logo || {}) },
      background: { ...defaultConfig.background, ...(partialConfig.background || {}) },
      transparency: partialConfig.transparency ?? defaultConfig.transparency,
      font: partialConfig.font ?? defaultConfig.font
    }
  }

  // FALLBACK: Default preset
  return VISUAL_PRESETS['bloodborne'].config
}

/**
 * Gets the active preset for a profile
 * Returns the full VisualPreset object if using new system,
 * or creates a pseudo-preset from legacy settings
 */
export function getActivePreset(state: ProfileState | null): VisualPreset {
  if (!state) {
    return VISUAL_PRESETS['bloodborne']
  }

  // NEW SYSTEM
  if (state.presetId) {
    const preset = getPresetById(state.presetId)
    if (preset) return preset
  }

  if (state.presetSlug) {
    return getPresetBySlug(state.presetSlug)
  }

  // LEGACY SYSTEM: Convert profileSettings to pseudo-preset
  if (state.profileSettings) {
    const { preset: presetSlug, ...visualConfig } = state.profileSettings
    return {
      id: `legacy_${state.profileName}`,
      slug: presetSlug || 'custom',
      displayName: presetSlug === 'bloodborne' ? 'Bloodborne' :
                   presetSlug === 'elden-ring' ? 'Elden Ring' : 'Custom',
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: visualConfig as VisualConfig
    }
  }

  return VISUAL_PRESETS['bloodborne']
}

// ============================================================================
// Preset Lookup Helpers
// ============================================================================

/**
 * Get all available presets for selection UI
 * Excludes 'custom' as it's not user-selectable in new system
 */
export function getSelectablePresets(): VisualPreset[] {
  return Object.values(VISUAL_PRESETS).filter(p => p.slug !== 'custom')
}

/**
 * Get preset display info for UI
 */
export function getPresetDisplayInfo(presetId: string | null | undefined): {
  name: string
  slug: PresetSlug
} {
  if (!presetId) {
    return { name: 'Bloodborne', slug: 'bloodborne' }
  }

  const preset = getPresetById(presetId)
  if (preset) {
    return { name: preset.displayName, slug: preset.slug }
  }

  return { name: 'Unknown', slug: 'bloodborne' }
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Converts legacy ProfileSettings to a preset reference
 * Used during migration from old system to new system
 */
export function migrateSettingsToPresetRef(
  settings: ProfileSettings
): { presetId: string; presetSlug: PresetSlug } {
  // If preset field matches a known preset, use it
  if (settings.preset && settings.preset !== 'custom') {
    const knownPreset = VISUAL_PRESETS[settings.preset]
    if (knownPreset) {
      return {
        presetId: knownPreset.id,
        presetSlug: knownPreset.slug
      }
    }
  }

  // For custom settings, try to find the closest matching preset
  const closestPreset = findClosestPreset(settings)
  return {
    presetId: closestPreset.id,
    presetSlug: closestPreset.slug
  }
}

/**
 * Finds the preset that most closely matches the given settings
 * Uses color distance calculation
 */
function findClosestPreset(settings: ProfileSettings): VisualPreset {
  let closestPreset = VISUAL_PRESETS['bloodborne']
  let minDistance = Infinity

  for (const preset of Object.values(VISUAL_PRESETS)) {
    if (preset.slug === 'custom') continue

    const distance = calculateColorDistance(settings.colors, preset.config.colors)
    if (distance < minDistance) {
      minDistance = distance
      closestPreset = preset
    }
  }

  return closestPreset
}

/**
 * Calculates "distance" between two color configurations
 * Lower = more similar
 */
function calculateColorDistance(
  a: { primary: string; accent: string; secondary: string; background: string; cardBg: string },
  b: { primary: string; accent: string; secondary: string; background: string; cardBg: string }
): number {
  const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '')
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ]
  }

  const colorDiff = (c1: string, c2: string): number => {
    const [r1, g1, b1] = hexToRgb(c1)
    const [r2, g2, b2] = hexToRgb(c2)
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
  }

  return (
    colorDiff(a.primary, b.primary) +
    colorDiff(a.accent, b.accent) +
    colorDiff(a.secondary, b.secondary) +
    colorDiff(a.background, b.background) +
    colorDiff(a.cardBg, b.cardBg)
  )
}

// ============================================================================
// Backward Compatibility
// ============================================================================

/**
 * Merges partial settings with defaults
 * Used for handling legacy profiles that may have incomplete settings
 */
export function mergeWithDefaults(
  settings: Partial<ProfileSettings> | null | undefined
): ProfileSettings {
  if (!settings) {
    return DEFAULT_PROFILE_SETTINGS
  }

  return {
    colors: { ...DEFAULT_PROFILE_SETTINGS.colors, ...(settings.colors || {}) },
    timeline: { ...DEFAULT_PROFILE_SETTINGS.timeline, ...(settings.timeline || {}) },
    logo: { ...DEFAULT_PROFILE_SETTINGS.logo, ...(settings.logo || {}) },
    background: { ...DEFAULT_PROFILE_SETTINGS.background, ...(settings.background || {}) },
    transparency: settings.transparency ?? DEFAULT_PROFILE_SETTINGS.transparency,
    font: settings.font ?? DEFAULT_PROFILE_SETTINGS.font,
    preset: settings.preset ?? DEFAULT_PROFILE_SETTINGS.preset
  }
}
