import { describe, expect, it } from 'vitest'
import {
  buildRecordBody,
  formFromRecord,
  emptyForm,
  serializeSvcParams,
  RECORD_TYPES,
  type RecordContext,
  type RecordForm,
} from './record-form'
import type { ResourceRecord } from '../../api/records'

function rec(type: string, rData: Record<string, unknown>, extra: Partial<ResourceRecord> = {}): ResourceRecord {
  return {
    name: 'www.casa.test',
    type,
    ttl: 3600,
    ttlString: '1h',
    disabled: false,
    rData,
    dnssecStatus: 'Unknown',
    lastUsedOn: '0001-01-01T00:00:00',
    lastModified: '2026-08-26T10:00:00Z',
    expiryTtl: 0,
    expiryTtlString: '',
    ...extra,
  }
}

function form(changes: Partial<RecordForm>): RecordForm {
  return { ...emptyForm(), ...changes }
}

const ADD: RecordContext = { zone: 'casa.test', mode: 'add', updateSvcbHints: false }

function body(f: RecordForm, ctx: RecordContext = ADD) {
  const r = buildRecordBody(f, ctx)
  if ('error' in r) throw new Error(`expected a body, got the alert: ${r.error.text}`)
  return r.body
}

function error(f: RecordForm, ctx: RecordContext = ADD) {
  const r = buildRecordBody(f, ctx)
  if ('body' in r) throw new Error('expected an alert and got a body')
  return r.error
}

describe('the 23 types of the dropdown', () => {
  it('they are in the order of upstream', () => {
    expect(RECORD_TYPES).toHaveLength(23)
    expect(RECORD_TYPES[0]).toBe('A')
    expect(RECORD_TYPES[2]).toBe('SOA')
    expect(RECORD_TYPES[RECORD_TYPES.length - 1]).toBe('Unknown')
  })
})

describe('add: literal alert texts', () => {
  it('A with no address', () => {
    expect(error(form({ type: 'A', name: 'www' })).text).toBe(
      'Please enter an IP address to add the record.',
    )
  })

  it('CNAME at the apex explains the ANAME business', () => {
    expect(error(form({ type: 'CNAME', name: '@' })).text).toBe(
      "Please enter a name for the CNAME record since DNS protocol does not allow CNAME at zone's apex. If you need CNAME like function at the zone's apex then use ANAME record instead.",
    )
  })

  it('SRV asks for a name with service and protocol before anything else', () => {
    const e = error(form({ type: 'SRV', name: '' }))
    expect(e.text).toBe('Please enter a name that includes service and protocol labels.')
    expect(e.field).toBe('name')
  })

  it('the validation order of SRV is priority, weight, port and target', () => {
    const base = { type: 'SRV', name: '_s._tcp' }
    expect(error(form(base)).field).toBe('srvPriority')
    expect(error(form({ ...base, srvPriority: '1' })).field).toBe('srvWeight')
    expect(error(form({ ...base, srvPriority: '1', srvWeight: '2' })).field).toBe('srvPort')
    expect(error(form({ ...base, srvPriority: '1', srvWeight: '2', srvPort: '443' })).field).toBe(
      'srvTarget',
    )
  })

  it('an unknown type says \"to add record\", with no article', () => {
    expect(error(form({ type: 'Unknown', unknownType: 'TYPE65280' })).text).toBe(
      'Please enter a hex value as the RDATA to add record.',
    )
  })

  it('the \"resoure\" typo of upstream is kept', () => {
    expect(error(form({ type: 'Unknown' })).text).toBe(
      'Please enter a resoure record name or number to add record.',
    )
  })
})

describe('add: values that fall to a default instead of erroring', () => {
  it('MX with no preference sends 1', () => {
    expect(body(form({ type: 'MX', name: 'x', mxExchange: 'mail.casa.test' })).preference).toBe('1')
  })

  it('CAA with no flags and no tag sends 0 and \"issue\"', () => {
    const b = body(form({ type: 'CAA', name: 'x', caaValue: 'letsencrypt.org' }))
    expect(b.flags).toBe('0')
    expect(b.tag).toBe('issue')
  })

  it('RP with both fields empty sends the root', () => {
    const b = body(form({ type: 'RP', name: 'x' }))
    expect(b.mailbox).toBe('.')
    expect(b.txtDomain).toBe('.')
  })
})

