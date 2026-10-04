import { useCallback, useEffect, useState } from 'react'
import { apiRequest, onSessionExpired } from '../api/client'
import { Login, type Session } from '../screens/Login'
import { Shell, type ShellSession } from '../app/Shell'
import { readBootIntent } from './boot'

type State =
  | { phase: 'booting' }
  | { phase: 'login'; alert?: { type: 'danger'; title: string; text: string } }
  | { phase: 'ready'; session: ShellSession; forcePasswordChange?: boolean }

export function SessionProvider() {
  const [state, setState] = useState<State>({ phase: 'booting' })

  useEffect(() => {
    const intent = readBootIntent()

    if (intent.kind === 'show-error') {
      setState({ phase: 'login', alert: { type: 'danger', title: 'Error!', text: intent.message } })
      return
    }

    if (intent.kind === 'show-login') {
      setState({ phase: 'login' })
      return
    }

    let cancelled = false
    void (async () => {
      const outcome = await apiRequest<ShellSession>('user/session/get', { token: intent.token })
      if (cancelled) return
      if (outcome.kind === 'ok') {
        localStorage.setItem('token', outcome.data.token)
        setState({ phase: 'ready', session: outcome.data })
      } else {
        // auth.js:65-67 → showPageLogin, which removes the token (main.js:28).
        if (localStorage.getItem('token') === intent.token) localStorage.removeItem('token')
        setState({ phase: 'login' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /*
  If the server rejects the session on ANY call, it ends here: the token is
  cleared and we return to login, as upstream does. Without this, the console
  stayed standing with a dead session.
  */
  useEffect(() => {
    onSessionExpired((token) => {
      if (token && localStorage.getItem('token') === token) localStorage.removeItem('token')
      setState((previous) =>
        previous.phase === 'login' || (previous.phase === 'ready' && token !== previous.session.token)
          ? previous
          : {
              phase: 'login',
              alert: { type: 'danger', title: 'Error!', text: 'Session expired. Please login again.' },
            },
      )
    })
    return () => onSessionExpired(null)
  }, [])

  const onSuccess = useCallback((session: Session, opts?: { forcePasswordChange: boolean }) => {
    localStorage.setItem('token', session.token)
    setState({
      phase: 'ready',
      session: session as ShellSession,
      forcePasswordChange: opts?.forcePasswordChange ?? false,
    })
  }, [])

  // auth.js:299-312: the session is cleared whether the call succeeds or fails.
  const onLogout = useCallback(async () => {
    if (state.phase !== 'ready') return
    const token = state.session.token
    await apiRequest('user/logout', { token })
    if (localStorage.getItem('token') === token) localStorage.removeItem('token')
    setState((previous) =>
      previous.phase === 'ready' && previous.session.token !== token
        ? previous
        : { phase: 'login' },
    )
  }, [state])

  if (state.phase === 'booting') return null
  if (state.phase === 'login') return <Login onSuccess={onSuccess} initialAlert={state.alert} />
  return (
    <Shell
      session={state.session}
      onLogout={() => void onLogout()}
      forcePasswordChange={state.forcePasswordChange}
    />
  )
}
