// Settings Editor Component
// Editors for logo, background, font, transparency

import { COLORS } from '../../lib/constants'
import { PresetConfig } from '../../lib/presetsApi'

interface SettingsEditorProps {
  config: PresetConfig
  onChange: <K extends keyof PresetConfig>(section: K, value: PresetConfig[K]) => void
}

// Color picker row component
function ColorRow({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 24,
          height: 24,
          cursor: 'pointer',
          border: `1px solid ${COLORS.fogGray}50`,
          padding: 0,
          borderRadius: 2
        }}
      />
      <span style={{ fontSize: 11, color: COLORS.ashGray, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, color: COLORS.fogGray, fontFamily: 'monospace' }}>
        {value.toUpperCase()}
      </span>
    </div>
  )
}

export function SettingsEditor({ config, onChange }: SettingsEditorProps) {
  const { colors, timeline, logo, background, transparency, font } = config

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* UI Colors */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          COLORS
        </h3>
        <ColorRow
          label="Primary (timer, text)"
          value={colors.primary}
          onChange={v => onChange('colors', { ...colors, primary: v })}
        />
        <ColorRow
          label="Accent (deaths)"
          value={colors.accent}
          onChange={v => onChange('colors', { ...colors, accent: v })}
        />
        <ColorRow
          label="Secondary (boss)"
          value={colors.secondary}
          onChange={v => onChange('colors', { ...colors, secondary: v })}
        />
        <ColorRow
          label="Background"
          value={colors.background}
          onChange={v => onChange('colors', { ...colors, background: v })}
        />
        <ColorRow
          label="Card Background"
          value={colors.cardBg}
          onChange={v => onChange('colors', { ...colors, cardBg: v })}
        />
      </div>

      {/* Timeline Colors */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          TIMELINE
        </h3>
        <ColorRow
          label="Death dots"
          value={timeline.death}
          onChange={v => onChange('timeline', { ...timeline, death: v })}
        />
        <ColorRow
          label="Boss dots"
          value={timeline.boss}
          onChange={v => onChange('timeline', { ...timeline, boss: v })}
        />
        <ColorRow
          label="Milestone dots"
          value={timeline.milestone}
          onChange={v => onChange('timeline', { ...timeline, milestone: v })}
        />
        <ColorRow
          label="Stats dots"
          value={timeline.stats}
          onChange={v => onChange('timeline', { ...timeline, stats: v })}
        />
        <ColorRow
          label="Progress bar"
          value={timeline.progressBar}
          onChange={v => onChange('timeline', { ...timeline, progressBar: v })}
        />
        <ColorRow
          label="Panel background"
          value={timeline.panelBg}
          onChange={v => onChange('timeline', { ...timeline, panelBg: v })}
        />
      </div>

      {/* Logo Settings */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          LOGO
        </h3>

        {/* Enabled toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={logo.enabled}
            onChange={e => onChange('logo', { ...logo, enabled: e.target.checked })}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12, color: COLORS.boneWhite }}>Show logo</span>
        </div>

        {logo.enabled && (
          <>
            {/* URL input */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
                Image URL
              </label>
              <input
                type="text"
                value={logo.url || ''}
                onChange={e => onChange('logo', { ...logo, url: e.target.value || null })}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: 11,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${COLORS.fogGray}50`,
                  color: COLORS.boneWhite,
                  fontFamily: "'Liberation Serif', serif"
                }}
              />
            </div>

            {/* Width slider */}
            <div>
              <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
                Width: {logo.size}px
              </label>
              <input
                type="range"
                min="48"
                max="300"
                value={logo.size}
                onChange={e => onChange('logo', { ...logo, size: parseInt(e.target.value) })}
                style={{ width: '100%', cursor: 'pointer' }}
              />
              <div style={{ fontSize: 10, color: COLORS.fogGray, marginTop: 4 }}>
                Position: top-center (fixed)
              </div>
            </div>
          </>
        )}
      </div>

      {/* Background Settings */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          BACKGROUND
        </h3>

        {/* Type select */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
            Type
          </label>
          <select
            value={background.type}
            onChange={e => onChange('background', { ...background, type: e.target.value as typeof background.type })}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 11,
              backgroundColor: COLORS.nearBlack,
              border: `1px solid ${COLORS.fogGray}50`,
              color: COLORS.boneWhite,
              fontFamily: "'Liberation Serif', serif"
            }}
          >
            <option value="color">Solid Color</option>
            <option value="image">Image</option>
            <option value="gradient">Gradient</option>
          </select>
        </div>

        {/* Color picker (for color type) */}
        {background.type === 'color' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              type="color"
              value={background.color}
              onChange={e => onChange('background', { ...background, color: e.target.value })}
              style={{
                width: 32,
                height: 32,
                cursor: 'pointer',
                border: `1px solid ${COLORS.fogGray}`,
                padding: 0
              }}
            />
            <span style={{ fontSize: 11, color: COLORS.ashGray }}>{background.color.toUpperCase()}</span>
          </div>
        )}

        {/* Image URL (for image type) */}
        {background.type === 'image' && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
              Image URL
            </label>
            <input
              type="text"
              value={background.imageUrl || ''}
              onChange={e => onChange('background', { ...background, imageUrl: e.target.value || null })}
              placeholder="https://..."
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 11,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: `1px solid ${COLORS.fogGray}50`,
                color: COLORS.boneWhite,
                fontFamily: "'Liberation Serif', serif"
              }}
            />
          </div>
        )}

        {/* Blur slider */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
            Blur: {background.blur}px
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={background.blur}
            onChange={e => onChange('background', { ...background, blur: parseInt(e.target.value) })}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        {/* Opacity slider */}
        <div>
          <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
            Opacity: {Math.round(background.opacity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={background.opacity * 100}
            onChange={e => onChange('background', { ...background, opacity: parseInt(e.target.value) / 100 })}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Window Transparency */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          WINDOW
        </h3>

        <div>
          <label style={{ fontSize: 11, color: COLORS.ashGray, display: 'block', marginBottom: 4 }}>
            Transparency: {Math.round(transparency * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={transparency * 100}
            onChange={e => onChange('transparency', parseInt(e.target.value) / 100)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Font */}
      <div>
        <h3
          style={{
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 12,
            color: COLORS.ashGray,
            fontFamily: "'Liberation Serif', serif"
          }}
        >
          FONT
        </h3>

        <select
          value={font}
          onChange={e => onChange('font', e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 11,
            backgroundColor: COLORS.nearBlack,
            border: `1px solid ${COLORS.fogGray}50`,
            color: COLORS.boneWhite,
            fontFamily: font
          }}
        >
          <option value="'Liberation Serif', serif">Liberation Serif</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Georgia', serif">Georgia</option>
          <option value="'Garamond', serif">Garamond</option>
          <option value="'Palatino', serif">Palatino</option>
          <option value="'Arial', sans-serif">Arial</option>
          <option value="'Verdana', sans-serif">Verdana</option>
        </select>
      </div>
    </div>
  )
}
