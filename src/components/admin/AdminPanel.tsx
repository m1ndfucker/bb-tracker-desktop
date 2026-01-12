// Admin Panel - Main preset editor container
// Layout: [Presets] | [Color Editors] | [Settings] | [Live Preview]

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '../../lib/constants'
import { PresetsData, PresetConfig, updatePreset } from '../../lib/presetsApi'
import { PresetSelector } from './PresetSelector'
import { ColorEditor } from './ColorEditor'
import { SettingsEditor } from './SettingsEditor'
import { PresetPreview } from './PresetPreview'

interface AdminPanelProps {
  presets: PresetsData
  adminToken: string
  onClose: () => void
  onPresetUpdated: () => void
}

export function AdminPanel({ presets, adminToken, onClose, onPresetUpdated }: AdminPanelProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(Object.keys(presets.presets)[0] || 'bloodborne')
  const [editedConfig, setEditedConfig] = useState<PresetConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'colors' | 'settings'>('colors')

  // Initialize edited config when preset changes
  useEffect(() => {
    const preset = presets.presets[selectedSlug]
    if (preset) {
      setEditedConfig(JSON.parse(JSON.stringify(preset.config))) // Deep clone
      setSaveError(null)
    }
  }, [selectedSlug, presets])

  // Get original config for reset
  const originalConfig = presets.presets[selectedSlug]?.config

  // Handle color change
  const handleColorChange = (section: 'colors' | 'timeline', key: string, value: string) => {
    if (!editedConfig) return

    setEditedConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value
        }
      }
    })
  }

  // Handle section change (for logo, background, transparency, font)
  const handleSectionChange = <K extends keyof PresetConfig>(section: K, value: PresetConfig[K]) => {
    if (!editedConfig) return

    setEditedConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: value
      }
    })
  }

  // Reset to original
  const handleReset = () => {
    if (originalConfig) {
      setEditedConfig(JSON.parse(JSON.stringify(originalConfig)))
      setSaveError(null)
    }
  }

  // Save changes
  const handleSave = async () => {
    if (!editedConfig) return

    setSaving(true)
    setSaveError(null)

    try {
      const result = await updatePreset(selectedSlug, editedConfig, adminToken)
      if (result.success) {
        onPresetUpdated()
      } else {
        setSaveError(result.error || 'Failed to save')
      }
    } catch (err) {
      setSaveError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  // Check if there are unsaved changes
  const hasChanges = editedConfig && originalConfig &&
    JSON.stringify(editedConfig) !== JSON.stringify(originalConfig)

  if (!editedConfig) return null

  // Prepare color fields for editors
  const mainColors = [
    { key: 'primary', label: 'Primary (Timer)', value: editedConfig.colors.primary },
    { key: 'accent', label: 'Accent (Deaths)', value: editedConfig.colors.accent },
    { key: 'secondary', label: 'Secondary (Boss)', value: editedConfig.colors.secondary },
    { key: 'background', label: 'Background', value: editedConfig.colors.background },
    { key: 'cardBg', label: 'Card BG', value: editedConfig.colors.cardBg }
  ]

  const timelineColors = [
    { key: 'death', label: 'Death marker', value: editedConfig.timeline.death },
    { key: 'boss', label: 'Boss marker', value: editedConfig.timeline.boss },
    { key: 'milestone', label: 'Milestone marker', value: editedConfig.timeline.milestone },
    { key: 'stats', label: 'Stats marker', value: editedConfig.timeline.stats },
    { key: 'progressBar', label: 'Progress bar', value: editedConfig.timeline.progressBar },
    { key: 'panelBg', label: 'Panel BG', value: editedConfig.timeline.panelBg.slice(0, 7) }
  ]

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.9)'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          width: '100%',
          maxWidth: 1100,
          margin: '0 16px',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.nearBlack,
          border: `1px solid ${COLORS.bloodRed}`,
          fontFamily: "'Liberation Serif', serif"
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${COLORS.fogGray}30`
          }}
        >
          <h2
            style={{
              fontSize: 16,
              letterSpacing: '0.1em',
              color: COLORS.boneWhite
            }}
          >
            ADMIN: {presets.presets[selectedSlug]?.displayName || selectedSlug}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Save error inline */}
            {saveError && (
              <span style={{ fontSize: 12, color: COLORS.bloodRed }}>
                {saveError}
              </span>
            )}
            {/* Actions in header */}
            <button
              onClick={handleReset}
              disabled={!hasChanges || saving}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                letterSpacing: '0.1em',
                backgroundColor: 'transparent',
                border: `1px solid ${COLORS.fogGray}50`,
                color: hasChanges ? COLORS.boneWhite : COLORS.fogGray,
                fontFamily: "'Liberation Serif', serif",
                opacity: hasChanges && !saving ? 1 : 0.5,
                cursor: hasChanges && !saving ? 'pointer' : 'not-allowed'
              }}
            >
              RESET
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                letterSpacing: '0.1em',
                backgroundColor: hasChanges ? COLORS.bloodRed : COLORS.fogGray,
                border: 'none',
                color: COLORS.boneWhite,
                fontFamily: "'Liberation Serif', serif",
                opacity: hasChanges && !saving ? 1 : 0.5,
                cursor: hasChanges && !saving ? 'pointer' : 'not-allowed'
              }}
            >
              {saving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              onClick={onClose}
              style={{
                fontSize: 24,
                padding: '0 4px',
                color: COLORS.ashGray,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content - 3 columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar - Preset selector */}
          <PresetSelector
            presets={presets}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />

          {/* Middle - Editors with tabs */}
          <div
            style={{
              width: 300,
              display: 'flex',
              flexDirection: 'column',
              borderRight: `1px solid ${COLORS.fogGray}20`
            }}
          >
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: `1px solid ${COLORS.fogGray}20`
              }}
            >
              <button
                onClick={() => setActiveTab('colors')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'colors' ? `2px solid ${COLORS.bloodRed}` : '2px solid transparent',
                  color: activeTab === 'colors' ? COLORS.boneWhite : COLORS.fogGray,
                  cursor: 'pointer',
                  fontFamily: "'Liberation Serif', serif"
                }}
              >
                Colors
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'settings' ? `2px solid ${COLORS.bloodRed}` : '2px solid transparent',
                  color: activeTab === 'settings' ? COLORS.boneWhite : COLORS.fogGray,
                  cursor: 'pointer',
                  fontFamily: "'Liberation Serif', serif"
                }}
              >
                Settings
              </button>
            </div>

            {/* Tab content */}
            <div
              style={{
                flex: 1,
                padding: 16,
                overflowY: 'auto'
              }}
            >
              {activeTab === 'colors' ? (
                <>
                  {/* Main colors */}
                  <ColorEditor
                    title="COLORS"
                    colors={mainColors}
                    onChange={(key, value) => handleColorChange('colors', key, value)}
                  />

                  {/* Timeline colors */}
                  <ColorEditor
                    title="TIMELINE"
                    colors={timelineColors}
                    onChange={(key, value) => {
                      // Handle panelBg with alpha
                      if (key === 'panelBg') {
                        handleColorChange('timeline', key, value + 'f8')
                      } else {
                        handleColorChange('timeline', key, value)
                      }
                    }}
                  />
                </>
              ) : (
                <SettingsEditor
                  config={editedConfig}
                  onChange={handleSectionChange}
                />
              )}
            </div>
          </div>

          {/* Right - Live Preview */}
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <PresetPreview config={editedConfig} />
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
