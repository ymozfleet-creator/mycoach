import { useNavigate } from 'react-router-dom'
import { Handshake } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, PageHeader } from '../components/ui'
import type { Contract } from '../lib/types'
import { relTime, yen } from '../lib/util'

export const contractBadge = (k: Contract) =>
  k.status === 'proposed' ? <Badge tone="warn">返事待ち</Badge> : k.status === 'active' ? <Badge tone="ok">引き受け済み</Badge> : k.status === 'declined' ? <Badge tone="none">お断り</Badge> : <Badge tone="none">終了</Badge>

export default function Requests() {
  const { contracts, authUser, isAdmin } = useApp()
  const nav = useNavigate()
  return (
    <>
      <PageHeader title={isAdmin ? '指導者への依頼' : '指導の依頼'} back={isAdmin} />
      {isAdmin && <Button block variant="soft" className="mb-3" onClick={() => nav('/coaches')}>指導者を探す</Button>}
      {contracts.length ? (
        <div className="space-y-2">
          {contracts.map(k => {
            const other = k.coach === authUser?.uid ? k.clubName : k.coachName
            return (
              <Card key={k.id} onClick={() => nav(`/requests/${k.id}`)} className="flex items-center gap-3">
                <Avatar name={other} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{other}</div>
                  <div className="truncate text-[13px] text-ink-2">{k.title}・1回 {yen(k.fee)}</div>
                  <div className="mt-1 flex items-center gap-2">{contractBadge(k)}<span className="text-[11px] text-ink-3">{relTime(k.at)}</span></div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : <Empty icon={<Handshake />} title="依頼はまだありません" text={isAdmin ? '「指導者を探す」から依頼を送れます' : 'クラブから依頼が届くとここに表示されます。審査を済ませておくと依頼が届きやすくなります'} />}
    </>
  )
}
