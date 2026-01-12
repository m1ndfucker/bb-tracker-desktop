// bb-tracker-desktop/src/components/DeathCounter.tsx

import { useState, useEffect } from 'react'
import { COLORS } from '../lib/constants'

interface DeathCounterProps {
  deaths: number
  bossDeaths?: number
  bossFightMode?: boolean
  onClick?: () => void
  canEdit?: boolean
  colors?: {
    primary: string
    accent: string
    secondary: string
  }
}

export function DeathCounter({
  deaths,
  bossDeaths = 0,
  bossFightMode = false,
  onClick,
  canEdit,
  colors
}: DeathCounterProps) {
  const [flash, setFlash] = useState(false)
  const [prevDeaths, setPrevDeaths] = useState(deaths)

  // Theme colors with fallbacks
  const primaryColor = colors?.primary ?? COLORS.boneWhite
  const accentColor = colors?.accent ?? COLORS.bloodRed
  const secondaryColor = colors?.secondary ?? COLORS.bossAmber

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
  const color = bossFightMode ? primaryColor : accentColor
  const borderColor = bossFightMode ? secondaryColor : accentColor

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className="group relative px-6 py-3 rounded transition-all duration-200 disabled:cursor-default"
      style={{
        backgroundColor: flash
          ? `${accentColor}4D`
          : bossFightMode
            ? `${secondaryColor}1A`
            : `${accentColor}1A`,
        border: `2px solid ${borderColor}`,
        boxShadow: flash
          ? `0 0 30px ${accentColor}80, inset 0 0 20px ${accentColor}33`
          : bossFightMode
            ? `0 0 15px ${secondaryColor}33`
            : `0 0 15px ${accentColor}33`,
        fontFamily: "'Liberation Serif', Georgia, serif",
      }}
    >
      <div className="flex flex-col items-center">
        <span
          className="text-5xl font-bold tracking-wider transition-transform"
          style={{
            color,
            textShadow: `0 0 20px ${bossFightMode ? `${secondaryColor}80` : `${accentColor}80`}`,
            transform: flash ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {displayCount}
        </span>
        <span
          className="text-xs tracking-[0.3em] uppercase mt-1"
          style={{ color: bossFightMode ? `${secondaryColor}CC` : `${accentColor}CC` }}
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
