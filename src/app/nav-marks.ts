import { useEffect, useSyncExternalStore } from 'react'

/*
A mark on a sub-section in the sidebar: the dot Blocking's Lists carries while it
holds unsaved changes, read after its name (`Lists, unsaved changes`).

It used to be drawn by the section's own sub-tabs (`marks` of the old `SubTabs`);
since the sub-sections unfold in the sidebar (2026-11-06) the screen that knows
says it here and the sidebar reads it. The words are the caller's.
*/
type Marks = Record<string, Partial<Record<string, string>>>

let marks: Marks = {}
const listeners = new Set<() => void>()

function publish(section: string, value: Partial<Record<string, string>> | undefined): void {
  const next = { ...marks }
  if (value == null || Object.keys(value).length === 0) delete next[section]
  else next[section] = value
  marks = next
  listeners.forEach((l) => l())
}

/** Says a section's marks while the calling screen is mounted. */
export function useNavMarks(section: string, value: Partial<Record<string, string>> | undefined): void {
  const key = JSON.stringify(value ?? {})
  useEffect(() => {
    publish(section, JSON.parse(key) as Partial<Record<string, string>>)
    return () => publish(section, undefined)
  }, [section, key])
}

/** Every section's marks, for the sidebar. */
export function useAllNavMarks(): Marks {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => marks,
  )
}
