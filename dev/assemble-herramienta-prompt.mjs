/*
Ensambla el prompt del arquetipo herramienta —DNS Client + Logs— con la
dirección, el contrato y la barra DENTRO.

Misma forma que los ensambladores de los pilotos y de la fase 3, y por la misma
razón: el prompt que va a la herramienta de diseño tiene que llevar el contrato
ENTERO. Resumirlo es cómo un control, una ayuda o un párrafo deja de volver. Y hay
un motivo extra: **Claude Design no ve el repositorio**, así que un `[enlace](ruta)`
no es una referencia, es un agujero.

Las guardas del final comprueban que las cifras que el prompt afirma siguen siendo
las que dice la evidencia: si el volcado cambia y el prompt no se regenera, el
ensamblado **falla** en vez de mandar un número viejo.
*/
import { readFileSync, writeFileSync } from 'node:fs'

const here = (p) => new URL(p, import.meta.url)
const leer = (p) => readFileSync(here(p), 'utf8').trim()

const marco = leer('../docs/prompts/fase3-herramienta.md')
const direccion = leer('../DESIGN.md')
const contrato = leer('../docs/direction/fase3-contrato-herramienta.md')
const barra = leer('../docs/direction/fase3-barra-aceptacion-herramienta.md')
const ev = JSON.parse(readFileSync(here('../docs/direction/evidencia/herramienta-dump.json'), 'utf8'))

const sinRutas = (md) =>
  md
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, '$1')
    .replace(/^Referencia: .*$/m, '')

/* Las cifras salen del VOLCADO, no de lo que el contrato dice de sí mismo. Es la
   única forma de que una guarda pueda desmentir al documento. */
const dc = ev.pantallas.dnsclient
const vl = ev.pantallas.viewlogs
const ql = ev.pantallas.querylogs
const cifras = {
  camposDnsClient: dc.reposo.campos.length,
  tipos: dc.opciones['Type'].length,
  protocolos: dc.opciones['DNS-over-'].length,
  verbosDnsClient: dc.reposo.buttons.filter((b) => b.where === 'bar').length,
  ficheros: vl.reposo.ficheros.length,
  verbosViewLogs: vl.abierto.buttons.filter((b) => b.where !== 'field').length,
  largoVisor: vl.abierto.largoVisor,
  rotulosQueryLogs: ql.reposo.nRotulos,
  verbosQueryLogs: ql.reposo.buttons.filter((b) => b.where === 'header').length,
  columnas: ql.resultado.columnas.length,
  colores: ev.fuente.querylogs_colores_de_fila.length,
  coloresObservados: ev.fuente.querylogs_colores_de_fila.filter((c) => c.observado).length,
  reglasUpstream: ev.fuente.querylogs_reglas_de_upstream.length,
  ramasDnsClientNoObservadas: ev.fuente.dnsclient_ramas_no_observadas.length,
  ramasViewLogsNoObservadas: ev.fuente.viewlogs_ramas_no_observadas.length,
  verbosQueDesaparecen: ev.fuente.viewlogs_verbos_que_hoy_desaparecen.length,
  confirmaciones: ev.fuente.viewlogs_confirmaciones.length,
}
/* 23 = 7 de DNS Client (los 6 medidos + el Cluster Node, que no se pintó) + 1 de
   Logs + 15 de Query Logs. Se compone aquí para que la suma sea comprobable y no
   una cifra escrita a mano en la barra. */
cifras.controles = cifras.camposDnsClient + 1 + 1 + cifras.rotulosQueryLogs
cifras.verbos = cifras.verbosDnsClient + cifras.verbosViewLogs + cifras.verbosQueryLogs

const salida = marco
  .replace('<!-- DESIGN.md -->', sinRutas(direccion))
  .replace('<!-- CONTRATO -->', sinRutas(contrato))
  .replace('<!-- BARRA -->', sinRutas(barra))

/* ── Guardas ────────────────────────────────────────────────────────────────
Cada cadena se exige **donde tiene que estar**, y no sobre el ensamblado. La ronda
anterior lo midió: una guarda puesta sobre el todo se ponía verde porque la barra
nombraba lo que faltaba en el contrato. Encontrar la cadena en algún sitio no
prueba que el documento que debe llevarla la lleve.
*/
const plano = (t) => t.replace(/\s+/g, ' ')
const enDoc = (doc, nombre) => (cadena, queja) => [plano(doc).includes(plano(cadena)), `${queja} (en ${nombre})`]
const enContrato = enDoc(contrato, 'el contrato')
/*
La barra se comprueba SEPARADA del contrato, y no sobre el ensamblado.

La ronda anterior lo midió: una guarda puesta sobre el todo se ponía verde porque
*alguien* nombraba la cosa. Lo que hay que probar son dos cosas distintas —que el
contrato la LLEVA y que la barra la EXIGE—, y un contrato completo con una barra
que no lo mira no protege nada.
*/
const enBarra = enDoc(barra, 'la barra')
const enMarco = enDoc(marco, 'el marco')

