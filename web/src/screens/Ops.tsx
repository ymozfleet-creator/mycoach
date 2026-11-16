import { useEffect, useState } from 'react'
import { IdCard, Inbox, ShieldX } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Sheet, Skeleton, cx, stagger } from '../components/ui'
import type { Profile, Report, VerifyDoc } from '../lib/types'
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
  const [licOk, setLicOk] = useState(false)
  useEffect(() => (isOps ? be.watchPendingVerifications(setList) : undefined), [be, isOps])
  useEffect(() => { setDocu(undefined); setNote(''); setLicOk(false); if (sel) be.getVerifyDoc(sel.uid).then(setDocu).catch(() => setDocu(null)) }, [be, sel?.uid])
  if (!isOps) return <><PageHeader title="運営事務局" back /><Empty icon={<ShieldX />} title="この画面は運営事務局専用です" /></>
  const decide = async (ok: boolean) => {
    if (!sel) return
    setBusy(true)
    try { await be.decideVerification(sel.uid, ok, note.trim(), licOk); toast(ok ? `${sel.name}さんを承認しました` : '差し戻しました'); setSel(null) }
    catch { toast('更新できませんでした。権限をご確認ください') }
    setBusy(false)
  }
  return (
    <>
      <PageHeader title="運営事務局" back sub="通報の確認・本人確認の審査" />
      <Reports />
      {list === null ? <Skeleton className="h-24" /> : !list.length ? <Empty icon={<Inbox />} title="審査待ちはありません" /> : (
        <div className="space-y-2">
          {list.map((p, i) => (
            <Card key={p.uid} style={stagger(i)} onClick={() => setSel(p)} className="flex animate-up items-center gap-3">
              <Avatar name={p.name || '?'} size={44} photo={p.photo} />
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
                {docu.licenseImage && (
                  <div className="mt-3">
                    <div className="mb-1 text-[13px] font-bold">指導者資格の証明（本人の記入：{sel.license || '未記入'}）</div>
                    <img src={docu.licenseImage} alt="提出された資格の証明" className="w-full rounded-xl" />
                    <label className="mt-2 flex items-center gap-2 text-[13px] font-bold"><input type="checkbox" className="h-5 w-5 accent-brand" checked={licOk} onChange={e => setLicOk(e.target.checked)} />資格も確認できた（プロフィールに「資格確認済み」を表示）</label>
                  </div>
                )}
                <p className="mt-2 text-[12px] text-ink-2">{sel.eligibleAt ? `登録要件（18歳以上・処分歴なし）の申告：${new Date(sel.eligibleAt).toLocaleDateString('ja-JP')}` : '登録要件の申告がありません（差し戻してください）'}</p>
                <div className="mt-3 flex items-center gap-3 rounded-xl bg-canvas p-2"><Avatar name={sel.name || '?'} size={56} photo={sel.photo} /><span className="text-[12px] text-ink-2">{sel.photo ? 'プロフィール写真：書類の顔写真と同じ人か確認してください' : 'プロフィール写真は未登録です'}</span></div>
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

/** 通報の確認：写真・募集を非表示にする／問題なしとして閉じる */
function Reports() {
  const { be, toast } = useApp()
  const [list, setList] = useState<Report[]>([])
  const [busy, setBusy] = useState('')
  useEffect(() => be.watchReports(setList), [be])
  if (!list.length) return null
  const act = async (r: Report, hide: boolean) => {
    setBusy(r.id)
    try { if (hide) await be.moderate(r.targetType, r.targetId); await be.resolveReport(r.id); toast(hide ? (r.targetType === 'post' ? '写真を外し、募集を締め切りました' : '写真を非表示にしました') : '対応済みにしました') }
    catch { toast('処理できませんでした。権限をご確認ください') }
    setBusy('')
  }
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-[15px] font-black">通報<Badge tone="danger">{list.length}</Badge></div>
      {list.map(r => (
        <Card key={r.id} className="mb-2">
          <div className="flex items-center justify-between"><b className="text-[14px]">{r.targetName}</b><Badge tone="none">{r.targetType === 'post' ? '募集' : r.targetType === 'club' ? 'クラブ' : 'ユーザー'}</Badge></div>
          <div className="mt-1 text-[13px] font-bold text-ink-2">{r.reason}・{relTime(r.at)}</div>
          {r.detail && <p className="mt-1 whitespace-pre-wrap text-[13px]">{r.detail}</p>}
          <div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => act(r, false)}>問題なし</Button><Button size="sm" loading={busy === r.id} onClick={() => act(r, true)}>写真を非表示にする</Button></div>
        </Card>
      ))}
    </div>
  )
}
