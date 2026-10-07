// Copy the active scene's last frame; never create a second scene or renderer.
export function capturePageThumbnail(source, createCanvas = () => document.createElement('canvas')) {
  if (!source?.width || !source?.height) return undefined;
  try {
    const canvas = createCanvas();
    canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const scale = Math.min(canvas.width / source.width, canvas.height / source.height);
    const width = source.width * scale, height = source.height * scale;
    context.fillStyle = '#17232e'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    const data = canvas.toDataURL('image/jpeg', .75);
    return isPageThumbnail(data) ? data : undefined;
  } catch { return undefined; }
}

export function isPageThumbnail(value) {
  return typeof value === 'string' && value.length <= 180000 && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
