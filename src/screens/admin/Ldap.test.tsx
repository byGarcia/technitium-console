import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Ldap } from './Ldap'
import * as client from '../../api/client'
import { LDAP } from './admin.fixture'
import { optionsOf } from '../../test/dropdown'

afterEach(() => vi.restoreAllMocks())

const ok = (data: unknown) => ({ kind: 'ok' as const, data })

function server(overrides: Record<string, unknown> = {}) {
  return vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) => {
    if (path === 'admin/ldap/get') return ok({ response: { ...LDAP, ...overrides }, server: 'x' })
    if (path === 'admin/ldap/set') {
      // The `set` does NOT return `localGroups`: the literal response of the
      // reference instance, v15.5.1.
      const { localGroups: _noGroups, ...rest } = { ...LDAP, ...overrides }
      return ok({ response: rest, server: 'x' })
    }
    if (path === 'admin/ldap/test') return ok({ server: 'x', status: 'ok' })
    return ok({ response: {}, server: 'x' })
  })
}

const props = { token: 'tok', onNotice: vi.fn() }

const sent = (spy: ReturnType<typeof server>, path = 'admin/ldap/set') =>
  spy.mock.calls.find((c) => c[0] === path)?.[1]?.body as Record<string, string> | undefined

const CONFIGURED = {
  ldapEnabled: true,
  ldapServer: 'dc1.example.com',
  ldapPort: 636,
  ldapSslOption: 'LDAPS',
  ldapBindUsername: 'CN=svcDNS,DC=example,DC=com',
  ldapBindPassword: '************',
  ldapSearchBase: 'DC=example,DC=com',
  ldapUserSearchFilter: '(sAMAccountName={0})',
  ldapGroupAttribute: 'memberOf',
}

describe('LDAP — load', () => {
  it('the five null strings of a fresh install are drawn empty, not as "null"', async () => {
    server()
    render(<Ldap {...props} />)
    expect(await screen.findByLabelText('LDAP Server')).toHaveValue('')
    expect(screen.getByLabelText('Bind Username')).toHaveValue('')
    expect(screen.getByLabelText('Bind Password')).toHaveValue('')
    expect(screen.getByLabelText('Search Base')).toHaveValue('')
    expect(screen.getByLabelText('User Search Filter')).toHaveValue('')
    expect(screen.getByLabelText('Group Attribute')).toHaveValue('')
    expect(screen.getByLabelText('Port')).toHaveValue(389)
    expect(screen.getByLabelText('None')).toBeChecked()
  })

  it('every field, placeholder and radio comes from the server', async () => {
    server(CONFIGURED)
    render(<Ldap {...props} />)
    expect(await screen.findByLabelText('Enable LDAP Authentication')).toBeChecked()
    expect(screen.getByLabelText('LDAP Server')).toHaveValue('dc1.example.com')
    expect(screen.getByLabelText('Port')).toHaveValue(636)
    expect(screen.getByLabelText('LDAPS')).toBeChecked()
    expect(screen.getByLabelText('Search Base')).toHaveValue('DC=example,DC=com')
    expect(screen.getByLabelText('LDAP Server')).toHaveAttribute('placeholder', 'ldap.example.com')
    expect(screen.getByLabelText('Port')).toHaveAttribute('placeholder', '389')
    expect(screen.getByLabelText('Bind Username')).toHaveAttribute(
      'placeholder',
      'CN=svcDNS,OU=ServiceAccounts,DC=example,DC=com',
    )
    expect(screen.getByLabelText('Bind Password')).toHaveAttribute('placeholder', 'service account password')
    expect(screen.getByLabelText('Search Base')).toHaveAttribute('placeholder', 'DC=example,DC=com')
    expect(screen.getByLabelText('User Search Filter')).toHaveAttribute('placeholder', '(sAMAccountName={0})')
    expect(screen.getByLabelText('Group Attribute')).toHaveAttribute('placeholder', 'memberOf')
  })

  it('the stored bind password arrives masked and is sent back as it is', async () => {
    const spy = server(CONFIGURED)
    const user = userEvent.setup()
    render(<Ldap {...props} />)
    expect(await screen.findByLabelText('Bind Password')).toHaveValue('************')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(sent(spy)?.ldapBindPassword).toBe('************')
  })

  it('an unknown SSL option checks None, and Ignore SSL follows the SERVER value (auth.js:2419-2424)', async () => {
    server({ ldapSslOption: 'Future' })
    render(<Ldap {...props} />)
    expect(await screen.findByLabelText('None')).toBeChecked()
    expect(screen.getByLabelText('Ignore SSL Certificate Errors')).toBeEnabled()
  })

  it('a failed load alerts on the page', async () => {
    const onNotice = vi.fn()
    vi.spyOn(client, 'apiRequest').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    render(<Ldap {...props} onNotice={onNotice} />)
    await vi.waitFor(() =>
      expect(onNotice).toHaveBeenCalledWith({ type: 'danger', title: 'Error!', text: 'Access was denied.' }),
    )
  })
})

