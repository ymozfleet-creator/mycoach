import { useState } from 'react'
import { Building2, ChevronRight, GraduationCap, Plus, Trash2, UserRound, Users, Whistle } from './icons'
import { Button, Field, inputCls, cx } from '../components/ui'
import { useApp } from '../lib/store'
import type { Role } from '../lib/types'
import { DOW, uid6 } from '../lib/util'

const SPORTS = ['バスケットボール', 'サッカー', 'バレーボール', '野球', 'ソフトボール', '陸上', 'テニス', 'ソフトテニス', '卓球', 'バドミントン', 'ハンドボール', '水泳', '剣道', '柔道', 'ダンス', 'その他']
const AREAS: Record<string, [number, number]> = {
  '東京都中野区': [35.7074, 139.6638], '東京都杉並区': [35.6995, 139.6364], '東京都新宿区': [35.6938, 139.7034], '東京都練馬区': [35.7356, 139.6517],
  '東京都世田谷区': [35.6466, 139.6532], '東京都板橋区': [35.7512, 139.7093], '東京都23区（その他）': [35.6895, 139.6917], '神奈川県横浜市': [35.4437, 139.638],
  '埼玉県さいたま市': [35.8617, 139.6455], '千葉県千葉市': [35.6074, 140.1065], '大阪府大阪市': [34.6937, 135.5023], '愛知県名古屋市': [35.1815, 136.9066], '福岡県福岡市': [33.5902, 130.4017],
}

