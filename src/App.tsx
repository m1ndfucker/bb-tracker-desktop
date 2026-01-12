// bb-tracker-desktop/src/App.tsx
// Full port of web version functionality

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWebSocket } from './hooks/useWebSocket'
import { useHotkeys } from './hooks/useHotkeys'
import { COLORS, formatTime, MILESTONE_ICONS, STAT_ICONS, BASE_URL } from './lib/constants'
import type { BossFight, Milestone, CharacterStats, PendingBoss, DailyStats, DeathPoint, TimelinePoint, GameCharacterStats, GameStatsDelta, EldenRingCharacterStats } from './lib/types'
import { isBloodborneStats, isEldenRingStats, isBloodborneStatsDelta, isEldenRingStatsDelta } from './lib/types'
import { ProfileList } from './components/ProfileList'
import { OverlayWindow } from './pages/OverlayWindow'
import { resolveVisualConfig } from './lib/presetUtils'
import { PresetSlug, VISUAL_PRESETS, ProfileSettings } from './lib/types'

type AppView = 'profiles' | 'tracker'

// Russian month names for daily stats display
const MONTH_NAMES_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_NAMES_RU[d.getMonth()]}`
}

// Short date format for charts (e.g., "Янв 9")
const MONTH_NAMES_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  return `${MONTH_NAMES_SHORT[month - 1]} ${day}`
}

// Get last stats entry per day for level chart
function getStatsByDay(stats: GameCharacterStats[]): { date: string; stats: GameCharacterStats }[] {
  const byDay = new Map<string, GameCharacterStats>()

  const sorted = [...stats].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (const stat of sorted) {
    const date = stat.createdAt.split('T')[0] // Extract YYYY-MM-DD
    byDay.set(date, stat) // overwrite = keep last
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, stats }))
}

// Parse time input (supports "1:30:00", "90:00", "5400", "1h30m")
function parseTimeInput(input: string): number {
  const trimmed = input.trim()
  if (!trimmed) return 0

  // "1h30m" format
  const hmsMatch = trimmed.match(/^(\d+)h(?:(\d+)m)?(?:(\d+)s)?$/)
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1]) || 0
    const m = parseInt(hmsMatch[2]) || 0
    const s = parseInt(hmsMatch[3]) || 0
    return (h * 3600 + m * 60 + s) * 1000
  }

  // "HH:MM:SS" or "MM:SS"
  const parts = trimmed.split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts.map(p => parseInt(p) || 0)
    return (h * 3600 + m * 60 + s) * 1000
  }
  if (parts.length === 2) {
    const [m, s] = parts.map(p => parseInt(p) || 0)
    return (m * 60 + s) * 1000
  }

  // Plain seconds
  const seconds = parseInt(trimmed)
  return isNaN(seconds) ? 0 : seconds * 1000
}

// Timeline zoom hook (simplified version)
function useTimelineZoom(elapsed: number) {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState(0)

  const viewEnd = elapsed
  const viewWidth = viewEnd / zoomLevel
  const viewStart = Math.max(0, viewEnd - viewWidth + panOffset)

  const getPosition = (time: number) => {
    if (viewWidth <= 0) return 0
    return ((time - viewStart) / viewWidth) * 100
  }

  const zoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 10))
  const zoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 1))
  const resetZoom = () => { setZoomLevel(1); setPanOffset(0) }

  // Dynamic collision threshold based on zoom
  const dynamicCollisionThreshold = 60000 / zoomLevel // 1 minute at 1x, less when zoomed

  return { zoomLevel, getPosition, zoomIn, zoomOut, resetZoom, isZoomed: zoomLevel > 1, viewStart, viewEnd, dynamicCollisionThreshold }
}

// Timeline helper functions
const RECENT_THRESHOLD = 120000 // 2 minutes - for pulsating animation

// getPointColor moved inside component to use themeTimelineColors

function App() {
  // Check if this is the overlay window
  if (window.location.pathname === '/overlay' || window.location.search.includes('overlay=true')) {
    return <OverlayWindow />
  }

  // View state - start with profile selection
  const [currentView, setCurrentView] = useState<AppView>('profiles')

  // Profile state - null until selected
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profilePassword, setProfilePassword] = useState<string | undefined>(undefined)
  const [visitedProfiles, setVisitedProfiles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bb-visited-profiles') || '[]')
    } catch { return [] }
  })

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [pendingInitialPreset, setPendingInitialPreset] = useState<PresetSlug | null>(null)

  // Handle profile selection from ProfileList
  const handleSelectProfile = useCallback((name: string, password?: string, initialPreset?: PresetSlug) => {
    setProfileName(name)
    // Load password from localStorage if not provided
    const storedPassword = password || localStorage.getItem(`bb-password-${name}`) || undefined
    setProfilePassword(storedPassword)

    // Save password if provided (for private profiles)
    if (password) {
      localStorage.setItem(`bb-password-${name}`, password)
    }

    // Store initial preset to apply after auth (for new profiles)
    if (initialPreset) {
      setPendingInitialPreset(initialPreset)
    }

    localStorage.setItem('bb-last-profile', name)
    if (!visitedProfiles.includes(name)) {
      const updated = [...visitedProfiles, name]
      setVisitedProfiles(updated)
      localStorage.setItem('bb-visited-profiles', JSON.stringify(updated))
    }
    setCurrentView('tracker')
  }, [visitedProfiles])

  // Handle back to profiles
  const handleBackToProfiles = useCallback(() => {
    setCurrentView('profiles')
  }, [])

  // Timer input state
  const [showTimeInput, setShowTimeInput] = useState(false)
  const [timeInput, setTimeInput] = useState('')

  // Deaths input state
  const [showDeathsInput, setShowDeathsInput] = useState(false)
  const [deathsInput, setDeathsInput] = useState('')

  // Visual state
  const [deathFlash, setDeathFlash] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // Victory Modal
  const [showVictoryModal, setShowVictoryModal] = useState(false)
  const [victoryBossName, setVictoryBossName] = useState('')

  // Pending Boss Modal
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [pendingBossName, setPendingBossName] = useState('')
  const [pendingBossData, setPendingBossData] = useState<PendingBoss | null>(null)

  // Milestone Modal
  const [showMilestoneModal, setShowMilestoneModal] = useState(false)
  const [milestoneInput, setMilestoneInput] = useState('')
  const [selectedMilestoneIcon, setSelectedMilestoneIcon] = useState('★')

  // Stats Modal
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [statsForm, setStatsForm] = useState({
    level: 4, vitality: 10, endurance: 10, strength: 10,
    skill: 10, bloodtinge: 7, arcane: 6,
    bloodEchoes: 0, insight: 0, notes: ''
  })
  const [eldenRingStatsForm, setEldenRingStatsForm] = useState({
    level: 1, vigor: 10, mind: 10, endurance: 10,
    strength: 10, dexterity: 10, intelligence: 10,
    faith: 10, arcane: 10, runes: 0, notes: ''
  })

  // Timeline Panel
  const [showTimelinePanel, setShowTimelinePanel] = useState(false)
  const [panelTab, setPanelTab] = useState<'timeline' | 'daily'>('timeline')
  const [showStatsPanel, setShowStatsPanel] = useState(true)

  // Overlay style picker
  const [showOverlayPicker, setShowOverlayPicker] = useState(false)

  // Boss editing state (web version style)
  const [editingBoss, setEditingBoss] = useState<string | null>(null)
  const [editBossName, setEditBossName] = useState('')
  const [editBossDeaths, setEditBossDeaths] = useState('')
  const [editBossSegments, setEditBossSegments] = useState<{ start: string, end: string }[]>([])
  const [expandedBoss, setExpandedBoss] = useState<string | null>(null)
  // Note: expandedAttempts reserved for future use (individual attempts within boss fight)
  const [_expandedAttempts, _setExpandedAttempts] = useState<string | null>(null)

  // Milestone editing state (web version style)
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null)
  const [editMilestoneName, setEditMilestoneName] = useState('')
  const [editMilestoneIcon, setEditMilestoneIcon] = useState('')
  const [editMilestoneTime, setEditMilestoneTime] = useState('')

  // Stats editing state (web version style)
  const [editingStats, setEditingStats] = useState<string | null>(null)
  const [editStatsTime, setEditStatsTime] = useState('')

  // Death editing state
  const [editingDeathIndex, setEditingDeathIndex] = useState<number | null>(null)
  const [editDeathTime, setEditDeathTime] = useState('')

  // Timeline interactive points
  const [selectedTimelinePoint, setSelectedTimelinePoint] = useState<TimelinePoint | null>(null)

  // Refs
  const prevDeathsRef = useRef(0)
  const isInitialConnectionRef = useRef(true)

  // Ref to track auth password for saving (avoids dependency issues)
  const authPasswordRef = useRef('')

  // Keep ref in sync
  useEffect(() => {
    authPasswordRef.current = authPassword
  }, [authPassword])

  // Auth result handler - stable callback, uses ref for password
  const handleAuthResult = useCallback((success: boolean, error?: string) => {
    if (success) {
      setShowAuthModal(false)
      // Save password on successful auth using ref
      if (profileName && authPasswordRef.current) {
        localStorage.setItem(`bb-password-${profileName}`, authPasswordRef.current)
        setProfilePassword(authPasswordRef.current)
      }
      setAuthPassword('')
      setAuthError('')
    } else {
      setAuthError(error || 'Invalid password')
    }
  }, [profileName])

  const {
    state,
    connected,
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
    getElapsed,
  } = useWebSocket({
    profileName,
    password: profilePassword,
    onAuthResult: handleAuthResult,
  })

  // canEdit check - show auth modal if not allowed
  const canEdit = state?.canEdit ?? false

  // Apply pending initial preset when canEdit becomes true (for new profiles)
  useEffect(() => {
    if (canEdit && pendingInitialPreset && send) {
      const preset = VISUAL_PRESETS[pendingInitialPreset]
      if (preset) {
        const settings: ProfileSettings = {
          ...preset.config,
          preset: pendingInitialPreset
        }
        send('bb-profile-settings', { settings })
        setPendingInitialPreset(null)
      }
    }
  }, [canEdit, pendingInitialPreset, send])

  const requireAuth = useCallback((action: () => void) => {
    if (canEdit) {
      action()
    } else {
      setShowAuthModal(true)
    }
  }, [canEdit])

  // Local interpolated time
  const [displayElapsed, setDisplayElapsed] = useState(0)

  useEffect(() => {
    if (!state?.isRunning) {
      setDisplayElapsed(state?.elapsed || 0)
      return
    }

    const interval = setInterval(() => {
      setDisplayElapsed(getElapsed())
    }, 100)

    return () => clearInterval(interval)
  }, [state?.isRunning, state?.elapsed, getElapsed])

  // Timeline zoom
  const { zoomLevel, getPosition, zoomIn, zoomOut, resetZoom, isZoomed, viewStart, viewEnd, dynamicCollisionThreshold } = useTimelineZoom(displayElapsed)

  // Derive visual config from preset or legacy settings
  // Uses resolveVisualConfig for backward compatibility with both systems
  const visualConfig = useMemo(() => resolveVisualConfig(state), [state])

  // Derive colors from visual config
  const themeColors = useMemo(() => visualConfig.colors, [visualConfig])

  // Derive timeline colors from visual config
  const themeTimelineColors = useMemo(() => visualConfig.timeline, [visualConfig])

  // Get point color using theme settings
  const getPointColor = useCallback((type: 'boss' | 'milestone' | 'stats' | 'death'): string => {
    switch (type) {
      case 'boss': return themeTimelineColors.boss
      case 'milestone': return themeTimelineColors.milestone
      case 'death': return themeTimelineColors.death
      case 'stats': return themeTimelineColors.stats
    }
  }, [themeTimelineColors])

  // Save last profile (only when profileName is set)
  useEffect(() => {
    if (!profileName) return
    localStorage.setItem('bb-last-profile', profileName)
    if (!visitedProfiles.includes(profileName)) {
      const updated = [...visitedProfiles, profileName]
      setVisitedProfiles(updated)
      localStorage.setItem('bb-visited-profiles', JSON.stringify(updated))
    }
  }, [profileName, visitedProfiles])

  // Death flash detection
  useEffect(() => {
    if (state && state.deaths > prevDeathsRef.current) {
      setDeathFlash(true)
      setTimeout(() => setDeathFlash(false), 500)
    }
    prevDeathsRef.current = state?.deaths || 0
  }, [state?.deaths])

  // Pending boss detection
  useEffect(() => {
    if (state?.pendingBoss && isInitialConnectionRef.current && !state?.bossFightMode) {
      setPendingBossData(state.pendingBoss)
      setShowPendingModal(true)
      isInitialConnectionRef.current = false
    } else if (!state?.pendingBoss) {
      isInitialConnectionRef.current = false
    }
  }, [state?.pendingBoss, state?.bossFightMode])

  // Toast helper
  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }, [])

  // Handlers - wrapped with requireAuth for edit operations
  const handleDeath = useCallback(() => {
    requireAuth(() => {
      if (state?.bossFightMode && !state?.bossPaused) {
        bossDeath()
      } else {
        death()
      }
      setDeathFlash(true)
      setTimeout(() => setDeathFlash(false), 500)
    })
  }, [requireAuth, state?.bossFightMode, state?.bossPaused, bossDeath, death])

  // Path death (only adds to total, not to boss)
  const handlePathDeath = useCallback(() => {
    requireAuth(() => {
      death()
      setDeathFlash(true)
      setTimeout(() => setDeathFlash(false), 500)
    })
  }, [requireAuth, death])

  const handleToggleTimer = useCallback(() => {
    requireAuth(() => {
      if (state?.isRunning) {
        stop()
      } else {
        start()
      }
    })
  }, [requireAuth, state?.isRunning, start, stop])

  const handleBossToggle = useCallback(() => {
    requireAuth(() => {
      if (state?.bossFightMode) {
        setShowVictoryModal(true)
      } else {
        bossStart()
      }
    })
  }, [requireAuth, state?.bossFightMode, bossStart])

  const handleBossVictory = useCallback((name?: string) => {
    requireAuth(() => {
      bossVictory(name || '')
      setShowVictoryModal(false)
      setVictoryBossName('')
    })
  }, [requireAuth, bossVictory])

  // Pending boss handlers
  const handlePendingContinue = useCallback(() => {
    requireAuth(() => {
      send('bb-pending-continue')
      setShowPendingModal(false)
      setPendingBossData(null)
    })
  }, [requireAuth, send])

  const handlePendingFinish = useCallback((name?: string) => {
    requireAuth(() => {
      send('bb-pending-finish', { name: name || '' })
      setShowPendingModal(false)
      setPendingBossData(null)
      setPendingBossName('')
    })
  }, [requireAuth, send])

  const handlePendingCancel = useCallback(() => {
    requireAuth(() => {
      send('bb-pending-cancel')
      setShowPendingModal(false)
      setPendingBossData(null)
    })
  }, [requireAuth, send])

  // Milestone handlers
  const handleAddMilestone = useCallback(() => {
    requireAuth(() => {
      if (milestoneInput.trim()) {
        addMilestone(milestoneInput.trim(), selectedMilestoneIcon)
        setMilestoneInput('')
        setSelectedMilestoneIcon('★')
        setShowMilestoneModal(false)
      }
    })
  }, [requireAuth, addMilestone, milestoneInput, selectedMilestoneIcon])

  const handleDeleteMilestone = useCallback((id: string) => {
    requireAuth(() => {
      send('bb-milestone-delete', { id })
    })
  }, [requireAuth, send])

  // Stats handlers
  const handleAddStats = useCallback(() => {
    requireAuth(() => {
      send('bb-stats-add', statsForm)
      setShowStatsModal(false)
      setStatsForm({
        level: 4, vitality: 10, endurance: 10, strength: 10,
        skill: 10, bloodtinge: 7, arcane: 6,
        bloodEchoes: 0, insight: 0, notes: ''
      })
    })
  }, [requireAuth, send, statsForm])

  // Elden Ring stats handler
  const handleAddEldenRingStats = useCallback(() => {
    requireAuth(() => {
      send('bb-stats-add', { ...eldenRingStatsForm, game: 'elden-ring' })
      setShowStatsModal(false)
      setEldenRingStatsForm({
        level: 1, vigor: 10, mind: 10, endurance: 10,
        strength: 10, dexterity: 10, intelligence: 10,
        faith: 10, arcane: 10, runes: 0, notes: ''
      })
    })
  }, [requireAuth, send, eldenRingStatsForm])

  const handleDeleteStats = useCallback((id: string) => {
    requireAuth(() => {
      send('bb-stats-delete', { id })
    })
  }, [requireAuth, send])

  const handleDeleteBoss = useCallback((id: string) => {
    requireAuth(() => {
      send('bb-boss-delete', { id })
    })
  }, [requireAuth, send])

  const handleDeleteDeath = useCallback((index: number) => {
    requireAuth(() => {
      send('bb-death-delete', { index })
    })
  }, [requireAuth, send])

  // Boss edit handler (web version style)
  const handleEditBoss = useCallback((id: string) => {
    const boss = state?.bossFights.find(b => b.id === id)
    if (boss) {
      setEditingBoss(id)
      setEditBossName(boss.name)
      setEditBossDeaths(boss.deathsOnBoss.toString())
      // Initialize segments for editing
      if (boss.segments && boss.segments.length > 0) {
        setEditBossSegments(boss.segments.map(seg => ({
          start: formatTime(seg.start),
          end: formatTime(seg.end)
        })))
      } else {
        setEditBossSegments([{ start: formatTime(boss.startTime), end: formatTime(boss.endTime) }])
      }
    }
  }, [state?.bossFights])

  const handleSaveBoss = useCallback(() => {
    if (!editingBoss) return
    const deaths = editBossDeaths ? parseInt(editBossDeaths) : undefined
    // Parse segments
    const segments = editBossSegments.map(seg => ({
      start: parseTimeInput(seg.start),
      end: parseTimeInput(seg.end)
    })).filter(seg => seg.start >= 0 && seg.end > seg.start)
    // Calculate startTime and endTime from segments
    const startMs = segments.length > 0 ? segments[0].start : undefined
    const endMs = segments.length > 0 ? segments[segments.length - 1].end : undefined

    requireAuth(() => {
      send('bb-boss-edit', {
        id: editingBoss,
        name: editBossName.trim(),
        deathsOnBoss: deaths,
        startTime: startMs,
        endTime: endMs,
        segments: segments.length > 0 ? segments : undefined
      })
      setEditingBoss(null)
      setEditBossName('')
      setEditBossDeaths('')
      setEditBossSegments([])
    })
  }, [requireAuth, send, editingBoss, editBossName, editBossDeaths, editBossSegments])

  // Milestone edit handler (web version style)
  const handleEditMilestone = useCallback((id: string) => {
    const milestone = state?.milestones.find(m => m.id === id)
    if (milestone) {
      setEditingMilestone(id)
      setEditMilestoneName(milestone.name)
      setEditMilestoneIcon(milestone.icon)
      setEditMilestoneTime(formatTime(milestone.timestamp))
    }
  }, [state?.milestones])

  const handleSaveMilestone = useCallback(() => {
    if (!editingMilestone) return
    const timestamp = editMilestoneTime ? parseTimeInput(editMilestoneTime) : undefined
    requireAuth(() => {
      send('bb-milestone-edit', {
        id: editingMilestone,
        name: editMilestoneName.trim(),
        icon: editMilestoneIcon,
        timestamp
      })
      setEditingMilestone(null)
      setEditMilestoneName('')
      setEditMilestoneIcon('')
      setEditMilestoneTime('')
    })
  }, [requireAuth, send, editingMilestone, editMilestoneName, editMilestoneIcon, editMilestoneTime])

  // Stats edit handler (web version style - uses DOM for input values)
  const handleEditStats = useCallback((id: string) => {
    const stats = state?.characterStats.find(s => s.id === id)
    if (stats) {
      setEditingStats(id)
      setEditStatsTime(formatTime(stats.timestamp))
    }
  }, [state?.characterStats])

  const handleSaveStats = useCallback(() => {
    if (!editingStats) return
    const getVal = (key: string) => {
      const el = document.getElementById(`edit-stats-${editingStats}-${key}`) as HTMLInputElement
      return key === 'notes' ? el?.value : parseInt(el?.value || '0')
    }
    const timestamp = editStatsTime ? parseTimeInput(editStatsTime) : undefined
    requireAuth(() => {
      send('bb-stats-edit', {
        id: editingStats,
        level: getVal('level') as number,
        vitality: getVal('vitality') as number,
        endurance: getVal('endurance') as number,
        strength: getVal('strength') as number,
        skill: getVal('skill') as number,
        bloodtinge: getVal('bloodtinge') as number,
        arcane: getVal('arcane') as number,
        bloodEchoes: getVal('bloodEchoes') as number,
        insight: getVal('insight') as number,
        notes: getVal('notes') as string,
        timestamp
      })
      setEditingStats(null)
      setEditStatsTime('')
    })
  }, [requireAuth, send, editingStats, editStatsTime])

  // Death save handler (edit state set directly in UI)
  const handleSaveDeath = useCallback(() => {
    if (editingDeathIndex === null) return
    const ms = parseTimeInput(editDeathTime)
    if (ms > 0) {
      requireAuth(() => {
        send('bb-death-edit', { index: editingDeathIndex, timestamp: ms })
        setEditingDeathIndex(null)
      })
    }
  }, [requireAuth, send, editingDeathIndex, editDeathTime])

  // Save/Load/Export/Import - require auth
  const handleSave = useCallback(() => {
    requireAuth(() => {
      send('bb-save-manual')
    })
  }, [requireAuth, send])

  const handleLoad = useCallback(() => {
    requireAuth(() => {
      send('bb-load-manual')
    })
  }, [requireAuth, send])

  const handleExport = useCallback(() => {
    if (!state) return
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      timerPausedAt: displayElapsed,
      deaths: state.deaths,
      deathTimestamps: state.deathTimestamps,
      bossFights: state.bossFights,
      milestones: state.milestones,
      characterStats: state.characterStats
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bloodborne-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Save exported!')
  }, [state, displayElapsed, toast])

  const handleCopyOverlayUrl = useCallback(() => {
    const token = state?.overlayToken
    const overlayUrl = `${BASE_URL}/bloodborne/${profileName}/overlay`
    const url = token ? `${overlayUrl}?token=${token}` : overlayUrl
    navigator.clipboard.writeText(url)
      .then(() => toast('Overlay URL copied!'))
      .catch(() => toast('Failed to copy URL'))
  }, [profileName, state?.overlayToken, toast])

  const handleGenerateToken = useCallback(() => {
    requireAuth(() => send('bb-generate-token'))
  }, [requireAuth, send])

  const handleOpenOverlay = useCallback(async (style: 'minimal' | 'compact' | 'full' = 'compact') => {
    const token = state?.overlayToken
    const url = `/overlay?profile=${encodeURIComponent(profileName || '')}&style=${style}${token ? `&token=${encodeURIComponent(token)}` : ''}`

    // Calculate window size based on style
    const sizes = {
      minimal: { width: 280, height: 60 },
      compact: { width: 320, height: 80 },
      full: { width: 360, height: 100 },
    }
    const { width, height } = sizes[style]

    try {
      // Close existing overlay if any
      const existing = await WebviewWindow.getByLabel('overlay')
      if (existing) {
        await existing.close()
      }

      // Create new overlay window
      const overlay = new WebviewWindow('overlay', {
        url,
        title: 'BB Tracker Overlay',
        width,
        height,
        resizable: true,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
      })

      overlay.once('tauri://error', (e) => {
        console.error('Overlay window error:', e)
        toast('Failed to create overlay window')
      })

      setShowOverlayPicker(false)
    } catch (e) {
      console.error('Failed to open overlay:', e)
      toast('Failed to open overlay window')
    }
  }, [profileName, state?.overlayToken, toast])

  // Global hotkeys
  useHotkeys({
    onDeath: handleDeath,
    onToggleTimer: handleToggleTimer,
    onBossToggle: handleBossToggle,
    onMilestone: () => setShowMilestoneModal(true),
    enabled: connected,
  })

  // Helper to check if a death occurred during any boss fight
  const isDeathDuringBoss = useCallback((timestamp: number): boolean => {
    if (!state) return false
    for (const boss of state.bossFights) {
      const segments = boss.segments || [{ start: boss.startTime, end: boss.endTime }]
      for (const seg of segments) {
        if (timestamp >= seg.start && timestamp <= seg.end) {
          return true
        }
      }
    }
    if (state.bossFightMode && state.bossSegments?.length) {
      for (const seg of state.bossSegments) {
        const segStart = seg.start
        const segEnd = seg.end ?? displayElapsed
        if (timestamp >= segStart && timestamp <= segEnd) {
          return true
        }
      }
    }
    return false
  }, [state, displayElapsed])

  // Timeline points for panel
  type PanelEvent =
    | { type: 'boss'; data: BossFight; time: number }
    | { type: 'boss_start'; bossId: string; bossName: string; time: number }
    | { type: 'boss_pause'; bossId: string; time: number }
    | { type: 'boss_resume'; bossId: string; time: number }
    | { type: 'milestone'; data: Milestone; time: number }
    | { type: 'stats'; data: GameCharacterStats; time: number }
    | { type: 'death'; index: number; time: number; deathNumber: number; createdAt?: string }

  const sortedPanelEvents = useMemo((): PanelEvent[] => {
    if (!state) return []
    const events: PanelEvent[] = []

    state.bossFights.forEach(boss => {
      // Boss fight start marker
      events.push({
        type: 'boss_start',
        bossId: boss.id,
        bossName: boss.name,
        time: boss.segments?.[0]?.start ?? boss.startTime
      })

      // Segment pauses/resumes
      if (boss.segments && boss.segments.length > 1) {
        for (let i = 0; i < boss.segments.length - 1; i++) {
          events.push({ type: 'boss_pause', bossId: boss.id, time: boss.segments[i].end })
          events.push({ type: 'boss_resume', bossId: boss.id, time: boss.segments[i + 1].start })
        }
      }

      // Boss victory
      events.push({ type: 'boss', data: boss, time: boss.endTime })
    })

    state.milestones.forEach(m => {
      events.push({ type: 'milestone', data: m, time: m.timestamp })
    })

    state.characterStats.forEach(s => {
      events.push({ type: 'stats', data: s, time: s.timestamp })
    })

    state.deathTimestamps.forEach((d, index) => {
      events.push({ type: 'death', index, time: d.timestamp, deathNumber: d.deathNumber, createdAt: d.createdAt })
    })

    // Pending boss fight
    if (state.bossFightMode && state.bossSegments?.length) {
      const pendingId = 'pending'
      if (state.bossSegments[0].start !== null) {
        events.push({
          type: 'boss_start',
          bossId: pendingId,
          bossName: '',
          time: state.bossSegments[0].start
        })
      }
      for (let i = 0; i < state.bossSegments.length - 1; i++) {
        const seg = state.bossSegments[i]
        const nextSeg = state.bossSegments[i + 1]
        if (seg.end !== null) {
          events.push({ type: 'boss_pause', bossId: pendingId, time: seg.end })
        }
        if (nextSeg.start !== null) {
          events.push({ type: 'boss_resume', bossId: pendingId, time: nextSeg.start })
        }
      }
      const lastSeg = state.bossSegments[state.bossSegments.length - 1]
      if (lastSeg.end !== null && state.bossPaused) {
        events.push({ type: 'boss_pause', bossId: pendingId, time: lastSeg.end })
      }
    }

    return events.sort((a, b) => a.time - b.time)
  }, [state])

  // Daily stats aggregation - groups all events by date
  const dailyStats = useMemo((): DailyStats[] => {
    if (!state) return []

    // Group all events by local date (YYYY-MM-DD)
    const byDate = new Map<string, {
      deaths: typeof state.deathTimestamps
      bosses: BossFight[]
      stats: GameCharacterStats[]
      milestones: Milestone[]
      eventTimes: number[]
    }>()

    const getLocalDate = (createdAt: string) => {
      const d = new Date(createdAt)
      return d.toLocaleDateString('sv-SE') // YYYY-MM-DD format
    }

    const ensureDate = (date: string) => {
      if (!byDate.has(date)) {
        byDate.set(date, { deaths: [], bosses: [], stats: [], milestones: [], eventTimes: [] })
      }
      return byDate.get(date)!
    }

    // Group deaths by date
    state.deathTimestamps.forEach(d => {
      if (!d.createdAt) return
      const date = getLocalDate(d.createdAt)
      const day = ensureDate(date)
      day.deaths.push(d)
      day.eventTimes.push(new Date(d.createdAt).getTime())
    })

    // Group bosses by date
    state.bossFights.forEach(b => {
      if (!b.createdAt) return
      const date = getLocalDate(b.createdAt)
      const day = ensureDate(date)
      day.bosses.push(b)
      day.eventTimes.push(new Date(b.createdAt).getTime())
    })

    // Group stats by date
    state.characterStats.forEach(s => {
      if (!s.createdAt) return
      const date = getLocalDate(s.createdAt)
      const day = ensureDate(date)
      day.stats.push(s)
      day.eventTimes.push(new Date(s.createdAt).getTime())
    })

    // Group milestones by date
    state.milestones.forEach(m => {
      if (!m.createdAt) return
      const date = getLocalDate(m.createdAt)
      const day = ensureDate(date)
      day.milestones.push(m)
      day.eventTimes.push(new Date(m.createdAt).getTime())
    })

    // Convert to array and sort by date descending (newest first)
    const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))

    // Build daily stats with deltas - process in chronological order for proper delta calculation
    const result: DailyStats[] = []
    let prevDayStats: GameCharacterStats | null = null

    // Process in chronological order (oldest first) to calculate deltas correctly
    const chronologicalDates = [...dates].reverse()

    chronologicalDates.forEach(date => {
      const day = byDate.get(date)!

      // Get the latest stats entry of the day (most recent)
      const dayStats = day.stats.length > 0
        ? day.stats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null

      // Compute delta with previous day's stats (only for same game type)
      let delta: GameStatsDelta | null = null
      if (dayStats && prevDayStats) {
        // Only compute delta if both are the same game type
        if (isBloodborneStats(dayStats) && isBloodborneStats(prevDayStats)) {
          delta = {
            level: dayStats.level - prevDayStats.level,
            vitality: dayStats.vitality - prevDayStats.vitality,
            endurance: dayStats.endurance - prevDayStats.endurance,
            strength: dayStats.strength - prevDayStats.strength,
            skill: dayStats.skill - prevDayStats.skill,
            bloodtinge: dayStats.bloodtinge - prevDayStats.bloodtinge,
            arcane: dayStats.arcane - prevDayStats.arcane,
          }
        } else if (isEldenRingStats(dayStats) && isEldenRingStats(prevDayStats)) {
          delta = {
            level: dayStats.level - prevDayStats.level,
            vigor: dayStats.vigor - prevDayStats.vigor,
            mind: dayStats.mind - prevDayStats.mind,
            endurance: dayStats.endurance - prevDayStats.endurance,
            strength: dayStats.strength - prevDayStats.strength,
            dexterity: dayStats.dexterity - prevDayStats.dexterity,
            intelligence: dayStats.intelligence - prevDayStats.intelligence,
            faith: dayStats.faith - prevDayStats.faith,
            arcane: dayStats.arcane - prevDayStats.arcane,
          }
        }
      }

      // Estimate playtime as difference between first and last event of the day
      day.eventTimes.sort((a, b) => a - b)
      const playtime = day.eventTimes.length > 1
        ? day.eventTimes[day.eventTimes.length - 1] - day.eventTimes[0]
        : 0

      result.push({
        date,
        displayDate: formatDisplayDate(date),
        playtime,
        deaths: day.deaths.length,
        stats: dayStats,
        statsDelta: delta,
        bosses: day.bosses,
        milestones: day.milestones,
      })

      // Update previous day stats for next iteration
      if (dayStats) {
        prevDayStats = dayStats
      }
    })

    // Reverse to show newest first
    return result.reverse()
  }, [state])

  // Combine all timeline events into unified points for interactive timeline bar
  const allTimelinePoints = useMemo((): TimelinePoint[] => {
    if (!state) return []
    const points: TimelinePoint[] = []

    // Add boss fights (use endTime as primary position, show line from start to end)
    state.bossFights.forEach(boss => {
      points.push({
        id: `boss-${boss.id}`,
        type: 'boss',
        time: boss.endTime, // Position at victory moment
        endTime: boss.endTime,
        data: boss
      })
    })

    // Add milestones
    state.milestones.forEach(m => {
      points.push({
        id: `milestone-${m.id}`,
        type: 'milestone',
        time: m.timestamp,
        data: m
      })
    })

    // Add character stats
    state.characterStats.forEach(s => {
      points.push({
        id: `stats-${s.id}`,
        type: 'stats',
        time: s.timestamp,
        data: s
      })
    })

    // Add deaths - deathNumber comes from counter at time of death
    state.deathTimestamps.forEach((death, index) => {
      points.push({
        id: `death-${index}-${death.timestamp}`,
        type: 'death',
        time: death.timestamp,
        data: { index, deathNumber: death.deathNumber } as DeathPoint
      })
    })

    // Sort by time
    return points.sort((a, b) => a.time - b.time)
  }, [state])

  // Calculate stack index for colliding points (uses dynamic threshold from zoom)
  const getStackIndex = useCallback((point: TimelinePoint): number => {
    const pointIndex = allTimelinePoints.findIndex(p => p.id === point.id)
    if (pointIndex === -1) return 0

    let stackIndex = 0
    for (let i = 0; i < pointIndex; i++) {
      const prevPoint = allTimelinePoints[i]
      if (Math.abs(prevPoint.time - point.time) <= dynamicCollisionThreshold) {
        stackIndex++
      }
    }
    return Math.min(stackIndex, 4) // Max 5 levels
  }, [allTimelinePoints, dynamicCollisionThreshold])

  // Calculate boss fight duration
  const currentBossDuration = useMemo(() => {
    if (!state?.bossFightMode || !state?.bossSegments?.length) return 0
    return state.bossSegments.reduce((sum, seg) => {
      const end = seg.end ?? displayElapsed
      return sum + (end - seg.start)
    }, 0)
  }, [state?.bossFightMode, state?.bossSegments, displayElapsed])

  // Short aliases
  const elapsed = displayElapsed
  const deaths = state?.deaths || 0
  const bossDeaths = state?.bossDeaths || 0
  const bossFightMode = state?.bossFightMode || false
  const bossPaused = state?.bossPaused || false
  const isRunning = state?.isRunning || false
  const bossSegments = state?.bossSegments || []

  // View switching
  if (currentView === 'profiles' || !profileName) {
    return <ProfileList onSelectProfile={handleSelectProfile} />
  }

  // Loading states
  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: COLORS.nearBlack }}>
        <motion.div
          className="w-8 h-8 border-2 rounded-full"
          style={{ borderColor: `${COLORS.fogGray} transparent` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div style={{ color: COLORS.fogGray, fontFamily: "'Liberation Serif', serif" }}>
          Connecting to {profileName}...
        </div>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.nearBlack, color: COLORS.fogGray }}>
        Loading...
      </div>
    )
  }

  return (
    <div
      className="min-h-screen h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{ fontFamily: "'Liberation Serif', 'Times New Roman', serif", backgroundColor: themeColors.background }}
    >
      {/* Profile logo if enabled - top center */}
      {state?.profileSettings?.logo.enabled && state.profileSettings.logo.url && (
        <img
          src={state.profileSettings.logo.url}
          alt="Profile logo"
          className="fixed z-50 pointer-events-none"
          style={{
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: state.profileSettings.logo.size,
            height: 'auto',
            objectFit: 'contain'
          }}
        />
      )}

      {/* Background image layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: state?.profileSettings?.background.type === 'image' && state?.profileSettings?.background.imageUrl
            ? `url(${state.profileSettings.background.imageUrl})`
            : 'url(/bloodborne-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: `saturate(0.3) brightness(0.45)${state?.profileSettings?.background.blur ? ` blur(${state.profileSettings.background.blur}px)` : ''}`,
          opacity: state?.profileSettings?.background.opacity ?? 1,
        }}
      />

      {/* Heavy vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(11,11,12,0.5) 50%, rgba(11,11,12,0.95) 100%)'
      }} />

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Death flash */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-50"
        style={{ background: `radial-gradient(ellipse at center, ${COLORS.bloodRedDark}60 0%, transparent 60%)` }}
        animate={{ opacity: deathFlash ? 1 : 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />

      {/* Blood drip on death */}
      <AnimatePresence>
        {deathFlash && (
          <motion.div
            className="absolute top-0 left-0 right-0 h-24 pointer-events-none z-50"
            style={{ background: `linear-gradient(to bottom, ${COLORS.bloodRedDark}90, transparent)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="fixed top-16 left-1/2 -translate-x-1/2 px-6 py-3 z-50"
            style={{ backgroundColor: COLORS.nearBlack, color: COLORS.coldGray, border: `1px solid ${COLORS.bloodRedDark}` }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Profile selector */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2" style={{ backgroundColor: `${COLORS.nearBlack}ee` }}>
        <button
          onClick={handleBackToProfiles}
          className="text-sm tracking-wider opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: COLORS.coldGray }}
        >
          ← Profiles
        </button>
        <div className="text-sm tracking-wider" style={{ color: COLORS.coldGray }}>
          <span className="opacity-60">Profile:</span>{' '}
          <span style={{ color: COLORS.boneWhite }}>{state.displayName || profileName}</span>
        </div>
        <div className="w-20" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-2 pt-16 pb-20">

        {/* Timer */}
        <AnimatePresence mode="wait">
          {showTimeInput ? (
            <motion.div
              key="timer-input"
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="1:30:00"
                className="text-5xl text-center px-6 py-3 w-72 focus:outline-none"
                style={{ backgroundColor: '#1A0B06', color: '#C5A8AA', border: '1px solid #7F3335' }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const ms = parseTimeInput(timeInput)
                    if (ms > 0) { requireAuth(() => { send('bb-set-time', { elapsed: ms }); setShowTimeInput(false); setTimeInput('') }) }
                  } else if (e.key === 'Escape') { setShowTimeInput(false); setTimeInput('') }
                }}
              />
              <div className="flex gap-8">
                <button onClick={() => { const ms = parseTimeInput(timeInput); if (ms > 0) { requireAuth(() => { send('bb-set-time', { elapsed: ms }); setShowTimeInput(false); setTimeInput('') }) } }} style={{ color: '#99585C' }}>Confirm</button>
                <button onClick={() => { setShowTimeInput(false); setTimeInput('') }} style={{ color: '#7F3335' }}>Cancel</button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="timer-display"
              onClick={() => !isRunning && canEdit && setShowTimeInput(true)}
              className={!isRunning && canEdit ? 'cursor-pointer' : ''}
              title={!isRunning ? (canEdit ? 'Click to edit time' : 'Authenticate to edit') : ''}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="text-8xl tracking-tight"
                style={{
                  fontFamily: "'Times New Roman', serif",
                  color: themeColors.primary,
                  filter: 'blur(0.3px)',
                  textShadow: `0 0 60px ${themeColors.primary}30, 0 0 120px ${themeColors.primary}15, 0 4px 8px ${themeColors.background}`
                }}
                animate={isRunning ? { opacity: [0.85, 0.95, 0.85] } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                {formatTime(elapsed)}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer controls */}
        <div className="flex gap-8 mt-1">
          {!isRunning ? (
            <motion.button onClick={start} className="text-3xl tracking-[0.15em] uppercase" style={{ color: COLORS.coldGray, textShadow: `0 0 20px ${COLORS.coldGray}40` }} whileHover={{ color: COLORS.boneWhite }}>
              Start
            </motion.button>
          ) : (
            <motion.button onClick={stop} className="text-3xl tracking-[0.15em] uppercase" style={{ color: COLORS.boneWhite, textShadow: `0 0 20px ${COLORS.boneWhite}40` }} animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 2.5, repeat: Infinity }}>
              Stop
            </motion.button>
          )}
        </div>

        {/* Deaths counter */}
        <motion.div className="mt-4 flex flex-col items-center gap-1">
          <div className="relative flex items-center justify-center">
            <motion.span
              className="text-3xl tracking-[0.3em] uppercase"
              animate={{ color: bossFightMode ? themeColors.primary : themeColors.accent, textShadow: bossFightMode ? `0 0 20px ${themeColors.primary}40` : 'none' }}
            >
              Deaths
            </motion.span>

            {/* Boss mode indicator */}
            <AnimatePresence>
              {bossFightMode && (
                <motion.div
                  className="absolute left-full flex items-center gap-3 ml-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span className="text-3xl" style={{ color: themeColors.accent }}>{deaths}</span>
                  <motion.button onClick={handlePathDeath} className="text-2xl" style={{ color: themeColors.accent }} whileHover={{ color: COLORS.coldGray, scale: 1.1 }} title="Path death (not on boss)">
                    +
                  </motion.button>
                  {bossPaused && (
                    <motion.span className="text-sm tracking-[0.2em] uppercase" style={{ color: themeColors.secondary }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      PAUSED
                    </motion.span>
                  )}
                  {bossSegments.length > 1 && (
                    <span className="text-xs" style={{ color: `${themeColors.secondary}99` }}>({bossSegments.length})</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Death number */}
          <AnimatePresence mode="wait">
            {showDeathsInput ? (
              <motion.div key="deaths-input" className="flex flex-col items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <input
                  type="number"
                  value={deathsInput}
                  onChange={(e) => setDeathsInput(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="text-7xl text-center px-4 py-2 w-48 focus:outline-none"
                  style={{ backgroundColor: 'transparent', color: bossFightMode ? COLORS.boneWhite : COLORS.bloodRed, border: `1px solid ${bossFightMode ? COLORS.coldGray : COLORS.bloodRedDark}` }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = parseInt(deathsInput)
                      if (!isNaN(n) && n >= 0) {
                        requireAuth(() => {
                          send(bossFightMode ? 'bb-set-boss-deaths' : 'bb-set-deaths', { deaths: n })
                          setShowDeathsInput(false); setDeathsInput('')
                        })
                      }
                    } else if (e.key === 'Escape') { setShowDeathsInput(false); setDeathsInput('') }
                  }}
                />
                <div className="flex gap-6">
                  <button onClick={() => { const n = parseInt(deathsInput); if (!isNaN(n)) { requireAuth(() => { send(bossFightMode ? 'bb-set-boss-deaths' : 'bb-set-deaths', { deaths: n }); setShowDeathsInput(false); setDeathsInput('') }) } }} style={{ color: COLORS.coldGray }}>Confirm</button>
                  <button onClick={() => { setShowDeathsInput(false); setDeathsInput('') }} style={{ color: COLORS.ashGray }}>Cancel</button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="deaths-display"
                onClick={() => canEdit && setShowDeathsInput(true)}
                className={canEdit ? "cursor-pointer text-9xl leading-none" : "text-9xl leading-none"}
                title={canEdit ? "Click to edit" : "Authenticate to edit"}
                style={{ fontFamily: "'Times New Roman', serif", filter: 'blur(0.3px)' }}
                animate={deathFlash ? { opacity: [1, 0.6, 1], color: bossFightMode ? themeColors.primary : themeColors.accent } : { color: bossFightMode ? themeColors.primary : themeColors.accent, textShadow: `0 0 30px ${bossFightMode ? themeColors.primary : themeColors.accent}20` }}
              >
                {bossFightMode ? bossDeaths : deaths}
              </motion.div>
            )}
          </AnimatePresence>

          {/* YOU DIED button */}
          <div className="flex flex-col items-center gap-1 mt-3">
            <motion.button
              onClick={handleDeath}
              className="text-4xl tracking-[0.2em] uppercase"
              animate={{ color: bossFightMode ? themeColors.primary : themeColors.accent, textShadow: bossFightMode ? `0 0 20px ${themeColors.primary}30` : 'none' }}
              whileHover={{ color: COLORS.coldGray, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              You Died
            </motion.button>
            <p className="text-xs tracking-wider" style={{ color: COLORS.fogGray }}>[ Ctrl+Shift+D ]</p>
          </div>
        </motion.div>
      </div>

      {/* Bottom buttons */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20">
        <AnimatePresence mode="wait">
          {bossFightMode ? (
            <motion.div key="boss-buttons" className="flex items-center gap-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <motion.button onClick={() => requireAuth(() => setShowVictoryModal(true))} className="text-2xl tracking-[0.15em] uppercase" style={{ color: COLORS.coldGray }} whileHover={{ color: COLORS.boneWhite, scale: 1.05 }}>Victory</motion.button>
              {bossPaused ? (
                <motion.button onClick={() => requireAuth(bossResume)} className="text-2xl tracking-[0.15em] uppercase" style={{ color: themeColors.secondary }} whileHover={{ color: themeColors.primary, scale: 1.05 }}>Resume</motion.button>
              ) : (
                <motion.button onClick={() => requireAuth(bossPause)} className="text-2xl tracking-[0.15em] uppercase" style={{ color: `${themeColors.secondary}99` }} whileHover={{ color: themeColors.secondary, scale: 1.05 }}>Pause</motion.button>
              )}
              <motion.button onClick={() => requireAuth(bossCancel)} className="text-2xl tracking-[0.15em] uppercase" style={{ color: `${themeColors.accent}99` }} whileHover={{ color: themeColors.accent, scale: 1.05 }}>Cancel</motion.button>
            </motion.div>
          ) : (
            <motion.div key="normal-buttons" className="flex items-center gap-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <motion.button onClick={() => requireAuth(bossStart)} className="text-2xl tracking-[0.15em] uppercase" style={{ color: COLORS.coldGray }} whileHover={{ color: COLORS.boneWhite, scale: 1.05 }}>Boss</motion.button>
              <motion.button onClick={() => requireAuth(() => setShowMilestoneModal(true))} className="text-2xl tracking-[0.15em] uppercase" style={{ color: COLORS.ashGray }} whileHover={{ color: COLORS.coldGray, scale: 1.05 }}>Milestone</motion.button>
              <motion.button onClick={() => requireAuth(() => {
                if (state.characterStats.length > 0) {
                  const last = state.characterStats[state.characterStats.length - 1]
                  if (isBloodborneStats(last)) {
                    setStatsForm({ ...statsForm, level: last.level, vitality: last.vitality, endurance: last.endurance, strength: last.strength, skill: last.skill, bloodtinge: last.bloodtinge, arcane: last.arcane, bloodEchoes: last.bloodEchoes, insight: last.insight })
                  } else if (isEldenRingStats(last)) {
                    setEldenRingStatsForm({ ...eldenRingStatsForm, level: last.level, vigor: last.vigor, mind: last.mind, endurance: last.endurance, strength: last.strength, dexterity: last.dexterity, intelligence: last.intelligence, faith: last.faith, arcane: last.arcane, runes: last.runes })
                  }
                }
                setShowStatsModal(true)
              })} className="text-2xl tracking-[0.15em] uppercase" style={{ color: COLORS.fogGray }} whileHover={{ color: COLORS.ashGray, scale: 1.05 }}>Stats</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline Panel Toggle - gothic, fades into darkness */}
      {(state.bossFights.length > 0 || state.milestones.length > 0 || state.characterStats.length > 0 || state.deathTimestamps.length > 0) && (
        <motion.button
          onClick={() => setShowTimelinePanel(!showTimelinePanel)}
          className="fixed left-4 bottom-20 z-30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="relative px-3 py-3 flex items-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${themeColors.background}f0 0%, ${themeColors.background}a0 100%)`,
              border: `1px solid ${themeColors.secondary}60`
            }}
          >
            <motion.span
              className="text-2xl"
              style={{ color: themeColors.secondary, filter: 'blur(0.3px)' }}
              animate={{ rotate: showTimelinePanel ? 45 : 0 }}
              transition={{ duration: 0.4 }}
            >
              ⚔
            </motion.span>
            <span
              className="text-2xl"
              style={{ color: themeColors.secondary, fontFamily: "'Liberation Serif', serif" }}
            >
              {state.bossFights.length + state.milestones.length + state.characterStats.length + state.deathTimestamps.length}
            </span>
          </div>
        </motion.button>
      )}

      {/* Timeline Panel */}
      <AnimatePresence>
        {showTimelinePanel && (
          <motion.div
            className="fixed left-0 top-12 bottom-16 w-96 z-20 overflow-hidden flex flex-col"
            style={{ background: themeTimelineColors.panelBg, borderRight: `1px solid ${COLORS.fogGray}30` }}
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
          >
            {/* Panel header with tabs */}
            <div className="border-b" style={{ borderColor: `${COLORS.fogGray}30` }}>
              <motion.button onClick={() => setShowTimelinePanel(false)} className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center z-10" style={{ color: `${themeColors.secondary}99` }} whileHover={{ color: themeColors.secondary, scale: 1.1 }}>✕</motion.button>
              <div className="flex">
                <button onClick={() => setPanelTab('timeline')} className="flex-1 py-4 text-sm tracking-[0.1em] uppercase transition-all" style={{ color: panelTab === 'timeline' ? themeColors.secondary : COLORS.fogGray, borderBottom: panelTab === 'timeline' ? `2px solid ${themeColors.secondary}` : '2px solid transparent' }}>Timeline</button>
                <button onClick={() => setPanelTab('daily')} className="flex-1 py-4 text-sm tracking-[0.1em] uppercase transition-all" style={{ color: panelTab === 'daily' ? themeColors.secondary : COLORS.fogGray, borderBottom: panelTab === 'daily' ? `2px solid ${themeColors.secondary}` : '2px solid transparent' }}>By Day</button>
              </div>
              <p className="text-xs px-5 pb-3" style={{ color: `${themeColors.secondary}99` }}>
                {state.bossFights.length} bosses • {state.milestones.length} milestones • {state.deathTimestamps.length} deaths
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* Timeline Tab */}
              {panelTab === 'timeline' && (
                <>
                  {/* Stats Dashboard */}
                  <motion.div
                    className="relative overflow-hidden mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(30, 35, 33, 0.6), rgba(15, 18, 17, 0.8))',
                      border: `1px solid ${COLORS.fogGray}30`
                    }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
              {/* Dashboard Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                style={{ borderBottom: showStatsPanel ? `1px solid ${COLORS.fogGray}20` : 'none' }}
                onClick={() => setShowStatsPanel(!showStatsPanel)}
              >
                <div className="flex items-center gap-2">
                  <span style={{ color: COLORS.coldGray }}>📊</span>
                  <span className="text-sm uppercase tracking-wider" style={{ color: COLORS.boneWhite }}>
                    Statistics
                  </span>
                </div>
                <span style={{ color: COLORS.fogGray, fontSize: '12px' }}>
                  {showStatsPanel ? '▲' : '▼'}
                </span>
              </div>

              {/* Collapsible content */}
              <AnimatePresence>
                {showStatsPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 space-y-4">
                      {/* Main stats grid */}
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div>
                          <div className="text-xl font-bold" style={{ color: themeColors.primary }}>{formatTime(state.elapsed)}</div>
                          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>Time</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold" style={{ color: themeColors.accent }}>{state.deaths}</div>
                          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>Deaths</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold" style={{ color: themeColors.secondary }}>{state.bossFights.length}</div>
                          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>Bosses</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold" style={{ color: COLORS.coldGray }}>
                            {state.elapsed > 0 ? (state.deaths / (state.elapsed / 3600000)).toFixed(1) : '0.0'}
                          </div>
                          <div className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>Deaths/hr</div>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${COLORS.fogGray}30, transparent)` }} />

                      {/* Fun stats */}
                      {state.bossFights.length > 0 && (() => {
                        const hallOfShame = [...state.bossFights].sort((a, b) => b.deathsOnBoss - a.deathsOnBoss)[0]
                        const oneShots = state.bossFights.filter(b => b.deathsOnBoss === 0)
                        return (
                          <div className="space-y-3">
                            {/* Hall of Shame */}
                            {hallOfShame && hallOfShame.deathsOnBoss > 0 && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span style={{ color: COLORS.bloodRed }}>💀</span>
                                  <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>Hall of Shame</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm" style={{ color: COLORS.bloodRed }}>{hallOfShame.name}</div>
                                  <div className="text-xs" style={{ color: COLORS.bloodRedDark }}>{hallOfShame.deathsOnBoss} deaths</div>
                                </div>
                              </div>
                            )}
                            {/* One-shot Wonders */}
                            {oneShots.length > 0 && (
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span style={{ color: COLORS.bossAmber }}>⚡</span>
                                  <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>One-shots</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm" style={{ color: COLORS.coldGray }}>{oneShots.length} boss{oneShots.length !== 1 ? 'es' : ''}</div>
                                  <div className="text-xs" style={{ color: COLORS.fogGray }}>
                                    {oneShots.slice(0, 2).map(b => b.name).join(', ')}
                                    {oneShots.length > 2 && '...'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Death Graph - cumulative deaths over time */}
                      {state.deathTimestamps.length > 1 && state.elapsed > 0 && (() => {
                        const chartWidth = 260
                        const chartHeight = 80
                        const padding = { top: 10, right: 10, bottom: 20, left: 30 }
                        const innerWidth = chartWidth - padding.left - padding.right
                        const innerHeight = chartHeight - padding.top - padding.bottom

                        // Sort timestamps and create cumulative death points
                        const sortedDeaths = [...state.deathTimestamps]
                          .map(d => typeof d === 'number' ? d : d.timestamp)
                          .sort((a, b) => a - b)

                        // Add start point (0 deaths at time 0) and end point
                        const points = [
                          { time: 0, deaths: 0 },
                          ...sortedDeaths.map((time, i) => ({ time, deaths: i + 1 })),
                          { time: state.elapsed, deaths: sortedDeaths.length }
                        ]

                        const maxTime = state.elapsed
                        const maxDeaths = Math.max(state.deaths, 1)

                        // Scale functions
                        const scaleX = (t: number) => padding.left + (t / maxTime) * innerWidth
                        const scaleY = (d: number) => padding.top + innerHeight - (d / maxDeaths) * innerHeight

                        // Create path for the line
                        const linePath = points.map((p, i) => {
                          const x = scaleX(p.time)
                          const y = scaleY(p.deaths)
                          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                        }).join(' ')

                        // Create area path (filled under the line)
                        const areaPath = `${linePath} L ${scaleX(state.elapsed)} ${scaleY(0)} L ${scaleX(0)} ${scaleY(0)} Z`

                        // Y-axis ticks
                        const yTicks = maxDeaths <= 5
                          ? Array.from({ length: maxDeaths + 1 }, (_, i) => i)
                          : [0, Math.round(maxDeaths / 2), maxDeaths]

                        // X-axis ticks (time)
                        const xTicks = [0, maxTime / 2, maxTime]

                        return (
                          <>
                            <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${COLORS.fogGray}30, transparent)` }} />
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ color: COLORS.bloodRed }}>📉</span>
                                <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>
                                  Смерти со временем
                                </span>
                              </div>
                              <svg
                                width={chartWidth}
                                height={chartHeight}
                                className="mx-auto"
                                style={{ display: 'block' }}
                              >
                                {/* Grid lines */}
                                {yTicks.map(tick => (
                                  <line
                                    key={`grid-y-${tick}`}
                                    x1={padding.left}
                                    y1={scaleY(tick)}
                                    x2={chartWidth - padding.right}
                                    y2={scaleY(tick)}
                                    stroke={COLORS.fogGray}
                                    strokeOpacity={0.2}
                                    strokeDasharray="2,2"
                                  />
                                ))}

                                {/* Area fill */}
                                <path
                                  d={areaPath}
                                  fill={`url(#deathGradient)`}
                                  opacity={0.4}
                                />

                                {/* Gradient definition */}
                                <defs>
                                  <linearGradient id="deathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={COLORS.bloodRed} stopOpacity={0.6} />
                                    <stop offset="100%" stopColor={COLORS.bloodRed} stopOpacity={0.1} />
                                  </linearGradient>
                                </defs>

                                {/* Line */}
                                <path
                                  d={linePath}
                                  fill="none"
                                  stroke={COLORS.bloodRed}
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />

                                {/* Y-axis labels */}
                                {yTicks.map(tick => (
                                  <text
                                    key={`label-y-${tick}`}
                                    x={padding.left - 5}
                                    y={scaleY(tick)}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    fill={COLORS.fogGray}
                                    fontSize={9}
                                  >
                                    {tick}
                                  </text>
                                ))}

                                {/* X-axis labels */}
                                {xTicks.map((tick, i) => (
                                  <text
                                    key={`label-x-${i}`}
                                    x={scaleX(tick)}
                                    y={chartHeight - 5}
                                    textAnchor="middle"
                                    fill={COLORS.fogGray}
                                    fontSize={8}
                                  >
                                    {formatTime(tick)}
                                  </text>
                                ))}
                              </svg>
                            </div>
                          </>
                        )
                      })()}

                      {/* Level Progress Chart */}
                      {state.characterStats.length > 0 && (() => {
                        const statsByDay = getStatsByDay(state.characterStats)
                        if (statsByDay.length === 0) return null

                        const chartWidth = 260
                        const chartHeight = 100
                        const padding = { top: 15, right: 15, bottom: 25, left: 35 }
                        const innerWidth = chartWidth - padding.left - padding.right
                        const innerHeight = chartHeight - padding.top - padding.bottom

                        // Extract level data with deltas
                        const levelData = statsByDay.map((d, i) => {
                          const prevLevel = i > 0 ? statsByDay[i - 1].stats.level : null
                          const delta = prevLevel !== null ? d.stats.level - prevLevel : 0
                          return { date: d.date, level: d.stats.level, delta }
                        })

                        const levels = levelData.map(d => d.level)
                        const minLevel = Math.max(1, Math.min(...levels) - 5)
                        const maxLevel = Math.max(...levels) + 5

                        // Scale functions
                        const scaleX = (i: number) => padding.left + (levelData.length > 1 ? (i / (levelData.length - 1)) * innerWidth : innerWidth / 2)
                        const scaleY = (level: number) => padding.top + innerHeight - ((level - minLevel) / (maxLevel - minLevel)) * innerHeight

                        // Create path
                        const linePath = levelData.map((d, i) => {
                          const x = scaleX(i)
                          const y = scaleY(d.level)
                          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
                        }).join(' ')

                        return (
                          <>
                            <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${COLORS.fogGray}30, transparent)` }} />
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span style={{ color: COLORS.boneWhite }}>📈</span>
                                <span className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>
                                  Прогресс уровня
                                </span>
                              </div>
                              <svg
                                width={chartWidth}
                                height={chartHeight}
                                className="mx-auto"
                                style={{ display: 'block' }}
                              >
                                {/* Grid lines */}
                                {[minLevel, Math.round((minLevel + maxLevel) / 2), maxLevel].map(tick => (
                                  <line
                                    key={`grid-${tick}`}
                                    x1={padding.left}
                                    y1={scaleY(tick)}
                                    x2={chartWidth - padding.right}
                                    y2={scaleY(tick)}
                                    stroke={COLORS.fogGray}
                                    strokeOpacity={0.2}
                                    strokeDasharray="2,2"
                                  />
                                ))}

                                {/* Line */}
                                {levelData.length > 1 && (
                                  <path
                                    d={linePath}
                                    fill="none"
                                    stroke={COLORS.boneWhite}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                )}

                                {/* Points with level labels */}
                                {levelData.map((d, i) => (
                                  <g key={d.date}>
                                    <circle
                                      cx={scaleX(i)}
                                      cy={scaleY(d.level)}
                                      r={5}
                                      fill={COLORS.boneWhite}
                                    />
                                    {/* Level value above point */}
                                    <text
                                      x={scaleX(i)}
                                      y={scaleY(d.level) - 10}
                                      textAnchor="middle"
                                      fill={COLORS.boneWhite}
                                      fontSize={10}
                                      fontWeight="bold"
                                    >
                                      {d.level}
                                    </text>
                                    {/* Delta */}
                                    {d.delta > 0 && (
                                      <text
                                        x={scaleX(i) + 12}
                                        y={scaleY(d.level) - 10}
                                        textAnchor="start"
                                        fill={COLORS.bossAmber}
                                        fontSize={9}
                                      >
                                        +{d.delta}
                                      </text>
                                    )}
                                    {/* Date label */}
                                    <text
                                      x={scaleX(i)}
                                      y={chartHeight - 5}
                                      textAnchor="middle"
                                      fill={COLORS.fogGray}
                                      fontSize={8}
                                    >
                                      {formatDateShort(d.date)}
                                    </text>
                                  </g>
                                ))}

                                {/* Y-axis label */}
                                <text
                                  x={5}
                                  y={padding.top + innerHeight / 2}
                                  textAnchor="middle"
                                  fill={COLORS.fogGray}
                                  fontSize={9}
                                  transform={`rotate(-90, 10, ${padding.top + innerHeight / 2})`}
                                >
                                  LVL
                                </text>
                              </svg>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

                  {sortedPanelEvents.map((event, index) => {
                    if (event.type === 'boss') {
                      const b = event.data
                      return (
                        <motion.div
                          key={`boss-${b.id}`}
                          className="relative group overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(40, 50, 48, 0.4) 0%, rgba(15, 25, 22, 0.6) 100%)',
                            border: `1px solid ${COLORS.bossAmberDark}40`
                          }}
                          initial={{ opacity: 0, x: -30, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.08, type: 'spring', stiffness: 300 }}
                          whileHover={{
                            borderColor: `${COLORS.bossAmber}80`,
                            boxShadow: `0 0 20px ${COLORS.bossAmber}20`
                          }}
                        >
                          {/* Left accent bar */}
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{ background: `linear-gradient(180deg, ${COLORS.bossAmber}, ${COLORS.bossAmberDark})` }}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: index * 0.08 + 0.2 }}
                          />

                          {/* Hover glow effect */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: `radial-gradient(ellipse at center, ${COLORS.bossAmber}10 0%, transparent 70%)` }}
                          />

                          <div className="relative p-4 pl-5">
                            {editingBoss === b.id ? (
                              <div className="space-y-3">
                                {/* Name input */}
                                <div>
                                  <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: COLORS.bossAmberDark }}>
                                    Name
                                  </label>
                                  <input
                                    type="text"
                                    value={editBossName}
                                    onChange={(e) => setEditBossName(e.target.value)}
                                    className="w-full text-base px-3 py-2 focus:outline-none backdrop-blur-sm"
                                    style={{
                                      fontFamily: "'Liberation Serif', serif",
                                      backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                      color: COLORS.boneWhite,
                                      border: `1px solid ${COLORS.bossAmber}80`
                                    }}
                                    autoFocus
                                  />
                                </div>

                                {/* Deaths */}
                                <div>
                                  <label className="text-xs uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: COLORS.bossAmberDark }}>
                                    <span style={{ color: COLORS.bloodRed }}>☠</span> Deaths
                                  </label>
                                  <input
                                    type="number"
                                    value={editBossDeaths}
                                    onChange={(e) => setEditBossDeaths(e.target.value)}
                                    min="0"
                                    className="w-full text-base px-3 py-2 focus:outline-none backdrop-blur-sm"
                                    style={{
                                      fontFamily: "'Liberation Serif', serif",
                                      backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                      color: COLORS.bossAmber,
                                      border: `1px solid ${COLORS.bloodRed}60`
                                    }}
                                  />
                                </div>

                                {/* Segments editing */}
                                <div>
                                  <label className="text-xs uppercase tracking-wider mb-2 flex items-center justify-between" style={{ color: COLORS.bossAmberDark }}>
                                    <span>Segments ({editBossSegments.length})</span>
                                    <button
                                      onClick={() => setEditBossSegments([...editBossSegments, { start: '', end: '' }])}
                                      className="text-xs px-2 py-0.5"
                                      style={{ color: COLORS.bossAmber, border: `1px solid ${COLORS.bossAmber}60` }}
                                    >
                                      + Add
                                    </button>
                                  </label>
                                  <div className="space-y-2 max-h-40 overflow-y-auto overflow-x-hidden">
                                    {editBossSegments.map((seg, i) => (
                                      <div key={i} className="flex gap-2 items-center">
                                        <span className="text-xs w-4 shrink-0" style={{ color: COLORS.fogGray }}>{i + 1}</span>
                                        <input
                                          type="text"
                                          value={seg.start}
                                          onChange={(e) => {
                                            const newSegs = [...editBossSegments]
                                            newSegs[i] = { ...newSegs[i], start: e.target.value }
                                            setEditBossSegments(newSegs)
                                          }}
                                          placeholder="start"
                                          className="flex-1 min-w-0 text-sm px-2 py-1 focus:outline-none"
                                          style={{
                                            fontFamily: "'Liberation Serif', serif",
                                            backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                            color: COLORS.coldGray,
                                            border: `1px solid ${COLORS.bossAmberDark}40`
                                          }}
                                        />
                                        <span className="shrink-0" style={{ color: COLORS.fogGray }}>→</span>
                                        <input
                                          type="text"
                                          value={seg.end}
                                          onChange={(e) => {
                                            const newSegs = [...editBossSegments]
                                            newSegs[i] = { ...newSegs[i], end: e.target.value }
                                            setEditBossSegments(newSegs)
                                          }}
                                          placeholder="end"
                                          className="flex-1 min-w-0 text-sm px-2 py-1 focus:outline-none"
                                          style={{
                                            fontFamily: "'Liberation Serif', serif",
                                            backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                            color: COLORS.coldGray,
                                            border: `1px solid ${COLORS.bossAmberDark}40`
                                          }}
                                        />
                                        {editBossSegments.length > 1 && (
                                          <button
                                            onClick={() => {
                                              setEditBossSegments(editBossSegments.filter((_, idx) => idx !== i))
                                            }}
                                            className="text-xs px-1 shrink-0"
                                            style={{ color: COLORS.bloodRedDark }}
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Auto-calculated total duration display */}
                                {editBossSegments.length > 0 && (
                                  <div className="text-xs text-center" style={{ color: COLORS.bossAmberDark }}>
                                    Total Duration: <span style={{ color: COLORS.bossAmber }}>
                                      {formatTime(editBossSegments.reduce((sum, seg) => {
                                        const start = parseTimeInput(seg.start)
                                        const end = parseTimeInput(seg.end)
                                        return sum + Math.max(0, end - start)
                                      }, 0))}
                                    </span>
                                  </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex gap-3 pt-2">
                                  <motion.button
                                    onClick={handleSaveBoss}
                                    className="flex-1 px-3 py-2 text-sm uppercase tracking-wider"
                                    style={{ color: COLORS.bossAmber, border: `1px solid ${COLORS.bossAmber}` }}
                                    whileHover={{ backgroundColor: `${COLORS.bossAmber}20` }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Save
                                  </motion.button>
                                  <motion.button
                                    onClick={() => {
                                      setEditingBoss(null)
                                      setEditBossName('')
                                      setEditBossDeaths('')
                                      setEditBossSegments([])
                                    }}
                                    className="px-3 py-2 text-sm"
                                    style={{ color: COLORS.bossAmberDark }}
                                    whileHover={{ color: COLORS.bossAmber }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Cancel
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Boss name */}
                                <div
                                  className="text-lg mb-2 tracking-wide"
                                  style={{ color: COLORS.boneWhite, fontFamily: "'Liberation Serif', serif" }}
                                >
                                  {b.name}
                                </div>

                                {/* Stats row */}
                                <div className="flex items-center gap-4 mb-2">
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ color: COLORS.bloodRed }}>☠</span>
                                    <span className="text-sm font-medium" style={{ color: COLORS.bossAmber }}>
                                      {b.deathsOnBoss}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span style={{ color: COLORS.bossAmberDark }}>⏱</span>
                                    <span className="text-sm" style={{ color: COLORS.coldGray }}>
                                      {formatTime(b.duration)}
                                    </span>
                                  </div>
                                </div>

                                {/* Time range - clickable if has multiple segments */}
                                <div
                                  className={`text-xs tracking-wider ${b.segments && b.segments.length > 1 ? 'cursor-pointer hover:opacity-80' : ''}`}
                                  style={{ color: COLORS.bossAmberDark }}
                                  onClick={() => {
                                    if (b.segments && b.segments.length > 1) {
                                      setExpandedBoss(expandedBoss === b.id ? null : b.id)
                                    }
                                  }}
                                >
                                  {formatTime(b.startTime)} → {formatTime(b.endTime)}
                                  {b.segments && b.segments.length > 1 && (
                                    <span className="ml-2" style={{ color: COLORS.bossAmber }}>
                                      ({b.segments.length} сегм.) {expandedBoss === b.id ? '▲' : '▼'}
                                    </span>
                                  )}
                                </div>

                                {/* Expanded segments list */}
                                <AnimatePresence>
                                  {expandedBoss === b.id && b.segments && b.segments.length > 1 && (
                                    <motion.div
                                      className="mt-2 pt-2 space-y-1 border-t"
                                      style={{ borderColor: `${COLORS.bossAmberDark}20` }}
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      {b.segments.map((seg, i) => (
                                        <div
                                          key={`seg-${b.id}-${i}`}
                                          className="text-xs flex justify-between"
                                          style={{ color: COLORS.fogGray }}
                                        >
                                          <span>Сегмент {i + 1}:</span>
                                          <span style={{ color: COLORS.coldGray }}>
                                            {formatTime(seg.start)} → {formatTime(seg.end)}
                                            <span className="ml-2" style={{ color: COLORS.bossAmberDark }}>
                                              ({formatTime(seg.end - seg.start)})
                                            </span>
                                          </span>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Action buttons */}
                                <motion.div
                                  className="flex gap-3 mt-3 pt-3 border-t"
                                  style={{ borderColor: `${COLORS.bossAmberDark}30` }}
                                  initial={{ opacity: 0, y: 10 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                >
                                  <motion.button
                                    onClick={() => handleEditBoss(b.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.bossAmberDark }}
                                    whileHover={{ color: COLORS.bossAmber, backgroundColor: `${COLORS.bossAmber}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✎ Edit
                                  </motion.button>
                                  <motion.button
                                    onClick={() => handleDeleteBoss(b.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.bloodRedDark }}
                                    whileHover={{ color: COLORS.bloodRed, backgroundColor: `${COLORS.bloodRed}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✕ Delete
                                  </motion.button>
                                </motion.div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    // Boss fight start marker
                    if (event.type === 'boss_start') {
                      const isPending = event.bossId === 'pending'
                      return (
                        <motion.div
                          key={`boss-start-${event.bossId}-${event.time}`}
                          className="relative overflow-hidden"
                          style={{
                            background: `linear-gradient(135deg, ${COLORS.bossAmber}10 0%, ${COLORS.bossAmberDark}05 100%)`,
                            border: `1px solid ${COLORS.bossAmber}30`,
                            borderLeft: `3px solid ${COLORS.bossAmber}`
                          }}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className="p-2 pl-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span style={{ color: COLORS.bossAmber }}>⚔️</span>
                              <span className="text-sm" style={{ color: COLORS.bossAmber, fontFamily: "'Liberation Serif', serif" }}>
                                {isPending ? 'Бой идёт...' : 'Бой начат'}
                              </span>
                              {event.bossName && (
                                <span className="text-xs" style={{ color: COLORS.coldGray }}>
                                  — {event.bossName}
                                </span>
                              )}
                            </div>
                            <span className="text-xs" style={{ color: COLORS.bossAmberDark }}>
                              {formatTime(event.time)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    }

                    // Boss fight pause marker
                    if (event.type === 'boss_pause') {
                      return (
                        <motion.div
                          key={`boss-pause-${event.bossId}-${event.time}`}
                          className="relative overflow-hidden"
                          style={{
                            background: `${COLORS.fogGray}10`,
                            borderLeft: `2px solid ${COLORS.fogGray}60`
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <div className="p-1.5 pl-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span style={{ color: COLORS.fogGray, fontSize: '12px' }}>⏸️</span>
                              <span className="text-xs" style={{ color: COLORS.fogGray }}>
                                Пауза
                              </span>
                            </div>
                            <span className="text-xs" style={{ color: COLORS.fogGray }}>
                              {formatTime(event.time)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    }

                    // Boss fight resume marker
                    if (event.type === 'boss_resume') {
                      return (
                        <motion.div
                          key={`boss-resume-${event.bossId}-${event.time}`}
                          className="relative overflow-hidden"
                          style={{
                            background: `${COLORS.bossAmber}08`,
                            borderLeft: `2px solid ${COLORS.bossAmber}40`
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <div className="p-1.5 pl-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span style={{ color: COLORS.bossAmberDark, fontSize: '12px' }}>▶️</span>
                              <span className="text-xs" style={{ color: COLORS.bossAmberDark }}>
                                Продолжение
                              </span>
                            </div>
                            <span className="text-xs" style={{ color: COLORS.bossAmberDark }}>
                              {formatTime(event.time)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    }
                    // Milestone card
                    if (event.type === 'milestone') {
                      const m = event.data
                      return (
                        <motion.div
                          key={`milestone-${m.id}`}
                          className="relative group overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(50, 50, 50, 0.4) 0%, rgba(25, 25, 25, 0.6) 100%)',
                            border: `1px solid ${COLORS.fogGray}40`
                          }}
                          initial={{ opacity: 0, x: -30, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.08, type: 'spring', stiffness: 300 }}
                          whileHover={{
                            borderColor: `${COLORS.coldGray}80`,
                            boxShadow: `0 0 20px ${COLORS.coldGray}15`
                          }}
                        >
                          {/* Left accent bar - gray for milestones */}
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{ background: `linear-gradient(180deg, ${COLORS.coldGray}, ${COLORS.fogGray})` }}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: index * 0.08 + 0.2 }}
                          />

                          {/* Hover glow effect */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: `radial-gradient(ellipse at center, ${COLORS.coldGray}10 0%, transparent 70%)` }}
                          />

                          <div className="relative p-4 pl-5">
                            {editingMilestone === m.id ? (
                              <div className="space-y-3">
                                {/* Name input */}
                                <div>
                                  <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: COLORS.fogGray }}>
                                    Name
                                  </label>
                                  <input
                                    type="text"
                                    value={editMilestoneName}
                                    onChange={(e) => setEditMilestoneName(e.target.value)}
                                    className="w-full text-base px-3 py-2 focus:outline-none backdrop-blur-sm"
                                    style={{
                                      fontFamily: "'Liberation Serif', serif",
                                      backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                      color: COLORS.boneWhite,
                                      border: `1px solid ${COLORS.coldGray}80`
                                    }}
                                    autoFocus
                                  />
                                </div>

                                {/* Icon picker */}
                                <div className="flex flex-wrap gap-1">
                                  {MILESTONE_ICONS.map(icon => (
                                    <button
                                      key={icon}
                                      onClick={() => setEditMilestoneIcon(icon)}
                                      className="w-8 h-8 flex items-center justify-center text-sm"
                                      style={{
                                        backgroundColor: editMilestoneIcon === icon ? `${COLORS.coldGray}30` : 'transparent',
                                        border: `1px solid ${editMilestoneIcon === icon ? COLORS.coldGray : COLORS.fogGray}`,
                                        color: editMilestoneIcon === icon ? COLORS.boneWhite : COLORS.coldGray
                                      }}
                                    >
                                      {icon}
                                    </button>
                                  ))}
                                </div>

                                {/* Time input */}
                                <div>
                                  <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: COLORS.fogGray }}>
                                    Time
                                  </label>
                                  <input
                                    type="text"
                                    value={editMilestoneTime}
                                    onChange={(e) => setEditMilestoneTime(e.target.value)}
                                    placeholder="1:30:00"
                                    className="w-full text-base px-3 py-2 focus:outline-none backdrop-blur-sm"
                                    style={{
                                      fontFamily: "'Liberation Serif', serif",
                                      backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                      color: COLORS.boneWhite,
                                      border: `1px solid ${COLORS.coldGray}80`
                                    }}
                                  />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3 pt-2">
                                  <motion.button
                                    onClick={handleSaveMilestone}
                                    className="flex-1 px-3 py-2 text-sm uppercase tracking-wider"
                                    style={{ color: COLORS.coldGray, border: `1px solid ${COLORS.coldGray}` }}
                                    whileHover={{ backgroundColor: `${COLORS.coldGray}20` }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Save
                                  </motion.button>
                                  <motion.button
                                    onClick={() => {
                                      setEditingMilestone(null)
                                      setEditMilestoneName('')
                                      setEditMilestoneIcon('')
                                      setEditMilestoneTime('')
                                    }}
                                    className="px-3 py-2 text-sm"
                                    style={{ color: COLORS.fogGray }}
                                    whileHover={{ color: COLORS.coldGray }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Cancel
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Milestone display */}
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-xl">{m.icon}</span>
                                  <span
                                    className="text-lg tracking-wide"
                                    style={{ color: COLORS.boneWhite, fontFamily: "'Liberation Serif', serif" }}
                                  >
                                    {m.name}
                                  </span>
                                </div>

                                {/* Time */}
                                <div className="text-xs tracking-wider" style={{ color: COLORS.fogGray }}>
                                  @ {formatTime(m.timestamp)}
                                </div>

                                {/* Action buttons */}
                                <motion.div
                                  className="flex gap-3 mt-3 pt-3 border-t"
                                  style={{ borderColor: `${COLORS.fogGray}30` }}
                                  initial={{ opacity: 0, y: 10 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                >
                                  <motion.button
                                    onClick={() => handleEditMilestone(m.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.fogGray }}
                                    whileHover={{ color: COLORS.coldGray, backgroundColor: `${COLORS.coldGray}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✎ Edit
                                  </motion.button>
                                  <motion.button
                                    onClick={() => handleDeleteMilestone(m.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.bloodRedDark }}
                                    whileHover={{ color: COLORS.bloodRed, backgroundColor: `${COLORS.bloodRed}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✕ Delete
                                  </motion.button>
                                </motion.div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    // Stats card
                    if (event.type === 'stats') {
                      const s = event.data
                      return (
                        <motion.div
                          key={`stats-${s.id}`}
                          className="relative group overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, rgba(60, 55, 50, 0.4) 0%, rgba(30, 28, 25, 0.6) 100%)',
                            border: `1px solid ${COLORS.ashGray}40`
                          }}
                          initial={{ opacity: 0, x: -30, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.08, type: 'spring', stiffness: 300 }}
                          whileHover={{
                            borderColor: `${COLORS.coldGray}80`,
                            boxShadow: `0 0 20px ${COLORS.coldGray}15`
                          }}
                        >
                          {/* Left accent bar - warm gray for stats */}
                          <motion.div
                            className="absolute left-0 top-0 bottom-0 w-1"
                            style={{ background: `linear-gradient(180deg, ${COLORS.ashGray}, ${COLORS.fogGray})` }}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: index * 0.08 + 0.2 }}
                          />

                          {/* Hover glow effect */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                            style={{ background: `radial-gradient(ellipse at center, ${COLORS.coldGray}08 0%, transparent 70%)` }}
                          />

                          <div className="relative p-4 pl-5">
                            {editingStats === s.id ? (
                              <div className="space-y-3">
                                {/* Stats grid for editing - Bloodborne */}
                                {isBloodborneStats(s) && (
                                  <div className="grid grid-cols-3 gap-2">
                                    {[
                                      { key: 'level', label: 'Level' },
                                      { key: 'vitality', label: 'VIT' },
                                      { key: 'endurance', label: 'END' },
                                      { key: 'strength', label: 'STR' },
                                      { key: 'skill', label: 'SKL' },
                                      { key: 'bloodtinge', label: 'BLT' },
                                      { key: 'arcane', label: 'ARC' },
                                      { key: 'bloodEchoes', label: 'Echoes' },
                                      { key: 'insight', label: 'Insight' }
                                    ].map(({ key, label }) => (
                                      <div key={key}>
                                        <label className="text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1" style={{ color: COLORS.fogGray }}>
                                          <img src={STAT_ICONS[key]} alt={label} className="w-3 h-3" style={{ filter: 'brightness(0.7)' }} />
                                          {label}
                                        </label>
                                        <input
                                          type="number"
                                          defaultValue={s[key as keyof CharacterStats] as number}
                                          className="w-full px-1.5 py-1 text-center text-sm focus:outline-none"
                                          style={{
                                            fontFamily: "'Liberation Serif', serif",
                                            backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                            color: key === 'level' ? COLORS.boneWhite : COLORS.coldGray,
                                            border: `1px solid ${COLORS.fogGray}60`
                                          }}
                                          id={`edit-stats-${s.id}-${key}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Stats grid for editing - Elden Ring */}
                                {isEldenRingStats(s) && (
                                  <div className="grid grid-cols-5 gap-2">
                                    {[
                                      { key: 'level', label: 'Level' },
                                      { key: 'vigor', label: 'VIG' },
                                      { key: 'mind', label: 'MND' },
                                      { key: 'endurance', label: 'END' },
                                      { key: 'strength', label: 'STR' },
                                      { key: 'dexterity', label: 'DEX' },
                                      { key: 'intelligence', label: 'INT' },
                                      { key: 'faith', label: 'FTH' },
                                      { key: 'arcane', label: 'ARC' },
                                      { key: 'runes', label: 'Runes' }
                                    ].map(({ key, label }) => (
                                      <div key={key} className={key === 'runes' ? 'col-span-5' : ''}>
                                        <label className="text-[10px] uppercase tracking-wider mb-0.5 flex items-center gap-1" style={{ color: '#5E6A6F' }}>
                                          {label}
                                        </label>
                                        <input
                                          type="number"
                                          defaultValue={s[key as keyof EldenRingCharacterStats] as number}
                                          className="w-full px-1.5 py-1 text-center text-sm focus:outline-none"
                                          style={{
                                            fontFamily: "'Liberation Serif', serif",
                                            backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                            color: key === 'level' ? '#C9A24D' : '#D6D1C4',
                                            border: '1px solid #5E6A6F60'
                                          }}
                                          id={`edit-stats-${s.id}-${key}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Notes */}
                                <textarea
                                  defaultValue={s.notes || ''}
                                  placeholder="Notes..."
                                  className="w-full px-2 py-1 text-sm focus:outline-none resize-none"
                                  style={{
                                    fontFamily: "'Liberation Serif', serif",
                                    backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                    color: COLORS.coldGray,
                                    border: `1px solid ${COLORS.fogGray}60`
                                  }}
                                  rows={1}
                                  id={`edit-stats-${s.id}-notes`}
                                />

                                {/* Time input */}
                                <div>
                                  <label className="text-[10px] uppercase tracking-wider mb-0.5 block" style={{ color: COLORS.fogGray }}>
                                    Time
                                  </label>
                                  <input
                                    type="text"
                                    value={editStatsTime}
                                    onChange={(e) => setEditStatsTime(e.target.value)}
                                    placeholder="1:30:00"
                                    className="w-full px-2 py-1 text-sm focus:outline-none"
                                    style={{
                                      fontFamily: "'Liberation Serif', serif",
                                      backgroundColor: 'rgba(10, 10, 10, 0.8)',
                                      color: COLORS.boneWhite,
                                      border: `1px solid ${COLORS.fogGray}60`
                                    }}
                                  />
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3 pt-1">
                                  <motion.button
                                    onClick={handleSaveStats}
                                    className="flex-1 px-2 py-1.5 text-xs uppercase tracking-wider"
                                    style={{ color: COLORS.coldGray, border: `1px solid ${COLORS.coldGray}` }}
                                    whileHover={{ backgroundColor: `${COLORS.coldGray}20` }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Save
                                  </motion.button>
                                  <motion.button
                                    onClick={() => {
                                      setEditingStats(null)
                                      setEditStatsTime('')
                                    }}
                                    className="px-2 py-1.5 text-xs"
                                    style={{ color: COLORS.fogGray }}
                                    whileHover={{ color: COLORS.coldGray }}
                                    whileTap={{ scale: 0.98 }}
                                  >
                                    Cancel
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <img src={STAT_ICONS.level} alt="Level" className="w-5 h-5" />
                                    <span
                                      className="text-lg tracking-wide"
                                      style={{ color: COLORS.boneWhite, fontFamily: "'Liberation Serif', serif" }}
                                    >
                                      Level {s.level}
                                    </span>
                                  </div>
                                  <span className="text-xs" style={{ color: COLORS.fogGray }}>
                                    @ {formatTime(s.timestamp)}
                                  </span>
                                </div>

                                {/* Stats grid - Bloodborne */}
                                {isBloodborneStats(s) && (
                                  <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-sm mb-2">
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.vitality} alt="VIT" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.vitality}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.endurance} alt="END" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.endurance}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.strength} alt="STR" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.strength}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.skill} alt="SKL" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.skill}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.bloodtinge} alt="BLT" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.bloodtinge}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.arcane} alt="ARC" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.arcane}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.bloodEchoes} alt="Echoes" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.bloodEchoes > 1000 ? `${Math.floor(s.bloodEchoes / 1000)}k` : s.bloodEchoes}</span></div>
                                    <div className="flex items-center gap-1"><img src={STAT_ICONS.insight} alt="Insight" className="w-3.5 h-3.5" style={{ filter: 'brightness(0.7)' }} /> <span style={{ color: COLORS.coldGray }}>{s.insight}</span></div>
                                  </div>
                                )}
                                {/* Stats grid - Elden Ring */}
                                {isEldenRingStats(s) && (
                                  <div className="grid grid-cols-5 gap-x-2 gap-y-1 text-sm mb-2">
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>VIG</span> <span style={{ color: '#D6D1C4' }}>{s.vigor}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>MND</span> <span style={{ color: '#D6D1C4' }}>{s.mind}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>END</span> <span style={{ color: '#D6D1C4' }}>{s.endurance}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>STR</span> <span style={{ color: '#D6D1C4' }}>{s.strength}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>DEX</span> <span style={{ color: '#D6D1C4' }}>{s.dexterity}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>INT</span> <span style={{ color: '#D6D1C4' }}>{s.intelligence}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>FTH</span> <span style={{ color: '#D6D1C4' }}>{s.faith}</span></div>
                                    <div className="flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>ARC</span> <span style={{ color: '#D6D1C4' }}>{s.arcane}</span></div>
                                    <div className="col-span-2 flex items-center gap-1"><span style={{ color: '#5E6A6F' }}>Runes</span> <span style={{ color: '#C9A24D' }}>{s.runes > 1000 ? `${Math.floor(s.runes / 1000)}k` : s.runes}</span></div>
                                  </div>
                                )}

                                {s.notes && (
                                  <div className="text-xs italic mb-2" style={{ color: COLORS.fogGray }}>
                                    {s.notes}
                                  </div>
                                )}

                                {/* Action buttons */}
                                <motion.div
                                  className="flex gap-3 mt-2 pt-2 border-t"
                                  style={{ borderColor: `${COLORS.fogGray}30` }}
                                  initial={{ opacity: 0, y: 10 }}
                                  whileInView={{ opacity: 1, y: 0 }}
                                >
                                  <motion.button
                                    onClick={() => handleEditStats(s.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.fogGray }}
                                    whileHover={{ color: COLORS.coldGray, backgroundColor: `${COLORS.coldGray}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✎ Edit
                                  </motion.button>
                                  <motion.button
                                    onClick={() => handleDeleteStats(s.id)}
                                    className="text-sm px-4 py-2 min-h-[40px] tracking-wider uppercase"
                                    style={{ color: COLORS.bloodRedDark }}
                                    whileHover={{ color: COLORS.bloodRed, backgroundColor: `${COLORS.bloodRed}15` }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    ✕ Delete
                                  </motion.button>
                                </motion.div>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )
                    }
                    // Death card (inline, not grid)
                    if (event.type === 'death') {
                      const deathIndex = event.index
                      const timestamp = event.time
                      const duringBoss = isDeathDuringBoss(timestamp)
                      return (
                        <motion.div
                          key={`death-card-${deathIndex}-${timestamp}`}
                          className={`relative group flex items-center gap-3 p-2 overflow-hidden ${duringBoss ? 'ml-6' : ''}`}
                          style={{
                            background: duringBoss
                              ? `linear-gradient(135deg, rgba(80, 40, 40, 0.25) 0%, rgba(50, 35, 35, 0.35) 100%)`
                              : `linear-gradient(135deg, rgba(100, 30, 30, 0.2) 0%, rgba(40, 15, 15, 0.3) 100%)`,
                            border: `1px solid ${duringBoss ? COLORS.bossAmberDark : COLORS.bloodRed}30`,
                            borderLeft: duringBoss ? `3px solid ${COLORS.bossAmberDark}60` : undefined
                          }}
                          initial={{ opacity: 0, x: -30, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
                          whileHover={{
                            borderColor: `${duringBoss ? COLORS.bossAmberDark : COLORS.bloodRed}60`,
                            boxShadow: `0 0 15px ${duringBoss ? COLORS.bossAmberDark : COLORS.bloodRed}15`
                          }}
                        >
                          {/* Left accent bar - animated (hidden when duringBoss has special left border) */}
                          {!duringBoss && (
                            <motion.div
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{ background: `linear-gradient(180deg, ${COLORS.bloodRed}, ${COLORS.bloodRedDark})` }}
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: index * 0.05 + 0.15 }}
                            />
                          )}

                          {/* Hover glow effect */}
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                            style={{ background: `radial-gradient(ellipse at center, ${duringBoss ? COLORS.bossAmberDark : COLORS.bloodRed}08 0%, transparent 70%)` }}
                          />

                          {editingDeathIndex === deathIndex ? (
                            <div className="flex-1 flex items-center gap-2 pl-3">
                              <input
                                type="text"
                                value={editDeathTime}
                                onChange={(e) => setEditDeathTime(e.target.value)}
                                placeholder="0:00"
                                className="w-24 text-sm px-2 py-1 focus:outline-none"
                                style={{
                                  fontFamily: "'Liberation Serif', serif",
                                  backgroundColor: 'rgba(10, 10, 10, 0.9)',
                                  color: COLORS.boneWhite,
                                  border: `1px solid ${COLORS.bloodRed}80`
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveDeath()
                                  else if (e.key === 'Escape') {
                                    setEditingDeathIndex(null)
                                    setEditDeathTime('')
                                  }
                                }}
                              />
                              <button
                                onClick={handleSaveDeath}
                                className="text-xs px-2 py-1"
                                style={{ color: COLORS.coldGray, border: `1px solid ${COLORS.coldGray}60` }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingDeathIndex(null)
                                  setEditDeathTime('')
                                }}
                                className="text-xs px-2 py-1"
                                style={{ color: COLORS.fogGray }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="pl-3 flex items-center gap-2">
                                <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: COLORS.bloodRed, backgroundColor: `${COLORS.bloodRed}15` }}>
                                  #{event.deathNumber}
                                </span>
                                <span style={{ color: COLORS.bloodRed }}>💀</span>
                                <span
                                  className="text-sm tracking-wider"
                                  style={{ color: COLORS.coldGray, fontFamily: "'Liberation Serif', serif" }}
                                >
                                  {formatTime(timestamp)}
                                </span>
                              </div>
                              <div className="flex-1" />
                              <motion.button
                                onClick={() => {
                                  setEditingDeathIndex(deathIndex)
                                  setEditDeathTime(formatTime(timestamp))
                                }}
                                className="text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: COLORS.fogGray }}
                                whileHover={{ color: COLORS.coldGray }}
                              >
                                ✎
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteDeath(deathIndex)}
                                className="text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: COLORS.bloodRedDark }}
                                whileHover={{ color: COLORS.bloodRed }}
                              >
                                ✕
                              </motion.button>
                            </>
                          )}
                        </motion.div>
                      )
                    }
                    return null
                  })}
                  {sortedPanelEvents.length === 0 && (
                    <div className="text-center py-8" style={{ color: COLORS.fogGray }}>No entries yet</div>
                  )}
                </>
              )}

              {/* Daily Tab */}
              {panelTab === 'daily' && (
                <div className="space-y-3">
                  {dailyStats.length === 0 ? (
                    <div className="text-center py-8" style={{ color: COLORS.fogGray }}>
                      Нет данных за дни
                    </div>
                  ) : (
                    dailyStats.map((day, index) => (
                      <motion.div
                        key={day.date}
                        className="relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, rgba(40,50,48,0.4), rgba(15,25,22,0.6))',
                          border: `1px solid ${COLORS.bossAmberDark}30`
                        }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        {/* Left accent bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1"
                             style={{ background: `linear-gradient(180deg, ${COLORS.bossAmber}, ${COLORS.bossAmberDark})` }} />

                        <div className="p-3 pl-4">
                          {/* Date header */}
                          <div className="text-lg mb-2" style={{ color: COLORS.boneWhite }}>
                            {day.displayDate}
                          </div>

                          {/* Playtime and Deaths row */}
                          <div className="flex gap-4 text-sm mb-2" style={{ color: COLORS.coldGray }}>
                            <span>⏱ {formatTime(day.playtime)}</span>
                            <span style={{ color: COLORS.bloodRed }}>☠ {day.deaths}</span>
                          </div>

                          {/* Stats with deltas - Bloodborne */}
                          {day.stats && isBloodborneStats(day.stats) && (
                            <div className="text-xs grid grid-cols-4 gap-1 mb-2" style={{ color: COLORS.fogGray }}>
                              <span>LVL <span style={{ color: COLORS.boneWhite }}>{day.stats.level}</span>
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.level ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.level}</span> : null}
                              </span>
                              <span>VIT {day.stats.vitality}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.vitality ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.vitality}</span> : null}
                              </span>
                              <span>END {day.stats.endurance}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.endurance ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.endurance}</span> : null}
                              </span>
                              <span>STR {day.stats.strength}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.strength ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.strength}</span> : null}
                              </span>
                              <span>SKL {day.stats.skill}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.skill ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.skill}</span> : null}
                              </span>
                              <span>BLT {day.stats.bloodtinge}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.bloodtinge ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.bloodtinge}</span> : null}
                              </span>
                              <span>ARC {day.stats.arcane}
                                {day.statsDelta && isBloodborneStatsDelta(day.statsDelta) && day.statsDelta.arcane ? <span style={{ color: COLORS.bossAmber }}> +{day.statsDelta.arcane}</span> : null}
                              </span>
                            </div>
                          )}
                          {/* Stats with deltas - Elden Ring */}
                          {day.stats && isEldenRingStats(day.stats) && (
                            <div className="text-xs grid grid-cols-5 gap-1 mb-2" style={{ color: '#5E6A6F' }}>
                              <span>LVL <span style={{ color: '#C9A24D' }}>{day.stats.level}</span>
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.level ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.level}</span> : null}
                              </span>
                              <span>VIG {day.stats.vigor}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.vigor ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.vigor}</span> : null}
                              </span>
                              <span>MND {day.stats.mind}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.mind ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.mind}</span> : null}
                              </span>
                              <span>END {day.stats.endurance}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.endurance ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.endurance}</span> : null}
                              </span>
                              <span>STR {day.stats.strength}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.strength ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.strength}</span> : null}
                              </span>
                              <span>DEX {day.stats.dexterity}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.dexterity ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.dexterity}</span> : null}
                              </span>
                              <span>INT {day.stats.intelligence}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.intelligence ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.intelligence}</span> : null}
                              </span>
                              <span>FTH {day.stats.faith}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.faith ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.faith}</span> : null}
                              </span>
                              <span>ARC {day.stats.arcane}
                                {day.statsDelta && isEldenRingStatsDelta(day.statsDelta) && day.statsDelta.arcane ? <span style={{ color: '#C9A24D' }}> +{day.statsDelta.arcane}</span> : null}
                              </span>
                            </div>
                          )}

                          {/* Bosses section */}
                          {day.bosses.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                              {day.bosses.map(b => (
                                <span key={b.id} className="text-xs px-2 py-0.5"
                                      style={{ backgroundColor: `${COLORS.bossAmber}20`, color: COLORS.bossAmber }}>
                                  {b.name || 'Boss'} <span style={{ color: COLORS.bloodRed }}>☠{b.deathsOnBoss}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Milestones section */}
                          {day.milestones.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {day.milestones.map(m => (
                                <span key={m.id} className="text-xs px-2 py-0.5"
                                      style={{ backgroundColor: `${COLORS.coldGray}15`, color: COLORS.coldGray }}>
                                  {m.icon} {m.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline bar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-[60px] z-40 select-none">
        <div className="relative mx-4 h-full">
          {/* Time labels */}
          <span
            className="absolute left-0 bottom-2 text-xs"
            style={{ color: COLORS.fogGray, fontFamily: "'Liberation Serif', serif" }}
          >
            {formatTime(viewStart)}
          </span>
          <span
            className="absolute right-0 bottom-2 text-xs"
            style={{ color: COLORS.fogGray, fontFamily: "'Liberation Serif', serif" }}
          >
            {formatTime(viewEnd)}
          </span>

          {/* Zoom controls */}
          <div className="absolute left-0 bottom-[40px] flex items-center gap-1">
            <motion.button
              onClick={zoomOut}
              className="w-6 h-6 flex items-center justify-center text-sm rounded"
              style={{
                backgroundColor: COLORS.nearBlack,
                border: `1px solid ${COLORS.fogGray}50`,
                color: COLORS.coldGray
              }}
              whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.boneWhite }}
              whileTap={{ scale: 0.9 }}
            >
              -
            </motion.button>
            {isZoomed && (
              <span
                className="px-1.5 text-xs"
                style={{ color: COLORS.fogGray, fontFamily: "'Liberation Serif', serif" }}
              >
                {zoomLevel.toFixed(1)}x
              </span>
            )}
            <motion.button
              onClick={zoomIn}
              className="w-6 h-6 flex items-center justify-center text-sm rounded"
              style={{
                backgroundColor: COLORS.nearBlack,
                border: `1px solid ${COLORS.fogGray}50`,
                color: COLORS.coldGray
              }}
              whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.boneWhite }}
              whileTap={{ scale: 0.9 }}
            >
              +
            </motion.button>
            {isZoomed && (
              <motion.button
                onClick={resetZoom}
                className="ml-1 px-2 h-6 flex items-center justify-center text-xs rounded"
                style={{
                  backgroundColor: COLORS.nearBlack,
                  border: `1px solid ${COLORS.fogGray}50`,
                  color: COLORS.coldGray,
                  fontFamily: "'Liberation Serif', serif"
                }}
                whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.boneWhite }}
                whileTap={{ scale: 0.9 }}
              >
                Reset
              </motion.button>
            )}
          </div>

          {/* Base line */}
          <div
            className="absolute left-0 right-0 bottom-[28px] h-[2px]"
            style={{ backgroundColor: themeTimelineColors.progressBar }}
          />

          {/* Current time indicator (right edge, pulsing) */}
          <motion.div
            className="absolute right-0 bottom-[21px] w-[4px] h-[16px] rounded-full"
            style={{
              backgroundColor: themeTimelineColors.death,
              boxShadow: `0 0 8px ${themeTimelineColors.death}`
            }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Boss fight ranges */}
          {state.bossFights.map(boss => (boss.segments || [{ start: boss.startTime, end: boss.endTime }]).map((seg, i) => {
            const startP = getPosition(seg.start)
            const endP = getPosition(seg.end)
            if (startP > 100 || endP < 0) return null
            return (
              <div
                key={`boss-seg-${boss.id}-${i}`}
                className="absolute h-[6px] bottom-[26px] rounded-full"
                style={{
                  left: `${Math.max(0, startP)}%`,
                  width: `${Math.max(0.5, Math.min(100, endP) - Math.max(0, startP))}%`,
                  backgroundColor: themeTimelineColors.boss,
                  boxShadow: `0 0 8px ${themeTimelineColors.boss}`
                }}
              />
            )
          }))}

          {/* Current boss fight */}
          {bossFightMode && bossSegments.map((seg, i) => {
            const startP = getPosition(seg.start)
            const segEnd = seg.end ?? elapsed
            const endP = getPosition(segEnd)
            if (startP > 100 || endP < 0) return null
            return (
              <motion.div
                key={`active-boss-${i}`}
                className="absolute h-[6px] bottom-[26px] rounded-full"
                style={{
                  left: `${Math.max(0, startP)}%`,
                  width: `${Math.max(0.5, Math.min(100, endP) - Math.max(0, startP))}%`,
                  backgroundColor: themeTimelineColors.boss
                }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )
          })}

          {/* Interactive event points (deaths, milestones, stats, bosses) */}
          {allTimelinePoints.map(point => {
            const percent = getPosition(point.time)
            if (percent < 0 || percent > 100) return null
            const stackIndex = getStackIndex(point)
            const isRecent = (elapsed - point.time) < RECENT_THRESHOLD && (elapsed - point.time) >= 0
            const color = getPointColor(point.type)

            return (
              <motion.div
                key={point.id}
                className="absolute w-[12px] h-[12px] rounded-full cursor-pointer z-10"
                style={{
                  left: `calc(${percent}% - 6px)`,
                  bottom: `${22 + stackIndex * 14}px`,
                  backgroundColor: color,
                  border: `2px solid ${COLORS.nearBlack}`,
                  boxShadow: `0 0 6px ${color}`
                }}
                initial={{ scale: 0 }}
                animate={isRecent ? {
                  scale: [1, 1.2, 1],
                  boxShadow: [
                    `0 0 6px ${color}`,
                    `0 0 14px ${color}`,
                    `0 0 6px ${color}`
                  ]
                } : {
                  scale: 1
                }}
                transition={isRecent ? {
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut'
                } : {
                  type: 'spring',
                  stiffness: 400,
                  damping: 20
                }}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedTimelinePoint(
                    selectedTimelinePoint?.id === point.id ? null : point
                  )
                }}
              />
            )
          })}

          {/* Popup for selected point */}
          <AnimatePresence>
            {selectedTimelinePoint && (
              <motion.div
                className="absolute bottom-[50px] p-3 rounded z-50"
                style={{
                  left: `${Math.min(85, Math.max(15, getPosition(selectedTimelinePoint.time)))}%`,
                  transform: 'translateX(-50%)',
                  backgroundColor: COLORS.nearBlack,
                  border: `1px solid ${COLORS.fogGray}`,
                  fontFamily: "'Liberation Serif', serif",
                  minWidth: '160px'
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Boss popup */}
                {selectedTimelinePoint.type === 'boss' && (() => {
                  const boss = selectedTimelinePoint.data as BossFight
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{ color: COLORS.bossAmber }}>⚔</span>
                        <span className="font-bold" style={{ color: COLORS.boneWhite }}>{boss.name}</span>
                      </div>
                      <div className="text-sm" style={{ color: COLORS.coldGray }}>
                        <div>☠ {boss.deathsOnBoss} deaths</div>
                        <div>⏱ {formatTime(boss.duration)}</div>
                        <div className="text-xs mt-1" style={{ color: COLORS.fogGray }}>
                          {formatTime(boss.startTime)} → {formatTime(boss.endTime)}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Milestone popup */}
                {selectedTimelinePoint.type === 'milestone' && (() => {
                  const milestone = selectedTimelinePoint.data as Milestone
                  return (
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{milestone.icon}</span>
                        <span style={{ color: COLORS.boneWhite }}>{milestone.name}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: COLORS.fogGray }}>
                        @ {formatTime(milestone.timestamp)}
                      </div>
                    </div>
                  )
                })()}

                {/* Stats popup */}
                {selectedTimelinePoint.type === 'stats' && (() => {
                  const stats = selectedTimelinePoint.data as GameCharacterStats
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <img src={STAT_ICONS.level} alt="" className="w-4 h-4" />
                        <span style={{ color: isEldenRingStats(stats) ? '#C9A24D' : COLORS.boneWhite }}>Level {stats.level}</span>
                      </div>
                      {/* Bloodborne stats */}
                      {isBloodborneStats(stats) && (
                        <div className="text-xs grid grid-cols-3 gap-1" style={{ color: COLORS.coldGray }}>
                          <span>VIT {stats.vitality}</span>
                          <span>END {stats.endurance}</span>
                          <span>STR {stats.strength}</span>
                          <span>SKL {stats.skill}</span>
                          <span>BLT {stats.bloodtinge}</span>
                          <span>ARC {stats.arcane}</span>
                        </div>
                      )}
                      {/* Elden Ring stats */}
                      {isEldenRingStats(stats) && (
                        <div className="text-xs grid grid-cols-3 gap-1" style={{ color: '#D6D1C4' }}>
                          <span>VIG {stats.vigor}</span>
                          <span>MND {stats.mind}</span>
                          <span>END {stats.endurance}</span>
                          <span>STR {stats.strength}</span>
                          <span>DEX {stats.dexterity}</span>
                          <span>INT {stats.intelligence}</span>
                          <span>FTH {stats.faith}</span>
                          <span>ARC {stats.arcane}</span>
                        </div>
                      )}
                      <div className="text-xs mt-1" style={{ color: COLORS.fogGray }}>
                        @ {formatTime(stats.timestamp)}
                      </div>
                    </div>
                  )
                })()}

                {/* Death popup */}
                {selectedTimelinePoint.type === 'death' && (() => {
                  const death = selectedTimelinePoint.data as DeathPoint
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ color: COLORS.bloodRed }}>💀</span>
                        <span className="font-bold" style={{ color: COLORS.bloodRed }}>Death #{death.deathNumber}</span>
                      </div>
                      <div className="text-sm" style={{ color: COLORS.coldGray }}>
                        @ {formatTime(selectedTimelinePoint.time)}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <motion.button
                          className="text-xs px-2 py-1 rounded"
                          style={{ border: `1px solid ${COLORS.fogGray}`, color: COLORS.coldGray }}
                          whileHover={{ backgroundColor: `${COLORS.fogGray}20` }}
                          onClick={() => {
                            setEditingDeathIndex(death.index)
                            setEditDeathTime(formatTime(selectedTimelinePoint.time))
                            setSelectedTimelinePoint(null)
                          }}
                        >
                          ✎ Edit
                        </motion.button>
                        <motion.button
                          className="text-xs px-2 py-1 rounded"
                          style={{ border: `1px solid ${COLORS.bloodRedDark}`, color: COLORS.bloodRed }}
                          whileHover={{ backgroundColor: `${COLORS.bloodRed}20` }}
                          onClick={() => {
                            requireAuth(() => {
                              handleDeleteDeath(death.index)
                              setSelectedTimelinePoint(null)
                            })
                          }}
                        >
                          ✕ Delete
                        </motion.button>
                      </div>
                    </div>
                  )
                })()}

                {/* Close button */}
                <motion.button
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-xs rounded-full"
                  style={{ color: COLORS.fogGray }}
                  whileHover={{ color: COLORS.boneWhite, backgroundColor: `${COLORS.fogGray}30` }}
                  onClick={() => setSelectedTimelinePoint(null)}
                >
                  ✕
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection status */}
      <motion.div className="fixed top-2 right-2 flex items-center gap-2 text-xs px-3 py-1.5" style={{ color: connected ? COLORS.ashGray : COLORS.bloodRedDark, backgroundColor: `${COLORS.nearBlack}c0` }} animate={{ opacity: 0.7 }}>
        <motion.div className="w-2 h-2 rounded-full" style={{ backgroundColor: connected ? COLORS.ashGray : COLORS.bloodRedDark }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
        {connected ? 'SYNCED' : 'CONNECTING...'}
      </motion.div>

      {/* OBS Overlay Section */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity z-50">
        <span className="text-xs" style={{ color: COLORS.fogGray }}>OBS:</span>
        <div className="relative">
          <motion.button
            onClick={() => setShowOverlayPicker(!showOverlayPicker)}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              color: COLORS.boneWhite,
              border: `1px solid ${COLORS.fogGray}40`,
              backgroundColor: `${COLORS.fogGray}20`
            }}
            whileHover={{ borderColor: COLORS.bossAmber, color: COLORS.bossAmber }}
          >
            Open Window ▾
          </motion.button>
          <AnimatePresence>
            {showOverlayPicker && (
              <>
                {/* Click outside to close */}
                <div className="fixed inset-0 z-40" onClick={() => setShowOverlayPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 mb-1 rounded overflow-hidden z-50"
                  style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.fogGray}40` }}
                >
                  {[
                    { key: 'minimal', label: 'Minimal', desc: '⏱ 💀' },
                    { key: 'compact', label: 'Compact', desc: '⏱ 💀 + boss' },
                    { key: 'full', label: 'Full', desc: '⏱ 💀 + boss + last' },
                  ].map((opt) => (
                    <motion.button
                      key={opt.key}
                      onClick={() => handleOpenOverlay(opt.key as 'minimal' | 'compact' | 'full')}
                      className="block w-full text-left px-3 py-1.5 text-xs whitespace-nowrap"
                      style={{ color: COLORS.boneWhite }}
                      whileHover={{ backgroundColor: `${COLORS.bossAmber}30` }}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="ml-2" style={{ color: COLORS.fogGray }}>{opt.desc}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          onClick={handleCopyOverlayUrl}
          className="text-xs px-2 py-0.5 rounded"
          style={{
            color: COLORS.coldGray,
            border: `1px solid ${COLORS.fogGray}40`
          }}
          whileHover={{ borderColor: COLORS.bossAmber, color: COLORS.bossAmber }}
        >
          Copy URL
        </motion.button>
        <motion.button
          onClick={handleGenerateToken}
          className="text-xs px-2 py-0.5 rounded"
          style={{
            color: COLORS.coldGray,
            border: `1px solid ${COLORS.fogGray}40`
          }}
          whileHover={{ borderColor: COLORS.bloodRed, color: COLORS.bloodRed }}
        >
          {state?.overlayToken ? 'New Token' : 'Get Token'}
        </motion.button>
      </div>

      {/* Save/Load/Export buttons */}
      <div className="fixed bottom-14 right-4 flex gap-3 opacity-30 hover:opacity-70 transition-opacity z-50">
        <button onClick={handleSave} className="text-xs" style={{ color: COLORS.ashGray }}>save</button>
        <button onClick={handleLoad} className="text-xs" style={{ color: COLORS.ashGray }}>load</button>
        <span style={{ color: COLORS.fogGray }}>|</span>
        <button onClick={handleExport} className="text-xs" style={{ color: COLORS.bossAmber }}>export</button>
      </div>

      {/* Reset button */}
      <motion.button onClick={() => requireAuth(() => { if (confirm('Reset timer and deaths?')) send('bb-reset') })} className="fixed bottom-14 left-4 px-2 py-1 text-xs opacity-20 hover:opacity-60 z-50" style={{ color: COLORS.bloodRedDark }}>
        reset
      </motion.button>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAuthModal(false); setAuthPassword(''); setAuthError('') }}>
            <motion.div className="p-8 max-w-sm w-full mx-4" style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.bloodRed}` }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl mb-2 tracking-[0.15em] text-center uppercase" style={{ color: COLORS.bloodRed }}>Authentication Required</h3>
              <p className="text-sm mb-4 text-center" style={{ color: COLORS.fogGray }}>Enter password to edit this profile</p>
              {authError && <p className="text-sm mb-3 text-center" style={{ color: COLORS.bloodRed }}>{authError}</p>}
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password..."
                className="w-full text-lg px-4 py-3 mb-4 focus:outline-none"
                style={{ backgroundColor: 'transparent', color: COLORS.boneWhite, border: `1px solid ${COLORS.fogGray}` }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && authPassword) {
                    auth(authPassword)
                  }
                  if (e.key === 'Escape') {
                    setShowAuthModal(false)
                    setAuthPassword('')
                    setAuthError('')
                  }
                }}
              />
              <div className="flex gap-6 justify-center">
                <motion.button onClick={() => { setShowAuthModal(false); setAuthPassword(''); setAuthError('') }} style={{ color: COLORS.ashGray }} whileHover={{ color: COLORS.coldGray }}>Cancel</motion.button>
                <motion.button onClick={() => authPassword && auth(authPassword)} className="tracking-wider" style={{ color: COLORS.bloodRed }} whileHover={{ color: COLORS.boneWhite }}>Authenticate</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory Modal */}
      <AnimatePresence>
        {showVictoryModal && (
          <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowVictoryModal(false)}>
            <motion.div className="p-8 max-w-md w-full mx-4" style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.bossAmberDark}` }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-3xl mb-4 tracking-[0.2em] text-center uppercase" style={{ color: COLORS.bossAmber, textShadow: `0 0 20px ${COLORS.bossAmberDark}40` }}>Prey Slaughtered</h3>
              <input type="text" value={victoryBossName} onChange={(e) => setVictoryBossName(e.target.value)} placeholder="Boss name..." className="w-full text-xl px-4 py-3 mb-4 focus:outline-none" style={{ backgroundColor: 'transparent', color: COLORS.boneWhite, border: `1px solid ${COLORS.fogGray}`, borderBottom: `1px solid ${COLORS.bossAmberDark}` }} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleBossVictory(victoryBossName.trim()); if (e.key === 'Escape') { setShowVictoryModal(false); setVictoryBossName('') } }} />
              <div className="text-sm mb-4 text-center" style={{ color: COLORS.ashGray }}>Deaths: <span style={{ color: COLORS.bossAmber }}>{bossDeaths}</span> • Duration: <span style={{ color: COLORS.coldGray }}>{formatTime(currentBossDuration)}</span>{bossSegments.length > 1 && <span style={{ color: COLORS.bossAmberDark }}> ({bossSegments.length} segments)</span>}</div>
              <div className="flex gap-6 justify-center">
                <motion.button onClick={() => { setShowVictoryModal(false); setVictoryBossName('') }} style={{ color: COLORS.ashGray }} whileHover={{ color: COLORS.coldGray }}>Cancel</motion.button>
                <motion.button onClick={() => handleBossVictory(victoryBossName.trim())} className="tracking-wider" style={{ color: COLORS.bossAmber }} whileHover={{ color: COLORS.boneWhite }}>Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Boss Modal */}
      <AnimatePresence>
        {showPendingModal && pendingBossData && (
          <motion.div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="p-8 max-w-md w-full mx-4" style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.bloodRedDark}` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="text-2xl mb-4 tracking-[0.15em] text-center uppercase" style={{ color: COLORS.coldGray }}>Unfinished Hunt</h3>
              <p className="text-sm mb-4 text-center" style={{ color: COLORS.ashGray }}>Previous boss fight was not completed</p>
              <div className="text-sm mb-6 text-center" style={{ color: COLORS.fogGray }}>Deaths: <span style={{ color: COLORS.bossAmber }}>{pendingBossData.bossDeaths}</span> • Time: <span style={{ color: COLORS.coldGray }}>{formatTime(elapsed - pendingBossData.bossStartTime)}</span></div>
              <input type="text" value={pendingBossName} onChange={(e) => setPendingBossName(e.target.value)} placeholder="Boss name (for completion)..." className="w-full px-4 py-2 mb-4 focus:outline-none" style={{ backgroundColor: 'transparent', color: COLORS.boneWhite, border: `1px solid ${COLORS.fogGray}` }} onKeyDown={(e) => { if (e.key === 'Enter') handlePendingFinish(pendingBossName.trim()) }} />
              <div className="flex flex-col gap-3">
                <motion.button onClick={handlePendingContinue} className="w-full py-2 text-lg tracking-wider uppercase" style={{ color: COLORS.bossAmber, border: `1px solid ${COLORS.bossAmberDark}` }} whileHover={{ backgroundColor: `${COLORS.bossAmberDark}20` }}>Continue Fight</motion.button>
                <motion.button onClick={() => handlePendingFinish(pendingBossName.trim())} className="w-full py-2 text-lg tracking-wider uppercase" style={{ color: COLORS.coldGray, border: `1px solid ${COLORS.ashGray}` }} whileHover={{ backgroundColor: `${COLORS.fogGray}30` }}>Finish as Victory</motion.button>
                <motion.button onClick={handlePendingCancel} className="w-full py-2 text-sm" style={{ color: COLORS.bloodRedDark }} whileHover={{ color: COLORS.bloodRed }}>Cancel (reset progress)</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone Modal */}
      <AnimatePresence>
        {showMilestoneModal && (
          <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMilestoneModal(false)}>
            <motion.div className="p-8 max-w-md w-full mx-4" style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.fogGray}` }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl mb-2 tracking-[0.15em] text-center uppercase" style={{ color: COLORS.coldGray }}>Add Milestone</h3>
              <p className="text-sm mb-4 text-center" style={{ color: COLORS.fogGray }}>Time: {formatTime(elapsed)}</p>
              <input type="text" value={milestoneInput} onChange={(e) => setMilestoneInput(e.target.value)} placeholder="Milestone name..." className="w-full text-xl px-4 py-3 mb-4 focus:outline-none" style={{ backgroundColor: 'transparent', color: COLORS.boneWhite, border: `1px solid ${COLORS.fogGray}`, borderBottom: `1px solid ${COLORS.coldGray}` }} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddMilestone(); if (e.key === 'Escape') { setShowMilestoneModal(false); setMilestoneInput('') } }} />
              <div className="flex flex-wrap gap-2 justify-center mb-6">
                {MILESTONE_ICONS.map(icon => (
                  <motion.button key={icon} onClick={() => setSelectedMilestoneIcon(icon)} className="w-10 h-10 flex items-center justify-center text-xl" style={{ backgroundColor: selectedMilestoneIcon === icon ? `${COLORS.coldGray}30` : 'transparent', border: `1px solid ${selectedMilestoneIcon === icon ? COLORS.coldGray : COLORS.fogGray}`, color: selectedMilestoneIcon === icon ? COLORS.boneWhite : COLORS.coldGray }} whileHover={{ backgroundColor: `${COLORS.coldGray}20` }} whileTap={{ scale: 0.95 }}>{icon}</motion.button>
                ))}
              </div>
              <div className="flex gap-6 justify-center">
                <motion.button onClick={() => { setShowMilestoneModal(false); setMilestoneInput('') }} style={{ color: COLORS.ashGray }} whileHover={{ color: COLORS.coldGray }}>Cancel</motion.button>
                <motion.button onClick={handleAddMilestone} className="tracking-wider" style={{ color: COLORS.coldGray }} whileHover={{ color: COLORS.boneWhite }}>Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal - Bloodborne */}
      <AnimatePresence>
        {showStatsModal && (state?.presetSlug === 'bloodborne' || !state?.presetSlug) && (
          <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStatsModal(false)}>
            <motion.div className="p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.ashGray}` }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl mb-2 tracking-[0.15em] text-center uppercase" style={{ color: COLORS.coldGray }}>Character Stats</h3>
              <p className="text-sm mb-4 text-center" style={{ color: COLORS.fogGray }}>Time: {formatTime(elapsed)}</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[{ key: 'level', label: 'Level' }, { key: 'vitality', label: 'VIT' }, { key: 'endurance', label: 'END' }, { key: 'strength', label: 'STR' }, { key: 'skill', label: 'SKL' }, { key: 'bloodtinge', label: 'BLT' }, { key: 'arcane', label: 'ARC' }, { key: 'bloodEchoes', label: 'Echoes' }, { key: 'insight', label: 'Insight' }].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: COLORS.fogGray }}>{label}</label>
                    <input type="number" value={statsForm[key as keyof typeof statsForm]} onChange={(e) => setStatsForm(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 text-center focus:outline-none" style={{ backgroundColor: 'transparent', color: key === 'level' ? COLORS.boneWhite : COLORS.coldGray, border: `1px solid ${COLORS.fogGray}` }} />
                  </div>
                ))}
              </div>
              <textarea value={statsForm.notes} onChange={(e) => setStatsForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)..." className="w-full px-3 py-2 mb-4 focus:outline-none resize-none" style={{ backgroundColor: 'transparent', color: COLORS.coldGray, border: `1px solid ${COLORS.fogGray}` }} rows={2} />
              <div className="flex gap-6 justify-center">
                <motion.button onClick={() => setShowStatsModal(false)} style={{ color: COLORS.ashGray }} whileHover={{ color: COLORS.coldGray }}>Cancel</motion.button>
                <motion.button onClick={handleAddStats} className="tracking-wider" style={{ color: COLORS.coldGray }} whileHover={{ color: COLORS.boneWhite }}>Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Modal - Elden Ring */}
      <AnimatePresence>
        {showStatsModal && state?.presetSlug === 'elden-ring' && (
          <motion.div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowStatsModal(false)}>
            <motion.div className="p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#0B0B0B', border: '1px solid #5E6A6F' }} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl mb-2 tracking-[0.15em] text-center uppercase" style={{ color: '#C9A24D' }}>Character Stats</h3>
              <p className="text-sm mb-4 text-center" style={{ color: '#5E6A6F' }}>Time: {formatTime(elapsed)}</p>
              <div className="grid grid-cols-5 gap-3 mb-4">
                {[{ key: 'level', label: 'Level' }, { key: 'vigor', label: 'VIG' }, { key: 'mind', label: 'MND' }, { key: 'endurance', label: 'END' }, { key: 'strength', label: 'STR' }, { key: 'dexterity', label: 'DEX' }, { key: 'intelligence', label: 'INT' }, { key: 'faith', label: 'FTH' }, { key: 'arcane', label: 'ARC' }, { key: 'runes', label: 'Runes' }].map(({ key, label }) => (
                  <div key={key} className={key === 'runes' ? 'col-span-5' : ''}>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#5E6A6F' }}>{label}</label>
                    <input type="number" value={eldenRingStatsForm[key as keyof typeof eldenRingStatsForm]} onChange={(e) => setEldenRingStatsForm(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} className="w-full px-2 py-1.5 text-center focus:outline-none" style={{ backgroundColor: 'transparent', color: key === 'level' ? '#C9A24D' : '#D6D1C4', border: '1px solid #5E6A6F' }} />
                  </div>
                ))}
              </div>
              <textarea value={eldenRingStatsForm.notes} onChange={(e) => setEldenRingStatsForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Notes (optional)..." className="w-full px-3 py-2 mb-4 focus:outline-none resize-none" style={{ backgroundColor: 'transparent', color: '#D6D1C4', border: '1px solid #5E6A6F' }} rows={2} />
              <div className="flex gap-6 justify-center">
                <motion.button onClick={() => setShowStatsModal(false)} style={{ color: '#5E6A6F' }} whileHover={{ color: '#D6D1C4' }}>Cancel</motion.button>
                <motion.button onClick={handleAddEldenRingStats} className="tracking-wider" style={{ color: '#C9A24D' }} whileHover={{ color: '#D6D1C4' }}>Save</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  )
}

export default App
