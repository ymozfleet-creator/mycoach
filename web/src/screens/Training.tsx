import { useState } from 'react'
import { BadgeCheck, Check, HeartPulse, Shield, Thermometer, UserRoundCheck, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Card, PageHeader, cx, stagger } from '../components/ui'

const LESSONS = [
  { icon: <Thermometer size={20} />, title: '熱中症を防ぐ', points: [
    '暑さ指数（WBGT）で判断します。28以上は「厳重警戒」で激しい運動は中止、31以上は「運動は原則中止」です（日本スポーツ協会の指針）。',
    'アプリの予定には暑さ指数の予報が表示されます。前日に確認し、時間変更・屋内への変更・中止を運営と相談してください。',
    '気分不良・めまい・けいれんがあれば、すぐに涼しい場所で体を冷やします。呼びかけへの反応がおかしい、自分で水を飲めない場合は迷わず119番通報します。',
  ] },
  { icon: <HeartPulse size={20} />, title: 'ケガ・事故への対応', points: [
    '頭を打った後に頭痛・ふらつき・吐き気などがあれば脳振とうを疑い、その日は練習に戻しません。',
    '活動場所のAEDの位置を、指導を始める前に確認しておきます。',
    'ケガやヒヤリとした出来事は、保護者へ連絡したうえで、アプリの「ケガ・ヒヤリハット」に当日中に記録します。',
  ] },
  { icon: <Shield size={20} />, title: '暴力・暴言・ハラスメントの禁止', points: [
    '体罰、暴言、人格を否定する言葉、威圧的な態度は、理由にかかわらず禁止です。',
    '罰としての過度な走り込みや、水分補給の制限も行いません。',
    '他の指導者の不適切な行為に気づいたら、クラブの運営または事務局に報告します。',
  ] },
  { icon: <UserRoundCheck size={20} />, title: '子どもの安全とプライバシー', points: [
    '子どもと1対1で密室にならないようにします。更衣室などには立ち入りません。',
    '子どもとの個人的なSNSやメッセージのやりとりはしません。連絡はアプリか保護者を通して行います。',
    '子どもの写真や名前を、許可なくSNSなどに投稿しません。',
  ] },
]

const QUIZ = [
  { q: '暑さ指数（WBGT）が31以上のときの対応として正しいものは？', a: ['水分補給をこまめにすれば通常どおり行う', '運動は原則中止する', '屋外なら帽子をかぶれば行ってよい'], ok: 1 },
  { q: '選手が呼びかけに応じず、自分で水も飲めない。まず行うことは？', a: ['119番通報し、体を冷やす', '保護者が迎えに来るまで様子を見る', '日陰で休ませて練習を続ける'], ok: 0 },
  { q: '頭を打った後にふらつきがある選手への対応は？', a: ['10分休めば練習に戻してよい', '本人が大丈夫と言えば戻してよい', 'その日は練習に戻さない'], ok: 2 },
  { q: 'ミスが続いた選手への対応として適切なものは？', a: ['罰として水を飲ませずに走らせる', '改善点を具体的に伝えて練習方法を工夫する', '全員の前で厳しく叱責する'], ok: 1 },
  { q: '選手から個人のSNSでの連絡先交換を求められたら？', a: ['連絡はアプリか保護者経由で行うと伝え、交換しない', '指導に熱心な子なので交換する', '保護者には知らせずに交換する'], ok: 0 },
  { q: '練習中にケガ人が出た。記録はどうする？', a: ['軽いケガなら記録しない', '保護者に連絡し、当日中にアプリに記録する', '次の練習のときにまとめて記録する'], ok: 1 },
]

export default function Training() {
  const { be, profile, authUser, toast } = useApp()
  const [step, setStep] = useState<'learn' | 'quiz' | 'done'>(profile?.training ? 'done' : 'learn')
  const [ans, setAns] = useState<(number | null)[]>(QUIZ.map(() => null))
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!profile || !authUser) return null
  const allOk = ans.every((v, i) => v === QUIZ[i].ok)
  const grade = async () => {
    setChecked(true)
    if (!allOk) { toast('まちがいがあります。赤い問題を見直してください'); return }
    setBusy(true)
    await be.saveProfile({ uid: authUser.uid, training: true, trainingAt: Date.now() })
    setBusy(false); setStep('done')
  }
  return (
    <>
      <PageHeader title="安全研修" back sub="約10分・全問正解で修了です" />
      {step === 'done' ? (
        <Card className="animate-pop text-center">
          <BadgeCheck size={56} className="mx-auto text-emerald-500" />
          <div className="mt-3 text-[20px] font-black">安全研修を修了しました</div>
          <p className="mt-1 text-[13px] text-ink-2">{profile.trainingAt ? `修了日：${new Date(profile.trainingAt).toLocaleDateString('ja-JP')}` : ''}　内容はいつでも見直せます。</p>
          <Button variant="soft" className="mt-4" onClick={() => setStep('learn')}>内容を見直す</Button>
        </Card>
      ) : step === 'learn' ? (
        <>
          <div className="space-y-3">
            {LESSONS.map((l, i) => (
              <Card key={l.title} style={stagger(i)} className="animate-up">
                <div className="mb-2 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand">{l.icon}</span><span className="text-[16px] font-black">{i + 1}. {l.title}</span></div>
                <ul className="space-y-2">{l.points.map(p => <li key={p} className="flex gap-2 text-[14px] leading-relaxed"><Check size={16} className="mt-1 shrink-0 text-emerald-500" />{p}</li>)}</ul>
              </Card>
            ))}
          </div>
          <Button block size="lg" className="mt-4" onClick={() => { setStep('quiz'); scrollTo({ top: 0, behavior: 'smooth' }) }}>{profile.training ? '確認テストをもう一度受ける' : '確認テストへ進む'}</Button>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {QUIZ.map((x, i) => {
              const wrong = checked && ans[i] !== x.ok
              return (
                <Card key={i} style={stagger(i)} className={cx('animate-up', wrong && 'ring-2 ring-red-400')}>
                  <div className="mb-3 text-[15px] font-bold">Q{i + 1}. {x.q}</div>
                  <div className="space-y-2">
                    {x.a.map((t, j) => (
                      <button key={j} onClick={() => { setAns(ans.map((v, k) => (k === i ? j : v))); setChecked(false) }} className={cx('flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-[14px] transition active:scale-[.99]', ans[i] === j ? 'border-brand bg-brand-50 font-bold text-brand' : 'border-line bg-white')}>
                        <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', ans[i] === j ? 'border-brand bg-brand text-white' : 'border-slate-300')}>{ans[i] === j && <Check size={12} strokeWidth={3} />}</span>{t}
                      </button>
                    ))}
                  </div>
                  {wrong && <p className="mt-2 flex items-center gap-1 text-[12px] font-bold text-red-600"><X size={14} />もう一度考えてみましょう</p>}
                </Card>
              )
            })}
          </div>
          <Button block size="lg" className="mt-4" loading={busy} disabled={ans.some(v => v === null)} onClick={grade}>採点する</Button>
          <button onClick={() => setStep('learn')} className="mt-3 block w-full text-center text-[13px] font-bold text-brand">研修の内容に戻る</button>
        </>
      )}
    </>
  )
}
