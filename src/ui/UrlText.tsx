import { Fragment } from 'react'

/*
A URL that wraps after its separators, the way `DomainName` wraps a name after its
dots.

A list URL has no spaces, so without help the browser has two choices and both are
wrong: overflow its box, or, with `overflow-wrap: anywhere` or `break-all`, end a
line wherever the edge falls (`raw.githubuser` / `content.com`). The second also
lets a table squeeze the column to a few characters, because it tells the browser
the URL may break after ANY letter.

So a `<wbr>` goes after each run of `/`, `.`, `?`, `&` and `=`: after `https://`
and not between its two slashes, after `raw.`, after `hosts/`. The pieces are not
made unbreakable, unlike a domain's labels: a path segment can be longer than any
column, and the caller's `overflow-wrap: break-word` still breaks that one piece
when it alone does not fit. It does not change the column's minimum, which is then
the longest piece.

`<wbr>` carries no text: the copied text, the find-in-page match and what a screen
reader reads are the URL as written.
*/
export function UrlText({ url }: { url: string }) {
  const pieces = url.split(/(?<=[/.?&=])(?![/.?&=])/)
  if (pieces.length < 2) return <>{url}</>
  return (
    <>
      {pieces.map((piece, i) => (
        <Fragment key={i}>
          {piece}
          {i < pieces.length - 1 && <wbr />}
        </Fragment>
      ))}
    </>
  )
}
