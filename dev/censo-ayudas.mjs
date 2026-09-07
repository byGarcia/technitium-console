/*
Saca las AYUDAS de una pantalla leyendo el fuente, enteras y sin abreviar.

Tercer hermano de `censo-dialogos.mjs` y `censo-tablas.mjs`, y el que corrige el
fallo más grave de los tres: el contrato de Administración se envió a diseño **sin
una sola ayuda**, cuando la sección tiene **29** —20 en `Cluster` y 9 en `SSO`—.

Y **29, no 27**: las dos últimas se encontraron el 2026-09-04, CONSTRUYENDO. Ver
la rama «hija de `.help`» más abajo.

Ese 27 tampoco salió a la primera. La primera versión de este censo dijo **25**
mirando sólo `help="…"`, y estaba mal por los dos lados: contaba dos `help={help}`
—el prop pasando por un componente local, que no es contenido— y **no veía cuatro
que viajan dentro de un array de tuplas** y se pasan en un `map`. Un `grep help=`
da 17 y 8; lo que hay es 20 y 7.

La regla del proyecto es «no se puede dejar caer una ayuda», y el contrato es lo
único que quien dibuja tiene: lo que no viaja en él, no vuelve. La entrega lo
demostró — al no encontrarlas en el contrato, dibujó ayuda **inventada** bajo los
campos de SSO («Turns on OpenID Connect sign-in for this server.» donde el producto
dice «Enable to allow Single Sign-On (SSO) with OpenID Connect (OIDC).»), y encima
la marcó como copiada del fuente.

Por qué un script y no una lista: son 27 textos de hasta doscientos caracteres.
Transcribirlos a mano es garantizar que uno se acorta, que es exactamente lo que
pasó con el segundo `Save Config`.

    node dev/censo-ayudas.mjs [directorio]      por defecto, src/screens/admin
*/
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POR_DEFECTO = 'src/screens/admin'

