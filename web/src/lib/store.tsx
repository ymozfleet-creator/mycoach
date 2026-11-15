import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Backend } from './backend'
import { demoBackend } from './demoBackend'
import type { Announcement, Club, ClubEvent, Condition, Contract, Fee, Incident, Notice, Player, Profile } from './types'
import { addDays, fetchWeather, iso, monthOf, today, type WxHour } from './util'

const MODE_KEY = 'mcmt_mode'
export function getMode(): 'firebase' | 'demo' { try { return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'firebase' } catch { return 'firebase' } }
export function setMode(m: 'firebase' | 'demo') { try { localStorage.setItem(MODE_KEY, m) } catch { /* noop */ } }

interface Ctx {
  be: Backend
  ready: boolean
  authUser: { uid: string; email?: string | null; displayName?: string | null } | null
  profile: Profile | null
  club: Club | null
  players: Player[]
  events: ClubEvent[]
  announcements: Announcement[]
  conditions: Condition[]
  fees: Fee[]
  incidents: Incident[]
  contracts: Contract[]
  notices: Notice[]
  weather: WxHour[] | null
  weatherError: boolean
  isAdmin: boolean
  isCoach: boolean
  isSchool: boolean
  myPlayers: Player[]
  month: string
  toast: (msg: string) => void
  switchMode: (m: 'firebase' | 'demo') => void
  selectClub: (id: string) => void
}
const C = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(C)

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState(getMode())
  const [be, setBe] = useState<Backend>(() => demoBackend)
  const [beReady, setBeReady] = useState(false)
  useEffect(() => {
    let alive = true
    if (mode === 'demo') { setBe(demoBackend); setBeReady(true) }
    else import('./fireBackend').then(m => { if (alive) { setBe(m.fireBackend); setBeReady(true) } })
    return () => { alive = false }
  }, [mode])

  const [authUser, setAuthUser] = useState<Ctx['authUser']>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [club, setClub] = useState<Club | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [announcements, setAnn] = useState<Announcement[]>([])
  const [conditions, setConds] = useState<Condition[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [incidents, setInc] = useState<Incident[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [weather, setWeather] = useState<WxHour[] | null>(null)
  const [weatherError, setWeatherError] = useState(false)
  const month = monthOf(today())

  useEffect(() => {
    if (!beReady) return
    setAuthReady(false)
    return be.onAuth(u => { setAuthUser(u); setAuthReady(true) })
  }, [be, beReady])

  useEffect(() => {
    if (!authUser) { setProfile(null); setProfileReady(true); return }
    setProfileReady(false)
    const u1 = be.watchProfile(authUser.uid, p => { setProfile(p); setProfileReady(true) })
    const u2 = be.watchContracts(authUser.uid, setContracts)
    const u3 = be.watchNotices(authUser.uid, setNotices)
    return () => { u1(); u2(); u3() }
  }, [be, authUser?.uid])

  const [picked, setPicked] = useState<string | null>(() => { try { return localStorage.getItem('mcmt_club') } catch { return null } })
  const clubId = profile?.clubIds?.includes(picked || '') ? picked! : profile?.clubIds?.[0]
  const selectClub = useCallback((id: string) => { try { localStorage.setItem('mcmt_club', id) } catch { /* noop */ } setPicked(id) }, [])
  const isAdmin = !!(club && authUser && club.adminUids.includes(authUser.uid))
  const isCoach = !!(club && authUser && club.coachUids.includes(authUser.uid))
  const isSchool = !!(club && authUser && (club.schoolUids || []).includes(authUser.uid))

  useEffect(() => {
    if (!clubId) { setClub(null); return }
    const from = iso(addDays(today(), -60))
    const us = [
      be.watchClub(clubId, setClub),
      be.watchEvents(clubId, from, setEvents),
      be.watchAnnouncements(clubId, setAnn),
    ]
    return () => us.forEach(u => u())
  }, [be, clubId])

  // 運営・指導者は全員分、保護者は自分の家庭の分だけ読む
  const staff = isAdmin || isCoach || isSchool
  useEffect(() => {
    if (!clubId || !authUser || !club) return
    const me = staff ? null : authUser.uid
    const us = [
      be.watchPlayers(clubId, me, setPlayers),
      be.watchConditions(clubId, iso(addDays(today(), -35)), isSchool && !isAdmin && !isCoach ? '__none__' : me, setConds),
      ...(staff ? [be.watchIncidents(clubId, setInc)] : []),
    ]
    return () => us.forEach(u => u())
  }, [be, clubId, authUser?.uid, staff, !!club])

  useEffect(() => {
    if (!clubId || !authUser) return
    return be.watchFees(clubId, month, authUser.uid, isAdmin, setFees)
  }, [be, clubId, authUser?.uid, isAdmin, month])

  useEffect(() => {
    if (!club) return
    let alive = true
    const load = () => fetchWeather(club.lat, club.lon).then(h => alive && (setWeather(h), setWeatherError(false))).catch(() => alive && setWeatherError(true))
    load()
    const t = setInterval(load, 10 * 60e3) // 10分ごとに更新（取得に失敗したときの再試行も兼ねる）
    return () => { alive = false; clearInterval(t) }
  }, [club?.lat, club?.lon])

  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number>()
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); t.current = window.setTimeout(() => setMsg(null), 2600) }, [])
  const switchMode = useCallback((m: 'firebase' | 'demo') => { setMode(m); setBeReady(false); setModeState(m) }, [])

  const myPlayers = useMemo(() => (authUser ? players.filter(p => p.guardianUids.includes(authUser.uid)) : []), [players, authUser?.uid])

  const value: Ctx = {
    be, ready: beReady && authReady && profileReady, authUser, profile, club, players, events, announcements, conditions, fees, incidents,
    contracts, notices, weather, weatherError, isAdmin, isCoach, isSchool, myPlayers, month, toast, switchMode, selectClub,
  }
  return (
    <C.Provider value={value}>
      {children}
      <div aria-live="polite" className={`pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 transition-all duration-300 ${msg ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        {msg && <div className="rounded-2xl bg-navy px-4 py-3 text-sm font-medium text-white shadow-pop">{msg}</div>}
      </div>
    </C.Provider>
  )
}
