/* MyCOACH-MyTEAM 紹介ページの動き（外部ファイルにしてCSPで不正なスクリプトを防ぐ） */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ヘッダー：スクロールしたら背景を付ける／スマホ下部の申込ボタンを出す
  const hd = $('#hd'), mcta = $('#mcta'), hero = $('.hero')
  const onScroll = () => {
    hd.classList.toggle('solid', scrollY > 20)
    mcta.classList.toggle('on', scrollY > hero.offsetHeight - 200 && innerHeight + scrollY < document.body.scrollHeight - 300)
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll()

  // スクロールに合わせてふわっと表示
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return
    const sibs = $$('.rv', e.target.parentElement), i = Math.max(0, sibs.indexOf(e.target))
    setTimeout(() => e.target.classList.add('in'), reduce ? 0 : Math.min(i, 5) * 90)
    io.unobserve(e.target)
  }), { rootMargin: '0px 0px -8% 0px' })
  $$('.rv').forEach(el => io.observe(el))

  // ヒーローの通知チップを順番に表示
  $$('.chip').forEach((c, i) => setTimeout(() => c.classList.add('on'), reduce ? 0 : 700 + i * 650))

  // 数字のカウントアップ
  const count = el => {
    const to = +el.dataset.count, plain = el.dataset.plain, t0 = performance.now(), dur = 1400
    const step = t => { const k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)))
      el.textContent = plain ? String(v) : v.toLocaleString('ja-JP'); if (k < 1) requestAnimationFrame(step) }
    reduce ? (el.textContent = plain ? String(to) : to.toLocaleString('ja-JP')) : requestAnimationFrame(step)
  }
  $$('[data-count]').forEach(el => count(el))

  // 暑さ指数のメーター（指針の5段階を等間隔で表示）
  const g = $('#gauge')
  if (g) new IntersectionObserver((es, o) => es.forEach(e => {
    if (!e.isIntersecting) return
    o.disconnect()
    const b = $('[data-wbgt]', g), v = +b.dataset.wbgt
    const edges = [15, 21, 25, 28, 31, 35], seg = edges.findIndex((x, i) => v < edges[i + 1])
    const pos = (seg + (v - edges[seg]) / (edges[seg + 1] - edges[seg])) * 20
    setTimeout(() => { $('#needle').style.left = `calc(${pos}% - 2px)` }, 200)
    const t0 = performance.now()
    const step = t => { const k = Math.min(1, (t - t0) / 1600); b.textContent = (v * (1 - Math.pow(1 - k, 3))).toFixed(1); if (k < 1) requestAnimationFrame(step) }
    reduce ? (b.textContent = v.toFixed(1)) : requestAnimationFrame(step)
  }), { threshold: .4 }).observe(g)

  // 立場ごとのタブ
  const tabs = $$('.tab'), roles = $$('.role')
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)))
    roles.forEach(r => { const on = r.dataset.r === t.dataset.t; r.hidden = !on; if (on) { r.classList.remove('fade-in'); void r.offsetWidth; r.classList.add('fade-in') } })
  }))

  // お問い合わせ：サーバー（Cloud Functions）へ送信。入力値はサーバー側でも検証する
  const f = $('#contactForm'), msg = $('#formMsg'), btn = $('#sendBtn')
  const show = (ok, text) => { msg.className = 'msg ' + (ok ? 'ok' : 'ng'); msg.textContent = text }
  f.addEventListener('submit', async e => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(f))
    if (d.website) return // 自動送信プログラム対策（人には見えない欄）
    if (!d.name.trim() || !d.org.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { show(false, 'お名前・団体名・メールアドレスを入力してください'); return }
    btn.disabled = true; btn.textContent = '送信しています…'
    try {
      const r = await fetch('https://asia-northeast1-mycoach-c15ae.cloudfunctions.net/submitInquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d.name, org: d.org, email: d.email, role: d.role, msg: d.msg }) })
      if (!r.ok) throw new Error()
      f.reset(); show(true, 'ありがとうございます。ご相談内容を受け付けました。担当からご連絡します。')
    } catch { show(false, '送信できませんでした。時間をおいてもう一度お試しください。') }
    btn.disabled = false; btn.textContent = '相談内容を送る'
  })
})()
