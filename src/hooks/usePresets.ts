// usePresets hook - Load, cache, and sync visual presets
// Listens for WebSocket bb-preset-updated broadcasts

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPresets, PresetsData, PresetConfig } from '../lib/presetsApi'
import { VISUAL_PRESETS } from '../lib/types'

// Default fallback presets from VISUAL_PRESETS in types.ts
const DEFAULT_PRESETS: PresetsData = {
  presets: {
    'bloodborne': {
      displayName: 'Bloodborne',
      description: 'Dark Victorian horror aesthetic',
      updatedAt: new Date().toISOString(),
      config: {
        colors: VISUAL_PRESETS['bloodborne'].config.colors,
        timeline: VISUAL_PRESETS['bloodborne'].config.timeline,
        logo: VISUAL_PRESETS['bloodborne'].config.logo,
        background: VISUAL_PRESETS['bloodborne'].config.background,
        transparency: VISUAL_PRESETS['bloodborne'].config.transparency,
        font: VISUAL_PRESETS['bloodborne'].config.font
      }
    },
    'elden-ring': {
      displayName: 'Elden Ring',
      description: 'Golden fantasy RPG aesthetic',
      updatedAt: new Date().toISOString(),
      config: {
        colors: VISUAL_PRESETS['elden-ring'].config.colors,
        timeline: VISUAL_PRESETS['elden-ring'].config.timeline,
        logo: VISUAL_PRESETS['elden-ring'].config.logo,
        background: VISUAL_PRESETS['elden-ring'].config.background,
        transparency: VISUAL_PRESETS['elden-ring'].config.transparency,
        font: VISUAL_PRESETS['elden-ring'].config.font
      }
    }
  }
}

interface UsePresetsOptions {
  // WebSocket connection (optional) - for real-time updates
  ws?: WebSocket | null
}

interface UsePresetsReturn {
  presets: PresetsData
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  getPresetConfig: (slug: string) => PresetConfig | null
}

export function usePresets(options: UsePresetsOptions = {}): UsePresetsReturn {
  const { ws } = options

  const [presets, setPresets] = useState<PresetsData>(DEFAULT_PRESETS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Load presets from server
  const loadPresets = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchPresets()
      if (mountedRef.current) {
        setPresets(data)
      }
    } catch (err) {
      console.warn('[usePresets] Failed to load from server, using defaults:', err)
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load presets')
        // Keep using default presets
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Initial load
  useEffect(() => {
    mountedRef.current = true
    loadPresets()
    return () => {
      mountedRef.current = false
    }
  }, [loadPresets])

  // Listen for WebSocket updates
  useEffect(() => {
    if (!ws) return

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'bb-preset-updated') {
          const { slug, config, updatedAt } = data
          console.log('[usePresets] Received preset update:', slug)

          setPresets(prev => ({
            ...prev,
            presets: {
              ...prev.presets,
              [slug]: {
                ...prev.presets[slug],
                config,
                updatedAt
              }
            }
          }))
        }
      } catch {
        // Not JSON or not our message, ignore
      }
    }

    ws.addEventListener('message', handleMessage)
    return () => {
      ws.removeEventListener('message', handleMessage)
    }
  }, [ws])

  // Get preset config by slug
  const getPresetConfig = useCallback((slug: string): PresetConfig | null => {
    return presets.presets[slug]?.config ?? null
  }, [presets])

  return {
    presets,
    loading,
    error,
    refresh: loadPresets,
    getPresetConfig
  }
}
