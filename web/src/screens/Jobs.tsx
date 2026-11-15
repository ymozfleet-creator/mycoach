import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, MapPin, Megaphone, Wallet } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Empty, Field, inputCls, PageHeader, Ring, Sheet, Skeleton, cx, stagger } from '../components/ui'
import { coachReady } from '../components/CoachSetup'
import type { Club, Post } from '../lib/types'
import { DOW, matchScore, relTime, yen } from '../lib/util'

/** 指導者向け：クラブの募集を探して応募する */
export function JobList() {
  const { be, profile, authUser, contracts, toast } = useApp()
  const nav = useNavigate()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [mine, setMine] = useState(true)
  const [sel, setSel] = useState<Post | null>(null)
  const [form, setForm] = useState({ fee: 0, message: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => be.watchOpenPosts(setPosts), [be])
  const rows = useMemo(() => {
    if (!posts || !profile) return []
    return posts
      .filter(p => p.ownerUid !== authUser?.uid && !profile.clubIds.includes(p.clubId))
      .filter(p => !mine || (profile.sports || []).includes(p.sport))
      .map(p => ({ p, m: matchScore(profile, { lat: p.lat, lon: p.lon } as Club, p.days) }))
      .sort((a, b) => b.m.score - a.m.score)
  }, [posts, profile, mine, authUser?.uid])
  if (!profile || !authUser) return null
  const ready = coachReady(profile)
  const applied = (p: Post) => contracts.find(k => k.postId === p.id && k.coach === authUser.uid)
  const open = (p: Post) => { setSel(p); setForm({ fee: p.fee, message: `はじめまして、${profile.name}です。「${p.title}」に応募します。${profile.license ? `${profile.license}。` : ''}よろしくお願いいたします。` }) }
  const apply = async () => {
    if (!sel) return
    setBusy(true)
    try {
      const msg = form.message.trim().slice(0, 1000)
      const id = await be.createContract({ coach: authUser.uid, coachName: profile.name, player: sel.ownerUid, playerName: sel.ownerName, clubId: sel.clubId, clubName: sel.clubName, title: sel.title, fee: Math.max(0, Math.round(form.fee)), message: msg, status: 'proposed', by: authUser.uid, postId: sel.id, at: Date.now() })
      await be.sendMessage(id, { from: authUser.uid, fromName: profile.name, text: msg, at: Date.now() })
      await be.notify(sel.ownerUid, `【応募】${profile.name}さんが「${sel.title}」に応募しました`, 'contract').catch(() => {})
      setSel(null); toast('応募しました。クラブからの返事をお待ちください'); nav(`/requests/${id}`)
    } catch { toast('応募できませんでした。時間をおいてお試しください') }
    setBusy(false)
  }
  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setMine(true)} className={cx('shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition', mine ? 'border-navy bg-navy text-white' : 'border-line bg-white')}>私の種目</button>
        <button onClick={() => setMine(false)} className={cx('shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition', !mine ? 'border-navy bg-navy text-white' : 'border-line bg-white')}>すべての種目</button>
      </div>
      <p className="mt-3 px-1 text-[12px] text-ink-2">あなたの地域・曜日との相性が高い順に並んでいます。</p>
      <div className="mt-3 space-y-2">
        {posts === null ? [0, 1].map(i => <Skeleton key={i} className="h-28" />) : !rows.length ? <Empty icon={<Megaphone />} title="いま募集はありません" text="新しい募集が出るとここに表示されます" /> : rows.map(({ p, m }, i) => (
          <Card key={p.id} onClick={() => open(p)} style={stagger(i)} className="flex animate-up gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold text-ink-2">{p.clubName}</div>
              <div className="mt-0.5 text-[16px] font-black leading-snug">{p.title}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
                <span className="flex items-center gap-0.5"><CalendarDays size={12} />{p.days.map(d => DOW[d]).join('・')} {p.start}〜</span>
                <span className="flex items-center gap-0.5"><MapPin size={12} />{m.dist.toFixed(1)}km</span>
                <span className="flex items-center gap-0.5 font-bold text-ink"><Wallet size={12} />1回 {yen(p.fee)}</span>
              </div>
              <div className="mt-1.5 flex gap-1">{applied(p) ? <Badge tone="ok">応募済み</Badge> : <Badge tone="none">{p.sport}</Badge>}<span className="text-[11px] text-ink-3">{relTime(p.at)}</span></div>
            </div>
            <Ring value={m.score} size={54} stroke={6}><div className="text-center leading-none"><div className="text-[15px] font-black">{m.score}</div><div className="text-[9px] text-ink-3">相性</div></div></Ring>
          </Card>
        ))}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.title} footer={sel && (applied(sel)
        ? <Button block size="lg" variant="soft" onClick={() => nav(`/requests/${applied(sel)!.id}`)}>応募したやりとりを見る</Button>
        : ready ? <Button block size="lg" loading={busy} disabled={!form.message.trim()} onClick={apply}>この内容で応募する</Button>
        : <Button block size="lg" variant="soft" onClick={() => nav('/')}>本人確認と安全研修を済ませると応募できます</Button>)}>
        {sel && (
          <>
            <div className="text-[13px] font-bold text-ink-2">{sel.clubName}（{sel.areaLabel}）</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-canvas p-2"><CalendarDays size={16} className="mx-auto text-brand" /><div className="mt-1 text-[13px] font-bold">{sel.days.map(d => DOW[d]).join('・')}</div></div>
              <div className="rounded-2xl bg-canvas p-2"><Clock size={16} className="mx-auto text-brand" /><div className="mt-1 text-[13px] font-bold">{sel.start}〜</div></div>
              <div className="rounded-2xl bg-canvas p-2"><Wallet size={16} className="mx-auto text-brand" /><div className="mt-1 text-[13px] font-bold">{yen(sel.fee)}</div></div>
            </div>
            {sel.note && <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{sel.note}</p>}
            {ready && !applied(sel) && (
              <div className="mt-5 border-t border-line pt-4">
                <Field label="希望する謝金（1回あたり・円）"><input type="number" inputMode="numeric" min={0} max={100000} className={inputCls} value={form.fee} onChange={e => setForm({ ...form, fee: Number(e.target.value) })} /></Field>
                <Field label="メッセージ"><textarea className={cx(inputCls, 'min-h-[110px]')} maxLength={1000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></Field>
              </div>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}

export default function Jobs() {
  return <><PageHeader title="クラブの募集" back /><JobList /></>
}
