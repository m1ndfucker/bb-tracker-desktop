// bb-tracker-desktop/src/components/DeathCounter.tsx

import { useState, useEffect } from 'react'
import { COLORS } from '../lib/constants'

interface DeathCounterProps {
  deaths: number
  bossDeaths?: number
  bossFightMode?: boolean
  onClick?: () => void
  canEdit?: boolean
}

export function DeathCounter({
  deaths,
  bossDeaths = 0,
  bossFightMode = false,
  onClick,
  canEdit
}: DeathCounterProps) {
  const [flash, setFlash] = useState(false)
  const [prevDeaths, setPrevDeaths] = useState(deaths)

  useEffect(() => {
    // Flash on death increase (either total or boss deaths)
    const currentCount = bossFightMode ? bossDeaths : deaths
    const prevCount = bossFightMode ? prevDeaths : prevDeaths
    if (currentCount > prevCount) {
      setFlash(true)
      setTimeout(() => setFlash(false), 300)
    }
    setPrevDeaths(currentCount)
  }, [deaths, bossDeaths, bossFightMode])

  const displayCount = bossFightMode ? bossDeaths : deaths
  const color = bossFightMode ? COLORS.boneWhite : COLORS.bloodRed

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className="group relative px-6 py-3 rounded transition-all duration-200 disabled:cursor-default"
      style={{
        backgroundColor: flash
          ? `rgba(196, 48, 48, 0.3)`
          : bossFightMode
            ? 'rgba(143, 186, 168, 0.1)'
            : 'rgba(196, 48, 48, 0.1)',
        border: `2px solid ${bossFightMode ? COLORS.bossAmber : COLORS.bloodRed}`,
        boxShadow: flash
          ? '0 0 30px rgba(196, 48, 48, 0.5), inset 0 0 20px rgba(196, 48, 48, 0.2)'
          : bossFightMode
            ? '0 0 15px rgba(143, 186, 168, 0.2)'
            : '0 0 15px rgba(196, 48, 48, 0.2)',
        fontFamily: "'Liberation Serif', Georgia, serif",
      }}
    >
      <div className="flex flex-col items-center">
        <span
          className="text-5xl font-bold tracking-wider transition-transform"
          style={{
            color,
            textShadow: `0 0 20px ${bossFightMode ? 'rgba(143, 186, 168, 0.5)' : 'rgba(196, 48, 48, 0.5)'}`,
            transform: flash ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {displayCount}
        </span>
        <span
          className="text-xs tracking-[0.3em] uppercase mt-1"
          style={{ color: bossFightMode ? COLORS.bossAmberDark : COLORS.bloodRedDark }}
        >
          {bossFightMode ? 'BOSS DEATHS' : 'DEATHS'}
        </span>
      </div>

      {bossFightMode && (
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap"
          style={{ color: COLORS.fogGray }}
        >
          Total: {deaths}
        </div>
      )}
    </button>
  )
}
