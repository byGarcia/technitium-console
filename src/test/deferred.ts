/*
A promise the test settles by hand. Two requests answered out of order are how a
test proves a screen draws only the answer of the latest request it made.
*/
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
