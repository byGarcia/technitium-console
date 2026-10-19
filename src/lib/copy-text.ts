/*
Copies a text to the clipboard. The Clipboard API only exists in a secure
context (HTTPS or localhost), and this console is usually opened over plain
HTTP on the server's address, so without it the text goes through a hidden,
selected textarea and the browser's copy command, which works there.
*/
export async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText != null) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      /* Refused (no permission, no focus): try the old way. */
    }
  }

  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  const before = document.activeElement as HTMLElement | null
  area.focus()
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  before?.focus()
  return ok
}
