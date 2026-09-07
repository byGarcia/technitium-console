/*
Assembles the pilot-3 prompt with its contract inside it.

Same shape as `assemble-piloto-2-prompt.mjs` and for the same reason: the prompt
that goes to the design tool must carry the contract WHOLE. Summarising it is how
a control, a suffix or a paragraph of help stops coming back — and on a dense
form, where 5 000 characters of help are the surface, that is most of the screen.

The guards at the end are not decoration. Pilot 2 had a contract withdrawn
mid-flight and the danger was that the retired file got assembled in by mistake;
here the equivalent risk is shipping a prompt or contract whose stated figures
no longer match the evidence. They are checked separately: a correct number in
the annex cannot hide a wrong one in the prompt. If the evidence changes and
either document is not regenerated, assembly fails.
*/
import { readFileSync, writeFileSync } from 'node:fs'

const here = (path) => new URL(path, import.meta.url)
const prompt = readFileSync(here('../docs/prompts/piloto-3-general.md'), 'utf8').trim()
const contrato = readFileSync(here('../docs/direction/piloto-3-contrato-general.md'), 'utf8').trim()
const evidencia = JSON.parse(readFileSync(here('../docs/direction/evidencia/general-dom.json'), 'utf8'))

const ctl = evidencia.secciones.flatMap((s) => s.ctl)
const listas = evidencia.secciones.flatMap((s) => s.listas)
const cifras = {
  controles: ctl.length,
  ayudas: ctl.length + listas.length,
  sufijos: ctl.filter((c) => c.suf).length,
  avisos: evidencia.secciones.flatMap((s) => s.av).length,
  secciones: evidencia.secciones.length,
}

const assembled = [prompt, '', '---', '', '# ANEXO — el contrato completo de `Settings › General`', '', contrato, ''].join('\n')

/* Las cifras que el prompt afirma tienen que ser las que el contrato trae. */
const esperadoEnPrompt = [
  [`| Controles | ${cifras.controles} |`, 'controles'],
  [`| Párrafos de ayuda | **${cifras.ayudas}**`, 'ayudas'],
  [`| Avisos \`Note!\` / \`Warning!\` | **${cifras.avisos}**`, 'avisos'],
  [`| Sufijos en línea | ${cifras.sufijos} |`, 'sufijos'],
  [`| Secciones | ${cifras.secciones} |`, 'secciones'],
  [`**${cifras.controles} controles comparables**`, 'las tres poblaciones'],
]
for (const [texto, que] of esperadoEnPrompt) {
  if (!prompt.includes(texto)) {
    throw new Error(`el prompt no coincide con la evidencia en «${que}»: falta ${JSON.stringify(texto)}`)
  }
}

const esperadoEnContrato = [
  [`Los **${cifras.controles} controles**`, 'controles'],
  [`Sus **${cifras.ayudas} ayudas**`, 'ayudas'],
  [`Los **${cifras.sufijos} sufijos**`, 'sufijos'],
  [`Los **${cifras.avisos} avisos**`, 'avisos'],
  [`Las **${cifras.secciones} secciones** y las **${listas.length} listas**`, 'secciones y listas'],
]
for (const [texto, que] of esperadoEnContrato) {
  if (!contrato.includes(texto)) {
    throw new Error(`el contrato no coincide con la evidencia en «${que}»: falta ${JSON.stringify(texto)}`)
  }
}

const target = here('../docs/prompts/piloto-3-general-ready.md')
writeFileSync(target, assembled)
console.log(`escrito docs/prompts/piloto-3-general-ready.md — ${assembled.split('\n').length} líneas`)
console.log(`cifras comprobadas contra la evidencia: ${JSON.stringify(cifras)}`)
