import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, Plus, Search } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Empty, Field, inputCls, PageHeader, Sheet, Skeleton, cx, stagger } from '../components/ui'
import type { Post } from '../lib/types'
import { DOW, relTime, uid6, yen } from '../lib/util'
import { AGES, LEVELS, SKILLS } from '../lib/places'
import { contractBadge } from './Requests'

/** クラブ運営：指導者の募集を出し、応募を確認する */
export default function Posts() {
  const { be, club, profile, authUser, isAdmin, contracts, toast } = useApp()
  const nav = useNavigate()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ title: '', days: [6] as number[], start: '09:00', fee: 6000, note: '', skills: [] as string[], ages: ['中学生'] as string[], level: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => (club ? be.watchClubPosts(club.id, setPosts) : undefined), [be, club?.id])
  if (!club || !profile || !authUser) return null
  if (!isAdmin) return <><PageHeader title="指導者の募集" back /><Empty icon={<Megaphone />} title="募集を出せるのはクラブの運営者です" /></>
  const create = async () => {
    setBusy(true)
    try {
      await be.savePost({ id: 'post' + Date.now().toString(36) + uid6(), clubId: club.id, clubName: club.name, ownerUid: authUser.uid, ownerName: profile.name, sport: club.sport, areaLabel: club.areaLabel, lat: club.lat, lon: club.lon, title: f.title.trim().slice(0, 60), days: f.days, start: f.start, fee: Math.max(0, Math.round(f.fee)), note: f.note.trim().slice(0, 1000), skills: f.skills.slice(0, 8), ages: f.ages, level: f.level || undefined, status: 'open', at: Date.now() })
      setOpen(false); setF({ ...f, title: '', note: '' }); toast('募集を公開しました。条件の合う指導者に表示されます')
    } catch { toast('公開できませんでした') }
    setBusy(false)
  }
  const toggle = (p: Post) => be.savePost({ ...p, status: p.status === 'open' ? 'closed' : 'open' }).then(() => toast(p.status === 'open' ? '募集を締め切りました' : '募集を再開しました'))
  return (
    <>
      <PageHeader title="指導者の募集" back sub={`${club.sport}・${club.areaLabel}`} right={<button onClick={() => setOpen(true)} aria-label="募集を出す" className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white active:scale-95"><Plus size={20} /></button>} />
      <Button block variant="soft" className="mb-3" onClick={() => nav('/coaches')}><Search size={18} />登録している指導者から探して依頼する</Button>
      {posts === null ? <Skeleton className="h-28" /> : !posts.length ? (
        <Empty icon={<Megaphone />} title="募集はまだありません" text="曜日・時間・謝金を決めて募集を出すと、近くの審査済みの指導者が応募できます" action={<Button onClick={() => setOpen(true)}><Plus size={18} />募集を出す</Button>} />
      ) : (
        <div className="space-y-3">
          {posts.map((p, i) => {
            const apps = contracts.filter(k => k.postId === p.id && k.player === authUser.uid)
            return (
              <Card key={p.id} style={stagger(i)} className="animate-up">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-black">{p.title}</div>
                    <div className="mt-0.5 text-[12px] text-ink-2">{p.days.map(d => DOW[d]).join('・')} {p.start}〜・1回 {yen(p.fee)}・{relTime(p.at)}</div>
                  </div>
                  <Badge tone={p.status === 'open' ? 'ok' : 'none'}>{p.status === 'open' ? '募集中' : '締切'}</Badge>
                </div>
                <div className="mt-3 border-t border-line pt-2">
                  <div className="mb-1 text-[12px] font-bold text-ink-2">応募（{apps.length}件）</div>
                  {apps.length ? apps.map(k => (
                    <button key={k.id} onClick={() => nav(`/requests/${k.id}`)} className="flex w-full items-center gap-3 py-2 text-left active:opacity-60">
                      <Avatar name={k.coachName} size={34} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{k.coachName}</span><span className="block text-[12px] text-ink-2">希望 {yen(k.fee)}</span></span>
                      {contractBadge(k, authUser.uid)}
                    </button>
                  )) : <p className="py-1 text-[13px] text-ink-3">まだ応募はありません</p>}
                </div>
                <button onClick={() => toggle(p)} className="mt-1 text-[13px] font-bold text-brand">{p.status === 'open' ? '募集を締め切る' : '募集を再開する'}</button>
              </Card>
            )
          })}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="指導者を募集する" footer={<Button block size="lg" loading={busy} disabled={!f.title.trim() || !f.days.length} onClick={create}>募集を公開する</Button>}>
        <Field label="募集のタイトル"><input className={inputCls} maxLength={60} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="例：土曜午前の練習を担当できる方" /></Field>
        <Field label="活動する曜日"><div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} onClick={() => setF({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] })} className={cx('h-10 flex-1 rounded-xl border text-[14px] font-bold transition active:scale-95', f.days.includes(d) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{DOW[d]}</button>)}</div></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="開始時刻"><input type="time" className={inputCls} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="謝金（1回・円）"><input type="number" inputMode="numeric" min={0} max={100000} className={inputCls} value={f.fee} onChange={e => setF({ ...f, fee: Number(e.target.value) })} /></Field>
        </div>
        <Field label="求める指導内容" hint="指導者の得意分野と照らし合わせ、相性の高い人から表示します"><div className="flex flex-wrap gap-2">{SKILLS.map(s => <button key={s} onClick={() => setF({ ...f, skills: f.skills.includes(s) ? f.skills.filter(x => x !== s) : [...f.skills, s] })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', f.skills.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="対象の年代"><div className="flex flex-wrap gap-1.5">{AGES.map(s => <button key={s} onClick={() => setF({ ...f, ages: f.ages.includes(s) ? f.ages.filter(x => x !== s) : [...f.ages, s] })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold', f.ages.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
          <Field label="クラブの方針"><select className={inputCls} value={f.level} onChange={e => setF({ ...f, level: e.target.value })}><option value="">指定しない</option>{LEVELS.map(l => <option key={l}>{l}</option>)}</select></Field>
        </div>
        <Field label="詳しい内容"><textarea className={cx(inputCls, 'min-h-[110px]')} maxLength={1000} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="参加する子どもの学年・人数、指導してほしい内容、活動場所など" /></Field>
        <p className="text-[12px] text-ink-3">募集は、本人確認と安全研修を終えた指導者だけが応募できます。</p>
      </Sheet>
    </>
  )
}
