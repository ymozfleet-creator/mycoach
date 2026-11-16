import { useState } from 'react'
import { LifeBuoy, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Field, inputCls, PageHeader, Section, Sheet, cx } from '../components/ui'
import { useProfiles } from '../components/EventEditor'
import { useSub } from '../lib/useSub'
import type { Consult, StaffCheck } from '../lib/types'
import { addYears, daysUntil, iso, today, uid6 } from '../lib/util'

const LAW_DATE = '2026-12-25' // こども性暴力防止法の施行日

/** こどもを守る体制（日本版DBS）：運営向け。犯罪事実確認は「実施日と次回期限」だけを管理し、結果は記録しない */
export default function Safeguard() {
  const { be, club, isAdmin, toast } = useApp()
  const checks = useSub<StaffCheck>('staffChecks', undefined, isAdmin)
  const consults = useSub<Consult>('consults', undefined, isAdmin)
  const coaches = useProfiles(club?.coachUids || [])
  const [edit, setEdit] = useState<{ id: string; name: string; lastAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!club) return null
  if (!isAdmin) return <ConsultForm />
  const dbs = club.dbs || { certified: false, allChecked: false, at: 0 }
  const setDbs = async (p: Partial<typeof dbs>) => {
    try { await be.updateClub(club.id, { dbs: { ...dbs, ...p, at: Date.now() } }); toast('更新しました') } catch { toast('更新できませんでした') }
  }
  const byId = Object.fromEntries((checks || []).map(c => [c.id, c]))
  const rows = club.coachUids.map(u => ({ id: u, name: coaches[u]?.name || '読み込み中…', c: byId[u] as StaffCheck | undefined }))
  const save = async () => {
    if (!edit) return
    setBusy(true)
    try { await be.addSub(club.id, 'staffChecks', { name: edit.name.slice(0, 40), lastAt: edit.lastAt, nextDue: addYears(edit.lastAt, 5) }, edit.id); setEdit(null); toast('記録しました（次回の確認は5年後です）') }
    catch { toast('記録できませんでした') }
    setBusy(false)
  }
  const open = (consults || []).filter(c => c.status === 'new')
  const left = daysUntil(LAW_DATE)
  return (
    <>
      <PageHeader title="こどもを守る体制" back sub="こども性暴力防止法（日本版DBS）への備え" />
      <Card className="bg-gradient-to-br from-navy to-navy-700 text-white">
        <div className="text-[13px] opacity-80">法律の施行日</div>
        <div className="mt-1 text-[24px] font-black">2026年12月25日{left > 0 ? `（あと${left}日）` : '（施行済み）'}</div>
        <p className="mt-2 text-[12px] leading-relaxed opacity-80">地域クラブなどは「認定」を受けると、指導者の性犯罪歴の確認（犯罪事実確認）が必要になります。認定を受けた事業者は、認定から1年以内に確認し、その後は5年ごとに確認します。</p>
      </Card>

      <Section title="クラブの体制">
        <Card className="divide-y divide-line !py-0">
          {([['certified', '認定を受けている（または申請中）'], ['allChecked', '対象の指導者全員の確認が終わっている']] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-3 py-3.5 text-[14px] font-bold">{label}<input type="checkbox" className="h-5 w-5 accent-[#2563EB]" checked={!!dbs[k]} onChange={e => setDbs({ [k]: e.target.checked })} /></label>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">保護者や学校から聞かれたときは「確認の体制があるか」「全員の手続きが済んでいるか」は答えられますが、特定の人の結果は答えません（「該当なし」も含めて答えない）。</p>
      </Section>

      <Section title="指導者ごとの確認の期限">
        <Card className="divide-y divide-line !py-0">
          {rows.length === 0 && <p className="py-4 text-[13px] text-ink-3">クラブに指導者がいません。</p>}
          {rows.map(r => {
            const d = r.c ? daysUntil(r.c.nextDue) : null
            return (
              <button key={r.id} onClick={() => setEdit({ id: r.id, name: r.name, lastAt: r.c?.lastAt || iso(today()) })} className="flex w-full items-center justify-between gap-3 py-3.5 text-left">
                <div className="min-w-0"><div className="truncate text-[15px] font-bold">{r.name}</div><div className="text-[12px] text-ink-2">{r.c ? `前回：${r.c.lastAt}／次回の期限：${r.c.nextDue}` : 'まだ記録がありません'}</div></div>
                {d === null ? <Badge tone="warn">未記録</Badge> : d < 0 ? <Badge tone="danger">期限切れ</Badge> : d < 180 ? <Badge tone="warn">あと{d}日</Badge> : <Badge tone="ok">記録済み</Badge>}
              </button>
            )
          })}
        </Card>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">ここには「確認した日」と「次の期限」だけを記録します。確認の結果（犯罪事実確認書の内容）は、法律で厳しい管理が求められるため、アプリには保存できない作りにしています。</p>
      </Section>

      <Section title={`相談窓口に届いた相談（未対応 ${open.length}件）`}>
        {(consults || []).length === 0 ? <p className="text-[13px] text-ink-3">相談はまだ届いていません。保護者・生徒は「マイページ → 相談窓口」から、匿名でも相談できます。</p> : (consults || []).map(c => (
          <Card key={c.id} className="mb-2">
            <div className="flex items-center justify-between"><b className="text-[14px]">{c.category}</b>{c.status === 'new' ? <Badge tone="danger">未対応</Badge> : <Badge tone="ok">対応済み</Badge>}</div>
            <div className="mt-1 text-[12px] text-ink-2">{c.anonymous ? '匿名' : `${c.byName}さん`}・{new Date(c.at).toLocaleDateString('ja-JP')}</div>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">{c.text}</p>
            {c.status === 'new' && <Button size="sm" variant="ghost" className="mt-2" onClick={() => be.updateSub(club.id, 'consults', c.id, { status: 'done' }).then(() => toast('対応済みにしました'))}>対応済みにする</Button>}
          </Card>
        ))}
        <p className="mt-2 text-[12px] leading-relaxed text-ink-3">相談はクラブの運営と、MyCOACH-MyTEAMの事務局だけが読めます。被害が疑われるときは、こどもの安全を最優先に、保護者・学校・関係機関と連携してください。</p>
      </Section>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.name}さんの確認` : ''} footer={<Button block size="lg" loading={busy} onClick={save}>確認した日を記録する</Button>}>
        {edit && <><Field label="確認した日"><input type="date" className={inputCls} value={edit.lastAt} max={iso(today())} onChange={e => setEdit({ ...edit, lastAt: e.target.value })} /></Field>
          <p className="text-[13px] text-ink-2">次回の期限は自動で <b>{addYears(edit.lastAt, 5)}</b> になります。結果は入力しません。</p></>}
      </Sheet>
    </>
  )
}

const CATS = ['指導者の言動が気になる', 'いじめ・人間関係', 'ケガ・体調', '練習の内容・量', 'その他']

/** 相談窓口：保護者・生徒が運営と事務局に相談する（匿名可） */
export function ConsultForm() {
  const { be, club, profile, authUser, toast } = useApp()
  const [f, setF] = useState({ category: CATS[0], text: '', anonymous: false })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  if (!club || !profile || !authUser) return null
  const send = async () => {
    setBusy(true)
    try {
      await be.addSub(club.id, 'consults', { category: f.category, text: f.text.trim().slice(0, 2000), anonymous: f.anonymous, by: f.anonymous ? '' : authUser.uid, byName: f.anonymous ? '' : profile.name, status: 'new', at: Date.now() }, 'q' + uid6())
      for (const u of club.adminUids) await be.notify(u, '相談窓口に相談が届きました', 'announce').catch(() => {})
      setSent(true)
    } catch { toast('送れませんでした。時間をおいてお試しください') }
    setBusy(false)
  }
  return (
    <>
      <PageHeader title="相談窓口" back sub="困ったこと・気になることを、運営に伝えられます" />
      {sent ? (
        <Card className="text-center"><LifeBuoy size={36} className="mx-auto text-brand" /><div className="mt-2 text-[17px] font-black">相談を受け付けました</div><p className="mt-2 text-[13px] leading-relaxed text-ink-2">クラブの運営と事務局が確認します。{f.anonymous ? '匿名のため、返事はアプリでは届きません。' : '必要に応じて連絡があります。'}</p><Button className="mt-4" variant="ghost" onClick={() => { setSent(false); setF({ ...f, text: '' }) }}>もう一度相談する</Button></Card>
      ) : (
        <Card>
          <Field label="どんなこと？"><div className="flex flex-wrap gap-1.5">{CATS.map(c => <button key={c} onClick={() => setF({ ...f, category: c })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold', f.category === c ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{c}</button>)}</div></Field>
          <Field label="内容" hint="2000文字まで"><textarea className={inputCls} rows={6} value={f.text} maxLength={2000} onChange={e => setF({ ...f, text: e.target.value })} placeholder="いつ・どこで・何があったか、書ける範囲で教えてください" /></Field>
          <label className="mb-3 flex items-center gap-2 text-[14px] font-bold"><input type="checkbox" className="h-5 w-5 accent-[#2563EB]" checked={f.anonymous} onChange={e => setF({ ...f, anonymous: e.target.checked })} />名前を出さずに相談する（匿名）</label>
          <p className="mb-3 text-[12px] leading-relaxed text-ink-3">相談はクラブの運営と事務局だけが読めます。指導者やほかの保護者には見えません。匿名の場合は送り主を記録しません。いま危険がある場合は、すぐに110番・189（児童相談所）へ連絡してください。</p>
          <Button block size="lg" loading={busy} disabled={!f.text.trim()} onClick={send}><ShieldCheck size={18} />相談を送る</Button>
        </Card>
      )}
    </>
  )
}
