/*
Regresiones del lector de contratos, para el arquetipo de vista general.

`screen-contract.mjs` no tenía ninguna, y por eso las cuatro cosas que v4 arregla
llegaron a producir un volcado que parecía correcto: decía `state: "empty"` sobre
una pantalla con 304 consultas y cuatro gráficas, fundía las once tarjetas en una
cadena de `prose`, daba `tables: 0` con tres listas top-N pintadas, y se
autodescribía como `unstamped`.

Ninguna de las cuatro se ve leyendo el volcado por encima: las cuatro se ven
comparándolo con la pantalla, que es justo lo que nadie hace cuando la
herramienta existe para no tener que hacerlo.

Las cuatro de abajo son ESAS cuatro, una por una.
*/
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { contract, overview, regions } from './screen-contract.mjs'

/** Un sello válido, para lo que no está probando el sello. */
const SELLO = { instrument: 'a'.repeat(64), bundle: { css: ['index-abc.css'], js: ['index-abc.js'] } }

/** Un panel de la consola: `ui/Panel` con su título y su cuerpo. */
function panel(titulo, cuerpo) {
  return `<div class="_panel_x1"><h2 class="_title_x1">${titulo}</h2><div class="_body_x1">${cuerpo}</div></div>`
}

/** La caja de vacío que pinta `ui/Empty`. */
const VACIO = '<div class="_box_x1">No data for this period.</div>'

function pantalla(html) {
  const main = document.createElement('main')
  main.innerHTML = html
  document.body.replaceChildren(main)
  return main
}

beforeEach(() => document.body.replaceChildren())

describe('una región vacía no vacía la pantalla', () => {
  /*
  El defecto medido el 2026-09-03: el Dashboard tenía 304 consultas, cuatro
  gráficas y dos listas con dato, y `contract()` lo daba por `empty` porque
  `Top Blocked Domains` —que en esa instancia NO PUEDE tener dato, no hay lista
  de bloqueo— seguía enseñando su caja.
  */
  it('con una región vacía y otra poblada, el estado es `mixed`', () => {
    pantalla(panel('Top Domains', '<div class="_toprow_x1"><span class="_n_x1">casa.test</span><span class="_c_x1">33</span></div>') + panel('Top Blocked Domains', VACIO))

    const c = contract({ stamp: SELLO })
    expect(c.state).toBe('mixed')
  })

  it('y el detalle dice cuál es cuál', () => {
    pantalla(panel('Top Domains', '<div class="_toprow_x1"><span class="_n_x1">casa.test</span><span class="_c_x1">33</span></div>') + panel('Top Blocked Domains', VACIO))

    expect(regions()).toEqual([
      { name: 'Top Domains', state: 'populated' },
      { name: 'Top Blocked Domains', state: 'empty' },
    ])
  })

  it('cuando todas coinciden, el estado sigue siendo esa palabra y no `mixed`', () => {
    pantalla(panel('Top Domains', VACIO) + panel('Top Blocked Domains', VACIO))
    expect(contract({ stamp: SELLO }).state).toBe('empty')
  })

  /*
  Y una tarjeta NO es una región. En el Dashboard `.tile` **compone** `panel` en
  CSS Modules, así que lleva su clase: medido, las once tarjetas salían como once
  regiones llamadas `null`, que en un contrato no se pueden nombrar.
  */
  it('una tarjeta que compone `panel` no cuenta como región', () => {
    pantalla(
      '<div data-testid="metrics">' +
        '<div class="_tile_x1 _panel_x1"><div class="_v_x1">304</div><div class="_k_x1">Total Queries</div></div>' +
      '</div>' + panel('Queries', '<canvas role="img" aria-label="Queries over time"></canvas>'),
    )

    expect(regions()).toEqual([{ name: 'Queries', state: 'populated' }])
  })

  /* Pero un panel SIN título sí es una región: `ui/Panel` admite quedarse sin él
     a propósito, y uno así con una tabla dentro tiene estado que importa. */
  it('un panel sin título sigue siendo una región, con el nombre a null', () => {
    pantalla('<div class="_panel_x1"><div class="_body_x1">' + VACIO + '</div></div>')
    expect(regions()).toEqual([{ name: null, state: 'empty' }])
  })

  /* Una pantalla sin paneles —un diálogo, por ejemplo— conserva el
     comportamiento de v3: un estado, el del conjunto. */
  it('una pantalla sin regiones conserva el estado único', () => {
    pantalla('<p>Solo prosa</p>')
    expect(contract({ stamp: SELLO }).state).toBe('populated')
  })
})

