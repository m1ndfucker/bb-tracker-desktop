// Presets API for Admin Panel
// Communicates with /api/bb-presets and /api/bb-admin endpoints

import { BASE_URL } from './constants'

// API base
const API_BASE = BASE_URL

export interface PresetConfig {
  colors: {
    primary: string
    accent: string
    secondary: string
    background: string
    cardBg: string
  }
  timeline: {
    death: string
    boss: string
    milestone: string
    stats: string
    progressBar: string
    panelBg: string
  }
  logo: {
    enabled: boolean
    url: string | null
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
    size: number      // maxWidth в пикселях
    offset: number    // отступ от края (default 16)
  }
  background: {
    type: 'color' | 'image' | 'gradient'
    color: string
    imageUrl: string | null
    blur: number
    opacity: number
  }
  transparency: number
  font: string
}

export interface Preset {
  displayName: string
  description: string
  updatedAt: string
  config: PresetConfig
}

export interface PresetsData {
  presets: Record<string, Preset>
}

// Fetch all presets
export async function fetchPresets(): Promise<PresetsData> {
  const response = await fetch(`${API_BASE}/api/bb-presets`)
  if (!response.ok) {
    throw new Error(`Failed to fetch presets: ${response.status}`)
  }
  return response.json()
}

// Verify admin code and get token
export async function verifyAdminCode(code: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/api/bb-admin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
  return response.json()
}

// Update preset config (requires admin token)
export async function updatePreset(slug: string, config: PresetConfig, token: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_BASE}/api/bb-presets/${slug}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ config })
  })
  return response.json()
}
