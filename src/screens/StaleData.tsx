import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { dateTime } from '../lib/dates'

/*
The stale-data strip, shared by the collection screens.

The rule comes from phase 1 —*old data never looks like new data*— and pilot 2
drew it: when a refresh fails **the previous list stays**, because throwing it
away would leave the user with nothing over a network error, but it has to be
said that it is not current. With the time of the last good data, which is the
useful half of the message.

## Why it is here and not in `ui/`

Because it is not a primitive yet, it is a composition: an `Alert` in the danger
tone with a `Button` inside. It lives in `screens/` so that Zones and the three
lists do not keep two copies that drift apart —which is exactly what
`dev/uniformity.js` exists to catch— and without inventing new vocabulary in the
kit.

**If a fourth or fifth screen needs it, then it is a primitive** and it goes up to
`ui/` with its decision, not by stealth.

## What it does NOT do

It does not decide when it should be shown. That belongs to each screen, because
only the screen knows whether there was data before: with no previous data there
is nothing to go stale, and marking it would promise an earlier list that does not
exist.
*/
export function StaleData({
  since,
  onRetry,
}: {
  /** When the last good data was, in ISO. */
  since: string | null
  onRetry: () => void
}) {
  return (
    <Alert type="danger" title="Could not refresh.">
      {since != null && <> Last good data: {dateTime(since)}. </>}
      <Button size="sm" onClick={onRetry}>
        Retry
      </Button>
    </Alert>
  )
}
