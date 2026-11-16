/**
 * 写真をアプリ内で縮小してJPEGに変換する。
 * いったんcanvasに描き直すので、撮影場所（GPS）などのメタデータは取り除かれる。
 */
export async function shrinkImage(file: File, opt: { max: number; maxLen: number; square?: boolean }): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('写真（JPEG・PNG）を選んでください')
  if (file.size > 15 * 1024 * 1024) throw new Error('写真の容量が大きすぎます（15MBまで）')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error('写真を読み込めませんでした')); i.src = url })
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (opt.square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m }
    const k = Math.min(1, opt.max / Math.max(sw, sh))
    const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k)
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
    let q = 0.8, out = c.toDataURL('image/jpeg', q)
    while (out.length > opt.maxLen && q > 0.3) { q -= 0.1; out = c.toDataURL('image/jpeg', q) }
    if (out.length > opt.maxLen) throw new Error('写真の容量を小さくできませんでした。別の写真でお試しください')
    return out
  } finally { URL.revokeObjectURL(url) }
}

/** 保存してよい写真か（JPEGのdata URL、または画面内で作るイラスト）。不正な文字列は表示しない */
export const safePhoto = (s?: string) => !!s && (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) || /^data:image\/svg\+xml;utf8,/.test(s))
