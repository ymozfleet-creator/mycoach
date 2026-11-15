import { useEffect, useState } from 'react'
import { Bell, Megaphone, PenLine } from 'lucide-react'
import { useApp } from '../lib/store'
import { Badge, Card, Empty, PageHeader, Segmented, cx } from '../components/ui'
import { ComposeSheet } from '../components/sheets'
import { relTime } from '../lib/util'

export default function News() {
  const { be, announcements, notices, isAdmin } = useApp()
  const [tab, setTab] = useState<'club' | 'me'>('club')
  const [compose, setCompose] = useState(false)
  const unread = notices.filter(n => !n.read)
  useEffect(() => { if (tab === 'me' && unread.length) { const t = setTimeout(() => unread.forEach(n => be.markRead(n.id)), 1200); return () => clearTimeout(t) } }, [tab, unread.length])
  return (
    <>
      <PageHeader title="お知らせ" right={isAdmin && <button onClick={() => setCompose(true)} aria-label="お知らせを書く" className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white"><PenLine size={18} /></button>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'club', label: 'クラブから' }, { value: 'me', label: `あなた宛て${unread.length ? `（${unread.length}）` : ''}` }]} />
      <div className="mt-3 space-y-2">
        {tab === 'club' ? (
          announcements.length ? announcements.map(a => (
            <Card key={a.id} className={cx(a.kind === 'urgent' && 'border-l-4 border-red-500')}>
              {a.kind === 'urgent' && <Badge tone="danger" className="mb-2">重要</Badge>}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.text}</p>
              <p className="mt-2 text-[12px] text-ink-3">{a.byName}・{relTime(a.at)}</p>
            </Card>
          )) : <Empty icon={<Megaphone />} title="お知らせはまだありません" />
        ) : (
          notices.length ? notices.map(n => (
            <Card key={n.id} className="flex gap-3">
              <div className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} />
              <div className="min-w-0 flex-1"><p className="text-[14px] leading-relaxed">{n.text}</p><p className="mt-1 text-[12px] text-ink-3">{relTime(n.at)}</p></div>
            </Card>
          )) : <Empty icon={<Bell />} title="通知はありません" />
        )}
      </div>
      <ComposeSheet open={compose} onClose={() => setCompose(false)} />
    </>
  )
}
