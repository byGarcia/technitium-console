/*
Cuenta las columnas de las tablas de una pantalla LEYENDO EL FUENTE.

Hermano de `censo-dialogos.mjs`, y nace del mismo fallo: el contrato de
Administración afirmaba **31 columnas** y esa cifra no contaba nada coherente.
Salía de sumar las cuatro colecciones —Sessions 6, Users 8, Groups 3, Cluster 9—
más las dos tablas anidadas de SSO, dejando fuera `Permissions` —que entonces no
era una `<table>` en el DOM— y `UserDetails`, que nunca se contó. Mezclaba dos
criterios: incluía unas tablas anidadas y otras no.

Lo destapó la entrega de diseño al intentar reproducir el número: hizo su
inventario, le dieron **30**, y en vez de cuadrarlo dijo que ninguna partición
honrada da 31. Tenía razón.

El total real es **41**, y con eso la cifra deja de ser una suma a mano:

    node dev/censo-tablas.mjs [directorio]      por defecto, src/screens/admin

Qué cuenta y qué no:

  · Cuenta **todas** las tablas del directorio, anidadas incluidas, porque todas
    tienen columnas que el usuario lee y que un rediseño puede perder.
  · Cuenta la columna **sin rótulo** —la de acciones, la de selección— porque es
    estructura: contar sólo las que llevan texto fue lo que en Zones hizo perder
    de vista dos columnas de diez.
  · No distingue tabla de nivel superior de tabla anidada, **y por eso da un
    número que se puede defender**: la distinción anterior era la que hacía que
    el número no significara nada.
*/
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const POR_DEFECTO = 'src/screens/admin'

export function censarTablas(directorio = POR_DEFECTO) {
  const porFichero = []
  for (const f of readdirSync(directorio).filter((n) => n.endsWith('.tsx') && !n.includes('.test.'))) {
    const s = readFileSync(join(directorio, f), 'utf8')
    const columnas = []
    /* `<Th>` es la cabecera ordenable del kit; `<th>` la simple; `<th />` la que
       no lleva rótulo —acciones o selección—, y ésa cuenta igual. */
    for (const m of s.matchAll(/<Th\b[^>]*>([^<]*)<\/Th>|<th\b[^>]*>([^<{]*)<\/th>|<th\b[^>]*\/>/g)) {
      const texto = (m[1] ?? m[2] ?? '').trim()
      columnas.push(texto === '' ? '(sin rótulo)' : texto)
    }
    if (columnas.length > 0) porFichero.push({ fichero: f, columnas })
  }
  return {
    total: porFichero.reduce((a, x) => a + x.columnas.length, 0),
    porFichero,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const c = censarTablas(process.argv[2] ?? POR_DEFECTO)
  for (const x of c.porFichero) {
    console.log(`${x.fichero.padEnd(18)} ${String(x.columnas.length).padStart(2)}  ${x.columnas.join(' · ')}`)
  }
  console.log('')
  console.log(`TOTAL: ${c.total} columnas`)
}
