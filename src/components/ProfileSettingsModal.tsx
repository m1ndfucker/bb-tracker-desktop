// bb-tracker-desktop/src/components/ProfileSettingsModal.tsx

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORS } from '../lib/constants'
import {
  ProfileSettings,
  ProfileColors,
  DEFAULT_PROFILE_SETTINGS,
  PROFILE_PRESETS
} from '../lib/types'

interface ProfileSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: ProfileSettings | null
  onSave: (settings: ProfileSettings) => void
  onUploadLogo: (file: File) => Promise<string | null>
  onUploadBackground: (file: File) => Promise<string | null>
}

// Color picker component with hex input
function ColorPicker({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (color: string) => void
}) {
  const [hexInput, setHexInput] = useState(value)

  useEffect(() => {
    setHexInput(value)
  }, [value])

  const handleHexChange = (hex: string) => {
    setHexInput(hex)
    // Validate and apply hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>
        {label}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setHexInput(e.target.value)
          }}
          className="w-8 h-8 cursor-pointer border-none bg-transparent"
          style={{ padding: 0 }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-2 py-1 text-sm focus:outline-none"
          style={{
            backgroundColor: 'transparent',
            color: COLORS.boneWhite,
            border: `1px solid ${COLORS.fogGray}`
          }}
        />
      </div>
    </div>
  )
}

// Slider component
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = ''
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-xs uppercase tracking-wider" style={{ color: COLORS.fogGray }}>
          {label}
        </label>
        <span className="text-xs" style={{ color: COLORS.coldGray }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 cursor-pointer"
        style={{
          accentColor: COLORS.bloodRed
        }}
      />
    </div>
  )
}

