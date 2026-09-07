#!/usr/bin/env bash
# Packages one of this folder's tools as a Playwright snippet, to inject it with
# browser_run_code_unsafe --filename instead of pasting it every session. The
# MCP server only reads inside the ORBITLAB repo, so the output goes there.
#
# The file is serialised as a JSON literal, not as a template: the tools carry
# their own backtick templates, and nesting them inside another one —String.raw
# included— produces a `SyntaxError` as soon as it is evaluated.
#
#   ./make-injector.sh                                  measure-screen.js, as before
#   ./make-injector.sh screen-contract.mjs contract,dependencies
#
# `addInitScript` is what makes it survive a navigation, which matters: the
# contract is taken on several screens in a row and re-pasting it on each one is
# how a sweep ends up half measured with one version and half with another.
set -euo pipefail
cd "$(dirname "$0")"

SOURCE="${1:-measure-screen.js}"
EXPOSED="${2:-measure,measureState,walk,sweepStates}"
TARGET="${3:-../../../.playwright-mcp/inject-$(basename "${SOURCE%.*}").js}"
mkdir -p "$(dirname "$TARGET")"

python3 - "$SOURCE" "$EXPOSED" "$TARGET" <<'PY'
import json, re, sys, pathlib

src_path, exposed_csv, target = sys.argv[1], sys.argv[2], sys.argv[3]

# The comments are half the file and are of no use inside the browser; out they
# go, because this payload travels whole on every injection.
source = pathlib.Path(src_path).read_text(encoding='utf-8')
source = re.sub(r'/\*[\s\S]*?\*/', '', source)
source = re.sub(r'^\s*//.*$', '', source, flags=re.M)
source = re.sub(r'^[ \t]+', '', source, flags=re.M)
source = re.sub(r'\n\s*\n+', '\n', source)
# The tools are ES modules for the test runner; inside the browser they are a
# plain script, so the keyword that makes them modules has to go.
source = re.sub(r'^export\s+', '', source, flags=re.M)
# And the tail that self-registers on `window` would run before the names exist.
source = re.sub(r'^if \(typeof window[\s\S]*$', '', source, flags=re.M)

exposed = [n.strip() for n in exposed_csv.split(',') if n.strip()]

# The fingerprint of what is actually being injected.
#
# Twice on 2026-09-02 a tool was regenerated and NOT re-injected, so the page kept
# running the previous bundle while the source on disk said otherwise — and the
# dumps taken in between looked like findings. A dump that cannot say which
# version produced it is a dump that cannot be trusted after the fact, so the
# stamp travels inside every contract.
import hashlib
stamp = hashlib.sha256(source.encode('utf-8')).hexdigest()[:12]
body = (
    source
    + '\n'
    + f'window.__contractVersion = {json.dumps(stamp)};'
    + ''.join(f'window.{n}={n};' for n in exposed)
)

pathlib.Path(target).write_text(
    'async (page) => {\n'
    f'  const boot = "(()=>{{" + {json.dumps(body)} + "}})()";\n'
    '  await page.addInitScript(boot);\n'
    '  await page.evaluate(boot);\n'
    '  return await page.evaluate(() => '
    f'({json.dumps(exposed)}.map((n) => `${{n}}:${{typeof window[n]}}`)'
    f'.concat([`version:${{window.__contractVersion}}`])));\n'
    '}\n',
    encoding='utf-8',
)
PY
echo "$TARGET"
