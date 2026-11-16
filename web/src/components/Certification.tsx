import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronRight, CircleAlert, CircleX, Printer } from 'lucide-react'
import { useApp } from '../lib/store'
import { useProfiles } from './EventEditor'
import { Button, Card, Ring, cx, stagger } from './ui'
import { guidelineWeeks, iso, today } from '../lib/util'

type St = 'ok' | 'warn' | 'ng'
interface Item { k: string; title: string; st: St; detail: string; to?: string; act?: string }

/**
 * 認定地域クラブ活動の主な確認事項を、アプリの記録から目安としてチェックする。
 * 認定の要件・確認方法は市町村が要綱で定めるため、最終判断は市町村が行う。
 */
export function Certification() {
  const { club, events, players, incidents } = useApp()
  const nav = useNavigate()
  const coaches = useProfiles(club?.coachUids || [])
  const items: Item[] = useMemo(() => {
    if (!club) return []
    const weeks = guidelineWeeks(events, 4).filter(w => w.days > 0)
    const over = weeks.filter(w => !w.ok)
    const cs = (club.coachUids || []).map(u => coaches[u]).filter(Boolean)
    const ready = cs.filter(c => c.verified === 'approved' && c.training)
    const lic = cs.filter(c => c.licenseVerified || c.license)
    const insured = players.filter(p => p.insured).length
    const insValid = !!club.insurance && club.insurance.until >= iso(today())
    const guardians = players.filter(p => p.guardianUids.length).length
    const past4w = events.filter(e => e.status !== 'canceled' && e.date < iso(today())).length
    return [
      { k: 'time', title: '活動時間と休養日（国のガイドライン）', st: !weeks.length ? 'warn' : over.length ? 'warn' : 'ok', detail: !weeks.length ? '直近4週の活動の記録がありません' : over.length ? `直近4週のうち${over.length}週で、休養日（週2日以上）や活動時間の目安を超えています` : '直近4週はすべて目安の範囲内です', to: '/', act: '週ごとの状況を見る' },
      { k: 'coach', title: '指導者の確保', st: cs.length ? 'ok' : 'ng', detail: cs.length ? `指導者 ${cs.length}人` : '指導者が登録されていません', to: '/match', act: '指導者を探す' },
      { k: 'safe', title: '指導者の本人確認・安全研修', st: !cs.length ? 'ng' : ready.length === cs.length ? 'ok' : 'warn', detail: !cs.length ? '指導者がいません' : `${cs.length}人中 ${ready.length}人が本人確認と安全研修を修了` },
      { k: 'lic', title: '指導者の資格', st: lic.length ? 'ok' : 'warn', detail: lic.length ? `資格のある指導者 ${lic.length}人（うち事務局が証明書を確認：${cs.filter(c => c.licenseVerified).length}人）` : '資格を登録している指導者がいません（JSPO公認スポーツ指導者など）' },
      { k: 'ins', title: '保険への加入', st: insValid && insured === players.length && players.length ? 'ok' : insValid || insured ? 'warn' : 'ng', detail: `${club.insurance ? `${club.insurance.name}（${club.insurance.until}まで）${insValid ? '' : '・期限切れ'}` : 'クラブの保険が未登録'}／会員 ${players.length}人中 ${insured}人が加入済み`, to: '/players', act: '会員ごとに登録する' },
      { k: 'fee', title: '会費と、困窮世帯への配慮', st: club.fee >= 0 ? 'ok' : 'warn', detail: `月会費 ${club.fee.toLocaleString()}円・減免を設定している会員 ${players.filter(p => p.discount > 0).length}人` },
      { k: 'contact', title: '保護者との連絡体制', st: !players.length ? 'warn' : guardians / players.length >= 0.8 ? 'ok' : 'warn', detail: `会員 ${players.length}人中 ${guardians}人の保護者がアプリに登録済み`, to: '/players', act: '招待コードを送る' },
      { k: 'risk', title: '安全管理（暑さ・ケガの記録）', st: 'ok', detail: `予定ごとに暑さ指数を表示・ケガやヒヤリハットの記録 ${incidents.length}件`, to: '/safety', act: '記録を見る' },
      { k: 'rec', title: '活動の記録と報告', st: past4w ? 'ok' : 'warn', detail: past4w ? `活動の記録 ${past4w}回・月ごとの実績報告を出力できます` : '活動の記録がまだありません' },
    ] as Item[]
  }, [club, events, players, incidents, coaches])
  if (!club) return null
  const ok = items.filter(i => i.st === 'ok').length
  const icon = (s: St) => s === 'ok' ? <CheckCircle2 size={20} className="text-emerald-500" /> : s === 'warn' ? <CircleAlert size={20} className="text-amber-500" /> : <CircleX size={20} className="text-red-500" />
  return (
    <>
      <Card className="flex items-center gap-4">
        <Ring value={(ok / items.length) * 100} size={64} stroke={7}><span className="text-[15px] font-black">{ok}/{items.length}</span></Ring>
        <div className="flex-1"><div className="font-black">認定地域クラブ活動の主な確認事項</div><div className="text-[12px] text-ink-2">アプリの記録から、満たしている項目を自動で確認します</div></div>
      </Card>
      <div className="mt-3 space-y-2">
        {items.map((it, i) => (
          <Card key={it.k} style={stagger(i)} className={cx('animate-up !p-3.5', it.st === 'ng' && 'ring-1 ring-red-200')}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5">{icon(it.st)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{it.title}</div>
                <div className="text-[12px] text-ink-2">{it.detail}</div>
                {it.to && it.st !== 'ok' && <button onClick={() => nav(it.to!)} className="mt-1 flex items-center gap-0.5 text-[12px] font-bold text-brand">{it.act}<ChevronRight size={14} /></button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-3">国のガイドライン（令和7年12月）にもとづく地域クラブ活動の認定は、市町村等が要綱を定めて行います。要件や提出書類は市町村ごとに異なるため、この画面は申請前の確認の目安としてお使いください。</p>
      <Button block variant="soft" className="mt-3" onClick={() => print()}><Printer size={18} />この確認結果を印刷する</Button>
    </>
  )
}