describe('add: the body', () => {
  it('carries zone, domain, type, ttl, overwrite, comments and expiryTtl', () => {
    const b = body(form({ type: 'A', name: 'www', value: '10.0.0.1', ttl: '600', overwrite: true }))
    expect(b).toMatchObject({
      zone: 'casa.test',
      domain: 'www.casa.test',
      type: 'A',
      ttl: '600',
      overwrite: 'true',
      ipAddress: '10.0.0.1',
    })
    // Adding does NOT send `disable` or `newDomain`.
    expect(b).not.toHaveProperty('disable')
    expect(b).not.toHaveProperty('newDomain')
  })

  it('an empty name is the apex', () => {
    expect(body(form({ type: 'A', name: '', value: '10.0.0.1' })).domain).toBe('casa.test')
  })

  it('TLSA with \"Full\" requires a complete PEM, but only when adding', () => {
    const f = form({
      type: 'TLSA',
      name: '_443._tcp',
      tlsaCertificateUsage: 'DANE-EE',
      tlsaSelector: 'Cert',
      tlsaMatchingType: 'Full',
      tlsaCertificateAssociationData: 'ABCD',
    })
    expect(error(f).text).toBe(
      'Please enter a complete certificate in PEM format as the Certificate Association Data to add the record.',
    )

  // While editing, that same value passes.
    const original = rec('TLSA', {
      certificateUsage: 'DANE-EE',
      selector: 'Cert',
      matchingType: 'Full',
      certificateAssociationData: 'OLD',
    })
    const ctx: RecordContext = { zone: 'casa.test', mode: 'update', original, updateSvcbHints: false }
    expect(body(f, ctx)).toMatchObject({ newTlsaCertificateAssociationData: 'ABCD' })
  })

  it('APP requires name and class when adding', () => {
    expect(error(form({ type: 'APP', name: 'x' })).text).toBe(
      'Please select an application name to add record.',
    )
  })
})

describe('edit: sends the old value AND the new one', () => {
  const ctxOf = (original: ResourceRecord): RecordContext => ({
    zone: 'casa.test',
    mode: 'update',
    original,
    updateSvcbHints: false,
  })

  it('A: old ipAddress and new newIpAddress', () => {
    const original = rec('A', { ipAddress: '10.0.0.1' })
    const b = body(form({ type: 'A', name: 'www', value: '10.0.0.2' }), ctxOf(original))
    expect(b).toMatchObject({
      ipAddress: '10.0.0.1',
      newIpAddress: '10.0.0.2',
      domain: 'www.casa.test',
      newDomain: 'www.casa.test',
      disable: 'false',
    })
  })

  it('CNAME and DNAME do NOT send the old one: only the new value', () => {
    const original = rec('CNAME', { cname: 'old.casa.test' })
    const b = body(form({ type: 'CNAME', name: 'ali', value: 'new.casa.test' }), ctxOf(original))
    expect(b.cname).toBe('new.casa.test')
    expect(b).not.toHaveProperty('newCname')
  })

  it('TXT identifies by the base64 strings, not by the text', () => {
    const original = rec('TXT', { text: 'old', characterStringsBase64: ['b2xk'] })
    const b = body(form({ type: 'TXT', name: 'x', txt: 'new' }), ctxOf(original))
    expect(b).toMatchObject({
      characterStringsBase64: 'b2xk',
      newText: 'new',
      newSplitText: 'false',
    })
  })

  it('NAPTR: an empty replacement falls to the root ONLY when editing', () => {
    const original = rec('NAPTR', {
      order: 1, preference: 2, flags: 'U', services: 'x', regexp: 'y', replacement: '.',
    })
    const f = form({ type: 'NAPTR', name: 'x', naptrOrder: '1', naptrPreference: '2' })
    expect(body(f, ctxOf(original)).naptrNewReplacement).toBe('.')
    // When adding, it is sent empty.
    expect(body(f).naptrReplacement).toBe('')
  })

  it('the edit resends the state the record had, it does not change it', () => {
    const original = rec('A', { ipAddress: '10.0.0.1' }, { disabled: true })
    expect(body(form({ type: 'A', name: 'www', value: '10.0.0.2' }), ctxOf(original)).disable).toBe(
      'true',
    )
  })

  it('APP when editing does not validate and takes the app and class from the record', () => {
    const original = rec('APP', { appName: 'Split Horizon', classPath: 'X.App', data: 'old' })
    const b = body(form({ type: 'APP', name: 'x', recordData: 'new' }), ctxOf(original))
    expect(b).toMatchObject({ appName: 'Split Horizon', classPath: 'X.App', recordData: 'new' })
  })

  it('FWD when editing: without \"this-server\" it sends the proxy; with it, no', () => {
    const original = rec('FWD', {
      protocol: 'Udp', forwarder: '1.1.1.1', priority: 1, dnssecValidation: false, proxyType: 'DefaultProxy',
    })
    const withProxy = body(form({ type: 'FWD', name: 'x', forwarder: '8.8.8.8' }), ctxOf(original))
    expect(withProxy).toHaveProperty('proxyType')

    const thisServer = body(
      form({ type: 'FWD', name: 'x', forwarder: 'this-server' }),
      ctxOf(original),
    )
    expect(thisServer).not.toHaveProperty('proxyType')
  })

  it('the alert says \"to update the record\"', () => {
    const original = rec('A', { ipAddress: '10.0.0.1' })
    expect(error(form({ type: 'A', name: 'www' }), ctxOf(original)).text).toBe(
      'Please enter an IP address to update the record.',
    )
  })

  it('the alert of an unknown type DOES carry the article when editing', () => {
    const original = rec('TYPE65280', { value: 'ABCD' })
    expect(error(form({ type: 'Unknown', unknownType: 'TYPE65280' }), ctxOf(original)).text).toBe(
      'Please enter a hex value as the RDATA to update the record.',
    )
  })
})

