// bb-tracker-desktop/src/components/Timer.tsx

import { useEffect, useState, useRef } from 'react'
import { COLORS, formatTime } from '../lib/constants'

interface TimerProps {
  elapsed: number
  isRunning: boolean
  onClick?: () => void
  canEdit?: boolean
}

export function Timer({ elapsed, isRunning, onClick, canEdit }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(elapsed)
  const startTimeRef = useRef(Date.now())
  const serverElapsedRef = useRef(elapsed)

  useEffect(() => {
    serverElapsedRef.current = elapsed
    startTimeRef.current = Date.now()
    if (!isRunning) {
      setDisplayTime(elapsed)
    }
  }, [elapsed, isRunning])

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      const now = Date.now()
      const localElapsed = now - startTimeRef.current
      setDisplayTime(serverElapsedRef.current + localElapsed)
    }, 100)

    return () => clearInterval(interval)
  }, [isRunning])

  return (
    <button
      onClick={onClick}
      disabled={!canEdit}
      className="group flex items-center gap-3 px-4 py-2 rounded transition-all duration-200 hover:bg-white/5 disabled:hover:bg-transparent disabled:cursor-default"
      style={{ fontFamily: "'Liberation Serif', Georgia, serif" }}
    >
      <span
        className="text-2xl transition-transform group-hover:scale-110 group-disabled:group-hover:scale-100"
        style={{ color: isRunning ? COLORS.boneWhite : COLORS.fogGray }}
      >
        {isRunning ? '||' : '\u25B6'}
      </span>
      <span
        className="text-4xl font-bold tracking-wider tabular-nums"
        style={{
          color: COLORS.boneWhite,
          textShadow: isRunning ? '0 0 20px rgba(240, 236, 228, 0.3)' : 'none'
        }}
      >
        {formatTime(displayTime)}
      </span>
    </button>
  )
}
