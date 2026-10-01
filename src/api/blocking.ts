import { urlApi } from '../app/base'
import type { ApiOutcome } from './client'
import type { DomainList } from './zonelists'

/*
The Blocking section's own reads. Every endpoint here already exists in the server;
what is ours is only how their answers are combined.
*/

/*
`allowed/export` / `blocked/export` read as TEXT, for the Rules table. Upstream only
opens them as a download (other-zones.js:554, 623); here the same answer is read in
place. The good answer is `text/plain`, one zone per line
(WebServiceOtherZonesApi.cs:306, 511); a failure is the usual JSON envelope.
*/
export async function readRuleExport(
  list: DomainList,
  token: string | null,
): Promise<ApiOutcome<string[]>> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let text: string
  try {
    const res = await fetch(urlApi(`api/${list}/export`), { headers })
    text = await res.text()
  } catch {
    return { kind: 'error', message: 'Unable to connect to the server. Please try again.' }
  }

  if (text.trimStart().startsWith('{')) {
    try {
      const env = JSON.parse(text) as { status?: string; errorMessage?: string }
      if (env.status === 'invalid-token') return { kind: 'invalid-token' }
      if (env.status != null && env.status !== 'ok') {
        return { kind: 'error', message: env.errorMessage ?? env.status }
      }
    } catch {
      /* Not JSON: a zone name cannot start with `{`, but the server owns the format. */
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  return { kind: 'ok', data: lines }
}
