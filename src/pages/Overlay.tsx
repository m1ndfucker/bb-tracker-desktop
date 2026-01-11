// src/pages/Overlay.tsx
// Transparent overlay for OBS window capture

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { ProfileSettings } from '../lib/types'

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
  profileSettings?: ProfileSettings | null
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
            profileSettings: msg.profileSettings || null,
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

  // Derive colors from profile settings
  const colors = useMemo(() => {
    if (!state?.profileSettings) {
      return {
        primary: '#f0ece4',
        accent: '#c43030',
        secondary: '#8fbaa8',
        background: '#0b0b0c',
        gray: '#808080',
      }
    }
    return {
      primary: state.profileSettings.colors.primary,
      accent: state.profileSettings.colors.accent,
      secondary: state.profileSettings.colors.secondary,
      background: state.profileSettings.colors.background,
      gray: '#808080',
    }
  }, [state?.profileSettings])

  // Calculate background style with transparency
  const bgStyle = useMemo(() => {
    const transparency = state?.profileSettings?.transparency ?? 0.75
    const bgColor = state?.profileSettings?.colors.background ?? '#0b0b0c'
    // Convert hex to rgba
    const r = parseInt(bgColor.slice(1, 3), 16)
    const g = parseInt(bgColor.slice(3, 5), 16)
    const b = parseInt(bgColor.slice(5, 7), 16)
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${transparency})` }
  }, [state?.profileSettings])

  // Get font from settings
  const fontFamily = state?.profileSettings?.font ?? "'Liberation Serif', serif"

  if (!connected || !state) {
    return (
      <div style={{
        color: colors.gray,
        padding: '10px 16px',
        fontFamily: fontFamily,
        ...bgStyle,
        borderRadius: '6px',
      }}>
        Connecting...
      </div>
    )
  }

  return (
    <div style={{
      fontFamily: fontFamily,
      ...bgStyle,
      borderRadius: '6px',
      position: 'relative',
    }}>
      {/* Logo */}
      {state?.profileSettings?.logo.enabled && state.profileSettings.logo.url && (
        <img
          src={state.profileSettings.logo.url}
          alt=""
          style={{
            position: 'absolute',
            width: state.profileSettings.logo.size,
            height: state.profileSettings.logo.size,
            objectFit: 'contain',
            ...(state.profileSettings.logo.position === 'top-left' && { top: 4, left: 4 }),
            ...(state.profileSettings.logo.position === 'top-right' && { top: 4, right: 4 }),
            ...(state.profileSettings.logo.position === 'bottom-left' && { bottom: 4, left: 4 }),
            ...(state.profileSettings.logo.position === 'bottom-right' && { bottom: 4, right: 4 }),
          }}
        />
      )}

      {/* Death flash overlay */}
      {deathFlash && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: `${colors.accent}66`,
            pointerEvents: 'none',
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}

      <div style={{ padding: '10px 16px' }}>
        {/* Main stats row */}
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          fontSize: style === 'minimal' ? '18px' : '22px',
          marginBottom: state.bossFightMode && style !== 'minimal' ? '6px' : 0,
        }}>
          <span style={{ color: colors.primary }}>
            ⏱ {formatTime(state.elapsed)}
          </span>
          <span style={{ color: colors.accent }}>
            💀 {state.deaths}
          </span>
        </div>

        {/* Boss fight info */}
        {state.bossFightMode && style !== 'minimal' && (
          <div style={{ color: colors.secondary, fontSize: '14px' }}>
            ⚔ Boss Fight ({state.bossDeaths} deaths)
          </div>
        )}

        {/* Last boss (full style only) */}
        {!state.bossFightMode && state.lastBoss && style === 'full' && (
          <div style={{ color: colors.gray, fontSize: '12px', marginTop: '4px' }}>
            Last: {state.lastBoss.name} ({state.lastBoss.deaths} deaths)
          </div>
        )}
      </div>
    </div>
  )
}
