# Changelog

Notable changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once there is more than one.

## Unreleased

### Added

- **The domain-tree round.** `Cache`, `Allowed` and `Blocked` are one component with three wrappers
  and had inherited the wrong archetype — a paginated collection, for something that is a tree. The
  tree becomes a full-height column beside the records instead of a small panel with an empty half
  screen next to it, the open node's path is written out, and the three screens are told apart
  without reading the title: an icon, a second line, and a colour that already meant that word in
  the Dashboard chart and the Logs rows.
- **The installer meets a written contract.** Twenty-one clauses and a bench of twenty-one cases
  against the official image: custom lists kept on the way in and out, an interrupted run repaired
  by the next one, the web root read off the running server instead of guessed, and no restart of
  the DNS service.
- **Sort parity is measured.** `dev/check-parity-sort.mjs` reads upstream's `sortTable(...)` calls
  and compares them column by column, and every gap has to carry a reason.

### Fixed

- **Two sortable columns that had been lost**, in the App Store list and in the installed apps list,
  and **one that was dead**: the Edit Permissions modal named a sort key that did not exist, so its
  two headers had done nothing for a week with every check green.
- **Loading no longer looks like emptiness** on the records side of the three list screens, which
  said `0 records at <ROOT>` while the request was still in flight.
- **`Uninstall` moved into the app card's menu.** A filled red button repeated once per card is what
  the button primitive explicitly says not to do.
- **The App Store is readable.** Twenty-seven apps were 5,868 px of scrolling at 1440 and 9,337 at
  390; the description now shows two lines with the rest behind the disclosure the card next door
  already used. It is 3,450 and 3,575.
- Elements that rendered with no class at all because they named a CSS class that did not exist.

### Changed

- **`src/` is entirely English** — comments, identifiers, file names and test descriptions — with a
  gate that enforces it.
