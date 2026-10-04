"""Offline installer regressions; run as root in a bounded, network-free sandbox.

Only dummy paths beneath the selected scratch root are used. No host service,
Docker socket, credentials or production endpoint is used by this harness.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "install.sh").read_text()
BASE = Path(tempfile.mkdtemp(prefix="installer-security-", dir=os.environ["TMPDIR"]))
BASE.chmod(0o755)

# Source the native functions, omitting discovery and the real install entrypoint.
functions = SOURCE[SOURCE.index("resolve_path()") : SOURCE.index("# What a console looks like")]
functions = functions[:functions.index("# --into-volume")] + functions[functions.index("refuse_links()") :]
publishing = SOURCE[SOURCE.index("CUSTOM_GLOB=") : SOURCE.index("verify_checksum()")]
preamble = "set -eu\nBACKUP_SUFFIX=.original\nINTO_VOLUME=\nMARKER=.technitium-console\nDOCKER_DOCS=fixture\ndie() { echo \"$*\" >&2; exit 1; }\n"
LIBRARY = BASE / "functions.sh"
LIBRARY.write_text(preamble + functions + publishing)


def shell(body, ok=True):
    result = subprocess.run(["/bin/sh", "-c", '. "' + str(LIBRARY) + '"\n' + body],
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            timeout=10, env={"PATH": "/usr/bin:/bin", "TMPDIR": str(BASE)})
    if (result.returncode == 0) != ok:
        raise AssertionError(result.stdout)
    return result.stdout


def tree(name):
    path = BASE / name
    path.mkdir(mode=0o755)
    return path


# Valid publication retains custom lists and removes only the old snapshot.
src, dst, work = tree("source"), tree("console"), tree("work")
(src / "assets").mkdir()
(src / "assets/new.js").write_text("new")
(src / "index.html").write_text("new page")
(dst / "json").mkdir()
(dst / "json/keep-custom.json").write_text("custom")
(dst / "old.js").write_text("old")
shell(f'snapshot "{dst}" "{work}"; publish "{src}" "{dst}" "{work}"')
assert (dst / "index.html").read_text() == "new page"
assert (dst / "json/keep-custom.json").read_text() == "custom"
assert not (dst / "old.js").exists()
print("PASS ordinary publication and custom-list preservation")

# A literal newline pathname must not be reinterpreted as ../victim.
victim = BASE / "victim"
victim.write_text("untouched")
malformed = dst / "prefix\n.."
malformed.mkdir()
(malformed / "victim").write_text("dummy")
shell(f'snapshot "{dst}" "{work}"', ok=False)
assert victim.read_text() == "untouched"
print("PASS newline sweep escape rejected before snapshot")

# A service-writable top level or ancestor is rejected before root publication.
unsafe = tree("service-owned")
os.chown(unsafe, 65534, 65534)
shell(f'secure_tree "{unsafe}"', ok=False)
child = unsafe / "child"
child.mkdir()
shell(f'secure_tree "{child}"', ok=False)
print("PASS service-owned tree and ancestor rejected")

# A group-writable namespace is unsafe even when its owner is root.
writable = tree("group-writable")
writable.chmod(0o775)
shell(f'secure_tree "{writable}"', ok=False)
print("PASS group-writable namespace rejected")

# Root-only directories cannot make service-controlled state contents trusted.
state = tree("state")
state_file = state / "install.state"
state_file.write_text("webroot=dummy\n")
os.chown(state_file, 65534, 65534)
shell(f'secure_tree "{state}"', ok=False)
os.chown(state_file, 0, 0)
state_file.chmod(0o664)
shell(f'secure_tree "{state}"', ok=False)
print("PASS service-owned and group-writable state files rejected")

# A source link must never turn root-private bytes into a public custom list.
private, stock, output = tree("private"), tree("stock"), tree("output")
private.chmod(0o700)
secret = private / "dummy"
secret.write_text("private dummy")
secret.chmod(0o644)
(stock / "json").mkdir()
(stock / "json/leak-custom.json").symlink_to(secret)
shell(f'carry_custom_lists "{stock}" "{output}"', ok=False)
assert not (output / "json/leak-custom.json").exists()
print("PASS custom-list source symlink rejected")

# Hard links and devices are not accepted as ordinary console files.
hard = tree("hard-linked")
os.link(victim, hard / "file")
shell(f'secure_tree "{hard}"', ok=False)
print("PASS hard-linked file rejected")

# Direct calls still cannot use reconstructed traversal components.
shell(f'copy_one "{src}" "{output}" ../victim', ok=False)
assert victim.read_text() == "untouched"
print("PASS copy destination traversal rejected")
