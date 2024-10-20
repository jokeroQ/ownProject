// useGlobalWatermark.js

function createWatermark(text:string) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
  
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-30 * Math.PI) / 180);
      ctx.fillText(text, 0, 0);
    }
  
    return canvas.toDataURL('image/png');
  }
  
  export function setGlobalWatermark(text = 'cara') {
    const watermarkURL = createWatermark(text);

    // 创建覆盖层
    let watermarkDiv = document.getElementById('global-watermark');
    if (!watermarkDiv) {
      watermarkDiv = document.createElement('div');
      watermarkDiv.id = 'global-watermark';
      document.body.appendChild(watermarkDiv);
    }
  
    // 设置覆盖层样式
    Object.assign(watermarkDiv.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none', // 确保不阻挡用户的其他交互操作
      backgroundImage: `url(${watermarkURL})`,
      backgroundRepeat: 'repeat',
      backgroundSize: '200px 150px',
      zIndex: 9999, // 设置足够高的 z-index 保证水印在最上方
    });
  }
  