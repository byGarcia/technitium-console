/*
The contract, read from the SOURCE with TypeScript's own parser.

## Why from the source

`screen-contract.mjs` reads a live screen, and a live screen is one combination of
one moment. It cannot prove exhaustiveness, and on this console it kept failing to
in ways that each looked like a finding:

  · `Zone Options` is five tabs. A sweep on the open one described a fifth of the
    dialog. (`asTabs`, ZoneOptions.tsx:140 — one line of source.)
  · `Add User` adds a row when you change it. Walking it did not visit states, it
    accumulated them. (`addLabel`, ZonePermissions.tsx:143 — one line.)
  · `Add Private Key` toggles a whole form into being. (`setAnadiendo`,
    DnssecProperties.tsx:385 — one line.)

The DOM is evidence; the source is the specification.

## Why with the AST, and not with regexes

The first version of this file used regexes and got three things wrong in one
pass, all of them the same error — reading at the wrong level:

  · It reported eight of the fifteen confirmations as carrying a success message
    where their question should be. All fifteen have a real question. What it
    found was the `text:` of the SUCCESS notice nested inside `action`, because it
    searched the whole object for a single-quoted string before looking for the
    property itself. **That went out as a finding about the product before it was
    checked**, which is the worst thing a measuring tool can cause.
  · It counted `ADD_TYPES` as nine options. It is eight: the ninth brace is the
    nested `reference` object of the last entry.
  · It kept matrices keyed by name alone, so `SECONDARIES` — declared in both
    `zone-view.ts` and `options.ts` — silently became one entry and 38
    declarations were reported as 37.

A property has a level, an array has elements, and a name belongs to a file.
Regexes know none of the three. TypeScript is already a dependency, so its parser
does the reading and the guessing stops.

## What this recognises, exactly

It is NOT "complete by construction", and it does not report "everything else"
either — that claim was too generous and is withdrawn. What it does is narrower
and worth stating exactly:

  · Inside the forms listed in `RECOGNISED`, a value it cannot resolve is
    reported as unresolved instead of being dropped.
  · Anything OUTSIDE those forms is **not inspected at all**, and therefore not
    reported. A `<Select>` built some other way, a label assembled at runtime, a
    dialog that takes its fields from a prop — none of those are seen, and none
    of them produce a warning.

So this is a floor, not a ceiling: what it lists is there, and what it does not
list may still be. The manual read per component is what closes that gap, and
the harness is what checks the result.

    node dev/static-contract.mjs
    node dev/static-contract.mjs --json
*/

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

/*
`import.meta.url` is rewritten under the test runner and came out pointing at
`/src`, so the resolution falls back to the working directory. A tool that reads
the source must find the source under `node` and under `vitest` alike.
*/
function resolveRoot() {
  try {
    const here = fileURLToPath(new URL('../src/', import.meta.url))
    if (existsSync(here)) return here
  } catch {
    /* Under vitest `import.meta.url` is not a file: URL at all. */
  }
  const cwd = join(process.cwd(), 'src/')
  if (existsSync(cwd)) return cwd
  throw new Error('static-contract: cannot find src/. Run it from the repo root.')
}
export const ROOT = resolveRoot()

/** Exactly what this tool claims to understand. Anything else is unresolved. */
export const RECOGNISED = [
  'onConfirm({ title, text, label, danger }) — top-level properties only',
  'const NAME = [ … ] — array elements, objects counted as objects',
  'literal JSX label attributes, aria-labels and native <label><input>text</label>',
  'local helpers whose first argument is threaded into a JSX label',
  'MATRIX.map() and options={MATRIX} bindings to their surrounding control',
  '<Dialog> title, size, footer actions and close label',
  'literal help, prose, section headings, definition terms and outgoing links',
  "tab === 'literal' — the branches of a tab strip",
]

export function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) out.push(p)
  }
  return out
}

const parse = (file) =>
  ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

function eachNode(node, fn) {
  fn(node)
  node.forEachChild((c) => eachNode(c, fn))
}

/*
A string, whichever of the three forms it takes. A template keeps its holes as
`${…}` because the hole is part of the contract: "delete the zone '${name}'?"
tells the design that the sentence names the object, and flattening it to
"delete the zone ''?" would not.
*/
const ENTITIES = { '&quot;': '"', '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' }
export const decode = (s) => String(s).replace(/&(quot|apos|amp|lt|gt|nbsp);/g, (m) => ENTITIES[m])

export function textOf(node) {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) out += '${' + span.expression.getText() + '}' + span.literal.text
    return out
  }
  return null
}

