import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Card, PageHeader, cx } from '../components/ui'
import type { Message } from '../lib/types'
import { yen } from '../lib/util'
import { contractBadge } from './Requests'

export default function Thread() {
  const { id } = useParams()
  const { be, contracts, authUser, profile, toast } = useApp()
  const k = contracts.find(x => x.id === id)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => (id ? be.watchMessages(id, setMsgs) : undefined), [be, id])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])
  if (!k || !authUser || !profile) return <><PageHeader title="依頼" back /><Card>読み込み中…</Card></>
  const meCoach = k.coach === authUser.uid
  const other = meCoach ? k.player : k.coach
  const send = async () => {
    const t = text.trim(); if (!t) return
    setText('')
    await be.sendMessage(k.id, { from: authUser.uid, fromName: profile.name, text: t, at: Date.now() })
    be.notify(other, `【メッセージ】${profile.name}：${t.slice(0, 60)}`, 'msg').catch(() => {})
  }
  const respond = async (ok: boolean) => {
    setBusy(true)
    await be.setContractStatus(k.id, ok ? 'active' : 'declined')
    if (ok && k.clubCode) await be.joinClub(k.clubCode, authUser.uid).catch(() => {})
    await be.sendMessage(k.id, { from: authUser.uid, fromName: profile.name, text: ok ? 'お引き受けします。よろしくお願いします。' : '今回はお引き受けできません。申し訳ありません。', at: Date.now() })
    await be.notify(k.player, `【依頼の返事】${profile.name}さんが「${k.title}」を${ok ? '引き受けました' : 'お断りしました'}`, 'contract').catch(() => {})
    setBusy(false); toast(ok ? `${k.clubName}の指導者になりました` : 'お断りの返事をしました')
  }
  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col">
      <PageHeader title={meCoach ? k.clubName : k.coachName} back sub={k.title} />
      <Card className="!p-3">
        <div className="flex items-center justify-between text-[13px]"><span className="text-ink-2">1回あたりの謝金</span><b>{yen(k.fee)}</b></div>
        <div className="mt-1 flex items-center justify-between text-[13px]"><span className="text-ink-2">状況</span>{contractBadge(k)}</div>
        {meCoach && k.status === 'proposed' && (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" loading={busy} onClick={() => respond(false)}>お断りする</Button>
            <Button className="flex-1" loading={busy} onClick={() => respond(true)}>引き受ける</Button>
          </div>
        )}
      </Card>
      <div className="mt-4 flex-1 space-y-2">
        {msgs.map(m => {
          const mine = m.from === authUser.uid
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] animate-up rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed', mine ? 'rounded-br-lg bg-brand text-white' : 'rounded-bl-lg bg-white shadow-card')}>
                {!mine && <div className="mb-0.5 text-[11px] font-bold text-ink-3">{m.fromName}</div>}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] mt-3 flex items-end gap-2 rounded-3xl bg-white p-2 shadow-pop">
        <textarea rows={1} value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力" className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[16px] outline-none" />
        <button onClick={send} disabled={!text.trim()} aria-label="送信" className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white disabled:opacity-40"><ArrowUp size={20} /></button>
      </div>
    </div>
  )
}
