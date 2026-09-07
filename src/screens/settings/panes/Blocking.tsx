import { useEffect, useState } from 'react'
import { Button } from '../../../ui/Button'
import { dateTime } from '../../../lib/dates'
import { Input } from '../../../ui/Field'
import {
  AreaRow,
  Notices,
  Block,
  Check,
  Trailer,
  GroupRow,
  Help,
  Note,
  Radios,
  Row,
  TextRow,
  Warning,
  settingsStyles as settings,
  settingsStyles as styles,
} from '../parts'
import { HelpText } from '../../../ui/Form'
import { Field } from '../../../ui/Field'
import { Select } from '../../../ui/Select'
import { applyQuickEntry, loadQuickList, type QuickEntry } from '../../../lib/quick-lists'
import type { PaneProps } from './types'

/*
Settings > Blocking (index.html:2066-2190).

This is where the screen's only cascading enablement rule lives
(`updateBlockingState`, main.js:2412): with "Enable Blocking" unchecked, ALL the
sub-tab's controls go off, and "Update Now" additionally requires the URL list
not to be empty.
*/
export interface BlockingExtra {
  /** `temporaryDisableBlockingTill` from `settings/get`. Absent or null = "Not Set". */
  temporaryDisableBlockingTill?: string | null
  /** `blockListNextUpdatedOn`. Absent or null = "Not Scheduled"; past = "Updating Now". */
  blockListNextUpdatedOn?: string | null
  onTemporaryDisable: () => void
  onUpdateNow: () => void
  busy?: boolean
}

export function nextUpdateText(iso: string | null | undefined): string {
  if (iso == null) return 'Not Scheduled'
  return Date.now() < new Date(iso).getTime() ? dateTime(iso) : 'Updating Now'
}