/*
Every literal a value can take, and not just the first.

`Resync Zone` reads `text,` — a shorthand pointing at a `const text = cond ? A : B`
declared three lines above, with TWO different sentences: the secondary talks
about a full transfer (AXFR) and the rest about a refresh. Both end in a real
question. Reporting that as "computed, unresolved" is honest but poor; reporting
only one of the two would be worse. So a ternary yields both branches, and a local
`const` is followed to its declaration inside the same function.
*/
export function textsOf(node, scope, when = null) {
  if (!node) return []
  const one = textOf(node)
  if (one != null) return [{ text: one, when }]
  if (ts.isConditionalExpression(node)) {
    /*
    The predicate travels with its sentence. Keeping both texts and dropping WHEN
    each one is shown is half a contract: `Resync Zone` says AXFR to a secondary
    and refresh to everything else, and a design told only that there are two
    sentences cannot know which zone sees which.
    */
    const cond = node.condition.getText().replace(/\s+/g, ' ')
    return [
      ...textsOf(node.whenTrue, scope, cond),
      ...textsOf(node.whenFalse, scope, `!(${cond})`),
    ]
  }
  if (ts.isIdentifier(node) && scope) {
    let found = null
    eachNode(scope, (n) => {
      if (found) return
      if (ts.isVariableDeclaration(n) && n.name.getText() === node.getText() && n.initializer) found = n.initializer
    })
    if (found) return textsOf(found, null, when)
  }
  return []
}

/** The function or block a node lives in, to look a local `const` up in. */
function enclosingScope(node) {
  let n = node
  while (n && !ts.isFunctionDeclaration(n) && !ts.isFunctionExpression(n) && !ts.isArrowFunction(n) && !ts.isSourceFile(n)) {
    n = n.parent
  }
  return n
}

/** A direct property of THIS object literal. Not of anything nested inside it. */
export function directProp(objectLiteral, name) {
  for (const p of objectLiteral.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === name) {
      const value = textOf(p.initializer)
      return { value, node: p.initializer, literal: value != null }
    }
    /* `text,` — the shorthand, which the regex version did not understand. */
    if (ts.isShorthandPropertyAssignment(p) && p.name.getText() === name) {
      return { value: null, node: p.name, literal: false, shorthand: true }
    }
  }
  return null
}

export function confirmations(files) {
  const out = []
  for (const file of files) {
    const sf = parse(file)
    eachNode(sf, (node) => {
      /*
      A confirmation is written two ways in this console, and reading only one of
      them reported Settings as having none.

        · `onConfirm({ title, text, label, danger })` — Zones' way. One generic
          `<Confirm>` host renders whatever the call set up, which is why Zones
          has fifteen contracts and a single element.
        · `<Confirm title="…" label="…" text="…" />` — everyone else's way:
          Settings, the lists, the logs, Administration's five screens and the app
          store all mount one element per question, with the words in the props.

      Same contract, different shape. `Settings.tsx` alone carries three, and one
      of them —`Flush Cache`— hangs off the bar that every one of the nine panes
      shares, so it is reachable from the pane pilot 3 is drawing.
      */
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        if (node.tagName.getText() !== 'Confirm') return
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const attr = (n) => {
          const a = node.attributes.properties.find((x) => ts.isJsxAttribute(x) && x.name.getText() === n)
          if (!a || !ts.isJsxAttribute(a) || !a.initializer) return null
          const init = ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer
          return init ? { node: init, literal: ts.isStringLiteral(init), value: textOf(init) } : null
        }
        const title = attr('title')
        const text = attr('text')
        const label = attr('label')
        const variant = attr('variant')
        /* A generic host — `title={confirmation?.title}` — is not a contract, it
           is the surface the other form renders through. Counting it would add a
           sixteenth to Zones' fifteen. */
        if (!title || !title.literal) return
        const texts = text ? textsOf(text.node, enclosingScope(node)) : []
        const unresolved = []
        if (!label?.literal) unresolved.push('label computed or missing')
        if (!text) unresolved.push('text missing')
        else if (!texts.length) unresolved.push(`text computed and unresolvable: ${text.node.getText().replace(/\s+/g, ' ').slice(0, 50)}`)
        out.push({
          file: relative(ROOT, file),
          line,
          via: 'element',
          title: title.value,
          texts,
          text: texts[0]?.text ?? null,
          label: label?.value ?? null,
          danger: variant ? variant.value === 'danger' : false,
          unresolved,
        })
        return
      }
      if (!ts.isCallExpression(node)) return
      if (!/(^|\.)onConfirm$/.test(node.expression.getText())) return
      const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1
      const arg = node.arguments[0]
      if (!arg || !ts.isObjectLiteralExpression(arg)) {
        out.push({ file: relative(ROOT, file), line, unresolved: ['argument is not an object literal'] })
        return
      }
      const scope = enclosingScope(node)
      const pick = (n) => directProp(arg, n)
      const title = pick('title')
      const text = pick('text')
      const label = pick('label')
      const danger = pick('danger')
      const unresolved = []
      const texts = text ? textsOf(text.node, scope) : []
      for (const [n, p] of [['title', title], ['label', label]]) {
        if (!p) unresolved.push(`${n} missing`)
        else if (!p.literal) unresolved.push(`${n} computed: ${p.node.getText().replace(/\s+/g, ' ').slice(0, 50)}`)
      }
      if (!text) unresolved.push('text missing')
      else if (!texts.length) unresolved.push(`text computed and unresolvable: ${text.node.getText().replace(/\s+/g, ' ').slice(0, 50)}`)
      out.push({
        file: relative(ROOT, file),
        line,
        title: title?.value ?? null,
        /* All of them, each with the condition that shows it. */
        texts,
        text: texts[0]?.text ?? null,
        label: label?.value ?? null,
        danger: danger ? danger.node.getText() === 'true' : false,
        unresolved,
      })
    })
  }
  return out
}

