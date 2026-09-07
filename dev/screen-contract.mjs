/*
CONGELADO PARA ZONES — 2026-09-03, sello `b19f0b7956396200`.

A partir de aquí **no se amplía el analizador salvo pérdida funcional concreta
demostrada contra el fuente**. Las particularidades de cada pantalla se anotan en
SU contrato, no aquí.

El motivo está medido: construir la fase 3 cegó a este fichero dos veces y en
silencio. La ranura del cromo pasó a ser el primer hijo de `main` y
`screenActions` empezó a devolver los verbos de las FILAS; el reparto de las once
cards en dos grupos hizo que `cardEls` contara **2 donde había 11**. Ninguna de
las dos dio error: dieron otra respuesta. Un analizador que se persigue a sí mismo
en cada pantalla acaba siendo el trabajo, en vez de la herramienta del trabajo.

Lo que se arregló antes de congelar, y por qué cada uno podía ocultar una pérdida:

  · `screenActions` leía sólo el texto —doce cadenas vacías en Zones, con
    `Add Zone` entre ellas— y se apoyaba en el ORDEN de los hijos. Ahora lee el
    nombre accesible y se ancla al `h1`, **y sólo al encabezado**: la acción de una
    fila o de un panel no es de la pantalla.
  · `cardEls` contaba hijos directos. Ahora reconoce una card por su FORMA
    —cifra y rótulo—, que es lo que sobrevive a un reagrupado.
  · Las columnas sin rótulo salían como cadena vacía. Zones tiene DIEZ columnas
    estructurales y sólo ocho llevan texto; contar ocho pierde de vista la
    selección múltiple y la columna de acciones.

## Lo que se ha tocado DESPUÉS de congelar, y por qué la puerta era ésta

El congelado dice «salvo pérdida funcional concreta demostrada contra el fuente».
El 2026-09-03, preparando el arquetipo herramienta, se cruzó dos veces:

  · **`/dnsclient/` devolvía `screenActions: []` y `counts.buttons: 4`.** Sus DOS
    únicos verbos —`Resolve` e `Import`— viven en la barra de consulta, no en el
    encabezado; y dos de esos cuatro botones eran en realidad los desplegables de
    `Type` y `DNS-over-`. Un contrato que no nombra ninguna acción de la pantalla
    que va a rediseñarse es exactamente la deserción que este fichero existe para
    impedir. Se añadió `buttons` —TODOS, con el sitio de cada uno como dato— y
    **`screenActions` no se tocó**: la invariante nueva es
    `buttons.length === counts.buttons`, así que nada queda sólo contado.
  · **`governedBy` reventaba** en cuanto una pantalla tenía dependencias de verdad:
    el sello viaja dentro de `deps` —lo exige la guarda del propio `contract()`— y
    se iteraban todas las claves. `/settings/general/` daba `TypeError`, no una
    lectura rara. Se filtra por forma —sólo las claves cuyo valor es una lista— y
    no por nombre.

Las dos van con prueba y con prueba NEGATIVA en `screen-contract.test.mjs`.

The exact contract of a screen: everything on it that is not allowed to be lost.

This exists because of how the redesign work is handed out. Each screen goes to
an external design tool as a prompt, comes back as a layout, and gets built. The
failure mode of that loop is not ugliness, it is ATTRITION: a control that was on
the screen, was not mentioned in the prompt, and quietly does not come back.

Under this project's rule —design only, zero functionality— a lost control is
not a regression to fix later, it is the one thing that may never happen. So the
prompt carries this dump, and the returned design is checked against the same
dump, field by field.

    Paste into the browser console on the screen you want, or pass to
    `browser_evaluate`:

        contract()

What it deliberately does NOT capture: colour, spacing, order, or anything about
how the screen looks. Those are what the design tool is being asked to change.

## v2, and why there had to be one

v1 asked the DOM for `input, select, textarea` and called that the inventory. It
was wrong in the exact way this file exists to prevent: `ui/Select.tsx` is not a
native `<select>`, it is a `<button role="combobox">` with a listbox, so **every
select in the console was invisible to the tool built to stop controls going
missing**. Eight screens use it.

v2 therefore asks by ROLE as well as by tag, and captures what v1 threw away:
the options behind a closed listbox, `disabled` / `required` / `readonly`, links,
and whichever of empty / loading / error the screen is currently in. A control
that can be reached but not described is the same as a control that was lost.

## v3: order goes, relations stay

The inventory travels to design without visual order, because order is what the
redesign is being asked to decide. Stripping it must not strip meaning: a flat
alphabetical list of labels is not a contract, it is a word cloud.

So each entry carries, attached to it rather than merely near it, its helper text,
its options, the actions that operate on it, and what it depends on.

Dependencies are the one relation the DOM does not state at rest: a field that is
greyed out because a master switch is off looks the same as one that is greyed out
always. `dependencies()` finds them by experiment — it toggles each switch and
records which other controls changed. Run it before `contract()` and pass the
result in.
*/

