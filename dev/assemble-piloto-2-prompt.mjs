import { readFileSync, writeFileSync } from 'node:fs'

const here = (path) => new URL(path, import.meta.url)
const prompt = readFileSync(here('../docs/prompts/piloto-2-zones.md'), 'utf8').trim()
const zones = readFileSync(here('../docs/direction/piloto-2-contrato-zones.md'), 'utf8').trim()
const dialogs = readFileSync(here('../docs/direction/piloto-2-dialogos.md'), 'utf8').trim()

const assembled = [
  prompt,
  '',
  '---',
  '',
  '# ANEXO A — contrato completo de lista y registros',
  '',
  zones,
  '',
  '---',
  '',
  '# ANEXO B — contrato completo de diálogos',
  '',
  dialogs,
  '',
].join('\n')

const forbidden = ['PENDIENTE', '⛔ NO USAR', 'piloto-2-contratos-dialogos.md']
for (const text of forbidden) {
  if (assembled.includes(text)) throw new Error(`prompt ensamblado contiene texto retirado: ${text}`)
}

const target = here('../docs/prompts/piloto-2-zones-ready.md')
writeFileSync(target, assembled)
console.log('escrito docs/prompts/piloto-2-zones-ready.md')