describe('LDAP — enable rules, on load and on change', () => {
  it('Ignore SSL is disabled with None and enabled with StartTLS or LDAPS', async () => {
    server()
    const user = userEvent.setup()
    render(<Ldap {...props} />)
    const ignore = await screen.findByLabelText('Ignore SSL Certificate Errors')
    expect(ignore).toBeDisabled()
    await user.click(screen.getByLabelText('StartTLS'))
    expect(ignore).toBeEnabled()
    await user.click(screen.getByLabelText('LDAPS'))
    expect(ignore).toBeEnabled()
    await user.click(screen.getByLabelText('None'))
    expect(ignore).toBeDisabled()
  })

  it('on load with LDAPS, Ignore SSL is enabled', async () => {
    server({ ldapSslOption: 'LDAPS', ldapIgnoreSslErrors: true })
    render(<Ldap {...props} />)
    const ignore = await screen.findByLabelText('Ignore SSL Certificate Errors')
    expect(ignore).toBeEnabled()
    expect(ignore).toBeChecked()
  })

  it('"Allow Sign Up Only For Mapped Users" is disabled while sign-up is off, and still checked', async () => {
    server()
    const user = userEvent.setup()
    render(<Ldap {...props} />)
    const onlyMapped = await screen.findByLabelText('Allow Sign Up Only For Mapped Users')
    expect(onlyMapped).toBeDisabled()
    expect(onlyMapped).toBeChecked()
    await user.click(screen.getByLabelText('Allow New User Sign Up'))
    expect(onlyMapped).toBeEnabled()
    await user.click(screen.getByLabelText('Allow New User Sign Up'))
    expect(onlyMapped).toBeDisabled()
  })

  it('on load with sign-up on, it is enabled', async () => {
    server({ ldapAllowSignup: true })
    render(<Ldap {...props} />)
    expect(await screen.findByLabelText('Allow Sign Up Only For Mapped Users')).toBeEnabled()
  })
})

describe('LDAP — save validation, in upstream order', () => {
  it('with LDAP off everything can be saved empty', async () => {
    const spy = server({ ldapPort: 389 })
    const user = userEvent.setup()
    render(<Ldap {...props} />)
    await user.clear(await screen.findByLabelText('Port'))
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(sent(spy)?.ldapEnabled).toBe('false')
    expect(sent(spy)?.ldapPort).toBe('')
  })

  it('with LDAP on: server, then port', async () => {
    const onNotice = vi.fn()
    const spy = server()
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await user.click(await screen.findByLabelText('Enable LDAP Authentication'))
    await user.clear(screen.getByLabelText('Port'))
    const save = screen.getByRole('button', { name: 'Save Config' })

    await user.click(save)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the LDAP Server address.',
    })

    await user.type(screen.getByLabelText('LDAP Server'), 'dc1.example.com')
    await user.click(save)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the LDAP Port.',
    })

    expect(sent(spy)).toBeUndefined()
  })

  it('then the group map: an empty remote group aborts with the table alert', async () => {
    const onNotice = vi.fn()
    const spy = server()
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Save Config' }))

    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter a valid value in the text field in focus.',
    })
    expect(sent(spy)).toBeUndefined()
  })

  it('the group map is checked BEFORE the Ignore SSL confirmation', async () => {
    const onNotice = vi.fn()
    server({ ...CONFIGURED, ldapIgnoreSslErrors: true })
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(onNotice).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Missing!' }))
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
  })
})

