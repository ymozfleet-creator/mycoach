import { useEffect, useState } from 'react'
import { IdCard, Inbox, ShieldX } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Sheet, Skeleton, cx, stagger } from '../components/ui'
import type { Profile, VerifyDoc } from '../lib/types'
import { DOW, relTime } from '../lib/util'

const REASONS = ['写真が不鮮明で文字が読めません', '書類の一部が写っていません', '登録のお名前と書類のお名前が一致しません', '有効期限が切れています']

/** 運営事務局：指導者の本人確認の審査 */
export default function Ops() {
  const { be, isOps, toast } = useApp()
  const [list, setList] = useState<Profile[] | null>(null)
  const [sel, setSel] = useState<Profile | null>(null)
  const [docu, setDocu] = useState<VerifyDoc | null | undefined>(undefined)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => (isOps ? be.watchPendingVerifications(setList) : undefined), [be, isOps])
  useEffect(() => { setDocu(undefined); setNote(''); if (sel) be.getVerifyDoc(sel.uid).then(setDocu).catch(() => setDocu(null)) }, [be, sel?.uid])
  if (!isOps) return <><PageHeader title="運営事務局" back /><Empty icon={<ShieldX />} title="この画面は運営事務局専用です" /></>
  const decide = async (ok: boolean) => {
    if (!sel) return
    setBusy(true)
    try { await be.decideVerification(sel.uid, ok, note.trim()); toast(ok ? `${sel.name}さんを承認しました` : '差し戻しました'); setSel(null) }
    catch { toast('更新できませんでした。権限をご確認ください') }
    setBusy(false)
  }
  return (
    <>
      <PageHeader title="本人確認の審査" back sub="運営事務局" />
      {list === null ? <Skeleton className="h-24" /> : !list.length ? <Empty icon={<Inbox />} title="審査待ちはありません" /> : (
        <div className="space-y-2">
          {list.map((p, i) => (
            <Card key={p.uid} style={stagger(i)} onClick={() => setSel(p)} className="flex animate-up items-center gap-3">
              <Avatar name={p.name || '?'} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name || '（名前未設定）'}</div>
                <div className="truncate text-[12px] text-ink-2">{(p.sports || []).join('・')}／{p.areaLabel || '地域未設定'}</div>
              </div>
              <Badge tone="warn">審査待ち</Badge>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name} footer={sel && (
        <div className="space-y-2">
          <Button block size="lg" loading={busy} disabled={!docu} onClick={() => decide(true)}>本人確認を承認する</Button>
          <Button block variant="ghost" loading={busy} disabled={!note.trim()} onClick={() => decide(false)}>理由を伝えて差し戻す</Button>
        </div>
      )}>
        {sel && (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone="info">{(sel.sports || []).join('・') || '種目未設定'}</Badge>
              {sel.license && <Badge tone="info">{sel.license}</Badge>}
              <Badge tone={sel.training ? 'ok' : 'warn'}>{sel.training ? '安全研修 修了' : '安全研修 未受講'}</Badge>
            </div>
            <p className="mb-3 text-[13px] text-ink-2">指導できる曜日：{(sel.days || []).map(d => DOW[d]).join('・') || '未設定'}</p>
            {docu === undefined ? <Skeleton className="h-48" /> : !docu ? <p className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-700">提出書類が見つかりません。差し戻して再提出を依頼してください。</p> : (
              <div className="rounded-2xl border border-line p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-bold"><IdCard size={16} />{docu.docType}<span className="ml-auto text-[11px] font-normal text-ink-3">{relTime(docu.at)}</span></div>
                {docu.image ? <img src={docu.image} alt="提出された本人確認書類" className="w-full rounded-xl" /> : <p className="text-[12px] text-ink-3">（デモのため画像はありません）</p>}
                <p className="mt-2 text-[12px] text-ink-2">確認すること：登録名「{docu.name}」と書類の氏名が一致／有効期限内／顔写真が鮮明</p>
              </div>
            )}
            <Field label="差し戻す場合の理由"><div className="mb-2 flex flex-wrap gap-1.5">{REASONS.map(r => <button key={r} onClick={() => setNote(r)} className={cx('rounded-full border px-3 py-1 text-[12px] font-bold', note === r ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink-2')}>{r}</button>)}</div><input className={inputCls} maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></Field>
            <p className="text-[11px] text-ink-3">承認すると、提出された画像は自動で削除されます。審査の操作は監査ログに記録されます。</p>
          </>
        )}
      </Sheet>
    </>
  )
}
