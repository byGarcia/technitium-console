/*
Ensambla el prompt de ADMINISTRACIÓN con la dirección, el contrato y la barra
DENTRO.

Misma forma y mismas razones que el del arquetipo herramienta: el contrato viaja
entero porque resumirlo es cómo un control deja de volver, y los enlaces a rutas
del repositorio se quitan porque Claude Design no tiene el repositorio — un enlace
ahí no es una referencia, es un agujero que además parece que lleva a algo.

Las guardas comprueban que las cifras que el prompt afirma son las del volcado. Si
la evidencia cambia y el prompt no se regenera, el ensamblado FALLA en vez de
mandar un número viejo.
*/
import { readFileSync, writeFileSync } from 'node:fs'
import { censar } from './censo-dialogos.mjs'
import { censarTablas } from './censo-tablas.mjs'
import { censarAyudas, censarSufijos } from './censo-ayudas.mjs'

const here = (p) => new URL(p, import.meta.url)
const leer = (p) => readFileSync(here(p), 'utf8').trim()

const marco = leer('../docs/prompts/fase3-administracion.md')
const direccion = leer('../DESIGN.md')
const contrato = leer('../docs/direction/fase3-contrato-administracion.md')
const barra = leer('../docs/direction/fase3-barra-aceptacion-administracion.md')
const ev = JSON.parse(readFileSync(here('../docs/direction/evidencia/administracion-dump.json'), 'utf8'))

const sinRutas = (md) =>
  md
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]+\)/g, '$1')
    .replace(/^Referencia: .*$/m, '')

/* Las cifras salen del VOLCADO, no de lo que el contrato dice de sí mismo: es la
   única forma de que una guarda pueda desmentir al documento. */
const cifras = ev.cifras
const p = ev.pantallas

const salida = marco
  .replace('<!-- DESIGN.md -->', sinRutas(direccion))
  .replace('<!-- CONTRATO -->', sinRutas(contrato))
  .replace('<!-- BARRA -->', sinRutas(barra))

const plano = (t) => t.replace(/\s+/g, ' ')
const enDoc = (doc, nombre) => (cadena, queja) => [plano(doc).includes(plano(cadena)), `${queja} (en ${nombre})`]
const enContrato = enDoc(contrato, 'el contrato')
const enBarra = enDoc(barra, 'la barra')
const enMarco = enDoc(marco, 'el marco')