const debe = [
  /* Las cifras, contra el volcado. */
  [cifras.tipos === 28, `tipos de registro: ${cifras.tipos}, no 28`],
  [cifras.protocolos === 5, `protocolos: ${cifras.protocolos}, no 5`],
  [cifras.controles === 23, `controles: ${cifras.controles}, no 23`],
  [cifras.verbos === 9, `verbos: ${cifras.verbos}, no 9`],
  [cifras.rotulosQueryLogs === 15, `controles de Query Logs: ${cifras.rotulosQueryLogs}, no 15`],
  [cifras.columnas === 10, `columnas de la tabla: ${cifras.columnas}, no 10`],
  [cifras.colores === 7, `colores de fila: ${cifras.colores}, no 7`],
  [cifras.coloresObservados === 4, `colores observados: ${cifras.coloresObservados}, no 4`],
  [cifras.reglasUpstream === 5, `reglas de upstream: ${cifras.reglasUpstream}, no 5`],
  [cifras.verbosQueDesaparecen === 3, `verbos que desaparecen sin permiso: ${cifras.verbosQueDesaparecen}, no 3`],
  [cifras.confirmaciones === 3, `confirmaciones de View Logs: ${cifras.confirmaciones}, no 3`],
  [cifras.largoVisor > 1_000_000, `el visor midió ${cifras.largoVisor}, y el prompt afirma más de un millón`],
  /* Y que el número que el marco ENSEÑA sea el que se midió: es el dato que
     sostiene el patrón 1, y un dibujo hecho contra un número viejo dibuja otra
     cosa. */
  [salida.includes(cifras.largoVisor.toLocaleString('es-ES')), 'el marco no enseña el tamaño del visor que dice la evidencia'],

  /*
  Las diez ramas no observadas, contadas EN el contrato y no afirmadas.

  El marco y la barra dicen «diez». La primera versión de este contrato marcaba
  ocho: los dos `Loading` de View Logs se quedaron en FUENTE sin marcar, y tampoco
  se habían visto. Una rama no observada que no se marca es peor que una que
  falta, porque parece comprobada. Se cuentan las marcas de las dos tablas de
  ramas —DNS Client y View Logs— y se exige que sean diez.
  */
  [(() => {
    const tramo = contrato.slice(contrato.indexOf('### Ramas — 8'), contrato.indexOf('### El dato que el dibujo'))
    return (tramo.match(/NO OBSERVADO/g) ?? []).length === 10
  })(), 'las ramas marcadas como no observadas no son diez'],

  /*
  Que los tres anexos hayan entrado DE VERDAD.

  Esta guarda era `!salida.includes('<!-- ')` y **no muerde**: probada en negativo,
  borrar la marca `<!-- CONTRATO -->` del marco produjo un prompt 13.000 caracteres
  más corto, **sin contrato**, y el ensamblado salió verde. `replace` con una marca
  que no existe no falla: devuelve el texto igual. Así que la guarda vigilaba el
  caso inofensivo —una marca que se queda a la vista, que cualquiera ve— y dejaba
  pasar el caso que este fichero existe para impedir.

  Ahora se comprueban las dos cosas: que las marcas ESTABAN en el marco antes de
  sustituir, y que un trozo real de cada anexo ESTÁ en la salida.
  */
  [marco.includes('<!-- DESIGN.md -->'), 'el marco ha perdido la marca de la dirección'],
  [marco.includes('<!-- CONTRATO -->'), 'el marco ha perdido la marca del contrato'],
  [marco.includes('<!-- BARRA -->'), 'el marco ha perdido la marca de la barra'],
  [salida.includes(direccion.slice(-120)), 'la dirección no ha entrado entera'],
  [salida.includes(contrato.slice(-120)), 'el contrato no ha entrado entero'],
  [salida.includes(barra.slice(-120)), 'la barra no ha entrado entera'],
  [!salida.includes('<!-- '), 'ha quedado un anexo sin sustituir'],
  [!/\]\((?!https?:)[^)]+\)/.test(salida), 'ha quedado un enlace a una ruta del repositorio'],

  /* El acotado, que es lo que este encargo tiene de distinto. Sin esto el retorno
     rediseña las primitivas cerradas y hay que tirarlo entero. */
  enMarco('Lo que se HEREDA y no se discute', 'el marco no acota lo heredado'),
  enMarco('SEIS patrones, y nada más', 'el marco no acota el encargo a los seis patrones'),
  enMarco('**Una sola entrega**', 'el marco no pide una sola entrega'),
  enMarco('una sola reconciliación', 'el marco no anuncia una sola reconciliación'),
  enMarco('la entrega es\nla pantalla completa', 'el marco no exige la pantalla completa pese al encargo acotado'),
  enMarco('a 1440 y a\n390 px', 'el marco no pide los dos anchos'),

  /* Los seis patrones, por su nombre, en el marco. */
  enMarco('La superficie de salida cruda', 'falta el patrón 1'),
  enMarco('`Raw Responses (N)`', 'falta el patrón 2'),
  enMarco('maestro–detalle a dos paneles', 'falta el patrón 3'),
  enMarco('formulario de filtro de catorce controles', 'falta el patrón 4'),
  enMarco('polaridad INVERTIDA', 'falta el patrón 5'),
  enMarco('código de color de filas de siete valores, y su leyenda', 'falta el patrón 6'),

  /* Lo que el CONTRATO tiene que llevar: literales que un resumen se come. */
  enContrato('Run a query to see the response.', 'falta la literal del vacío de DNS Client'),
  enContrato('No Log File Was Found', 'falta la literal del vacío de View Logs'),
  enContrato('Unable to load the log files.', 'falta la literal del ERROR de View Logs, que es distinta del vacío'),
  enContrato('Records Imported!', 'falta la rama de importación'),
  enContrato('Please enter a valid Name Server.', 'falta la validación del servidor'),
  enContrato('Please enter a domain name to query.', 'falta la validación del dominio'),
  enContrato('from the Apps section.', 'falta el matiz de los dos avisos distintos de «falta la app»'),
  enContrato('optQueryLogsEntriesPerPage', 'falta la clave de localStorage de Logs Per Page'),
  enContrato('pageNumber=-1', 'falta el -1 de la última página'),
  enContrato('example.com or *.com', 'falta el placeholder de Domain'),
  enContrato('A, AAAA, etc.', 'falta el placeholder de Type'),
  enContrato('Dashboard.canDelete', 'falta el permiso de otra sección de Delete All Stats'),
  enContrato('rgba(111, 84, 153, .1)', 'faltan los valores de los colores de fila'),
  enContrato('Query DNS Server', 'falta el hueco de integración que NO es alcance'),

  /* Y lo que la BARRA tiene que EXIGIR, que es cosa distinta de que el contrato
     lo lleve. Se comprueba por la FRASE del requisito y no por el nombre de la
     cosa: la ronda anterior demostró que una mención satisface una guarda que
     debería probar una exigencia. */
  enBarra('Los 23 controles siguen ahí', 'la barra no exige los 23 controles'),
  enBarra('Los 9 verbos siguen ahí', 'la barra no exige los 9 verbos'),
  enBarra('Las 15 ramas están dibujadas', 'la barra no exige las quince ramas'),
  enBarra('Y los 5 estados de Query Logs', 'la barra no exige los estados de Query Logs'),
  enBarra('Vacío y error no se dibujan igual', 'la barra no exige distinguir vacío de error'),
  enBarra('tienen leyenda', 'la barra no exige la leyenda de los colores'),
  enBarra('No se rediseñan las primitivas ya cerradas', 'la barra no protege las primitivas heredadas'),
  enBarra('vuelven **apagados y con candado**', 'la barra no exige que los verbos sin permiso sigan estando'),
  enBarra('una línea por cada uno de los seis patrones', 'la barra no exige la decisión escrita de cada patrón'),
  enBarra('el patrón 5 necesita extender una primitiva', 'la barra no exige que se justifique extender una primitiva'),
  /* Y que la barra NO arranque explicando el andamiaje: quien la lee es quien
     dibuja, no quien mantiene el ensamblador. */
  [!barra.includes('guarda'), 'la barra explica el andamiaje en vez de exigir'],
]

const fallos = debe.filter(([ok]) => !ok).map(([, m]) => m)
if (fallos.length > 0) {
  console.error('ENSAMBLADO ABORTADO:\n' + fallos.map((f) => `  · ${f}`).join('\n'))
  process.exit(1)
}

writeFileSync(here('../docs/prompts/fase3-herramienta-ready.md'), salida + '\n')
console.log(`Ensamblado: ${salida.length} caracteres, ${salida.split('\n').length} líneas.`)
console.log('Cifras comprobadas contra la evidencia:', JSON.stringify(cifras))
