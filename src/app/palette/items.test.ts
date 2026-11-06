import { afterEach, describe, expect, it } from 'vitest'
import { SECTIONS } from '../sections'
import { accountItems, actionItems, pageItems, rank, readRecent, remember, score, zoneItem } from './items'

afterEach(() => localStorage.clear())

const all = () => true

describe('the palette entries', () => {
  it('lists every sub-section as Section › Sub, and Logs by its two screens', () => {
    const pages = pageItems(SECTIONS.filter((s) => s.id !== 'profile'), (s) => s.subs ?? [])
    const labels = pages.map((p) => p.label)
    expect(labels).toContain('Blocking › Settings')
    expect(labels).toContain('Administration › LDAP')
    expect(labels).toContain('Query Logs')
    expect(labels).not.toContain('Logs › Query Logs')
    expect(labels).toContain('Zones')
  })

  it('offers the name steps only for something that reads as a name', () => {
    expect(actionItems('recur', all).map((a) => a.id)).toEqual(['action:settings'])
    const named = actionItems('doubleclick.net', all).map((a) => a.id)
    expect(named).toEqual([
      'action:check', 'action:dnsclient', 'action:logs', 'action:cache', 'action:rules', 'action:settings',
    ])
    expect(actionItems('172.30.0.11', all).map((a) => a.id)).toEqual(['action:logs-client', 'action:settings'])
    expect(actionItems('', all)).toEqual([])
  })

  it('leaves out a step whose section the user cannot see', () => {
    const ids = actionItems('doubleclick.net', (s) => s !== 'logs' && s !== 'cache').map((a) => a.id)
    expect(ids).not.toContain('action:logs')
    expect(ids).not.toContain('action:cache')
  })

  it('opens a zone as the zone list does, the root as a dot', () => {
    expect(zoneItem('example.net', 'Primary').target).toEqual({ kind: 'route', section: 'zones', sub: null, params: { zone: 'example.net' } })
    expect(zoneItem('', 'Forwarder').label).toBe('.')
  })

  it('needs every word, and puts a label that starts with them first', () => {
    const items = pageItems(SECTIONS, (s) => s.subs ?? [])
    expect(score(items.find((i) => i.label === 'Settings › Recursion')!, 'zzz')).toBeNull()
    const ranked = rank(items, 'set')
    expect(ranked[0].label.startsWith('Set')).toBe(true)
  })

  it('puts a zone that answers before the steps on the typed text', () => {
    const items = [...actionItems('example.net', all), zoneItem('example.net', 'Primary')]
    expect(rank(items, 'example.net')[0].id).toBe('zone:example.net')
  })

  it('keeps the last five entries run, newest first, without repeats', () => {
    const acc = accountItems({ canChangePassword: true, canConfigure2fa: true })
    for (const item of acc) remember(item)
    remember(acc[0])
    const recent = readRecent()
    expect(recent).toHaveLength(5)
    expect(recent[0].id).toBe(acc[0].id)
    expect(new Set(recent.map((r) => r.id)).size).toBe(5)
    expect(recent.every((r) => r.group === 'Recent')).toBe(true)
  })

  it('hides the password and 2FA steps the account cannot take', () => {
    const ids = accountItems({ canChangePassword: false, canConfigure2fa: false }).map((a) => a.id)
    expect(ids).not.toContain('account:password')
    expect(ids).not.toContain('account:2fa')
  })
})
