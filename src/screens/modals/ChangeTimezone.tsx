import { Dialog } from '../../ui/Dialog'
import { DialogGroup, Tile, dialogForm as df } from '../../ui/DialogForm'
import { useTimezone, TIMEZONE_OPTIONS } from '../../lib/timezone'

/*
The display timezone dialog: allows selecting persistent display timezone across
all timestamps in the console (Query Logs, View Logs, Dashboard, Clients, DHCP, etc.).
Defaults to IST (Asia/Kolkata), with standard industry timezones across all regions
and Browser Local time available.
*/

export function ChangeTimezone({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { timezone, setTimezone } = useTimezone()

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Display Timezone">
      <DialogGroup label="Timezone" radios={df.tiles}>
        {TIMEZONE_OPTIONS.map((o) => (
          <Tile
            key={o.value}
            name="rdChangeTimezone"
            checked={timezone === o.value}
            onChange={() => setTimezone(o.value)}
            help={o.offset}
          >
            {o.label}
          </Tile>
        ))}
      </DialogGroup>
    </Dialog>
  )
}
