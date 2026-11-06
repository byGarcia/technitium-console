import { describe, expect, it } from 'vitest'
import { blankForm } from './model'
import { entries, summarise } from './form-summary'

describe('what each folded block holds, in one line', () => {
  it('a new scope: upstream defaults, and None for what is empty', () => {
    const s = summarise(blankForm())
    expect(s['Ping Check']).toBe('Off')
    expect(s['Network Options']).toBe('This DNS Server')
    expect(s['Static Routes']).toBe('None')
    expect(s['Bootstrap']).toBe('None')
    expect(s['Reserved Leases']).toBe('None')
  })

  it('says what the fields hold, and follows them', () => {
    const f = {
      ...blankForm(),
      pingCheckEnabled: true,
      pingCheckTimeout: '1000',
      pingCheckRetries: '1',
      domainName: 'lab.lan',
      dnsTtl: '900',
      useThisDnsServer: false,
      dnsServers: '172.31.20.2\n1.1.1.1',
      routerAddress: '172.31.20.1',
      exclusions: [{ startingAddress: '10.0.0.1', endingAddress: '10.0.0.9' }],
      genericOptions: [{ code: '252', value: '68:74' }],
      reservedLeases: [
        { hostName: 'build-01', hardwareAddress: '02-42-AC-1F-14-0A', address: '172.31.20.60', comments: '' },
        { hostName: '', hardwareAddress: '02-00-00-00-00-01', address: '172.31.20.61', comments: '' },
      ],
    }
    const s = summarise(f)
    expect(s['Ping Check']).toBe('On · 1000 ms · 1 retry')
    expect(s.DNS).toMatch(/^lab\.lan · DNS Updates (On|Off) · TTL 900$/)
    expect(s['Network Options']).toBe('Router 172.31.20.1 · DNS 172.31.20.2, 1.1.1.1')
    expect(s.Exclusions).toBe('10.0.0.1 - 10.0.0.9')
    expect(s['Generic DHCP Options']).toBe('Option 252')
    expect(s['Reserved Leases']).toBe('2: build-01, 172.31.20.61')
  })

  it('a long list is cut to its first two and how many more', () => {
    const s = summarise({ ...blankForm(), tftpServerAddresses: 'a\nb\nc\nd' })
    expect(s['TFTP Server Addresses']).toBe('a, b and 2 more')
  })

  it('reads a list typed one per line or comma separated, blanks left out', () => {
    expect(entries(' a \n\n b,c ')).toEqual(['a', 'b', 'c'])
  })
})
