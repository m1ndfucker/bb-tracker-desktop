// src/pages/OverlayWindow.tsx
// Entry point for overlay Tauri window

import { useEffect } from 'react'
import { Overlay } from './Overlay'

export function OverlayWindow() {
  const params = new URLSearchParams(window.location.search)
  const profileName = params.get('profile') || ''
  const token = params.get('token') || undefined
  const style = (params.get('style') || 'compact') as 'minimal' | 'compact' | 'full'

  // Make body transparent for OBS capture
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent'
    document.documentElement.style.backgroundColor = 'transparent'
    // Disable window dragging except on specific elements
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.backgroundColor = ''
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  if (!profileName) {
    return (
      <div style={{
        color: '#c43030',
        padding: '20px',
        fontFamily: "'Liberation Serif', serif"
      }}>
        No profile specified
      </div>
    )
  }

  return <Overlay profileName={profileName} token={token} style={style} />
}
