import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sso } from './Sso'
import * as client from '../../api/client'
import { SSO } from './admin.fixture'
import { optionsOf } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(overrides: Record<string, unknown> = {}, setResponse?: Record<string, unknown>) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'admin/sso/get') return ok({ response: { ...SSO, ...overrides }, server: 'x' })
    if (path === 'admin/sso/set') {
      // The `set` does NOT return `localGroups`: this is the literal response
      // of the reference instance.
      const { localGroups: _noGroups, ...rest } = { ...SSO, ...overrides }
      return ok({ response: setResponse ?? rest, server: 'x' })
    }
    return ok({ response: {}, server: 'x' })
  })
}

const props = { token: 'tok', onNotice: vi.fn() }

const body = (spy: ReturnType<typeof server>) =>
  spy.mock.calls.find((c) => c[0] === 'admin/sso/set')?.[1]?.body as Record<string, string>

describe('SSO — carga', () => {
  it('it draws the scopes the server brings and the two sign-up checkboxes', async () => {
    server()
    render(<Sso {...props} />)
    expect(await screen.findByLabelText('Scope Name 1')).toHaveValue('openid')
    expect(screen.getByLabelText('Scope Name 3')).toHaveValue('email')
    expect(screen.getByLabelText('Allow Sign Up Only For Mapped Users')).toBeChecked()
  })

  it('the null fields from the server are drawn empty, not as \"null\"', async () => {
    server()
    render(<Sso {...props} />)
    expect(await screen.findByLabelText('Authority (Issuer)')).toHaveValue('')
    expect(screen.getByLabelText('Client Secret')).toHaveValue('')
  })

  it('the stored secret arrives masked and is kept as it is', async () => {
    const spy = server({ ssoClientSecret: '************' })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    expect(await screen.findByLabelText('Client Secret')).toHaveValue('************')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(body(spy).ssoClientSecret).toBe('************')
  })
})

describe('SSO — validaciones', () => {
  it('with SSO off everything can be saved empty', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Authority (Issuer)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(body(spy).ssoEnabled).toBe('false')
  })

  it('with SSO on the order is authority, client and secret', async () => {
    const onNotice = vi.fn()
    const spy = server()
    const user = userEvent.setup()
    render(<Sso {...props} onNotice={onNotice} />)

    await user.click(await screen.findByLabelText('Enable Single Sign-On (SSO)'))
    const save = screen.getByRole('button', { name: 'Save Config' })

    await user.click(save)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the Authority URL.',
    })

    await user.type(screen.getByLabelText('Authority (Issuer)'), 'https://id.test')
    await user.click(save)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the Client ID.',
    })

    await user.type(screen.getByLabelText('Client ID'), 'technitium')
    await user.click(save)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the Client Secret.',
    })

    expect(spy.mock.calls.find((c) => c[0] === 'admin/sso/set')).toBeUndefined()
  })

  it('an empty scope aborts the save with the table alert', async () => {
    const onNotice = vi.fn()
    const spy = server()
    const user = userEvent.setup()
    render(<Sso {...props} onNotice={onNotice} />)

    // There are two "Add": the scopes one and the group map one. Upstream labels
    // both the same; the first is used here, which is the scopes one.
    await screen.findByLabelText('Scope Name 1')
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0])
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter a valid value in the text field in focus.',
    })
    expect(spy.mock.calls.find((c) => c[0] === 'admin/sso/set')).toBeUndefined()
  })

  it('a `|` in a scope aborts with its own alert', async () => {
    const onNotice = vi.fn()
    server()
    const user = userEvent.setup()
    render(<Sso {...props} onNotice={onNotice} />)

    await user.type(await screen.findByLabelText('Scope Name 1'), '|x')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Invalid Character!',
      text: "Please edit the value in the text field in focus to remove '|' character.",
    })
  })
})

describe('SSO — the send', () => {
  it('the scopes travel joined by `|`', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Scope Name 1')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(body(spy).ssoScopes).toBe('openid|profile|email')
  })

  it('an empty list travels as the string \"false\", not empty', async () => {
    const spy = server({ ssoScopes: [] })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Authority (Issuer)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(body(spy).ssoScopes).toBe('false')
    expect(body(spy).ssoGroupMap).toBe('false')
  })

  it('the group map travels with both columns per row', async () => {
    const spy = server({ ssoGroupMap: [{ remoteGroup: 'dns-admins', localGroup: 'Administrators' }] })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    expect(await screen.findByLabelText('Remote Group 1')).toHaveValue('dns-admins')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(body(spy).ssoGroupMap).toBe('dns-admins|Administrators')
  })

  it('it alerts with the upstream literal on saving', async () => {
    const onNotice = vi.fn()
    server()
    const user = userEvent.setup()
    render(<Sso {...props} onNotice={onNotice} />)

    await screen.findByLabelText('Authority (Issuer)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'success',
      title: 'SSO Config Saved!',
      text: 'Single Sign-On (SSO) config was saved successfully.',
    })
  })

  it('the save response does NOT bring the local groups and they are not lost', async () => {
    server({ ssoGroupMap: [{ remoteGroup: 'g', localGroup: 'Administrators' }] })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Remote Group 1')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(await optionsOf(user, await screen.findByLabelText('Local Group 1'))).toHaveLength(3)
  })
})

