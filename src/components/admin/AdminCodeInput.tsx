// Admin Code Input Modal
// First step of admin access - enter admin code to get token

import { useState } from 'react'
import { motion } from 'framer-motion'
import { COLORS } from '../../lib/constants'
import { verifyAdminCode } from '../../lib/presetsApi'

interface AdminCodeInputProps {
  onSuccess: (token: string) => void
  onClose: () => void
}

export function AdminCodeInput({ onSuccess, onClose }: AdminCodeInputProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const result = await verifyAdminCode(code)
      if (result.success && result.token) {
        onSuccess(result.token)
      } else {
        setError(result.error || 'Invalid code')
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          padding: 24,
          maxWidth: 320,
          width: '100%',
          margin: '0 16px',
          backgroundColor: COLORS.nearBlack,
          border: `1px solid ${COLORS.bloodRed}`,
          fontFamily: "'Liberation Serif', serif"
        }}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24
          }}
        >
          <h2
            style={{
              fontSize: 18,
              letterSpacing: '0.1em',
              color: COLORS.boneWhite,
              fontFamily: "'Liberation Serif', serif"
            }}
          >
            ADMIN ACCESS
          </h2>
          <button
            onClick={onClose}
            style={{
              fontSize: 24,
              color: COLORS.ashGray,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 14,
                marginBottom: 8,
                color: COLORS.ashGray
              }}
            >
              Enter admin code
            </label>
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              style={{
                width: '100%',
                padding: 12,
                fontSize: 16,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: `1px solid ${COLORS.fogGray}`,
                color: COLORS.boneWhite,
                fontFamily: "'Liberation Serif', serif",
                boxSizing: 'border-box'
              }}
              placeholder="..."
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: 8,
                fontSize: 14,
                backgroundColor: 'rgba(196, 48, 48, 0.2)',
                border: `1px solid ${COLORS.bloodRed}`,
                color: COLORS.bloodRed
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: '100%',
              padding: 12,
              letterSpacing: '0.1em',
              backgroundColor: loading ? COLORS.fogGray : COLORS.bloodRed,
              color: COLORS.boneWhite,
              fontFamily: "'Liberation Serif', serif",
              fontSize: 16,
              border: 'none',
              opacity: loading || !code.trim() ? 0.5 : 1,
              cursor: loading || !code.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'VERIFYING...' : 'ENTER'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
