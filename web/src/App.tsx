import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, Ellipsis, Handshake, House, ShieldCheck, UserRound, Users, Wallet } from 'lucide-react'
import { useApp } from './lib/store'
import { cx, Skeleton } from './components/ui'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'

const Schedule = lazy(() => import('./screens/Schedule'))
const EventDetail = lazy(() => import('./screens/EventDetail'))
const Players = lazy(() => import('./screens/Players'))
const PlayerDetail = lazy(() => import('./screens/PlayerDetail'))
const Fees = lazy(() => import('./screens/Fees'))
const News = lazy(() => import('./screens/News'))
const Coaches = lazy(() => import('./screens/Coaches'))
const Requests = lazy(() => import('./screens/Requests'))
const Thread = lazy(() => import('./screens/Thread'))
const Menu = lazy(() => import('./screens/Menu'))
const Report = lazy(() => import('./screens/Report'))
const Safety = lazy(() => import('./screens/Safety'))
const More = lazy(() => import('./screens/More'))
const Jobs = lazy(() => import('./screens/Jobs'))
const Match = lazy(() => import('./screens/Match'))
const Posts = lazy(() => import('./screens/Posts'))
const CoachProfile = lazy(() => import('./screens/CoachProfile'))
const Verify = lazy(() => import('./screens/Verify'))
const Training = lazy(() => import('./screens/Training'))
const Ops = lazy(() => import('./screens/Ops'))
const FeeRequests = lazy(() => import('./screens/FeeRequests'))
const Facilities = lazy(() => import('./screens/Facilities'))
const Safeguard = lazy(() => import('./screens/Safeguard'))
const Consult = lazy(() => import('./screens/Safeguard').then(m => ({ default: m.ConsultForm })))

