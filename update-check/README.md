# Update check

How the console learns that a newer release exists. The DNS server serves the console with
`default-src 'self'` and no `connect-src`, so the browser cannot ask GitHub. It can ask its own
server to resolve a name with DNS Client, and DNS Client takes a DNS-over-HTTPS URL as the server.

This folder is that DNS-over-HTTPS server, a Cloudflare Pages Function at
`https://technitium-console.pages.dev/dns-query`. It knows one name,
`latest.technitium-console.pages.dev`, and answers its TXT with:

```
v=1 latest=1.4.0 server=15.5
```

`latest` is the latest release on GitHub, the one `install.sh` installs. `server` is the oldest
Technitium DNS Server it is made for: `technitiumServerMinimum` in that tag's `package.json`. A
release is announced only once its Docker image is on GHCR. The format is frozen: consoles already
installed read only this one, and ignore keys they do not know.

It reads GitHub at most once an hour and keeps the last good answer for a month, in case GitHub is
down. It needs no secrets.

## Deploying

A Cloudflare Pages project connected to this repository:

- Production branch: `main`
- Root directory: `update-check`
- Build command: none
- Build output directory: `public`

## Running it locally

```sh
node --experimental-strip-types dev/update-check-serve.mjs
```

It listens on port 8853. To have it answer a fixed record instead of reading GitHub, set
`UPDATE_CHECK_FAKE='v=1 latest=9.9.9 server=15.5'`. The harness's DNS server reaches it at the
Docker network's gateway, as `http://<gateway>:8853/dns-query`.
