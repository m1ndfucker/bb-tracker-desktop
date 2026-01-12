// Preset Preview Component
// Live preview showing EXACT tracker UI elements from App.tsx

import { PresetConfig } from '../../lib/presetsApi'
import { COLORS } from '../../lib/constants'

interface PresetPreviewProps {
  config: PresetConfig
}

export function PresetPreview({ config }: PresetPreviewProps) {
  const { colors, timeline, logo, background } = config

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        gap: 12,
        minHeight: 0
      }}
    >
      {/* Left side - Main Tracker Preview */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          backgroundColor: colors.background,
          border: `1px solid ${colors.accent}30`,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Background image layer */}
        {background.type === 'image' && background.imageUrl && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${background.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: background.blur ? `blur(${background.blur}px) saturate(0.3) brightness(0.45)` : 'saturate(0.3) brightness(0.45)',
              opacity: background.opacity
            }}
          />
        )}

        {/* Logo - top center position */}
        {logo.enabled && logo.url && (
          <img
            src={logo.url}
            alt="Logo"
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: Math.min(logo.size * 0.4, 120),
              height: 'auto',
              objectFit: 'contain',
              zIndex: 10
            }}
          />
        )}

        {/* Preview label */}
        <div
          style={{
            position: 'relative',
            zIndex: 5,
            fontSize: 9,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '6px 0',
            textAlign: 'center',
            color: colors.primary,
            opacity: 0.4,
            borderBottom: `1px solid ${COLORS.fogGray}20`
          }}
        >
          TRACKER
        </div>

        {/* Main tracker area */}
        <div
          style={{
            position: 'relative',
            zIndex: 5,
            flex: 1,
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}
        >
          {/* Timer */}
          <div
            style={{
              fontSize: 48,
              fontFamily: "'Times New Roman', serif",
              color: colors.primary,
              filter: 'blur(0.3px)',
              textShadow: `0 0 40px ${colors.primary}30`,
              letterSpacing: '-0.02em',
              lineHeight: 1
            }}
          >
            1:23:45
          </div>

          {/* Start button */}
          <div
            style={{
              fontSize: 14,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: COLORS.coldGray,
              marginTop: 2
            }}
          >
            Start
          </div>

          {/* Deaths section */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2
            }}
          >
            {/* Deaths label */}
            <div
              style={{
                fontSize: 14,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: colors.accent
              }}
            >
              Deaths
            </div>

            {/* Death count */}
            <div
              style={{
                fontSize: 56,
                fontFamily: "'Times New Roman', serif",
                color: colors.accent,
                filter: 'blur(0.3px)',
                textShadow: `0 0 20px ${colors.accent}20`,
                lineHeight: 1
              }}
            >
              42
            </div>

            {/* YOU DIED button */}
            <div
              style={{
                fontSize: 20,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: colors.accent,
                marginTop: 8
              }}
            >
              You Died
            </div>
          </div>

          {/* Bottom buttons */}
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 20
            }}
          >
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: colors.secondary
              }}
            >
              Boss
            </span>
            <span
              style={{
                fontSize: 12,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: COLORS.ashGray
              }}
            >
              Milestone
            </span>
          </div>
        </div>

        {/* Timeline bar at bottom with dots */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            height: 12,
            display: 'flex',
            alignItems: 'center',
            zIndex: 5
          }}
        >
          {/* Timeline line */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: `${COLORS.fogGray}40`
            }}
          />
          {/* Progress filled */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: '60%',
              height: 2,
              backgroundColor: timeline.progressBar
            }}
          />
          {/* Sample dots - boss (green), deaths (red), milestone (white) */}
          <div style={{ position: 'absolute', left: '5%', width: 10, height: 10, borderRadius: '50%', backgroundColor: timeline.boss, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '12%', width: 7, height: 7, borderRadius: '50%', backgroundColor: timeline.death, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '18%', width: 7, height: 7, borderRadius: '50%', backgroundColor: timeline.death, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '25%', width: 10, height: 10, borderRadius: '50%', backgroundColor: timeline.boss, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '30%', width: 7, height: 7, borderRadius: '50%', backgroundColor: timeline.death, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '38%', width: 8, height: 8, borderRadius: '50%', backgroundColor: timeline.milestone, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '45%', width: 7, height: 7, borderRadius: '50%', backgroundColor: timeline.death, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '52%', width: 7, height: 7, borderRadius: '50%', backgroundColor: timeline.death, transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', left: '58%', width: 10, height: 10, borderRadius: '50%', backgroundColor: timeline.boss, transform: 'translateX(-50%)' }} />
        </div>
      </div>

      {/* Right side - Timeline Panel Preview */}
      <div
        style={{
          width: 180,
          backgroundColor: timeline.panelBg,
          border: `1px solid ${COLORS.fogGray}30`,
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Panel label */}
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            padding: '6px 0',
            textAlign: 'center',
            color: colors.primary,
            opacity: 0.4,
            borderBottom: `1px solid ${COLORS.fogGray}20`
          }}
        >
          TIMELINE PANEL
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${COLORS.fogGray}20`
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              color: colors.secondary,
              borderBottom: `2px solid ${colors.secondary}`
            }}
          >
            Timeline
          </div>
          <div
            style={{
              flex: 1,
              padding: '8px 0',
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center',
              color: COLORS.fogGray
            }}
          >
            By Day
          </div>
        </div>

        {/* Stats summary */}
        <div
          style={{
            padding: '6px 8px',
            fontSize: 9,
            color: `${colors.secondary}99`
          }}
        >
          3 bosses • 5 milestones • 42 deaths
        </div>

        {/* Stats Dashboard preview */}
        <div
          style={{
            margin: '0 8px 8px',
            padding: 8,
            background: 'linear-gradient(135deg, rgba(30, 35, 33, 0.6), rgba(15, 18, 17, 0.8))',
            border: `1px solid ${COLORS.fogGray}30`
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              textAlign: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary }}>1:23:45</div>
              <div style={{ fontSize: 8, textTransform: 'uppercase', color: COLORS.fogGray }}>Time</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: colors.accent }}>42</div>
              <div style={{ fontSize: 8, textTransform: 'uppercase', color: COLORS.fogGray }}>Deaths</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: colors.secondary }}>3</div>
              <div style={{ fontSize: 8, textTransform: 'uppercase', color: COLORS.fogGray }}>Bosses</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.coldGray }}>2.1</div>
              <div style={{ fontSize: 8, textTransform: 'uppercase', color: COLORS.fogGray }}>Deaths/hr</div>
            </div>
          </div>
        </div>

        {/* Timeline entries preview */}
        <div
          style={{
            flex: 1,
            padding: '0 8px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflow: 'hidden'
          }}
        >
          {/* Boss entry */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              backgroundColor: `${timeline.boss}15`,
              borderLeft: `2px solid ${timeline.boss}`
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: timeline.boss
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colors.primary }}>Father Gascoigne</div>
              <div style={{ fontSize: 8, color: COLORS.fogGray }}>5 deaths • 12:30</div>
            </div>
          </div>

          {/* Death entry */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              backgroundColor: `${timeline.death}10`,
              borderLeft: `2px solid ${timeline.death}`
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: timeline.death
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colors.primary }}>Death #42</div>
              <div style={{ fontSize: 8, color: COLORS.fogGray }}>1:23:45</div>
            </div>
          </div>

          {/* Milestone entry */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              backgroundColor: `${timeline.milestone}10`,
              borderLeft: `2px solid ${timeline.milestone}`
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: timeline.milestone
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colors.primary }}>Cathedral Ward</div>
              <div style={{ fontSize: 8, color: COLORS.fogGray }}>0:45:00</div>
            </div>
          </div>

          {/* Stats entry */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              backgroundColor: `${timeline.stats}10`,
              borderLeft: `2px solid ${timeline.stats}`
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: timeline.stats
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colors.primary }}>Level 25</div>
              <div style={{ fontSize: 8, color: COLORS.fogGray }}>VIT 20 • END 15</div>
            </div>
          </div>
        </div>

        {/* Progress bar preview */}
        <div
          style={{
            padding: '6px 8px',
            borderTop: `1px solid ${COLORS.fogGray}20`
          }}
        >
          <div
            style={{
              height: 4,
              backgroundColor: `${COLORS.fogGray}30`,
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: '60%',
                height: '100%',
                backgroundColor: timeline.progressBar
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
