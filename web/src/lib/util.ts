import type { Condition, Profile, Club } from './types'

export const DOW = ['日', '月', '火', '水', '木', '金', '土']
export const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const monthOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
export const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP')
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 864e5)

export function dateLabel(s: string) {
  const d = parseDate(s)
  const diff = daysBetween(today(), d)
  const base = `${d.getMonth() + 1}/${d.getDate()}（${DOW[d.getDay()]}）`
  if (diff === 0) return `今日 ${base}`
  if (diff === 1) return `明日 ${base}`
  return base
}
export function endTime(start: string, minutes: number) {
  const [h, m] = start.split(':').map(Number)
  const t = h * 60 + m + minutes
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`
}
export function relTime(at: number) {
  const s = (Date.now() - at) / 1000
  if (s < 60) return 'たった今'
  if (s < 3600) return `${Math.floor(s / 60)}分前`
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`
  return `${Math.floor(s / 86400)}日前`
}
export const uid6 = () => Math.random().toString(36).slice(2, 8)
export const inviteCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')

/* ---------- 暑さ指数（WBGT） ---------- */
/** 環境省 熱中症予防情報サイトで用いられる推定式。Ta[℃] RH[%] SR[kW/m2] WS[m/s] */
export const estWBGT = (Ta: number, RH: number, SR: number, WS: number) =>
  0.735 * Ta + 0.0374 * RH + 0.00292 * Ta * RH + 7.619 * SR - 4.557 * SR * SR - 0.0572 * WS - 4.064

export interface WbgtLevel { lv: 0 | 1 | 2 | 3 | 4; label: string; tone: 'ok' | 'info' | 'warn' | 'danger'; advice: string }
export function wbgtLevel(w: number): WbgtLevel {
  if (w >= 31) return { lv: 4, label: '運動は原則中止', tone: 'danger', advice: '特別な場合以外は運動を中止しましょう。' }
  if (w >= 28) return { lv: 3, label: '厳重警戒', tone: 'danger', advice: '激しい運動は避け、10〜20分おきに休憩と水分・塩分を。' }
  if (w >= 25) return { lv: 2, label: '警戒', tone: 'warn', advice: '積極的に休憩をとり、水分・塩分を補給しましょう。' }
  if (w >= 21) return { lv: 1, label: '注意', tone: 'info', advice: '運動の合間に水分・塩分を補給しましょう。' }
  return { lv: 0, label: 'ほぼ安全', tone: 'ok', advice: '通常どおり活動できます。こまめな水分補給を。' }
}

export interface WxHour { t: string; Ta: number; RH: number; SR: number; WS: number }
const wxCache: Record<string, { at: number; hours: WxHour[] }> = {}
async function fetchOnce(lat: number, lon: number, ms: number): Promise<WxHour[]> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FTokyo&forecast_days=7`
    const r = await fetch(u, { signal: ctl.signal })
    if (!r.ok) throw new Error('weather')
    const h = (await r.json()).hourly
    return h.time.map((t: string, i: number) => ({ t, Ta: h.temperature_2m[i], RH: h.relative_humidity_2m[i], SR: (h.shortwave_radiation[i] || 0) / 1000, WS: h.wind_speed_10m[i] }))
  } finally { clearTimeout(t) }
}
/** 太陽高度の正弦（UTC時刻・緯度経度から） */
function sinElev(d: Date, lat: number, lon: number) {
  const r = Math.PI / 180
  const doy = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5)
  const g = (2 * Math.PI / 365) * (doy - 1 + (d.getUTCHours() - 12) / 24)
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  const tst = d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon
  const ha = (tst / 4 - 180) * r
  return Math.sin(lat * r) * Math.sin(decl) + Math.cos(lat * r) * Math.cos(decl) * Math.cos(ha)
}
/** MET Norway（ノルウェー気象機関）の予報。日射量は雲量と太陽高度から推定（Haurwitz式＋Kasten-Czeplak式） */
async function fetchMetNo(lat: number, lon: number, ms: number): Promise<WxHour[]> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { signal: ctl.signal })
    if (!r.ok) throw new Error('metno')
    const j = await r.json()
    return j.properties.timeseries.map((x: { time: string; data: { instant: { details: Record<string, number> } } }) => {
      const d = new Date(x.time)
      const det = x.data.instant.details
      const jst = new Date(d.getTime() + 9 * 3600e3)
      const t = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}T${pad(jst.getUTCHours())}:00`
      const se = sinElev(new Date(d.getTime() + 30 * 60e3), lat, lon)
      const clear = se > 0.01 ? 1098 * se * Math.exp(-0.057 / se) : 0
      const cloud = (det.cloud_area_fraction ?? 50) / 100
      return { t, Ta: det.air_temperature, RH: det.relative_humidity, SR: (clear * (1 - 0.75 * Math.pow(cloud, 3.4))) / 1000, WS: det.wind_speed }
    })
  } finally { clearTimeout(t) }
}
/** 気象予報を取得。Open-Meteo を優先し、つながらない環境では MET Norway を使う。直近（6時間以内）に取得した予報も再利用する */
export async function fetchWeather(lat: number, lon: number): Promise<WxHour[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
  const mem = wxCache[key]
  if (mem && Date.now() - mem.at < 30 * 60e3) return mem.hours
  let stored: { at: number; hours: WxHour[] } | null = null
  try { stored = JSON.parse(localStorage.getItem('mcmt_wx_' + key) || 'null') } catch { /* noop */ }
  const metno = fetchMetNo(lat, lon, 12000).catch(() => null)
  let hours: WxHour[] | null = await fetchOnce(lat, lon, 6000).catch(() => null)
  if (!hours) hours = await metno
  if (hours?.length) {
    wxCache[key] = { at: Date.now(), hours }
    try { localStorage.setItem('mcmt_wx_' + key, JSON.stringify(wxCache[key])) } catch { /* noop */ }
    return hours
  }
  if (stored && Date.now() - stored.at < 6 * 3600e3) return stored.hours
  throw new Error('weather')
}
/** 活動時間帯の最高WBGT（屋内は日射・風を0として推定） */
export function wbgtFor(hours: WxHour[], date: string, start: string, minutes: number, indoor: boolean) {
  const h0 = parseInt(start)
  const h1 = h0 + Math.max(1, Math.ceil(minutes / 60))
  const xs = hours.filter(h => h.t.startsWith(date) && +h.t.slice(11, 13) >= h0 && +h.t.slice(11, 13) < h1)
  if (!xs.length) return null
  const ws = xs.map(h => (indoor ? estWBGT(h.Ta, h.RH, 0, 0) : estWBGT(h.Ta, h.RH, h.SR, h.WS)))
  return { max: Math.round(Math.max(...ws) * 10) / 10, temp: Math.round(Math.max(...xs.map(h => h.Ta))) }
}

