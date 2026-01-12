// bb-tracker-desktop/src/components/CompactView.tsx

import { Timer } from './Timer'
import { DeathCounter } from './DeathCounter'
import { BossButton } from './BossButton'
import { COLORS } from '../lib/constants'
import { ProfileState, ProfileColors } from '../lib/types'

interface CompactViewProps {
  state: ProfileState
  onStart: () => void
  onStop: () => void
  onDeath: () => void
  onBossStart: () => void
  onBossVictory: () => void
  onBossPause: () => void
  onBossResume: () => void
  onBossCancel: () => void
  themeColors?: ProfileColors
}

export function CompactView({
  state,
  onStart,
  onStop,
  onDeath,
  onBossStart,
  onBossVictory,
  onBossPause,
  onBossResume,
  onBossCancel,
  themeColors,
}: CompactViewProps) {
  // Theme colors with fallbacks
  const colors = {
    primary: themeColors?.primary ?? COLORS.boneWhite,
    accent: themeColors?.accent ?? COLORS.bloodRed,
    secondary: themeColors?.secondary ?? COLORS.bossAmber,
    background: themeColors?.background ?? COLORS.nearBlack,
    cardBg: themeColors?.cardBg ?? '#1a1a1a',
  }

  const handleTimerToggle = () => {
    if (state.isRunning) {
      onStop()
    } else {
      onStart()
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col select-none"
      style={{
        backgroundColor: colors.background,
        fontFamily: "'Liberation Serif', Georgia, serif",
      }}
    >
      {/* Header - draggable area */}
      <div
        className="flex justify-between items-center px-4 py-2"
        style={{
          backgroundColor: 'rgba(255,255,255,0.02)',
          borderBottom: `1px solid ${COLORS.fogGray}30`,
        }}
        data-tauri-drag-region
      >
        <span
          className="text-sm tracking-[0.2em] uppercase"
          style={{ color: COLORS.fogGray }}
        >
          {state.displayName || state.profileName}
        </span>
        <div className="flex items-center gap-2">
          {state.bossFightMode && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${colors.secondary}20`,
                color: colors.secondary,
                border: `1px solid ${colors.secondary}40`,
              }}
            >
              BOSS
            </span>
          )}
          <div
            className={`w-2 h-2 rounded-full ${state.canEdit ? 'bg-green-500' : 'bg-yellow-500'}`}
            title={state.canEdit ? 'Editor' : 'Viewer'}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        {/* Timer */}
        <Timer
          elapsed={state.elapsed}
          isRunning={state.isRunning}
          onClick={handleTimerToggle}
          canEdit={state.canEdit}
          colors={{ primary: colors.primary }}
        />

        {/* Death Counter */}
        <DeathCounter
          deaths={state.deaths}
          bossDeaths={state.bossDeaths}
          bossFightMode={state.bossFightMode}
          onClick={onDeath}
          canEdit={state.canEdit}
          colors={{
            primary: colors.primary,
            accent: colors.accent,
            secondary: colors.secondary,
          }}
        />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Death button */}
        <button
          onClick={onDeath}
          disabled={!state.canEdit}
          className="w-full py-4 text-xl tracking-[0.3em] uppercase font-bold transition-all duration-200 disabled:opacity-50 btn-death"
          style={{
            backgroundColor: state.bossFightMode ? 'transparent' : `${colors.accent}CC`,
            border: `2px solid ${state.bossFightMode ? colors.primary : colors.accent}`,
            color: colors.primary,
            fontFamily: "'Liberation Serif', Georgia, serif",
            boxShadow: state.bossFightMode
              ? `0 0 20px ${colors.primary}33`
              : `0 0 20px ${colors.accent}4D`,
          }}
        >
          YOU DIED
        </button>

        {/* Boss button */}
        <BossButton
          bossFightMode={state.bossFightMode}
          bossPaused={state.bossPaused}
          onClick={state.bossFightMode ? onBossVictory : onBossStart}
          onPause={onBossPause}
          onResume={onBossResume}
          onCancel={onBossCancel}
          canEdit={state.canEdit}
          colors={{
            primary: colors.primary,
            secondary: colors.secondary,
          }}
        />
      </div>
    </div>
  )
}