/*
Keyed by FILE and name, because a name is not an identity. `SECONDARIES` is
declared in `zone-view.ts` and again in `options.ts`, and a map keyed by name
alone turned two declarations into one.
*/
export function matrices(files) {
  const out = {}
  for (const file of files) {
    const sf = parse(file)
    eachNode(sf, (node) => {
      if (!ts.isVariableDeclaration(node) || !node.name || !node.initializer) return
      const name = node.name.getText()
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) return
      const key = `${relative(ROOT, file)}::${name}`
      let init = node.initializer
      /* `as const` wraps the array; unwrap before looking at it. */
      while (ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression
      if (!ts.isArrayLiteralExpression(init)) {
        out[key] = { unresolved: `initializer is ${ts.SyntaxKind[init.kind]}: ${init.getText().replace(/\s+/g, ' ').slice(0, 50)}` }
        return
      }
      const elements = [...init.elements]
      const objects = elements.filter((e) => ts.isObjectLiteralExpression(e))
      if (objects.length) {
        out[key] = {
          structured: true,
          /* ELEMENTS, not braces. Counting braces made ADD_TYPES nine, because
             its last entry carries a nested `reference` object. */
          count: elements.length,
          labels: objects.map((o) => directProp(o, 'label')?.value ?? '(computed)'),
        }
        return
      }
      const values = elements.map((e) => textOf(e) ?? (ts.isNumericLiteral(e) ? e.text : null))
      if (values.some((v) => v == null)) {
        out[key] = { unresolved: `elements not all literal: ${init.getText().replace(/\s+/g, ' ').slice(0, 50)}` }
        return
      }
      out[key] = { values }
    })
  }
  return out
}

