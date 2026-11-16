import { useMemo, useState } from 'react'
import { Building } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Empty, Field, inputCls, PageHeader, Section, Sheet, cx } from '../components/ui'
import { useSub } from '../lib/useSub'
import type { FacilityRequest } from '../lib/types'
import { addDays, clashes, iso, today, uid6 } from '../lib/util'

const st = (r: FacilityRequest) => r.status === 'approved' ? <Badge tone="ok">利用OK</Badge> : r.status === 'declined' ? <Badge tone="none">利用不可</Badge> : <Badge tone="warn">学校の確認待ち</Badge>

/** 施設（学校の体育館・校庭など）の利用：運営が申請 → 学校が承認。場所ごとの使用状況と重なりも表示 */
export default function Facilities() {
  const { be, club, profile, authUser, events, isAdmin, isSchool, toast } = useApp()
  const list = useSub<FacilityRequest>('facilityRequests')
  const blank = { venue: club?.venues[0]?.name || '', date: iso(addDays(today(), 7)), start: '09:00', minutes: 120, purpose: '' }
  const [f, setF] = useState(blank)
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState<FacilityRequest | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const reqs = list || []
  // 2週間分の使用状況（予定＋利用OKの申請）を場所ごとにまとめる
  const usage = useMemo(() => {
    const until = iso(addDays(today(), 14)), from = iso(today())
    const m: Record<string, { date: string; start: string; minutes: number; label: string }[]> = {}
    events.filter(e => e.status !== 'canceled' && e.date >= from && e.date <= until).forEach(e => (m[e.venue] ||= []).push({ date: e.date, start: e.start, minutes: e.minutes, label: e.title }))
    reqs.filter(r => r.status === 'approved' && r.date >= from && r.date <= until).forEach(r => (m[r.venue] ||= []).push({ date: r.date, start: r.start, minutes: r.minutes, label: '申請済み：' + r.purpose }))
    Object.values(m).forEach(a => a.sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start)))
    return m
  }, [events, reqs])
  if (!club || !profile || !authUser) return null
  const hit = [...clashes(events, f), ...clashes(reqs.filter(r => r.status !== 'declined'), f)]
  const send = async () => {
    setBusy(true)
    try {
      await be.addSub(club.id, 'facilityRequests', { ...f, venue: f.venue.trim().slice(0, 60), purpose: f.purpose.trim().slice(0, 300), by: authUser.uid, byName: profile.name, status: 'pending', at: Date.now() }, 'f' + uid6())
      for (const u of club.schoolUids || []) await be.notify(u, `施設の利用申請：${f.venue} ${f.date} ${f.start}〜（${club.name}）`, 'announce').catch(() => {})
      setOpen(false); setF(blank); toast('申請しました。学校の確認をお待ちください')
    } catch { toast('申請できませんでした') }
    setBusy(false)
  }
  const decide = async (ok: boolean) => {
    if (!cur) return
    setBusy(true)
    try {
      await be.updateSub(club.id, 'facilityRequests', cur.id, { status: ok ? 'approved' : 'declined', note: note.trim().slice(0, 300) })
      await be.notify(cur.by, `施設の利用申請（${cur.venue} ${cur.date}）：${ok ? '利用できます' : '利用できません'}${note ? `／${note}` : ''}`, 'announce').catch(() => {})
      setCur(null); setNote(''); toast(ok ? '利用OKにしました' : '利用不可にしました')
    } catch { toast('処理できませんでした') }
    setBusy(false)
  }
  const pending = reqs.filter(r => r.status === 'pending')
  return (
    <>
      <PageHeader title="施設の利用" back sub={isSchool ? 'クラブからの利用申請を確認します' : '学校の体育館・校庭などの利用を申請します'} right={isAdmin ? <Button size="sm" onClick={() => setOpen(true)}>申請する</Button> : undefined} />
      {isSchool && (
        <Section title={`確認が必要な申請（${pending.length}件）`}>
          {pending.length === 0 ? <p className="text-[13px] text-ink-3">いまは確認が必要な申請はありません。</p> : pending.map(r => (
            <Card key={r.id} className="mb-2" onClick={() => { setCur(r); setNote('') }}>
              <div className="flex items-center justify-between"><b className="text-[15px]">{r.venue}</b>{st(r)}</div>
              <div className="mt-1 text-[13px] text-ink-2">{r.date} {r.start}〜（{r.minutes}分）・{r.byName}さん</div>
              <p className="mt-1 text-[13px]">{r.purpose}</p>
            </Card>
          ))}
        </Section>
      )}
      <Section title="申請の一覧">
        {list !== null && reqs.length === 0 ? <Empty icon={<Building size={28} />} title="まだ申請はありません" text={isAdmin ? '右上の「申請する」から、学校の施設の利用を申請できます。' : 'クラブの運営が申請すると、ここに表示されます。'} /> : reqs.map(r => (
          <Card key={r.id} className="mb-2"><div className="flex items-center justify-between"><b className="text-[14px]">{r.venue}</b>{st(r)}</div><div className="mt-1 text-[13px] text-ink-2">{r.date} {r.start}〜（{r.minutes}分）・{r.purpose}</div>{r.note && <p className="mt-1 text-[12px] text-ink-2">学校より：{r.note}</p>}</Card>
        ))}
      </Section>
      <Section title="場所ごとの使用状況（今後2週間）">
        {Object.keys(usage).length === 0 ? <p className="text-[13px] text-ink-3">予定はありません。</p> : Object.entries(usage).map(([v, a]) => (
          <Card key={v} className="mb-2"><div className="text-[14px] font-black">{v}<span className="ml-2 text-[12px] font-bold text-ink-3">{a.length}件</span></div>
            <div className="mt-2 space-y-1">{a.slice(0, 8).map((x, i) => <div key={i} className="flex gap-2 text-[13px]"><span className="w-28 shrink-0 font-bold tabular-nums">{x.date.slice(5).replace('-', '/')} {x.start}</span><span className="truncate text-ink-2">{x.label}</span></div>)}</div>
          </Card>
        ))}
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title="施設の利用を申請" footer={<Button block size="lg" loading={busy} disabled={!f.venue.trim() || !f.purpose.trim()} onClick={send}>学校に申請する</Button>}>
        <Field label="施設" hint="一覧にない場合は直接入力"><input className={inputCls} list="venues" value={f.venue} maxLength={60} onChange={e => setF({ ...f, venue: e.target.value })} /><datalist id="venues">{club.venues.map(v => <option key={v.name} value={v.name} />)}</datalist></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日付"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="開始"><input type="time" className={inputCls} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
        </div>
        <Field label="時間"><div className="flex gap-1.5">{[60, 90, 120, 150, 180].map(m => <button key={m} onClick={() => setF({ ...f, minutes: m })} className={cx('h-10 flex-1 rounded-xl border text-[13px] font-bold', f.minutes === m ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{m}分</button>)}</div></Field>
        <Field label="目的・人数"><input className={inputCls} value={f.purpose} maxLength={300} onChange={e => setF({ ...f, purpose: e.target.value })} placeholder="例：通常練習（中学生12人）" /></Field>
        {hit.length > 0 && <div className="rounded-2xl bg-amber-50 p-3 text-[13px] font-bold text-amber-800">この時間は{f.venue}にほかの予定・申請が入っています（{hit[0].start}〜）。</div>}
      </Sheet>
      <Sheet open={!!cur} onClose={() => setCur(null)} title={cur ? `${cur.venue}の利用申請` : ''} footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" loading={busy} onClick={() => decide(false)}>利用できない</Button><Button className="flex-1" loading={busy} onClick={() => decide(true)}>利用OK</Button></div>}>
        {cur && <><div className="text-[14px] font-bold">{cur.date} {cur.start}〜（{cur.minutes}分）</div><p className="mt-2 text-[14px]">{cur.purpose}</p><p className="mt-1 text-[12px] text-ink-2">申請：{club.name}・{cur.byName}さん</p>
          <Field label="クラブへの一言（任意）"><input className={inputCls} value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="例：鍵は職員室で受け取ってください" /></Field></>}
      </Sheet>
    </>
  )
}
