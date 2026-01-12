// bb-tracker-desktop/src/hooks/useWebSocket.ts

import { useState, useEffect, useRef, useCallback } from 'react'
import { ProfileState } from '../lib/types'
import { WS_URL } from '../lib/constants'

interface UseWebSocketOptions {
  profileName: string | null
  password?: string
  onStateUpdate?: (state: ProfileState) => void
  onAuthResult?: (success: boolean, error?: string) => void
  onError?: (error: string) => void
  onTokenResult?: (token: string | null) => void
}

export function useWebSocket({
  profileName,
  password,
  onStateUpdate,
  onAuthResult,
  onError,
  onTokenResult,
}: UseWebSocketOptions) {
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState<ProfileState | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const serverElapsedRef = useRef(0)
  const serverTimeRef = useRef(Date.now())

  // Use refs for callbacks to avoid reconnection on callback changes
  const onStateUpdateRef = useRef(onStateUpdate)
  const onAuthResultRef = useRef(onAuthResult)
  const onErrorRef = useRef(onError)
  const onTokenResultRef = useRef(onTokenResult)
  const passwordRef = useRef(password)
  const authenticatedRef = useRef(authenticated)

  // Keep refs in sync
  useEffect(() => { onStateUpdateRef.current = onStateUpdate }, [onStateUpdate])
  useEffect(() => { onAuthResultRef.current = onAuthResult }, [onAuthResult])
  useEffect(() => { onErrorRef.current = onError }, [onError])
  useEffect(() => { onTokenResultRef.current = onTokenResult }, [onTokenResult])
  useEffect(() => { passwordRef.current = password }, [password])
  useEffect(() => { authenticatedRef.current = authenticated }, [authenticated])

  const connect = useCallback(() => {
    if (!profileName) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_URL}?bloodborne=true&profile=${encodeURIComponent(profileName)}`
    console.log('[WS] Connecting to', url)
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected to', profileName)
      setConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'bb-state') {
          serverElapsedRef.current = msg.elapsed
          serverTimeRef.current = Date.now()

          const newState: ProfileState = {
            profileName: msg.profileName,
            displayName: msg.displayName,
            canEdit: msg.canEdit,
            isPublic: msg.isPublic,
            elapsed: msg.elapsed,
            isRunning: msg.isRunning,
            deaths: msg.deaths,
            deathTimestamps: msg.deathTimestamps || [],
            bossFightMode: msg.bossFightMode,
            bossStartTime: msg.bossStartTime,
            bossDeaths: msg.bossDeaths,
            bossPaused: msg.bossPaused,
            bossSegments: msg.bossSegments || [],
            bossFights: msg.bossFights || [],
            pendingBoss: msg.pendingBoss,
            milestones: msg.milestones || [],
            characterStats: msg.characterStats || [],
            overlayToken: msg.overlayToken,
            // Visual configuration (NEW + LEGACY)
            presetId: msg.presetId || null,
            presetSlug: msg.presetSlug || null,
            profileSettings: msg.profileSettings || null,
          }
          setState(newState)
          onStateUpdateRef.current?.(newState)

          // Auto-auth if password provided and first state
          if (!authenticatedRef.current && passwordRef.current && !msg.canEdit) {
            ws.send(JSON.stringify({ type: 'bb-auth', password: passwordRef.current }))
          }

          // Request token if editor
          if (msg.canEdit && !authenticatedRef.current) {
            setAuthenticated(true)
            ws.send(JSON.stringify({ type: 'bb-get-token' }))
          }
        }

        if (msg.type === 'bb-auth-result') {
          setAuthenticated(msg.success)
          onAuthResultRef.current?.(msg.success, msg.error)
          if (msg.success) {
            ws.send(JSON.stringify({ type: 'bb-get-token' }))
          }
        }

        if (msg.type === 'bb-token-result') {
          onTokenResultRef.current?.(msg.token)
        }

        if (msg.type === 'bb-error') {
          console.error('[WS] Server error:', msg.error)
          onErrorRef.current?.(msg.error)
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setConnected(false)
      setAuthenticated(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000)
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
      onErrorRef.current?.('Connection error')
    }
  }, [profileName]) // Only reconnect when profileName changes

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    wsRef.current?.close()
    wsRef.current = null
    setConnected(false)
    setAuthenticated(false)
  }, [])

  const send = useCallback((type: string, data?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }))
    }
  }, [])

  // Commands
  const auth = useCallback((pwd: string) => send('bb-auth', { password: pwd }), [send])
  const start = useCallback(() => send('bb-start'), [send])
  const stop = useCallback(() => send('bb-stop'), [send])
  const death = useCallback(() => send('bb-death'), [send])
  const bossDeath = useCallback(() => send('bb-boss-death'), [send])
  const bossStart = useCallback(() => send('bb-boss-start'), [send])
  const bossPause = useCallback(() => send('bb-boss-pause'), [send])
  const bossResume = useCallback(() => send('bb-boss-resume'), [send])
  const bossVictory = useCallback((name: string) => send('bb-boss-victory', { name }), [send])
  const bossCancel = useCallback(() => send('bb-boss-cancel'), [send])
  const addMilestone = useCallback((name: string, icon: string) => send('bb-milestone-add', { name, icon }), [send])
  const generateToken = useCallback(() => send('bb-generate-token'), [send])
  const getToken = useCallback(() => send('bb-get-token'), [send])

  // Get interpolated elapsed time for smooth display
  const getElapsed = useCallback(() => {
    if (!state?.isRunning) return state?.elapsed || 0
    return serverElapsedRef.current + (Date.now() - serverTimeRef.current)
  }, [state?.isRunning, state?.elapsed])

  useEffect(() => {
    if (profileName) {
      connect()
    }
    return () => disconnect()
  }, [profileName, connect, disconnect])

  return {
    connected,
    authenticated,
    state,
    send,
    auth,
    start,
    stop,
    death,
    bossDeath,
    bossStart,
    bossPause,
    bossResume,
    bossVictory,
    bossCancel,
    addMilestone,
    generateToken,
    getToken,
    getElapsed,
    disconnect,
  }
}
