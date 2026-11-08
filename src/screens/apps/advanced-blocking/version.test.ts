import { describe, expect, it } from 'vitest'
import type { InstalledApp } from '../../../api/apps'
import { CHECKED_VERSION, findBlockingApp, MIN_VERSION, versionState } from './version'

function app(name: string, classes: string[]): InstalledApp {
  return { name, description: null, version: '11.2.1', dnsApps: classes.map((classPath) => ({ classPath })) } as unknown as InstalledApp
}

describe('versionState', () => {
  it('names what the console was checked against', () => {
    expect(CHECKED_VERSION).toBe('11.2.1')
    expect(MIN_VERSION).toBe('10.0')
  })

  it.each([
    ['9.1', 'too-old'],
    ['9.99.9', 'too-old'],
    ['10.0', 'ok'],
    ['10', 'ok'],
    ['11.2', 'ok'],
    ['11.2.1', 'ok'],
    ['11.2.1.0', 'ok'],
    ['11.2.2', 'newer'],
    ['11.10', 'newer'],
    ['12.0', 'newer'],
  ] as const)('%s is %s', (version, expected) => {
    expect(versionState(version)).toBe(expected)
  })

  it('takes what it cannot read for newer, which keeps the editor and says so', () => {
    expect(versionState('nightly')).toBe('newer')
    expect(versionState('')).toBe('newer')
  })
})

describe('findBlockingApp', () => {
  const apps = [app('Other', ['Other.App']), app('Renamed', ['X.App', 'AdvancedBlocking.App']), app('Advanced Blocking', ['AdvancedBlocking.App'])]

  it('finds the app by its class, not its name', () => {
    expect(findBlockingApp(apps)?.name).toBe('Renamed')
  })

  it('picks the named one when there are several', () => {
    expect(findBlockingApp(apps, 'Advanced Blocking')?.name).toBe('Advanced Blocking')
  })

  it('does not settle for another app when the name is not that class', () => {
    expect(findBlockingApp(apps, 'Other')).toBeUndefined()
    expect(findBlockingApp(apps, 'Nope')).toBeUndefined()
  })

  it('finds nothing when it is not installed', () => {
    expect(findBlockingApp([app('Other', ['Other.App'])])).toBeUndefined()
    expect(findBlockingApp([])).toBeUndefined()
  })
})
