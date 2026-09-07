# Identity in the history, before publishing

**Date:** 2026-09-07 · **Status:** decided, not executed. Nothing is published
until this is done.

## What is in the history today

Measured, not assumed:

| | |
|---|---|
| Commits | 244 |
| Author names | two — `Adrián García` (111) and `agarmoli` (133) |
| Author and committer address | the personal address, in all 244 |
| Signatures | none (`%G?` is `N` for all 244) |
| Remote | `byGarcia/technitium-console`, private, holding **173** of them — `34acd54`, 2026-09-02. The local branch is 71 commits ahead, so everything from phase 3 onwards has never left this machine |
| The address inside files | **none** — no source file, workflow or `package.json` field carries a personal address |

So the whole problem is in the commit objects, and only there.

## A committed `.mailmap` does not fix it

It maps names at display time, in `git log` and `git shortlog`. The objects keep
the address, `git log --format=%ae` still prints it, and so does the API. A
public repository with a `.mailmap` is a public repository with the address in
it.

The same file format is, however, the input `git filter-repo --mailmap` takes,
and that one does rewrite the objects. Same format, different thing entirely.

## Decided

1. **The local identity is already fixed** (2026-09-07): this repository commits
   as `byGarcia <byGarcia@users.noreply.github.com>`, the pair `byGarcia/Shoppa`
   is published under. Nothing from here on adds to the problem.
2. **The history is rewritten in one pass, in the same session as the first
   public push** — not before. A rewritten history sitting next to a private
   remote that still holds the old one is one absent-minded `git pull` away from
   244 duplicated commits, and there is nothing to gain from carrying that risk
   for days. The private remote is 71 commits behind and stays that way: nothing
   is pushed to it again.
3. **The dates stay exactly as they are** — ratified 2026-09-07: no re-timing,
   no squash, the identity is the only thing rewritten. The documentation dates
   the work day by day — file names, `verificado:` fields, the log in ORBITLAB —
   and moving the commits would put the history at odds with the documents that
   describe it. The times of day do show weekday work; the only coherent way to
   change that is to squash everything into a handful of commits with chosen
   timestamps, which throws away the record of how it was built, and that record
   is the point.

   Shoppa is not a precedent that transfers: its thirteen commits were re-timed
   into the evening before the first push, and thirteen commits fit in one
   evening. Two hundred and forty-four across two weeks do not, and forcing them
   would put the history in contradiction with every dated document in the
   repository. Put to Adrián as the one open question here, and answered: the
   dates are kept, the record is worth more than the hours.
4. **Publish into a fresh empty repository**, and do not flip this private one to
   public. After a force-push, unreachable objects stay fetchable by SHA for as
   long as the host keeps them, and "for as long as the host keeps them" is not a
   guarantee anyone should publish on.

## The pass itself

```sh
git clone --no-local . ../technitium-console-rewrite   # the safety net is a copy
cd ../technitium-console-rewrite
printf 'byGarcia <byGarcia@users.noreply.github.com> <THE-OLD-ADDRESS>\n' > /tmp/mailmap
git filter-repo --mailmap /tmp/mailmap
git log --format='%an <%ae>|%cn <%ce>' | sort -u      # must print exactly one line
```

Then push that to the new remote, and only then make it public.

## What it costs, and who pays

Every SHA changes. ORBITLAB's `LOG.md` and the wiki cite them — 91 short hashes
at the last count — and `LOG.md` is append-only, so they are not edited: the
entry that records the rewrite says the old hashes belong to the history before
it, which is the honest way to leave a broken reference behind.
