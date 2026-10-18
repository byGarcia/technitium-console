/*
What there is to announce: the latest release, the oldest Technitium it is made
for, and whether Docker users can already get it.

None of it uses api.github.com. Its anonymous limit is per IP and Cloudflare's
outgoing addresses are shared, so the release comes from the redirect of the
releases page and the minimum from the raw file at that tag.

`readRelease` returns null only on a definite answer that there is nothing to
announce, and throws on anything else (a rate limit included), so that the
caller can keep serving what it had.
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
  if (page.status < 300 || page.status >= 400) throw new Error(`releases/latest answered ${page.status}`)
  const tag = RELEASE_TAG.exec(page.headers.get('location') ?? '')
  if (!tag) return null
  const latest = tag[1]

  const pkg = await fetchFn(`https://raw.githubusercontent.com/${REPO}/v${latest}/package.json`)
  if (pkg.status === 404) return null
  if (!pkg.ok) throw new Error(`package.json answered ${pkg.status}`)
  // Releases before the update notice have no such field: nothing to announce.
  const server = ((await pkg.json()) as { technitiumServerMinimum?: unknown }).technitiumServerMinimum
  if (typeof server !== 'string' || !VERSION.test(server)) return null

  // The GitHub release is published before its image (release.yml: `image`
  // needs `release`), and the image job pushes X.Y.Z before it moves `latest`,
  // which it does only once every platform's bytes are checked
  // (.github/actions/init-image). The README's compose file pulls `latest`, so
  // until `latest` is this release's image, the previous announcement stands.
  const auth = await fetchFn(`https://ghcr.io/token?scope=repository:${IMAGE}:pull`)
  if (!auth.ok) throw new Error(`ghcr.io token answered ${auth.status}`)
  const { token } = (await auth.json()) as { token: string }
  const digest = async (reference: string): Promise<string | null> => {
    const manifest = await fetchFn(`https://ghcr.io/v2/${IMAGE}/manifests/${reference}`, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json',
      },
    })
    if (manifest.status === 404) return null
    if (!manifest.ok) throw new Error(`ghcr.io manifest ${reference} answered ${manifest.status}`)
    return manifest.headers.get('docker-content-digest')
  }
  const release = await digest(latest)
  if (!release || release !== (await digest('latest'))) return previous

  return { latest, server }
}
