import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, CalendarX, Pencil, Send, Sparkles, Thermometer } from 'lucide-react'
import { useApp } from '../lib/store'
import { AbsenceReason, AttButtons, attCounts, EventMeta, useAttNotes, useEventWbgt } from '../components/parts'
import { EventEditor } from '../components/EventEditor'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Section, Sheet, cx } from '../components/ui'
import { dateLabel, estWBGT, wbgtLevel } from '../lib/util'
import type { Att } from '../lib/types'

function HeatStrip({ date, indoor, start, minutes }: { date: string; indoor: boolean; start: string; minutes: number }) {
  const { weather } = useApp()
  if (!weather) return null
  const hrs = weather.filter(h => h.t.startsWith(date) && +h.t.slice(11, 13) >= 7 && +h.t.slice(11, 13) <= 19)
  if (!hrs.length) return <p className="text-[13px] text-ink-2">暑さ指数の予報は、およそ10日前から表示されます。</p>
  const h0 = parseInt(start), h1 = h0 + Math.ceil(minutes / 60)
  const vals = hrs.map(h => ({ H: +h.t.slice(11, 13), w: Math.round((indoor ? estWBGT(h.Ta, h.RH, 0, 0) : estWBGT(h.Ta, h.RH, h.SR, h.WS)) * 10) / 10, Ta: Math.round(h.Ta) }))
  const best = vals.filter(v => v.H >= 8 && v.H <= 17).sort((a, b) => a.w - b.w)[0]
  const colors = ['bg-sky-100', 'bg-emerald-100', 'bg-yellow-100', 'bg-orange-200', 'bg-red-200']
  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {vals.map(v => (
          <div key={v.H} className={cx('w-[54px] shrink-0 rounded-xl py-2 text-center text-[11px]', colors[wbgtLevel(v.w).lv], v.H >= h0 && v.H < h1 && 'ring-2 ring-navy')}>
            <div className="font-bold">{v.H}時</div><div className="text-[15px] font-black">{v.w.toFixed(0)}</div><div className="text-ink-2">{v.Ta}℃</div>
          </div>
        ))}
      </div>
      {best && <p className="mt-2 text-[12px] text-ink-2">8〜17時でいちばん涼しいのは <b>{best.H}時ごろ</b>（暑さ指数 {best.w}）。枠は活動予定の時間です。</p>}
    </>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { be, club, events, players, myPlayers, isAdmin, isCoach, isSchool, toast } = useApp()
  const e = events.find(x => x.id === id)
  const w = useEventWbgt(e || ({ date: '', start: '0', minutes: 0, indoor: true } as any))
  const notes = useAttNotes(id, !(isAdmin || isCoach))
  const [edit, setEdit] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!e || !club) return <><PageHeader title="予定" back /><Empty icon={<CalendarX />} title="この予定は見つかりません" text="削除されたか、日程が変わった可能性があります" action={<Button onClick={() => nav('/schedule')}>予定の一覧を見る</Button>} /></>
  const remind = async () => {
    if (!e || !club) return
    setBusy(true)
    const pend = players.filter(p => !e.att[p.id] || e.att[p.id] === 'maybe')
    const noApp = pend.filter(p => !(p.guardianUids || []).length).length
    const targets = new Set(pend.flatMap(p => p.guardianUids || []))
    let n = 0
    for (const u of targets) { try { await be.notify(u, `${dateLabel(e.date)}「${e.title}」の出欠を教えてください`, 'announce'); n++ } catch { /* 個別の失敗は続行 */ } }
    setBusy(false)
    toast((n ? `${n}人の保護者にお知らせしました。` : '') + (noApp ? `保護者がアプリ未登録の${noApp}人には届きません（会員画面の「招待」から登録してもらえます）` : ''))
  }
  const c = attCounts(e, players)
  const canEdit = isAdmin || isCoach
  const staff = canEdit || isSchool
  const cycle = (a?: Att): Att => (a === 'yes' ? 'no' : a === 'no' ? 'maybe' : 'yes')
  const doCancel = async () => {
    setBusy(true)
    await be.saveEvent(club.id, { ...e, status: 'canceled' })
    const text = `【中止】${dateLabel(e.date)} ${e.start}〜「${e.title}」は中止になりました。`
    await be.postAnnouncement(club.id, { text, kind: 'urgent', byName: club.name, at: Date.now() })
    for (const u of club.memberUids) await be.notify(u, text, 'announce').catch(() => {})
    setBusy(false); setCancel(false); toast('中止を全員に連絡しました')
  }
  return (
    <>
      <PageHeader title={e.title} back sub={dateLabel(e.date)} right={isAdmin && e.status !== 'canceled' && <button onClick={() => setEdit(true)} aria-label="編集" className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-card"><Pencil size={18} /></button>} />
      <Card>
        {e.status === 'canceled' && <Badge tone="danger" className="mb-2">この予定は中止になりました</Badge>}
        <EventMeta e={e} />
        {e.note && <p className="mt-3 rounded-2xl bg-canvas p-3 text-[14px]">📝 {e.note}</p>}
      </Card>

      {e.status !== 'canceled' && (w.state === 'ok' || w.state === 'loading') && (
        <Section title="暑さ指数（熱中症の危険度）">
          <Card>
            {w.state === 'ok' && (
              <div className="mb-3 flex items-center gap-3">
                <div className={cx('grid h-14 w-14 place-items-center rounded-2xl', { ok: 'bg-emerald-50 text-emerald-700', info: 'bg-brand-50 text-brand', warn: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-red-600' }[w.level.tone])}><Thermometer /></div>
                <div><div className="text-[17px] font-black">{w.level.label}<span className="ml-2 text-[13px] font-bold text-ink-2">最高 {w.max}</span></div><div className="text-[13px] text-ink-2">{w.level.advice}</div></div>
              </div>
            )}
            <HeatStrip date={e.date} indoor={e.indoor} start={e.start} minutes={e.minutes} />
            <p className="mt-2 text-[11px] text-ink-3">気象予報（Open-Meteo または MET Norway）から環境省の推定式で計算した参考値です。{e.indoor ? '屋内は日射・風を0として推定しています。' : ''}現地に暑さ指数計がある場合は実測値を優先してください。</p>
          </Card>
        </Section>
      )}

      {!staff && myPlayers.length > 0 && e.status !== 'canceled' && (
        <Section title="出欠">
          <Card className="space-y-3">
            {myPlayers.map(p => <div key={p.id}><div className="mb-1.5 text-[13px] font-bold">{p.name}さん</div><AttButtons value={e.att[p.id]} onChange={a => be.setAttendance(club.id, e.id, p.id, a)} />{e.att[p.id] === 'no' && <AbsenceReason eventId={e.id} playerId={p.id} notes={notes} />}</div>)}
          </Card>
        </Section>
      )}

      {staff && (
        <Section title={`出欠（参加 ${c.yes}・欠席 ${c.no}・未回答 ${c.none + c.maybe}）`}>
          <Card className="divide-y divide-line !py-1">
            {players.map(p => {
              const a = e.att[p.id]
              return (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={p.name} size={34} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold">{p.name}</div><div className="text-[12px] text-ink-3">{p.grade}{a === 'no' && notes.find(n => n.playerId === p.id) ? <span className="ml-1.5 font-bold text-slate-600">・理由：{notes.find(n => n.playerId === p.id)!.note}</span> : null}</div></div>
                  <button disabled={!canEdit} onClick={() => be.setAttendance(club.id, e.id, p.id, cycle(a))} className={cx('h-8 w-16 rounded-xl text-[12px] font-bold', a === 'yes' ? 'bg-emerald-500 text-white' : a === 'no' ? 'bg-slate-500 text-white' : a === 'maybe' ? 'bg-amber-400 text-white' : 'border border-dashed border-slate-300 text-ink-3')}>
                    {a === 'yes' ? '参加' : a === 'no' ? '欠席' : a === 'maybe' ? '未定' : '未回答'}
                  </button>
                </div>
              )
            })}
          </Card>
          {canEdit && e.status !== 'canceled' && e.date >= new Date().toISOString().slice(0, 10) && players.some(p => !e.att[p.id] || e.att[p.id] === 'maybe') && (
            <Button block variant="soft" className="mt-2" loading={busy} onClick={remind}><Send size={16} />まだ答えていない保護者にお知らせ（{players.filter(p => !e.att[p.id] || e.att[p.id] === 'maybe').length}人）</Button>
          )}
          {canEdit && <p className="mt-1 px-1 text-[11px] text-ink-3">ボタンをタップすると、参加→欠席→未定の順に切り替わります（当日の出席確認に使えます）。</p>}
        </Section>
      )}

      {e.status !== 'canceled' && (isCoach || isAdmin) && (
        <div className="mt-6 space-y-2">
          {isCoach && <Button block size="lg" variant="lime" onClick={() => nav(`/menu?event=${e.id}`)}><Sparkles size={18} />この日の練習メニューをAIで作る</Button>}
          {isAdmin && <Button block size="lg" variant="danger" onClick={() => setCancel(true)}><Ban size={18} />この予定を中止にする</Button>}
        </div>
      )}

      <EventEditor open={edit} onClose={() => setEdit(false)} event={e} />
      <Sheet open={cancel} onClose={() => setCancel(false)} title="予定を中止しますか？" footer={<Button block size="lg" variant="danger" loading={busy} onClick={doCancel}>中止して全員に連絡する</Button>}>
        <p className="text-[14px] leading-relaxed">「{e.title}」（{dateLabel(e.date)} {e.start}〜）を中止にし、クラブの全員にお知らせとアプリ通知を送ります。</p>
      </Sheet>
    </>
  )
}