const debe = [
  /* Contra el volcado. */
  [cifras.verbos_distintos === 21, `verbos: ${cifras.verbos_distintos}, no 21`],
  /*
  Las tres cifras de diálogos se comprueban contra un censo FRESCO del fuente, no
  contra lo que la evidencia recuerda. Es la guarda que faltaba: los tres cruces
  que se colaron —los dos de Cluster y los dos de SSO— eran huecos de una lista
  escrita a mano, y ninguna guarda que compare el documento con esa misma lista los
  habría visto.
  */
  ...(() => {
    const c = censar()
    return [
      [cifras.dialogos_instancias_jsx === c.instanciasJSX,
        `instancias JSX: la evidencia dice ${cifras.dialogos_instancias_jsx} y el fuente tiene ${c.instanciasJSX}`],
      [cifras.dialogos_titulos === c.titulos,
        `títulos: la evidencia dice ${cifras.dialogos_titulos} y el fuente tiene ${c.titulos}`],
      [cifras.dialogos_superficies === c.superficies,
        `superficies: la evidencia dice ${cifras.dialogos_superficies} y el fuente tiene ${c.superficies}`],
      [c.repetidos.length === (ev.fuente.dialogos_repetidos ?? []).length,
        `títulos repetidos: el fuente tiene ${c.repetidos.length} y la evidencia ${(ev.fuente.dialogos_repetidos ?? []).length}`],
    ]
  })(),
  [cifras.secciones_de_la_matriz === 11, `secciones: ${cifras.secciones_de_la_matriz}, no 11`],
  [cifras.casillas_force === 4, `casillas Force: ${cifras.casillas_force}, no 4`],
  [cifras.ramas_de_cluster === 3, `ramas de Cluster: ${cifras.ramas_de_cluster}, no 3`],
  /* Y que las 84 casillas viajen como VOLÁTIL y no como estructura: es el error
     que este volcado existe para impedir —un dibujo que fije 84 copia mi
     instancia—. */
  [/casillas de la matriz/.test(ev.volatil), 'el volcado no marca las 84 casillas como volátiles'],
  [p['/admin/permissions/'].casillasConNombreAccesible === 0,
    'la evidencia ya no dice que las casillas de la matriz no tienen nombre accesible'],
  [p['/admin/permissions/'].esTabla === false, 'la evidencia ya no dice que la matriz no es una tabla'],
  /*
  La altura de la matriz se comprueba por COHERENCIA, no por valor.

  La primera versión de esta guarda fijaba 2553 y a la captura siguiente ya no
  cuadraba: medido el mismo día, 84 casillas dan 2491 px y 85 dan 2553 — unos 62 px
  por fila—. La altura se mueve con el dato igual que las casillas, así que fijarla
  ata el documento a una instancia y basta un permiso de grupo más para romperla.

  Lo que sí tiene que cumplirse es que el contrato **diga la altura que dice la
  evidencia**, sea cual sea. Eso es lo que impide que los dos se separen, que es
  para lo que sirve la guarda.
  */
  [(() => {
    const px = ev.pantallas['/admin/permissions/'].alto_volatil
    /* Con y sin punto de millar: `toLocaleString` no agrupa cuatro dígitos en
       todos los entornos, y la guarda no puede depender de eso. */
    const formas = [String(px), String(px).replace(/(\d)(\d{3})$/, '$1.$2')]
    return formas.some((f) => plano(contrato).includes(`${f} px de alto`))
  })(), 'el contrato no dice la altura que mide la evidencia'],
  [typeof ev.pantallas['/admin/permissions/'].alto_volatil === 'number',
    'la evidencia ya no marca la altura de la matriz como volátil'],

  /* Los anexos, de verdad. Esta guarda se reforzó tras probarla en negativo: la
     versión que sólo miraba `<!-- ` dejaba pasar una marca BORRADA, y el prompt
     salía sin contrato dando verde. */
  [marco.includes('<!-- DESIGN.md -->'), 'el marco ha perdido la marca de la dirección'],
  [marco.includes('<!-- CONTRATO -->'), 'el marco ha perdido la marca del contrato'],
  [marco.includes('<!-- BARRA -->'), 'el marco ha perdido la marca de la barra'],
  [salida.includes(direccion.slice(-120)), 'la dirección no ha entrado entera'],
  [salida.includes(contrato.slice(-120)), 'el contrato no ha entrado entero'],
  [salida.includes(barra.slice(-120)), 'la barra no ha entrado entera'],
  [!salida.includes('<!-- '), 'ha quedado un anexo sin sustituir'],
  [!/\]\((?!https?:)[^)]+\)/.test(salida), 'ha quedado un enlace a una ruta del repositorio'],

  /* El acotado y las seis decisiones. */
  enMarco('Lo que se HEREDA y no se discute', 'el marco no acota lo heredado'),
  enMarco('y son SEIS cosas', 'el marco no acota el encargo a las seis decisiones'),
  enMarco('cómo se llama una celda', 'falta la decisión 1: nombrar la celda de la matriz'),
  enMarco('Una pantalla que es tres', 'falta la decisión 2'),
  enMarco('depende de quién mira', 'falta la decisión 3'),
  enMarco('no es un parámetro: cambia\nlo que la acción significa', 'falta la decisión 4'),
  enMarco('no son confirmaciones', 'falta la decisión 5'),
  enMarco('Una sección sin permisos', 'falta la decisión 6'),
  enMarco('a **1440 y a 390 px**', 'el marco no pide los dos anchos'),

  /* Lo que el CONTRATO tiene que llevar. */
  enContrato('Cluster Not Initialized', 'falta la literal del estado sin clúster'),
  enContrato('This server is not part of a cluster.', 'falta el texto entero del estado sin clúster'),
  enContrato("esPrimario ? state === 'Self' : state === 'Self' || type === 'Primary'",
    'falta la regla de Edit Node, y con dos muestras parecía una inconsistencia'),
  enContrato('Force Delete Current Primary Node', 'faltan las cuatro casillas Force'),
  enContrato('Primary Node OTP', 'falta el campo condicional de 2FA de Join Cluster'),
  enContrato('WebServiceAuthApi.cs:1533', 'falta que permissions/set pide canDelete y no canModify'),
  enContrato('`Everyone`', 'falta que la lista de grupos del modal incluye Everyone'),
  enContrato('no tienen nombre\naccesible', 'el contrato no dice que las casillas de la matriz no tienen nombre'),
  enContrato('no oculta ni deshabilita NADA', 'falta el hecho que gobierna la ronda'),
  enContrato('Total Sections: 11', 'falta el pie de la matriz'),
  /*
  Los tres cruces que se colaron en la primera versión, cada uno con su guarda.

  Los tres son del mismo tipo: un número o una lista que el documento afirma y la
  evidencia desmiente. Ninguno se ve releyendo — el de los diálogos llevaba «nueve»
  en el encabezado y siete en la lista, y pasó dos lecturas.
  */
  [cifras.controles_sso === 7, `controles de SSO: ${cifras.controles_sso}, no 7`],
  enContrato('**Siete controles**', 'el contrato no dice que SSO tiene siete controles'),
  enContrato('Aquí NO hay `Cluster Node`', 'el contrato no dice que el selector no está en SSO'),
  [!/Cluster Node`? ·/.test(contrato.slice(contrato.indexOf('## 5. SSO'), contrato.indexOf('## 6. Cluster'))),
    'el contrato vuelve a listar `Cluster Node` entre los controles de SSO'],

  [ev.fuente.dialogos.Cluster.length === 10,
    `diálogos de Cluster en la evidencia: ${ev.fuente.dialogos.Cluster.length}, no 10`],
  ...['Remove Node', 'Promote To Primary Node'].map((n) => [
    ev.fuente.dialogos.Cluster.some((d) => d.startsWith(n)),
    `la evidencia no lleva el diálogo ${n}`,
  ]),
  enContrato('Remove Node - {nodo}', 'el contrato no enumera el diálogo Remove Node'),
  enContrato('Promote To Primary Node - {nodo}', 'el contrato no enumera el diálogo Promote To Primary Node'),
  /* Y que el encabezado y la lista digan lo mismo: la versión anterior prometía
     nueve y enumeraba siete. Se cuentan los puntos de la lista. */
  [(() => {
    const tramo = contrato.slice(contrato.indexOf('### Los diálogos'), contrato.indexOf('## Lo que esta ronda'))
    return (tramo.match(/^\d+\. (`|\*\*)/gm) ?? []).length === 10
  })(), 'el encabezado de los diálogos de Cluster no cuadra con lo que enumera'],

  [cifras.verbos_distintos === 21, `verbos: ${cifras.verbos_distintos}, no 21`],
  [/\b21\b/.test(ev._nota_recuento),
    'la nota del recuento no dice 21 verbos — decía 20 mientras la cifra contractual era 21'],

  /* Y lo que la BARRA tiene que EXIGIR, que es cosa distinta. */
  enBarra('Las seis sub-pantallas están dibujadas', 'la barra no exige las seis'),
  enBarra('Las 41 columnas de tabla siguen ahí', 'la barra no exige las columnas'),
  enBarra('Las 27 ayudas siguen ahí, enteras', 'la barra no exige las ayudas'),
  enBarra('Nada de lo dibujado va en castellano', 'la barra no prohíbe dibujar castellano'),
  enBarra('sin candado y **sin explicación añadida**', 'la barra no prohíbe rellenar el hueco del candado'),
  [!/dejarlo en blanco/.test(barra + marco), 'queda la instrucción de no dejar el hueco en blanco, que contradice quitarlo'],
  enContrato('Toda la interfaz del producto está en inglés', 'el contrato no dice que el producto es en inglés'),
  [cifras.ayudas === 27 && cifras.sufijos === 5,
    `la evidencia dice ${cifras.ayudas} ayudas y ${cifras.sufijos} sufijos, no 27 y 5`],
  enMarco('Las 27 ayudas', 'el marco no pide las ayudas'),
  /* Y las diez literales que no son ayuda, que también se copian. */
  enContrato('diez literales largas más que tampoco se parafrasean',
    'el contrato no separa las literales que no son ayuda'),
  /* Los cuatro intervalos de `Cluster Options`, que faltaban como CAMPOS. */
  enContrato('Heartbeat Refresh Interval', 'el contrato no lleva los intervalos de Cluster Options'),
  enContrato('valid range 30-3600; default 900', 'faltan los sufijos de los intervalos'),
  enBarra('Los 21 verbos siguen ahí', 'la barra no exige los verbos'),
  enBarra('Las 24 superficies de diálogo están dibujadas', 'la barra no exige las 24 superficies'),
  enBarra('Dibujar 22 pierde dos; dibujar 25\n  duplica uno', 'la barra no explica por qué son 24 y no 22 ni 25'),
  enMarco('Las 24 superficies de diálogo', 'el marco no pide las 24 superficies'),
  /* SSO: sus dos confirmaciones, y su altura como volátil. */
  /*
  Las dos confirmaciones de SSO se exigen EN LA SECCIÓN DE SSO, no en el documento.

  La primera versión buscaba `Sso.tsx:456` en todo el contrato y no mordía:
  la referencia aparece dos veces —en la sección y en la tabla de totales—, así que
  quitarla de la sección dejaba la otra y la guarda seguía verde. Es el mismo
  defecto que ya costó una guarda en la ronda anterior: encontrar la cadena en
  algún sitio no prueba que esté donde tiene que estar.
  */
  ...(() => {
    const tramo = contrato.slice(contrato.indexOf('## 5. SSO'), contrato.indexOf('## 6. Cluster'))
    return [
      [plano(tramo).includes('Sso.tsx:456'), 'la sección de SSO no lleva sus dos confirmaciones'],
      /*
      Los dos textos ENTEROS, no un fragmento.

      La guarda anterior exigía `Metadata Address** must use` y pasaba con el
      literal cortado por puntos suspensivos — que es como estaba—. Un literal a
      medias en el contrato es un literal a medias en la pantalla: quien dibuja no
      tiene el fuente para completarlo.

      Se comparan contra el FUENTE, no contra una copia escrita aquí: así el día
      que upstream cambie la frase, la guarda lo dice en vez de exigir la vieja.
      */
      ...(() => {
        const sso = readFileSync(here('../src/screens/admin/Sso.tsx'), 'utf8')
        const textos = [...sso.matchAll(/text="([^"]+)"/g)].map((m) => m[1])
        if (textos.length !== 2) return [[false, `Sso.tsx ya no tiene dos confirmaciones, tiene ${textos.length}`]]
        return textos.map((t, i) => [
          /* El contrato los pone en negrita el sujeto, así que se compara sin los
             asteriscos y con los espacios normalizados. */
          plano(tramo).replace(/\*\*/g, '').includes(plano(t)),
          `el texto ${i + 1} de Save Config no está entero en la sección de SSO`,
        ])
      })(),
    ]
  })(),
  [ev.pantallas['/admin/sso/'].alto_volatil === 2029,
    `alto de SSO: ${ev.pantallas['/admin/sso/'].alto_volatil}, no 2029`],
  [ev.pantallas['/admin/sso/'].alto === undefined, 'la evidencia no marca la altura de SSO como volátil'],
  [!/2\.090/.test(contrato) && !/2\.090/.test(marco), 'queda el 2.090 viejo de SSO'],
  /* Y que el marco no cite NINGUNA de las dos alturas exactas: las dos son
     volátiles, y un dibujo hecho contra un dígito que se mueve copia mi instancia.
     El contrato sí las da, marcadas; el encargo cita la magnitud. */
  [!/2\.\d{3} px de (matriz|alto)/.test(marco) && !/2\.553|2\.491|2\.029/.test(marco),
    'el marco vuelve a citar una altura exacta, y las dos son volátiles'],
  /*
  TODAS las ayudas del fuente tienen que estar en el contrato, y ENTERAS.

  Es la guarda que faltaba y la que más caro salió: el contrato se envió a diseño
  **sin una sola** de las 25 ayudas de la sección, y la entrega —que no tiene el
  fuente— dibujó ayuda inventada bajo los campos de SSO, marcándola además como
  copiada del fuente. La regla del proyecto es que no se deja caer una ayuda, y el
  contrato es lo único que quien dibuja tiene.

  Se comparan contra el fuente y no contra una copia escrita aquí: el día que
  upstream cambie una, la guarda lo dice en vez de exigir la vieja.
  */
  ...(() => {
    const a = censarAyudas()
    const plano2 = plano(contrato)
    const faltan = a.ayudas.filter((x) => !plano2.includes(plano(x.texto)))
    if (faltan.length === 0) return [[true, '']]
    return faltan.slice(0, 5).map((x) => [
      false,
      `falta una ayuda de ${x.fichero}, o está recortada: «${x.texto.slice(0, 52)}…»`,
    ]).concat(faltan.length > 5 ? [[false, `…y ${faltan.length - 5} ayudas más`]] : [])
  })(),

  /*
  El sello del contrato tiene que ser el de la evidencia.

  El contrato decía `index-QuzqHSI5.js` —el del primer volcado— mientras la
  evidencia ya llevaba el de la recaptura. Ese hash es lo ÚNICO que distingue las
  dos lecturas: el primer volcado contaba ocho controles en SSO y el segundo siete,
  y lo que destapó la diferencia fue el hash. Desactualizado, la procedencia deja
  de serlo.
  */
  ...['css', 'js'].map((k) => {
    const esperado = ev.sello.bundle[k][0]
    return [plano(contrato).includes(esperado), `el contrato no cita el bundle ${k} de la evidencia: ${esperado}`]
  }),
  /* Acotada a la TABLA de procedencia: el contrato explica en prosa de dónde vino
     el hash viejo, y eso es legítimo. Lo que no puede es citarlo como el suyo. */
  [(() => {
    const fila = /\| \*\*DOM\*\* \|[^\n]*/.exec(contrato)?.[0] ?? ''
    return !/index-QuzqHSI5/.test(fila)
  })(), 'la fila DOM del contrato cita el bundle del primer volcado'],

  /*
  Y ninguna cifra vieja de diálogos suelta por los documentos. La barra decía
  «diecinueve diálogos» cuando ya eran 22 títulos, 24 superficies y 25 instancias:
  el total cambió tres veces y el texto se quedó en el primero.
  */
  [!/diecinueve|\b19 diálogos/.test(barra + marco + contrato), 'queda una cifra vieja de diálogos'],

  /*
  Los sufijos, que no son ayuda ni literal larga y por eso no los cubría nada.

  Son cinco, y el quinto —el de `Session Timeout`— no estaba en el contrato: está
  escrito como texto JSX y no como cadena, así que un censo por `suffix=` no lo ve.
  Un sufijo dice el rango válido y el valor por defecto; perderlo es perder lo único
  que indica qué se puede escribir en ese campo.
  */
  ...censarSufijos().map((x) => [
    plano(contrato).includes(plano(x.texto)),
    `falta el sufijo de ${x.fichero}: «${x.texto}»`,
  ]),

  /*
  Y las columnas se cuentan con el censo, no a mano.

  El contrato afirmaba **31** y esa cifra no contaba nada coherente: sumaba las
  cuatro colecciones más las dos tablas anidadas de SSO, dejando fuera
  `Permissions` y `UserDetails`. Lo destapó la entrega al intentar reproducirla —le
  dio 30 y dijo, con razón, que ninguna partición honrada da 31—. El total real,
  contando TODAS las tablas del directorio, es 41.
  */
  [(() => {
    const t = censarTablas()
    return t.total === cifras.columnas_de_tabla
  })(), `columnas: la evidencia dice ${cifras.columnas_de_tabla} y el censo del fuente da ${censarTablas().total}`],

  /*
  NINGUNA literal citada puede ir recortada, en ningún sitio del contrato.

  Ésta generaliza el fallo en vez de tapar el caso: el segundo texto de
  `Save Config` iba cortado con puntos suspensivos «porque es igual salvo el
  sujeto», y la guarda de al lado sólo comprobaba un fragmento. Quien dibuja no
  tiene el fuente, así que una literal a medias llega a medias a la pantalla.

  Se mira dentro de las comillas angulares, que es como este contrato cita lo que
  el usuario lee. Los `…` de fuera son otra cosa —marcadores de patrón como
  `Needs …` o `Force …`— y no se tocan.
  */
  ...[...contrato.matchAll(/«([^»]*)»/g)]
    .filter((m) => m[1].includes('…'))
    .map((m) => [false, `literal citada y recortada: «${m[1].slice(0, 60)}…»`]),

  /* Y que `no_observado` no siga con la cifra vieja ni con `Edit Node` en singular. */
  [!/los siete diálogos/.test(JSON.stringify(ev.fuente.no_observado)),
    '`no_observado` sigue diciendo «los siete diálogos de Cluster»'],
  [/los DOS Edit Node/.test(JSON.stringify(ev.fuente.no_observado)),
    '`no_observado` no dice que los `Edit Node` son dos'],
  enBarra('La matriz dice CÓMO SE LLAMA UNA CELDA', 'la barra no exige resolver el nombre de la celda'),
  enBarra('las 84 casillas son dato', 'la barra no exige distinguir estructura de dato'),
  enBarra('son tres dibujos', 'la barra no exige las tres ramas de Cluster'),
  enBarra('No se dibuja ningún candado', 'la barra no exige que no haya candado'),
  enBarra('La matriz a 390 es el caso difícil', 'la barra no exige la matriz en estrecho'),
  [!barra.includes('guarda'), 'la barra explica el andamiaje en vez de exigir'],
]

const fallos = debe.filter(([ok]) => !ok).map(([, m]) => m)
if (fallos.length > 0) {
  console.error('ENSAMBLADO ABORTADO:\n' + fallos.map((f) => `  · ${f}`).join('\n'))
  process.exit(1)
}

writeFileSync(here('../docs/prompts/fase3-administracion-ready.md'), salida + '\n')
console.log(`Ensamblado: ${salida.length} caracteres, ${salida.split('\n').length} líneas.`)
console.log('Cifras comprobadas contra la evidencia:', JSON.stringify(cifras))