function Tabs() {
  const { isAdmin, isCoach, isSchool, coachMode, club, notices, contracts, authUser } = useApp()
  const loc = useLocation()
  const unread = notices.filter(n => !n.read).length
  // 自分が返事をする番の依頼・応募の数
  const pending = contracts.filter(k => k.status === 'proposed' && k.by !== authUser?.uid).length
  const tabs: { to: string; label: string; icon: ReactNode; badge?: number }[] = coachMode && !club
    ? [
        { to: '/', label: 'ホーム', icon: <House size={22} /> },
        { to: '/match', label: 'マッチング', icon: <Handshake size={22} />, badge: pending },
        { to: '/news', label: 'お知らせ', icon: <Bell size={22} />, badge: unread },
        { to: '/more', label: 'マイページ', icon: <UserRound size={22} /> },
      ]
    : isAdmin
    ? [
        { to: '/', label: 'ホーム', icon: <House size={22} /> },
        { to: '/schedule', label: '予定', icon: <CalendarDays size={22} /> },
        { to: '/players', label: '会員', icon: <Users size={22} /> },
        { to: '/fees', label: 'お金', icon: <Wallet size={22} /> },
        { to: '/more', label: 'その他', icon: <Ellipsis size={22} />, badge: unread },
      ]
    : isCoach
      ? [
          { to: '/', label: 'ホーム', icon: <House size={22} /> },
          { to: '/schedule', label: '予定', icon: <CalendarDays size={22} /> },
          { to: '/players', label: '選手', icon: <Users size={22} /> },
          { to: '/match', label: 'マッチング', icon: <Handshake size={22} />, badge: pending },
          { to: '/more', label: 'マイページ', icon: <UserRound size={22} />, badge: unread },
        ]
      : isSchool
        ? [
            { to: '/', label: 'ホーム', icon: <House size={22} /> },
            { to: '/schedule', label: '予定', icon: <CalendarDays size={22} /> },
            { to: '/players', label: '生徒', icon: <Users size={22} /> },
            { to: '/safety', label: '安全', icon: <ShieldCheck size={22} /> },
            { to: '/more', label: 'その他', icon: <Ellipsis size={22} />, badge: unread },
          ]
      : [
          { to: '/', label: 'ホーム', icon: <House size={22} /> },
          { to: '/schedule', label: '予定', icon: <CalendarDays size={22} /> },
          { to: '/fees', label: '会費', icon: <Wallet size={22} /> },
          { to: '/news', label: 'お知らせ', icon: <Bell size={22} />, badge: unread },
          { to: '/more', label: 'マイページ', icon: <UserRound size={22} /> },
        ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="relative mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {(() => {
          const i = tabs.findIndex(t => (t.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(t.to)))
          return i < 0 ? null : <span aria-hidden className="absolute top-1.5 h-[48px] rounded-2xl bg-brand-50 transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]" style={{ width: `${100 / tabs.length}%`, transform: `translateX(${i * 100}%)` }} />
        })()}
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => cx('relative flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition', isActive ? 'text-brand' : 'text-ink-3')}>
            {({ isActive }) => (
              <>
                <span className={cx('transition-transform', isActive && '-translate-y-0.5 scale-110')}>{t.icon}</span>
                {t.label}
                {!!t.badge && <span className="absolute right-[22%] top-2 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] leading-[18px] text-white">{t.badge}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 pt-16">
      <Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" />
    </div>
  )
}

function Shell() {
  const loc = useLocation()
  return (
    <>
      <main key={loc.pathname} className="mx-auto min-h-[100dvh] max-w-lg animate-up px-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/players" element={<Players />} />
            <Route path="/player/:id" element={<PlayerDetail />} />
            <Route path="/fees" element={<Fees />} />
            <Route path="/news" element={<News />} />
            <Route path="/coaches" element={<Coaches />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/requests/:id" element={<Thread />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/report" element={<Report />} />
            <Route path="/safety" element={<Safety />} />
            <Route path="/more" element={<More />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/match" element={<Match />} />
            <Route path="/posts" element={<Posts />} />
            <Route path="/coach-profile" element={<CoachProfile />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/training" element={<Training />} />
            <Route path="/ops" element={<Ops />} />
            <Route path="/fee-requests" element={<FeeRequests />} />
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/safeguard" element={<Safeguard />} />
            <Route path="/consult" element={<Consult />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <Tabs />
    </>
  )
}

export default function App() {
  const { ready, authUser, profile, club, be, coachMode } = useApp()
  if (!ready) return <Loading />
  return (
    <HashRouter>
      {be.mode === 'demo' && authUser && (
        <div className="bg-amber-400 py-1 text-center text-[11px] font-bold text-navy">デモ表示中（架空のデータです）</div>
      )}
      {!authUser ? <Login /> : profile && coachMode && !profile.clubIds?.length ? <Shell /> : !profile || !profile.clubIds?.length || !club ? <OnboardingGate hasClub={!!profile?.clubIds?.length} /> : <Shell />}
    </HashRouter>
  )
}

function OnboardingGate({ hasClub }: { hasClub: boolean }) {
  const { be, switchMode } = useApp()
  const [slow, setSlow] = useState(false)
  useEffect(() => { if (!hasClub) return; const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t) }, [hasClub])
  if (!hasClub) return <Onboarding />
  if (!slow) return <Loading />
  return (
    <div className="mx-auto max-w-md px-6 pt-24 text-center">
      <p className="text-[18px] font-black">クラブの情報を読み込めません</p>
      <p className="mt-2 text-[14px] text-ink-2">通信状況をご確認ください。解決しない場合は、運営の方にお問い合わせください。</p>
      <div className="mt-6 space-y-2">
        <button onClick={() => location.reload()} className="h-12 w-full rounded-2xl bg-navy font-bold text-white">再読み込み</button>
        <button onClick={() => be.signOut()} className="h-12 w-full rounded-2xl border border-line bg-white font-bold">ログアウト</button>
        {be.mode === 'firebase' && <button onClick={() => switchMode('demo')} className="text-[13px] text-ink-2 underline">デモ表示に切り替える</button>}
      </div>
    </div>
  )
}
