/*
Comprueba que un DELTA lleva dentro todo lo que promete.

Existe porque el delta de Administración prometía «las del anexo B» cuatro veces y
**no llevaba anexo B**: era el prompt ensamblado el que tenía anexos, no el delta.
Quien lee el delta no tiene el repositorio, así que una remisión a un fichero es un
agujero — y encima uno que parece que lleva a algo.

Es el mismo fallo que el delta venía a corregir, cometido al escribirlo: si no
viaja, no vuelve.

Qué exige:

  · Toda ayuda del fuente, ENTERA, dentro del delta — **incluida la que lleva
    marcado**, que la primera versión sólo CONTABA. Contar no es validar.
  · Todos los sufijos, que no entraban en ningún grupo y podían borrarse sin que
    nada saltara.
  · Toda literal larga que no es ayuda, igual.
  · Ninguna remisión a un anexo, capítulo o fichero que el lector no tiene.
  · Ninguna literal citada entre comillas angulares recortada con puntos
    suspensivos.

    node dev/comprueba-delta.mjs docs/prompts/administracion-retorno-delta.md
*/
import { readFileSync } from 'node:fs'
import { censarAyudas, censarSufijos } from './censo-ayudas.mjs'

const plano = (t) => t.replace(/\s+/g, ' ')

/*
Un delta es de uno de dos tipos, y no se les puede exigir lo mismo.

  · **aporta** — trae contenido que el dibujo no tenía: ayudas, sufijos, literales.
    Tiene que llevarlas TODAS y enteras, porque quien dibuja no tiene el fuente.
  · **quita** — sólo borra algo del dibujo. No necesita cargar con las 37 cadenas:
    ya están en la entrega, y el propio delta dice que no se tocan.

Exigirle a un delta sustractivo el anexo entero llevaría a rellenarlo con lo que no
hace falta — cuadrar la cifra en vez de decir la verdad, que es justo el vicio que
este comprobador existe para impedir.

El tipo **se declara** en el documento, no se adivina: un delta sin marca falla, que
es el fallo seguro.
*/
const TIPOS = { '<!-- delta: aporta -->': 'aporta', '<!-- delta: quita -->': 'quita' }

export function comprobarDelta(ruta, directorioFuente = 'src/screens/admin') {
  const texto = plano(readFileSync(ruta, 'utf8'))
  const censo = censarAyudas(directorioFuente)
  const sufijos = censarSufijos(directorioFuente)
  const fallos = []

  const bruto0 = readFileSync(ruta, 'utf8')
  const marcas = Object.keys(TIPOS).filter((m) => bruto0.includes(m))
  if (marcas.length !== 1) {
    return {
      fallos: [`el delta no declara su tipo: falta una de ${Object.keys(TIPOS).join(' o ')}`],
      ayudas: 0, sufijos: 0, otras: 0, tipo: null,
    }
  }
  const tipo = TIPOS[marcas[0]]

  for (const a of tipo === 'aporta' ? censo.ayudas : []) {
    if (!texto.includes(plano(a.texto))) {
      fallos.push(`falta una ayuda de ${a.fichero}, o está recortada: «${a.texto.slice(0, 56)}…»`)
    }
  }
  /*
  Los sufijos. Iban sueltos: no son ayuda ni literal larga —son cortos—, así que
  ninguno de los dos grupos los cubría y el comprobador daba verde con los cinco
  borrados.
  */
  for (const x of tipo === 'aporta' ? sufijos : []) {
    if (!texto.includes(plano(x.texto))) {
      fallos.push(`falta un sufijo de ${x.fichero}: «${x.texto}»`)
    }
  }
  for (const a of tipo === 'aporta' ? censo.otrasLiterales : []) {
    if (!texto.includes(plano(a.texto))) {
      fallos.push(`falta una literal de ${a.fichero}: «${a.texto.slice(0, 56)}…»`)
    }
  }

  /*
  Las remisiones. `anexo A/B/C` es la forma que usan los prompts ensamblados, y en
  un delta no existe ninguno: lo que promete tiene que estar dentro.
  */
  for (const m of readFileSync(ruta, 'utf8').matchAll(/anexo [ABC]\b/gi)) {
    fallos.push(`remite a un «${m[0]}» que no viaja con el delta`)
  }

  /*
  Y las CIFRAS que el delta afirma tienen que cuadrar con lo que lleva.

  Ésta faltaba, y es la tercera vez que muerde la misma clase: el delta llevaba los
  cinco sufijos y su encabezado seguía diciendo «los cuatro sufijos», más un punto
  que afirmaba ser «la única corrección que añade contenido» cuando eran dos. La
  comprobación anterior sólo miraba que los TEXTOS estuvieran; una instrucción
  desactualizada pasa por delante de eso sin despeinarse, y quien dibuja obedece la
  instrucción, no el anexo.

  Se buscan las cifras escritas en letra y en dígito, que es como están.
  */
  const enLetra = { cuatro: 4, cinco: 5, seis: 6, siete: 7, diez: 10, veintisiete: 27 }
  const bruto = readFileSync(ruta, 'utf8')
  const esperado = { ayudas: censo.ayudas.length, sufijos: sufijos.length, literales: censo.otrasLiterales.length }
  for (const [grupo, n] of Object.entries(esperado)) {
    const re = new RegExp(`(?:los|las)\\s+(\\d+|[a-zá-ú]+)\\s+${grupo}\\b`, 'gi')
    for (const m of bruto.matchAll(re)) {
      const dicho = /^\d+$/.test(m[1]) ? Number(m[1]) : enLetra[m[1].toLowerCase()]
      if (dicho == null) continue
      if (dicho !== n) fallos.push(`el delta dice «${m[0]}» y lleva ${n}`)
    }
  }

  /* Y ninguna literal citada puede ir con puntos suspensivos dentro. */
  for (const m of readFileSync(ruta, 'utf8').matchAll(/«([^»]*)»/g)) {
    if (m[1].includes('…')) fallos.push(`literal citada y recortada: «${m[1].slice(0, 56)}…»`)
  }

  return {
    fallos,
    tipo,
    ayudas: tipo === 'aporta' ? censo.ayudas.length : 0,
    sufijos: tipo === 'aporta' ? sufijos.length : 0,
    otras: tipo === 'aporta' ? censo.otrasLiterales.length : 0,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const ruta = process.argv[2]
  if (ruta == null) {
    console.error('uso: node dev/comprueba-delta.mjs <fichero del delta>')
    process.exit(2)
  }
  const r = comprobarDelta(ruta)
  if (r.fallos.length > 0) {
    console.error('DELTA INCOMPLETO:')
    for (const f of r.fallos) console.error(`  · ${f}`)
    process.exit(1)
  }
  if (r.tipo === 'quita') {
    console.log('Delta SUSTRACTIVO: no remite a nada, no cita nada recortado y sus cifras cuadran.')
  } else {
    console.log(
      `${r.ayudas} ayudas · ${r.sufijos} sufijos · ${r.otras} literales — todos enteros en el delta, y ninguna remisión.`,
    )
  }
}
