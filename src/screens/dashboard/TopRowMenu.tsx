import type { TopKind } from '../../api/dashboard'
import { useHandoff } from '../../app/handoff'
import type { useDomainAction } from '../../lib/allow-block'
import { Menu } from '../../ui/Menu'

/*
A top-list row's menu, the same on the Dashboard's three panels and in the Top
Stats modal behind their "More" buttons (main.js:2796-2853 and 2952-3019):

  · Top Clients: "Show Query Logs" for that client.
  · Top Domains: "Show Query Logs", "Query DNS Server" and "Block Domain".
  · Top Blocked Domains: "Show Query Logs", "Query DNS Server" and "Allow Domain".

The domain goes as the server's `name` and the type as `null`, which DNS Client
turns into "A". `node` is the one the Dashboard is reading, the aggregate
included: the jump ignores that one.
*/
export function TopRowMenu({
  kind,
  name,
  node,
  action,
}: {
  kind: TopKind
  name: string
  node: string
  /** The list's allow/block runner, so its busy rows and its alert slot are the list's. */
  action: ReturnType<typeof useDomainAction>
}) {
  const handoff = useHandoff()
  const key = `${kind}|${name}`
  const verb = kind === 'TopBlockedDomains' ? 'Allow Domain' : 'Block Domain'

  return (
    <Menu label={`Actions for ${name}`}>
      {(close) => (
        <>
          <button
            type="button"
            onClick={() => {
              close()
              if (kind === 'TopClients') handoff?.showQueryLogs(null, name, node)
              else handoff?.showQueryLogs(name, null, node)
            }}
          >
            Show Query Logs
          </button>
          {kind !== 'TopClients' && (
            <>
              <button
                type="button"
                onClick={() => {
                  close()
                  handoff?.queryDnsServer(name, null, node)
                }}
              >
                Query DNS Server
              </button>
              <button
                type="button"
                disabled={action.isBusy(key)}
                onClick={() => {
                  close()
                  void action.run(key, verb, name)
                }}
              >
                {verb}
              </button>
            </>
          )}
        </>
      )}
    </Menu>
  )
}
