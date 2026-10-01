import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '../../api/zonelists'
import { AddDomainBar } from './AddDomainBar'

afterEach(() => vi.restoreAllMocks())

const OK = { kind: 'ok' as const, data: {} }
const P = (m: boolean) => ({ canView: true, canModify: m, canDelete: true })

function setup(permissions?: Parameters<typeof AddDomainBar>[0]['permissions']) {
  const onNotice = vi.fn()
  const onChanged = vi.fn()
  render(<AddDomainBar token="T" permissions={permissions} onNotice={onNotice} onChanged={onChanged} />)
  return { onNotice, onChanged, field: screen.getByLabelText('Domain') }
}

describe('AddDomainBar', () => {
  it('Enter blocks, as upstream form does, and clears the field', async () => {
    const add = vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const { onNotice, onChanged, field } = setup()
    await userEvent.type(field, 'ads.example.com{Enter}')
    expect(add).toHaveBeenCalledWith('blocked', 'T', 'ads.example.com')
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success', title: 'Blocked!', text: "Domain 'ads.example.com' was added to Blocked Zone successfully.",
    })
    expect(onChanged).toHaveBeenCalledWith('blocked', 'ads.example.com')
    expect(field).toHaveValue('')
  })

  it('Allow adds to Allowed with upstream sentence', async () => {
    const add = vi.spyOn(api, 'addDomain').mockResolvedValue(OK)
    const { onNotice, field } = setup()
    await userEvent.type(field, 's.youtube.com')
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }))
    expect(add).toHaveBeenCalledWith('allowed', 'T', 's.youtube.com')
    expect(onNotice).toHaveBeenCalledWith({
      type: 'success', title: 'Allowed!', text: "Domain 's.youtube.com' was added to Allowed Zone successfully.",
    })
  })

  it('an empty field warns before any call and keeps the focus', async () => {
    const add = vi.spyOn(api, 'addDomain')
    const { onNotice, field } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Block' }))
    expect(add).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({ type: 'warning', title: 'Missing!', text: 'Please enter a domain name to block.' })
    expect(field).toHaveFocus()
  })

  it('an empty field warns with the Allow sentence when Allow is pressed', async () => {
    const add = vi.spyOn(api, 'addDomain')
    const { onNotice, field } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }))
    expect(add).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({ type: 'warning', title: 'Missing!', text: 'Please enter a domain name to allow.' })
    expect(field).toHaveFocus()
  })

  it('a server error is reported and the field is kept', async () => {
    vi.spyOn(api, 'addDomain').mockResolvedValue({ kind: 'error', message: 'Access was denied.' })
    const { onNotice, field } = setup()
    await userEvent.type(field, 'x.test{Enter}')
    expect(onNotice).toHaveBeenCalledWith(expect.objectContaining({ type: 'danger', text: 'Access was denied.' }))
    expect(field).toHaveValue('x.test')
  })

  it('without Blocked.canModify, Block is disabled with its padlock and Allow still works', () => {
    setup({ Blocked: P(false), Allowed: P(true) })
    expect(screen.getByRole('button', { name: /Block/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Allow' })).toBeEnabled()
  })
})
