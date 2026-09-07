/*
Ensambla el prompt de la fase 3 —Dashboard + cromo + Login— con la dirección, el
contrato y la barra DENTRO.

Misma forma que los ensambladores de los pilotos 2 y 3, y por la misma razón: el
prompt que va a la herramienta de diseño tiene que llevar el contrato ENTERO.
Resumirlo es como un control, una ayuda o un párrafo deja de volver. Y aquí hay un
motivo extra: **Claude Design no ve el repositorio**, así que un `[enlace](ruta)`
no es una referencia, es un agujero.

Las guardas del final no son decoración. Comprueban que las cifras que el prompt
afirma siguen siendo las que dice la evidencia: si el volcado cambia y el prompt
no se regenera, el ensamblado **falla** en vez de mandar un número viejo.
*/
import { readFileSync, writeFileSync } from 'node:fs'

const here = (p) => new URL(p, import.meta.url)
const leer = (p) => readFileSync(here(p), 'utf8').trim()

const marco = leer('../docs/prompts/fase3-dashboard-cromo.md')
const direccion = leer('../DESIGN.md')
const contrato = leer('../docs/direction/fase3-contrato-dashboard-cromo.md')
const barra = leer('../docs/direction/fase3-barra-aceptacion-dashboard-cromo.md')
const ev = JSON.parse(readFileSync(here('../docs/direction/evidencia/dashboard-cromo-dump.json'), 'utf8'))

/*
Fuera los enlaces a rutas del repositorio. No es cosmético: Claude Design no tiene
el repositorio, así que un enlace es una referencia a la nada — y peor que
inservible, porque parece que hay algo detrás. Se deja el TEXTO del enlace, que
suele nombrar la cosa, y se quita el destino.

Las referencias `Fichero.tsx:142` NO se tocan: son procedencia, no destino, y el
prompt lo dice arriba.
*/
const sinRutas = (md) =>
  md
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, '$1')
    .replace(/^Volcado crudo en .*$/m, 'El volcado crudo está en el repositorio; lo que hace falta va abajo, entero.')
    .replace(/^Referencia: .*$/m, '')

const cifras = {
  regiones: ev.dashboard.regions.length,
  tarjetas: ev.dashboard.overview.cards.length,
  counters: ev.dashboard.overview.counters.length,
  graficas: ev.dashboard.overview.charts.length,
  topN: ev.dashboard.overview.topN.length,
  periodos: ev.dashboard.screenActions.length,
  navegacion: ev.chrome.nav[0].entries.length,
  externos: ev.chrome.links.filter((l) => l.external).length,
  menuCuenta: ev.menu_administrator.entradas.length,
  dialogosDeCuenta: Object.keys(ev.menu_administrator.dialogos).length,
  duraciones: ev.blocking_options.observado.filter((x) => /^Disable Blocking For/.test(x)).length,
  seriesLinea: ev.series.charts.find((c) => c.type === 'line').legend.length,
}

const salida = marco
  .replace('<!-- DESIGN.md -->', sinRutas(direccion))
  .replace('<!-- CONTRATO -->', sinRutas(contrato))
  .replace('<!-- BARRA -->', sinRutas(barra))