/*
Which control governs which. Found by toggling, because the DOM does not say it.

Every checkbox and switch on the screen is flipped in turn, and the disabled set
is compared before and after. What changed is what that control governs. The
screen is left as it was found: each control is flipped back immediately.

Known gaps, measured on Settings > Blocking:

  · It toggles checkboxes and switches, not RADIOS. On Blocking it correctly
    reports that `Enable Blocking` governs eight controls, and misses that
    `Custom Blocking Addresses` is governed by the `Custom Address` radio being
    the chosen one. Radio-driven dependencies need the same experiment run over
    each option of a group.
  · It does not catch dependencies that only appear after a save, nor ones that
    change what is VISIBLE rather than what is ENABLED.

Both are read from the code and passed in by hand until the experiment covers
them. What it catches unaided is the common case: a master switch greying out its
block.
*/
export async function dependencies(root = null) {
  const main = root ?? document.querySelector('main')
  if (!main) return {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const all = () => [...main.querySelectorAll('input, select, textarea, [role="combobox"], [role="switch"]')]
  const disabledSet = () =>
    new Set(all().filter((e) => e.disabled || e.getAttribute('aria-disabled') === 'true'))

  const switches = all().filter((e) => e.type === 'checkbox' || e.getAttribute('role') === 'switch')
  const out = {}

  for (const sw of switches) {
    if (sw.disabled) continue
    const before = disabledSet()
    sw.click()
    await sleep(60)
    const after = disabledSet()
    sw.click()
    await sleep(60)

    const changed = [...new Set([...before, ...after])].filter((e) => before.has(e) !== after.has(e))
    if (changed.length) {
      const name = (el) => {
        const l = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
        return (l?.textContent || el.getAttribute('aria-label') || el.closest('label')?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
      }
      out[name(sw)] = changed.map(name)
    }
  }
  return out
}

/*
The options behind a CLOSED listbox, read by opening it.

`ui/Select` only writes `aria-controls` while it is open, so a contract taken at
rest reports `options: null` for every combobox in the console — and an option
list nobody can enumerate is an option list that can go missing one entry at a
time, which is the sentence already written above `optionsOf`. It was true of the
screens too and went unnoticed because the two on Zones were read by hand.

Same shape as `dependencies()`: an experiment that leaves the surface as it found
it, run before `contract()` and passed in.
*/
export async function options(root = null) {
  const main = root ?? document.querySelector('main')
  if (!main) return {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const out = {}

  for (const box of main.querySelectorAll('[role="combobox"]')) {
    if (box.disabled || box.getAttribute('aria-disabled') === 'true') continue
    const name =
      box.getAttribute('aria-label') ||
      txt(box.closest('label')) ||
      txt(box.closest('[class*="field"], [class*="Field"]')?.querySelector('label')) ||
      '(unlabelled)'
    box.click()
    await sleep(180)
    const id = box.getAttribute('aria-controls')
    const list = id ? document.getElementById(id) : document.querySelector('[role="listbox"]')
    /* With their disabled state: an option that is present-but-forbidden is a
       different fact from an option that is not there, and `ConvertZone` is made
       of exactly that difference — it lists the zone's own type and forbids it. */
    if (list) {
      out[name] = [...list.querySelectorAll('[role="option"]')].map((o) =>
        o.getAttribute('aria-disabled') === 'true' || o.hasAttribute('disabled')
          ? `${txt(o)} (disabled)`
          : txt(o),
      )
    }
    box.click()
    await sleep(120)
  }
  return out
}

/*
What each choice MOUNTS, which a single snapshot cannot see.

`AddEditRecord` has 19 record types in its dropdown and each one puts different
fields on the screen — 46 distinct data fields between them. A contract taken with
`A` selected reports one of those 46, `IPv4 Address`, and looks complete. `AddZone`
does the same with nine zone-type radios, `ConvertZone` with its targets.

So every choice is walked and **each one produces a full `contract()`**, not a list
of names. Five things that version one of this function got wrong, all of them the
same mistake in different clothes — assuming the DOM stays where you left it:

  1. **A disabled option does not close the listbox.** Clicking it selects nothing
     and leaves the list open, so the next iteration's "open" actually closes it
     and everything after is off by one. Bites on `ConvertZone`, whose targets are
     disabled for the zone's own type. Disabled options are recorded and skipped,
     and the list is closed with Escape rather than by clicking again.
  2. **Names are not a contract.** A revealed control has options, help, state and
     actions like any other; keeping only its label loses precisely what the design
     needs in order not to invent it.
  3. **The world is re-queried.** A variant can mount ANOTHER chooser, and a list
     of choosers taken once at the start never visits it.
  4. **Labels collide.** `Algorithm` appears in Sign Zone and in DNSSEC Properties;
     indexing by label alone silently overwrites one with the other. Controls are
     keyed by context + label + ordinal.
  5. **Restore by identity, not by appearance.** Putting the original choice back
     by matching visible text fails the moment two options read the same; the
     option's own value is what is remembered.
*/
export async function variants(root = null, only = null, isolate = null) {
  let main = root ?? document.querySelector('main')
  if (!main) return {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()

  /* A control's identity: where it lives, what it is called, and which one of
     the ones called that. Enough to survive re-querying and repeated labels. */
  const idOf = (el, all) => {
    const label =
      el.getAttribute('aria-label') ||
      txt(el.closest('label')) ||
      txt(el.closest('[class*="field"], [class*="Field"]')?.querySelector('label')) ||
      '(unlabelled)'
    const box = el.closest('fieldset, section, [class*="Block"], [class*="block"], [class*="group"]')
    const context = txt(box?.querySelector('h1,h2,h3,h4,legend,[class*="title"]')) || ''
    const sameName = all.filter((o) => {
      const l =
        o.getAttribute('aria-label') ||
        txt(o.closest('label')) ||
        txt(o.closest('[class*="field"], [class*="Field"]')?.querySelector('label')) ||
        '(unlabelled)'
      return l === label
    })
    const ordinal = sameName.length > 1 ? `#${sameName.indexOf(el) + 1}` : ''
    return [context, label, ordinal].filter(Boolean).join(' › ')
  }

  /*
  What counts as a chooser, and what does not.

  Three things this got wrong until 2026-09-02, all of them the same assumption:
  that a chooser is a select, a radio or a combobox, and that choosing is
  reversible state.

    · TABS are choosers. `Zone Options` is five of them — General, Query Access,
      Zone Transfer, Notify, Dynamic Updates — and a sweep that ignores tablists
      described one fifth of the dialog and called it the dialog.
    · A BUTTON can be a chooser. `Add Private Key` in DNSSEC Properties toggles a
      whole form into existence; nothing about it is a select.
    · And some selects do not select, they ACT. `Add User` and `Add Group` in
      Zone Permissions add a row on change (`PermissionsTable`, `addLabel`), so
      walking them does not visit states, it accumulates them — the sweep was
      leaving users and groups behind in the dialog it was measuring.

  Action-like controls are recorded and NOT walked. Everything else is walked,
  and with `isolate` each option gets a fresh instance so accumulation cannot
  happen even where it is not foreseen.
  */
  const ACTS_NOT_SELECTS = /^(add|remove|delete|new)\b/i
  const actsRatherThanSelects = (el) => {
    const name = el.getAttribute('aria-label') || txt(el.closest('label')) ||
      txt(el.closest('[class*="field"], [class*="Field"]')?.querySelector('label')) || ''
    return ACTS_NOT_SELECTS.test(name.trim())
  }

  const choosers = () => [
    ...main.querySelectorAll('[role="combobox"], select'),
    ...main.querySelectorAll('[role="tab"]'),
    ...[...new Set([...main.querySelectorAll('input[type="radio"]')].map((r) => r.name).filter(Boolean))]
      .map((n) => main.querySelector(`input[type="radio"][name="${CSS.escape(n)}"]`)),
  ].filter(Boolean)

  /*
  Closing the listbox by clicking its own button, NOT with Escape.

  Escape inside a Radix dialog closes the DIALOG, not the list on top of it. The
  first version of this closed with Escape, so the very first chooser it walked
  tore down the surface it was measuring and every step after failed silently
  into an empty result — a sweep that returns `{Type: []}` and looks like "this
  dialog has no variants" rather than like a crash.
  */
  const closeBox = async (live) => {
    if (live && live.getAttribute('aria-expanded') === 'true') {
      live.click()
      await sleep(160)
    }
  }

  /* The full contract under the current choice, with its listboxes opened so the
     revealed controls do not arrive with `options: null`. */
  /*
  The two guards, and both of them are here because of what happened without
  them: a sweep that tore down the dialog it was measuring returned
  `{Type: []}` — which reads as "this dialog has no variants" and not as a
  crash, and a silent zero is the one result a contract tool must never give.
  */
  const assertAlive = (where) => {
    if (!main.isConnected) {
      throw new Error(
        `variants(): the root came off the document at ${where}. ` +
          'Something closed the surface being measured — an Escape that reached ' +
          'the dialog, a navigation, a re-render. The sweep is void, not empty.',
      )
    }
  }

  const snapshot = async () => {
    assertAlive('snapshot')
    return contract({}, main, await options(main))
  }

  /*
  A clean instance per variant, when the caller can give one.

  Without it a sweep is cumulative by nature: whatever a step leaves behind — a
  row added, a checkbox flipped, a field filled — is inside every snapshot after
  it, and the later a variant is walked the more of the earlier ones it contains.
  `isolate` closes the surface and opens it again, so each option is measured on
  a dialog that has seen nothing else.

  Without it the sweep still runs, in place, and says so in the result.
  */
  const reopen = async () => {
    if (!isolate) return main
    const fresh = await isolate()
    if (!fresh) throw new Error('variants(): isolate() gave nothing back to measure.')
    main = fresh
    return main
  }

  /* At the door, not only at the end. The first version checked after walking a
     chooser — and a dead root fails to OPEN one, hits the `continue` above, and
     never reaches the check. A guard placed after the early exit guards nothing. */
  assertAlive('entry')

  const out = { __isolated: Boolean(isolate) }
  const done = new Set()

  for (let pass = 0; pass < 4; pass++) {
    const pending = choosers().filter((c) => !done.has(idOf(c, choosers())))
    if (!pending.length) break

    for (const chooser of pending) {
      const id = idOf(chooser, choosers())
      if (done.has(id)) continue
      done.add(id)
      if (only && id !== only && !id.endsWith(only)) continue

      const isRadio = chooser.type === 'radio'
      const isNative = chooser.tagName === 'SELECT'
      const isTab = chooser.getAttribute('role') === 'tab'

      if (!isTab && actsRatherThanSelects(chooser)) {
        out[id] = { kind: 'acts', note: 'This control acts on change — it adds, it does not select. Not walked.' }
        continue
      }

      out[id] = {
        kind: isTab ? 'tabs' : isRadio ? 'radios' : isNative ? 'select' : 'combobox',
        options: {},
      }

      if (isTab) {
        const strip = chooser.closest('[role="tablist"]') ?? main
        const names = [...strip.querySelectorAll('[role="tab"]')].map(txt)
        const originalName = txt([...strip.querySelectorAll('[role="tab"]')].find((t) => t.getAttribute('aria-selected') === 'true'))
        for (const name of names) {
          const fresh = await reopen()
          const tab = [...fresh.querySelectorAll('[role="tab"]')].find((t) => txt(t) === name)
          if (!tab) continue
          tab.click()
          await sleep(260)
          out[id].options[name] = { disabled: false, contract: await snapshot() }
        }
        if (!isolate && originalName) {
          const back = [...main.querySelectorAll('[role="tab"]')].find((t) => txt(t) === originalName)
          if (back) { back.click(); await sleep(220) }
        }
        assertAlive(`after walking ${id}`)
        continue
      }

      if (isRadio) {
        const members = [...main.querySelectorAll(`input[type="radio"][name="${CSS.escape(chooser.name)}"]`)]
        const original = members.findIndex((r) => r.checked)
        for (let i = 0; i < members.length; i++) {
          await reopen()
          const live = [...main.querySelectorAll(`input[type="radio"][name="${CSS.escape(chooser.name)}"]`)][i]
          if (!live) continue
          const name = idOf(live, [live])
          if (live.disabled) { out[id].options[name] = { disabled: true }; continue }
          live.click()
          await sleep(200)
          out[id].options[name] = { disabled: false, contract: await snapshot() }
        }
        const back = [...main.querySelectorAll(`input[type="radio"][name="${CSS.escape(chooser.name)}"]`)][original]
        if (back) { back.click(); await sleep(200) }
        continue
      }

      if (isNative) {
        const original = chooser.value
        for (const opt of [...chooser.options]) {
          const name = txt(opt) || opt.value
          if (opt.disabled) { out[id].options[name] = { disabled: true }; continue }
          chooser.value = opt.value
          chooser.dispatchEvent(new Event('change', { bubbles: true }))
          await sleep(180)
          out[id].options[name] = { disabled: false, contract: await snapshot() }
        }
        chooser.value = original
        chooser.dispatchEvent(new Event('change', { bubbles: true }))
        await sleep(180)
        continue
      }

      /* The combobox. Its options are addressed by their own value, so that two
         options reading the same do not become one. */
      const open = async () => {
        const live = choosers().find((c) => idOf(c, choosers()) === id)
        if (!live) return null
        live.click()
        await sleep(200)
        const ac = live.getAttribute('aria-controls')
        return ac ? document.getElementById(ac) : document.querySelector('[role="listbox"]')
      }
      const liveOf = () => choosers().find((c) => idOf(c, choosers()) === id)
      const first = await open()
      if (!first) {
        assertAlive(`opening ${id}`)
        throw new Error(
          `variants(): "${id}" is a combobox that would not open. ` +
            'Either it is not the control it claims to be or the surface moved ' +
            'under the sweep. Not something to skip quietly.',
        )
      }
      const keys = [...first.querySelectorAll('[role="option"]')].map((o, i) => ({
        key: o.getAttribute('data-value') ?? o.id ?? String(i),
        text: txt(o),
        disabled: o.getAttribute('aria-disabled') === 'true' || o.hasAttribute('disabled'),
        selected: o.getAttribute('aria-selected') === 'true',
      }))
      const originalKey = keys.find((k) => k.selected)?.key
      await closeBox(liveOf())

      for (const k of keys) {
        if (k.disabled) { out[id].options[k.text] = { disabled: true }; continue }
        await reopen()
        const list = await open()
        const opt = list && [...list.querySelectorAll('[role="option"]')]
          .find((o, i) => (o.getAttribute('data-value') ?? o.id ?? String(i)) === k.key)
        if (!opt) { await closeBox(liveOf()); continue }
        opt.click()
        await sleep(240)
        out[id].options[k.text] = { disabled: false, contract: await snapshot() }
      }
      if (originalKey != null) {
        const list = await open()
        const back = list && [...list.querySelectorAll('[role="option"]')]
          .find((o, i) => (o.getAttribute('data-value') ?? o.id ?? String(i)) === originalKey)
        if (back) { back.click(); await sleep(220) } else { await closeBox(liveOf()) }
      }
      assertAlive(`after walking ${id}`)
      if (keys.length && !Object.keys(out[id].options).length) {
        throw new Error(
          `variants(): "${id}" listed ${keys.length} options and recorded none. ` +
            'The walk broke; it did not find an empty control.',
        )
      }
    }
  }
  return out
}

/*
`root` is what makes this usable on a DIALOG and not only on a screen.

A dialog is a surface with its own fields, its own help texts and its own footer,
and eleven of them come with Zones alone. They render in a portal, outside
`<main>`, so until 2026-09-02 the only instrument that could describe them was the
one that hunts for defects (`dialog-census.js`) — which answers "is anything
broken" and not "what is on it". A design prompt needs the second question
answered or the design invents the fields.

    contract()                                  the screen
    contract({}, document.querySelector('[role="dialog"]'))   the dialog on top
*/

/*
## v4 — el arquetipo de vista general

`contract()` v3 sabía leer un formulario y una colección. Apuntado al Dashboard
devolvía cuatro cosas falsas, y las cuatro por el mismo motivo: **una vista
general no es una pantalla, son regiones**.

  · `state: "empty"` sobre una pantalla con 304 consultas y cuatro gráficas. Leía
    el único hueco vacío que quedaba —`Top Blocked Domains`, que en esta instancia
    no puede tener dato— y lo daba por estado del conjunto.
  · Las once cards llegaban fundidas en UNA cadena de `prose`:
    `"304 Total Queries6621.71%No Error44…"`. Eso es la nube de palabras contra la
    que avisa la cabecera de v3, y con ella perder una card es invisible.
  · `tables: 0` con tres listas top-N pintadas, porque el resumen compacto no es
    un `<table>` sino filas de `div`.
  · `tool: "unstamped"`: el volcado no decía con qué se tomó.

Así que v4 añade el vocabulario que faltaba —card, gráfica y lista top-N—, el
estado **por región**, y un sello doble.
*/

/*
Los elementos que ya se cuentan como card o como contador.

Se buscan por FORMA y no por parentesco directo. El selector era
`[data-testid="metrics"] > *` —«los hijos de la caja»— y aguantó mientras las
once cards colgaban planas de ella. Dejó de aguantar el 2026-09-03, cuando la
fase 3 las repartió en dos grupos: el contrato pasó a decir **2 cards donde
hay 11**, y de paso las once volvieron a contarse como regiones.

Un contrato que dice 2 no puede desmentir a un diseño que devuelva 2. Y el
reparto es justo lo que esta fase hace con las pantallas, así que atarse al
parentesco era atarse a lo único que iba a cambiar.

Una card es lo que tiene **cifra y rótulo**, esté donde esté. Se excluyen las
que contienen otra dentro, para no contar el grupo además de sus miembros.
*/
const porForma = (main, testid) => {
  const caja = main.querySelector(`[data-testid="${testid}"]`)
  if (caja == null) return []
  const todos = [...caja.querySelectorAll('*')].filter(
    (e) => e.querySelector('[class*="_v_"]') != null && e.querySelector('[class*="_k_"]') != null,
  )
  return todos.filter((e) => !todos.some((o) => o !== e && e.contains(o)))
}
const cardEls = (main) => porForma(main, 'metrics')
const counterEls = (main) => porForma(main, 'counters')

/*
La caja de una región: en esta consola es `ui/Panel`, y sólo las de fuera.

Y **no toda caja con clase de panel es una región**. Medido en el Dashboard: las
once cards salían como once regiones sin nombre, porque `.tile` **compone**
`panel` en CSS Modules y por tanto lleva su clase. Una card no es una región:
no tiene estado propio ni título con el que referirse a ella, y once regiones
llamadas `null` en un contrato no se pueden nombrar y por tanto no sirven.

Se excluyen por ROL —lo que el propio lector ya cuenta como card o contador— y
no por «no tiene título»: `ui/Panel` admite quedarse sin título a propósito
—«with no title, the panel just groups»— y un panel así con una tabla dentro sí
es una región cuyo estado importa. Filtrar por título habría perdido ésa.
*/
function regionRoots(main) {
  const noSonRegion = new Set([...cardEls(main), ...counterEls(main)])
  const todos = [...main.querySelectorAll('[class*="_panel_"]')].filter((p) => !noSonRegion.has(p))
  return todos.filter((p) => !todos.some((o) => o !== p && o.contains(p)))
}

/*
El estado de UN trozo de pantalla, con las mismas señales que v3 usaba para el
conjunto. Se saca aparte precisamente para poder preguntarlo por región.
*/
function stateOfRegion(root) {
  const alert = root.querySelector('[role="alert"]')
  const isFailure = alert && /_danger_|_warning_/.test(alert.className)
  if (root.querySelector('[class*="_loading_"]')) return 'loading'
  if (isFailure) return 'error'
  if (root.querySelector('[class*="_box_"], [class*="_line_"]')) return 'empty'
  return 'populated'
}

/**
 * El estado por región, que es el que una vista general necesita.
 *
 * El Dashboard puede estar **a la vez poblado y vacío** y las dos cosas ser
 * ciertas: `Top Domains` con dato y `Top Blocked Domains` sin él, porque esta
 * instancia no tiene lista de bloqueo. Un único `state` no puede decir eso, y al
 * intentarlo dijo que la pantalla entera estaba vacía.
 */
export function regions(root = null) {
  const main = root ?? document.querySelector('main')
  if (!main) return []
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return regionRoots(main).map((p) => ({
    name: txt(p.querySelector('h2')) || txt(p.querySelector('[class*="_title_"]')) || null,
    state: stateOfRegion(p),
  }))
}

/**
 * El sello, doble y a propósito.
 *
 * `instrument` es el SHA-256 del CÓDIGO DE ESTA HERRAMIENTA, leído de su propia
 * URL: dice qué lector produjo el volcado. `bundle` son los ficheros que la
 * página tiene cargados: dice qué consola se leyó. Hacen falta los dos — un
 * contrato correcto tomado del bundle viejo es tan inútil como uno tomado con un
 * lector viejo, y ya pasó una vez con un barrido de uniformidad.
 *
 * Es `async` porque `crypto.subtle` lo es, así que se pasa a `contract()` como
 * ya se le pasan `dependencies` y `options`.
 */
export async function stamp() {
  const sha = async (t) => {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  const fuente = await (await fetch(import.meta.url)).text()
  const cargado = (sel, attr) =>
    [...document.querySelectorAll(sel)].map((e) => e.getAttribute(attr).split('/').pop())
  return {
    instrument: await sha(fuente),
    bundle: { css: cargado('link[rel=stylesheet]', 'href'), js: cargado('script[src]', 'src') },
  }
}

/**
 * El vocabulario de la vista general: card, contador, gráfica y lista top-N.
 *
 * Cada uno se lee por su identidad y no como texto, que es la diferencia entre
 * un contrato y una nube de palabras: si mañana falta `Refused`, aquí se ve;
 * fundido en un `prose` de 200 caracteres, no.
 */
/**
 * El cromo, leído desde `document` y no desde `<main>`.
 *
 * Todo lo demás de este fichero se enraíza en `main` a propósito: lo que se
 * rediseña es una pantalla. Pero el cromo **está fuera de `main` por
 * definición** —el raíl, la cabecera, el pie— y por eso ninguna herramienta lo
 * había medido nunca. Es el mismo agujero que tenía `dev/uniformity.js` con los
 * diálogos, que se arreglaron dándole una raíz compuesta.
 *
 * Y el cromo no es una pantalla más del recorrido: el plan dice que **se decide
 * con la primera**, porque la primera se dibuja dentro de él.
 */
export function chrome() {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const main = document.querySelector('main')
  /* Fuera de `main`: es la definición, no un filtro por si acaso. */
  const fuera = (sel) => [...document.querySelectorAll(sel)].filter((e) => !main || !main.contains(e))

  const enlaces = fuera('a[href]').map((a) => ({
    text: txt(a),
    href: a.getAttribute('href'),
    /* La entrada activa se anuncia, y perder ese anuncio es perder el «dónde
       estoy» para quien no ve la pantalla. */
    current: a.getAttribute('aria-current'),
    external: /^https?:/.test(a.getAttribute('href') || ''),
  }))

  return {
    nav: fuera('nav').map((n) => ({
      label: n.getAttribute('aria-label'),
      entries: [...n.querySelectorAll('a[href]')].map((a) => ({
        text: txt(a),
        href: a.getAttribute('href'),
        current: a.getAttribute('aria-current'),
      })),
    })),
    links: enlaces,
    buttons: fuera('button').map((b) => txt(b) || b.getAttribute('aria-label')),
    /* Prosa del cromo: la versión del servidor, el pie, el nombre del node. */
    prose: fuera('header *, footer *, [class*="_rail_"] *, [class*="_side_"] *')
      .filter((e) => e.children.length === 0)
      .map(txt)
      .filter((t) => t && t.length > 1),
    landmarks: [...document.querySelectorAll('header, footer, nav, aside, main')].map((e) => ({
      tag: e.tagName.toLowerCase(),
      label: e.getAttribute('aria-label'),
    })),
  }
}

/**
 * Las series y la legend, que NO viven en el DOM.
 *
 * `overview()` sólo puede decir `seriesReadable: false`, y eso vale como
 * evidencia del DOM pero no como contrato: si las series no viajan, un rediseño
 * puede devolver una gráfica con menos de las que el servidor manda y nada lo
 * dice. La regla de fase 1 es literal — «toda legend rotula todas las etiquetas
 * que manda el servidor».
 *
 * Así que se completan desde donde de verdad están, **declarando de dónde**:
 *
 *   · `api` — la respuesta de `dashboard/stats/get`, que según `Chart.tsx` llega
 *     YA en formato Chart.js y cuyos «valores, etiquetas y series» se pasan sin
 *     alterar. Es la fuente autorizada: lo que el servidor manda hoy.
 *   · `source` — lo que sólo está escrito en el código, como que **pulsar una
 *     serie en la legend la oculta**. Es una interacción que existe hoy y que
 *     con SVG se habría perdido; no hay forma de leerla de una respuesta.
 *
 * Se pasa el token porque la llamada lo necesita; es el mismo que usa la
 * pantalla.
 */
export async function chartSeries(token, { base = '' } = {}) {
  /*
  El tipo importa, y no es cosmético: **decide qué rotula la legend**.

  Medido contra la respuesta real: la de líneas trae ONCE datasets con nombre
  —`Total`, `No Error`, … `Clients`, las mismas once y en el mismo orden que las
  cards—, así que ahí la legend son los datasets. Las tres de sectores traen
  UN dataset sin nombre (`label: null`) y sus categorías van en `labels`
  —`Authoritative`, `A`, `SOA`, `Udp`—, así que ahí la legend son las `labels`.

  La primera versión de este lector daba `labels` por volátil en las cuatro. En la
  de líneas lo son —son las horas, `07:04`—, pero en las de sectores **son la
  legend**, y marcarlas volátiles habría permitido que un rediseño se dejara
  `Refused` fuera y pareciera «otro dato». Es exactamente lo que la regla de fase
  1 prohíbe: «toda legend rotula todas las etiquetas que manda el servidor».

  El tipo se toma de `Dashboard.tsx`, que es donde se elige (`:305` y `:99`).
  */
  const CAMPOS = {
    Queries: { campo: 'mainChartData', type: 'line' },
    'Query Response Types': { campo: 'queryResponseChartData', type: 'doughnut' },
    'Query Types': { campo: 'queryTypeChartData', type: 'doughnut' },
    'Protocol Types': { campo: 'protocolTypeChartData', type: 'doughnut' },
  }
  const r = await fetch(`${base}/api/dashboard/stats/get?token=${encodeURIComponent(token)}&type=LastHour`)
  const j = await r.json()
  const d = j?.response
  if (!d) return { error: 'sin respuesta', status: j?.status ?? r.status }

  return {
    source: 'api',
    endpoint: 'dashboard/stats/get',
    /* `type` va dentro: con otro rango son otras etiquetas, y eso es contexto y
       no contrato. */
    context: { type: 'LastHour' },
    charts: Object.entries(CAMPOS).map(([title, { campo, type }]) => {
      const labels = d[campo]?.labels ?? []
      const datasets = (d[campo]?.datasets ?? []).map((x) => x.label)
      const porDatasets = type === 'line'
      return {
        title,
        type,
        /* Lo que rotula la legend, que es lo que NO puede perderse. */
        legend: porDatasets ? datasets : labels,
        legendFrom: porDatasets ? 'datasets' : 'labels',
        datasets,
        labels,
        /*
        Y la volatilidad, con cuidado, porque aquí es fácil pasarse de listo en
        las dos direcciones.

        En la de líneas las `labels` son las horas del eje —`07:04`—: contexto
        puro, volátil. Sus once series **no** lo son: el servidor manda las once
        siempre, y son las mismas once cards (comprobado: misma lista y mismo
        orden, salvo que la consola rotula `Total` como `Total Queries`).

        En las de sectores la legend son las `labels`, y **también son volátiles
        en su contenido**: esta instancia dice `A`, `SOA`, `NS` porque es lo que
        se sembró; con otro tráfico dice otra cosa, y `Protocol Types` sólo dice
        `Udp` porque no ha entrado nada por TCP. La primera versión las marcó como
        no volátiles, que era afirmar que esa lista es fija.

        Lo que NO es volátil es la REGLA: **cada etiqueta que manda el servidor
        tiene que salir rotulada en la legend**, sean tres o treinta. Por eso va
        como `invariant` y no como una lista congelada — una lista de ejemplo
        tomada de un sembrado es la manera de que el rediseño devuelva tres
        sectores para siempre.
        */
        volatile: ['labels'],
        invariant: porDatasets
          ? 'Las once series del servidor se dibujan y se rotulan; son las once cards.'
          : 'Toda etiqueta que manda el servidor sale rotulada en la legend, sean las que sean.',
      }
    }),
    /*
    Y lo que ninguna respuesta puede decir, con su procedencia aparte.
    */
    legend: {
      source: 'source',
      file: 'src/screens/dashboard/Chart.tsx',
      behaviour: 'Pulsar una serie en la legend la oculta. Es una interacción que existe hoy y que no puede perderse.',
    },
  }
}

export function overview(root = null) {
  const main = root ?? document.querySelector('main')
  if (!main) return { cards: [], counters: [], charts: [], topN: [] }
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const tituloDe = (el) => {
    const p = el.closest('[class*="_panel_"]')
    return p ? txt(p.querySelector('h2')) || txt(p.querySelector('[class*="_title_"]')) || null : null
  }

  /*
  Las cards. `--tc` NO es decoración: es el token de serie que las ata a su
  trozo de la gráfica de `Queries` —`tokenForLabel(label, i)`—, y es la única
  prueba EN EL DOM de que la card y la serie son la misma cosa. Sin él, una
  redistribución podría separar las once cards de sus once series sin que nada
  lo notase.
  */
  const cards = cardEls(main).map((t) => ({
    label: txt(t.querySelector('[class*="_k_"]')),
    value: txt(t.querySelector('[class*="_v_"]')),
    pct: txt(t.querySelector('[class*="_p_"]')) || null,
    series: t.style.getPropertyValue('--tc').trim() || null,
    /* El número es dato del servidor: con otro tráfico es otro número. */
    volatile: ['value', 'pct'],
  }))

  /*
  Los counters del panel `Server` son OTRA familia y van aparte: no tienen
  porcentaje ni serie, y no cuentan consultas sino cosas que existen —zonas,
  entradas de caché, listas—. Meterlos con las cards habría hecho que perder
  el porcentaje de una card pareciese normal, porque seis de las diecisiete no
  lo tienen.
  */
  const counters = counterEls(main).map((c) => ({
    label: txt(c.querySelector('[class*="_k_"]')),
    value: txt(c.querySelector('[class*="_v_"]')),
    volatile: ['value'],
  }))

  /*
  Las gráficas. Título, nombre accesible y estado — y las series NO, porque no se
  pueden leer: Chart.js dibuja su legend DENTRO del canvas y no se expone en
  `window`, así que desde el DOM no hay ruta a la instancia. Se dice en el propio
  volcado (`seriesReadable: false`) en vez de emitir un `null` silencioso que
  pareciera «no tiene series».

  Consecuencia que conviene tener delante: la regla de fase 1 «toda legend
  rotula todas las etiquetas que manda el servidor» **no la puede comprobar esta
  herramienta**. Para la gráfica de `Queries` sí hay prueba indirecta, por el
  `--tc` que comparten sus once cards.
  */
  const charts = [...main.querySelectorAll('canvas')].map((c) => ({
    title: tituloDe(c),
    aria: c.getAttribute('aria-label'),
    state: stateOfRegion(c.closest('[class*="_panel_"]') ?? main),
    /*
    Desde el DOM no hay ruta: Chart.js pinta su legend dentro del canvas y no se
    expone en `window`. Pero eso es una limitación del DOM, no el contrato: las
    series se completan con `chartSeries()` desde la respuesta de la API, y la
    legend —que se puede pulsar para ocultar una serie— desde el fuente. Los dos
    llegan con su procedencia declarada.
    */
    seriesInDom: false,
    seriesFrom: 'chartSeries()  ·  api: dashboard/stats/get  +  source: Chart.tsx',
  }))

  /*
  Las listas top-N, y **las dos superficies atadas**.

  Son dos y están relacionadas, no duplicadas: un resumen de cinco filas dentro
  del Dashboard y una tabla de hasta mil filas en el modal de `More`. El contrato
  las vincula —`summary` y `more`— en vez de obligarlas a compartir `ui/Table`:
  cinco filas de resumen y mil filas paginables no son el mismo objeto, y el
  título del modal lo dice él solo, «Top 1000 Domains», donde el límite es parte
  del nombre.

  `detail` y `rateLimited` sólo existen en `Top Clients`: bajo el nombre va el
  dominio que resolvió, y si el servidor lo estaba limitando la fila se marca y
  el nombre lleva «(rate limited)» detrás.
  */
  const topN = regionRoots(main)
    .filter((p) => p.querySelector('[class*="_toprow_"]') || /^Top /.test(txt(p.querySelector('h2')) || ''))
    .map((p) => ({
      title: txt(p.querySelector('h2')) || txt(p.querySelector('[class*="_title_"]')),
      state: stateOfRegion(p),
      summary: [...p.querySelectorAll('[class*="_toprow_"]')].map((r) => {
        const n = r.querySelector('[class*="_n_"]')
        /*
        El detalle va DENTRO del nombre en el DOM —`<span class="n">127.0.0.1
        <span class="topDomain">localhost</span></span>`—, así que leer el nombre
        a pelo daba `127.0.0.1localhost`: dos campos pegados en uno. Se clona y se
        le quita el hijo antes de leerlo. La primera versión de la prueba llegó a
        AFIRMAR el valor pegado, que es la manera de dejar un defecto dentro de su
        propia regresión.
        */
        const solo = n ? n.cloneNode(true) : null
        solo?.querySelector('[class*="_topDomain_"]')?.remove()
        const crudo = txt(solo)
        return {
          name: crudo.replace(/ \(rate limited\)$/, ''),
          count: txt(r.querySelector('[class*="_c_"]')),
          detail: txt(r.querySelector('[class*="_topDomain_"]')) || null,
          rateLimited: / \(rate limited\)/.test(crudo),
        }
      }),
      /* La otra superficie, nombrada aunque esté cerrada: existe y se llega por
         este botón. Un contrato que sólo describe lo que está abierto pierde
         justo lo que el modal contiene. */
      more: [...p.querySelectorAll('button')].map(txt).find((t) => t === 'More') ?? null,
      /* Las filas son dato del servidor: con otro tráfico son otras filas. */
      volatile: ['summary'],
    }))

  return { cards, counters, charts, topN }
}

export function contract(deps = {}, root = null, opts = {}) {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  /*
  La raíz, y por qué no basta con `main`.

  El Login **no tiene `<main>`**: es un formulario suelto en el `body`, así que
  `contract()` devolvía `{error: 'no main element'}` y la pantalla por la que se
  entra a la consola era invisible para la herramienta que existe para que no se
  pierda nada. (Que no lo tenga es en sí un hallazgo: es la única pantalla sin
  landmark, y va anotado para el rediseño del cromo.)

  El apaño obvio —caer a `document.body`— sería peor que el defecto. Esa guarda
  existe por upstream: su consola es Bootstrap 3, **no tiene `main`**, y el plan
  ya registra que apuntar `contract()` a `ref` devuelve ese error a propósito. Con
  la caída ciega, la herramienta habría dejado de avisar y habría producido un
  volcado de basura que parece bueno.

  Así que la caída es condicional a que la página sea LA NUESTRA, y se comprueba
  por `#root`, el punto de montaje de la aplicación: existe en la nuestra y no
  existe en upstream (comprobado contra las dos instancias del harness).
  */
  const app = document.getElementById('root')
  const main = root ?? document.querySelector('main') ?? (app ? app : null)
  if (!main) return { error: 'no main element' }

  /*
  Sin sello no hay contrato, y falla en vez de avisar.

  Un volcado sin sello no se puede reconstruir: no se sabe con qué lector se tomó
  ni de qué bundle. Ya hubo un barrido de uniformidad que midió el bundle viejo y
  estuvo a punto de darse por verde, y aquello sólo se descubrió por casualidad.
  Devolver `tool: 'unstamped'` y seguir era exactamente eso: un aviso que se lee
  cuando ya has usado el dato.
  */
  if (!deps.stamp?.instrument || !deps.stamp?.bundle) {
    throw new Error('contract(): falta el sello. Pasa `stamp: await stamp()` — sin él el volcado no es reconstruible.')
  }

  /*
  A field's label, hunted the way a screen reader would: the `for`, then the
  wrapping label, then the aria hint, then the placeholder as a last resort.

  Each step only counts if it produced something. That sounds obvious and it was
  not: until 2026-09-02 a wrapping `<label>` ENDED the hunt even when it was
  empty, and a checkbox wrapped in a label that holds nothing but the box —which
  is how every selection checkbox in a table is built— came back with no name at
  all. On Zones that was seven of eleven fields reported as unlabelled: the
  select-all and one per row, every one of which does have an `aria-label`
  reading "Select all zones", "Select casa.test"…

  It is exactly the failure this file exists to prevent, one level up: the tool
  that reports what would go missing was itself losing names, and a control that
  arrives at the design without a name is a control that comes back without one.
  */
  const labelOf = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      const t = txt(l)
      if (t) return t
    }
    const wrap = el.closest('label')
    if (wrap) {
      const t = txt(wrap).replace(txt(el), '').trim()
      if (t) return t
    }
    const aria = el.getAttribute('aria-label')
    if (aria) return aria
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const t = labelledBy
        .split(/\s+/)
        .map((id) => txt(document.getElementById(id)))
        .filter(Boolean)
        .join(' ')
      if (t) return t
    }
    const row = el.closest('[class*="Row"], [class*="row"], [class*="field"], [class*="Field"]')
    if (row) {
      const l = row.querySelector('label, [class*="label"]')
      const t = txt(l)
      if (t) return t
    }
    return el.getAttribute('placeholder') || el.getAttribute('title') || '(unlabelled)'
  }

  /* Everything that takes input, however it is built. The role-based half is
     what v1 missed entirely. */
  const CONTROLS = [
    'input', 'select', 'textarea',
    '[role="combobox"]', '[role="listbox"]', '[role="switch"]',
    '[role="radiogroup"]', '[role="spinbutton"]', '[contenteditable="true"]',
    /*
    `ui/Segmented` is a row of buttons in a `group` or a `tablist` — the
    dashboard's period control, the settings sub-tabs. It takes input and offers
    options, so leaving it out reported the whole dashboard as having no controls
    at all. Same mistake as v1 made with the combobox, one release later.
    */
    '[role="tablist"]', '[role="group"]',
  ].join(', ')

  const stateOf = (el) => [
    el.disabled || el.getAttribute('aria-disabled') === 'true' ? 'disabled' : null,
    el.required || el.getAttribute('aria-required') === 'true' ? 'required' : null,
    el.readOnly ? 'readonly' : null,
  ].filter(Boolean)

  /*
  The options behind a closed listbox. Our combobox does not render them until it
  is opened, so the values are read from the button's own description when the
  list is shut; an option list nobody can enumerate is an option list that can go
  missing one entry at a time.
  */
  const optionsOf = (el) => {
    if (el.tagName === 'SELECT')
      return [...el.options].map((o) => ((txt(o) || o.value) + (o.disabled ? ' (disabled)' : '')))
    const id = el.getAttribute('aria-controls')
    const list = id ? document.getElementById(id) : null
    if (list)
      return [...list.querySelectorAll('[role="option"]')].map((o) =>
        o.getAttribute('aria-disabled') === 'true' || o.hasAttribute('disabled')
          ? `${txt(o)} (disabled)`
          : txt(o),
      )
    /* Closed: `aria-controls` is gone and there is nothing to read in the DOM.
       `options()` opened it beforehand and left the answer here. */
    /* The sweep's answer, and ONLY for something that can have options. Keyed by
       label, the map happily handed a text input the option list of a combobox
       that shared its label — and a text field reported as having options is a
       control described as something it is not. */
    const canHaveOptions =
      el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'listbox'
    if (!canHaveOptions) return null
    const swept = opts[labelOf(el)]
    return swept ?? null
  }

  const kindOf = (el) => {
    if (el.tagName === 'SELECT') return 'select'
    if (el.tagName === 'TEXTAREA') return 'textarea'
    if (el.getAttribute('role') === 'combobox') return 'combobox'
    if (el.getAttribute('role') === 'switch') return 'switch'
    if (el.getAttribute('role') === 'radiogroup') return 'radiogroup'
    return el.type || el.tagName.toLowerCase()
  }

  /*
  Helper text: upstream's wording is contract and must survive verbatim — so it
  must also be attached to the RIGHT control.

  It used to walk up to the nearest field-ish ancestor and take the first help
  element under it. On "Add Record" that put *"Set to automatically delete the
  record when the value in seconds elapses…"* — which is the help for
  `Expiry TTL` — onto three unrelated checkboxes, because the help div is a
  SIBLING of its `<Field>` and their common ancestor swallowed all four.

  A mis-attributed help text is worse than a missing one: it tells the design
  that a control means something it does not, and the design is entitled to
  believe it.

  So: a help text is claimed by a control only when the container that holds both
  holds **exactly that one control**. When the container holds several, the text
  belongs to the group and is reported once, as a note, instead of being copied
  onto each.
  */
  const FIELDISH = '[class*="Row"], [class*="row"], [class*="field"], [class*="Field"]'
  const HELPISH = '[class*="elp"], [class*="hint"], small'
  const helpOf = (el) => {
    const described = el.getAttribute('aria-describedby')
    if (described) {
      const t = described.split(/\s+/).map((id) => txt(document.getElementById(id))).filter(Boolean).join(' ')
      if (t) return t
    }
    const row = el.closest(FIELDISH)
    if (!row) return null
    const h = row.querySelector(HELPISH)
    if (!h) return null
    return row.querySelectorAll(CONTROLS).length === 1 ? txt(h) : null
  }

  /* The help texts that belong to a group rather than to one control, so that
     they travel with the contract instead of being dropped as unclaimed. */
  const groupNotes = () =>
    [...main.querySelectorAll(HELPISH)]
      .filter((h) => {
        const row = h.closest(FIELDISH)
        return !row || row.querySelectorAll(CONTROLS).length !== 1
      })
      .map(txt)
      .filter(Boolean)

  const blocks = [...main.querySelectorAll('[class*="Block"], [class*="block"], fieldset, section')]
    .filter((b) => !b.parentElement.closest('[class*="Block"], [class*="block"], fieldset'))

  const inBlock = new Set()
  const described = blocks.map((b) => {
    const fields = [...b.querySelectorAll(CONTROLS)]
    fields.forEach((f) => inBlock.add(f))
    return {
      heading: txt(b.querySelector('h1,h2,h3,h4,legend,[class*="title"],[class*="head"]')) || null,
      fields: fields.map((f) => {
        const label = labelOf(f)
        const row = f.closest('[class*="Row"], [class*="row"], [class*="field"], [class*="Field"]')
        return {
          label,
          kind: kindOf(f),
          options: optionsOf(f),
          state: stateOf(f),
          help: helpOf(f),
          /* The buttons that act on THIS control, bound to it rather than left
             floating in the block: "Update Now" belongs to the list it refreshes. */
          actions: row ? [...row.querySelectorAll('button')].map(txt).filter(Boolean) : [],
          /* What governs it, from `dependencies()`.

             `stamp` viaja en el mismo objeto —lo exige la guarda de arriba— y no
             es un interruptor, así que se filtra por FORMA y no por nombre: sólo
             cuentan las claves cuyo valor es una lista. Sin esto, la primera
             pantalla con dependencias de verdad no daba una lectura rara sino un
             `TypeError`: `/settings/general/`, con sus cinco filas dependientes. */
          governedBy: Object.keys(deps).filter((k) => Array.isArray(deps[k]) && deps[k].includes(label)),
        }
      }).sort((a, b) => a.label.localeCompare(b.label)),
      buttons: [...b.querySelectorAll('button')].map((x) => txt(x) || x.getAttribute('aria-label')),
      notes: [...b.querySelectorAll('[class*="ote"], [class*="lert"], [class*="arning"]')].map(txt).filter(Boolean),
    }
  })

  const loose = [...main.querySelectorAll(CONTROLS)].filter((f) => !inBlock.has(f))

  /*
  Las columnas, **todas**, incluidas las que no llevan rótulo.

  Zones tiene DIEZ columnas estructurales: la casilla de selección, el `#`, siete
  ordenables y la de acciones. Con `map(txt)` las dos sin rótulo salían como
  cadena vacía, y quien leyera el contrato contaría ocho — que son sólo las que
  llevan texto. Perder de vista la casilla es perder de vista la selección
  múltiple entera, y perder la última es perder dónde viven `Zone Options` y
  compañía.

  Así que la columna sin rótulo se NOMBRA por lo que lleva dentro, y se marca
  `sinRotulo` para que nadie la confunda con un encabezado que se ha quedado en
  blanco por error.
  */
  const columna = (th) => {
    const t = txt(th)
    if (t !== '') return { label: t }
    if (th.querySelector('input[type=checkbox]') != null) return { label: '(selección)', sinRotulo: true }
    return { label: '(acciones)', sinRotulo: true }
  }

  const tables = [...main.querySelectorAll('table')].map((t) => ({
    columns: [...t.querySelectorAll('thead th')].map(columna),
    rowActions: [...new Set([...t.querySelectorAll('tbody button')].map((b) => b.getAttribute('aria-label') || txt(b)))],
  }))

  return {
    /* Con qué lector y de qué consola. Los dos, y obligatorios: ver la guarda. */
    tool: deps.stamp.instrument,
    bundle: deps.stamp.bundle,
    route: location.pathname,
    /* A dialog puts its title in the title slot, not in an `h1`. */
    title: txt(main.querySelector('h1')) || txt(main.querySelector('[class*="_title_"]')) || null,
    /* Actions that live outside any block: the screen's own verbs. */
    /*
    Los verbos de la pantalla — y **por su nombre accesible cuando no tienen
    texto**.

    Medido en Zones: devolvía DOCE CADENAS VACÍAS. `Add Zone`, `Delete Zones` y
    `Go` estaban entre ellas, y también los botones de sólo icono de la cabecera,
    que no tienen texto pero sí `aria-label`. Un contrato que dice `["", "", …]`
    no puede desmentir a un diseño que vuelva sin `Add Zone`: es exactamente la
    pérdida que este fichero existe para impedir, y llevaba callándola desde que
    se apuntó a una pantalla con verbos icónicos.

    Es el mismo arreglo que `looseFields` ya tenía —mirar el `aria-label` cuando
    el texto no dice nada— aplicado donde faltaba. Las vacías de verdad se caen:
    un botón sin texto y sin nombre accesible es un defecto de la pantalla, y
    aparece en `counts.buttons`, no aquí.
    */
    screenActions: [
      ...new Set(
        (() => {
          /*
          Se busca por el ENCABEZADO y no por posición.

          El selector era `:scope > *:first-child button`, es decir «los botones
          del primer hijo de `main`», y eso aguantó mientras el primer hijo fue el
          encabezado de sección. Dejó de serlo el 2026-09-03, cuando el cromo ganó
          su ranura: la ranura pasó a ser el primer hijo, está vacía en casi todas
          las pantallas, y `screenActions` empezó a devolver los botones de las
          FILAS —`Zone Options`, `Enable Zone`— mientras `Add Zone` y
          `Delete Zones` desaparecían.

          Un contrato que se apoya en el orden de los hijos se rompe la primera
          vez que alguien mete algo delante, y no avisa: devuelve otra cosa. Ahora
          se ancla a la fila que contiene el `h1`, que es lo que define un
          encabezado de sección.

          Y **sólo a ella**. Antes se le sumaba `[class*="ctions"] > button`, que
          casa con la columna de acciones de `ui/Table`, y después
          `[class*="cciones"]`, que casa con la barra de acciones de un PANEL —por
          eso el `More` del Dashboard salía como verbo de pantalla y los
          `Zone Options` de las filas de Zones también—. La acción de una fila no
          es de la pantalla, y la de un panel tampoco: si se mezclan, el día que
          falte `Add Zone` la lista seguirá pareciendo llena.

          Lo que se queda fuera —el `Go` de la barra de filtros, el `More` de un
          panel— no se pierde: sale en `counts.buttons` y, cuando cuelga de un
          campo, en las acciones de ese campo.
          */
          const h1 = main.querySelector('h1')
          const cabecera = h1?.closest('[class*="_hrow_"]') ?? h1?.parentElement?.parentElement ?? null
          return (cabecera ? [...cabecera.querySelectorAll('button')] : [])
            .map((b) => txt(b) || b.getAttribute('aria-label') || '')
            .filter(Boolean)
        })(),
      ),
    ],
    /*
    TODOS los botones de la pantalla, con el sitio donde vive cada uno.

    Campo NUEVO, y nuevo justamente para no tocar `screenActions`: ése se ancló al
    encabezado porque mezclarlo con las acciones de fila y de panel hacía que la
    lista pareciera llena el día que faltara `Add Zone`. Eso se queda como está.

    Hacía falta porque el congelado dejó una puerta —«salvo pérdida funcional
    concreta demostrada contra el fuente»— y `/dnsclient/` la cruza: sus DOS únicos
    verbos, `Resolve` e `Import`, viven en la barra de consulta y no en el
    encabezado, así que el contrato decía `screenActions: []` y `buttons: 4`. Un
    diseñador leyendo eso no ve ni una acción — y dos de esos cuatro botones son en
    realidad los desplegables de `Type` y `DNS-over-`. **Contar no es nombrar**, y
    el modo de failure que este fichero existe para impedir es exactamente que algo
    esté contado y no dicho.

    ## Por qué la lista es de TODOS y no «los de la barra»

    El primer intento fue `barActions`, con una regla de profundidad: hijo directo
    de un hijo directo de `main`. Cazaba `Resolve`/`Import` y el `Go` de Zones sin
    tocar nada más… y perdía los CUATRO verbos de `Settings`, porque esa pantalla
    envuelve su contenido en un `div` y su barra queda un nivel más abajo. Es
    literalmente el failure del que avisa el congelado de este fichero: una lectura
    que se apoya en la estructura de los hijos se rompe la primera vez que alguien
    mete algo en medio, y no avisa — devuelve otra cosa.

    Así que no se clasifica para decidir qué se dice: se dice TODO, y el sitio va
    como dato al lado. `where` es orientativo y puede equivocarse sin que se pierda
    nada, porque el nombre está siempre. Un `where` mal puesto se discute; un botón
    que no aparece, no.
    */
    buttons: [
      ...(() => {
        const h1 = main.querySelector('h1')
        const cabecera = h1?.closest('[class*="_hrow_"]') ?? null
        const donde = (b) => {
          if (cabecera && cabecera.contains(b)) return 'header'
          if (b.closest('tr') || b.closest('table')) return 'row'
          if (b.getAttribute('role') === 'combobox' || b.getAttribute('aria-haspopup') != null) return 'field'
          if (b.closest('[class*="_field_"]') || b.closest('[class*="_row_"]')) return 'field'
          if (b.closest('[class*="_panel_"]')) return 'panel'
          return 'bar'
        }
        return [...main.querySelectorAll('button')].map((b) => ({
          name: txt(b) || b.getAttribute('aria-label') || '(sin nombre accesible)',
          where: donde(b),
          disabled: b.disabled === true,
        }))
      })(),
    ],
    blocks: described,
    /*
    The loose ones carry their help and their actions too. They did not until
    2026-09-02, and it only showed when the tool was first pointed at a dialog:
    a dialog has no `Block`s, so EVERY one of its fields is loose, and the help
    text —which is contract and has to survive verbatim— was being dropped for
    all of them. On the screens it had gone unnoticed because there the fields
    that matter sit inside blocks.
    */
    looseFields: loose.map((f) => ({
      label: labelOf(f),
      kind: kindOf(f),
      options: optionsOf(f),
      state: stateOf(f),
      help: helpOf(f),
      actions: (() => {
        const row = f.closest('[class*="Row"], [class*="row"], [class*="field"], [class*="Field"]')
        return row ? [...row.querySelectorAll('button')].map(txt).filter(Boolean) : []
      })(),
    })),
    /* Destinations are interface too, and v1 counted none of them. */
    links: [...main.querySelectorAll('a[href]')].map((a) => ({ text: txt(a), href: a.getAttribute('href') })),
    /* Help that belongs to a group of controls and not to one of them. */
    groupNotes: groupNotes(),
    /*
    The words. A dialog with no fields is not an empty dialog: `Unsign Zone` is
    four warnings and a question, `View DS Info` is an explanation and a block of
    data, and a `Confirm` is ONLY prose — its entire contract is the sentence it
    asks. Reporting those three as "no fields" and stopping is how a design comes
    back with an empty box where the warning used to be.
    */
    prose: (() => {
      const seen = new Set()
      const out = []
      for (const el of main.querySelectorAll('p, li, [role="alert"], [class*="_warn"], [class*="_note"], [class*="_intro"], [class*="_body"] > div, dd, dt, code, pre')) {
        if (el.querySelector(CONTROLS)) continue
        const t = txt(el)
        if (!t || t.length < 2 || seen.has(t)) continue
        seen.add(t)
        out.push(t)
      }
      return out
    })(),
    /*
    El texto suelto que ningún selector nombra, y por qué hace falta.

    `prose` busca `p`, `li`, `role=alert`, `dd`, `code`… y en el Login eso no
    encuentra NADA: sus dos únicos textos son la marca —«Technitium DNS Server»,
    un `div._brand` que además no es un encabezado— y el crédito del tema
    —«Theme: byGarcia»—. El contrato del Login salía con dos campos, dos botones y
    seis enlaces, y **perdía las dos frases que hay en la pantalla**.

    Esto no busca por clase, que sería atar la herramienta a un módulo: recoge
    toda hoja con texto que no sea un control, ni un botón, ni un enlace, ni algo
    que `prose` ya trajo. La regla es la que hace falta: si hay texto en la
    pantalla, aparece en el contrato.
    */
    strays: (() => {
      const ya = new Set()
      for (const el of main.querySelectorAll('p, li, [role="alert"], dd, dt, code, pre')) ya.add(txt(el))
      /*
      Y lo que las otras partes del contrato YA recogen, que si no esto las
      duplica en vez de completarlas. Medido en el Dashboard: sin este filtro
      salían 49 sueltos y los 49 eran cards, counters, filas de top-N o
      nombres de región **ya estructurados** — incluidos los valores sembrados,
      que habrían viajado otra vez como texto plano y sin la marca de volátiles.
      Un contrato que dice dos veces lo mismo, una bien y otra mal, es peor que
      uno que lo dice una vez.

      `strays` significa entonces lo que tiene que significar: **texto de la
      pantalla que ninguna otra parte del contrato nombra**.
      */
      const o = overview(main)
      for (const c of o.cards) { ya.add(c.label); ya.add(c.value); if (c.pct) ya.add(c.pct) }
      for (const c of o.counters) { ya.add(c.label); ya.add(c.value) }
      for (const t of o.topN) {
        ya.add(t.title)
        for (const f of t.summary) { ya.add(f.name); ya.add(f.count); if (f.detail) ya.add(f.detail) }
      }
      for (const g of o.charts) if (g.title) ya.add(g.title)
      for (const r of regions(main)) if (r.name) ya.add(r.name)
      /*
      Se recorre por NODOS DE TEXTO y no por elementos hoja, y la diferencia la
      encontró el Login: «Theme:» vive en un `div._credit` que tiene un `<a>`
      dentro —«Theme: byGarcia»—, así que ese div no es hoja y con el recorrido
      por elementos se perdía. Un texto no deja de existir porque comparta padre
      con un enlace.
      */
      const out = new Set()
      const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
      let n
      while ((n = w.nextNode())) {
        const p = n.parentElement
        if (!p || p.closest('button, a, label') || p.matches(CONTROLS)) continue
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim()
        if (!t || t.length < 2 || ya.has(t)) continue
        out.add(t)
      }
      return [...out]
    })(),
    /*
    The footer, by name. `screenActions` catches the header's close button —its
    selector takes the first child— and never reached `.foot`, so `Save`, `Add`,
    `Import`, `Convert Zone` and every other verb a dialog commits with were
    COUNTED in `counts.buttons` and absent from the contract. The one button that
    decides what the dialog does was the one it did not name.
    */
    footer: (() => {
      const foot = [...main.children].find((c) => /_foot_/.test(String(c.className)))
      return foot ? [...foot.querySelectorAll('button')].map(txt).filter(Boolean) : []
    })(),
    /*
    Which of the four a screen is showing right now. `dev/defects.js` already
    established that an empty state and a failed request must not look alike; a
    redesign that is only ever shown the populated state cannot honour that.

    Read from the COMPONENTS and not from the prose. It used to grep the screen's
    text for "failed|error|unable to", and on 2026-09-02 that reported Zones as
    `error` while it was showing six healthy rows: one of them is a Secondary
    whose Status column reads "Sync Failed". The sniffer was reading the DATA and
    calling it the state of the UI — the same confusion, in the same tool, that
    the error-is-not-empty rule is about.

    The signals: `ui/Alert` is the only thing that renders `role="alert"`, and it
    is only a failure when it carries its `danger` or `warning` tone —a dismissed
    success toast is not an error—; `ui/Empty` renders `box`, `line` and
    `loading`. CSS modules compile those to `_box_<hash>`, so the leading
    underscore is what keeps the match from catching any class with "box" in it.
    */
    state: (() => {
      const porRegion = regions(main)
      if (porRegion.length === 0) return stateOfRegion(main)
      const distintos = [...new Set(porRegion.map((r) => r.state))]
      /*
      `mixed` no es un empate mal resuelto: es el estado real de una vista
      general. El Dashboard puede estar poblado y vacío a la vez, y las dos cosas
      ser ciertas. Quien necesite el detalle lo tiene en `regions`, que es donde
      vive la verdad; este campo sólo dice si hay UNA respuesta o no la hay.
      */
      return distintos.length === 1 ? distintos[0] : 'mixed'
    })(),
    regions: regions(main),
    overview: overview(main),
    tables,
    counts: {
      fields: main.querySelectorAll(CONTROLS).length,
      buttons: main.querySelectorAll('button').length,
      height: Math.round(main.scrollHeight),
    },
  }
}

if (typeof window !== 'undefined') Object.assign(window, { contract, overview, regions, stamp, chartSeries, chrome })
