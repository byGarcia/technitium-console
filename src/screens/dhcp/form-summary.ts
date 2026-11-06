import type { ScopeForm } from './model'

/*
WHAT EACH BLOCK OF THE SCOPE FORM HOLDS, IN ONE LINE (deviation 19, 2026-11-06).
The form's twelve blocks after Scope are folded, each a line with its title and
this summary, so the whole scope reads at a glance and a block opens where it is
to be changed. A summary is read from the form as it stands, so it follows what
is typed, and it says only what the fields hold: an empty field is `None`, not a
default the server might apply.

Words of ours, all in this file: `None`, `On`, `Off`, `ms`, `retries`, `retry`,
`No domain name`, `DNS Updates`, `TTL`, `search domain(s)`, `Router`, `DNS`,
`This DNS Server`, `WINS`, `NTP`, `via`, `Option`, `entry`/`entries`, `Server`,
`Host`, `File`, `match any`, `route(s)`, `range(s)` and `and N more`.
*/

/** The entries of a list typed one per line (or comma separated, as `cleanList`
 *  reads them), blanks left out. */
export function entries(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter((x) => x !== '')
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The list, or its first two and how many more. */
function some(list: string[]): string {
  if (list.length <= 3) return list.join(', ')
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`
}

const or = (parts: string[]) => (parts.length === 0 ? 'None' : parts.join(' · '))

export type FoldTitle =
  | 'Ping Check'
  | 'DNS'
  | 'Network Options'
  | 'Static Routes'
  | 'Bootstrap'
  | 'Vendor Specific Information'
  | 'CAPWAP Access Controller Addresses'
  | 'TFTP Server Addresses'
  | 'Generic DHCP Options'
  | 'Exclusions'
  | 'Advanced Options'
  | 'Reserved Leases'

export function summarise(f: ScopeForm): Record<FoldTitle, string> {
  const search = entries(f.domainSearchList)
  const dns = entries(f.dnsServers)
  const wins = entries(f.winsServers)
  const ntp = [...entries(f.ntpServers), ...entries(f.ntpServerDomainNames)]
  const advanced = [
    f.allowOnlyReservedLeases && 'Allow Only Reserved Lease Allocations',
    f.blockLocallyAdministeredMacAddresses && 'Block Locally Administered MAC Addresses',
    f.ignoreClientIdentifierOption && 'Ignore Client Identifier (Option 61)',
  ].filter((x): x is string => typeof x === 'string')

  return {
    'Ping Check': f.pingCheckEnabled
      ? `On · ${f.pingCheckTimeout || '?'} ms · ${f.pingCheckRetries === '1' ? '1 retry' : `${f.pingCheckRetries || '?'} retries`}`
      : 'Off',
    DNS: [
      f.domainName.trim() === '' ? 'No domain name' : f.domainName.trim(),
      ...(search.length > 0 ? [plural(search.length, 'search domain', 'search domains')] : []),
      `DNS Updates ${f.dnsUpdates ? 'On' : 'Off'}`,
      ...(f.dnsTtl.trim() !== '' ? [`TTL ${f.dnsTtl.trim()}`] : []),
    ].join(' · '),
    'Network Options': [
      ...(f.routerAddress.trim() !== '' ? [`Router ${f.routerAddress.trim()}`] : []),
      f.useThisDnsServer ? 'This DNS Server' : dns.length > 0 ? `DNS ${some(dns)}` : '',
      ...(wins.length > 0 ? [`WINS ${some(wins)}`] : []),
      ...(ntp.length > 0 ? [`NTP ${some(ntp)}`] : []),
    ]
      .filter((x) => x !== '')
      .join(' · ') || 'None',
    'Static Routes': or(
      f.staticRoutes.length > 3
        ? [plural(f.staticRoutes.length, 'route', 'routes')]
        : f.staticRoutes.map((r) => `${r.destination || '?'} via ${r.router || '?'}`),
    ),
    Bootstrap: or([
      ...(f.serverAddress.trim() !== '' ? [`Server ${f.serverAddress.trim()}`] : []),
      ...(f.serverHostName.trim() !== '' ? [`Host ${f.serverHostName.trim()}`] : []),
      ...(f.bootFileName.trim() !== '' ? [`File ${f.bootFileName.trim()}`] : []),
    ]),
    'Vendor Specific Information': or(
      f.vendorInfo.length > 3
        ? [plural(f.vendorInfo.length, 'entry', 'entries')]
        : f.vendorInfo.map((v) => (v.identifier.trim() === '' ? 'match any' : v.identifier.trim())),
    ),
    'CAPWAP Access Controller Addresses': or(
      entries(f.capwapAcIpAddresses).length > 0 ? [some(entries(f.capwapAcIpAddresses))] : [],
    ),
    'TFTP Server Addresses': or(
      entries(f.tftpServerAddresses).length > 0 ? [some(entries(f.tftpServerAddresses))] : [],
    ),
    'Generic DHCP Options': or(
      f.genericOptions.length === 0 ? [] : [some(f.genericOptions.map((o) => `Option ${o.code || '?'}`))],
    ),
    Exclusions: or(
      f.exclusions.length > 3
        ? [plural(f.exclusions.length, 'range', 'ranges')]
        : f.exclusions.map((e) => `${e.startingAddress || '?'} - ${e.endingAddress || '?'}`),
    ),
    'Advanced Options': or(advanced),
    'Reserved Leases': or(
      f.reservedLeases.length === 0
        ? []
        : [
            `${f.reservedLeases.length}: ${some(
              f.reservedLeases.map((r) => r.hostName.trim() || r.address.trim() || r.hardwareAddress.trim() || '?'),
            )}`,
          ],
    ),
  }
}
