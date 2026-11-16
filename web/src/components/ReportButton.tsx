import { useState } from 'react'
import { Flag } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Field, inputCls, Sheet, cx } from './ui'
import type { Report } from '../lib/types'

const REASONS = ['写真が不適切', 'プロフィールの内容が事実と違う', '不適切な言動・メッセージ', '勧誘・宣伝', 'その他']

/** 不適切な写真・プロフィール・募集を事務局に通報する（相手には通知されない） */
export function ReportButton({ type, id, name }: { type: Report['targetType']; id: string; name: string }) {
  const { be, authUser, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  if (!authUser) return null
  const send = async () => {
    setBusy(true)
    try { await be.addReport({ from: authUser.uid, targetType: type, targetId: id, targetName: name.slice(0, 80), reason, detail: detail.trim().slice(0, 2000), status: 'new', at: Date.now() }); toast('事務局に伝えました。ご協力ありがとうございます'); setOpen(false); setDetail('') }
    catch { toast('送れませんでした') }
    setBusy(false)
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-3 active:opacity-60"><Flag size={13} />通報する</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="事務局に通報" footer={<Button block size="lg" loading={busy} onClick={send}>送る</Button>}>
        <p className="mb-3 text-[13px] text-ink-2">「{name}」について。通報したことは相手には伝わりません。事務局が確認し、必要なら写真や募集を非表示にします。</p>
        <Field label="理由"><div className="flex flex-wrap gap-1.5">{REASONS.map(r => <button key={r} onClick={() => setReason(r)} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold', reason === r ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{r}</button>)}</div></Field>
        <Field label="くわしく（任意）"><textarea className={inputCls} rows={3} maxLength={2000} value={detail} onChange={e => setDetail(e.target.value)} /></Field>
      </Sheet>
    </>
  )
}
