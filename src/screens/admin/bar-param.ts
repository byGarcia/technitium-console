import { useEffect, useState } from 'react'
import { dropParams, readParam, writeParams } from '../../lib/url-state'

/*
One piece of a list's view kept in the address bar (deviation 23): the search of
Users, Groups and Sessions (`?q=`) and the filter a stat cell sets (`?status=`,
`?type=`). Read once on arrival, written by replacing the entry as it changes, and
dropped when the screen goes, as Cache and Apps keep theirs (`lib/url-state.ts`).
*/
export function useBarParam(name: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => readParam(name) ?? '')
  useEffect(() => {
    writeParams({ [name]: value })
  }, [name, value])
  useEffect(() => () => dropParams([name]), [name])
  return [value, setValue]
}