/* ---------- 練習負荷（RPE×分）と負荷比 ---------- */
export function loadStatus(conds: Condition[], playerId: string) {
  const t = today().getTime()
  const mine = conds.filter(c => c.playerId === playerId)
  const age = (c: Condition) => (t - parseDate(c.date).getTime()) / 864e5
  const sum = (a: number, b: number) => mine.filter(c => age(c) >= a && age(c) < b).reduce((s, c) => s + c.rpe * c.minutes, 0)
  const acute = sum(0, 7)
  const chronic = sum(0, 28) / 4
  const last = mine.filter(c => age(c) < 7)
  const sleep = last.length ? last.reduce((s, c) => s + c.sleep, 0) / last.length : null
  const ratio = chronic ? acute / chronic : 0
  const weeks = [3, 2, 1, 0].map(k => sum(k * 7, k * 7 + 7))
  let tone: 'ok' | 'warn' | 'danger' | 'none' = 'ok'
  let label = '良好'
  if (!acute) { tone = 'none'; label = '記録なし' }
  else if (ratio > 1.5 || (sleep !== null && sleep < 6)) { tone = 'danger'; label = '要注意' }
  else if (ratio > 1.3) { tone = 'warn'; label = '負荷が増加' }
  return { acute, chronic, ratio, sleep, weeks, tone, label }
}

/* ---------- 指導者マッチ度 ---------- */
export function km(a: number, b: number, c: number, d: number) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
export function matchScore(p: Profile, club: Club, clubDays: number[]) {
  const dist = p.lat != null && p.lon != null ? km(club.lat, club.lon, p.lat, p.lon) : 10
  const overlap = clubDays.length ? clubDays.filter(d => (p.days || []).includes(d)).length / clubDays.length : 0
  const reasons: string[] = []
  let s = 0
  s += Math.max(0, 1 - dist / 12) * 25; reasons.push(`${dist.toFixed(1)}km`)
  s += overlap * 25; if (overlap === 1) reasons.push('活動日すべてOK'); else if (overlap > 0) reasons.push('一部の活動日OK')
  if (p.license) { s += /JSPO|JFA|公認/.test(p.license) ? 15 : 10; reasons.push(p.license) }
  if (p.verified === 'approved') s += 10
  if (p.training) s += 10
  s += ((p.ratingAvg || 4) - 4) * 10 + Math.min(p.lessonCount || 0, 150) / 150 * 5
  return { score: Math.max(0, Math.min(100, Math.round(s))), dist, reasons, ready: p.verified === 'approved' && !!p.training }
}

export function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = name
  a.click()
}
