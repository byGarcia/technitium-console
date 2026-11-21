import { useEffect, useState } from 'react'
import { Confirm } from '../ui/Confirm'
import { installLeaveGuard } from './leave-guard'

/*
The question `leave-guard.ts` asks before a way out throws away an unsaved form
(deviation 51). OURS, words included: the title `Discard Changes`, the sentence
`Are you sure you want to discard the unsaved changes?` (in the voice of upstream's
own confirmations) and the verb `Discard`. Cancel stays where you are, with the
form as it was; Discard goes where you were going.
*/
export function LeaveConfirm() {
  const [pending, setPending] = useState<{ go: () => void } | null>(null)
  useEffect(() => installLeaveGuard((go) => setPending({ go })), [])
  return (
    <Confirm
      open={pending != null}
      title="Discard Changes"
      text="Are you sure you want to discard the unsaved changes?"
      label="Discard"
      onClose={() => setPending(null)}
      onConfirm={() => {
        const go = pending?.go
        setPending(null)
        go?.()
      }}
    />
  )
}