describe('ninguna tarjeta puede fundirse en prosa', () => {
  const TARJETAS =
    '<div data-testid="metrics">' +
    '<div class="_tile_x1" style="--tc: var(--ch-total)"><div class="_v_x1">304</div><div class="_p_x1"></div><div class="_k_x1">Total Queries</div></div>' +
    '<div class="_tile_x1" style="--tc: var(--ch-ok)"><div class="_v_x1">66</div><div class="_p_x1">21.71%</div><div class="_k_x1">No Error</div></div>' +
    '<div class="_tile_x1" style="--tc: var(--ch-fail)"><div class="_v_x1">44</div><div class="_p_x1">14.47%</div><div class="_k_x1">Server Failure</div></div>' +
    '</div>'

  it('cada tarjeta llega con identidad, valor, porcentaje y serie', () => {
    pantalla(TARJETAS)

    expect(overview().cards).toEqual([
      { label: 'Total Queries', value: '304', pct: null, series: 'var(--ch-total)', volatile: ['value', 'pct'] },
      { label: 'No Error', value: '66', pct: '21.71%', series: 'var(--ch-ok)', volatile: ['value', 'pct'] },
      { label: 'Server Failure', value: '44', pct: '14.47%', series: 'var(--ch-fail)', volatile: ['value', 'pct'] },
    ])
  })

  /*
  La prueba que de verdad importa: que perder UNA se vea. Fundidas en `prose`,
  quitar `Server Failure` cambiaba una cadena de doscientos caracteres por otra
  de ciento ochenta, y nadie compara eso.
  */
  it('si falta una, el contrato lo dice por su nombre', () => {
    pantalla(TARJETAS)
    const antes = overview().cards.map((c) => c.label)

    document.querySelectorAll('[data-testid="metrics"] > *')[2].remove()
    const despues = overview().cards.map((c) => c.label)

    expect(antes).toContain('Server Failure')
    expect(despues).not.toContain('Server Failure')
    expect(antes.length - despues.length).toBe(1)
  })

  /*
  Y las cuenta **estén agrupadas como estén**.

  El selector era «los hijos de la caja», y el día que la fase 3 repartió las once
  en dos grupos el contrato pasó a decir **2 tarjetas donde hay 11**. Un contrato
  que dice 2 no puede desmentir a un diseño que devuelva 2 — y reagrupar es justo
  lo que esta fase hace con las pantallas.
  */
  it('las cuenta aunque estén repartidas en grupos', () => {
    pantalla(
      '<div data-testid="metrics">' +
        '<div class="_tot_x">' +
          '<div class="_tile_x1" style="--tc: var(--ch-total)"><div class="_v_x1">304</div><div class="_k_x1">Total Queries</div></div>' +
        '</div>' +
        '<div class="_nine_x">' +
          '<div class="_tile_x1" style="--tc: var(--ch-ok)"><div class="_v_x1">66</div><div class="_p_x1">21.71%</div><div class="_k_x1">No Error</div></div>' +
          '<div class="_tile_x1" style="--tc: var(--ch-fail)"><div class="_v_x1">44</div><div class="_p_x1">14.47%</div><div class="_k_x1">Server Failure</div></div>' +
        '</div>' +
      '</div>',
    )

    const c = contract({ stamp: SELLO })
    expect(c.overview.cards.map((x) => x.label)).toEqual(['Total Queries', 'No Error', 'Server Failure'])
    /* Y los grupos NO se cuentan como una tarjeta más ni como regiones. */
    expect(c.overview.cards).toHaveLength(3)
    expect(c.regions).toEqual([])
  })

  /* Los counters del panel `Server` son otra familia: sin porcentaje y sin
     serie. Mezclarlos haría que una tarjeta sin porcentaje pareciera normal. */
  it('los counters no se cuentan como tarjetas', () => {
    pantalla(TARJETAS + '<div data-testid="counters"><div class="_cnt_x1"><div class="_v_x1">6</div><div class="_k_x1">Zones</div></div></div>')

    const o = overview()
    expect(o.cards).toHaveLength(3)
    expect(o.counters).toEqual([{ label: 'Zones', value: '6', volatile: ['value'] }])
  })
})

