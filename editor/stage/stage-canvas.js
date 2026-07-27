/**
 * 舞台画布渲染
 */
const StageCanvas = (function () {
  let canvas, ctx;
  const W = 480, H = 360;

  function init() {
    canvas = document.getElementById('stage-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    renderLoop();
  }

  function renderLoop() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 绘制所有精灵
    StageManager.getSprites().forEach(sprite => {
      if (!sprite.visible) return;
      drawSprite(sprite);
    });

    requestAnimationFrame(renderLoop);
  }

  function drawSprite(s) {
    ctx.save();
    const cx = W / 2 + s.x;
    const cy = H / 2 - s.y;
    ctx.translate(cx, cy);
    // 旋转模式
    if (s.rotationStyle === 'allAround') {
      ctx.rotate((s.direction - 90) * Math.PI / 180);
    } else if (s.rotationStyle === 'leftRight') {
      if (s.direction > 180) ctx.scale(-1, 1);
    }
    // noRotate: 不旋转
    const sc = s.size / 100;
    ctx.scale(sc, sc);

    // 如果有贴图，绘制图片
    if (s.costumeImage) {
      const imgW = s.costumeImage.width;
      const imgH = s.costumeImage.height;
      // 居中绘制，最大 64x64
      const maxDim = 64;
      let drawW = imgW, drawH = imgH;
      if (imgW > maxDim || imgH > maxDim) {
        const ratio = Math.min(maxDim / imgW, maxDim / imgH);
        drawW = imgW * ratio;
        drawH = imgH * ratio;
      }
      ctx.drawImage(s.costumeImage, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // 绘制三角箭头作为默认造型
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(14, 14);
      ctx.lineTo(-14, 14);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-4, -4, 3, 0, Math.PI * 2);
      ctx.arc(4, -4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(-3, -4, 1.5, 0, Math.PI * 2);
      ctx.arc(5, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 说话气泡
    if (s.sayText) {
      ctx.save();
      ctx.font = '12px "Microsoft YaHei",sans-serif';
      const tw = ctx.measureText(s.sayText).width;
      const bx = cx + 20, by = cy - 30;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, tw + 16, 24, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.fillText(s.sayText, bx + 8, by + 16);
      ctx.restore();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  return { init };
})();
