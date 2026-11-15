import { useState } from 'react'
import { CalendarCheck, HeartPulse, ShieldCheck, Wallet } from 'lucide-react'
import { Button, Field, inputCls } from '../components/ui'
import { useApp } from '../lib/store'
import { DEMO_USERS, demoSignIn, resetDemo } from '../lib/demoBackend'

const authMsg = (e: unknown) => {
  const c = (e as { code?: string })?.code || ''
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'メールアドレスかパスワードが違います'
  if (c.includes('email-already-in-use')) return 'このメールアドレスは登録済みです。ログインしてください'
  if (c.includes('weak-password')) return 'パスワードは6文字以上にしてください'
  if (c.includes('invalid-email')) return 'メールアドレスの形式が正しくありません'
  if (c.includes('popup')) return 'ログイン画面が閉じられました'
  return (e as Error)?.message || 'ログインできませんでした'
}

export default function Login() {
  const { be, switchMode } = useApp()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  const ensureLive = () => { if (be.mode !== 'firebase') switchMode('firebase') }
  const submit = async () => {
    setErr(''); setInfo(''); setBusy(true)
    try {
      ensureLive()
      const live = (await import('../lib/fireBackend')).fireBackend
      if (tab === 'login') await live.signInEmail(email, pass)
      else await live.signUpEmail(email, pass)
    } catch (e) { setErr(authMsg(e)) } finally { setBusy(false) }
  }
  const google = async () => {
    setErr(''); setBusy(true)
    try { ensureLive(); await (await import('../lib/fireBackend')).fireBackend.signInGoogle() } catch (e) { setErr(authMsg(e)) } finally { setBusy(false) }
  }
  const reset = async () => {
    if (!email) { setErr('先にメールアドレスを入力してください'); return }
    try { await (await import('../lib/fireBackend')).fireBackend.resetPassword(email); setInfo('パスワード再設定のメールを送りました') } catch (e) { setErr(authMsg(e)) }
  }
  const demo = (uid: string) => { location.hash = '#/'; resetDemo(); demoSignIn(uid); switchMode('demo') }

  return (
    <div className="min-h-[100dvh] bg-navy text-white">
      <div className="relative overflow-hidden px-6 pb-10 pt-[calc(env(safe-area-inset-top)+48px)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand opacity-40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-lime opacity-10 blur-3xl" />
        <div className="relative mx-auto max-w-md">
          <div className="text-[15px] font-black tracking-wide">My<span className="text-lime">COACH</span>-My<span className="text-lime">TEAM</span></div>
          <h1 className="mt-6 text-[30px] font-black leading-tight">部活動・地域クラブを、<br />スマホひとつで。</h1>
          <div className="mt-6 grid grid-cols-2 gap-2 text-[13px]">
            {[
              [CalendarCheck, '出欠はワンタップ'],
              [ShieldCheck, '暑さ指数で安全に'],
              [HeartPulse, '体調と練習量を記録'],
              [Wallet, '会費はカード払い'],
            ].map(([I, t], i) => {
              const Icon = I as typeof CalendarCheck
              return <div key={i} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5"><Icon size={16} className="text-lime" />{t as string}</div>
            })}
          </div>
        </div>
      </div>

      <div className="rounded-t-[32px] bg-canvas px-5 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-6 text-ink">
        <div className="mx-auto max-w-md">
          <div className="mb-5 flex rounded-2xl bg-slate-200/70 p-1">
            {(['login', 'signup'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setErr('') }} className={`h-10 flex-1 rounded-xl text-[14px] font-bold transition ${tab === t ? 'bg-white shadow-sm' : 'text-ink-2'}`}>{t === 'login' ? 'ログイン' : 'はじめて使う'}</button>
            ))}
          </div>
          <Field label="メールアドレス"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
          <Field label="パスワード" hint={tab === 'signup' ? '6文字以上' : undefined}><input className={inputCls} type="password" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></Field>
          {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}
          {info && <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{info}</p>}
          <Button block size="lg" loading={busy} onClick={submit} disabled={!email || !pass}>{tab === 'login' ? 'ログイン' : '登録してはじめる'}</Button>
          <Button block size="lg" variant="ghost" className="mt-3" onClick={google} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Googleで続ける
          </Button>
          {tab === 'login' && <button onClick={reset} className="mx-auto mt-4 block text-[13px] text-ink-2 underline">パスワードを忘れた方</button>}

          <div className="mt-8 rounded-xl2 border border-dashed border-slate-300 bg-white p-4">
            <p className="text-[14px] font-bold">登録せずに試す（デモ）</p>
            <p className="mt-0.5 text-[12px] text-ink-2">架空のクラブで、それぞれの立場の画面を体験できます。</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[['保護者', DEMO_USERS.member], ['指導者', DEMO_USERS.coach], ['運営', DEMO_USERS.admin]].map(([l, u]) => (
                <Button key={u} variant="soft" size="sm" onClick={() => demo(u)}>{l}</Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