export function ProfileSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
  onUploadLogo,
  onUploadBackground
}: ProfileSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<ProfileSettings>(
    settings || DEFAULT_PROFILE_SETTINGS
  )
  const [isUploading, setIsUploading] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  // Update local settings when props change
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    } else {
      setLocalSettings(DEFAULT_PROFILE_SETTINGS)
    }
  }, [settings, isOpen])

  // Update a specific color
  const updateColor = (key: keyof ProfileColors, value: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
      preset: 'custom'
    }))
  }

  // Apply a preset
  const applyPreset = (presetKey: string) => {
    const preset = PROFILE_PRESETS[presetKey]
    if (preset) {
      setLocalSettings((prev) => ({
        ...prev,
        ...preset,
        colors: { ...prev.colors, ...preset.colors }
      }))
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const url = await onUploadLogo(file)
      if (url) {
        setLocalSettings((prev) => ({
          ...prev,
          logo: { ...prev.logo, url, enabled: true }
        }))
      }
    } finally {
      setIsUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // Handle background upload
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const url = await onUploadBackground(file)
      if (url) {
        setLocalSettings((prev) => ({
          ...prev,
          background: { ...prev.background, imageUrl: url, type: 'image' }
        }))
      }
    } finally {
      setIsUploading(false)
      if (bgInputRef.current) bgInputRef.current.value = ''
    }
  }

  // Handle save
  const handleSave = () => {
    onSave(localSettings)
    onClose()
  }

  // Preset button styles
  const presetButtonStyle = (presetKey: string) => ({
    backgroundColor:
      localSettings.preset === presetKey ? `${COLORS.fogGray}40` : 'transparent',
    border: `1px solid ${localSettings.preset === presetKey ? COLORS.coldGray : COLORS.fogGray}`,
    color: localSettings.preset === presetKey ? COLORS.boneWhite : COLORS.coldGray
  })

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
            className="p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: COLORS.nearBlack,
              border: `1px solid ${COLORS.fogGray}`
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <h2
              className="text-2xl mb-6 tracking-[0.15em] text-center uppercase"
              style={{ color: COLORS.boneWhite }}
            >
              Profile Settings
            </h2>

            {/* Presets */}
            <div className="mb-6">
              <label
                className="text-sm uppercase tracking-wider mb-2 block"
                style={{ color: COLORS.coldGray }}
              >
                Theme Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {['bloodborne', 'elden-ring', 'dark-souls', 'sekiro'].map((preset) => (
                  <motion.button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    className="px-4 py-2 text-sm tracking-wider capitalize"
                    style={presetButtonStyle(preset)}
                    whileHover={{ backgroundColor: `${COLORS.fogGray}30` }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {preset.replace('-', ' ')}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Colors Grid */}
            <div className="mb-6">
              <label
                className="text-sm uppercase tracking-wider mb-3 block"
                style={{ color: COLORS.coldGray }}
              >
                Colors
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <ColorPicker
                  label="Primary (Timer)"
                  value={localSettings.colors.primary}
                  onChange={(v) => updateColor('primary', v)}
                />
                <ColorPicker
                  label="Accent (Deaths)"
                  value={localSettings.colors.accent}
                  onChange={(v) => updateColor('accent', v)}
                />
                <ColorPicker
                  label="Secondary (Boss)"
                  value={localSettings.colors.secondary}
                  onChange={(v) => updateColor('secondary', v)}
                />
                <ColorPicker
                  label="Background"
                  value={localSettings.colors.background}
                  onChange={(v) => updateColor('background', v)}
                />
                <ColorPicker
                  label="Card Background"
                  value={localSettings.colors.cardBg}
                  onChange={(v) => updateColor('cardBg', v)}
                />
              </div>
            </div>

            {/* Logo Section */}
            <div className="mb-6">
              <label
                className="text-sm uppercase tracking-wider mb-3 block"
                style={{ color: COLORS.coldGray }}
              >
                Logo
              </label>
              <div className="flex flex-col gap-3">
                {/* Enable toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.logo.enabled}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        logo: { ...prev.logo, enabled: e.target.checked }
                      }))
                    }
                    className="w-4 h-4"
                    style={{ accentColor: COLORS.bloodRed }}
                  />
                  <span className="text-sm" style={{ color: COLORS.coldGray }}>
                    Show Logo
                  </span>
                </label>

                {localSettings.logo.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Upload button */}
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <motion.button
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full px-3 py-2 text-sm"
                        style={{
                          backgroundColor: 'transparent',
                          border: `1px solid ${COLORS.fogGray}`,
                          color: COLORS.coldGray
                        }}
                        whileHover={{ borderColor: COLORS.coldGray }}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Uploading...' : 'Upload Logo'}
                      </motion.button>
                      {localSettings.logo.url && (
                        <div
                          className="mt-1 text-xs truncate"
                          style={{ color: COLORS.fogGray }}
                        >
                          Current: {localSettings.logo.url.split('/').pop()}
                        </div>
                      )}
                    </div>

                    {/* Position dropdown */}
                    <div>
                      <label
                        className="text-xs uppercase tracking-wider mb-1 block"
                        style={{ color: COLORS.fogGray }}
                      >
                        Position
                      </label>
                      <select
                        value={localSettings.logo.position}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            logo: {
                              ...prev.logo,
                              position: e.target.value as ProfileSettings['logo']['position']
                            }
                          }))
                        }
                        className="w-full px-2 py-1.5 text-sm focus:outline-none"
                        style={{
                          backgroundColor: COLORS.nearBlack,
                          color: COLORS.boneWhite,
                          border: `1px solid ${COLORS.fogGray}`
                        }}
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>

                    {/* Size slider */}
                    <Slider
                      label="Size"
                      value={localSettings.logo.size}
                      onChange={(v) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          logo: { ...prev.logo, size: v }
                        }))
                      }
                      min={24}
                      max={128}
                      step={4}
                      unit="px"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Background Section */}
            <div className="mb-6">
              <label
                className="text-sm uppercase tracking-wider mb-3 block"
                style={{ color: COLORS.coldGray }}
              >
                Background
              </label>

              {/* Type toggle */}
              <div className="flex gap-2 mb-3">
                <motion.button
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      background: { ...prev.background, type: 'color' }
                    }))
                  }
                  className="px-4 py-2 text-sm"
                  style={{
                    backgroundColor:
                      localSettings.background.type === 'color'
                        ? `${COLORS.fogGray}40`
                        : 'transparent',
                    border: `1px solid ${localSettings.background.type === 'color' ? COLORS.coldGray : COLORS.fogGray}`,
                    color:
                      localSettings.background.type === 'color'
                        ? COLORS.boneWhite
                        : COLORS.coldGray
                  }}
                  whileHover={{ backgroundColor: `${COLORS.fogGray}30` }}
                >
                  Color
                </motion.button>
                <motion.button
                  onClick={() =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      background: { ...prev.background, type: 'image' }
                    }))
                  }
                  className="px-4 py-2 text-sm"
                  style={{
                    backgroundColor:
                      localSettings.background.type === 'image'
                        ? `${COLORS.fogGray}40`
                        : 'transparent',
                    border: `1px solid ${localSettings.background.type === 'image' ? COLORS.coldGray : COLORS.fogGray}`,
                    color:
                      localSettings.background.type === 'image'
                        ? COLORS.boneWhite
                        : COLORS.coldGray
                  }}
                  whileHover={{ backgroundColor: `${COLORS.fogGray}30` }}
                >
                  Image
                </motion.button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localSettings.background.type === 'color' ? (
                  <ColorPicker
                    label="Background Color"
                    value={localSettings.background.color}
                    onChange={(v) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        background: { ...prev.background, color: v }
                      }))
                    }
                  />
                ) : (
                  <div>
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    <label
                      className="text-xs uppercase tracking-wider mb-1 block"
                      style={{ color: COLORS.fogGray }}
                    >
                      Background Image
                    </label>
                    <motion.button
                      onClick={() => bgInputRef.current?.click()}
                      className="w-full px-3 py-2 text-sm"
                      style={{
                        backgroundColor: 'transparent',
                        border: `1px solid ${COLORS.fogGray}`,
                        color: COLORS.coldGray
                      }}
                      whileHover={{ borderColor: COLORS.coldGray }}
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload Image'}
                    </motion.button>
                    {localSettings.background.imageUrl && (
                      <div
                        className="mt-1 text-xs truncate"
                        style={{ color: COLORS.fogGray }}
                      >
                        Current: {localSettings.background.imageUrl.split('/').pop()}
                      </div>
                    )}
                  </div>
                )}

                <Slider
                  label="Blur"
                  value={localSettings.background.blur}
                  onChange={(v) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      background: { ...prev.background, blur: v }
                    }))
                  }
                  min={0}
                  max={20}
                  unit="px"
                />

                <Slider
                  label="Opacity"
                  value={localSettings.background.opacity}
                  onChange={(v) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      background: { ...prev.background, opacity: v }
                    }))
                  }
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>

            {/* Transparency Slider */}
            <div className="mb-6">
              <Slider
                label="Overall Transparency"
                value={localSettings.transparency}
                onChange={(v) =>
                  setLocalSettings((prev) => ({ ...prev, transparency: v }))
                }
                min={0}
                max={1}
                step={0.05}
              />
            </div>

            {/* Live Preview */}
            <div className="mb-6">
              <label
                className="text-sm uppercase tracking-wider mb-3 block"
                style={{ color: COLORS.coldGray }}
              >
                Preview
              </label>
              <div
                className="relative p-4 rounded"
                style={{
                  backgroundColor: localSettings.colors.background,
                  opacity: localSettings.transparency,
                  backgroundImage:
                    localSettings.background.type === 'image' &&
                    localSettings.background.imageUrl
                      ? `url(${localSettings.background.imageUrl})`
                      : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter:
                    localSettings.background.blur > 0
                      ? `blur(${localSettings.background.blur}px)`
                      : undefined
                }}
              >
                {/* Preview content wrapper - not blurred */}
                <div
                  className="relative z-10"
                  style={{
                    filter: localSettings.background.blur > 0 ? 'none' : undefined
                  }}
                >
                  {/* Logo preview */}
                  {localSettings.logo.enabled && localSettings.logo.url && (
                    <div
                      className="absolute"
                      style={{
                        [localSettings.logo.position.includes('top') ? 'top' : 'bottom']:
                          '8px',
                        [localSettings.logo.position.includes('left') ? 'left' : 'right']:
                          '8px'
                      }}
                    >
                      <img
                        src={localSettings.logo.url}
                        alt="Logo"
                        style={{
                          width: localSettings.logo.size,
                          height: localSettings.logo.size,
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  )}

                  {/* Timer preview */}
                  <div
                    className="text-3xl font-serif text-center mb-2"
                    style={{ color: localSettings.colors.primary }}
                  >
                    1:23:45
                  </div>

                  {/* Deaths preview */}
                  <div
                    className="text-2xl font-serif text-center"
                    style={{ color: localSettings.colors.accent }}
                  >
                    Deaths: 42
                  </div>

                  {/* Boss info preview */}
                  <div
                    className="text-sm text-center mt-2"
                    style={{ color: localSettings.colors.secondary }}
                  >
                    Boss Fight: 3 deaths
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex gap-6 justify-center">
              <motion.button
                onClick={onClose}
                style={{ color: COLORS.ashGray }}
                whileHover={{ color: COLORS.coldGray }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleSave}
                className="tracking-wider"
                style={{ color: COLORS.bloodRed }}
                whileHover={{ color: COLORS.boneWhite }}
              >
                Save
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
