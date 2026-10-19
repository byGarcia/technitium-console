import { afterEach, describe, expect, it } from 'vitest'
import { readPerPage, writePerPage } from './stored-per-page'

afterEach(() => localStorage.clear())

describe('stored per page', () => {
  it('reads back what was written', () => {
    writePerPage('optZonesPerPage', 50)
    expect(localStorage.getItem('optZonesPerPage')).toBe('50')
    expect(readPerPage('optZonesPerPage', [10, 25, 50], 10)).toBe(50)
  })

  it('falls back when nothing is stored or the value is not an option', () => {
    expect(readPerPage('optZonesPerPage', [10, 25, 50], 10)).toBe(10)
    localStorage.setItem('optZonesPerPage', '7')
    expect(readPerPage('optZonesPerPage', [10, 25, 50], 10)).toBe(10)
  })
})
