import { apiRequest, type ApiOutcome } from './client'
import { urlApi } from '../app/base'

/*
The endpoints of the `user` family. Thirteen in all; this is the phase that
implements them, even though `createSingleUseToken` has no consumers until
phases 4, 5, 6 and 8.
*/

export interface SessionRow {
  username: string
  isCurrentSession: boolean
  partialToken: string
  type: string
  tokenName: string | null
  lastSeen: string
  lastSeenRemoteAddress: string
  lastSeenUserAgent: string
}

export function deleteSession(token: string | null, partialToken: string): Promise<ApiOutcome> {
  return apiRequest('user/session/delete', { token, body: { partialToken } })
}

/*
main.js:734-740 — the update notice can be silenced persistently, and while it
is silenced the endpoint is NOT EVEN called. Only an explicit `force` skips that
preference.
*/
export const DISABLE_UPDATE_NOTIFICATION_KEY = 'disableUpdateNotification'

/*
Everything the endpoint answers when there IS an update. Only `updateAvailable`
is guaranteed: upstream checks every other field against null before showing it
(`main.js`, checkForUpdate), because the release feed does not always carry them.
Reproduced field by field so the notice can say the same as upstream's.
*/
export interface UpdateInfo {
  updateAvailable: boolean
  updateVersion?: string | null
  currentVersion?: string | null
  updateTitle?: string | null
  updateMessage?: string | null
  downloadLink?: string | null
  instructionsLink?: string | null
  changeLogLink?: string | null
}

/*
And the two that WRITE it, which did not exist: the preference was read and
nothing could set it, so the branch above was unreachable and the user had no way
to silence the notice. Restored on 2026-09-04, contracting About.

They are `localStorage` and not an endpoint because that is what upstream does
(`main.js:714-732`): the preference is this browser's, not the server's, so
silencing it on your laptop does not silence it on someone else's.
*/
export function silenceUpdateNotification(): void {
  localStorage.setItem(DISABLE_UPDATE_NOTIFICATION_KEY, 'true')
}

/* Upstream writes the string `false` rather than removing the key. Same thing to
   `checkForUpdate`, and the same thing left behind in storage. */
export function unsilenceUpdateNotification(): void {
  localStorage.setItem(DISABLE_UPDATE_NOTIFICATION_KEY, 'false')
}

export function updateNotificationSilenced(): boolean {
  return localStorage.getItem(DISABLE_UPDATE_NOTIFICATION_KEY) === 'true'
}

export async function checkForUpdate(
  token: string | null,
  force = false,
): Promise<ApiOutcome<{ response: UpdateInfo }> | { kind: 'skipped' }> {
  if (!force && localStorage.getItem(DISABLE_UPDATE_NOTIFICATION_KEY) === 'true') {
    return { kind: 'skipped' }
  }
  return apiRequest('user/checkForUpdate', { token })
}

/*
The console's downloads do not go by XHR: a single-use token is asked for and a
window is opened with it in the query. Six places use it (settings backup, log
download and export, zone export, and allowed and blocked export), all of them in
later phases. It lives here because the endpoint belongs to this family.
*/
export async function openDownload(
  token: string | null,
  path: string,
  params: Record<string, string> = {},
  /*
  `ts` is a cache-buster that upstream adds on ONLY TWO of the six downloads
  —the settings backup (main.js:3100) and a log download (logs.js:202)— and not
  on the other four: exporting a zone, exporting allowed, exporting blocked and
  `logs/export` (logs.js:696). The server ignores it, but the URL that gets
  opened is not the same, so where it goes and where it does not is replicated.
  */
  options: { ts?: boolean } = {},
): Promise<{ ok: boolean; url?: string }> {
  const outcome = await apiRequest<{ response: { token: string } }>('user/createSingleUseToken', {
    token,
  })
  if (outcome.kind !== 'ok') return { ok: false }

  /*
  The seventh place in the `outcome.data.response` debt, and the only one whose
  guard is deliberately optional.

  The other six returned a list or a value, so `?.` with its `??` was the right
  answer: with no data, an empty list. Here what would be missing is the token of
  a freshly opened session, and a silent `undefined` would build a
  `token=undefined` the server would reject later and further away. A session has
  to fail where it happens.

  It is checked explicitly rather than left to blow up on a dereference, which is
  what it used to do: the `TypeError` was the same symptom for "the server said
  something else" as for a programming bug.
  */
  const unico = outcome.data.response?.token
  if (unico == null) return { ok: false }

  /* It is called `single` and not `token` because it is NOT the session's —that
     is the parameter above—: it is the one-shot one this endpoint issues for the
     download. Having them under the same name was asking for them to be
     confused. */
  const query = new URLSearchParams({ ...params, token: unico })
  if (options.ts === true) {
    query.set('ts', String(performance.timeOrigin + performance.now()))
  }
  const url = urlApi(`api/${path}?${query.toString()}`)
  window.open(url, '_blank')
  return { ok: true, url }
}
