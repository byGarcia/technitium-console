import { describe, expect, it } from 'vitest'
import { check, checkText, checkedFiles } from './check-language.mjs'

/*
The gate behind "everything is in English". It lives in `dev/` for the reason
`relative-paths.test.mjs` gives (`src/` compiles without node's types) and it runs
inside `npm test`, so the rule is checked wherever the suite is.
*/

/*
The Spanish this test feeds the checker. It is data, so it sits between the same
markers that keep the checker's own word lists out of the check.
*/
/* language-data:start */
const SAMPLE = {
  prose: 'Esta consola es una alternativa para el servidor.',
  quotedTitle: 'The section is called "Qué se refresca".',
  devComment: '// Comprueba los endpoints que la consola usa',
  shellComment: '# Copiado del repositorio vecino',
  yamlComment: '  # sin esto no arranca',
  printed: "console.log('== LÍNEA sobre el panel ==')",
  identifier: 'const filaVacia = 1',
  description: "it('una tabla vacía no aporta firma', () => {})",
  words: 'const W = /porque|cuando/',
  comment: '// porque sí',
  fileName: 'dev/prueba.mjs',
  /* And two lines that only look Spanish to a word list. */
  sine: 'const dH = 2 * Math.sqrt(c) * Math.sin(h / 2)',
  idn: 'An IDN such as `mañana.test` is shown decoded.',
}
/* language-data:end */
const START = '/* language-' + 'data:start */'
const END = '/* language-' + 'data:end */'

describe('language', () => {
  it('no Spanish in any tracked text file', () => {
    expect(check()).toEqual([])
  })

  it('reads the whole repository, not only src/', () => {
    const files = checkedFiles()
    for (const f of [
      'README.md',
      'CONVENTIONS.md',
      'install.sh',
      '.githooks/pre-commit',
      '.github/workflows/release.yml',
      'docker/Dockerfile',
      'docs/2026-09-07-installer-contract.md',
      'dev/uniformity.js',
      'dev/compose.yaml',
      'vite.config.ts',
      'src/app/sections.ts',
    ])
      expect(files).toContain(f)
  })

  it('leaves out only what is not ours to write, and binaries', () => {
    const files = checkedFiles()
    expect(files).not.toContain('package-lock.json')
    expect(files.some((f) => f.startsWith('public/json/'))).toBe(false)
    expect(files.some((f) => f.endsWith('real-sample.json'))).toBe(false)
    expect(files.some((f) => /\.(png|gif|ico|woff2)$/.test(f))).toBe(false)
  })

  it('finds Spanish prose in a Markdown file', () => {
    expect(checkText('README.md', `One line.\n${SAMPLE.prose}\n`)).toEqual([`README.md:2  Spanish in the text: ${SAMPLE.prose}`])
    expect(checkText('docs/x.md', SAMPLE.quotedTitle)).toHaveLength(1)
  })

  it('finds Spanish in a comment of a dev tool, a shell script and a workflow', () => {
    expect(checkText('dev/tool.mjs', `${SAMPLE.devComment}\nconst a = 1\n`)).toHaveLength(1)
    expect(checkText('install.sh', `${SAMPLE.shellComment}\nset -eu\n`)).toHaveLength(1)
    expect(checkText('.github/workflows/x.yml', `${SAMPLE.yamlComment}\n`)).toHaveLength(1)
  })

  it('reads what a dev tool prints, and leaves the strings of src/ alone', () => {
    const line = `${SAMPLE.printed}\n`
    expect(checkText('dev/tool.mjs', line)).toHaveLength(1)
    expect(checkText('src/x.ts', line)).toEqual([])
  })

  it('finds a Spanish identifier and a Spanish test description in dev/', () => {
    expect(checkText('dev/tool.mjs', `${SAMPLE.identifier}\n`)).toHaveLength(1)
    expect(checkText('dev/tool.test.mjs', `${SAMPLE.description}\n`).length).toBeGreaterThan(0)
  })

  it('does not take English for Spanish', () => {
    expect(checkText('README.md', 'Run `npm run lint:language` before the pull request.\n')).toEqual([])
    expect(checkText('tsconfig.json', '{ "target": "es2023", "lib": ["ES2023"] }\n')).toEqual([])
    expect(checkText('dev/colour.mjs', `${SAMPLE.sine}\n`)).toEqual([])
    expect(checkText('CONVENTIONS.md', 'Amber is not offered (Adrián\'s decision).\n')).toEqual([])
    expect(checkText('README.md', `${SAMPLE.idn}\n`)).toEqual([])
  })

  it('does not read the data between the markers, and only that', () => {
    const data = `${START}\n${SAMPLE.words}\n${END}\n`
    expect(checkText('dev/check-language.mjs', data)).toEqual([])
    expect(checkText('dev/check-language.mjs', `${data}${SAMPLE.comment}\n`)).toHaveLength(1)
  })

  it('flags a Spanish file name anywhere in the tree', () => {
    expect(checkText(SAMPLE.fileName, '')).toEqual([`${SAMPLE.fileName}  file name is not English`])
  })
})
