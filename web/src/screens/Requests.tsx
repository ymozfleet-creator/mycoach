import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Handshake, Megaphone, Search } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented, stagger } from '../components/ui'
import type { Contract } from '../lib/types'
import { relTime, yen } from '../lib/util'
import { JobList } from './Jobs'

/** 依頼・応募を出した人（古いデータは依頼したクラブ側） */
export const initiator = (k: Contract) => k.by || k.player

export const contractBadge = (k: Contract, me?: string) =>
  k.status === 'proposed' ? (me && initiator(k) !== me ? <Badge tone="danger">返事をしてください</Badge> : <Badge tone="warn">返事待ち</Badge>)
    : k.status === 'active' ? <Badge tone="ok">指導中</Badge>
    : k.status === 'declined' ? <Badge tone="none">お断り</Badge>
    : k.status === 'withdrawn' ? <Badge tone="none">取り下げ</Badge>
    : <Badge tone="none">終了</Badge>

export default function Requests() {
  const { isAdmin: adm, coachMode: cm } = useApp()
  if (adm || cm) return <Navigate to="/match?tab=list" replace />
  return <RequestsLegacy />
}

function RequestsLegacy() {
  const { contracts, authUser, isAdmin, coachMode } = useApp()
  const nav = useNavigate()
  const waiting = contracts.filter(k => k.status === 'proposed' && initiator(k) !== authUser?.uid).length
  const [tab, setTab] = useState<'jobs' | 'mine'>(coachMode && !waiting ? 'jobs' : 'mine')
  const list = (
    contracts.length ? (
      <div className="space-y-2">
        {contracts.map((k, i) => {
          const meCoach = k.coach === authUser?.uid
          const other = meCoach ? k.clubName : k.coachName
          return (
            <Card key={k.id} onClick={() => nav(`/requests/${k.id}`)} style={stagger(i)} className="flex animate-up items-center gap-3">
              <Avatar name={other} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5"><span className="truncate font-bold">{other}</span><span className="shrink-0 text-[11px] text-ink-3">{k.postId ? (meCoach ? 'あなたが応募' : '応募あり') : meCoach ? '依頼が届いた' : 'あなたが依頼'}</span></div>
                <div className="truncate text-[13px] text-ink-2">{k.title}・1回 {yen(k.fee)}</div>
                <div className="mt-1 flex items-center gap-2">{contractBadge(k, authUser?.uid)}<span className="text-[11px] text-ink-3">{relTime(k.at)}</span></div>
              </div>
            </Card>
          )
        })}
      </div>
    ) : <Empty icon={<Handshake />} title="やりとりはまだありません" text={isAdmin ? '募集を出すか、指導者を探して依頼できます' : '募集に応募するか、クラブから依頼が届くとここに表示されます'} />
  )
  if (isAdmin) return (
    <>
      <PageHeader title="指導者の募集・依頼" back />
      <div className="mb-3 grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={() => nav('/posts')}><Megaphone size={18} />募集を出す</Button>
        <Button variant="soft" onClick={() => nav('/coaches')}><Search size={18} />指導者を探す</Button>
      </div>
      {list}
    </>
  )
  return (
    <>
      <PageHeader title="募集・依頼" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'jobs', label: '募集を探す' }, { value: 'mine', label: `やりとり${waiting ? `（${waiting}）` : ''}` }]} />
      <div className="mt-3">{tab === 'jobs' ? <JobList /> : list}</div>
    </>
  )
}
