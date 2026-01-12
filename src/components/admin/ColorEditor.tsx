// Color Editor Component
// Grid of color pickers for editing preset colors

import { COLORS } from '../../lib/constants'

interface ColorField {
  key: string
  label: string
  value: string
}

interface ColorEditorProps {
  title: string
  colors: ColorField[]
  onChange: (key: string, value: string) => void
}

export function ColorEditor({ title, colors, onChange }: ColorEditorProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 12,
          letterSpacing: '0.1em',
          marginBottom: 12,
          color: COLORS.ashGray,
          fontFamily: "'Liberation Serif', serif"
        }}
      >
        {title}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12
        }}
      >
        {colors.map(({ key, label, value }) => (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {/* Color preview/picker */}
            <div style={{ position: 'relative' }}>
              <input
                type="color"
                value={value}
                onChange={e => onChange(key, e.target.value)}
                style={{
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  backgroundColor: value,
                  border: `1px solid ${COLORS.fogGray}`,
                  padding: 0,
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Label and hex value */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.boneWhite,
                  fontFamily: "'Liberation Serif', serif",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {label}
              </div>
              <input
                type="text"
                value={value.toUpperCase()}
                onChange={e => {
                  const val = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    onChange(key, val)
                  }
                }}
                style={{
                  fontSize: 11,
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: COLORS.ashGray,
                  fontFamily: "'Liberation Serif', serif",
                  border: 'none',
                  outline: 'none',
                  padding: 0
                }}
                maxLength={7}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
