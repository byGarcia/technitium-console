import { Dialog } from '../../ui/Dialog'
import { DialogGroup, Tile, dialogForm as df } from '../../ui/DialogForm'
import { useTimezone, FEATURED_TIMEZONES, getIanaTimezones } from '../../lib/timezone'
import { Select } from '../../ui/Select'
import { Field } from '../../ui/Field'

/*
The display timezone dialog: allows selecting persistent display timezone across
all timestamps in the console (Query Logs, View Logs, Dashboard, Clients, DHCP, etc.).
Defaults to browser local time ('local'), with standard industry timezones across all regions
and the exhaustive IANA Time Zone Database (Unicode CLDR) available.
*/

export function ChangeTimezone({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { timezone, setTimezone } = useTimezone()
  const ianaList = getIanaTimezones()

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Display Timezone">
      <DialogGroup label="Timezone" radios={df.tiles}>
        {FEATURED_TIMEZONES.map((o) => (
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

      <div style={{ marginTop: '16px' }}>
        <Field label="All IANA / CLDR Timezones (Searchable)">
          {(id) => (
            <Select
              id={id}
              searchable
              searchLabel="Search city, country, or offset (e.g. London, Tokyo, UTC)..."
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {ianaList.map((tz) => (
                <option key={tz.value} value={tz.value} data-search={`${tz.value} ${tz.label} ${tz.offset}`}>
                  {tz.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  )
}
