/*
  Which Advanced Blocking this server runs, and what the editor does about it. The
  app is found by its class and not by its name: a zip uploaded under another name
  is still the app.
*/
import type { InstalledApp } from '../../../api/apps'

export const CHECKED_VERSION = '11.2.1'
export const MIN_VERSION = '10.0'
const APP_CLASS = 'AdvancedBlocking.App'

function parts(v: string): number[] | null {
  const out = v.split('.').map((p) => (/^[0-9]+$/.test(p) ? Number(p) : NaN))
  return out.some(Number.isNaN) ? null : out
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** A version that cannot be read counts as newer: the editor stays, with its note. */
export function versionState(v: string): 'too-old' | 'ok' | 'newer' {
  const read = parts(v)
  if (read === null) return 'newer'
  if (compare(read, parts(MIN_VERSION) as number[]) < 0) return 'too-old'
  return compare(read, parts(CHECKED_VERSION) as number[]) > 0 ? 'newer' : 'ok'
}

export function findBlockingApp(apps: InstalledApp[], name?: string): InstalledApp | undefined {
  return apps.find((a) => (name === undefined || a.name === name) && a.dnsApps.some((d) => d.classPath === APP_CLASS))
}
