import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, CreditCard, Receipt, Send } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Empty, PageHeader, Section, Sheet } from '../components/ui'
import { FUNCTIONS_BASE } from '../lib/config'
import type { Fee } from '../lib/types'
import { yen } from '../lib/util'

const statusBadge = (f: Fee) => f.status === 'paid' ? <Badge tone="ok">支払い済み</Badge> : f.status === 'exempt' ? <Badge tone="none">免除</Badge> : <Badge tone="warn">未払い</Badge>

function MemberFees() {
  const { be, club, fees, month, toast } = useApp()
  const nav = useNavigate()
  const [pay, setPay] = useState<Fee | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  if (!club) return null
  const unpaid = fees.filter(f => f.status === 'unpaid')
  const startPay = async (f: Fee) => {
    setErr(''); setBusy(true)
    try {
      if (be.mode === 'demo') { await new Promise(r => setTimeout(r, 800)); await be.saveFee(club.id, { ...f, status: 'paid', paidAt: Date.now() }); setPay(null); toast('お支払いが完了しました（デモ）'); return }
      const token = await (await import('../lib/firebase')).auth.currentUser?.getIdToken()
      const r = await fetch(`${FUNCTIONS_BASE}/createFeeCheckout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ clubId: club.id, feeId: f.id, origin: location.href.split('#')[0] }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.url) throw new Error(j.error || 'unavailable')
      location.href = j.url
    } catch {
      setErr('現在、カード払いを準備中です。お手数ですが、お支払い方法を運営の方にご確認ください。')
    } finally { setBusy(false) }
  }
  return (
    <>
      <PageHeader title="会費" sub={`${month.slice(0, 4)}年${+month.slice(5)}月分`} />
      {unpaid.length > 0 && (
        <Card className="bg-gradient-to-br from-navy to-navy-700 text-white">
          <div className="text-[13px] opacity-80">お支払いが必要な金額</div>
          <div className="mt-1 text-[34px] font-black">{yen(unpaid.reduce((s, f) => s + f.amount, 0))}</div>
          <Button block size="lg" variant="lime" className="mt-3" onClick={() => setPay(unpaid[0])}><CreditCard size={18} />カードで支払う</Button>
        </Card>
      )}
      <Section title="今月の会費">
        {fees.length ? (
          <Card className="divide-y divide-line !py-1">
            {fees.map(f => (
              <div key={f.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><div className="font-bold">{f.playerName}</div><div className="text-[13px] text-ink-2">{yen(f.amount)}</div></div>
                {f.status === 'unpaid' ? <Button size="sm" onClick={() => setPay(f)}>支払う</Button> : statusBadge(f)}
              </div>
            ))}
          </Card>
        ) : <Empty icon={<Receipt />} title="今月の請求はまだありません" text="運営から請求されるとここに表示されます" />}
      </Section>
      <p className="mt-4 px-1 text-[12px] text-ink-3">カード情報は決済会社（Stripe）が管理し、このアプリやクラブには保存されません。</p>
      <button onClick={() => nav('/fee-requests')} className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-left text-[14px] font-bold text-brand active:opacity-60">会費の負担が大きい場合は、減免を申請できます →</button>
      <Sheet open={!!pay} onClose={() => setPay(null)} title="会費のお支払い" footer={<Button block size="lg" loading={busy} onClick={() => pay && startPay(pay)}><CreditCard size={18} />{pay ? `${yen(pay.amount)} を支払う` : ''}</Button>}>
        {pay && <div className="rounded-2xl bg-canvas p-4"><div className="text-[13px] text-ink-2">{club.name}</div><div className="mt-1 font-bold">{pay.playerName}さん　{month.slice(0, 4)}年{+month.slice(5)}月分</div><div className="mt-2 text-[28px] font-black">{yen(pay.amount)}</div></div>}
        <p className="mt-3 text-[13px] text-ink-2">次の画面（Stripe）でカード情報を入力します。</p>
        {err && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">{err}</p>}
      </Sheet>
    </>
  )
}

function AdminFees() {
  const { be, club, fees, players, month, toast } = useApp()
  const [sel, setSel] = useState<Fee | null>(null)
  const [busy, setBusy] = useState(false)
  if (!club) return null
  const billed = fees.reduce((s, f) => s + f.amount, 0)
  const paid = fees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0)
  const unpaid = fees.filter(f => f.status === 'unpaid')
  const missing = players.filter(p => !fees.some(f => f.playerId === p.id))
  const generate = async () => {
    setBusy(true)
    for (const p of missing) {
      const amount = Math.round(club.fee * (100 - p.discount) / 100)
      await be.saveFee(club.id, { id: `${month}_${p.id}`, month, playerId: p.id, playerName: p.name, amount, status: amount === 0 ? 'exempt' : 'unpaid', guardianUids: p.guardianUids })
      if (amount > 0) for (const g of p.guardianUids) await be.notify(g, `【会費】${p.name}さんの${+month.slice(5)}月分（${yen(amount)}）をアプリからお支払いください`, 'pay').catch(() => {})
    }
    setBusy(false); toast(`${missing.length}人分を請求しました`)
  }
  const remind = async (list: Fee[]) => {
    setBusy(true)
    let n = 0
    for (const f of list) for (const g of f.guardianUids) { await be.notify(g, `【会費のお願い】${f.playerName}さんの${+month.slice(5)}月分（${yen(f.amount)}）のお支払いが確認できていません。アプリの「会費」からお支払いください。ご事情がある場合は運営までご相談ください。`, 'pay').catch(() => {}); n++ }
    setBusy(false); setSel(null); toast(n ? `${n}件のご家庭にお知らせしました` : '保護者がアプリ未登録のため送れませんでした')
  }
  const mark = async (f: Fee) => { await be.saveFee(club.id, { ...f, status: 'paid', paidAt: Date.now() }); setSel(null); toast('入金を記録しました') }
  return (
    <>
      <PageHeader title="お金" sub={`${month.slice(0, 4)}年${+month.slice(5)}月・月会費 ${yen(club.fee)}`} />
      <Card>
        <div className="flex items-end justify-between">
          <div><div className="text-[13px] text-ink-2">回収済み</div><div className="text-[28px] font-black">{yen(paid)}</div></div>
          <div className="text-right text-[13px] text-ink-2">請求 {yen(billed)}<br />未納 <b className="text-amber-600">{yen(billed - paid - fees.filter(f => f.status === 'exempt').reduce((s, f) => s + f.amount, 0))}</b></div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${billed ? (paid / billed) * 100 : 0}%` }} /></div>
        {missing.length > 0 && <Button block size="lg" className="mt-4" loading={busy} onClick={generate}><Receipt size={18} />今月分を請求する（{missing.length}人）</Button>}
        {unpaid.length > 0 && <Button block variant="soft" className="mt-2" loading={busy} onClick={() => remind(unpaid)}><Send size={16} />未納の{unpaid.length}件にまとめてお知らせ</Button>}
      </Card>
      <Section title="会員ごとの状況">
        {fees.length ? (
          <Card className="divide-y divide-line !py-1">
            {[...fees].sort((a, b) => (a.status === 'unpaid' ? -1 : 1) - (b.status === 'unpaid' ? -1 : 1)).map(f => (
              <button key={f.id} onClick={() => f.status === 'unpaid' && setSel(f)} className="flex w-full items-center gap-3 py-3 text-left">
                <div className="min-w-0 flex-1"><div className="font-bold">{f.playerName}</div><div className="text-[13px] text-ink-2">{yen(f.amount)}{!f.guardianUids.length ? '・保護者未登録' : ''}</div></div>
                {statusBadge(f)}
              </button>
            ))}
          </Card>
        ) : <Empty icon={<Receipt />} title="今月はまだ請求していません" text="上のボタンで、会員全員分の請求をまとめて作成できます" />}
      </Section>
      <p className="mt-4 px-1 text-[12px] text-ink-3">減免は会員の詳細画面から設定できます。カード払いは、決済の設定が済むと保護者のアプリから利用できます。</p>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.playerName}さんの会費` : ''}>
        {sel && (
          <div className="space-y-2">
            <div className="mb-3 rounded-2xl bg-canvas p-4"><div className="text-[13px] text-ink-2">{+month.slice(5)}月分・未払い</div><div className="text-[26px] font-black">{yen(sel.amount)}</div></div>
            <Button block size="lg" onClick={() => mark(sel)}><CheckCircle2 size={18} />現金・振込で受け取った</Button>
            <Button block size="lg" variant="soft" loading={busy} onClick={() => remind([sel])}><Send size={18} />保護者にお知らせを送る</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

export default function Fees() {
  const { isAdmin } = useApp()
  return isAdmin ? <AdminFees /> : <MemberFees />
}
