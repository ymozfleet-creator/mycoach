import { useEffect, useState } from 'react'
import { Download, Wallet } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Card, Empty, PageHeader, Section } from '../components/ui'
import type { Payment } from '../lib/types'
import { yen } from '../lib/util'

/** 謝金の記録：指導者は受け取り（預かり中・送金済み）、運営は支払いの記録。年ごとの合計とCSV */
export default function Earnings() {
  const { be, authUser, club, contracts, coachMode } = useApp()
  const [list, setList] = useState<Payment[] | null>(null)
  useEffect(() => {
    if (!authUser) return
    if (coachMode || !club) return be.watchPayments(authUser.uid, setList)
    return be.watchClubPayments(club.id, setList)
  }, [be, authUser?.uid, club?.id, coachMode])
  const asCoach = coachMode
  const [year, setYear] = useState(new Date().getFullYear())
  const rows = (list || []).filter(p => (asCoach ? p.coach === authUser?.uid : p.coach !== authUser?.uid) && new Date(p.ts).getFullYear() === year)
  const title = (p: Payment) => contracts.find(k => k.id === p.contractId)?.title || '指導'
  const held = rows.filter(p => p.released === false)
  const sum = (a: Payment[], k: 'net' | 'amount') => a.reduce((s, p) => s + (p[k] || 0), 0)
  const csv = () => {
    const head = asCoach ? '日付,内容,受取額,状態' : '日付,内容,支払額,状態'
    const body = rows.map(p => [new Date(p.ts).toLocaleDateString('ja-JP'), `"${title(p).replace(/"/g, '""')}"`, asCoach ? p.net : p.amount, p.released === false ? '預かり中' : '送金済み'].join(','))
    const url = URL.createObjectURL(new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `謝金の記録_${year}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageHeader title="謝金の記録" back sub={asCoach ? '受け取った謝金と、送金待ちの謝金' : 'クラブが支払った謝金'} />
      <div className="mb-3 flex gap-2">{[year - 1, year].map(y => <button key={y} onClick={() => setYear(y)} className={`h-9 rounded-full px-4 text-[13px] font-bold ${y === year ? 'bg-navy text-white' : 'border border-line bg-white text-ink-2'}`}>{y}年</button>)}</div>
      <div className="grid grid-cols-2 gap-3">
        <Card><div className="text-[12px] text-ink-2">{asCoach ? `${year}年の受取（送金済み）` : `${year}年の支払い`}</div><div className="mt-1 text-[22px] font-black tabular-nums">{yen(asCoach ? sum(rows.filter(p => p.released !== false), 'net') : sum(rows, 'amount'))}</div></Card>
        <Card><div className="text-[12px] text-ink-2">{asCoach ? '送金待ち（預かり中）' : '指導の確認待ち'}</div><div className="mt-1 text-[22px] font-black tabular-nums text-amber-600">{yen(sum(held, asCoach ? 'net' : 'amount'))}</div></Card>
      </div>
      {asCoach && <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink-3">謝金はクラブが支払ったあと事務局が預かり、指導の確認後（確認がなくても7日後）に送金されます。受取額は手数料を差し引いた金額です。確定申告にはCSVをお使いください。</p>}
      <Section title="明細" action={rows.length ? <button onClick={csv} className="flex items-center gap-1 text-[13px] font-bold text-brand"><Download size={15} />CSV</button> : undefined}>
        {list !== null && rows.length === 0 ? <Empty icon={<Wallet size={28} />} title="まだ記録はありません" text={asCoach ? 'クラブから謝金が支払われると、ここに表示されます。' : '指導者に謝金を支払うと、ここに表示されます。'} /> : (
          <Card className="divide-y divide-line !py-0">
            {rows.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><div className="truncate text-[14px] font-bold">{title(p)}</div><div className="text-[12px] text-ink-2">{new Date(p.ts).toLocaleDateString('ja-JP')}{p.released === false && p.releaseAt ? `・${new Date(p.releaseAt).toLocaleDateString('ja-JP')}までに送金` : ''}</div></div>
                <div className="text-right"><div className="text-[15px] font-black tabular-nums">{yen(asCoach ? p.net : p.amount)}</div>{p.released === false ? <Badge tone="warn">預かり中</Badge> : <Badge tone="ok">送金済み</Badge>}</div>
              </div>
            ))}
          </Card>
        )}
      </Section>
      {!asCoach && held.length > 0 && <p className="mt-2 px-1 text-[12px] text-ink-3">指導が終わったら、各指導者とのやりとり画面の「送金する」から送金してください（7日たつと自動で送金されます）。</p>}
    </>
  )
}