describe('SSO — the two `http:` confirmations', () => {
  it('an authority with `http:` asks for confirmation before saving', async () => {
    const spy = server({ ssoAuthority: 'http://id.test' })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Authority (Issuer)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(
      screen.getByText(
        "WARNING! The SSO Authority must use a 'https' URL scheme for production environment. Are you sure you want to proceed with using a 'http' URL scheme?",
      ),
    ).toBeInTheDocument()
    expect(spy.mock.calls.find((c) => c[0] === 'admin/sso/set')).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(body(spy).ssoAuthority).toBe('http://id.test')
  })

  it('cancelling the confirmation sends nothing', async () => {
    const spy = server({ ssoAuthority: 'http://id.test' })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Authority (Issuer)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(spy.mock.calls.find((c) => c[0] === 'admin/sso/set')).toBeUndefined()
  })

  it('the Metadata Address one is the second and has its own text', async () => {
    const spy = server({ ssoMetadataAddress: 'http://id.test/.well-known/openid-configuration' })
    const user = userEvent.setup()
    render(<Sso {...props} />)

    await screen.findByLabelText('Metadata Address (Optional)')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(
      screen.getByText(
        "WARNING! The Metadata Address must use a 'https' URL scheme for production environment. Are you sure you want to proceed with using a 'http' URL scheme?",
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(body(spy)).toBeTruthy()
  })
})

/*
Phase 3's shape, and the reason each of these is a test: three of the four things
this round moved on this screen are invisible in a screenshot of one width.
*/
describe('SSO — pilot 3 dense form', () => {
  it('is four blocks, and their four titles are upstream own labels', async () => {
    server()
    render(<Sso {...props} />)
    await screen.findByLabelText('Authority (Issuer)')
    for (const title of ['SSO User Sign Up', 'Scopes', 'Group Map (Optional)']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    /* Once: the first block's title. It used to be twice —the screen title said
       it too— and since 2026-09-07 the screen title is the section, `Administration`,
       with `SSO` in the bar underneath. Upstream's literal is still on the screen,
       which is what has to hold. */
    expect(screen.getAllByText('Single Sign-On (SSO)')).toHaveLength(1)
  })

  it('the two `Warning!` come BEFORE the first control, and the `Note!` after', async () => {
    server()
    render(<Sso {...props} />)
    const first = await screen.findByLabelText('Enable Single Sign-On (SSO)')
    const alerts = [...document.querySelectorAll('[role="alert"]')]
    const warnings = alerts.filter((a) => /Warning!/.test(a.textContent ?? ''))
    const notes = alerts.filter((a) => /Note!/.test(a.textContent ?? ''))
    expect(warnings).toHaveLength(2)
    expect(notes).toHaveLength(8)
    for (const w of warnings) {
      expect(w.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const n of notes) {
      expect(n.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    }
  })

  /*
  No index, and it is a decision with a measurement behind it: in a column it took
  188 px off the control column and left the console's dense form with two
  geometries, `210px 354px 360px` here against `210px 542px 360px` in Settings.
  Settings is the same archetype and is already built without one. See the note
  beside `SECTIONS` in `Sso.tsx`.
  */
  it('does not carry a section index, which would give the dense form two widths', async () => {
    server()
    render(<Sso {...props} />)
    await screen.findByLabelText('Authority (Issuer)')
    expect(screen.queryByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument()
    /* The four blocks keep their anchors: they are still places you can link to. */
    expect(document.getElementById('sso-scopes')).not.toBeNull()
  })

  /*
  These two are upstream literals that `dev/censo-ayudas.mjs` does not see —they
  carry markup and travel as JSX children rather than as a `help=` prop— so the
  round's count of 27 is really 29. The delivery retired them from the drawing for
  that reason, which was right for a drawing that cannot read the source; dropping
  them from the product would be losing two helps.
  */
  it('keeps the two helps the census does not count', async () => {
    server()
    render(<Sso {...props} />)
    await screen.findByLabelText('Authority (Issuer)')
    expect(
      screen.getByText(/Enter the scopes to be sent to the Single Sign-On \(SSO\) provider/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Map Remote Groups at Single Sign-On \(SSO\) provider to Local Groups/),
    ).toBeInTheDocument()
  })

  it('has no cluster node selector, nor a gap where one would go', async () => {
    server()
    render(<Sso {...props} />)
    await screen.findByLabelText('Authority (Issuer)')
    expect(screen.queryByLabelText('Cluster Node')).not.toBeInTheDocument()
  })
})
