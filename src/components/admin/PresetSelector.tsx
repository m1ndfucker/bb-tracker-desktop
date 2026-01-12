// Preset Selector Component
// Left sidebar with list of available presets

import { COLORS } from '../../lib/constants'
import { PresetsData } from '../../lib/presetsApi'

interface PresetSelectorProps {
  presets: PresetsData
  selectedSlug: string
  onSelect: (slug: string) => void
}

export function PresetSelector({ presets, selectedSlug, onSelect }: PresetSelectorProps) {
  const slugs = Object.keys(presets.presets)

  return (
    <div
      style={{
        width: 160,
        borderRight: `1px solid ${COLORS.fogGray}`,
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
      }}
    >
      <div style={{ padding: 12 }}>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          PRESETS
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slugs.map(slug => {
            const preset = presets.presets[slug]
            const isSelected = slug === selectedSlug

            return (
              <button
                key={slug}
                onClick={() => onSelect(slug)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: isSelected ? 'rgba(196, 48, 48, 0.2)' : 'transparent',
                  border: `1px solid ${isSelected ? COLORS.bloodRed : 'transparent'}`,
                  fontFamily: "'Liberation Serif', serif",
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {/* Selection indicator */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isSelected ? COLORS.bloodRed : COLORS.fogGray
                  }}
                />

                {/* Preset name */}
                <span
                  style={{
                    fontSize: 14,
                    color: isSelected ? COLORS.boneWhite : COLORS.ashGray
                  }}
                >
                  {preset.displayName}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
