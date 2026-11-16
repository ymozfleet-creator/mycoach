import { useEffect, useState } from 'react'
import { useApp } from './store'
import type { ClubSub } from './types'

/** クラブ内の申請・記録を購読する（onlyBy を付けると自分が出したものだけ） */
export function useSub<T>(name: ClubSub, onlyBy?: string, enabled = true) {
  const { be, club } = useApp()
  const [list, setList] = useState<T[] | null>(null)
  useEffect(() => (club && enabled ? be.watchSub<T>(club.id, name, setList, onlyBy) : undefined), [be, club?.id, name, onlyBy, enabled])
  return list
}
