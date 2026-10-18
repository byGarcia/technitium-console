/**
 * The update check (`update-check/`), served from this machine for the harness.
 *
 * Cloudflare runs it in production. Here it runs under Node, with the same
 * handler, so that the harness's DNS server can be pointed at it:
 * `http://<docker gateway>:8853/dns-query`.
 *
 * `UPDATE_CHECK_FAKE='v=1 latest=9.9.9 server=15.5'` answers that record instead
 * of reading GitHub, to see the console's notice without a real release.
 *
 * Run it with `node --experimental-strip-types dev/update-check-serve.mjs`.
 */
import { createServer } from 'node:http'
import { handle, lookup } from '../update-check/src/handler.ts'

const PORT = 8853

function fakeRelease(text) {
  const fields = Object.fromEntries(text.split(' ').map((pair) => pair.split('=')))
  return { latest: fields.latest, server: fields.server }
}

const memory = new Map()
const store = {
  async get(key) {
    const hit = memory.get(key)
    return hit && hit.until > Date.now() ? hit.value : null
  },
  async put(key, value, ttlSeconds) {
    memory.set(key, { value, until: Date.now() + ttlSeconds * 1000 })
  },
}

const fake = process.env.UPDATE_CHECK_FAKE
const find = fake ? async () => fakeRelease(fake) : () => lookup(fetch, store)

createServer((req, res) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', async () => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (url.pathname !== '/dns-query') {
      res.writeHead(404).end()
      return
    }
    const body = req.method === 'POST' ? Buffer.concat(chunks) : undefined
    const response = await handle(new Request(url, { method: req.method, headers: req.headers, body }), find)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
    console.log(new Date().toISOString(), req.method, response.status)
  })
}).listen(PORT, '0.0.0.0', () => console.log(`update check on :${PORT}${fake ? ` (fake: ${fake})` : ''}`))