describe('LDAP — the Ignore SSL confirmation', () => {
  const TEXT =
    'WARNING! The Ignore SSL Certificate Errors option must not be enabled for production environment. \n\nAre you sure you want to proceed with ignoring SSL certificate errors?'

  it('with Ignore SSL on and SSL not None it asks, literally, before saving', async () => {
    const spy = server({ ...CONFIGURED, ldapIgnoreSslErrors: true })
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    // Line breaks included: the default normaliser would collapse them.
    expect(screen.getByText(TEXT, { normalizer: (t) => t })).toBeInTheDocument()
    expect(sent(spy)).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(sent(spy)?.ldapIgnoreSslErrors).toBe('true')
  })

  it('cancelling it sends nothing', async () => {
    const spy = server({ ...CONFIGURED, ldapIgnoreSslErrors: true })
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(sent(spy)).toBeUndefined()
  })

  it('with SSL None it does not ask, and the disabled box still travels as it is', async () => {
    const spy = server({ ldapIgnoreSslErrors: true, ldapSslOption: 'None' })
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
    expect(sent(spy)?.ldapIgnoreSslErrors).toBe('true')
    expect(sent(spy)?.ldapSslOption).toBe('None')
  })
})

describe('LDAP — the save', () => {
  it('sends the thirteen fields, with an empty group map as the string "false"', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(sent(spy)).toEqual({
      ldapEnabled: 'false',
      ldapServer: '',
      ldapPort: '389',
      ldapSslOption: 'None',
      ldapIgnoreSslErrors: 'false',
      ldapBindUsername: '',
      ldapBindPassword: '',
      ldapSearchBase: '',
      ldapUserSearchFilter: '',
      ldapGroupAttribute: '',
      ldapAllowSignup: 'false',
      ldapAllowSignupOnlyForMappedUsers: 'true',
      ldapGroupMap: 'false',
    })
    const call = spy.mock.calls.find((c) => c[0] === 'admin/ldap/set')
    expect(call?.[1]?.method).toBe('POST')
  })

  it('the group map travels with both columns per row, joined by `|`', async () => {
    const spy = server({
      ldapGroupMap: [
        { remoteGroup: 'DNS Admins', localGroup: 'Administrators' },
        { remoteGroup: 'DNS Ops', localGroup: 'DNS Administrators' },
      ],
    })
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    expect(await screen.findByLabelText('Remote Group (CN) 1')).toHaveValue('DNS Admins')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(sent(spy)?.ldapGroupMap).toBe('DNS Admins|Administrators|DNS Ops|DNS Administrators')
  })

  it('a new group map row starts on the first local group', async () => {
    const spy = server()
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByLabelText('Remote Group (CN) 1'), 'Ops')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(sent(spy)?.ldapGroupMap).toBe('Ops|Administrators')
  })

  it('it alerts with the upstream literal on saving', async () => {
    const onNotice = vi.fn()
    server()
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'success',
      title: 'LDAP Config Saved!',
      text: 'LDAP authentication config was saved successfully.',
    })
  })

  it('the save response does NOT bring the local groups and they are not lost', async () => {
    server({ ldapGroupMap: [{ remoteGroup: 'g', localGroup: 'Administrators' }] })
    const user = userEvent.setup()
    render(<Ldap {...props} />)

    await screen.findByLabelText('Remote Group (CN) 1')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(await optionsOf(user, await screen.findByLabelText('Local Group 1'))).toHaveLength(3)
  })

  it('a server error is shown on the page', async () => {
    const onNotice = vi.fn()
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'admin/ldap/set'
        ? { kind: 'error' as const, message: 'Access was denied.' }
        : ok({ response: LDAP, server: 'x' }),
    )
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Save Config' }))
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'danger',
      title: 'Error!',
      text: 'Access was denied.',
    })
  })
})

