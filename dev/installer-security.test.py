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

# A namespace its group can write is unsafe when that group is not root's.
writable = tree("group-writable")
writable.chmod(0o775)
os.chown(writable, 0, 65534)
shell(f'secure_tree "{writable}"', ok=False)
print("PASS namespace writable by a non-root group rejected")

# Technitium's own tarball ships every file 0664, and tar run as root keeps
# that mode. Root's group writing root's files gives no other account a way in.
stock_tree = tree("stock-tarball")
stock_tree.chmod(0o775)
(stock_tree / "favicon.ico").write_text("icon")
(stock_tree / "favicon.ico").chmod(0o664)
shell(f'secure_tree "{stock_tree}"')
other_writable = tree("other-writable")
(other_writable / "favicon.ico").write_text("icon")
(other_writable / "favicon.ico").chmod(0o666)
shell(f'secure_tree "{other_writable}"', ok=False)
print("PASS root group may write, other accounts may not")

# On an object with a POSIX access control list the group bits are the list's
# mask, so root:root 0775 can be a named account that setfacl let write.
def access_acl(named_uid, named_perm):
    import struct
    every = 0xFFFFFFFF  # ACL_UNDEFINED_ID: the owner, group and other entries
    entries = [(0x01, 7, every), (0x02, named_perm, named_uid), (0x04, 5, every),
               (0x10, named_perm | 5, every), (0x20, 5, every)]
    return struct.pack("<I", 2) + b"".join(struct.pack("<HHI", *e) for e in entries)


acl_root = tree("acl-writable")
os.setxattr(acl_root, "system.posix_acl_access", access_acl(65534, 7))
shell(f'secure_tree "{acl_root}"', ok=False)
acl_file = tree("acl-writable-file")
acl_file.chmod(0o775)
(acl_file / "favicon.ico").write_text("icon")
(acl_file / "favicon.ico").chmod(0o664)
os.setxattr(acl_file / "favicon.ico", "system.posix_acl_access", access_acl(65534, 6))
shell(f'secure_tree "{acl_file}"', ok=False)
acl_parent = tree("acl-writable-parent")
os.setxattr(acl_parent, "system.posix_acl_access", access_acl(65534, 7))
(acl_parent / "console").mkdir()
shell(f'secure_tree "{acl_parent / "console"}"', ok=False)
acl_read = tree("acl-read-only")
os.setxattr(acl_read, "system.posix_acl_access", access_acl(65534, 5))
shell(f'secure_tree "{acl_read}"')
print("PASS access control list that lets another account write rejected")

# Root-only directories cannot make service-controlled state contents trusted.
state = tree("state")
state_file = state / "install.state"
state_file.write_text("webroot=dummy\n")
os.chown(state_file, 65534, 65534)
shell(f'secure_tree "{state}"', ok=False)
os.chown(state_file, 0, 65534)
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