describe('los top-N tienen que aparecer', () => {
  const CLIENTES = panel(
    'Top Clients',
    '<div class="_toprow_x1"><span class="_n_x1">127.0.0.1<span class="_topDomain_x1">localhost</span></span><span class="_c_x1">103</span></div>' +
      '<div class="_toprow_x1 _limited_x1"><span class="_n_x1">172.23.0.2 (rate limited)</span><span class="_c_x1">101</span></div>' +
      '<button>More</button>',
  )

  /*
  El defecto: el resumen compacto NO es un `<table>` —son filas de `div`—, así
  que `tables` daba 0 y las tres listas no existían para el contrato.
  */
  it('el resumen compacto se lee aunque no sea una tabla', () => {
    pantalla(CLIENTES)
    expect(document.querySelectorAll('table')).toHaveLength(0)

    const [lista] = overview().topN
    expect(lista.title).toBe('Top Clients')
    expect(lista.summary).toHaveLength(2)
  })

  /* El nombre NO puede llevarse el detalle pegado: en el DOM el dominio del
     cliente va dentro del propio `<span>` del nombre. */
  it('cada fila trae nombre, recuento, detalle y rateLimited, y el nombre no se come el detalle', () => {
    pantalla(CLIENTES)

    expect(overview().topN[0].summary).toEqual([
      { name: '127.0.0.1', count: '103', detail: 'localhost', rateLimited: false },
      { name: '172.23.0.2', count: '101', detail: null, rateLimited: true },
    ])
  })

  /*
  Y las DOS superficies quedan vinculadas. No son la misma lista duplicada: son
  un resumen de cinco filas y una tabla de hasta mil en el modal de `More`. El
  contrato las ata; obligarlas a compartir `ui/Table` habría sido el error
  contrario.
  */
  it('el resumen nombra la otra superficie aunque esté cerrada', () => {
    pantalla(CLIENTES)
    expect(overview().topN[0].more).toBe('More')
  })

  it('un top-N vacío sigue apareciendo, con su estado', () => {
    pantalla(panel('Top Blocked Domains', VACIO))

    const [lista] = overview().topN
    expect(lista.title).toBe('Top Blocked Domains')
    expect(lista.state).toBe('empty')
    expect(lista.summary).toEqual([])
  })
})

describe('un contrato sin sello falla', () => {
  /*
  Y falla, no avisa. `tool: 'unstamped'` era un aviso que se lee cuando ya has
  usado el dato — que es como un barrido de uniformidad llegó a medir el bundle
  viejo y estuvo a punto de darse por verde.
  */
  it('sin sello, lanza', () => {
    pantalla('<p>lo que sea</p>')
    expect(() => contract({})).toThrow(/sello/)
  })

  it('con un sello a medias, también', () => {
    pantalla('<p>lo que sea</p>')
    expect(() => contract({ stamp: { instrument: 'a'.repeat(64) } })).toThrow(/sello/)
    expect(() => contract({ stamp: { bundle: { css: [], js: [] } } })).toThrow(/sello/)
  })

  it('con sello, el volcado dice con qué lector y de qué consola', () => {
    pantalla('<p>lo que sea</p>')

    const c = contract({ stamp: SELLO })
    expect(c.tool).toBe(SELLO.instrument)
    expect(c.bundle).toEqual(SELLO.bundle)
  })
})

