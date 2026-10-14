function createWatermark(text: string) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const font = '16px "Microsoft YaHei", sans-serif';
  ctx.font = font;
  const textWidth = ctx.measureText(text).width;
  const width = Math.max(240, Math.ceil(textWidth * Math.cos(Math.PI / 6) + 70));
  const height = Math.max(160, Math.ceil(textWidth / 2 + 70));
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.fillText(text, 0, 0);
  return { url: canvas.toDataURL('image/png'), width, height };
}

export function removeGlobalWatermark() {
  document.getElementById('global-watermark')?.remove();
}

export function setGlobalWatermark(username: string) {
  const text = username.trim().slice(0, 100);
  if (!text) {
    removeGlobalWatermark();
    return;
  }
  let watermarkDiv = document.getElementById('global-watermark');
  if (watermarkDiv?.dataset.username === text) return;
  const watermark = createWatermark(text);
  if (!watermark) {
    removeGlobalWatermark();
    return;
  }
  if (!watermarkDiv) {
    watermarkDiv = document.createElement('div');
    watermarkDiv.id = 'global-watermark';
    watermarkDiv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(watermarkDiv);
  }
  watermarkDiv.dataset.username = text;
  const image = `url("${watermark.url}")`;
  const size = `${watermark.width}px ${watermark.height}px`;
  watermarkDiv.style.setProperty('mask-image', image);
  watermarkDiv.style.setProperty('-webkit-mask-image', image);
  watermarkDiv.style.setProperty('mask-size', size);
  watermarkDiv.style.setProperty('-webkit-mask-size', size);
}