describe('SOA: it is only edited, and validates seven fields in order', () => {
  const original = rec('SOA', {})
  const ctx: RecordContext = { zone: 'casa.test', mode: 'update', original, updateSvcbHints: false }

  it('the order is primary, responsible, serial, refresh, retry, expire and minimum', () => {
    const fields = [
      'soaPrimaryNameServer',
      'soaResponsiblePerson',
      'soaSerial',
      'soaRefresh',
      'soaRetry',
      'soaExpire',
      'soaMinimum',
    ] as const

    const accumulated: Partial<RecordForm> = { type: 'SOA', name: '@' }
    for (const field of fields) {
      expect(error(form(accumulated), ctx).field).toBe(field)
      accumulated[field] = 'x'
    }
  })
})

describe('parameters of an SVCB', () => {
  it('they flatten as key|value', () => {
    const r = serializeSvcParams([
      { key: 'alpn', value: 'h2' },
      { key: 'port', value: '443' },
    ])
    expect(r).toEqual({ value: 'alpn|h2|port|443' })
  })

  it('an empty list travels as the string \"false\"', () => {
    expect(serializeSvcParams([])).toEqual({ value: 'false' })
  })

  it('an empty KEY is an alert, not a row that gets ignored', () => {
    const r = serializeSvcParams([{ key: '', value: 'h2' }])
    expect(r).toEqual({
      error: expect.objectContaining({
        text: 'Please enter a valid value in the text field in focus.',
      }),
    })
  })

  it('a vertical bar inside a cell too', () => {
    const r = serializeSvcParams([{ key: 'alpn', value: 'h2|h3' }])
    expect(r).toEqual({
      error: expect.objectContaining({
        text: "Please edit the value in the text field in focus to remove '|' character.",
      }),
    })
  })
})

describe('filling the form from a record', () => {
  it('the name is shown relative to the zone', () => {
    expect(formFromRecord(rec('A', { ipAddress: '1.1.1.1' }), 'casa.test').name).toBe('www')
  })

  it('the apex is shown as @', () => {
    const r = rec('SOA', {}, { name: 'casa.test' })
    expect(formFromRecord(r, 'casa.test').name).toBe('@')
  })

  it('an SVCB with an empty target is shown as the root', () => {
    const r = rec('SVCB', { svcPriority: 1, svcTargetName: '', svcParams: { alpn: 'h2' } })
    const f = formFromRecord(r, 'casa.test')
    expect(f.svcbTargetName).toBe('.')
    expect(f.svcbParams).toEqual([{ key: 'alpn', value: 'h2', custom: false }])
  })

  it('the glue of an NS is shown one address per line', () => {
    const r = rec('NS', { nameServer: 'ns1' }, { glueRecords: ['10.0.0.1', '10.0.0.2'] })
    expect(formFromRecord(r, 'casa.test').nsGlue).toBe('10.0.0.1\n10.0.0.2')
  })
})

import {
  formForType,
  namePlaceholder,
  ttlDefault,
  toggleForwarderThisServer,
  recordDataTemplate,
  SVCB_KEYS,
} from './record-form'

const DEFAULTS = { defaultRecordTtl: 3600, defaultNsRecordTtl: 14400, defaultSoaRecordTtl: 900, dnssecValidation: true }

