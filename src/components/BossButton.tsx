// bb-tracker-desktop/src/components/BossButton.tsx

import { COLORS } from '../lib/constants'

interface BossButtonProps {
  bossFightMode: boolean
  bossPaused?: boolean
  onClick: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  canEdit?: boolean
  colors?: {
    primary: string
    secondary: string
  }
}

export function BossButton({
  bossFightMode,
  bossPaused,
  onClick,
  onPause,
  onResume,
  onCancel,
  canEdit,
  colors
}: BossButtonProps) {
  const primaryColor = colors?.primary ?? COLORS.boneWhite
  const secondaryColor = colors?.secondary ?? COLORS.bossAmber

  if (bossFightMode) {
    return (
      <div className="flex gap-2">
        <button
          onClick={onClick}
          disabled={!canEdit}
          className="flex-1 py-2 px-4 text-sm tracking-wider transition-all duration-200 disabled:opacity-50 hover:brightness-110"
          style={{
            backgroundColor: `${secondaryColor}CC`,
            border: `1px solid ${secondaryColor}`,
            color: primaryColor,
            fontFamily: "'Liberation Serif', Georgia, serif",
            boxShadow: `0 0 15px ${secondaryColor}4D`,
          }}
        >
          PREY SLAUGHTERED
        </button>

        {bossPaused ? (
          <button
            onClick={onResume}
            disabled={!canEdit}
            className="py-2 px-3 text-sm transition-all disabled:opacity-50 hover:bg-white/5"
            style={{
              border: `1px solid ${secondaryColor}`,
              color: secondaryColor,
            }}
            title="Resume Boss Timer"
          >
            {'\u25B6'}
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={!canEdit}
            className="py-2 px-3 text-sm transition-all disabled:opacity-50 hover:bg-white/5"
            style={{
              border: `1px solid ${secondaryColor}`,
              color: secondaryColor,
            }}
            title="Pause Boss Timer"
          >
            ||
          </button>
        )}

        <button
          onClick={onCancel}
          disabled={!canEdit}
          className="py-2 px-3 text-sm transition-all disabled:opacity-50 hover:bg-white/5"
          style={{
            border: `1px solid ${COLORS.fogGray}`,
            color: COLORS.fogGray,
          }}
          title="Cancel Boss Fight"
        >
          {'\u2715'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className="w-full py-2 text-sm tracking-wider transition-all duration-200 disabled:opacity-50 hover:bg-white/5"
      style={{
        border: `1px solid ${COLORS.fogGray}`,
        color: secondaryColor,
        fontFamily: "'Liberation Serif', Georgia, serif",
      }}
    >
      START BOSS FIGHT
    </button>
  )
}