describe('LDAP — Test Connection', () => {
  it('validates server and port even with LDAP OFF (auth.js:2526-2541)', async () => {
    const onNotice = vi.fn()
    const spy = server()
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    const test = screen.getByRole('button', { name: 'Test Connection' })
    await user.click(test)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the LDAP Server address.',
    })

    await user.type(screen.getByLabelText('LDAP Server'), 'dc1.example.com')
    await user.clear(screen.getByLabelText('Port'))
    await user.click(test)
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'warning',
      title: 'Missing!',
      text: 'Please enter the LDAP Port.',
    })
    expect(sent(spy, 'admin/ldap/test')).toBeUndefined()
  })

  it('sends its nine fields, no group map and no confirmation, and alerts success', async () => {
    const onNotice = vi.fn()
    const spy = server({
      ...CONFIGURED,
      ldapIgnoreSslErrors: true,
      ldapGroupMap: [{ remoteGroup: '', localGroup: 'Administrators' }],
    })
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Test Connection' }))
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument()
    expect(sent(spy, 'admin/ldap/test')).toEqual({
      ldapServer: 'dc1.example.com',
      ldapPort: '636',
      ldapSslOption: 'LDAPS',
      ldapIgnoreSslErrors: 'true',
      ldapBindUsername: 'CN=svcDNS,DC=example,DC=com',
      ldapBindPassword: '************',
      ldapSearchBase: 'DC=example,DC=com',
      ldapUserSearchFilter: '(sAMAccountName={0})',
      ldapGroupAttribute: 'memberOf',
    })
    expect(spy.mock.calls.find((c) => c[0] === 'admin/ldap/test')?.[1]?.method).toBe('POST')
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'success',
      title: 'Test Successful!',
      text: 'LDAP connection test completed successfully.',
    })
  })

  it('a failed test shows the server message on the page', async () => {
    const onNotice = vi.fn()
    vi.spyOn(client, 'apiRequest').mockImplementation(async (path: string) =>
      path === 'admin/ldap/test'
        ? { kind: 'error' as const, message: 'LDAP Server is required for connection test.' }
        : ok({ response: { ...LDAP, ...CONFIGURED }, server: 'x' }),
    )
    const user = userEvent.setup()
    render(<Ldap {...props} onNotice={onNotice} />)

    await screen.findByLabelText('LDAP Server')
    await user.click(screen.getByRole('button', { name: 'Test Connection' }))
    expect(onNotice).toHaveBeenLastCalledWith({
      type: 'danger',
      title: 'Error!',
      text: 'LDAP Server is required for connection test.',
    })
  })
})

describe('LDAP — the dense form', () => {
  it('is three blocks titled with upstream labels, two `Warning!` before and seven `Note!` after', async () => {
    server()
    render(<Ldap {...props} />)
    const first = await screen.findByLabelText('Enable LDAP Authentication')
    for (const title of ['LDAP Authentication', 'LDAP User Sign Up', 'Group Map (Optional)']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    const alerts = [...document.querySelectorAll('[role="alert"]')]
    const warnings = alerts.filter((a) => /Warning!/.test(a.textContent ?? ''))
    const notes = alerts.filter((a) => /Note!/.test(a.textContent ?? ''))
    expect(warnings).toHaveLength(2)
    expect(notes).toHaveLength(7)
    for (const w of warnings) {
      expect(w.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    for (const n of notes) {
      expect(n.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    }
  })

  it('keeps the helps that carry markup', async () => {
    server()
    render(<Ldap {...props} />)
    await screen.findByLabelText('LDAP Server')
    expect(screen.getByText(/The LDAP search filter used to find the user\./)).toBeInTheDocument()
    expect(screen.getByText(/Map Remote Groups \(CN\) at directory service to Local Groups/)).toBeInTheDocument()
    expect(screen.getByText('(default 389 for plain LDAP/StartTLS; default 636 for LDAPS)')).toBeInTheDocument()
  })

  it('has no cluster node selector', async () => {
    server()
    render(<Ldap {...props} />)
    await screen.findByLabelText('LDAP Server')
    expect(screen.queryByLabelText('Cluster Node')).not.toBeInTheDocument()
  })
})
