import { FUNCTIONS_BASE } from './config'
import { wbgtLevel } from './util'

export interface MenuInput { sport: string; goal: string; minutes: number; players: number; wbgt: number | null; level: string; note: string }
export interface MenuBlock { from: number; to: number; title: string; detail: string; caution?: string }
export interface MenuResult { blocks: MenuBlock[]; points: string[]; source: 'ai' | 'template' }

/** 生成AI（Cloud Functions 経由で Claude）で作成。使えないときは標準テンプレートで作成 */
export async function makeMenu(input: MenuInput, mode: 'firebase' | 'demo'): Promise<MenuResult> {
  if (mode === 'firebase') {
    try {
      const { auth } = await import('./firebase')
      const token = await auth.currentUser?.getIdToken()
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 25000)
      const r = await fetch(`${FUNCTIONS_BASE}/aiAssist`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'menu', input }) })
      clearTimeout(t)
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.blocks) && j.blocks.length) return { blocks: j.blocks, points: j.points || [], source: 'ai' } }
    } catch { /* フォールバック */ }
  }
  return template(input)
}

const LIB: Record<string, string[][]> = {
  基礎技術: [['ハンドリング', 'その場と移動で、左右両手を同じ回数ずつ'], ['対面パス', '2人組で距離を変えながら。声を出してから投げる'], ['ドリブルからのシュート', 'コーンを使い、利き手と逆の手でも'], ['少人数のゲーム', '3対2・2対1で判断を伴う練習']],
  シュート: [['フォームづくり', 'ゴール下で肘と手首の形を確認'], ['5か所シュート', '1か所5本、成功数を記録'], ['パスからのシュート', '受けてから素早く打つ'], ['競争形式', 'チーム対抗で集中して打つ']],
  守備: [['フットワーク', '腰を落とした横移動・後ろ下がり'], ['1対1', 'ボールを持つ相手への守り方'], ['助け合いの守備', '味方が抜かれたときの位置どり'], ['3対3', '守りの約束事を試合形式で確認']],
  試合形式: [['速攻の練習', '3対2・2対1を連続で'], ['攻めの形の確認', 'セットプレーを2〜3種類'], ['5対5', '時間を区切って交代しながら'], ['振り返り', '良かった点と次の課題を全員で共有']],
  体力づくり: [['動的ストレッチ', '関節を大きく動かす'], ['ラダー・敏しょう性', '短い距離を正確に速く'], ['シャトルラン', '距離は学年に合わせて調整'], ['体幹トレーニング', '30秒×3セットから']],
}
function template(i: MenuInput): MenuResult {
  const key = Object.keys(LIB).find(k => i.goal.includes(k)) || '基礎技術'
  const lv = i.wbgt != null ? wbgtLevel(i.wbgt).lv : 0
  const brk = lv >= 3 ? 15 : lv >= 2 ? 30 : 45
  const warm = 15, cool = 10
  let t = 0
  const blocks: MenuBlock[] = []
  const push = (m: number, title: string, detail: string, caution?: string) => { blocks.push({ from: t, to: t + m, title, detail, caution }); t += m }
  push(warm, 'ウォームアップ', 'ジョグ、動的ストレッチ、軽いボール運動')
  const drills = LIB[key]
  let main = i.minutes - warm - cool
  const nBreak = Math.max(0, Math.floor(main / brk) - 1)
  const bm = lv >= 3 ? 5 : 3
  main -= nBreak * bm
  const per = Math.max(10, Math.floor(main / drills.length))
  drills.forEach(([a, b], k) => {
    const hard = lv >= 3 && /1対1|シャトル|速攻|5対5|3対3/.test(a)
    push(per, a, b, hard ? '暑さのため強度を下げ、時間を短めに' : undefined)
    if (k < nBreak) push(bm, '休憩', '日陰で水分・塩分を補給')
  })
  push(Math.max(5, i.minutes - t), 'クールダウン', 'ストレッチ、振り返り、アプリで体調を記録')
  const points = [
    i.players > 16 ? `${Math.ceil(i.players / 8)}グループ（8人前後）に分けて回すと待ち時間が減ります` : i.players > 8 ? '2グループに分けて回すと待ち時間が減ります' : '少人数なので、1人あたりの回数を多めにとれます',
    lv >= 3 ? '暑さ指数が「厳重警戒」以上です。激しい運動は避け、約15分おきに休憩を入れています' : lv >= 2 ? '暑さ指数が「警戒」です。約30分おきに休憩を入れています' : '体調の変化に気をつけ、こまめに水分補給を',
  ]
  return { blocks, points, source: 'template' }
}