/*
El Login no tiene `<main>` — es un formulario suelto en el `body`— y sin esto
`contract()` devolvía `{error: 'no main element'}` sobre la pantalla por la que se
entra a la consola.

La caída NO puede ser ciega: esa guarda existe porque la consola de upstream es
Bootstrap 3 y tampoco tiene `main`, y el plan registra que apuntar la herramienta
a `ref` devuelve ese error a propósito. Caer siempre a `document.body` habría
convertido un aviso correcto en un volcado de basura con buena pinta.
*/
describe('una pantalla sin <main>', () => {
  it('se lee si es la nuestra, que se reconoce por #root', () => {
    document.body.innerHTML = '<div id="root"><h1>Technitium DNS Server</h1><p>Login</p></div>'

    const c = contract({ stamp: SELLO })
    expect(c.error).toBeUndefined()
    expect(c.title).toBe('Technitium DNS Server')
  })

  it('y sigue avisando cuando NO lo es, que es el caso de upstream', () => {
    document.body.innerHTML = '<div class="container"><h1>Technitium DNS Server</h1></div>'

    expect(contract({ stamp: SELLO })).toEqual({ error: 'no main element' })
  })
})

/*
El texto que ningún otro selector nombra.

`prose` busca `p`, `li`, `role=alert`, `dd`, `code`… y en el Login eso no
encuentra nada: sus dos únicos textos son la marca y el crédito del tema. El
contrato salía con dos campos, dos botones y seis enlaces, y perdía las dos
frases que hay en la pantalla.
*/
describe('el texto suelto', () => {
  it('recoge un texto que comparte padre con un enlace', () => {
    /* «Theme: byGarcia»: el texto y el enlace son hermanos, así que el div no es
       hoja y un recorrido por elementos hoja lo perdía. */
    document.body.innerHTML = '<main><div class="_credit_x1">Theme: <a href="#">byGarcia</a></div></main>'

    expect(contract({ stamp: SELLO }).strays).toContain('Theme:')
  })

  it('no recoge el texto de un botón ni el de un enlace', () => {
    document.body.innerHTML = '<main><button>Login</button><a href="#">GitHub</a></main>'
    expect(contract({ stamp: SELLO }).strays).toEqual([])
  })

  /*
  Y no duplica lo que el contrato ya estructura. Medido en el Dashboard: sin este
  filtro salían 49 sueltos y los 49 eran tarjetas, counters o filas de top-N ya
  recogidas — incluidos los valores sembrados, que habrían viajado otra vez como
  texto plano y sin su marca de volátiles.
  */
  it('no repite lo que ya viaja como tarjeta', () => {
    document.body.innerHTML =
      '<main><div data-testid="metrics">' +
      '<div class="_tile_x1"><div class="_v_x1">304</div><div class="_k_x1">Total Queries</div></div>' +
      '</div></main>'

    const c = contract({ stamp: SELLO })
    expect(c.overview.cards).toHaveLength(1)
    expect(c.strays).not.toContain('Total Queries')
    expect(c.strays).not.toContain('304')
  })

  it('ni lo que ya viaja como fila de un top-N', () => {
    document.body.innerHTML =
      '<main>' + panel('Top Clients',
        '<div class="_toprow_x1"><span class="_n_x1">127.0.0.1</span><span class="_c_x1">103</span></div>') +
      '</main>'

    const c = contract({ stamp: SELLO })
    expect(c.strays).not.toContain('127.0.0.1')
    expect(c.strays).not.toContain('103')
    expect(c.strays).not.toContain('Top Clients')
  })
})

