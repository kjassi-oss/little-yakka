// Client-side photo compression: full-resolution camera photos (multi-MB) get
// resized to a small JPEG before upload, so avatars/thumbnails load instantly.
// Falls back to the original file if anything fails (e.g. unsupported format).
export async function compressImage(file: File, maxDim = 512, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith('image/')) return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    // Already small enough? Skip the re-encode.
    if (scale >= 1 && file.size < 300_000) return file
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
