import type { GroupModel, TextList } from './config-model'

/*
One line on what a group does, for the `What it gets` column of Clients.

Every word is ours: upstream has no such summary, only the JSON box. `Blocking off:
everything is answered`, `Answers`, `No answer set`, `list(s)`, `rule(s)`.

The order of the reading follows the app: with the group off nothing else applies
(`App.cs:570`), and `blockAsNxDomain` decides over the addresses (`App.cs:895-897`).
*/

const TEXT_LISTS: TextList[] = ['allowed', 'blocked', 'allowedRegex', 'blockedRegex']

/** The lines holding something: a blank line in a text area is no rule and no address. */
const filled = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function groupSummary(g: GroupModel): string {
  if (!g.enabled) return 'Blocking off: everything is answered'
  const answer = g.nxDomain ? 'NXDOMAIN' : filled(g.addresses).join(', ') || 'No answer set'
  const rules = TEXT_LISTS.reduce((n, list) => n + filled(g.text[list]).length, 0)
  return `Answers ${answer}, ${plural(g.lists.length, 'list')}, ${plural(rules, 'rule')}`
}
