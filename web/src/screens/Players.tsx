import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, Search, Share2, UserPlus, Users } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Sheet, stagger } from '../components/ui'
import { addDays, iso, loadStatus, today, uid6 } from '../lib/util'

export function InviteCard() {
  const { club, toast } = useApp()
  if (!club) return null
  const url = `${location.origin}${location.pathname}`
  const share = async (coach: boolean, school = false) => {
    const code = school ? club.schoolCode : coach ? club.coachCode : club.inviteCode
    const text = school ? `「${club.name}」の活動状況を確認できます。学校・教育委員会の方は、アプリで「学校・教育委員会」を選んで参加してください。\n学校用の招待コード：${code}\n${url}` : coach ? `「${club.name}」の指導者として、アプリに参加してください。\n指導者用の招待コード：${code}\n${url}` : `「${club.name}」のアプリに参加してください。\n招待コード：${code}\n${url}`
    if (navigator.share) { try { await navigator.share({ title: club.name, text }) } catch { /* cancel */ } }
    else { await navigator.clipboard.writeText(text); toast('招待文をコピーしました') }
  }
  return (
    <div className="animate-up rounded-xl2 bg-navy p-4 text-white shadow-card">
      <div className="text-[13px] opacity-80">保護者・生徒用の招待コード</div>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex-1 text-[30px] font-black tracking-[.25em] text-lime">{club.inviteCode}</div>
        <button onClick={async () => { await navigator.clipboard.writeText(club.inviteCode); toast('コードをコピーしました') }} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="コピー"><Copy size={18} /></button>
        <button onClick={() => share(false)} className="flex h-10 items-center gap-1.5 rounded-xl bg-lime px-3 text-[13px] font-bold text-navy"><Share2 size={16} />送る</button>
      </div>
      <p className="mt-1 text-[12px] opacity-70">LINEやメールで送ると、受け取った人がアプリで参加できます。</p>
      {club.schoolCode && (
        <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="flex-1"><div className="text-[12px] opacity-70">学校・教育委員会用（閲覧のみ）</div><div className="text-[18px] font-black tracking-[.2em]">{club.schoolCode}</div></div>
          <button onClick={() => share(true, true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-bold"><Share2 size={15} />送る</button>
        </div>
      )}
      {club.coachCode && (
        <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
          <div className="flex-1"><div className="text-[12px] opacity-70">指導者用（保護者には送らないでください）</div><div className="text-[18px] font-black tracking-[.2em]">{club.coachCode}</div></div>
          <button onClick={() => share(true)} className="flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-bold"><Share2 size={15} />送る</button>
        </div>
      )}
    </div>
  )
}

export default function Players() {
  const { be, club, players, conditions, events, isAdmin, isCoach, isSchool, toast } = useApp()
  const schoolView = isSchool && !isAdmin && !isCoach
  const t0 = iso(today()), f0 = iso(addDays(today(), -28))
  const past = events.filter(e => e.status !== 'canceled' && e.date < t0 && e.date >= f0)
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const [invite, setInvite] = useState(false)
  const noGuardian = players.filter(p => !p.guardianUids.length).length
  const [np, setNp] = useState({ name: '', grade: '中学1年' })
  const rows = useMemo(() => players.filter(p => !q || p.name.includes(q)).map(p => ({ p, s: loadStatus(conditions, p.id) })).sort((a, b) => ({ danger: 0, warn: 1, ok: 2, none: 3 }[a.s.tone] - { danger: 0, warn: 1, ok: 2, none: 3 }[b.s.tone])), [players, conditions, q])
  if (!club) return null
  const save = async () => {
    await be.savePlayer(club.id, { id: 'p' + uid6(), name: np.name.trim(), grade: np.grade, guardianUids: [], discount: 0 })
    setNp({ name: '', grade: np.grade }); setAdd(false); toast('会員を追加しました')
  }
  return (
    <>
      <PageHeader title={isAdmin ? '会員' : schoolView ? '生徒' : '選手'} sub={`${players.length}人`} right={isAdmin && <div className="flex gap-2">
        <button onClick={() => setInvite(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-brand shadow-card active:scale-95"><Share2 size={16} />招待</button>
        <button onClick={() => setAdd(true)} aria-label="会員を追加" className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white active:scale-95"><UserPlus size={20} /></button>
      </div>} />
      {isAdmin && noGuardian > 0 && (
        <button onClick={() => setInvite(true)} className="mb-1 flex w-full animate-up items-center gap-3 rounded-xl2 bg-amber-50 p-3.5 text-left active:scale-[.99]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><Share2 size={18} /></span>
          <span className="flex-1"><b className="block text-[14px]">保護者が未登録の会員 {noGuardian}人</b><span className="block text-[12px] text-ink-2">招待コードを送ると、保護者がアプリで出欠・会費・体調記録を使えます</span></span>
          <ChevronRight size={18} className="text-ink-3" />
        </button>
      )}
      <Sheet open={invite} onClose={() => setInvite(false)} title="クラブに招待する"><InviteCard /><p className="mt-3 text-[12px] text-ink-3">コードは立場ごとに分かれています。指導者用・学校用のコードは、保護者には送らないでください。</p></Sheet>
      <div className="relative mt-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={`${inputCls} pl-11`} placeholder="名前で検索" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {!rows.length ? <div className="mt-4"><Empty icon={<Users />} title="まだ会員がいません" text="招待コードを送ると、保護者がアプリから登録できます" /></div> : (
        <Card className="mt-3 divide-y divide-line !py-1">
          {rows.map(({ p, s }, i) => (
            <button key={p.id} onClick={() => nav(`/player/${p.id}`)} style={stagger(i)} className="flex w-full animate-up items-center gap-3 py-3 text-left">
              <Avatar name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-[12px] text-ink-2">{p.grade}{isAdmin && !p.guardianUids.length ? '・保護者未登録' : ''}{isAdmin && !p.insured ? '・保険未加入' : ''}{isAdmin && p.discount ? `・会費${p.discount === 100 ? '免除' : p.discount + '%減額'}` : ''}</div>
              </div>
              {schoolView
                ? (() => { const n = past.filter(e => e.att[p.id] === 'yes').length; return <Badge tone={past.length && n / past.length < 0.5 ? 'warn' : 'ok'}>参加 {n}／{past.length}回</Badge> })()
                : <Badge tone={s.tone === 'none' ? 'none' : s.tone}>体調 {s.label}</Badge>}
            </button>
          ))}
        </Card>
      )}
      <Sheet open={add} onClose={() => setAdd(false)} title="会員を追加" footer={<Button block size="lg" onClick={save} disabled={!np.name.trim()}>追加する</Button>}>
        <Field label="氏名"><input className={inputCls} value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} autoFocus /></Field>
        <Field label="学年"><select className={inputCls} value={np.grade} onChange={e => setNp({ ...np, grade: e.target.value })}>{['小学5年', '小学6年', '中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年'].map(g => <option key={g}>{g}</option>)}</select></Field>
        <p className="text-[12px] text-ink-3">保護者がアプリで登録すると、ご家庭のアカウントに自動でつながります。運営が先に登録しておく場合はこちらを使ってください。</p>
      </Sheet>
    </>
  )
}
