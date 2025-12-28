'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleLogin() {
    await supabase.auth.signInWithOtp({ email })
    setSent(true)
  }

  return (
    <div style={overlay}>
      <div style={box}>
        <h3>Reply karne ke liye login</h3>
        <p style={{ fontSize: 12, color: '#aaa' }}>
          Tum anonymous hi rahoge
        </p>

        {sent ? (
          <p style={{ color: 'lightgreen' }}>
            Email bhej diya gaya hai
          </p>
        ) : (
          <>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={input}
            />
            <button onClick={handleLogin} style={btn}>
              Send Login Link
            </button>
          </>
        )}

        <button onClick={onClose} style={cancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const box = {
  background: '#111',
  padding: 20,
  borderRadius: 10,
  width: 280,
  color: 'white'
}

const input = {
  width: '100%',
  padding: 8,
  marginTop: 10,
  background: '#000',
  color: 'white',
  border: '1px solid #333'
}

const btn = {
  width: '100%',
  marginTop: 10,
  padding: 8
}

const cancel = {
  marginTop: 10,
  fontSize: 12,
  color: '#888',
  background: 'none',
  border: 'none'
}
