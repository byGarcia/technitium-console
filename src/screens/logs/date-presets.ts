export type DatePresetId = '1h' | '6h' | '24h' | 'today' | 'yesterday' | '7d' | '30d'

export interface DatePreset {
  id: DatePresetId
  label: string
}

export const DATE_PRESETS: readonly DatePreset[] = [
  { id: '1h', label: '1h' },
  { id: '6h', label: '6h' },
  { id: '24h', label: '24h' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
]

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** Format a Date object to YYYY-MM-DDTHH:mm for datetime-local inputs. */
export function formatDatetimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function computeDatePreset(id: DatePresetId, now: Date = new Date()): { start: string; end: string } {
  let startDate: Date
  let endDate: Date = now

  switch (id) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000)
      break
    case '6h':
      startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000)
      break
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      break
    case 'yesterday':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59)
      break
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
  }

  return {
    start: formatDatetimeLocal(startDate),
    end: formatDatetimeLocal(endDate),
  }
}
