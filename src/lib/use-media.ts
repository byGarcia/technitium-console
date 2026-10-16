import { useCallback, useSyncExternalStore } from 'react'

/*
Whether a media query matches, kept current as the window changes.

For the few layouts where a breakpoint has to change what is RENDERED and not only
how it is drawn: a control that exists below a width and must not exist above it
(a toggle that would do nothing on a wide screen is a dead control in the tab
order). Everything else stays in CSS.

`matchMedia` can be missing (jsdom, the test environment) or throw (theme.ts says
where): either way the answer is `false`, which is the wide layout, the one every
existing test was written against.
*/
function mediaList(query: string): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null
  } catch {
    return null
  }
}

export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query)
      list?.addEventListener('change', onChange)
      return () => list?.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => mediaList(query)?.matches ?? false,
    () => false,
  )
}
