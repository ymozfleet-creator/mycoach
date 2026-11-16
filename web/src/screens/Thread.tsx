import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUp, CreditCard, Star } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Card, Field, inputCls, PageHeader, Sheet, cx } from '../components/ui'
import type { Message, Payment } from '../lib/types'
import { relTime, yen } from '../lib/util'
import { contractBadge, initiator } from './Requests'

const PLAYER_RATE = 0.1 // クラブが支払うシステム利用料（Cloud Functions と同じ値）
const COACH_RATE = 0.2 // 指導者の受取額から差し引く事務手数料（Cloud Functions と同じ値）

export default function Thread() {
  const { id } = useParams()
  const { be, contracts, authUser, profile, toast } = useApp()
  const nav = useNavigate()
  const k = contracts.find(x => x.id === id)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [pays, setPays] = useState<Payment[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<'' | 'pay' | 'end' | 'review'>('')
  const [rv, setRv] = useState({ rating: 5, text: '' })
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => (id ? be.watchMessages(id, setMsgs) : undefined), [be, id])
  useEffect(() => (authUser ? be.watchPayments(authUser.uid, p => setPays(p.filter(x => x.contractId === id))) : undefined), [be, authUser?.uid, id])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])
  useEffect(() => { if (location.search.includes('paid=1')) toast('お支払いを受け付けました。反映まで少しかかることがあります') }, [])
  if (!k || !authUser || !profile) return <><PageHeader title="やりとり" back /><Card>読み込み中…</Card></>
  const meCoach = k.coach === authUser.uid
  const other = meCoach ? k.player : k.coach
  const iRespond = k.status === 'proposed' && initiator(k) !== authUser.uid
  const base = k.fee, total = base + Math.round(base * PLAYER_RATE), net = base - Math.round(base * COACH_RATE)
  const say = (t: string) => be.sendMessage(k.id, { from: authUser.uid, fromName: profile.name, text: t, at: Date.now() })
  const send = async () => {
    const t = text.trim().slice(0, 2000); if (!t) return
    setText('')
    await say(t)
    be.notify(other, `【メッセージ】${profile.name}：${t.slice(0, 60)}`, 'msg').catch(() => {})
  }
  const respond = async (ok: boolean) => {
    setBusy(true)
    try {
      await be.setContractStatus(k.id, ok ? 'active' : 'declined')
      if (ok && meCoach && k.clubCode) await be.joinClub(k.clubCode, authUser.uid) // 依頼を引き受けた指導者がクラブに参加
      if (ok && !meCoach) await be.addCoach(k.clubId, k.coach) // 応募を採用した運営者が指導者をクラブに加える
      await say(ok ? (meCoach ? 'お引き受けします。よろしくお願いします。' : 'ぜひお願いします。クラブの予定や選手の情報はアプリから確認できます。') : '今回は見送らせてください。ご連絡ありがとうございました。')
      await be.notify(other, `【${k.postId ? '応募' : '依頼'}の結果】「${k.title}」：${ok ? (meCoach ? `${profile.name}さんが引き受けました` : `${k.clubName}に採用されました`) : 'お断りの返事が届きました'}`, 'contract').catch(() => {})
      toast(ok ? (meCoach ? `${k.clubName}の指導者になりました` : `${k.coachName}さんをクラブの指導者に加えました`) : 'お断りの返事をしました')
    } catch { toast('処理できませんでした。時間をおいてお試しください') }
    setBusy(false)
  }
  const pay = async () => {
    setBusy(true)
    try {
      const url = await be.payContract(k.id, `${location.origin}${location.pathname}?paid=1#/requests/${k.id}`)
      if (url) { location.href = url; return }
      setSheet(''); toast('支払いました（デモ）')
    } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  const release = async (paymentId: string) => {
    setBusy(true)
    try { await be.releasePayment(paymentId); await be.notify(k.coach, `「${k.title}」の謝金が送金されます`, 'pay').catch(() => {}); toast('指導者に送金しました') }
    catch (e) { toast((e as Error).message || '送金できませんでした') }
    setBusy(false)
  }
  const finish = async () => {
    setBusy(true)
    await be.setContractStatus(k.id, 'completed')
    await say('指導を終了しました。ありがとうございました。')
    await be.notify(other, `「${k.title}」の指導が終了になりました`, 'contract').catch(() => {})
    setBusy(false); toast('終了しました')
    setSheet(meCoach ? '' : 'review')
  }
  const review = async () => {
    setBusy(true)
    try { await be.addReview({ from: authUser.uid, to: k.coach, contractId: k.id, rating: rv.rating, text: rv.text.trim().slice(0, 500), at: Date.now() }); toast('評価を送りました'); setSheet('') }
    catch { toast('評価を送れませんでした') }
    setBusy(false)
  }
  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col">
      <PageHeader title={meCoach ? k.clubName : k.coachName} back sub={k.title} />
      <Card className="!p-3">
        <div className="flex items-center justify-between text-[13px]"><span className="text-ink-2">1回あたりの謝金</span><b>{yen(k.fee)}</b></div>
        <div className="mt-1 flex items-center justify-between text-[13px]"><span className="text-ink-2">状況</span>{contractBadge(k, authUser.uid)}</div>
        {iRespond && (
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" className="flex-1" loading={busy} onClick={() => respond(false)}>お断りする</Button>
            <Button className="flex-1" loading={busy} onClick={() => respond(true)}>{meCoach ? '引き受ける' : '採用する'}</Button>
          </div>
        )}
        {k.status === 'active' && (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            {!meCoach && <Button block onClick={() => setSheet('pay')}><CreditCard size={18} />謝金を支払う</Button>}
            {meCoach && !profile.stripeChargesEnabled && <Button block variant="soft" onClick={() => nav('/coach-profile#payout')}>謝金の受取口座を設定する</Button>}
            {pays.length > 0 && (
              <div className="rounded-2xl bg-canvas p-3">
                <div className="mb-1 text-[12px] font-bold text-ink-2">支払いの記録</div>
                {pays.map(p => (
                  <div key={p.id} className="py-1 text-[13px]">
                    <div className="flex justify-between"><span>{new Date(p.ts).toLocaleDateString('ja-JP')}</span><b>{meCoach ? `受取 ${yen(p.net)}` : `支払 ${yen(p.amount)}`}</b></div>
                    {p.released === false && <div className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[12px] font-bold text-amber-800">
                      <span>{meCoach ? `指導の確認後に送金されます（${p.releaseAt ? new Date(p.releaseAt).toLocaleDateString('ja-JP') : '7日後'}までに自動）` : '事務局で預かり中。指導が終わったら送金してください'}</span>
                      {!meCoach && <button disabled={busy} onClick={() => release(p.id)} className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-white">送金する</button>}
                    </div>}
                    {p.released === true && <div className="mt-0.5 text-right text-[11px] font-bold text-emerald-600">指導者に送金済み</div>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSheet('end')} className="w-full py-1 text-center text-[13px] font-bold text-ink-2">指導を終了する</button>
          </div>
        )}
        {k.status === 'completed' && !meCoach && !k.reviewed && <Button block variant="soft" className="mt-3" onClick={() => setSheet('review')}><Star size={18} />指導者を評価する</Button>}
      </Card>
      <div className="mt-4 flex-1 space-y-2">
        {msgs.map(m => {
          const mine = m.from === authUser.uid
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] animate-up rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed', mine ? 'rounded-br-lg bg-brand text-white' : 'rounded-bl-lg bg-white shadow-card')}>
                {!mine && <div className="mb-0.5 text-[11px] font-bold text-ink-3">{m.fromName}</div>}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className={cx('mt-0.5 text-right text-[10px]', mine ? 'text-white/70' : 'text-ink-3')}>{relTime(m.at)}</div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {k.status !== 'declined' && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+68px)] mt-3 flex items-end gap-2 rounded-3xl bg-white p-2 shadow-pop">
          <textarea rows={1} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="メッセージを入力" className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[16px] outline-none" />
          <button onClick={send} disabled={!text.trim()} aria-label="送信" className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition active:scale-90 disabled:opacity-40"><ArrowUp size={20} /></button>
        </div>
      )}

      <Sheet open={sheet === 'pay'} onClose={() => setSheet('')} title="謝金の支払い" footer={<Button block size="lg" loading={busy} onClick={pay}><CreditCard size={18} />{yen(total)}をカードで支払う</Button>}>
        <div className="rounded-2xl bg-canvas p-4 text-[14px]">
          <div className="flex justify-between py-1"><span>謝金（1回分）</span><b>{yen(base)}</b></div>
          <div className="flex justify-between py-1"><span>システム利用料（{PLAYER_RATE * 100}%）</span><b>{yen(total - base)}</b></div>
          <div className="mt-1 flex justify-between border-t border-line pt-2 text-[16px]"><span className="font-bold">お支払い合計</span><b>{yen(total)}</b></div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-2">{k.coachName}さんには、謝金から事務手数料（{COACH_RATE * 100}%）を差し引いた{yen(net)}が支払われます。お支払いはいったん事務局が預かり、指導の実施を確認してから送金します（確認がなくても7日後に自動で送金）。カード情報は決済代行のStripeが管理し、このアプリには保存されません。</p>
      </Sheet>
      <Sheet open={sheet === 'end'} onClose={() => setSheet('')} title="指導を終了しますか？" footer={<Button block size="lg" variant="ghost" loading={busy} onClick={finish}>終了する</Button>}>
        <p className="text-[14px] text-ink-2">終了すると、このやりとりでは支払いができなくなります。メッセージの記録は残ります。{meCoach ? '' : '終了後に指導者の評価をお願いします。'}</p>
      </Sheet>
      <Sheet open={sheet === 'review'} onClose={() => setSheet('')} title={`${k.coachName}さんの評価`} footer={<Button block size="lg" loading={busy} onClick={review}>評価を送る</Button>}>
        <div className="mb-4 flex justify-center gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRv({ ...rv, rating: n })} aria-label={`${n}点`} className="transition active:scale-90"><Star size={36} className={n <= rv.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>)}</div>
        <Field label="コメント（任意）"><textarea className={cx(inputCls, 'min-h-[90px]')} maxLength={500} value={rv.text} onChange={e => setRv({ ...rv, text: e.target.value })} placeholder="ほかのクラブの参考になります" /></Field>
      </Sheet>
    </div>
  )
}
