/*
A text matcher for a name drawn in pieces.

`ui/DomainName` draws a name as one `<span>` per label, so `getByText('a.example')`
finds nothing: Testing Library matches an element's OWN text nodes, and here each
element owns one label. This matches the innermost element whose whole text is the
name, which is the element a person reads as "that name".

It goes through the `*ByText` queries, `queryByText` included, so a test that checks
a name is gone keeps checking something.
*/
export function wholeText(text: string) {
  return (_: string, element: Element | null): boolean =>
    element != null
    && element.textContent === text
    && ![...element.children].some((child) => child.textContent === text)
}
