/*
Cuenta los diálogos de una pantalla LEYENDO EL FUENTE, y distingue tres cosas que
no son la misma.

Existe porque el contrato de Administración se escribió con una lista a mano y
falló tres veces seguidas: el encabezado decía «nueve» y enumeraba siete —faltaban
`Remove Node` y `Promote To Primary Node`—, y después faltaban también las dos
confirmaciones de SSO. Cada corrección movía un total que había que recalcular a
mano, y la siguiente lectura encontraba otro hueco.

Las tres cifras, y por qué hacen falta las tres:

  · **instancias JSX** — cuántos `<Confirm>` y `<Dialog>` hay escritos. Es lo que
    se toca al implementar.
  · **títulos distintos** — cuántos rótulos ve el usuario. Menos que instancias,
    porque hay títulos repetidos.
  · **superficies** — cuántos diálogos DISTINTOS hay que dibujar. Dos instancias
    con el mismo título pueden ser el mismo diálogo puesto en dos sitios, o dos
    diálogos distintos que comparten rótulo, y **eso cambia el encargo**:

      `Delete Session`  → mismo título, mismo texto, misma etiqueta: UNA superficie
                          montada desde `Sessions` y desde `UserDetails`.
      `Edit Node`       → mismo título, campos DISTINTOS: dos superficies.
      `Save Config`     → mismo título, textos DISTINTOS: dos superficies.

Se comparan por `title` + `text` + `label`, que es lo que el usuario lee. Dos
diálogos que dicen exactamente lo mismo son el mismo diálogo aunque estén escritos
dos veces.

    node dev/censo-dialogos.mjs [directorio]     por defecto, src/screens/admin
*/
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POR_DEFECTO = 'src/screens/admin'

const campo = (tramo, k) => {
  const m = new RegExp(`${k}=(?:"([^"]*)"|\\{\`([^\`]*)\`\\}|\\{([^}\\n]*)\\})`).exec(tramo)
  return m == null ? null : (m[1] ?? m[2] ?? m[3] ?? '').trim()
}

export function censar(directorio = POR_DEFECTO) {
  const instancias = []
  for (const f of readdirSync(directorio).filter((n) => n.endsWith('.tsx') && !n.includes('.test.'))) {
    const s = readFileSync(join(directorio, f), 'utf8')
    for (const m of s.matchAll(/<(Confirm|Dialog)\b/g)) {
      const tramo = s.slice(m.index, m.index + 900)
      instancias.push({
        fichero: f,
        linea: s.slice(0, m.index).split('\n').length,
        tipo: m[1],
        title: campo(tramo, 'title') ?? '(sin título)',
        text: campo(tramo, 'text'),
        label: campo(tramo, 'label'),
      })
    }
  }
  const titulos = new Set(instancias.map((i) => i.title))
  /* La superficie es la terna que el usuario lee. */
  const superficies = new Set(instancias.map((i) => `${i.title} ${i.text} ${i.label}`))
  const repetidos = [...titulos]
    .map((t) => ({ titulo: t, instancias: instancias.filter((i) => i.title === t) }))
    .filter((x) => x.instancias.length > 1)
    .map((x) => ({
      titulo: x.titulo,
      donde: x.instancias.map((i) => `${i.fichero}:${i.linea}`),
      /* Lo que decide si son una superficie o dos. */
      mismoDialogo: new Set(x.instancias.map((i) => `${i.text} ${i.label}`)).size === 1,
    }))
  return {
    instanciasJSX: instancias.length,
    titulos: titulos.size,
    superficies: superficies.size,
    repetidos,
    instancias,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const c = censar(process.argv[2] ?? POR_DEFECTO)
  console.log(`instancias JSX : ${c.instanciasJSX}`)
  console.log(`títulos        : ${c.titulos}`)
  console.log(`superficies    : ${c.superficies}`)
  console.log('')
  console.log('títulos repetidos:')
  for (const r of c.repetidos) {
    console.log(`  ${r.titulo}`)
    const veredicto = r.mismoDialogo ? 'MISMO diálogo en dos sitios' : 'DOS diálogos distintos'
    console.log(`     ${r.donde.join(' · ')}  ->  ${veredicto}`)
  }
}
