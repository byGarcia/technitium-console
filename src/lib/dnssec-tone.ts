import type { TagTone } from '../ui/Tag'

/*
The tone of a record's DNSSEC status, the same wherever a status is drawn (Cache,
DNS Client): Secure is ok, Bogus is danger, Indeterminate is a warning, and the
rest (Insecure, Unknown, Disabled) are neutral. The word is always written in the
tag; the tone only repeats it.
*/
export function dnssecTone(status: string | undefined): TagTone {
  switch (status) {
    case 'Secure':
      return 'ok'
    case 'Bogus':
      return 'dan'
    case 'Indeterminate':
      return 'warn'
    default:
      return 'neutral'
  }
}