/* `modifyAddRecordFormByType` (zone.js:4567-4796). */
describe('changing the record type', () => {
  it('empties the TTL so the server applies its default, and keeps name, comments and expiry', () => {
    const prev = { ...emptyForm(), name: 'www', ttl: '600', comments: 'c', expiryTtl: '60', value: '10.0.0.1' }
    const f = formForType(prev, 'CNAME', DEFAULTS)
    expect(f).toMatchObject({ type: 'CNAME', name: 'www', ttl: '', comments: 'c', expiryTtl: '60', value: '' })
  })

  it('a new form starts with an empty TTL, not 3600', () => {
    expect(emptyForm().ttl).toBe('')
  })

  it('clears what the previous type had typed', () => {
    const prev = { ...emptyForm(), type: 'A', value: '10.0.0.1', ptr: true, createPtrZone: true }
    expect(formForType(prev, 'AAAA', DEFAULTS)).toMatchObject({ value: '', ptr: false, createPtrZone: false })
  })

  it('FWD: TTL 0, UDP, no "This Server", DNSSEC validation as the server, default proxy', () => {
    const prev = { ...emptyForm(), forwarderProtocol: 'Https', forwarder: 'x', proxyType: 'Socks5', proxyAddress: 'p' }
    expect(formForType(prev, 'FWD', DEFAULTS)).toMatchObject({
      ttl: '0',
      forwarderProtocol: 'Udp',
      forwarderThisServer: false,
      forwarder: '',
      forwarderPriority: '',
      forwarderDnssecValidation: true,
      proxyType: 'DefaultProxy',
      proxyAddress: '',
    })
    expect(formForType(prev, 'FWD', { ...DEFAULTS, dnssecValidation: false }).forwarderDnssecValidation).toBe(false)
  })

  it('the TTL placeholder is the server default for the type', () => {
    expect(ttlDefault('A', DEFAULTS)).toBe('3600')
    expect(ttlDefault('NS', DEFAULTS)).toBe('14400')
    expect(ttlDefault('SOA', DEFAULTS)).toBe('900')
  })

  it('the Name placeholder follows the type', () => {
    expect(namePlaceholder('A')).toBe('@')
    expect(namePlaceholder('SRV')).toBe('_service._protocol.name')
    expect(namePlaceholder('TLSA')).toBe('_port._protocol.name')
    expect(namePlaceholder('SVCB')).toBe('_port._scheme.name')
    expect(namePlaceholder('HTTPS')).toBe('_port._scheme.name')
  })
})

/* `updateAddEditFormForwarderThisServer` (zone.js:5336-5356). */
describe('FWD: Use "This Server"', () => {
  it('ticking it writes this-server and forces UDP', () => {
    const f = toggleForwarderThisServer({ ...emptyForm(), type: 'FWD', forwarder: '1.1.1.1', forwarderProtocol: 'Tls' }, true)
    expect(f).toMatchObject({ forwarderThisServer: true, forwarder: 'this-server', forwarderProtocol: 'Udp' })
  })

  it('unticking it empties the forwarder', () => {
    const f = toggleForwarderThisServer({ ...emptyForm(), type: 'FWD', forwarder: 'this-server', forwarderThisServer: true }, false)
    expect(f).toMatchObject({ forwarderThisServer: false, forwarder: '' })
  })

  it('an edited record whose forwarder is this-server comes back ticked', () => {
    const f = formFromRecord(rec('FWD', { protocol: 'Udp', forwarder: 'this-server', priority: 0 }), 'casa.test')
    expect(f.forwarderThisServer).toBe(true)
  })
})

/* zone.js:583-603: choosing a class path fills Record Data with its template. */
describe('APP: the record data template', () => {
  const apps = [
    {
      name: 'Split Horizon',
      dnsApps: [
        { classPath: 'SplitHorizon.SimpleAddress', recordDataTemplate: '{"public": []}', isAppRecordRequestHandler: true },
        { classPath: 'SplitHorizon.AddressTranslation', recordDataTemplate: null, isAppRecordRequestHandler: false },
      ],
    },
  ]

  it('is the template of the class chosen', () => {
    expect(recordDataTemplate(apps, 'Split Horizon', 'SplitHorizon.SimpleAddress')).toBe('{"public": []}')
  })

  it('is empty for a class with no template or none chosen', () => {
    expect(recordDataTemplate(apps, 'Split Horizon', 'SplitHorizon.AddressTranslation')).toBe('')
    expect(recordDataTemplate(apps, 'Split Horizon', '')).toBe('')
  })
})

/* addSvcbRecordParamEditRow (zone.js:5358-5395). */
describe('SVCB params', () => {
  it('offers upstream keys, in its order, then Unknown', () => {
    expect(SVCB_KEYS).toEqual(['mandatory', 'alpn', 'no-default-alpn', 'port', 'ipv4hint', 'ipv6hint', 'dohpath'])
  })

  it('a param with no value is valid: no-default-alpn has none', () => {
    expect(serializeSvcParams([{ key: 'no-default-alpn', value: '' }])).toEqual({ value: 'no-default-alpn|' })
  })

  it('a numeric key from the server comes back as an unknown key', () => {
    const f = formFromRecord(
      rec('SVCB', { svcPriority: 1, svcTargetName: '.', svcParams: { alpn: 'h2', '65000': 'ab' } }),
      'casa.test',
    )
    // Integer-like keys come first in a JS object, as in upstream's `for...in`.
    expect(f.svcbParams).toEqual([
      { key: '65000', value: 'ab', custom: true },
      { key: 'alpn', value: 'h2', custom: false },
    ])
  })
})
