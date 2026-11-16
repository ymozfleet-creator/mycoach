import { useEffect, useState } from 'react'
import { Button, Field, inputCls, Sheet, cx } from './ui'
import { useApp } from '../lib/store'
import type { ClubEvent, Profile } from '../lib/types'
import { addDays, clashes, iso, parseDate, today, uid6 } from '../lib/util'

export function useProfiles(uids: string[]) {
  const { be } = useApp()
  const [map, setMap] = useState<Record<string, Profile>>({})
  const key = uids.join(',')
  useEffect(() => {
    const us = uids.map(u => be.watchProfile(u, p => p && setMap(m => ({ ...m, [u]: p }))))
    return () => us.forEach(f => f())
  }, [be, key])
  return map
}

export function EventEditor({ open, onClose, event }: { open: boolean; onClose: () => void; event?: ClubEvent }) {
  const { be, club, events, toast } = useApp()
  const coaches = useProfiles(club?.coachUids || [])
  const blank = (): ClubEvent => ({ id: 'e' + uid6(), title: '通常練習', date: iso(addDays(today(), 1)), start: '09:00', minutes: 120, venue: club?.venues[0]?.name || '', indoor: club?.venues[0]?.indoor ?? true, status: 'scheduled', att: {} })
  const [e, setE] = useState<ClubEvent>(event || blank())
  const [repeat, setRepeat] = useState(1)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setE(event || blank()) }, [open, event?.id])
  if (!club) return null
  const set = (p: Partial<ClubEvent>) => setE(x => ({ ...x, ...p }))
  const save = async () => {
    setBusy(true)
    const n = event ? 1 : repeat
    for (let i = 0; i < n; i++) {
      const d = iso(addDays(parseDate(e.date), i * 7))
      await be.saveEvent(club.id, { ...e, id: i === 0 ? e.id : 'e' + uid6(), date: d, att: i === 0 ? e.att : {} })
    }
    if (event && (event.date !== e.date || event.start !== e.start || event.venue !== e.venue)) {
      for (const u of club.memberUids) await be.notify(u, `【予定変更】${e.title}：${e.date} ${e.start}〜（${e.venue}）`, 'announce').catch(() => {})
    }
    setBusy(false); onClose(); toast(event ? '予定を更新しました' : n > 1 ? `${n}週分の予定を登録しました` : '予定を登録しました')
  }
  return (
    <Sheet open={open} onClose={onClose} title={event ? '予定を編集' : '予定を追加'} footer={<Button block size="lg" loading={busy} onClick={save} disabled={!e.title || !e.venue}>{event ? '保存する' : '登録する'}</Button>}>
      <Field label="内容"><input className={inputCls} value={e.title} onChange={x => set({ title: x.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付"><input type="date" className={inputCls} value={e.date} onChange={x => set({ date: x.target.value })} /></Field>
        <Field label="開始"><input type="time" className={inputCls} value={e.start} onChange={x => set({ start: x.target.value })} /></Field>
      </div>
      <Field label="時間"><div className="flex gap-1.5">{[60, 90, 120, 150, 180].map(m => <button key={m} onClick={() => set({ minutes: m })} className={cx('h-10 flex-1 rounded-xl border text-[13px] font-bold', e.minutes === m ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{m}分</button>)}</div></Field>
      <Field label="場所"><select className={inputCls} value={e.venue} onChange={x => { const v = club.venues.find(v => v.name === x.target.value); set({ venue: x.target.value, indoor: v?.indoor ?? true }) }}>{club.venues.map(v => <option key={v.name} value={v.name}>{v.name}（{v.indoor ? '屋内' : '屋外'}）</option>)}</select></Field>
      <Field label="担当の指導者"><select className={inputCls} value={e.coachUid || ''} onChange={x => set({ coachUid: x.target.value || undefined, coachName: coaches[x.target.value]?.name })}><option value="">未定</option>{club.coachUids.map(u => <option key={u} value={u}>{coaches[u]?.name || '読み込み中…'}</option>)}</select></Field>
      <Field label="連絡事項（任意）"><input className={inputCls} value={e.note || ''} onChange={x => set({ note: x.target.value })} placeholder="例：水筒を多めに" /></Field>
      {clashes(events, e).length > 0 && <div className="mb-3 rounded-2xl bg-amber-50 p-3 text-[13px] font-bold text-amber-800">同じ時間に「{clashes(events, e)[0].title}」（{clashes(events, e)[0].start}〜）が{e.venue}で入っています。場所か時間を確認してください。</div>}
      {!event && <Field label="くり返し"><div className="flex gap-1.5">{[1, 4, 8, 12].map(n => <button key={n} onClick={() => setRepeat(n)} className={cx('h-10 flex-1 rounded-xl border text-[13px] font-bold', repeat === n ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{n === 1 ? 'なし' : `毎週×${n}`}</button>)}</div></Field>}
    </Sheet>
  )
}
