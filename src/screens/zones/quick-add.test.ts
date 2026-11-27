/*
The quick add of a host record (deviation 34): which zone, which type, and the
exact body the Add Record dialog sends for the same record.
*/
import { describe, expect, it } from 'vitest'
import type { Zone } from '../../api/zones'
import { addressFamily, planQuickAdd, subDomainOf, zoneForName } from './quick-add'

const z = (name: string, type = 'Primary', extra: Partial<Zone> = {}): Zone => ({
  name,
  type,
  soaSerial: 1,
  lastModified: '2026-11-06T09:00:00Z',
  disabled: false,
  notifyFailed: false,
  notifyFailedFor: [],
  ...extra,
})

const ZONES = [z('example.lan'), z('lab.example.lan'), z('other.lan'), z('0.30.172.in-addr.arpa')]
const input = (name: string, address: string, ptr = false, createPtrZone = false) => ({ name, address, ptr, createPtrZone })

describe('the zone a name belongs to', () => {
  it('is the longest zone the name ends in, whole labels only', () => {
    expect(zoneForName('nas.lab.example.lan', ZONES)?.name).toBe('lab.example.lan')
    expect(zoneForName('nas.example.lan', ZONES)?.name).toBe('example.lan')
    expect(zoneForName('NAS.Example.LAN.', ZONES)?.name).toBe('example.lan')
    expect(zoneForName('myexample.lan', ZONES)).toBeNull()
  })

  it('is the zone itself for its apex, and the root never takes what nothing else holds', () => {
    expect(zoneForName('example.lan', ZONES)?.name).toBe('example.lan')
    expect(subDomainOf('example.lan', 'example.lan')).toBe('@')
    expect(zoneForName('host.nowhere', [...ZONES, z('', 'Forwarder')])).toBeNull()
  })
})

describe('the type by the address family', () => {
  it('is A for IPv4 and AAAA for IPv6, and nothing for anything else', () => {
    expect(addressFamily('192.168.1.10')).toBe('A')
    expect(addressFamily('2001:db8::10')).toBe('AAAA')
    expect(addressFamily('::ffff:192.168.1.10')).toBe('AAAA')
    expect(addressFamily('256.1.1.1')).toBeNull()
    expect(addressFamily('192.168.1')).toBeNull()
    expect(addressFamily('2001:db8:::1')).toBeNull()
    expect(addressFamily('host.example.lan')).toBeNull()
  })
})

describe('the plan', () => {
  it('sends what the dialog sends for an A record, with the default TTL and no overwrite', () => {
    const plan = planQuickAdd(input('nas.example.lan', '192.168.1.10'), ZONES, 3600)
    expect(plan).toEqual({
      ok: true,
      zone: 'example.lan',
      body: {
        zone: 'example.lan',
        domain: 'nas.example.lan',
        type: 'A',
        ttl: '3600',
        overwrite: 'false',
        comments: '',
        expiryTtl: '',
        ipAddress: '192.168.1.10',
        ptr: 'false',
        createPtrZone: 'false',
        updateSvcbHints: 'true',
      },
    })
  })

  it('sends AAAA for an IPv6 address and upstream ptr and createPtrZone as ticked', () => {
    const plan = planQuickAdd(input('nas.lab.example.lan', '2001:db8::10', true, true), ZONES, 300)
    expect(plan.ok && plan.body).toMatchObject({
      zone: 'lab.example.lan',
      domain: 'nas.lab.example.lan',
      type: 'AAAA',
      ttl: '300',
      ipAddress: '2001:db8::10',
      ptr: 'true',
      createPtrZone: 'true',
    })
  })

  it('refuses, in order, a missing name, a missing address and an address of neither family', () => {
    const empty = planQuickAdd(input('', ''), ZONES, 3600)
    expect(!empty.ok && empty.notice).toEqual({ type: 'warning', title: 'Missing!', text: 'Please enter a domain name to add the record.' })
    const noAddress = planQuickAdd(input('nas.example.lan', ' '), ZONES, 3600)
    expect(!noAddress.ok && noAddress.notice.text).toBe('Please enter an IP address to add the record.')
    const bad = planQuickAdd(input('nas.example.lan', '10.0.0'), ZONES, 3600)
    expect(!bad.ok && bad.notice).toEqual({ type: 'warning', title: 'Invalid!', text: "'10.0.0' is not an IPv4 or IPv6 address." })
  })

  it('refuses a name no zone holds, offering Add Zone', () => {
    const plan = planQuickAdd(input('host.nowhere', '10.0.0.1'), ZONES, 3600)
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.noZone).toBe(true)
    expect(plan.notice.text).toBe("No zone on this node holds 'host.nowhere'. Add the zone first, then the record.")
  })

  it('refuses a zone that takes no records from here: a secondary, or the server own', () => {
    const secondary = planQuickAdd(input('a.mirror.lan', '10.0.0.1'), [z('mirror.lan', 'Secondary')], 3600)
    expect(!secondary.ok && secondary.notice.text).toBe(
      "'a.mirror.lan' belongs to the zone 'mirror.lan' (Secondary), which takes no records from here.",
    )
    const internal = planQuickAdd(input('localhost', '127.0.0.2'), [z('localhost', 'Primary', { internal: true })], 3600)
    expect(internal.ok).toBe(false)
  })
})

/* `zones/list` names an internationalised zone by its ASCII form and adds `nameIdn`
   (15.6.2 harness, 2026-11-20: `xn--mnchen-3ya.test`, `münchen.test`). */
describe('quick add: internationalised names', () => {
  const munich = z('xn--mnchen-3ya.test', 'Primary', { nameIdn: 'münchen.test' })
  const zones = [...ZONES, munich]

  it('finds the zone whether the name is typed in Unicode or in its ASCII form', () => {
    expect(zoneForName('www.münchen.test', zones)).toBe(munich)
    expect(zoneForName('bär.MÜNCHEN.test.', zones)).toBe(munich)
    expect(zoneForName('www.xn--mnchen-3ya.test', zones)).toBe(munich)
    expect(zoneForName('münchen.test', zones)).toBe(munich)
    expect(zoneForName('www.mnchen.test', zones)).toBeNull()
  })

  it('sends the name in the ASCII form the server stores', () => {
    const plan = planQuickAdd(input('www.münchen.test', '10.0.0.1'), zones, 3600)
    expect(plan.ok && plan.zone).toBe('xn--mnchen-3ya.test')
    expect(plan.ok && plan.body).toMatchObject({ zone: 'xn--mnchen-3ya.test', domain: 'www.xn--mnchen-3ya.test' })
    const apex = planQuickAdd(input('münchen.test', '10.0.0.1'), zones, 3600)
    expect(apex.ok && apex.body.domain).toBe('xn--mnchen-3ya.test')
  })

  it('names the zone the way the list draws it when it takes no records', () => {
    const plan = planQuickAdd(input('www.münchen.test', '10.0.0.1'), [{ ...munich, type: 'Secondary' }], 3600)
    expect(!plan.ok && plan.notice.text).toBe(
      "'www.münchen.test' belongs to the zone 'münchen.test (xn--mnchen-3ya.test)' (Secondary), which takes no records from here.",
    )
  })
})
