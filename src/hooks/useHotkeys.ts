import { useEffect, useCallback, useState, useRef } from 'react'
import { register, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut'
import type { HotkeyConfig } from '../lib/types'
import { DEFAULT_HOTKEYS } from '../lib/constants'

export type HotkeyAction = 'death' | 'timer' | 'boss' | 'milestone'

interface UseHotkeysOptions {
  onDeath: () => void
  onToggleTimer: () => void
  onBossToggle: () => void
  onMilestone?: () => void
  enabled?: boolean
  config?: HotkeyConfig
}

interface UseHotkeysReturn {
  isEnabled: boolean
  setEnabled: (enabled: boolean) => void
  registeredKeys: Record<HotkeyAction, boolean>
  config: HotkeyConfig
  updateConfig: (newConfig: Partial<HotkeyConfig>) => void
}

export function useHotkeys({
  onDeath,
  onToggleTimer,
  onBossToggle,
  onMilestone,
  enabled = true,
  config = DEFAULT_HOTKEYS
}: UseHotkeysOptions): UseHotkeysReturn {
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [currentConfig, setCurrentConfig] = useState<HotkeyConfig>(config)
  const [registeredKeys, setRegisteredKeys] = useState<Record<HotkeyAction, boolean>>({
    death: false,
    timer: false,
    boss: false,
    milestone: false
  })

  // Use refs to avoid stale closures in hotkey callbacks
  const onDeathRef = useRef(onDeath)
  const onToggleTimerRef = useRef(onToggleTimer)
  const onBossToggleRef = useRef(onBossToggle)
  const onMilestoneRef = useRef(onMilestone)

  useEffect(() => {
    onDeathRef.current = onDeath
    onToggleTimerRef.current = onToggleTimer
    onBossToggleRef.current = onBossToggle
    onMilestoneRef.current = onMilestone
  }, [onDeath, onToggleTimer, onBossToggle, onMilestone])

  const registerHotkeys = useCallback(async () => {
    if (!isEnabled || !currentConfig.enabled) return

    try {
      // Unregister all first to avoid conflicts
      await unregisterAll()

      const newRegistered: Record<HotkeyAction, boolean> = {
        death: false,
        timer: false,
        boss: false,
        milestone: false
      }

      // Register death hotkey (Ctrl+Shift+D)
      try {
        const deathRegistered = await isRegistered(currentConfig.death)
        if (!deathRegistered) {
          await register(currentConfig.death, (event) => {
            if (event.state === 'Pressed') {
              onDeathRef.current()
            }
          })
          newRegistered.death = true
        }
      } catch (e) {
        console.error('Failed to register death hotkey:', e)
      }

      // Register timer toggle hotkey (Ctrl+Shift+Space)
      try {
        const timerRegistered = await isRegistered(currentConfig.timer)
        if (!timerRegistered) {
          await register(currentConfig.timer, (event) => {
            if (event.state === 'Pressed') {
              onToggleTimerRef.current()
            }
          })
          newRegistered.timer = true
        }
      } catch (e) {
        console.error('Failed to register timer hotkey:', e)
      }

      // Register boss toggle hotkey (Ctrl+Shift+B)
      try {
        const bossRegistered = await isRegistered(currentConfig.boss)
        if (!bossRegistered) {
          await register(currentConfig.boss, (event) => {
            if (event.state === 'Pressed') {
              onBossToggleRef.current()
            }
          })
          newRegistered.boss = true
        }
      } catch (e) {
        console.error('Failed to register boss hotkey:', e)
      }

      // Register milestone hotkey (Ctrl+Shift+M)
      if (onMilestoneRef.current) {
        try {
          const milestoneRegistered = await isRegistered(currentConfig.milestone)
          if (!milestoneRegistered) {
            await register(currentConfig.milestone, (event) => {
              if (event.state === 'Pressed') {
                onMilestoneRef.current?.()
              }
            })
            newRegistered.milestone = true
          }
        } catch (e) {
          console.error('Failed to register milestone hotkey:', e)
        }
      }

      setRegisteredKeys(newRegistered)
      console.log('Global hotkeys registered:', currentConfig)
    } catch (error) {
      console.error('Failed to register hotkeys:', error)
    }
  }, [isEnabled, currentConfig])

  const unregisterHotkeys = useCallback(async () => {
    try {
      await unregisterAll()
      setRegisteredKeys({
        death: false,
        timer: false,
        boss: false,
        milestone: false
      })
      console.log('Global hotkeys unregistered')
    } catch (error) {
      console.error('Failed to unregister hotkeys:', error)
    }
  }, [])

  const updateConfig = useCallback((newConfig: Partial<HotkeyConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  // Register/unregister on mount/unmount and when enabled changes
  useEffect(() => {
    if (isEnabled && currentConfig.enabled) {
      registerHotkeys()
    } else {
      unregisterHotkeys()
    }

    return () => {
      unregisterHotkeys()
    }
  }, [isEnabled, currentConfig.enabled, registerHotkeys, unregisterHotkeys])

  // Re-register when config changes
  useEffect(() => {
    if (isEnabled && currentConfig.enabled) {
      registerHotkeys()
    }
  }, [currentConfig, isEnabled, registerHotkeys])

  return {
    isEnabled,
    setEnabled: setIsEnabled,
    registeredKeys,
    config: currentConfig,
    updateConfig
  }
}
