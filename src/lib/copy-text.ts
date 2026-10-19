/*
Copies a text to the clipboard. The Clipboard API only exists in a secure
context (HTTPS or localhost), and this console is usually opened over plain
HTTP on the server's address, so without it the text goes through a hidden,
selected textarea and the browser's copy command, which works there.

`host` is where the textarea goes, and inside a modal it has to be inside the
modal: the dialog traps the focus and takes it back from anything outside, so a
textarea on `document.body` lost its selection before the copy ran and nothing
was copied (seen in Chromium over http://<server>:5380).
*/
export async function copyText(value: string, host: HTMLElement = document.body): Promise<boolean> {
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
  host.appendChild(area)
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
