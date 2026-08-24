import { createCanvas, loadImage } from 'canvas';
import bwipjs from 'bwip-js';
import { rgbaToZ64 } from 'zpl-image';
import { rasterToTspl } from '@kubesail/raster-to-tspl-js';

export class UniversalLabel {
  /**
   * @param {number} widthMm - Ширина этикетки в мм
   * @param {number} heightMm - Высота этикетки в мм
   * @param {number} dpi - Разрешение принтера (203 или 300)
   */
  constructor(widthMm, heightMm, dpi = 203) {
    this.widthMm = widthMm;
    this.heightMm = heightMm;
    this.dpi = dpi;

    // Фактор перевода мм в пиксели
    this.scaleFactor = dpi / 25.4;
    this.pixelWidth = Math.round(widthMm * this.scaleFactor);
    this.pixelHeight = Math.round(heightMm * this.scaleFactor);

    this.canvas = createCanvas(this.pixelWidth, this.pixelHeight);
    this.ctx = this.canvas.getContext('2d');

    this._initCanvas();
  }

  // Настройка контекста холста: отсекаем полутона и размытие
  _initCanvas() {
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.antialias = 'none';
    this.ctx.textDrawingMode = 'path';

    // Заливаем холст чистым белым цветом
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, this.pixelWidth, this.pixelHeight);
    
