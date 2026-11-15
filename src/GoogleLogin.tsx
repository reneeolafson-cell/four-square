import { useEffect, useRef, useState } from 'react'

type Profile = { sub: string; name: string; email: string }
type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}
type TokenClient = { requestAccessToken: (options: { prompt: string }) => void }
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback: () => void
      }) => TokenClient
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

export function GoogleLogin() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const client = useRef<TokenClient | null>(null)
  const generation = useRef(0)
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!clientId) return
    let active = true
    const initialize = () => {
      if (!active || !window.google) return
      client.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response) => {
          const request = ++generation.current
          if (response.error || !response.access_token) {
            setError('Google sign-in was not completed. Please try again.')
            setBusy(false)
            return
          }
          try {
            const result = await fetch(
              'https://openidconnect.googleapis.com/v1/userinfo',
              {
                headers: { Authorization: `Bearer ${response.access_token}` },
                signal: AbortSignal.timeout(15000),
              },
            )
            if (!result.ok) throw new Error('Profile request failed')
            const user = await result.json()
            if (
              typeof user.sub !== 'string' ||
              typeof user.name !== 'string' ||
              typeof user.email !== 'string'
            ) {
              throw new Error('Invalid Google profile')
            }
            if (!active || request !== generation.current) return
            setProfile({ sub: user.sub, name: user.name, email: user.email })
            clearTimeout(expiry.current)
            expiry.current = setTimeout(
              () => setProfile(null),
              Math.max(0, Number(response.expires_in) || 3600) * 1000,
            )
          } catch {
            if (active && request === generation.current)
              setError('Could not load your Google profile. Please try again.')
          } finally {
            if (active && request === generation.current) setBusy(false)
          }
        },
        error_callback: () => {
          if (!active) return
          setBusy(false)
          setError(
            'Google sign-in was closed or blocked. Please try again and allow the sign-in popup.',
          )
        },
      })
      setReady(true)
    }
    const failed = () => {
      if (active)
        setError(
          'Google sign-in could not load. Check your connection and try reloading.',
        )
    }
    let script = document.querySelector<HTMLScriptElement>('#google-identity')
    if (!script) {
      script = document.createElement('script')
      script.id = 'google-identity'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', initialize)
    script.addEventListener('error', failed)
    if (window.google) initialize()
    return () => {
      active = false
      generation.current++
      clearTimeout(expiry.current)
      script.removeEventListener('load', initialize)
      script.removeEventListener('error', failed)
    }
  }, [])

  return (
    <div className="google-account">
      {profile ? (
        <>
          <span className="google-profile" title={profile.email}>
            <strong>{profile.name}</strong>
            <small>{profile.email}</small>
          </span>
          <button
            className="text-button"
            onClick={() => {
              generation.current++
              clearTimeout(expiry.current)
              setProfile(null)
              setError('')
            }}
          >
            Sign out
          </button>
          <small className="google-storage-note">
            Plans stay in this browser
          </small>
        </>
      ) : (
        <button
          className="google-login"
          disabled={!!clientId && (!ready || busy)}
          onClick={() => {
            setError('')
            if (!clientId) {
              setError(
                'Google login needs a Google OAuth client ID. Set VITE_GOOGLE_CLIENT_ID and rebuild the app. You can keep planning without signing in.',
              )
              return
            }
            setBusy(true)
            try {
              client.current?.requestAccessToken({ prompt: 'select_account' })
            } catch {
              setBusy(false)
              setError('Could not open Google sign-in. Please try again.')
            }
          }}
        >
          <span aria-hidden="true" className="google-mark">
            G
          </span>
          {busy
            ? 'Signing in…'
            : clientId && !ready
              ? 'Loading Google…'
              : 'Sign in with Google'}
        </button>
      )}
      {error && (
        <p className="google-login-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
