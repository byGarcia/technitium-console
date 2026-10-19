/*
"Per page" selects that upstream remembers in `localStorage` (zone.js:626-640):
written on change, read back when the screen loads. A value that is not one of
the select's options is ignored, as a native select cannot show it.
*/
export function readPerPage(key: string, options: readonly number[], fallback: number): number {
  try {
    const saved = Number(localStorage.getItem(key))
    if (options.includes(saved)) return saved
  } catch {
    /* Without localStorage the select's default is used. */
  }
  return fallback
}

export function writePerPage(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* Without localStorage it is not remembered; the select still works. */
  }
}
