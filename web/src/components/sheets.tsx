import { useEffect, useState } from 'react'
import { Button, Field, inputCls, Sheet, cx } from './ui'
import { useApp } from '../lib/store'
import type { Player } from '../lib/types'
import { iso, today } from '../lib/util'

const FACES = ['😌', '🙂', '😐', '😣', '😫']
const rpeLabel = (r: number) => (r <= 2 ? 'とても楽' : r <= 4 ? '楽' : r <= 6 ? 'ややきつい' : r <= 8 ? 'きつい' : '限界')

export function ConditionSheet({ open, onClose, players, defaultPlayer }: { open: boolean; onClose: () => void; players: Player[]; defaultPlayer?: string }) {
  const { be, club, toast, authUser } = useApp()
  const [pid, setPid] = useState(defaultPlayer || players[0]?.id || '')
  const [rpe, setRpe] = useState(5)
  const [minutes, setMinutes] = useState(120)
  const [sleep, setSleep] = useState(7)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open && !players.some(p => p.id === pid)) setPid(defaultPlayer || players[0]?.id || '') }, [open, players, defaultPlayer])
  if (!club) return null
  const save = async () => {
    if (!pid) return
    setBusy(true)
    await be.addCondition(club.id, { playerId: pid, date: iso(today()), rpe, minutes, sleep, at: Date.now(), by: authUser?.uid })
    setBusy(false); onClose(); toast('記録しました。おつかれさまでした')
  }
  return (
    <Sheet open={open} onClose={onClose} title="今日の体調・練習を記録" footer={<Button block size="lg" loading={busy} onClick={save} disabled={!pid}>記録する</Button>}>
      {players.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
          {players.map(p => <button key={p.id} onClick={() => setPid(p.id)} className={cx('shrink-0 rounded-full border px-4 py-2 text-[14px] font-bold', pid === p.id ? 'border-brand bg-brand text-white' : 'border-line bg-white')}>{p.name}</button>)}
        </div>
      )}
      <p className="mb-2 text-[13px] font-bold text-ink-2">練習はどのくらいきつかった？</p>
      <div className="rounded-2xl bg-canvas p-4 text-center">
        <div className="text-[44px] leading-none">{FACES[Math.min(4, Math.floor((rpe - 1) / 2))]}</div>
        <div className="mt-1 text-[15px] font-bold">{rpe}／10　{rpeLabel(rpe)}</div>
        <input type="range" min={1} max={10} value={rpe} onChange={e => setRpe(+e.target.value)} className="mt-3 w-full accent-[#2563EB]" aria-label="きつさ" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="練習時間"><select className={inputCls} value={minutes} onChange={e => setMinutes(+e.target.value)}>{[30, 60, 90, 120, 150, 180, 210, 240].map(m => <option key={m} value={m}>{m}分</option>)}</select></Field>
        <Field label="昨夜の睡眠"><select className={inputCls} value={sleep} onChange={e => setSleep(+e.target.value)}>{[4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(m => <option key={m} value={m}>{m}時間</option>)}</select></Field>
      </div>
    </Sheet>
  )
}

export function ComposeSheet({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: string }) {
  const { be, club, profile, toast } = useApp()
  const [text, setText] = useState(preset || '')
  const [urgent, setUrgent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!club || !profile) return null
  const send = async () => {
    setBusy(true)
    await be.postAnnouncement(club.id, { text: text.trim(), kind: urgent ? 'urgent' : 'info', byName: profile.name, at: Date.now() })
    for (const u of club.memberUids.filter(u => u !== profile.uid)) await be.notify(u, `【${club.name}】${text.trim()}`, 'announce').catch(() => {})
    setBusy(false); setText(''); onClose(); toast(`${club.memberUids.length - 1}人にお知らせしました`)
  }
  return (
    <Sheet open={open} onClose={onClose} title="お知らせを送る" footer={<Button block size="lg" loading={busy} onClick={send} disabled={!text.trim()}>{club.memberUids.length - 1}人に送る</Button>}>
      <textarea className={cx(inputCls, 'min-h-[160px]')} value={text} onChange={e => setText(e.target.value)} placeholder="例：明日の練習は雨のため体育館に変更します。" autoFocus />
      <label className="mt-3 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="h-5 w-5 accent-red-500" />重要なお知らせとして目立たせる</label>
      <p className="mt-2 text-[12px] text-ink-3">送信内容はクラブの全員のアプリに届きます。送信前に内容をご確認ください。</p>
    </Sheet>
  )
}
