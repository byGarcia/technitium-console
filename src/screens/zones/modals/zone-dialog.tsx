/*
The two pieces the zone dialogs share, a labelled group and a radio drawn as a
tile, are the console's dialog pieces since 2026-11-06 (`ui/DialogForm`): Add
Zone was where they were drawn first, and every dialog now uses them. They keep
their old names here so the zone dialogs read as before.
*/
export { DialogGroup as Group, Tile } from '../../../ui/DialogForm'
