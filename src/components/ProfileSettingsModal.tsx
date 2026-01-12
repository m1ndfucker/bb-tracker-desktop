// bb-tracker-desktop/src/components/ProfileSettingsModal.tsx
// Simplified preset picker - users select theme, no manual customization

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '../lib/constants'
import {
  ProfileSettings,
  PresetSlug,
  VisualPreset,
  VISUAL_PRESETS
} from '../lib/types'
import { getSelectablePresets } from '../lib/presetUtils'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: ProfileSettings | null
  onSave: (settings: ProfileSettings) => void
  // Legacy props - kept for backward compatibility but not used
  onUploadLogo?: (file: File) => Promise<string | null>
  onUploadBackground?: (file: File) => Promise<string | null>
}

// Preset card component with visual preview
function PresetCard({
  preset,
  isSelected,
  onSelect
}: {
  preset: VisualPreset
  isSelected: boolean
  onSelect: () => void
}) {
  const { config } = preset

  return (
    <motion.button
      onClick={onSelect}
      className="relative p-4 text-left transition-all"
      style={{
        backgroundColor: isSelected ? `${config.colors.cardBg}` : `${COLORS.nearBlack}`,
        border: `2px solid ${isSelected ? config.colors.accent : COLORS.fogGray}40`,
        borderRadius: '4px'
      }}
      whileHover={{
        borderColor: config.colors.accent,
        scale: 1.02
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: config.colors.accent }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <span className="text-xs" style={{ color: config.colors.background }}>✓</span>
        </motion.div>
      )}

      {/* Preset name */}
      <h3
        className="text-lg tracking-wider mb-3"
        style={{ color: config.colors.primary }}
      >
        {preset.displayName}
      </h3>

      {/* Color preview */}
      <div
        className="p-3 mb-3"
        style={{
          backgroundColor: config.colors.background,
          borderRadius: '2px'
        }}
      >
        {/* Timer preview */}
        <div
          className="text-xl font-serif text-center mb-1"
          style={{ color: config.colors.primary, fontFamily: config.font }}
        >
          1:23:45
        </div>

        {/* Deaths preview */}
        <div
          className="text-base font-serif text-center"
          style={{ color: config.colors.accent }}
        >
          Deaths: 42
        </div>

        {/* Boss info preview */}
        <div
          className="text-xs text-center mt-1"
          style={{ color: config.colors.secondary }}
        >
          Boss Fight Active
        </div>
      </div>

      {/* Timeline colors preview */}
      <div className="flex items-center justify-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: config.timeline.death }}
          title="Deaths"
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: config.timeline.boss }}
          title="Bosses"
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: config.timeline.milestone }}
          title="Milestones"
        />
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: config.timeline.stats }}
          title="Stats"
        />
      </div>

      {/* Description */}
      {preset.description && (
        <p
          className="text-xs mt-3 opacity-70"
          style={{ color: config.colors.primary }}
        >
          {preset.description}
        </p>
      )}
    </motion.button>
  )
}

export function ProfileSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave
}: ProfileSettingsModalProps) {
  // Get current preset slug from settings
  const getCurrentPresetSlug = (): PresetSlug => {
    if (settings?.preset && settings.preset !== 'custom') {
      return settings.preset
    }
    return 'bloodborne'
  }

  const [selectedPreset, setSelectedPreset] = useState<PresetSlug>(getCurrentPresetSlug)
  const selectablePresets = getSelectablePresets()

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPreset(getCurrentPresetSlug())
    }
  }, [isOpen, settings])

  // Handle save - converts preset to full ProfileSettings for backward compatibility
  const handleSave = () => {
    const preset = VISUAL_PRESETS[selectedPreset]
    if (!preset) return

    // Create ProfileSettings from preset config
    const newSettings: ProfileSettings = {
      ...preset.config,
      preset: selectedPreset
    }

    onSave(newSettings)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
            style={{
              background: `${COLORS.nearBlack}f8`,
              border: `1px solid ${COLORS.fogGray}30`
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4"
              style={{ borderBottom: `1px solid ${COLORS.fogGray}30` }}
            >
              <h2
                className="text-lg tracking-[0.15em] uppercase"
                style={{ color: COLORS.boneWhite }}
              >
                Select Theme
              </h2>
              <motion.button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center"
                style={{ color: COLORS.fogGray }}
                whileHover={{ color: COLORS.boneWhite, scale: 1.1 }}
              >
                ✕
              </motion.button>
            </div>

            {/* Preset grid */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectablePresets.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedPreset === preset.slug}
                    onSelect={() => setSelectedPreset(preset.slug)}
                  />
                ))}
              </div>

              {/* Info text */}
              <p
                className="text-xs text-center mt-4 opacity-60"
                style={{ color: COLORS.coldGray }}
              >
                Theme applies to overlay and desktop app
              </p>
            </div>

            {/* Footer buttons */}
            <div
              className="flex gap-6 justify-center p-4"
              style={{ borderTop: `1px solid ${COLORS.fogGray}30` }}
            >
              <motion.button
                onClick={onClose}
                className="px-4 py-2 text-sm tracking-wider"
                style={{ color: COLORS.fogGray }}
                whileHover={{ color: COLORS.coldGray }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleSave}
                className="px-4 py-2 text-sm tracking-wider"
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 35, 33, 0.8), rgba(15, 18, 17, 0.9))',
                  border: `1px solid ${COLORS.fogGray}30`,
                  color: COLORS.boneWhite
                }}
                whileHover={{ borderColor: COLORS.coldGray }}
              >
                Apply Theme
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
