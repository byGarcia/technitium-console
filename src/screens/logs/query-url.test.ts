import { describe, expect, it } from 'vitest'
import { filtersFromBar, queryParams, QUERY_PARAMS } from './query-url'
import { defaultFilters } from './QueryLogs'
import { toIso } from './dates'

const APPS = [
  { name: 'Query Logs (Sqlite)', classPaths: ['QueryLogsSqlite.App'] },
  { name: 'Query Logs (MySQL)', classPaths: ['QueryLogsMySql.App', 'Other.App'] },
]
const reset = defaultFilters('Query Logs (Sqlite)', 'QueryLogsSqlite.App')

describe('Query Logs in the address bar: writing', () => {
  it('writes nothing for the reset form on page 1', () => {
    const out = queryParams(reset, reset, 1)
    expect(Object.values(out).every((v) => v == null)).toBe(true)
    expect(Object.keys(out).sort()).toEqual([...QUERY_PARAMS].sort())
  })

  it('writes only what differs, by the name logs/query gives it, and the page past the first', () => {
    const sent = { ...reset, qname: '*.com', responseType: 'Blocked', descendingOrder: 'false', start: '2026-11-06T08:00' }
    expect(queryParams(sent, reset, 3)).toMatchObject({
      qname: '*.com',
      responseType: 'Blocked',
      descendingOrder: 'false',
      start: toIso('2026-11-06T08:00'),
      pageNumber: '3',
      name: null,
      rcode: null,
      end: null,
    })
  })
})

describe('Query Logs in the address bar: reading', () => {
  it('asks for nothing when the bar holds none of its parameters', () => {
    expect(filtersFromBar('', reset, APPS)).toBeNull()
    expect(filtersFromBar('?zone=x&qname=', reset, APPS)).toBeNull()
  })

  it('gives back the form a written query came from', () => {
    const sent = {
      ...reset,
      appName: 'Query Logs (MySQL)',
      classPath: 'Other.App',
      qname: 'example.com',
      qtype: 'AAAA',
      qclass: 'IN',
      clientIpAddress: '10.0.0.7',
      protocol: 'Tcp',
      responseType: 'Cached',
      rcode: 'NxDomain',
      descendingOrder: 'false',
      entriesPerPage: '100',
      start: '2026-11-06T08:00',
      end: '2026-11-06T08:59:59',
    }
    const params = queryParams(sent, reset, 2)
    const search = '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
    expect(filtersFromBar(search, reset, APPS)).toEqual({ ...sent, pageNumber: '2' })
  })

  it('drops what the form could not hold, and keeps the rest', () => {
    const f = filtersFromBar(
      '?name=Gone&classPath=Nope&pageNumber=-1&entriesPerPage=7&protocol=Carrier&responseType=x&rcode=y&qclass=Z&start=soon&qname=ok.example',
      reset,
      APPS,
    )
    expect(f).toEqual({ ...reset, qname: 'ok.example' })
  })

  it('a class is taken only from the app the bar names', () => {
    expect(filtersFromBar('?classPath=Other.App', reset, APPS)?.classPath).toBe('QueryLogsSqlite.App')
    expect(filtersFromBar('?name=Query+Logs+(MySQL)', reset, APPS)?.classPath).toBe('QueryLogsMySql.App')
  })
})