/*
Los verbos de la pantalla, cuando el botón no tiene texto.

Medido en Zones el 2026-09-03: `screenActions` devolvía **doce cadenas vacías**.
`Add Zone`, `Delete Zones` y `Go` estaban entre ellas. Un contrato que dice
`["", "", …]` no puede desmentir a un diseño que vuelva sin `Add Zone`.
*/
describe('los verbos de la pantalla', () => {
  it('lee el texto cuando lo hay', () => {
    pantalla('<div class="_hrow_x"><h1>Zones</h1><div class="_acts_x"><button>Add Zone</button><button>Delete Zones</button></div></div>')
    expect(contract({ stamp: SELLO }).screenActions).toEqual(['Add Zone', 'Delete Zones'])
  })

  /*
  Y NO por posición. Esta es la que faltaba: el selector miraba «el primer hijo de
  `main`», y el día que el cromo ganó una ranura vacía delante, `screenActions`
  pasó a devolver los botones de las filas mientras `Add Zone` desaparecía.
  */
  it('los encuentra aunque algo se cuele delante del encabezado', () => {
    /*
    El verbo va suelto en la fila del encabezado, SIN caja `_acts_`: así el único
    camino que lo encuentra es el anclaje al `h1`. Con la caja, la prueba pasaba
    también con el selector viejo y no probaba nada — comprobado quitando el
    anclaje y viéndola seguir en verde.
    */
    pantalla(
      '<div class="_ranura_x"></div>' +
      '<div class="_hrow_x"><h1>Zones</h1><button>Add Zone</button></div>' +
      '<table><tbody><tr><td><button>Zone Options</button></td></tr></tbody></table>',
    )
    expect(contract({ stamp: SELLO }).screenActions).toEqual(['Add Zone'])
  })

  it('y el nombre accesible cuando el botón es sólo icono', () => {
    pantalla('<div class="_hrow_x"><h1>Zones</h1><div class="_acts_x"><button aria-label="Add Zone"><svg></svg></button></div></div>')
    expect(contract({ stamp: SELLO }).screenActions).toEqual(['Add Zone'])
  })

  /* Un botón sin texto Y sin nombre no se cuela como cadena vacía: es un defecto
     de la pantalla, y ya sale en `counts.buttons`. */
  it('descarta el que no tiene ni texto ni nombre', () => {
    pantalla('<div class="_hrow_x"><h1>Zones</h1><div class="_acts_x"><button>Go</button><button><svg></svg></button></div></div>')
    expect(contract({ stamp: SELLO }).screenActions).toEqual(['Go'])
  })
})

/*
Los verbos de la pantalla NO son los de una fila.

Zones lo enseñó: `screenActions` devolvía `Zone Options` y `Enable Zone`, que son
de la fila, mientras `Add Zone` faltaba. La lista parecía llena y le faltaba el
único verbo que crea algo.
*/
describe('los verbos de la pantalla, frente a los de una fila', () => {
  const CON_FILA =
    '<div class="_hrow_x"><h1>Zones</h1><div class="_acts_x"><button>Add Zone</button><button>Delete Zones</button></div></div>' +
    '<table><thead><tr>' +
      '<th><input type="checkbox" aria-label="Select all zones" /></th>' +
      '<th>#</th><th>Zone</th><th>Type</th><th>DNSSEC</th><th>Status</th><th>Serial</th><th>Expiry</th><th>Last Modified</th>' +
      '<th></th>' +
    '</tr></thead><tbody><tr>' +
      '<td><input type="checkbox" aria-label="Select casa.test" /></td>' +
      '<td>1</td><td>casa.test</td><td>Primary</td><td>Signed</td><td>Disabled</td><td>27</td><td></td><td>2026-08-26</td>' +
      '<td class="_actions_x"><button>Zone Options</button><button>Enable Zone</button>' +
      '<button aria-label="Actions for casa.test">⋯</button></td>' +
    '</tr></tbody></table>'

  it('sólo salen los del encabezado', () => {
    pantalla(CON_FILA)
    expect(contract({ stamp: SELLO }).screenActions).toEqual(['Add Zone', 'Delete Zones'])
  })

  it('y los de la fila NO se cuelan', () => {
    pantalla(CON_FILA)
    const a = contract({ stamp: SELLO }).screenActions
    expect(a).not.toContain('Zone Options')
    expect(a).not.toContain('Enable Zone')
    expect(a).not.toContain('Actions for casa.test')
  })

  /*
  Y las DIEZ columnas, con las dos sin rótulo nombradas. Contar ocho es contar
  sólo las que llevan texto, y deja fuera la selección múltiple y la columna donde
  viven las acciones de fila.
  */
  it('conserva las diez columnas y distingue las dos sin rótulo', () => {
    pantalla(CON_FILA)
    const cols = contract({ stamp: SELLO }).tables[0].columns

    expect(cols).toHaveLength(10)
    expect(cols.map((c) => c.label)).toEqual([
      '(selección)', '#', 'Zone', 'Type', 'DNSSEC', 'Status', 'Serial', 'Expiry', 'Last Modified', '(acciones)',
    ])
    expect(cols.filter((c) => c.sinRotulo)).toHaveLength(2)
    expect(cols.filter((c) => !c.sinRotulo)).toHaveLength(8)
  })
})