export default function Onboarding() {
  const { be, authUser, profile, toast } = useApp()
  const [step, setStep] = useState(profile?.role ? 1 : 0)
  const [role, setRole] = useState<Role>(profile?.role || 'member')
  const [name, setName] = useState(profile?.name || authUser?.displayName || '')
  const [code, setCode] = useState('')
  const [kids, setKids] = useState([{ name: '', grade: '中学1年' }])
  const [club, setClub] = useState({ name: '', sport: 'バスケットボール', area: '東京都中野区', fee: 3000, venue: '', indoor: true })
  const [coach, setCoach] = useState({ sports: ['バスケットボール'], days: [6, 0], license: '', area: '東京都中野区' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [org, setOrg] = useState(profile?.org || '')
  if (!authUser) return null
  const uid = authUser.uid

  const finish = async () => {
    setErr(''); setBusy(true)
    try {
      if (!name.trim()) throw new Error('お名前を入力してください')
      if (role === 'admin') {
        if (!club.name.trim() || !club.venue.trim()) throw new Error('クラブ名と活動場所を入力してください')
        await be.saveProfile({ uid, name: name.trim(), role, clubIds: profile?.clubIds || [] })
        const [lat, lon] = AREAS[club.area]
        await be.createClub({ name: club.name.trim(), sport: club.sport, areaLabel: club.area, lat, lon, venues: [{ name: club.venue.trim(), indoor: club.indoor }], fee: Number(club.fee) || 0, ownerUid: uid })
        toast('クラブを作成しました')
      } else {
        if (!code.trim()) throw new Error('招待コードを入力してください')
        const [lat, lon] = AREAS[coach.area]
        await be.saveProfile(role === 'coach'
          ? { uid, name: name.trim(), role, clubIds: profile?.clubIds || [], sports: coach.sports, days: coach.days, license: coach.license, areaLabel: coach.area, lat, lon, verified: 'none', training: false }
          : role === 'school' ? { uid, name: name.trim(), role, clubIds: profile?.clubIds || [], org: org.trim() }
          : { uid, name: name.trim(), role, clubIds: profile?.clubIds || [] })
        const clubId = await be.joinClub(code, uid)
        if (role === 'member') {
          // 運営が先に登録した同名の会員がいれば、その会員にご家庭をひも付ける
          const existing = await new Promise<import('../lib/types').Player[]>(res => { let u: () => void = () => {}; u = be.watchPlayers(clubId, null, ps => { res(ps); setTimeout(() => u()) }) })
          for (const k of kids.filter(k => k.name.trim())) {
            const same = existing.find(p => p.name.replace(/\s/g, '') === k.name.replace(/\s/g, ''))
            if (same) await be.savePlayer(clubId, { ...same, guardianUids: [...new Set([...same.guardianUids, uid])] })
            else await be.savePlayer(clubId, { id: 'p' + uid6(), name: k.name.trim(), grade: k.grade, guardianUids: [uid], discount: 0 })
          }
        }
        toast('クラブに参加しました')
      }
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  const roles: { r: Role; icon: React.ReactNode; t: string; d: string }[] = [
    { r: 'member', icon: <Users />, t: '保護者・生徒', d: '予定の確認、出欠、会費の支払い' },
    { r: 'coach', icon: <Whistle />, t: '指導者', d: '指導の予定、選手の体調、練習メニュー' },
    { r: 'admin', icon: <Building2 />, t: 'クラブ・部活動の運営', d: '予定・会員・会費の管理、指導者探し（学校の顧問も）' },
    { r: 'school', icon: <GraduationCap />, t: '学校・教育委員会', d: '生徒の活動状況・安全・ガイドラインの確認' },
  ]

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md px-5 pb-16 pt-[calc(env(safe-area-inset-top)+28px)]">
      <div className="mb-6 flex gap-1.5">{[0, 1].map(i => <div key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand' : 'bg-slate-200')} />)}</div>
      {step === 0 ? (
        <div className="animate-up">
          <h1 className="text-[26px] font-black">ようこそ</h1>
          <p className="mt-1 text-ink-2">あなたの立場を選んでください。あとから変更できます。</p>
          <div className="mt-6 space-y-3">
            {roles.map(x => (
              <button key={x.r} onClick={() => setRole(x.r)} className={cx('flex w-full items-center gap-4 rounded-xl2 border-2 bg-white p-4 text-left shadow-card transition active:scale-[.99]', role === x.r ? 'border-brand' : 'border-transparent')}>
                <div className={cx('grid h-12 w-12 place-items-center rounded-2xl', role === x.r ? 'bg-brand text-white' : 'bg-brand-50 text-brand')}>{x.icon}</div>
                <div className="flex-1"><div className="text-[16px] font-bold">{x.t}</div><div className="text-[13px] text-ink-2">{x.d}</div></div>
                <div className={cx('h-5 w-5 rounded-full border-2', role === x.r ? 'border-[6px] border-brand' : 'border-slate-300')} />
              </button>
            ))}
          </div>
          <Field label="お名前"><input className={cx(inputCls, 'mt-6')} value={name} onChange={e => setName(e.target.value)} placeholder="例：加藤 由美" /></Field>
          <Button block size="lg" onClick={() => setStep(1)} disabled={!name.trim()}>次へ <ChevronRight size={18} /></Button>
        </div>
      ) : (
        <div className="animate-up">
          {role === 'admin' ? (
            <>
              <h1 className="text-[24px] font-black">クラブを登録</h1>
              <p className="mt-1 mb-6 text-ink-2">登録後に表示される招待コードを、保護者や指導者に伝えてください。</p>
              <Field label="クラブ名"><input className={inputCls} value={club.name} onChange={e => setClub({ ...club, name: e.target.value })} placeholder="例：中野区 地域バスケットボールクラブ" /></Field>
              <Field label="種目"><select className={inputCls} value={club.sport} onChange={e => setClub({ ...club, sport: e.target.value })}>{SPORTS.map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="活動地域" hint="暑さ指数の計算と、指導者探しに使います"><select className={inputCls} value={club.area} onChange={e => setClub({ ...club, area: e.target.value })}>{Object.keys(AREAS).map(a => <option key={a}>{a}</option>)}</select></Field>
              <Field label="主な活動場所"><input className={inputCls} value={club.venue} onChange={e => setClub({ ...club, venue: e.target.value })} placeholder="例：江原小学校 体育館" /></Field>
              <div className="mb-4 flex gap-2">{[true, false].map(v => <button key={String(v)} onClick={() => setClub({ ...club, indoor: v })} className={cx('h-10 flex-1 rounded-xl border text-[14px] font-bold', club.indoor === v ? 'border-brand bg-brand-50 text-brand' : 'border-line bg-white text-ink-2')}>{v ? '屋内' : '屋外'}</button>)}</div>
              <Field label="月会費（円）"><input className={inputCls} type="number" inputMode="numeric" value={club.fee} onChange={e => setClub({ ...club, fee: Number(e.target.value) })} /></Field>
            </>
          ) : (
            <>
              <h1 className="text-[24px] font-black">クラブに参加</h1>
              <p className="mt-1 mb-6 text-ink-2">運営の方から届いた招待コード（6文字）を入力してください。{role === 'coach' ? '指導者の方は「指導者用」のコードを入力してください。' : role === 'school' ? '学校・教育委員会の方は、クラブの運営から届いた「学校用」のコードを入力してください。' : ''}</p>
              <Field label="招待コード"><input className={cx(inputCls, 'text-center text-[22px] font-black uppercase tracking-[.3em]')} maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC123" /></Field>
              {role === 'school' && <Field label="学校名・所属"><input className={inputCls} value={org} onChange={e => setOrg(e.target.value)} placeholder="例：中野区立第五中学校／中野区教育委員会" /></Field>}
              {role === 'member' && (
                <div className="mb-4">
                  <span className="mb-1.5 block text-[13px] font-bold text-ink-2">お子さま（生徒ご本人の場合はご自身）</span>
                  {kids.map((k, i) => (
                    <div key={i} className="mb-2 flex gap-2">
                      <input className={cx(inputCls, 'flex-1')} value={k.name} onChange={e => setKids(kids.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="氏名" />
                      <select className={cx(inputCls, 'w-32')} value={k.grade} onChange={e => setKids(kids.map((x, j) => j === i ? { ...x, grade: e.target.value } : x))}>{['小学5年', '小学6年', '中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年'].map(g => <option key={g}>{g}</option>)}</select>
                      {kids.length > 1 && <button onClick={() => setKids(kids.filter((_, j) => j !== i))} className="px-2 text-ink-3" aria-label="削除"><Trash2 size={18} /></button>}
                    </div>
                  ))}
                  <button onClick={() => setKids([...kids, { name: '', grade: '中学1年' }])} className="mt-1 flex items-center gap-1 text-[14px] font-bold text-brand"><Plus size={16} />もう1人追加</button>
                </div>
              )}
              {role === 'coach' && (
                <>
                  <Field label="指導できる種目"><div className="flex flex-wrap gap-2">{SPORTS.slice(0, 12).map(s => <button key={s} onClick={() => setCoach({ ...coach, sports: coach.sports.includes(s) ? coach.sports.filter(x => x !== s) : [...coach.sports, s] })} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-bold', coach.sports.includes(s) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{s}</button>)}</div></Field>
                  <Field label="指導できる曜日"><div className="flex gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} onClick={() => setCoach({ ...coach, days: coach.days.includes(d) ? coach.days.filter(x => x !== d) : [...coach.days, d] })} className={cx('h-10 flex-1 rounded-xl border text-[14px] font-bold', coach.days.includes(d) ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{DOW[d]}</button>)}</div></Field>
                  <Field label="活動できる地域"><select className={inputCls} value={coach.area} onChange={e => setCoach({ ...coach, area: e.target.value })}>{Object.keys(AREAS).map(a => <option key={a}>{a}</option>)}</select></Field>
                  <Field label="資格・経歴（任意）"><input className={inputCls} value={coach.license} onChange={e => setCoach({ ...coach, license: e.target.value })} placeholder="例：JSPO公認コーチ1" /></Field>
                </>
              )}
            </>
          )}
          {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}><UserRound size={18} />戻る</Button>
            <Button size="lg" className="flex-1" loading={busy} onClick={finish}>{role === 'admin' ? 'クラブを作成' : '参加する'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
