import { Check } from '../../../ui/Check'
import { Input } from '../../../ui/Field'
import { GroupRow, Row } from '../../../ui/Form'
import { Panel } from '../../../ui/Panel'
import { Trailer } from '../../../ui/PanelForm'
import { FieldProblems, controlProps, problemsAt } from './FieldProblems'
import type { Problem } from './validate'
import styles from './GeneralPanel.module.css'

/*
The settings that apply to the whole app. The values stay text until the checks read
them, so what is half typed is shown as it is.

Every word here is ours, upstream only has the JSON box: `General`, `Blocking`,
`Enable Blocking`, `Blocked Answer TTL`, `Update Lists Every`, `Hours`, `Minutes`,
the three help sentences and the suffixes. The defaults the suffixes state are the
app's (`App.cs:359-361`).
*/

type Patch = Partial<{ enabled: boolean; ttl: string; hours: string; minutes: string }>

export function GeneralPanel({
  enabled,
  ttl,
  hours,
  minutes,
  problems,
  showProblems,
  onChange,
}: {
  enabled: boolean
  ttl: string
  hours: string
  minutes: string
  problems: Problem[]
  showProblems: boolean
  onChange: (patch: Patch) => void
}) {
  const ttlShown = problemsAt(problems, showProblems, 'general', 'ttl')
  const hoursShown = problemsAt(problems, showProblems, 'general', 'hours')
  const minutesShown = problemsAt(problems, showProblems, 'general', 'minutes')

  return (
    <Panel title="General" groups2>
      <GroupRow label="Blocking" help="Turns the whole app on or off. With it off, no group blocks anything.">
        <Check toggle label="Enable Blocking" checked={enabled} onChange={(v) => onChange({ enabled: v })} />
      </GroupRow>
      <Row id="ab-general-ttl" label="Blocked Answer TTL" help="How long clients may keep a blocked answer.">
        {() => (
          <div>
            <div className={styles.suffixed}>
              <Input {...controlProps('general', 'ttl', ttlShown)} className={styles.num} inputMode="numeric" value={ttl} onChange={(e) => onChange({ ttl: e.target.value })} />
              <Trailer>seconds (default 30)</Trailer>
            </div>
            <FieldProblems target="general" field="ttl" shown={ttlShown} />
          </div>
        )}
      </Row>
      <Row id="ab-general-hours" label="Update Lists Every" help="How often the app downloads the list URLs of every group again.">
        {() => (
          <div className={styles.units}>
            <div>
              <div className={styles.suffixed}>
                <Input {...controlProps('general', 'hours', hoursShown)} aria-label="Hours" className={styles.num} inputMode="numeric" value={hours} onChange={(e) => onChange({ hours: e.target.value })} />
                <Trailer>hours</Trailer>
              </div>
              <FieldProblems target="general" field="hours" shown={hoursShown} />
            </div>
            <div>
              <div className={styles.suffixed}>
                <Input {...controlProps('general', 'minutes', minutesShown)} aria-label="Minutes" className={styles.num} inputMode="numeric" value={minutes} onChange={(e) => onChange({ minutes: e.target.value })} />
                <Trailer>minutes (default 24 hours)</Trailer>
              </div>
              <FieldProblems target="general" field="minutes" shown={minutesShown} />
            </div>
          </div>
        )}
      </Row>
    </Panel>
  )
}
