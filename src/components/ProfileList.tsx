// bb-tracker-desktop/src/components/ProfileList.tsx
// Profile selection page - matches web version BloodborneProfileList.tsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS, formatTime } from '../lib/constants'
import { PresetSlug } from '../lib/types'
import { getSelectablePresets } from '../lib/presetUtils'
import { usePresets } from '../hooks/usePresets'
import { AdminCodeInput, AdminPanel } from './admin'

interface Profile {
  name: string
  displayName: string
  createdAt: string
  updatedAt?: string
  deaths: number
  elapsed: number
  isPrivate?: boolean
}

interface ProfileListProps {
  onSelectProfile: (profileName: string, password?: string, initialPreset?: PresetSlug) => void
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Always use production API for profiles (API is only on the server)
const API_BASE = 'https://watch.home.kg'

export function ProfileList({ onSelectProfile }: ProfileListProps) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Create modal state
  const [newName, setNewName] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetSlug>('bloodborne')
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)
  const [checkingName, setCheckingName] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Admin state
  const [showAdminCode, setShowAdminCode] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const titleClickCountRef = useRef(0)
  const titleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Presets hook
  const { presets, refresh: refreshPresets } = usePresets()

  const selectablePresets = getSelectablePresets()

  // Load profiles
  const loadProfiles = useCallback(async () => {
    try {
      // 1. Load public profiles
      const res = await fetch(`${API_BASE}/api/bb-profiles`)
      const data = await res.json()
      const publicProfiles: Profile[] = data.profiles || []

      // 2. Get visited profiles from localStorage
      let visitedNames: string[] = []
      try {
        visitedNames = JSON.parse(localStorage.getItem('bb-visited-profiles') || '[]')
      } catch {
        visitedNames = []
      }

      // 3. Find private visited (not in public list)
      const publicNames = new Set(publicProfiles.map(p => p.name))
      const privateVisitedNames = visitedNames.filter(name => !publicNames.has(name))

      // 4. Load data for private visited profiles
      const privateProfiles = await Promise.all(
        privateVisitedNames.map(async (name) => {
          try {
            const res = await fetch(`${API_BASE}/api/bb-profiles/${name}`)
            if (res.ok) {
              const profile = await res.json()
              return { ...profile, isPrivate: true } as Profile
            }
          } catch {
            // Profile may have been deleted
          }
          return null
        })
      )

      // 5. Merge public + valid private
      const validPrivate = privateProfiles.filter((p): p is Profile => p !== null)
      setProfiles([...publicProfiles, ...validPrivate])
      setError('')
    } catch (e) {
      console.error('Failed to load profiles:', e)
      setError('Failed to load profiles')
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    loadProfiles()
      .then(() => setLoading(false))
      .catch(() => {
        setError('Failed to load profiles')
        setLoading(false)
      })
  }, [loadProfiles])

  // Check name availability with debounce
  useEffect(() => {
    if (!newName.trim()) {
      setNameAvailable(null)
      return
    }

    // Validate name format (lowercase, no spaces, URL-safe)
    const validName = /^[a-z0-9_-]+$/.test(newName)
    if (!validName) {
      setNameAvailable(false)
      return
    }

    setCheckingName(true)
    const timeout = setTimeout(() => {
      fetch(`${API_BASE}/api/bb-profiles/check?name=${encodeURIComponent(newName)}`)
        .then(res => res.json())
        .then(data => {
          setNameAvailable(data.available)
          setCheckingName(false)
        })
        .catch(() => {
          setCheckingName(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
  }, [newName])

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newPassword.trim() || !nameAvailable) return

    setCreating(true)
    setCreateError('')

    try {
      const res = await fetch(`${API_BASE}/api/bb-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.toLowerCase().trim(),
          displayName: newDisplayName.trim() || newName.trim(),
          password: newPassword,
          isPublic: !isPrivate
        })
      })

      const data = await res.json()

      if (res.ok) {
        // Save password to localStorage for auto-auth
        const profileName = newName.toLowerCase().trim()
        localStorage.setItem(`bb-auth-${profileName}`, newPassword)

        // Refresh profiles
        await loadProfiles()

        // Reset modal and navigate to profile with initial preset
        setShowCreateModal(false)
        onSelectProfile(profileName, newPassword, selectedPreset)
      } else {
        setCreateError(data.error || 'Failed to create profile')
      }
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }, [newName, newDisplayName, newPassword, nameAvailable, isPrivate, selectedPreset, loadProfiles, onSelectProfile])

  return (
    <div
      className="min-h-screen flex flex-col items-center p-4 sm:p-8 relative overflow-hidden"
      style={{ fontFamily: "'Liberation Serif', 'Times New Roman', serif", backgroundColor: COLORS.nearBlack }}
    >
      {/* Heavy vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(11,11,12,0.5) 50%, rgba(11,11,12,0.95) 100%)'
        }}
      />

      {/* Film grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] z-[2]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay'
        }}
      />

      {/* Header */}
      <motion.div
        className="relative z-10 flex flex-col items-center mb-8 sm:mb-12"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.h1
          className="text-4xl sm:text-5xl tracking-[0.15em] uppercase cursor-default select-none"
          style={{
            color: COLORS.boneWhite,
            textShadow: `0 0 40px ${COLORS.bloodRedGlow}40, 0 4px 8px ${COLORS.nearBlack}`
          }}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          onClick={() => {
            // Hidden admin trigger: 5 clicks on title
            titleClickCountRef.current++
            if (titleClickTimerRef.current) {
              clearTimeout(titleClickTimerRef.current)
            }
            if (titleClickCountRef.current >= 5) {
              titleClickCountRef.current = 0
              setShowAdminCode(true)
            } else {
              titleClickTimerRef.current = setTimeout(() => {
                titleClickCountRef.current = 0
              }, 2000) // Reset counter after 2 seconds
            }
          }}
        >
          Bloodborne
        </motion.h1>
        <motion.p
          className="text-sm sm:text-base tracking-[0.3em] uppercase mt-2"
          style={{ color: COLORS.coldGray }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Death Tracker
        </motion.p>
        <p
          className="text-xs sm:text-sm tracking-[0.2em] uppercase mt-4"
          style={{ color: COLORS.ashGray }}
        >
          Select Hunter
        </p>
      </motion.div>

      {/* Content */}
      <div className="relative z-20 w-full max-w-4xl mx-auto">
        {loading ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="text-2xl tracking-widest uppercase"
              style={{ color: COLORS.fogGray }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Loading...
            </motion.div>
          </motion.div>
        ) : error ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p style={{ color: COLORS.bloodRed }}>{error}</p>
            <motion.button
              onClick={() => { setLoading(true); loadProfiles().finally(() => setLoading(false)) }}
              className="mt-4 px-4 py-2 text-sm tracking-wider"
              style={{ color: COLORS.coldGray, border: `1px solid ${COLORS.fogGray}` }}
              whileHover={{ borderColor: COLORS.bloodRed }}
            >
              Retry
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* Profiles Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {profiles.map((profile, index) => (
                <motion.div
                  key={profile.name}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <motion.button
                    onClick={() => onSelectProfile(profile.name)}
                    className="w-full text-left cursor-pointer group relative overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, rgba(50, 40, 40, 0.5) 0%, rgba(20, 15, 15, 0.7) 100%)',
                      border: `1px solid ${COLORS.bloodRedDark}40`
                    }}
                    whileHover={{
                      borderColor: `${COLORS.bloodRed}80`,
                      boxShadow: `0 0 20px ${COLORS.bloodRed}20`
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Left accent bar */}
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ background: `linear-gradient(180deg, ${COLORS.bloodRed}, ${COLORS.bloodRedDark})` }}
                    />

                    {/* Hover glow effect */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `radial-gradient(ellipse at center, ${COLORS.bloodRed}10 0%, transparent 70%)` }}
                    />

                    <div className="relative p-4 pl-5">
                      {/* Profile Name */}
                      <h2
                        className="text-xl sm:text-2xl tracking-[0.08em] uppercase mb-3 flex items-center gap-2"
                        style={{
                          color: COLORS.boneWhite,
                          textShadow: `0 0 20px ${COLORS.bloodRedGlow}40`
                        }}
                      >
                        {profile.displayName}
                        {profile.isPrivate && (
                          <span
                            className="text-xs opacity-60"
                            style={{ color: COLORS.bossAmber }}
                            title="Private profile"
                          >
                            🔒
                          </span>
                        )}
                      </h2>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span
                            className="text-xs tracking-[0.15em] uppercase"
                            style={{ color: COLORS.ashGray }}
                          >
                            Deaths
                          </span>
                          <span
                            className="text-xl font-bold"
                            style={{ color: COLORS.bloodRed }}
                          >
                            {profile.deaths}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span
                            className="text-xs tracking-[0.15em] uppercase"
                            style={{ color: COLORS.ashGray }}
                          >
                            Hunt Time
                          </span>
                          <span
                            className="text-base tracking-wider"
                            style={{ color: COLORS.coldGray }}
                          >
                            {formatTime(profile.elapsed)}
                          </span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        className="flex justify-between items-center pt-3 mt-3"
                        style={{ borderTop: `1px solid ${COLORS.fogGray}20` }}
                      >
                        <span
                          className="text-xs tracking-wider"
                          style={{ color: COLORS.fogGray }}
                        >
                          {formatRelativeTime(profile.updatedAt || profile.createdAt)}
                        </span>
                        <span
                          className="text-xs tracking-widest uppercase opacity-0 group-hover:opacity-70 transition-opacity"
                          style={{ color: COLORS.bloodRed }}
                        >
                          Enter →
                        </span>
                      </div>
                    </div>
                  </motion.button>
                </motion.div>
              ))}

              {/* Create New Profile Card */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: profiles.length * 0.1, duration: 0.4 }}
              >
                <motion.button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full h-full min-h-[160px] text-left cursor-pointer group relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(40, 50, 48, 0.4) 0%, rgba(15, 25, 22, 0.6) 100%)',
                    border: `1px dashed ${COLORS.bossAmber}40`
                  }}
                  whileHover={{
                    borderColor: `${COLORS.bossAmber}80`,
                    boxShadow: `0 0 20px ${COLORS.bossAmber}20`
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Left accent bar */}
                  <motion.div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: `linear-gradient(180deg, ${COLORS.bossAmber}60, ${COLORS.bossAmberDark}40)` }}
                  />

                  {/* Hover glow effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `radial-gradient(ellipse at center, ${COLORS.bossAmber}10 0%, transparent 70%)` }}
                  />

                  <div className="relative flex flex-col items-center justify-center h-full p-4 pl-5">
                    <motion.span
                      className="text-4xl mb-3"
                      style={{ color: COLORS.bossAmber }}
                      whileHover={{ scale: 1.2 }}
                      transition={{ duration: 0.3 }}
                    >
                      +
                    </motion.span>
                    <span
                      className="text-sm tracking-[0.15em] uppercase"
                      style={{ color: COLORS.bossAmber }}
                    >
                      New Hunter
                    </span>
                    <span
                      className="text-xs mt-1 tracking-wider"
                      style={{ color: COLORS.fogGray }}
                    >
                      Create Profile
                    </span>
                  </div>
                </motion.button>
              </motion.div>
            </div>

            {/* Empty state */}
            {profiles.length === 0 && (
              <motion.div
                className="text-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <p
                  className="text-lg tracking-wider mb-4"
                  style={{ color: COLORS.ashGray }}
                >
                  No hunters yet
                </p>
                <p
                  className="text-sm"
                  style={{ color: COLORS.fogGray }}
                >
                  Create your first profile to track your playthrough
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Create Profile Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            {/* Modal */}
            <motion.div
              className="p-8 max-w-md w-full mx-4"
              style={{ backgroundColor: COLORS.nearBlack, border: `1px solid ${COLORS.bloodRed}` }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <h2
                className="text-xl tracking-[0.15em] uppercase mb-6 text-center"
                style={{ color: COLORS.bloodRed, fontFamily: "'Times New Roman', serif" }}
              >
                New Hunter
              </h2>

              <div className="space-y-4">
                  {/* URL Name */}
                  <div>
                    <label
                      className="block text-xs tracking-[0.15em] uppercase mb-2"
                      style={{ color: COLORS.ashGray, fontFamily: "'Times New Roman', serif" }}
                    >
                      Profile Name (for URL)
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="hunter"
                      className="w-full px-3 py-2 focus:outline-none text-base tracking-wider"
                      style={{
                        backgroundColor: COLORS.nearBlack,
                        color: COLORS.boneWhite,
                        fontFamily: "'Times New Roman', serif",
                        border: `1px solid ${
                          nameAvailable === false ? COLORS.bloodRed :
                          nameAvailable === true ? COLORS.bossAmber :
                          COLORS.fogGray
                        }40`
                      }}
                    />
                    <div className="mt-1 text-xs" style={{ color: COLORS.fogGray, fontFamily: "'Times New Roman', serif" }}>
                      watch.home.kg/bloodborne/{newName || 'hunter'}
                      {checkingName && <span className="ml-2">checking...</span>}
                      {!checkingName && nameAvailable === true && (
                        <span className="ml-2" style={{ color: COLORS.bossAmber }}>✓ available</span>
                      )}
                      {!checkingName && nameAvailable === false && (
                        <span className="ml-2" style={{ color: COLORS.bloodRed }}>✗ taken</span>
                      )}
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label
                      className="block text-xs tracking-[0.15em] uppercase mb-2"
                      style={{ color: COLORS.ashGray, fontFamily: "'Times New Roman', serif" }}
                    >
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={e => setNewDisplayName(e.target.value)}
                      placeholder={newName || 'Hunter'}
                      className="w-full px-3 py-2 focus:outline-none text-base tracking-wider"
                      style={{
                        backgroundColor: COLORS.nearBlack,
                        color: COLORS.boneWhite,
                        fontFamily: "'Times New Roman', serif",
                        border: `1px solid ${COLORS.fogGray}40`
                      }}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      className="block text-xs tracking-[0.15em] uppercase mb-2"
                      style={{ color: COLORS.ashGray, fontFamily: "'Times New Roman', serif" }}
                    >
                      Password (for editing)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 focus:outline-none text-base tracking-wider"
                      style={{
                        backgroundColor: COLORS.nearBlack,
                        color: COLORS.boneWhite,
                        fontFamily: "'Times New Roman', serif",
                        border: `1px solid ${COLORS.fogGray}40`
                      }}
                    />
                    <p
                      className="mt-2 text-xs flex items-center gap-1"
                      style={{ color: COLORS.bloodRedDark, fontFamily: "'Times New Roman', serif" }}
                    >
                      <span>!</span> Remember your password - cannot be recovered
                    </p>
                  </div>

                  {/* Theme Selection */}
                  <div>
                    <label
                      className="block text-xs tracking-[0.15em] uppercase mb-2"
                      style={{ color: COLORS.ashGray, fontFamily: "'Times New Roman', serif" }}
                    >
                      Theme
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectablePresets.map((preset) => (
                        <motion.button
                          key={preset.id}
                          type="button"
                          onClick={() => setSelectedPreset(preset.slug)}
                          className="p-3 text-left"
                          style={{
                            background: selectedPreset === preset.slug
                              ? `linear-gradient(135deg, ${preset.config.colors.cardBg}, ${preset.config.colors.background})`
                              : `linear-gradient(135deg, rgba(30, 35, 33, 0.4), rgba(15, 18, 17, 0.6))`,
                            border: `1px solid ${selectedPreset === preset.slug
                              ? preset.config.colors.accent
                              : COLORS.fogGray}40`
                          }}
                          whileHover={{ borderColor: preset.config.colors.accent }}
                        >
                          <div
                            className="text-sm tracking-wider mb-1"
                            style={{ color: preset.config.colors.primary, fontFamily: "'Times New Roman', serif" }}
                          >
                            {preset.displayName}
                          </div>
                          <div className="flex gap-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.config.colors.primary }}
                            />
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.config.colors.accent }}
                            />
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: preset.config.colors.secondary }}
                            />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Private Profile checkbox */}
                  <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="w-4 h-4"
                        style={{ accentColor: COLORS.bossAmber }}
                      />
                      <span
                        className="text-sm tracking-wider"
                        style={{ color: COLORS.coldGray, fontFamily: "'Times New Roman', serif" }}
                      >
                        Hide from public list
                      </span>
                    </label>
                    <p
                      className="mt-1 text-xs pl-7"
                      style={{ color: COLORS.fogGray, fontFamily: "'Times New Roman', serif" }}
                    >
                      Profile will only be accessible via direct link
                    </p>
                  </div>

                  {/* Error */}
                  {createError && (
                    <p
                      className="text-sm text-center py-2"
                      style={{ color: COLORS.bloodRed, fontFamily: "'Times New Roman', serif" }}
                    >
                      {createError}
                    </p>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-6 justify-center pt-4">
                    <motion.button
                      onClick={() => {
                        setShowCreateModal(false)
                        setNewName('')
                        setNewDisplayName('')
                        setNewPassword('')
                        setIsPrivate(false)
                        setSelectedPreset('bloodborne')
                        setCreateError('')
                      }}
                      className="tracking-wider"
                      style={{ color: COLORS.ashGray, fontFamily: "'Times New Roman', serif" }}
                      whileHover={{ color: COLORS.coldGray }}
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleCreate}
                      disabled={!newName.trim() || !newPassword.trim() || !nameAvailable || creating}
                      className="tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ color: COLORS.bloodRed, fontFamily: "'Times New Roman', serif" }}
                      whileHover={{ color: COLORS.boneWhite }}
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </motion.button>
                  </div>
                </div>
            </motion.div>
          </motion.div>
        )}

        {/* Admin Code Input Modal */}
        {showAdminCode && (
          <AdminCodeInput
            onSuccess={(token) => {
              setAdminToken(token)
              setShowAdminCode(false)
              setShowAdminPanel(true)
            }}
            onClose={() => setShowAdminCode(false)}
          />
        )}

        {/* Admin Panel Modal */}
        {showAdminPanel && adminToken && (
          <AdminPanel
            presets={presets}
            adminToken={adminToken}
            onClose={() => {
              setShowAdminPanel(false)
              setAdminToken(null)
            }}
            onPresetUpdated={() => {
              refreshPresets()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