/* ── Guardas ────────────────────────────────────────────────────────────────
Cada una es una cifra o una cadena que el prompt afirma y la evidencia o los
documentos pueden desmentir.

**Y se comprueban por DOCUMENTO, no sobre el ensamblado.** Esta cabecera ya decía
que un número correcto en el anexo no puede tapar uno malo en el marco, y aun así
la primera versión miró `salida` —el todo— para las cadenas. Se probó en negativo
y **no saltó**: al quitar `Disable 2FA` del contrato la guarda seguía verde
**porque la barra también lo nombra**. Una guarda que se conforma con encontrar la
cadena en cualquier sitio no dice que el contrato la lleve; dice que alguien la
menciona.

Así que cada cadena se exige **donde tiene que estar**.
*/
const plano = (t) => t.replace(/\s+/g, ' ')
/*
Se compara con los espacios NORMALIZADOS. Los documentos van ajustados a 80
columnas, así que media frase cae al renglón siguiente y una guarda escrita del
tirón no la encuentra nunca: la primera versión de estas cuatro **falló siempre**,
que es tan inútil como no fallar nunca — y más peligroso, porque invita a
quitarlas.
*/
const enDoc = (doc, nombre) => (cadena, queja) => [plano(doc).includes(plano(cadena)), `${queja} (en ${nombre})`]
const enContrato = enDoc(contrato, 'el contrato')
const enBarra = enDoc(barra, 'la barra')
const debe = [
  [cifras.tarjetas === 11, `tarjetas: ${cifras.tarjetas}, no 11`],
  [cifras.seriesLinea === 11, `series de la gráfica de líneas: ${cifras.seriesLinea}, no 11`],
  [cifras.counters === 6, `counters: ${cifras.counters}, no 6`],
  [cifras.graficas === 4, `gráficas: ${cifras.graficas}, no 4`],
  [cifras.topN === 3, `listas top-N: ${cifras.topN}, no 3`],
  [cifras.regiones === 8, `regiones: ${cifras.regiones}, no 8`],
  [cifras.periodos === 6, `periodos: ${cifras.periodos}, no 6`],
  [cifras.navegacion === 12, `entradas de navegación: ${cifras.navegacion}, no 12`],
  [cifras.externos === 6, `enlaces externos: ${cifras.externos}, no 6`],
  [cifras.menuCuenta === 5, `entradas del menú de cuenta: ${cifras.menuCuenta}, no 5`],
  [cifras.dialogosDeCuenta === 4, `diálogos del menú de cuenta: ${cifras.dialogosDeCuenta}, no 4`],
  [cifras.duraciones === 8, `duraciones de Blocking: ${cifras.duraciones}, no 8`],
  /* Y que los anexos hayan entrado de verdad: un `replace` que no encuentra su
     marca no falla, deja el hueco y el prompt sale sin contrato. */
  [!salida.includes('<!-- '), 'ha quedado un anexo sin sustituir'],
  enContrato('Disable Blocking For 3 Hours', 'el contrato no lleva las ocho duraciones'),
  enContrato('resetadmin.config', 'falta la superficie de Forgot Password?'),
  enContrato('Total Sessions', 'faltan las tablas de My Profile'),
  /* Los dos anchos de entrega, y las ocho ramas: es lo que se pidió entregar, y
     un prompt que no lo diga produce un retorno a un solo ancho. */
  [/a 1440 y a 390 px/.test(salida), 'no pide la entrega a 1440 y 390'],
  [salida.includes('El estado mixto'), 'no pide el estado mixto'],
  [salida.includes('SSO, en el menú de cuenta'), 'falta la rama SSO'],
  /*
  Las ramas de los cuatro diálogos de cuenta. Se midieron abriendo cada uno y
  salió SÓLO la del usuario que había delante —local, 2FA apagado, nada creado—,
  así que estas seis cadenas son las que se perdieron una vez y no pueden volver
  a perderse en silencio.
  */
  /*
  El pie ENTERO de la rama activa, no sólo su verbo.

  Este contrato decía «un solo botón, `Disable 2FA`», y eso confunde la ACCIÓN con
  el PIE: el `Close` no lo pone ese diálogo, lo pone `Dialog`, que compone
  `[ acciones… ] [ descarte ]` en los cuarenta. Dibujado al pie de la letra, el
  diálogo se quedaba sin salida. Por eso la guarda pide la pareja y no el verbo.
  */
  enContrato('`[Disable 2FA] [Close]`', 'falta el pie completo de la rama activa de Configure 2FA'),
  enContrato('QR code for the authenticator app', 'falta el QR de Configure 2FA'),
  enContrato('Delete Session', 'falta Delete Session de My Profile'),
  enContrato('SSO Managed', 'falta el tercer valor de 2FA Status'),
  enContrato('`OTP`', 'falta el campo condicional OTP'),
  enContrato('**`Token`**', 'falta el campo Token que aparece tras crear'),
  /* Y el texto de Forgot Password?, que este contrato llegó a resumir DICIENDO
     que era literal. Se comprueba por dos frases que un resumen no conserva. */
  enContrato('sudo systemctl stop dns', 'el texto de Forgot Password? no está literal'),
  enContrato('does not exists', 'se ha corregido un literal de upstream'),
  /*
  Y que la barra las EXIJA, que es cosa distinta de que el contrato las lleve: un
  contrato completo con una barra que no lo mira no protege nada.

  Se comprueba por la FRASE del requisito y no por el nombre de la cosa. Probado
  en negativo: con la guarda puesta en la palabra `Token`, quitar el requisito de
  la barra **no saltaba**, porque el párrafo de advertencia del final también
  nombra `Token`. Una mención satisfacía una guarda que debe probar una exigencia
  — el mismo error de antes, un nivel más abajo.
  */
  enBarra('**Pie: `[Disable 2FA] [Close]`; sin QR, `Secret` ni `OTP`.**', 'la barra no exige el pie completo de la rama activa'),
  enBarra('**su `Confirm`** literal', 'la barra no exige el Confirm de Delete Session'),
  enBarra('el tercer campo **`Token`** que aparece **después** de crear', 'la barra no exige el campo Token de después de crear'),
  enBarra('que sólo aparece con 2FA activo', 'la barra no exige el campo OTP condicional'),
  [!/\]\((?!https?:)[^)]+\)/.test(salida), 'ha quedado un enlace a una ruta del repositorio'],
]

const fallos = debe.filter(([ok]) => !ok).map(([, m]) => m)
if (fallos.length > 0) {
  console.error('ENSAMBLADO ABORTADO:\n' + fallos.map((f) => `  · ${f}`).join('\n'))
  process.exit(1)
}

writeFileSync(here('../docs/prompts/fase3-dashboard-cromo-ready.md'), salida + '\n')
console.log(`Ensamblado: ${salida.length} caracteres, ${salida.split('\n').length} líneas.`)
console.log('Cifras comprobadas contra la evidencia:', JSON.stringify(cifras))
