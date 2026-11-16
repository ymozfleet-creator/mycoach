import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink } from 'lucide-react'
import { useApp } from '../lib/store'
import { AGES, AREAS, LEVELS, SKILLS, SPORTS } from '../lib/places'
import { Badge, Button, Card, Field, inputCls, PageHeader, Section, cx } from '../components/ui'
import { PhotoPicker } from '../components/PhotoPicker'
import { DOW, yen } from '../lib/util'

const BIO_MAX = 800

export default function CoachProfile() {
  const { be, profile, authUser, toast } = useApp()
  const [f, setF] = useState(() => ({
    name: profile?.name || '', sports: profile?.sports || [], area: profile?.areaLabel && AREAS[profile.areaLabel] ? profile.areaLabel : '東京都中野区',
    days: profile?.days || [], license: profile?.license || '', teacher: !!profile?.teacher, rate: profile?.rate || 6000, bio: profile?.bio || '',
    skills: profile?.skills || [], ages: profile?.ages || [], levels: profile?.levels || [], years: profile?.years || 0, photo: profile?.photo || '',
  }))
  const [busy, setBusy] = useState(false)
  const [payBusy, setPayBusy] = useState(false)
  useEffect(() => {
    if (location.hash.includes('payout')) setTimeout(() => document.getElementById('payout')?.scrollIntoView({ behavior: 'smooth' }), 300)
    if (location.search.includes('connect=done')) toast('受取口座の手続きが完了しました。反映まで数分かかることがあります')
  }, [])
  if (!profile || !authUser) return null
  const valid = f.name.trim() && f.sports.length && f.days.length && f.bio.length <= BIO_MAX && f.rate >= 0 && f.rate <= 100000
  const save = async () => {
    setBusy(true)
    const [lat, lon] = AREAS[f.area]
    await be.saveProfile({ uid: authUser.uid, name: f.name.trim().slice(0, 40), sports: f.sports, areaLabel: f.area, lat, lon, days: f.days, license: f.license.trim().slice(0, 100), teacher: f.teacher, skills: f.skills.slice(0, 8), ages: f.ages, levels: f.levels, years: Math.max(0, Math.min(60, Math.round(f.years))), photo: f.photo, rate: Math.round(f.rate), bio: f.bio.trim().slice(0, BIO_MAX) })
    setBusy(false); toast('プロフィールを保存しました'); history.back()
  }
  const payout = async () => {
    setPayBusy(true)
    try {
      const url = await be.connectPayout(`${location.origin}${location.pathname}?connect=done#/coach-profile`)
      if (url) location.href = url
      else toast('受取口座を設定しました（デモ）')
    } catch (e) { toast((e as Error).message) }
    setPayBusy(false)
  }
  const toggle = <T,>(a: T[], v: T) => (a.includes(v) ? a.filter(x => x !== v) : [...a, v])
  return (
    <>
      <PageHeader title="指導者プロフィール" back sub="クラブが指導者を探すときに表示されます" />
      <Card>
        <PhotoPicker round label="プロフィール写真" value={f.photo} onChange={v => setF({ ...f, photo: v })} hint="顔がはっきりわかる、あなた本人の写真を選んでください。写真があるとクラブからの依頼が届きやすくなります。お子さまや他の人が写った写真は使えません。" />
        <Field label="お名前"><input className={inputCls} value={f.name} maxLength={40} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="指導できる種目"><div className="flex flex-wrap gap-2">{SPORTS.map(s => <button key={s} onClick={() => setF({ ...f, sports: toggle(f.sports, s) })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', f.sports.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
        <Field label="活動できる地域" hint="クラブの活動場所からの距離を計算するのに使います"><select className={inputCls} value={f.area} onChange={e => setF({ ...f, area: e.target.value })}>{Object.keys(AREAS).map(a => <option key={a}>{a}</option>)}</select></Field>
        <Field label="指導できる曜日"><div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} onClick={() => setF({ ...f, days: toggle(f.days, d) })} className={cx('h-10 flex-1 rounded-xl border text-[14px] font-bold transition active:scale-95', f.days.includes(d) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{DOW[d]}</button>)}</div></Field>
        <Field label="得意な指導（いくつでも）" hint="クラブが求める指導内容と照らし合わせて、相性を計算します"><div className="flex flex-wrap gap-2">{SKILLS.map(s => <button key={s} onClick={() => setF({ ...f, skills: toggle(f.skills, s) })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', f.skills.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="指導したい年代"><div className="flex flex-wrap gap-1.5">{AGES.map(s => <button key={s} onClick={() => setF({ ...f, ages: toggle(f.ages, s) })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', f.ages.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
          <Field label="指導歴（年）"><input type="number" inputMode="numeric" min={0} max={60} className={inputCls} value={f.years} onChange={e => setF({ ...f, years: Number(e.target.value) })} /></Field>
        </div>
        <Field label="得意な指導スタイル"><div className="flex flex-wrap gap-2">{LEVELS.map(s => <button key={s} onClick={() => setF({ ...f, levels: toggle(f.levels, s) })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', f.levels.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
        <Field label="資格・競技歴"><input className={inputCls} value={f.license} maxLength={100} onChange={e => setF({ ...f, license: e.target.value })} placeholder="例：JSPO公認コーチ1／元実業団" /></Field>
        <label className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-[14px] font-bold"><input type="checkbox" className="h-5 w-5 accent-brand" checked={f.teacher} onChange={e => setF({ ...f, teacher: e.target.checked })} />現職の教員です（兼職兼業の許可を得ています）</label>
        <Field label="希望する謝金（1回あたり・円）" hint="目安として表示します。実際の金額は依頼ごとに決めます"><input type="number" inputMode="numeric" min={0} max={100000} className={inputCls} value={f.rate} onChange={e => setF({ ...f, rate: Number(e.target.value) })} /></Field>
        <Field label={`自己紹介（${f.bio.length}／${BIO_MAX}文字）`}><textarea className={cx(inputCls, 'min-h-[130px]')} maxLength={BIO_MAX} value={f.bio} onChange={e => setF({ ...f, bio: e.target.value })} placeholder="指導歴、得意な指導、子どもと接するときに大切にしていること" /></Field>
        <Button block size="lg" loading={busy} disabled={!valid} onClick={save}>保存する</Button>
      </Card>

      <div id="payout" />
      <Section title="謝金の受取口座">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand"><CreditCard size={20} /></span>
            <div className="flex-1">
              <div className="font-bold">Stripeで受け取る</div>
              <div className="text-[12px] text-ink-2">口座情報はStripeが管理し、このアプリには保存されません</div>
            </div>
            {profile.stripeChargesEnabled ? <Badge tone="ok">設定済み</Badge> : profile.stripeAccountId ? <Badge tone="warn">手続き中</Badge> : <Badge tone="none">未設定</Badge>}
          </div>
          <div className="mt-3 rounded-2xl bg-canvas p-3 text-[12px] leading-relaxed text-ink-2">
            クラブがカードで謝金を支払うと、謝金から事務手数料20%を差し引いた額が振り込まれます。<br />例：謝金 {yen(6000)} → 受取 {yen(4800)}
          </div>
          {!profile.stripeChargesEnabled && <Button block variant="soft" className="mt-3" loading={payBusy} onClick={payout}>{profile.stripeAccountId ? '手続きを続ける' : '受取口座を設定する'}<ExternalLink size={16} /></Button>}
        </Card>
      </Section>
    </>
  )
}