export function Blocking({ f, set, en, extra }: PaneProps & { extra: BlockingExtra }) {
  const off = !en.blocking

  /*
  The known block lists, offered beside the field they fill. Upstream's control
  (`index.html:2156`), which this console had lost while keeping the help text
  that describes it. See spec F8.
  */
  const [quick, setQuick] = useState<QuickEntry[]>([])
  useEffect(() => {
    let alive = true
    void loadQuickList('quick-block-lists').then((e) => alive && setQuick(e))
    return () => {
      alive = false
    }
  }, [])

  // No legend: it repeated the panel's title.
  return (
    <Block
      notices={
        <Warning>
          The DNS Server loads all block lists in memory and thus it is expected that the server is
          provisioned with sufficient amount of memory to avoid out of memory issues. On average, 1
          million domain names in block list take about 300 MB of memory. The block list update
          process requires additional memory to load the newly downloaded block lists before it
          replaces the previously loaded block lists in memory.
        </Warning>
      }
    >
      <GroupRow label="Blocking">
        <Check
          toggle
          label="Enable Blocking"
          checked={f.enableBlocking}
          onChange={(v) => set({ enableBlocking: v })}
          help="Sets the DNS Server to block domain names using Blocked Zone and Block List Zone."
        />
        <Check
          toggle
          label="Allow TXT Blocking Report"
          checked={f.allowTxtBlockingReport}
          onChange={(v) => set({ allowTxtBlockingReport: v })}
          disabled={off}
          help="Specifies if the DNS Server should respond with TXT records containing a blocked domain report for TXT type requests. This option also enables Extended DNS Error blocked domain report in response for requests that support EDNS."
        />
      </GroupRow>

      <Row label="Blocking Temporarily Disabled Till">
        {(id) => (
          <div className={styles.stack}>
            <div className={styles.val}>
              {extra.temporaryDisableBlockingTill == null
                ? 'Not Set'
                : dateTime(extra.temporaryDisableBlockingTill)}
            </div>
            <div className={settings.inline}>
              <Input
                id={id}
                type="number"
                placeholder="minutes"
            /* `--ctrl-num` and not a hand-written 100: this was a COPY of
               `TextRow`'s old default, not a decision of this field. While the
               default was 100 it was indistinguishable; when it moved to 104 it
               was left alone, and the sweep caught it as a signature of its
               own. */
                style={{ width: 'var(--ctrl-num)' }}
                disabled={off}
                value={f.temporaryDisableBlockingMinutes}
                onChange={(e) => set({ temporaryDisableBlockingMinutes: e.target.value })}
              />
              <Trailer>minutes</Trailer>
            </div>
            <div>
              <Button disabled={off || extra.busy} onClick={extra.onTemporaryDisable}>
                Temporary Disable Now
              </Button>
            </div>
          </div>
        )}
      </Row>

      <AreaRow
        label="Blocking Bypass List"
        value={f.blockingBypassList}
        onChange={(v) => set({ blockingBypassList: v })}
        disabled={off}
        help="Enter IP addresses or network addresses one below another that are allowed to bypass blocking."
      />

      <GroupRow label="Blocking Type">
        <Radios
          name="rdBlockingType"
          value={f.blockingType}
          onChange={(v) => set({ blockingType: v })}
          disabled={off}
          options={[
            {
              value: 'AnyAddress',
              label: 'ANY Address',
              help: (
                <>
                  Uses <code>0.0.0.0</code> and <code>::</code> IP addresses for blocked domain
                  names.
                </>
              ),
            },
            {
              value: 'NxDomain',
              label: 'NX Domain (recommended)',
              help: (
                <>
                  Uses <code>NX Domain</code> response for blocked domain names.
                </>
              ),
            },
            {
              value: 'CustomAddress',
              label: 'Custom Address',
              help: 'Uses custom IP addresses provided below for blocked domain names.',
            },
          ]}
        />
      </GroupRow>

      <AreaRow
        label="Custom Blocking Addresses (IP Address)"
        value={f.customBlockingAddresses}
        onChange={(v) => set({ customBlockingAddresses: v })}
        disabled={!en.customBlockingAddresses}
      />

      <TextRow
        label="Blocking Answer TTL"
        value={f.blockingAnswerTtl}
        onChange={(v) => set({ blockingAnswerTtl: v })}
        placeholder="ttl"
        suffix="seconds (default 30)"
        help="The TTL value in seconds that must be used for the records in a blocking response. This is the TTL value that the client will use to cache the blocking response."
      />

      <AreaRow
        label="Allow / Block List URLs"
        value={f.blockListUrls}
        onChange={(v) => set({ blockListUrls: v })}
        rows={7}
        disabled={off}
        help={
          <>
            <p>
              Enter block list URL one below another in the above text field or use the Quick Add
              list to add known block list URLs.
            </p>
            <p>
              For directly using block list files saved on this server, use the <code>file://</code>{' '}
              formatted URL path. For example, on Linux the URL should look like{' '}
              <code>file:///home/folder/myblocklist.txt</code> and on Windows it should look like{' '}
              <code>file:///c:/folder/myblocklist.txt</code>.
            </p>
            <p>
              Add <code>!</code> character at the start of an URL to make it an allow list URL. This
              option must not be used with allow lists that use <code>Adblock Plus</code> format.
            </p>
            <p>
              Begin a line with <code>#</code> character at the start to use it for comments.
            </p>
          </>
        }
      />

      {/* Upstream places it directly under the textarea it fills, before the
          help that mentions it (`index.html:2155-2160`). */}
      <Field label="Quick Add">
        {(id) => (
          <Select
            id={id}
            disabled={off}
            value=""
            onChange={(ev) => {
              const chosen = ev.target.value
              if (chosen === '') return
              if (chosen === 'none') {
                set({ blockListUrls: '' })
                return
              }
              const entry = quick.find((q) => q.name === chosen)
              if (entry) set({ blockListUrls: applyQuickEntry(f.blockListUrls, entry) })
            }}
          >
            <option value="" />
            <option value="none">None</option>
            {quick.map((q) => (
              <option key={q.name} value={q.name}>
                {q.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <TextRow
        label="Block List Update Interval"
        type="number"
        value={f.blockListUpdateIntervalHours}
        onChange={(v) => set({ blockListUpdateIntervalHours: v })}
        placeholder="hours"
        suffix="hours (valid range 0-168; default 24; set 0 to disable)"
        disabled={off}
        help="The interval in hours to automatically download and update the block lists."
      />

      <GroupRow label="Block List Next Update On">
        <div className={styles.inline}>
          <span className={styles.val}>
            {nextUpdateText(extra.blockListNextUpdatedOn)}
          </span>
          <Button
            disabled={!en.updateListsNow || extra.busy}
            onClick={extra.onUpdateNow}
          >
            Update Now
          </Button>
        </div>
        <HelpText>
          Click the 'Update Now' button to reset the next update schedule and force download and
          update of the block lists.
        </HelpText>
      </GroupRow>

      <Notices>
        <Note>
          The DNS Server will use the data returned by the block list URLs to update the block list
          zone automatically. The expected file format is standard <code>hosts</code> file format,
          plain text file containing list of domains to block, wildcard block list file format, or{' '}
          <code>Adblock Plus</code> file format.
        </Note>
        <Note>
          To customize the Quick Add drop down list, read the instructions given in the{' '}
          <code>www/json/readme.txt</code> file found in the installation folder.
        </Note>
      </Notices>
      <Help href="https://blog.technitium.com/2018/10/blocking-internet-ads-using-dns-sinkhole.html">
        Help: Blocking Internet Ads Using DNS Sinkhole
      </Help>
    </Block>
  )
}
