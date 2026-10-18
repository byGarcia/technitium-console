/*
What there is to announce: the latest release, the oldest Technitium it is made
for, and whether Docker users can already get it.

None of it uses api.github.com. Its anonymous limit is per IP and Cloudflare's
outgoing addresses are shared, so the release comes from the redirect of the
releases page and the minimum from the raw file at that tag.

`readRelease` returns null when there is nothing safe to announce and throws
when a source fails, so that the caller can keep serving what it had.
*/

export interface Release {
  latest: string
  server: string
}

const REPO = 'byGarcia/technitium-console'
const IMAGE = 'bygarcia/technitium-console'
const RELEASE_TAG = /\/releases\/tag\/v(\d+\.\d+\.\d+)$/
const VERSION = /^\d+\.\d+(\.\d+)?$/

/* The record's format is frozen: consoles already installed read only this. */
export function formatRecord(r: Release): string {
  return `v=1 latest=${r.latest} server=${r.server}`
}

export async function readRelease(fetchFn: typeof fetch, previous: Release | null): Promise<Release | null> {
  const page = await fetchFn(`https://github.com/${REPO}/releases/latest`, { redirect: 'manual' })
  if (page.status >= 500) throw new Error(`releases/latest answered ${page.status}`)
  const tag = RELEASE_TAG.exec(page.headers.get('location') ?? '')
  if (!tag) return null
  const latest = tag[1]

  const pkg = await fetchFn(`https://raw.githubusercontent.com/${REPO}/v${latest}/package.json`)
  if (pkg.status >= 500) throw new Error(`package.json answered ${pkg.status}`)
  if (!pkg.ok) return null
  // Releases before the update notice have no such field: nothing to announce.
  const server = ((await pkg.json()) as { technitiumServerMinimum?: unknown }).technitiumServerMinimum
  if (typeof server !== 'string' || !VERSION.test(server)) return null

  // The GitHub release is published before its image (release.yml: `image`
  // needs `release`). Announcing it earlier would send Docker users to pull an
  // image that is not there yet, so until it is, the previous one stands.
  const auth = await fetchFn(`https://ghcr.io/token?scope=repository:${IMAGE}:pull`)
  if (!auth.ok) throw new Error(`ghcr.io token answered ${auth.status}`)
  const { token } = (await auth.json()) as { token: string }
  const manifest = await fetchFn(`https://ghcr.io/v2/${IMAGE}/manifests/${latest}`, {
    method: 'HEAD',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
    },
  })
  if (manifest.status === 404) return previous
  if (!manifest.ok) throw new Error(`ghcr.io manifest answered ${manifest.status}`)

  return { latest, server }
}
