import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../../api/zonelists'
import type { Notice } from '../../lib/notice'
import { AddDomainBar } from './AddDomainBar'
import type { Rule } from './rules-model'

afterEach(() => vi.restoreAllMocks())

const OK = { kind: 'ok' as const, data: {} }
const P = (d: boolean) => ({ canView: true, canModify: true, canDelete: d })

function setup(rules: Rule[] = [], permissions?: Parameters<typeof AddDomainBar>[0]['permissions']) {
  const notices: Notice[] = []
  const onChanged = vi.fn()
  render(
    <AddDomainBar
      token="T"
      permissions={permissions}
      onNotice={(n) => notices.push(n)}
      onChanged={onChanged}
      rules={rules}
    />,
  )
  return { notices, onChanged, field: screen.getByLabelText('Domain') }
}

describe('AddDomainBar: Undo on the result of a Block or an Allow', () => {
  it('Blocked! offers Undo, which deletes the rule just added and says so with upstream sentence', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const remove = vi.spyOn(api, 'deleteDomain').mockResolvedValue(OK)
    const { notices, onChanged, field } = setup()
    await userEvent.type(field, 'ads.example.com{Enter}')
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Blocked!'))
    const blocked = notices.at(-1)!
    expect(blocked.text).toBe("Domain 'ads.example.com' was added to Blocked Zone successfully.")
    expect(blocked.action?.label).toBe('Undo')
    expect(onChanged).toHaveBeenCalledTimes(1)

    blocked.action!.run()
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Deleted!'))
    expect(remove).toHaveBeenCalledWith('blocked', 'T', 'ads.example.com')
    expect(notices.at(-1)).toEqual({
      type: 'success',
      title: 'Deleted!',
      text: "Blocked zone 'ads.example.com' was deleted successfully.",
    })
    expect(onChanged).toHaveBeenCalledTimes(2)
  })

  it('Allowed! offers Undo, which deletes it from Allowed', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const remove = vi.spyOn(api, 'deleteDomain').mockResolvedValue(OK)
    const { notices, field } = setup()
    await userEvent.type(field, 's.youtube.com')
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }))
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Allowed!'))
    notices.at(-1)!.action!.run()
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Deleted!'))
    expect(remove).toHaveBeenCalledWith('allowed', 'T', 's.youtube.com')
    expect(notices.at(-1)?.text).toBe("Domain 's.youtube.com' was deleted from Allowed Zone successfully.")
  })

  it('no Undo when the name was already one of the rules of that list: Undo would delete it', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const { notices, field } = setup([{ domain: 'ads.example.com', list: 'blocked' }])
    await userEvent.type(field, 'ADS.example.com{Enter}')
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Blocked!'))
    expect(notices.at(-1)?.action).toBeUndefined()
  })

  it('no Undo while the rules are not known', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const a = setup(null as never)
    await userEvent.type(a.field, 'a.example.com{Enter}')
    await waitFor(() => expect(a.notices.at(-1)?.title).toBe('Blocked!'))
    expect(a.notices.at(-1)?.action).toBeUndefined()
  })

  it('no Undo without Delete on the list the rule went into', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const { notices, field } = setup([], { Blocked: P(false), Allowed: P(true) })
    await userEvent.type(field, 'b.example.com{Enter}')
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Blocked!'))
    expect(notices.at(-1)?.action).toBeUndefined()
  })

  it('an Undo the server refuses says why, with upstream error alert', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    vi.spyOn(api, 'deleteDomain').mockResolvedValue({ kind: 'error', message: 'Nope.' } as never)
    const { notices, field } = setup()
    await userEvent.type(field, 'c.example.com{Enter}')
    await waitFor(() => expect(notices.at(-1)?.title).toBe('Blocked!'))
    notices.at(-1)!.action!.run()
    await waitFor(() => expect(notices.at(-1)).toEqual({ type: 'danger', title: 'Error!', text: 'Nope.' }))
  })
})