/*
The per-component inventory: what a dialog is made of, read from its own source.

Beyond the labels, three things the swept version lost and that a design cannot
be asked to reinvent: the HELP text —upstream's wording is contract and survives
verbatim—, the FOOTER, which is where a dialog says what it does, and the
CONDITIONS that gate a block, because "these fields exist" and "these fields
exist when the zone is a secondary" are different contracts.
*/
export function inventory(file) {
  const sf = parse(file)

  /*
  A fragment is a node with children like any other, and this did not know it:
  `<JsxElement>` was handled and `<>…</>` fell through to the empty string. In
  Zones nothing was written that way, so the hole stayed shut; in Settings five
  of `General`'s help texts are `help={<>… <code>Prefer IPv6</code> …</>}` and
  all five came back unreadable — reported honestly as unresolved, but lost all
  the same. Descending into fragments is what the other three lines already do.
  */
  /** True when the node hangs, at any depth, from a `help={…}` attribute. */
  const insideHelpAttribute = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p) && p.name.getText() === 'help') return true
    }
    return false
  }

  const jsxLiteralText = (node) => {
    if (ts.isJsxText(node)) return node.text
    if (ts.isJsxExpression(node)) return textOf(node.expression) ?? ''
    if (ts.isJsxElement(node)) return node.children.map(jsxLiteralText).join('')
    if (ts.isJsxFragment(node)) return node.children.map(jsxLiteralText).join('')
    return ''
  }

  /*
  Only calls to helpers whose first parameter is actually threaded into a JSX
  `label` attribute may contribute labels.  Looking at every call to every
  local identifier turned state keys such as `expiryTtl` and `proxyType` into
  controls merely because they contain a capital letter.
  */
  const labelHelpers = new Set()
  eachNode(sf, (node) => {
    let name = null
    let fn = null
    if (ts.isFunctionDeclaration(node) && node.name) {
      name = node.name.getText()
      fn = node
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      name = node.name.getText()
      fn = node.initializer
    }
    if (!name || !fn?.parameters.length || !ts.isIdentifier(fn.parameters[0].name)) return
    const first = fn.parameters[0].name.getText()
    let usedAsLabel = false
    eachNode(fn.body, (child) => {
      if (
        ts.isJsxAttribute(child) &&
        child.name.getText() === 'label' &&
        child.initializer &&
        ts.isJsxExpression(child.initializer) &&
        child.initializer.expression?.getText() === first
      ) usedAsLabel = true
    })
    if (usedAsLabel) labelHelpers.add(name)
  })

  /*
  The nearest `{cond && …}` that covers a node. A label sitting under one is only
  on screen when that condition holds, and that is the ONLY thing that can excuse
  its absence from a capture. Without it, "explained by branch" degenerates into
  "this dialog has branches, therefore anything missing is fine" — which absolves
  by description instead of by evidence.
  */
  /*
  ALL the gates over a node, not the first one found.

  `Proxy Server Port` sits under `!f.usarEsteServidor`, and reporting only that
  was the whole excuse for its absence — while with Primary chosen that condition
  is perfectly true. The real gate is the CONJUNCTION: it also sits under
  `v.forwarderFields`, which Primary does make false. One ancestor is a fragment
  of a condition and absolving on a fragment absolves on nothing.
  */
  const gateAround = (node) => {
    const all = []
    let n = node.parent
    while (n && !ts.isSourceFile(n)) {
      if (ts.isJsxExpression(n) && n.expression && ts.isBinaryExpression(n.expression) &&
          n.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        all.push(n.expression.left.getText().replace(/\s+/g, ' '))
      }
      /*
      A `switch` case is a gate too, and it is the one `AddEditRecord` is built
      out of: `switch (f.type) { case 'MX': …`. Looking only for `{cond && …}`
      left fifteen record-type fields with no condition to point at, and a field
      with no condition is a field with no excuse for being absent.
      */
      if (ts.isCaseClause(n)) {
        const subject = n.parent?.parent?.expression?.getText()?.replace(/\s+/g, ' ')
        const labels = [n]
        let prev = n.parent.clauses[n.parent.clauses.indexOf(n) - 1]
        while (prev && ts.isCaseClause(prev) && prev.statements.length === 0) {
          labels.unshift(prev)
          prev = n.parent.clauses[n.parent.clauses.indexOf(prev) - 1]
        }
        const values = labels.map((c) => textOf(c.expression) ?? c.expression.getText())
        if (subject) all.push(`${subject} === ${values.map((v) => `'${v}'`).join(' | ')}`)
      }
      if (ts.isConditionalExpression(n)) all.push(n.condition.getText().replace(/\s+/g, ' '))
      n = n.parent
    }
    return all.length ? all : null
  }

  const fields = []
  const tabs = []
  const unresolved = []
  const help = []
  const links = []
  const buttons = []
  const gates = []
  const prose = []
  const sections = []
  const terms = []
  let dialog = null
  eachNode(sf, (node) => {
    /*
    A NATIVE `<label>` wrapping its own `<input>`, which is how every checkbox and
    radio in this console is actually built:

        <label className={styles.chk}>
          <input type="checkbox" … />
          Use SOA Serial Date Scheme
        </label>

    The first attempt at this looked for `<Check>`, `<Radio>` and `<Switch>`
    components. There are none: the shape was invented, the reconciliation still
    reported the same forty controls as "on screen, not in source", and the gap
    had been classified rather than closed. Naming a hole is not filling it.
    */
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === 'label') {
      const input = node.children.find(
        (c) =>
          (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) &&
          /^(input|Input)$/.test((ts.isJsxElement(c) ? c.openingElement : c).tagName.getText()),
      )
      if (input) {
        const el = ts.isJsxElement(input) ? input.openingElement : input
        const typeAttr = el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'type')
        const kind = typeAttr && ts.isJsxAttribute(typeAttr) ? textOf(typeAttr.initializer) ?? 'input' : 'input'
        const t = node.children
          .map(jsxLiteralText)
          .join('')
          .replace(/\s+/g, ' ')
          .trim()
        if (t) fields.push({ tag: kind, label: t, native: true, gate: gateAround(node) })
        else {
          const expr = node.children.filter((c) => ts.isJsxExpression(c)).map((c) => c.getText()).join(' ')
          if (expr) unresolved.push(`native ${kind} label computed: ${expr.replace(/\s+/g, ' ').slice(0, 60)}`)
        }
      }
    }
    /* An `aria-label` is a name too, template or not. */
    if (ts.isJsxAttribute(node) && node.name.getText() === 'aria-label' && node.initializer) {
      const init = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      const t = textOf(init)
      const owner = node.parent?.parent
      const tag = owner && ts.isJsxOpeningLikeElement(owner) ? owner.tagName.getText() : '?'
      if (t) fields.push({ tag, label: t, viaAria: true, gate: gateAround(node) })
      else if (init) unresolved.push(`${tag} aria-label computed: ${init.getText().replace(/\s+/g, ' ').slice(0, 60)}`)
    }
    /* Help: `<div className={styles.help}>…</div>` and `<Help>…</Help>`. */
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText()
      const cls = node.openingElement.attributes.properties.find(
        (a) => ts.isJsxAttribute(a) && a.name.getText() === 'className',
      )
      /*
      `Help` and `HelpText` are help ONLY when they carry no `href`. Settings uses
      the same two names for two different things: `<HelpText>…</HelpText>` is a
      paragraph of help, and `<Help href="https://blog.technitium.com/…">` is an
      outgoing link with its own text. Without this test the link's text was filed
      as help, which is how a contract grows a help string nobody ever wrote.
      The `href` reader below already collects the link itself.
      */
      const hasHref = node.openingElement.attributes.properties.some(
        (a) => ts.isJsxAttribute(a) && a.name.getText() === 'href',
      )
      const isHelp =
        ((tag === 'Help' || tag === 'HelpText') && !hasHref) ||
        (cls && /styles\.(help|hint|note)/.test(cls.getText()))
      if (isHelp) {
        const t = node.children.map((c) => (ts.isJsxText(c) ? c.text : c.getText())).join('').replace(/\s+/g, ' ').trim()
        if (t && !t.includes('{')) help.push(t)
        else if (t) unresolved.push(`help text computed: ${t.slice(0, 60)}`)
      }
      if (tag === 'Button' || tag === 'a') {
        const t = node.children.map((c) => (ts.isJsxText(c) ? c.text : '')).join('').replace(/\s+/g, ' ').trim()
        if (t) buttons.push(t)
      }
      /*
      A `<p>` inside a `help=` prop is help, not prose. `AddZone.tsx:326` writes
      `<Row help={<><p>…</p><p>…</p></>}>`, and once fragments became readable the
      same two paragraphs arrived twice: as prose, because they are `<p>`, and as
      help, because they are the value of `help`. Duplicated is worse than
      mislabelled, and of the two readings the prop is the true one — the text
      hangs off a control and is not loose on the surface of the dialog.
      */
      if ((tag === 'p' || tag === 'li') && !insideHelpAttribute(node)) {
        const t = decode(node.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (t) prose.push(t)
      }
      if (tag === 'Alert') {
        const titleAttr = node.openingElement.attributes.properties.find(
          (a) => ts.isJsxAttribute(a) && a.name.getText() === 'title',
        )
        const title = titleAttr && ts.isJsxAttribute(titleAttr)
          ? textOf(ts.isJsxExpression(titleAttr.initializer) ? titleAttr.initializer.expression : titleAttr.initializer)
          : null
        const body = decode(node.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (title || body) prose.push([title, body].filter(Boolean).join(': '))
      }
      if (tag === 'dt') {
        const t = decode(node.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (t) terms.push(t)
      }
      const classAttr = node.openingElement.attributes.properties.find(
        (a) => ts.isJsxAttribute(a) && a.name.getText() === 'className',
      )
      if (classAttr && /styles\.groupTitle/.test(classAttr.getText())) {
        const t = decode(node.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (t) sections.push(t)
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === 'href' && node.initializer && ts.isStringLiteral(node.initializer)) {
      links.push(node.initializer.text)
    }
    /* `{cond && (<block/>)}` — the condition that puts a block on screen. */
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)) {
      const e = node.expression
      if (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        const cond = e.left.getText().replace(/\s+/g, ' ')
        if (cond.length < 90) gates.push(cond)
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === 'label' && node.initializer) {
      const owner = node.parent?.parent
      const tag = owner && ts.isJsxOpeningLikeElement(owner) ? owner.tagName.getText() : '?'
      if (ts.isStringLiteral(node.initializer)) fields.push({ tag, label: node.initializer.text, gate: gateAround(node) })
      else unresolved.push(`${tag} label computed: ${node.initializer.getText().replace(/\s+/g, ' ').slice(0, 70)}`)
    }
    /*
    ── The Settings vocabulary ──────────────────────────────────────────────
    Zones writes its help as a CHILD —`<HelpText>…</HelpText>`— and Settings
    writes it as a PROP: `<TextRow label="…" help="…">`. Same meaning, different
    shape, and reading only the first one made the nine panes come back with
    their 44 labels and ZERO help, which for a dense form is a portrait of the
    screen with the contents removed. The help text IS the surface there.

    Four shapes, all of them real and all of them taken from `ui/PanelForm.tsx`:

      · `help="…"` as a prop of `TextRow`, `AreaRow`, `Row`, `Check`, `GroupRow`.
      · `help` inside an inline option object — `Radios` gives every radio its
        own help, and those are not in a named matrix but in an array literal
        written at the call site.
      · `<Note>` and `<Warning>`, which are `<Alert>` with a fixed title: the
        wrapper supplies `Note!` and `Warning!`, so the call site has the body
        and never the title. They are filed in the same `title: body` form the
        `Alert` reader already produces, so both screens read alike.
      · `<Block title="…">`, the heading of a group of fields. It is optional on
        purpose (`PanelForm.tsx:25`), so its absence is a fact and not a gap.
    */
    if (ts.isJsxAttribute(node) && node.name.getText() === 'help' && node.initializer) {
      const owner = node.parent?.parent
      const tag = owner && ts.isJsxOpeningLikeElement(owner) ? owner.tagName.getText() : '?'
      const init = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer
      const t = init && ts.isStringLiteral(init) ? init.text : null
      if (t) help.push(t)
      else if (init) {
        /* `help={<>… <code>Prefer IPv6</code> …</>}` — flatten it if every leaf
           is literal; say so when it is not, rather than dropping it. */
        const flat = decode(jsxLiteralText(init).replace(/\s+/g, ' ').trim())
        if (flat && !/[{}]/.test(flat)) help.push(flat)
        else unresolved.push(`${tag} help computed: ${init.getText().replace(/\s+/g, ' ').slice(0, 70)}`)
      }
    }
    /*
    Options written INLINE, as an array literal in the `options` attribute:

        <Radios options={[{ value: 'Disabled', label: 'Disable IPv6', help: '…' }, …]} />

    `matrices()` reads `options={MATRIX}` — an identifier — and this is the other
    half: three radio labels of `General` were on the screen and in the source and
    in neither reading, because their `label` is a property of an object and not a
    JSX attribute. The DOM contrast is what turned them up.

    Scoped to `options={[…]}` on purpose. A bare "any property called `label`"
    would swallow every entry of every named matrix — `TSIG_ALGORITHMS` alone is
    eight — and count as controls things that are values.
    */
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText() === 'options' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isArrayLiteralExpression(node.initializer.expression)
    ) {
      const owner = node.parent?.parent
      const tag = owner && ts.isJsxOpeningLikeElement(owner) ? owner.tagName.getText() : '?'
      for (const el of node.initializer.expression.elements) {
        if (!ts.isObjectLiteralExpression(el)) continue
        for (const p of el.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isStringLiteral(p.initializer)) continue
          const key = p.name.getText()
          if (key === 'label') fields.push({ tag: `${tag}Option`, label: p.initializer.text, gate: gateAround(node) })
          else if (key === 'help') help.push(p.initializer.text)
        }
      }
    }
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText()
      if (tag === 'Note' || tag === 'Warning') {
        const body = decode(node.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (body) prose.push(`${tag === 'Note' ? 'Note!' : 'Warning!'}: ${body}`)
        else unresolved.push(`${tag} body computed`)
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === 'title' && node.initializer) {
      const owner = node.parent?.parent
      const tag = owner && ts.isJsxOpeningLikeElement(owner) ? owner.tagName.getText() : '?'
      if (tag === 'Block' && ts.isStringLiteral(node.initializer)) sections.push(node.initializer.text)
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.left.getText() === 'tab'
    ) {
      const t = textOf(node.right)
      if (t) tabs.push(t)
      else unresolved.push(`tab compared against non-literal: ${node.right.getText().slice(0, 40)}`)
    }
  })

  eachNode(sf, (node) => {
    if (!ts.isJsxOpeningLikeElement(node) || node.tagName.getText() !== 'Dialog' || dialog) return
    const attr = (name) => node.attributes.properties.find(
      (a) => ts.isJsxAttribute(a) && a.name.getText() === name,
    )
    const value = (a) => {
      if (!a || !ts.isJsxAttribute(a) || !a.initializer) return null
      return textOf(ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer)
    }
    const actionNames = []
    const actions = attr('actions')
    if (actions?.initializer) {
      eachNode(actions.initializer, (child) => {
        if (!ts.isJsxElement(child) || child.openingElement.tagName.getText() !== 'Button') return
        const t = decode(child.children.map(jsxLiteralText).join('').replace(/\s+/g, ' ').trim())
        if (t) actionNames.push(t)
      })
    }
    dialog = {
      title: value(attr('title')),
      size: value(attr('size')) ?? 'form',
      actions: actionNames,
      close: value(attr('close')) ?? 'Close',
    }
  })
  /*
  Which matrix paints which control.

  The reader saw the matrices and saw the controls and did not know that the one
  feeds the other, so `Primary Zone (default)` and `ECDSA (recommended)` were on
  screen with no source to point at — while sitting in the document, in the
  matrices section, with nobody to belong to. Nothing was missing; something was
  unconnected, and a design handed a list of fields and a list of constants has
  no way to know which goes with which.

  Found by looking for `MATRIX.map(...)` and walking OUT to the nearest thing
  with a name: a `label`/`legend` attribute, a `<GroupRow>`, a `<Field>`.
  */
  /*
  Three shapes the reconciliation turned up last, each real and none exotic:

    · A `Record<K, string>` of labels — `ConvertZone` keeps its three option names
      in `LABELS` and never calls `.map`, so nothing bound them to a control.
    · A literal handed to a LOCAL helper — `text(f.type === 'A' ? 'IPv4 Address' :
      'IPv6 Address', …)`, where the `<Field label={label}>` is inside the helper.
    · Composed labels — `Secondary ROOT Zone` renders with its `reference` text
      appended, so the screen reads `Secondary ROOT Zone (RFC 8806)`.
  */
  eachNode(sf, (node) => {
    /* Values of an object literal used as a label table. */
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'LABELS' &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const prop of node.initializer.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const t = textOf(prop.initializer)
          if (t) fields.push({ tag: 'labelTable', label: t, from: node.name.getText(), gate: null })
        }
      }
    }
    /*
    The FIRST argument of a local helper, and only that one.

    Taking every string argument turned `text('IPv4 Address', 'value', …)` into
    two labels — the second being the state key — and the inventory filled with
    `zone`, `catalog`, `name`, `ttl`, `value`: internal identifiers reported as
    field names. A label that is not a label is worse than a missing one, because
    the design will draw it.
    */
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      labelHelpers.has(node.expression.getText()) &&
      node.arguments.length
    ) {
      const first = node.arguments[0]
      const take = (n) => {
        const t = textOf(n)
        /* A label reads like one: it has a capital or a space. `value` does not. */
        if (t && t.length > 2 && /[A-Z]| /.test(t)) {
          fields.push({ tag: 'helperArg', label: t, via: node.expression.getText(), gate: gateAround(node) })
        }
      }
      if (ts.isConditionalExpression(first)) { take(first.whenTrue); take(first.whenFalse) }
      else take(first)
    }
  })

  const bindings = []
  eachNode(sf, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = node.expression
    if (!ts.isPropertyAccessExpression(callee) || callee.name.getText() !== 'map') return
    const src = callee.expression.getText()
    const matrix = src.match(/^([A-Z][A-Z0-9_]*)$/)?.[1]
    if (!matrix) return
    let owner = node.parent
    let boundTo = null
    while (owner && !ts.isSourceFile(owner)) {
      if (ts.isJsxElement(owner) || ts.isJsxSelfClosingElement(owner)) {
        const el = ts.isJsxElement(owner) ? owner.openingElement : owner
        const attr = el.attributes.properties.find(
          (a) => ts.isJsxAttribute(a) && /^(label|legend|aria-label)$/.test(a.name.getText()),
        )
        const t = attr && ts.isJsxAttribute(attr) ? textOf(attr.initializer) : null
        if (t) { boundTo = { control: el.tagName.getText(), label: t }; break }
      }
      owner = owner.parent
    }
    bindings.push({ matrix, boundTo: boundTo ?? null })
    if (!boundTo) unresolved.push(`${matrix}.map() with no named control around it`)
  })
  /* A reusable renderer can own the `.map`: at its call site the relationship
     is expressed as `<Criterion options={QUERY_ACCESS} …>`. */
  eachNode(sf, (node) => {
    if (!ts.isJsxOpeningLikeElement(node)) return
    const options = node.attributes.properties.find(
      (a) => ts.isJsxAttribute(a) && a.name.getText() === 'options',
    )
    if (!options || !ts.isJsxAttribute(options) || !options.initializer || !ts.isJsxExpression(options.initializer)) return
    const expr = options.initializer.expression
    if (!expr) return
    const head = expr.getText().match(/^([A-Z][A-Z0-9_]*)/)?.[1]
    if (!head || bindings.some((b) => b.matrix === head)) return
    const name = node.attributes.properties.find(
      (a) => ts.isJsxAttribute(a) && /^(name|label|legend|aria-label)$/.test(a.name.getText()),
    )
    const label = name && ts.isJsxAttribute(name)
      ? textOf(ts.isJsxExpression(name.initializer) ? name.initializer.expression : name.initializer)
      : null
    bindings.push({ matrix: head, boundTo: { control: node.tagName.getText(), label } })
  })

  return {
    fields: fields.map((f) => ({ ...f, label: decode(f.label) })),
    tabs,
    help: help.map(decode),
    links,
    buttons,
    gates: [...new Set(gates)],
    bindings,
    prose: [...new Set(prose)],
    sections: [...new Set(sections)],
    terms: [...new Set(terms)],
    dialog,
    unresolved,
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

/*
The screen to read is an argument, defaulting to the one this was written for.
Pilot 3 is a Settings pane, and a tool that only knows how to read Zones would
have been copied instead of called — which is how two tools that disagree get
born. `screens/zones` stays the default so every existing invocation, and the
twelve regression tests, keep meaning exactly what they meant.

  node dev/static-contract.mjs                    → screens/zones
  node dev/static-contract.mjs screens/settings   → the nine Settings panes

The inventory filter takes `panes/` alongside `modals/` for the same reason: the
components of a screen live one directory down, and each screen names that
directory its own way.
*/
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'screens/zones'
  const files = walk(join(ROOT, target))
  const confs = confirmations(files)
  const mats = matrices(files)

  if (process.argv.includes('--json')) {
    const inv = {}
    for (const f of files.filter((x) => /(modals|panes)\/[A-Z]/.test(x))) inv[relative(ROOT, f)] = inventory(f)
    console.log(JSON.stringify({ recognised: RECOGNISED, confirmations: confs, matrices: mats, inventory: inv }, null, 1))
  } else {
    console.log('WHAT THIS READS, and nothing else:')
    for (const r of RECOGNISED) console.log(`  · ${r}`)

    console.log(`\nCONFIRMATIONS: ${confs.length}  (destructive invocations: ${confs.filter((c) => c.danger).length})\n`)
    for (const c of confs) {
      console.log(`  ${c.title ?? '?'}${c.danger ? '  [danger]' : ''}  — ${c.label ?? '?'}   ${c.file}:${c.line}`)
      for (const t of c.texts ?? []) console.log(`    "${t.text}"${t.when ? `   [when ${t.when}]` : ''}`)
      if (!c.texts?.length) console.log('    (no literal text)')
      if (c.unresolved?.length) console.log(`    UNRESOLVED: ${c.unresolved.join(' · ')}`)
    }

    const entries = Object.entries(mats)
    const arrays = entries.filter(([, v]) => v.values || v.structured)
    const notArrays = entries.filter(([, v]) => /^initializer is/.test(v.unresolved ?? ''))
    const badArrays = entries.filter(([, v]) => v.unresolved && !/^initializer is/.test(v.unresolved))
    console.log(
      `\nUPPERCASE CONSTANTS: ${entries.length} — of which ${arrays.length + badArrays.length} are arrays ` +
        `(${arrays.length} read, ${badArrays.length} not), and ${notArrays.length} are not arrays at all\n`,
    )
    for (const [k, v] of entries) {
      if (v.unresolved) console.log(`  ${k} — UNRESOLVED: ${v.unresolved}`)
      else if (v.structured) console.log(`  ${k} — ${v.count} entries: ${v.labels.join(' · ')}`)
      else console.log(`  ${k} = ${v.values.join(', ')}`)
    }

    console.log('\nUNRESOLVED in the modals:')
    for (const f of files.filter((x) => /modals\/[A-Z]/.test(x))) {
      const inv = inventory(f)
      if (inv.unresolved.length) console.log(`  ${relative(ROOT, f)}:\n    ${inv.unresolved.join('\n    ')}`)
    }
  }
}