export function censarAyudas(directorio = POR_DEFECTO) {
  const ayudas = []
  for (const f of readdirSync(directorio).filter((n) => n.endsWith('.tsx') && !n.includes('.test.'))) {
    const s = readFileSync(join(directorio, f), 'utf8')
    /* La forma directa. */
    for (const m of s.matchAll(/help="([^"]+)"/g)) {
      ayudas.push({ fichero: f, texto: m[1], via: 'help=' })
    }
    /*
    Y las que NO llegan por `help="…"`, que es donde este censo se calló la primera
    vez. En `Cluster` hay cuatro que viajan dentro de un array de tuplas y se pasan
    en un `map`: `help=` no las ve, y el contrato salió sin ellas.

    No se intenta adivinar la forma —hay demasiadas—: se buscan **frases**. Una
    cadena larga que acaba en punto es, en este código, una ayuda o un texto de
    diálogo; las dos cosas son literales que no pueden perderse. Sobra alguna, y
    eso es lo correcto: **este censo prefiere señalar de más a callarse**.
    */
    for (const m of s.matchAll(/'([^'\\]{45,}?\.)'|"([^"\\]{45,}?\.)"/g)) {
      const texto = (m[1] ?? m[2]).trim()
      if (ayudas.some((a) => a.texto === texto)) continue
      if (!/ /.test(texto)) continue
      ayudas.push({ fichero: f, texto, via: 'frase suelta' })
    }
    /*
    Y la ayuda que NO es un prop: la que se escribe como HIJO de un elemento con
    clase `help`.

    Encontrada el 2026-09-04, construyendo Administración: `Sso.tsx` tiene DOS
    —las de `Scopes` y `Group Map (Optional)`— que este censo no veía, así que el
    contrato de la ronda dijo **27** cuando la sección tiene **29**. Las dos son
    literales de upstream, comprobadas contra la instancia `ref`, y llevan marcado
    (`<code>`, `<b>`), así que no son ni una cadena ni un `help=`.

    Y la consecuencia fue la de siempre: lo que no viaja en el contrato no vuelve.
    El dibujo las retiró marcándolas «ayuda no censada», que para un dibujo que no
    puede leer el fuente era lo correcto — pero el contrato es quien tenía que
    llevarlas.

    Es el tercer sitio por el que se escapa una ayuda, y los tres por lo mismo:
    mirar la SINTAXIS en vez del contenido. Aquí se busca la clase, se cierra la
    etiqueta contando `<` y `>` de primer nivel, y se quita el marcado.
    */
    for (const m of s.matchAll(/className=\{[A-Za-z]+\.help\}>/g)) {
      const inicio = m.index + m[0].length
      let k = inicio
      let d = 1
      while (k < s.length && d > 0) {
        if (s.startsWith('<div', k)) d += 1
        else if (s.startsWith('</div>', k)) d -= 1
        k += 1
      }
      const texto = s
        .slice(inicio, k - 1)
        .replace(/<[^>]*>/g, '')
        /* `{' '}` es un espacio y `{redirectUri}` es un valor: los dos se van, y
           lo que queda es la frase. */
        .replace(/\{[^{}]*\}/g, ' ')
        .replace(/&apos;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
      if (texto.length > 40 && !ayudas.some((a) => a.texto === texto)) {
        ayudas.push({ fichero: f, texto, via: 'hija de .help' })
      }
    }
    /*
    La ayuda con MARCADO dentro, recuperada como texto.

    `help={help}` es el prop pasando por un componente local y no es contenido.
    Cualquier otro `help={…}` sí lo es, y la primera versión de este censo se
    limitaba a CONTARLO: decía «+1 con marcado» y seguía. Eso dejaba una ayuda sin
    validar —la de `Allow Sign Up Only For Mapped Users`, de trescientos
    caracteres—, así que podía borrarse del contrato o del delta sin que nada
    saltara. Contar no es validar; es el mismo error que «contar no es nombrar».

    Se recupera cerrando la llave y quitando las etiquetas: lo único con marcado es
    un `<b>`, y el texto sale entero.
    */
    for (const m of s.matchAll(/help=\{(?!help\})/g)) {
      let d = 0
      let k = s.indexOf('{', m.index)
      const inicio = k
      while (k < s.length) {
        if (s[k] === '{') d += 1
        else if (s[k] === '}') { d -= 1; if (d === 0) break }
        k += 1
      }
      const texto = s.slice(inicio + 1, k).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      if (texto.length > 20) ayudas.push({ fichero: f, texto, via: 'help={} con marcado' })
    }
  }
  /*
  Dos grupos, y no uno.

  La primera versión los mezclaba y la cifra volvía a no significar nada: entre las
  «frases sueltas» caen también validaciones («Please enter a value for …»), avisos
  de éxito y cuerpos de alerta. **Son literales igual de intocables** —tampoco se
  parafrasean— pero no son ayuda, y un contrato que diga «36 ayudas» miente.

  Se separan por dónde estaban: bajo un campo, o sueltas.
  */
  const conTexto = ayudas.filter((a) => a.texto != null)
  const bajoCampo = conTexto.filter(
    (a) =>
      a.via === 'help=' ||
      a.via === 'help={} con marcado' ||
      a.via === 'hija de .help' ||
      /^The interval in seconds/.test(a.texto),
  )
  const otras = conTexto.filter((a) => !bajoCampo.includes(a))
  return { total: conTexto.length, ayudas: bajoCampo, otrasLiterales: otras }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const c = censarAyudas(process.argv[2] ?? POR_DEFECTO)
  let ultimo = ''
  console.log(`AYUDAS BAJO UN CAMPO: ${c.ayudas.length}`)
  for (const a of c.ayudas) {
    if (a.fichero !== ultimo) {
      console.log('')
      console.log(`== ${a.fichero}`)
      ultimo = a.fichero
    }
    console.log(`   ${a.texto}`)
  }
  console.log('')
  console.log(`OTRAS LITERALES LARGAS: ${c.otrasLiterales.length} — validaciones, avisos y cuerpos de alerta.`)
  console.log('Tampoco se parafrasean, pero no son ayuda:')
  for (const a of c.otrasLiterales) console.log(`   [${a.fichero}] ${a.texto.slice(0, 78)}`)
  console.log('')
  console.log(`ayudas ${c.ayudas.length} · otras ${c.otrasLiterales.length}` +
    (c.conMarcado > 0 ? ` · ${c.conMarcado} con marcado, a mirar a mano` : ''))
}

/*
Los SUFIJOS, que tampoco entraban en ningún grupo.

En esta sección no hay ni un `suffix="…"`: los cuatro que existen viajan como
tercer elemento de las tuplas del array `intervals` de `Cluster Options`. La
primera versión del comprobador no los miraba, así que podían borrarse del delta
sin que saltara nada — igual que la ayuda con marcado.

Se buscan por FORMA y no por posición: una cadena corta con «valid range» o
«default» dentro es un sufijo en este código. Si algún día se escriben con
`suffix=`, esto los sigue viendo.
*/
export function censarSufijos(directorio = POR_DEFECTO) {
  const sufijos = []
  for (const f of readdirSync(directorio).filter((n) => n.endsWith('.tsx') && !n.includes('.test.'))) {
    const s = readFileSync(join(directorio, f), 'utf8')
    /*
    Se captura la FRASE, y da igual cómo esté escrita.

    Dos intentos fallidos antes de esto, y los dos por mirar la sintaxis en vez del
    contenido. Emparejar comillas —`'…'|"…"`— se desalineaba dentro de un array y
    cazaba **uno de cuatro**. Abrirse desde el contenido hasta la comilla más
    cercana funcionaba para los cuatro del array y devolvía basura para el quinto,
    que **no es una cadena**: está escrito como texto JSX dentro de un `<span>`.

    Ese quinto —el de `Session Timeout`— no lo tenía ni el contrato. Capturar la
    frase entera es lo único que ve los dos casos.
    */
    for (const m of s.matchAll(/([A-Za-z]+ \(valid range[^)]*\))/g)) {
      const t = m[1].trim()
      if (sufijos.some((x) => x.texto === t)) continue
      sufijos.push({ fichero: f, texto: t })
    }
  }
  return sufijos
}
