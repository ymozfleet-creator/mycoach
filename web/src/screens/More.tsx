import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Building2, ChevronRight, ClipboardList, CreditCard, GraduationCap, Handshake, IdCard, LogOut, Megaphone, Plus, Search, ShieldCheck, Smartphone, Sparkles, UserCheck, UserRound, Users } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, Field, inputCls, PageHeader, Section, Sheet, cx } from '../components/ui'
import { InviteCard } from './Players'
import { DOW, uid6 } from '../lib/util'

function Item({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3.5 text-left active:opacity-60">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand">{icon}</span>
      <span className="flex-1 text-[15px] font-bold">{label}</span>
      {badge}
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  )
}

export default function More() {
  const { be, profile, club, isAdmin, isCoach, isSchool, coachMode, isOps, notices, myPlayers, authUser, toast, switchMode, selectClub } = useApp()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<'' | 'club' | 'coach' | 'kids' | 'name' | 'join'>('')
  const [code, setCode] = useState('')
  const [joinErr, setJoinErr] = useState('')
  const [clubForm, setClubForm] = useState({ name: club?.name || '', fee: club?.fee || 0, venue: '', indoor: true })
  const [kid, setKid] = useState({ name: '', grade: '中学1年' })
  const [name, setName] = useState(profile?.name || '')
  if (!profile || !authUser || (!club && !coachMode)) return null
  const unread = notices.filter(n => !n.read).length
  const roleLabel = isAdmin ? 'クラブの運営' : isCoach || coachMode ? '指導者' : isSchool ? `学校・教育委員会${profile.org ? `（${profile.org}）` : ''}` : '保護者・生徒'
  return (
    <>
      <PageHeader title={isAdmin ? 'その他' : 'マイページ'} />
      <Card className="flex items-center gap-4">
        <Avatar name={profile.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-black">{profile.name}</div>
          <div className="text-[13px] text-ink-2">{roleLabel}{club ? `・${club.name}` : '（クラブ未所属）'}</div>
          {coachMode && <div className="mt-1"><Badge tone={profile.verified === 'approved' ? 'ok' : profile.verified === 'pending' ? 'warn' : 'none'}>{profile.verified === 'approved' ? '審査済み' : profile.verified === 'pending' ? '審査中' : '審査未申請'}</Badge></div>}
        </div>
        <button onClick={() => (coachMode ? nav('/coach-profile') : setSheet('name'))} className="text-[13px] font-bold text-brand">編集</button>
      </Card>

      {isAdmin && <div className="mt-3"><InviteCard /></div>}

      <Section title="メニュー">
        <Card className="divide-y divide-line !py-0">
          <Item icon={<Bell size={18} />} label="お知らせ・通知" onClick={() => nav('/news')} badge={unread ? <Badge tone="danger">{unread}</Badge> : undefined} />
          {isOps && <Item icon={<UserCheck size={18} />} label="運営事務局：本人確認の審査" onClick={() => nav('/ops')} />}
          {(isAdmin || coachMode) && <Item icon={<Handshake size={18} />} label={isAdmin ? '指導者マッチング（スワイプ・やりとり）' : 'マッチング（募集を探す・やりとり）'} onClick={() => nav('/match')} />}
          {isAdmin && <Item icon={<Megaphone size={18} />} label="指導者の募集を出す・管理する" onClick={() => nav('/posts')} />}
          {(isAdmin || isSchool) && <Item icon={<ClipboardList size={18} />} label="実績報告（自治体・学校向け）" onClick={() => nav('/report')} />}
          {isCoach && <Item icon={<Sparkles size={18} />} label="練習メニューを作る" onClick={() => nav('/menu')} />}
          {(isAdmin || isCoach || isSchool) && <Item icon={<ShieldCheck size={18} />} label="ケガ・ヒヤリハットの記録" onClick={() => nav('/safety')} />}
          {coachMode && <Item icon={<UserRound size={18} />} label="指導者プロフィール" onClick={() => nav('/coach-profile')} />}
          {coachMode && <Item icon={<IdCard size={18} />} label="本人確認" onClick={() => nav('/verify')} badge={<Badge tone={profile.verified === 'approved' ? 'ok' : profile.verified === 'pending' ? 'warn' : 'none'}>{profile.verified === 'approved' ? '完了' : profile.verified === 'pending' ? '確認中' : '未提出'}</Badge>} />}
          {coachMode && <Item icon={<GraduationCap size={18} />} label="安全研修" onClick={() => nav('/training')} badge={<Badge tone={profile.training ? 'ok' : 'none'}>{profile.training ? '修了' : '未受講'}</Badge>} />}
          {coachMode && <Item icon={<CreditCard size={18} />} label="謝金の受取口座" onClick={() => nav('/coach-profile#payout')} badge={<Badge tone={profile.stripeChargesEnabled ? 'ok' : 'none'}>{profile.stripeChargesEnabled ? '設定済み' : '未設定'}</Badge>} />}
          {club && !isAdmin && !isCoach && !isSchool && !coachMode && <Item icon={<Users size={18} />} label={`お子さまの登録（${myPlayers.length}人）`} onClick={() => setSheet('kids')} />}
          {isAdmin && <Item icon={<Building2 size={18} />} label="クラブの設定" onClick={() => setSheet('club')} />}
        </Card>
      </Section>

      {profile.clubIds.length > 1 && (
        <Section title="クラブの切り替え">
          <Card className="divide-y divide-line !py-0">
            {profile.clubIds.map(id => <button key={id} onClick={() => { selectClub(id); toast('クラブを切り替えました') }} className={cx('flex w-full items-center justify-between py-3.5 text-left text-[15px] font-bold', id === club?.id && 'text-brand')}>{id === club?.id ? club.name : `別のクラブ（${id.slice(0, 6)}）`}{id === club?.id && <Badge tone="info">表示中</Badge>}</button>)}
          </Card>
        </Section>
      )}

      <Section title="アプリ">
        <Card className="divide-y divide-line !py-0">
          <Item icon={<Smartphone size={18} />} label="ホーム画面に追加する方法" onClick={() => toast('iPhone：共有ボタン→「ホーム画面に追加」／Android：メニュー→「アプリをインストール」')} />
          <Item icon={<Plus size={18} />} label="ほかのクラブに参加する" onClick={() => { setJoinErr(''); setSheet('join') }} />
        </Card>
      </Section>

      <div className="mt-6 space-y-2">
        {be.mode === 'demo' ? (
          <Button block variant="ghost" onClick={async () => { await be.signOut(); switchMode('firebase') }}><LogOut size={18} />デモを終了する</Button>
        ) : (
          <Button block variant="ghost" onClick={() => be.signOut()}><LogOut size={18} />ログアウト</Button>
        )}
        <a href="../mycoach-app.html" className="block py-2 text-center text-[12px] text-ink-3 underline">個人レッスンのマッチング（旧MyCOACH）はこちら</a>
      </div>

      <Sheet open={sheet === 'join'} onClose={() => setSheet('')} title="ほかのクラブに参加" footer={<Button block size="lg" disabled={code.length < 4} onClick={async () => {
        try { const id = await be.joinClub(code, authUser.uid); selectClub(id); setSheet(''); setCode(''); toast('参加しました') } catch (e) { setJoinErr((e as Error).message) }
      }}>参加する</Button>}>
        <Field label="招待コード"><input className={cx(inputCls, 'text-center text-[22px] font-black uppercase tracking-[.3em]')} maxLength={10} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></Field>
        {joinErr && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{joinErr}</p>}
      </Sheet>

      <Sheet open={sheet === 'name'} onClose={() => setSheet('')} title="お名前の変更" footer={<Button block size="lg" onClick={async () => { await be.saveProfile({ uid: authUser.uid, name: name.trim() }); setSheet(''); toast('変更しました') }} disabled={!name.trim()}>保存する</Button>}>
        <Field label="お名前"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
      </Sheet>

      <Sheet open={sheet === 'kids'} onClose={() => setSheet('')} title="お子さまの登録" footer={<Button block size="lg" disabled={!kid.name.trim() || !club} onClick={async () => { if (!club) return; await be.savePlayer(club.id, { id: 'p' + uid6(), name: kid.name.trim(), grade: kid.grade, guardianUids: [authUser.uid], discount: 0 }); setKid({ name: '', grade: kid.grade }); toast('登録しました') }}>追加する</Button>}>
        {myPlayers.map(p => <div key={p.id} className="flex items-center gap-3 border-b border-line py-2.5"><Avatar name={p.name} size={34} /><div className="flex-1 font-bold">{p.name}</div><span className="text-[13px] text-ink-2">{p.grade}</span></div>)}
        <div className="mt-4 grid grid-cols-[1fr_8rem] gap-2">
          <input className={inputCls} placeholder="氏名" value={kid.name} onChange={e => setKid({ ...kid, name: e.target.value })} />
          <select className={inputCls} value={kid.grade} onChange={e => setKid({ ...kid, grade: e.target.value })}>{['小学5年', '小学6年', '中学1年', '中学2年', '中学3年', '高校1年', '高校2年', '高校3年'].map(g => <option key={g}>{g}</option>)}</select>
        </div>
      </Sheet>

      {club && (
      <Sheet open={sheet === 'club'} onClose={() => setSheet('')} title="クラブの設定" footer={<Button block size="lg" onClick={async () => {
        const venues = clubForm.venue.trim() ? [...club.venues, { name: clubForm.venue.trim(), indoor: clubForm.indoor }] : club.venues
        await be.updateClub(club.id, { name: clubForm.name.trim() || club.name, fee: Number(clubForm.fee), venues }); setSheet(''); toast('保存しました')
      }}>保存する</Button>}>
        <Field label="クラブ名"><input className={inputCls} value={clubForm.name} onChange={e => setClubForm({ ...clubForm, name: e.target.value })} /></Field>
        <Field label="月会費（円）" hint="変更は次の請求から反映されます"><input type="number" className={inputCls} value={clubForm.fee} onChange={e => setClubForm({ ...clubForm, fee: Number(e.target.value) })} /></Field>
        <Field label="活動場所">{club.venues.map(v => <div key={v.name} className="mb-1 text-[14px]">・{v.name}（{v.indoor ? '屋内' : '屋外'}）</div>)}</Field>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <input className={inputCls} placeholder="場所を追加" value={clubForm.venue} onChange={e => setClubForm({ ...clubForm, venue: e.target.value })} />
          <select className={inputCls} value={clubForm.indoor ? '1' : '0'} onChange={e => setClubForm({ ...clubForm, indoor: e.target.value === '1' })}><option value="1">屋内</option><option value="0">屋外</option></select>
        </div>
      </Sheet>
      )}
    </>
  )
}
