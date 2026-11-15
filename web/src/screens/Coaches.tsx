import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, GraduationCap, MapPin, Search, Star } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Sheet, Skeleton, cx } from '../components/ui'
import type { Profile } from '../lib/types'
import { DOW, matchScore, parseDate } from '../lib/util'

function Ring({ v }: { v: number }) {
  const r = 22, c = 2 * Math.PI * r
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="-rotate-90"><circle cx="28" cy="28" r={r} fill="none" stroke="#E5EAF1" strokeWidth="6" /><circle cx="28" cy="28" r={r} fill="none" stroke={v >= 80 ? '#10B981' : v >= 60 ? '#2563EB' : '#F59E0B'} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-[stroke-dashoffset] duration-700" /></svg>
      <div className="absolute inset-0 grid place-items-center"><div className="text-center leading-none"><div className="text-[16px] font-black">{v}</div><div className="text-[9px] text-ink-3">相性</div></div></div>
    </div>
  )
}

export default function Coaches() {
  const { be, club, events, profile, authUser, toast } = useApp()
  const nav = useNavigate()
  const [list, setList] = useState<Profile[] | null>(null)
  const [onlyReady, setOnlyReady] = useState(true)
  const [sel, setSel] = useState<Profile | null>(null)
  const [req, setReq] = useState({ title: '', fee: 6000, message: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (club) be.listCoaches(club.sport).then(setList).catch(() => setList([])) }, [be, club?.sport])
  const clubDays = useMemo(() => {
    const cnt: Record<number, number> = {}
    events.forEach(e => { const d = parseDate(e.date).getDay(); cnt[d] = (cnt[d] || 0) + 1 })
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => +d)
  }, [events])
  const rows = useMemo(() => (list || []).filter(p => !club?.coachUids.includes(p.uid)).map(p => ({ p, m: club ? matchScore(p, club, clubDays) : null! })).filter(x => !onlyReady || x.m.ready).sort((a, b) => b.m.score - a.m.score), [list, onlyReady, clubDays, club])
  if (!club || !profile || !authUser) return null
  const open = (p: Profile) => { setSel(p); setReq({ title: `${clubDays.map(d => DOW[d] + '曜').join('・') || '週末'}の指導`, fee: 6000, message: `はじめまして。${club.name}の${profile.name}です。${club.areaLabel}で${club.sport}の指導をお願いできる方を探しています。ご検討いただけますでしょうか。` }) }
  const send = async () => {
    if (!sel) return
    setBusy(true)
    const id = await be.createContract({ coach: sel.uid, coachName: sel.name, player: authUser.uid, playerName: profile.name, clubId: club.id, clubName: club.name, clubCode: club.coachCode, title: req.title, fee: Number(req.fee), message: req.message, status: 'proposed', at: Date.now() })
    await be.sendMessage(id, { from: authUser.uid, fromName: profile.name, text: req.message, at: Date.now() })
    await be.notify(sel.uid, `【指導の依頼】${club.name}から「${req.title}」の依頼が届きました`, 'contract').catch(() => {})
    setBusy(false); setSel(null); toast('依頼を送りました'); nav(`/requests/${id}`)
  }
  return (
    <>
      <PageHeader title="指導者を探す" back sub={`${club.sport}・${club.areaLabel}`} />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <button onClick={() => setOnlyReady(true)} className={cx('shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold', onlyReady ? 'border-navy bg-navy text-white' : 'border-line bg-white')}>審査済みのみ</button>
        <button onClick={() => setOnlyReady(false)} className={cx('shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold', !onlyReady ? 'border-navy bg-navy text-white' : 'border-line bg-white')}>すべて</button>
      </div>
      <p className="mt-3 px-1 text-[12px] text-ink-2">活動場所からの距離・活動曜日・資格・審査・評価から相性を出し、高い順に並べています。</p>
      <div className="mt-3 space-y-2">
        {list === null ? [0, 1, 2].map(i => <Skeleton key={i} className="h-28" />) : !rows.length ? <Empty icon={<Search />} title="条件に合う指導者が見つかりません" text={onlyReady ? '「すべて」にすると、審査中の方も表示されます' : 'この種目の指導者はまだ登録されていません'} /> : rows.map(({ p, m }) => (
          <Card key={p.uid} onClick={() => open(p)} className="flex gap-3">
            <Avatar name={p.name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5"><span className="truncate text-[16px] font-bold">{p.name}</span>{m.ready && <BadgeCheck size={17} className="shrink-0 text-brand" />}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-ink-2">
                <span className="flex items-center gap-0.5"><MapPin size={12} />{m.dist.toFixed(1)}km</span>
                {p.ratingAvg && <span className="flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" />{p.ratingAvg.toFixed(1)}（{p.ratingCount}）</span>}
                {p.teacher && <span className="flex items-center gap-0.5"><GraduationCap size={12} />教員</span>}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">{m.reasons.slice(1).map(r => <Badge key={r} tone="info">{r}</Badge>)}{!m.ready && <Badge tone="warn">審査中</Badge>}</div>
            </div>
            <Ring v={m.score} />
          </Card>
        ))}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name} footer={sel && (matchScore(sel, club, clubDays).ready ? <Button block size="lg" loading={busy} onClick={send} disabled={!req.title}>この内容で依頼する</Button> : <p className="text-center text-[13px] text-ink-2">審査（本人確認・安全研修）が終わると依頼できます</p>)}>
        {sel && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={sel.verified === 'approved' ? 'ok' : 'warn'}>{sel.verified === 'approved' ? '本人確認済み' : '本人確認 審査中'}</Badge>
              <Badge tone={sel.training ? 'ok' : 'warn'}>{sel.training ? '安全研修 受講済み' : '安全研修 未受講'}</Badge>
              {sel.license && <Badge tone="info">{sel.license}</Badge>}
            </div>
            {sel.bio && <p className="mt-3 text-[14px] leading-relaxed">{sel.bio}</p>}
            <p className="mt-2 text-[13px] text-ink-2">指導できる曜日：{(sel.days || []).sort().map(d => DOW[d]).join('・') || '未設定'}／地域：{sel.areaLabel || '未設定'}</p>
            {matchScore(sel, club, clubDays).ready && (
              <div className="mt-5 border-t border-line pt-4">
                <Field label="依頼の内容"><input className={inputCls} value={req.title} onChange={e => setReq({ ...req, title: e.target.value })} /></Field>
                <Field label="1回あたりの謝金（円）" hint="指導の実施後にお支払いいただく金額です"><input type="number" inputMode="numeric" className={inputCls} value={req.fee} onChange={e => setReq({ ...req, fee: Number(e.target.value) })} /></Field>
                <Field label="メッセージ"><textarea className={cx(inputCls, 'min-h-[110px]')} value={req.message} onChange={e => setReq({ ...req, message: e.target.value })} /></Field>
              </div>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}