    // Цвет по умолчанию для рисования — черный
    this.ctx.fillStyle = '#000000';
    this.ctx.strokeStyle = '#000000';
  }

  // Перевод мм в пиксели с округлением до целого
  _mmToPx(mm) {
    return Math.round(mm * this.scaleFactor);
  }

  /**
   * Приватный метод для поворота всего холста на 90 градусов по часовой стрелке
   */
  _getRotatedCanvas() {
    const rotatedCanvas = createCanvas(this.pixelHeight, this.pixelWidth);
    const rCtx = rotatedCanvas.getContext('2d');

    rCtx.imageSmoothingEnabled = false;
    rCtx.antialias = 'none';

    rCtx.translate(this.pixelHeight, 0);
    rCtx.rotate(90 * Math.PI / 180);
    rCtx.drawImage(this.canvas, 0, 0);

    return rotatedCanvas;
  }

  /** Прямая линия */
  line(x1, y1, x2, y2, thicknessMm = 0.5) {
    this.ctx.lineWidth = Math.max(1, this._mmToPx(thicknessMm));
    this.ctx.beginPath();
    this.ctx.moveTo(this._mmToPx(x1), this._mmToPx(y1));
    this.ctx.lineTo(this._mmToPx(x2), this._mmToPx(y2));
    this.ctx.stroke();
    return this;
  }

  /** Обычный однострочный текст с поддержкой поворота */
  text(text, x, y, fontSizeMm = 3, angleDegrees = 0) {
    const pxX = this._mmToPx(x);
    const pxY = this._mmToPx(y);
    const pxFontSize = this._mmToPx(fontSizeMm);

    this.ctx.save();
    this.ctx.font = `${pxFontSize}px sans-serif`;
    this.ctx.textBaseline = 'alphabetic';

    this.ctx.translate(pxX, pxY);
    if (angleDegrees !== 0) {
      this.ctx.rotate((angleDegrees * Math.PI) / 180);
    }

    this.ctx.fillText(text, 0, 0);
    this.ctx.restore();
    return this;
  }

  /** 
   * Текстовый блок с автопереносом, автоуменьшением шрифта, поворотом и выравниванием
   * @param {string} text - Текст
   * @param {number} x - Левый верхний угол X (мм)
   * @param {number} y - Левый верхний угол Y (мм)
   * @param {number} widthMm - Ограничение по ширине (мм)
   * @param {number} heightMm - Ограничение по высоте (мм)
   * @param {number} startFontSizeMm - Стартовый размер шрифта (мм)
   * @param {number} angleDegrees - Угол поворота блока в градусах (0, 90, 180, 270)
   * @param {string} align - Выравнивание внутри блока: 'left', 'center', 'right'
   */
  block(text, x, y, widthMm, heightMm, startFontSizeMm = 4, angleDegrees = 0, align = 'left') {
    const pxX = this._mmToPx(x);
    const pxY = this._mmToPx(y);
    const maxWidth = this._mmToPx(widthMm);
    const maxHeight = this._mmToPx(heightMm);

    let fontSizeMm = startFontSizeMm;
    let lines = [];
    let pxFontSize = 0;
    let lineHeight = 0;

    // 1. Математический подбор размера шрифта под габариты рамки
    while (fontSizeMm > 1.5) {
      pxFontSize = this._mmToPx(fontSizeMm);
      lineHeight = Math.round(pxFontSize * 1.2);
      this.ctx.font = `${pxFontSize}px sans-serif`;

      const words = text.split(' ');
      lines = [];
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        let testLine = currentLine + words[n] + ' ';
        let metrics = this.ctx.measureText(testLine.trim());
        if (metrics.width > maxWidth && n > 0) {
          lines.push(currentLine.trim());
          currentLine = words[n] + ' ';
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine.trim());

      if (lines.length * lineHeight <= maxHeight) break;
      fontSizeMm -= 0.2;
    }

    // 2. Изолированный рендеринг строк с выравниванием и поворотом
    this.ctx.save();
    this.ctx.font = `${pxFontSize}px sans-serif`;
    this.ctx.textBaseline = 'top';

    // Сдвигаем матрицу в левый верхний угол блока
    this.ctx.translate(pxX, pxY);
    if (angleDegrees !== 0) {
      this.ctx.rotate((angleDegrees * Math.PI) / 180);
    }

    lines.forEach((line, index) => {
      const lineY = index * lineHeight;
      if (lineY + pxFontSize <= maxHeight) {
        let lineX = 0;

        // Рассчитываем стартовую точку X в зависимости от типа выравнивания
        if (align === 'center') {
          this.ctx.textAlign = 'center';
          lineX = maxWidth / 2;
        } else if (align === 'right') {
          this.ctx.textAlign = 'right';
          lineX = maxWidth;
        } else {
          this.ctx.textAlign = 'left';
          lineX = 0;
        }

        this.ctx.fillText(line, lineX, lineY);
      }
    });

    this.ctx.restore();
    return this;
  }

  /** Окружность (круг) или скругленный прямоугольник */
  round(x, y, sizeMm, heightMm = null, radiusMm = 2, fill = false, thicknessMm = 0.5) {
    this.ctx.beginPath();

    if (heightMm === null) {
      this.ctx.arc(this._mmToPx(x), this._mmToPx(y), this._mmToPx(sizeMm), 0, 2 * Math.PI);
    } else {
      const pxX = this._mmToPx(x);
      const pxY = this._mmToPx(y);
      const pxW = this._mmToPx(sizeMm);
      const pxH = this._mmToPx(heightMm);
      const safeRadius = Math.min(this._mmToPx(radiusMm), pxW / 2, pxH / 2);
      
      this.ctx.roundRect(pxX, pxY, pxW, pxH, safeRadius);
    }

    if (fill) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fill();
    } else {
      this.ctx.lineWidth = Math.max(1, this._mmToPx(thicknessMm));
      this.ctx.strokeStyle = '#000000';
      this.ctx.stroke();
    }
    return this;
  }

  /** Отрисовка внешней картинки (логотипы, знаки EAC/РСТ) */
  async image(imageInput, x, y, widthMm, heightMm) {
    try {
      let img;
      if (typeof imageInput === 'string' || Buffer.isBuffer(imageInput)) {
        img = await loadImage(imageInput);
      } else {
        img = imageInput;
      }
      this.ctx.drawImage(img, this._mmToPx(x), this._mmToPx(y), this._mmToPx(widthMm), this._mmToPx(heightMm));
    } catch (err) {
      console.error(`[Image Error]:`, err);
    }
    return this;
  }

  /** Генерация любого штрихкода через bwip-js (Pixel-Perfect) */
  async barcode(code, x, y, heightMm = 15, bcid = 'code128', rotation = 'N') {
    const rotationMap = { 'N': 'N', 'R': 'R', 'L': 'L', 'I': 'I', '0': 'N', '90': 'R', '270': 'L', '180': 'I' };
    const bwipRotation = rotationMap[rotation] || 'N';

    const options = {
      bcid: bcid,
      text: code,
      scale: this.dpi === 300 ? 3 : 2,
      monochrome: true,
      rotate: bwipRotation
    };

    if (bcid !== 'qrcode' && bcid !== 'datamatrix') {
      options.height = Math.round(this._mmToPx(heightMm) / options.scale);
    }

    try {
      const pngBuffer = await bwipjs.toBuffer(options);
      const img = await loadImage(pngBuffer);
      this.ctx.drawImage(img, this._mmToPx(x), this._mmToPx(y));
    } catch (err) {
      console.error(`[Barcode Error]:`, err);
    }
    return this;
  }

  // --- ЭКСПОРТ ДЛЯ ПРИНТЕРОВ ---

  /** Генерирует универсальный ZPL-код */
  toZPL(copies = 1, useCutter = false, rotate90 = false) {
    const sourceCanvas = rotate90 ? this._getRotatedCanvas() : this.canvas;
    const width = rotate90 ? this.pixelHeight : this.pixelWidth;
    const height = rotate90 ? this.pixelWidth : this.pixelHeight;

    const pixelBuffer = sourceCanvas.toBuffer('raw');
    const z64 = rgbaToZ64(pixelBuffer, width, height);
    
    return `^XA\n` +
      `^CI28\n` + 
      (useCutter ? `^MMC\n` : `^MMT\n`) + 
      `^FO0,0\n` +
      `^GFA,${z64.length},${z64.length},${z64.rowBytes},${z64.code}^FS\n` +
      `^PQ${copies},0,1,${useCutter ? 'Y' : 'N'}\n` +
      `^XZ`;
  }

  /** Генерирует универсальный TSPL-код */
  async toTSPL(copies = 1, useCutter = false, rotate90 = false) {
    const sourceCanvas = rotate90 ? this._getRotatedCanvas() : this.canvas;
    const widthMm = rotate90 ? this.heightMm : this.widthMm;
    const heightMm = rotate90 ? this.widthMm : this.heightMm;

    const pngBuffer = sourceCanvas.toBuffer('image/png');
    const bitmapBuffer = await rasterToTspl(pngBuffer);

    const header = `SIZE ${widthMm} mm,${heightMm} mm\r\n` +
      (useCutter ? `SET CUTTER ON\r\n` : `SET CUTTER OFF\r\n`) +
      `CLS\r\n`;

    const footer = `\r\nPRINT ${copies},1\r\n` + 
      (useCutter ? `SET CUTTER OFF\r\n` : '');

    return Buffer.concat([
      Buffer.from(header, 'ascii'),
      bitmapBuffer,
      Buffer.from(footer, 'ascii')
    ]);
  }
}
