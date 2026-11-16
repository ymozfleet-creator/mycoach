import { useRef, useState } from 'react'
import { Camera, IdCard, Lock, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Button, Card, Field, inputCls, PageHeader, cx } from '../components/ui'
import { shrinkImage } from '../lib/image'

const TYPES = ['運転免許証', 'マイナンバーカード（表面のみ）', 'パスポート', '在留カード', '学生証（写真付き）']

export default function Verify() {
  const { be, profile, authUser, toast } = useApp()
  const [type, setType] = useState(TYPES[0])
  const [img, setImg] = useState('')
  const [agree, setAgree] = useState(false)
  const [lic, setLic] = useState('')
  const [decl, setDecl] = useState({ age: false, record: false })
  const licInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  if (!profile || !authUser) return null
  const pick = async (f?: File) => { if (!f) return; setErr(''); try { setImg(await shrinkImage(f, { max: 1100, maxLen: 450_000 })) } catch (e) { setErr((e as Error).message) } }
  const submit = async () => {
    setBusy(true)
    try {
      await be.saveProfile({ uid: authUser.uid, eligibleAt: Date.now() })
      await be.submitVerification({ uid: authUser.uid, name: profile.name, docType: type, image: img, ...(lic ? { licenseImage: lic } : {}), at: Date.now() }); toast('提出しました。確認が終わるとお知らせします'); history.back() }
    catch { setErr('提出できませんでした。通信状況をご確認のうえ、もう一度お試しください') }
    setBusy(false)
  }
  return (
    <>
      <PageHeader title="本人確認" back sub="子どもに関わる活動のため、すべての指導者に確認をお願いしています" />
      {profile.verified === 'approved' ? (
        <Card className="flex items-center gap-3"><ShieldCheck className="text-emerald-500" /><div className="font-bold">本人確認は完了しています</div></Card>
      ) : profile.verified === 'pending' ? (
        <Card className="flex items-center gap-3"><Badge tone="warn">確認中</Badge><div className="text-[14px]">事務局で確認しています。通常2営業日以内に結果をお知らせします。</div></Card>
      ) : (
        <Card>
          {profile.verifyNote && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">前回の提出について：{profile.verifyNote}</p>}
          <Field label="書類の種類"><select className={inputCls} value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <span className="mb-1.5 block text-[13px] font-bold text-ink-2">書類の写真</span>
          <button onClick={() => input.current?.click()} className={cx('mb-2 grid w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition active:scale-[.99]', img ? 'border-brand' : 'h-40 border-line bg-canvas')}>
            {img ? <img src={img} alt="提出する書類" className="max-h-64 w-full object-contain" /> : <span className="flex flex-col items-center gap-2 text-ink-2"><Camera size={28} /><span className="text-[14px] font-bold">撮影する・写真を選ぶ</span></span>}
          </button>
          <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => pick(e.target.files?.[0])} />
          <p className="mb-4 text-[12px] text-ink-3">氏名・生年月日・顔写真が読み取れるように撮影してください。マイナンバー（12桁の番号）は写さないでください。</p>
          <span className="mb-1.5 block text-[13px] font-bold text-ink-2">指導者資格の証明（任意）</span>
          <button onClick={() => licInput.current?.click()} className={cx('mb-2 grid w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed transition active:scale-[.99]', lic ? 'border-brand' : 'h-24 border-line bg-canvas')}>
            {lic ? <img src={lic} alt="資格の証明" className="max-h-48 w-full object-contain" /> : <span className="flex items-center gap-2 text-[13px] font-bold text-ink-2"><Camera size={20} />登録証・認定証の写真を追加</span>}
          </button>
          <input ref={licInput} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { setLic(await shrinkImage(f, { max: 1100, maxLen: 450_000 })) } catch (x) { setErr((x as Error).message) } }} />
          <p className="mb-4 text-[12px] text-ink-3">JSPO公認スポーツ指導者や競技団体のライセンスなど。事務局が確認すると、プロフィールに「資格確認済み」と表示され、クラブから選ばれやすくなります。</p>
          <div className="mb-4 rounded-2xl border border-line p-3">
            <div className="mb-2 text-[13px] font-bold">登録の要件（本人の申告）</div>
            <label className="mb-2 flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" checked={decl.age} onChange={e => setDecl({ ...decl, age: e.target.checked })} />18歳以上です</label>
            <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" checked={decl.record} onChange={e => setDecl({ ...decl, record: e.target.checked })} />子どもへの暴力・性暴力・わいせつ行為などで、処分や有罪判決を受けたことはありません</label>
            <p className="mt-2 text-[11px] text-ink-3">申告が事実と異なることがわかった場合は、登録を取り消します。</p>
          </div>
          <div className="mb-4 flex gap-2 rounded-2xl bg-canvas p-3 text-[12px] leading-relaxed text-ink-2"><Lock size={16} className="mt-0.5 shrink-0" />写真は本人確認のためだけに使い、閲覧できるのはあなたと運営事務局だけです。確認が終わると写真は削除されます。</div>
          <label className="mb-4 flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand" checked={agree} onChange={e => setAgree(e.target.checked)} />上記の取り扱いに同意し、本人の書類を提出します</label>
          {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}
          <Button block size="lg" loading={busy} disabled={!img || !agree || !decl.age || !decl.record} onClick={submit}><IdCard size={18} />提出する</Button>
        </Card>
      )}
    </>
  )
}
