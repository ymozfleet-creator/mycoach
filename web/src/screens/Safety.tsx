import { useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Empty, Field, inputCls, PageHeader, Segmented, Sheet } from '../components/ui'
import type { Incident } from '../lib/types'
import { dateLabel, iso, today } from '../lib/util'

export default function Safety() {
  const { be, club, incidents, players, isAdmin, toast } = useApp()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Omit<Incident, 'id'>>({ date: iso(today()), type: 'ヒヤリハット', who: '', desc: '', action: '' })
  if (!club) return null
  const save = async () => {
    await be.addIncident(club.id, f)
    if (f.type === '事故') for (const u of club.adminUids) await be.notify(u, `【事故報告】${f.who}：${f.desc.slice(0, 60)}`, 'announce').catch(() => {})
    setOpen(false); setF({ ...f, who: '', desc: '', action: '' }); toast('記録しました')
  }
  return (
    <>
      <PageHeader title="ケガ・ヒヤリハット" back right={<button onClick={() => setOpen(true)} aria-label="記録する" className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white"><Plus size={22} /></button>} />
      <p className="mb-3 px-1 text-[13px] text-ink-2">小さな出来事も記録しておくと、事故の予防と、もしものときの説明に役立ちます。{isAdmin ? '' : '「事故」を記録すると運営に通知されます。'}</p>
      {incidents.length ? (
        <div className="space-y-2">
          {incidents.map(i => (
            <Card key={i.id}>
              <div className="flex items-center justify-between"><Badge tone={i.type === '事故' ? 'danger' : 'warn'}>{i.type}</Badge><span className="text-[12px] text-ink-3">{dateLabel(i.date)}</span></div>
              <p className="mt-2 font-bold">{i.who}</p>
              <p className="text-[14px]">{i.desc}</p>
              {i.action && <p className="mt-1 text-[13px] text-ink-2">対応：{i.action}</p>}
            </Card>
          ))}
        </div>
      ) : <Empty icon={<ShieldCheck />} title="記録はありません" />}
      <Sheet open={open} onClose={() => setOpen(false)} title="記録する" footer={<Button block size="lg" onClick={save} disabled={!f.who || !f.desc}>記録する</Button>}>
        <div className="mb-4"><Segmented value={f.type} onChange={v => setF({ ...f, type: v })} options={[{ value: 'ヒヤリハット', label: 'ヒヤリハット' }, { value: '事故', label: '事故・ケガ' }]} /></div>
        <Field label="日付"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="対象者"><select className={inputCls} value={f.who} onChange={e => setF({ ...f, who: e.target.value })}><option value="">選んでください</option>{players.map(p => <option key={p.id}>{p.name}</option>)}<option>指導者・スタッフ</option></select></Field>
        <Field label="何が起きたか"><textarea className={`${inputCls} min-h-[90px]`} value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} /></Field>
        <Field label="対応（応急処置・連絡など）"><input className={inputCls} value={f.action} onChange={e => setF({ ...f, action: e.target.value })} /></Field>
      </Sheet>
    </>
  )
}
