import { useState } from 'react'
import { HandCoins } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Empty, Field, inputCls, PageHeader, Section, Sheet, cx } from '../components/ui'
import { useSub } from '../lib/useSub'
import type { FeeRequest } from '../lib/types'
import { uid6 } from '../lib/util'

const st = (r: FeeRequest) => r.status === 'approved' ? <Badge tone="ok">承認</Badge> : r.status === 'declined' ? <Badge tone="none">見送り</Badge> : <Badge tone="warn">確認中</Badge>

/** 会費の減免：保護者は申請、運営は承認・見送り */
export default function FeeRequests() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminView /> : <MemberView />
}

function MemberView() {
  const { be, club, profile, authUser, myPlayers, toast } = useApp()
  const mine = useSub<FeeRequest>('feeRequests', authUser?.uid)
  const [f, setF] = useState({ playerId: myPlayers[0]?.id || '', discount: 50 as 50 | 100, reason: '' })
  const [busy, setBusy] = useState(false)
  if (!club || !profile || !authUser) return null
  const kid = myPlayers.find(p => p.id === (f.playerId || myPlayers[0]?.id))
  const send = async () => {
    if (!kid) return
    setBusy(true)
    try {
      await be.addSub(club.id, 'feeRequests', { playerId: kid.id, playerName: kid.name, by: authUser.uid, byName: profile.name, discount: f.discount, reason: f.reason.trim().slice(0, 500), status: 'pending', at: Date.now() }, 'r' + uid6())
      for (const u of club.adminUids) await be.notify(u, `会費の減免の申請が届きました（${kid.name}さん）`, 'fee').catch(() => {})
      setF(x => ({ ...x, reason: '' })); toast('申請しました。運営からの返事をお待ちください')
    } catch { toast('申請できませんでした') }
    setBusy(false)
  }
  return (
    <>
      <PageHeader title="会費の減免の申請" back sub="きょうだい・家計の事情などで会費が負担な場合" />
      <Card>
        <p className="text-[13px] leading-relaxed text-ink-2">申請の内容は、クラブの運営の方だけが見られます。ほかの保護者には表示されません。</p>
        {myPlayers.length === 0 ? <p className="mt-3 text-[14px] font-bold">先にマイページからお子さまを登録してください。</p> : <>
          <Field label="お子さま"><select className={inputCls} value={kid?.id} onChange={e => setF({ ...f, playerId: e.target.value })}>{myPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="希望する減免"><div className="flex gap-2">{([50, 100] as const).map(d => <button key={d} onClick={() => setF({ ...f, discount: d })} className={cx('h-11 flex-1 rounded-xl border text-[14px] font-bold', f.discount === d ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{d === 50 ? '半額' : '全額免除'}</button>)}</div></Field>
          <Field label="理由" hint="500文字まで。書ける範囲でかまいません"><textarea className={inputCls} rows={4} value={f.reason} maxLength={500} onChange={e => setF({ ...f, reason: e.target.value })} placeholder="例：きょうだい2人が在籍しているため" /></Field>
          <Button block size="lg" loading={busy} disabled={!f.reason.trim()} onClick={send}>申請する</Button>
        </>}
      </Card>
      <Section title="これまでの申請">
        {mine === null ? null : mine.length === 0 ? <p className="text-[13px] text-ink-3">まだ申請はありません。</p> : mine.map(r => (
          <Card key={r.id} className="mb-2"><div className="flex items-center justify-between"><b className="text-[14px]">{r.playerName}さん・{r.discount === 50 ? '半額' : '全額免除'}</b>{st(r)}</div>{r.note && <p className="mt-1 text-[13px] text-ink-2">運営より：{r.note}</p>}</Card>
        ))}
      </Section>
    </>
  )
}

function AdminView() {
  const { be, club, players, toast } = useApp()
  const list = useSub<FeeRequest>('feeRequests')
  const [cur, setCur] = useState<FeeRequest | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!club) return null
  const decide = async (ok: boolean) => {
    if (!cur) return
    setBusy(true)
    try {
      await be.updateSub(club.id, 'feeRequests', cur.id, { status: ok ? 'approved' : 'declined', note: note.trim().slice(0, 500) })
      const p = players.find(x => x.id === cur.playerId)
      if (ok && p) await be.savePlayer(club.id, { ...p, discount: cur.discount })
      await be.notify(cur.by, `会費の減免の申請（${cur.playerName}さん）：${ok ? '承認されました。来月分の会費から反映されます' : '今回は見送りになりました'}`, 'fee').catch(() => {})
      toast(ok ? '承認し、会費に反映しました' : '見送りにしました'); setCur(null); setNote('')
    } catch { toast('処理できませんでした') }
    setBusy(false)
  }
  const pending = (list || []).filter(r => r.status === 'pending')
  const done = (list || []).filter(r => r.status !== 'pending')
  return (
    <>
      <PageHeader title="会費の減免の申請" back sub="承認すると会員の会費（割引）に反映されます" />
      {list !== null && pending.length === 0 && <Empty icon={<HandCoins size={28} />} title="確認が必要な申請はありません" text="保護者がアプリから申請すると、ここに届きます。" />}
      {pending.map(r => (
        <Card key={r.id} className="mb-2" onClick={() => { setCur(r); setNote('') }}>
          <div className="flex items-center justify-between"><b className="text-[15px]">{r.playerName}さん</b>{st(r)}</div>
          <div className="mt-1 text-[13px] text-ink-2">{r.byName}さん・希望：{r.discount === 50 ? '半額' : '全額免除'}</div>
          <p className="mt-2 line-clamp-2 text-[13px]">{r.reason}</p>
        </Card>
      ))}
      {done.length > 0 && <Section title="対応済み">{done.map(r => <Card key={r.id} className="mb-2"><div className="flex items-center justify-between text-[14px]"><span>{r.playerName}さん・{r.discount === 50 ? '半額' : '全額免除'}</span>{st(r)}</div></Card>)}</Section>}
      <Sheet open={!!cur} onClose={() => setCur(null)} title={cur ? `${cur.playerName}さんの申請` : ''} footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" loading={busy} onClick={() => decide(false)}>見送る</Button><Button className="flex-1" loading={busy} onClick={() => decide(true)}>承認する</Button></div>}>
        {cur && <>
          <div className="text-[13px] text-ink-2">申請者：{cur.byName}さん／希望：{cur.discount === 50 ? '半額' : '全額免除'}</div>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-canvas p-3 text-[14px] leading-relaxed">{cur.reason}</p>
          <Field label="保護者への一言（任意）"><input className={inputCls} value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="例：来月分から反映します" /></Field>
        </>}
      </Sheet>
    </>
  )
}