/*
Ningún botón puede quedarse sólo CONTADO.

El defecto medido el 2026-09-03 en `/dnsclient/`: `screenActions: []` y
`counts.buttons: 4`. Los dos únicos verbos de esa pantalla —`Resolve` e `Import`—
viven en la barra de consulta y no en el encabezado, así que el contrato que
existe para que no se pierda nada no nombraba ni una acción. Y de esos cuatro
botones, dos eran en realidad los desplegables de `Type` y `DNS-over-`.

La invariante que lo cierra es simple y no depende de clasificar bien:
`buttons.length === counts.buttons`. El `where` puede equivocarse sin que se
pierda nada, porque el nombre está siempre.
*/
describe('ningún botón queda sólo contado', () => {
  const BARRA =
    '<div class="_hrow_x"><h1>DNS Client</h1></div>' +
    '<div class="_flt_x">' +
      '<div class="_field_x"><label for="srv">Server</label><input id="srv" /></div>' +
      '<div class="_field_x"><button role="combobox" aria-label="Type">A</button></div>' +
      '<button>Resolve</button><button>Import</button>' +
    '</div>'

  it('la lista de botones y el recuento coinciden', () => {
    pantalla(BARRA)
    const c = contract({ stamp: SELLO })
    expect(c.buttons).toHaveLength(c.counts.buttons)
  })

  it('nombra los verbos de la barra, que `screenActions` no ve', () => {
    pantalla(BARRA)
    const c = contract({ stamp: SELLO })

    expect(c.screenActions).toEqual([])
    expect(c.buttons.map((b) => b.name)).toContain('Resolve')
    expect(c.buttons.map((b) => b.name)).toContain('Import')
  })

  /*
  Y el envoltorio de `Settings` no puede volver a esconderlos. El primer intento
  usaba una regla de profundidad —hijo directo de un hijo directo de `main`— y
  perdía los cuatro verbos de esa pantalla, que envuelve su contenido en un `div`.
  */
  it('los encuentra aunque la pantalla envuelva su contenido', () => {
    pantalla('<div class="_wrap_x"><div class="_hrow_x"><h1>Settings</h1></div>' +
      '<div class="_bar_x"><button>Save Settings</button><button>Flush Cache</button></div></div>')
    const c = contract({ stamp: SELLO })

    expect(c.buttons).toHaveLength(c.counts.buttons)
    expect(c.buttons.map((b) => b.name)).toEqual(['Save Settings', 'Flush Cache'])
  })

  /*
  El sello viaja dentro de `deps` —lo exige la guarda— y `governedBy` iteraba
  `Object.keys(deps)`. La primera pantalla con dependencias de verdad no daba una
  lectura rara: daba un `TypeError`. Se filtra por forma, no por nombre.
  */
  it('el sello dentro de `deps` no rompe `governedBy`', () => {
    pantalla('<div class="_hrow_x"><h1>General</h1></div>' +
      '<section class="_block_x"><h2>EDNS Client Subnet</h2>' +
      '<div class="_row_x"><label for="p">ECS IPv4 Prefix Length</label>' +
      '<input id="p" disabled /></div></section>')

    const c = contract({ stamp: SELLO, 'Enable EDNS Client Subnet': ['ECS IPv4 Prefix Length'] })

    /* Se comprueba que el campo LLEGÓ a un bloque: si se quedara suelto,
       `governedBy` no se evaluaría y la prueba pasaría sin ejercitar nada. */
    expect(c.blocks[0].fields.map((f) => f.label)).toEqual(['ECS IPv4 Prefix Length'])
    expect(c.blocks[0].fields[0].governedBy).toEqual(['Enable EDNS Client Subnet'])
  })
})
