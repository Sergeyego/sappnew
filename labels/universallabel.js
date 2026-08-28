const { createCanvas, loadImage, registerFont } = require('canvas');
const bwipjs = require('bwip-js');
const rgbaToZ64 = require('zpl-image');
const path = require('path');

// === РЕГИСТРАЦИЯ КРОССПЛАТФОРМЕННЫХ ВЫТЯНУТЫХ ШРИФТОВ ===
registerFont(path.join(__dirname, 'fonts', 'Oswald-Regular.ttf'), { family: 'OswaldCustom' });
registerFont(path.join(__dirname, 'fonts', 'Oswald-Bold.ttf'), { family: 'OswaldCustom', weight: 'bold' });

class UniversalLabel {
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
  line(x1, y1, x2, y2, thicknessMm = 0.25) {
    this.ctx.lineWidth = Math.max(1, this._mmToPx(thicknessMm));
    this.ctx.beginPath();
    this.ctx.moveTo(this._mmToPx(x1), this._mmToPx(y1));
    this.ctx.lineTo(this._mmToPx(x2), this._mmToPx(y2));
    this.ctx.stroke();
    return this;
  }

  /**
     * Обычный однострочный текст с поддержкой поворота и стилизации
     * 
     * @param {string} text - Текст для отрисовки
     * @param {number} x - Координата X (мм)
     * @param {number} y - Координата Y (мм)
     * @param {number} fontSizeMm - Размер шрифта (мм)
     * @param {number} angleDegrees - Угол поворота в градусах
     * @param {Object} options - Настройки стиля: { bold: false, italic: false, font: 'arial' }
     */
  text(text, x, y, fontSizeMm = 3, angleDegrees = 0, options = {}) {
    const pxX = this._mmToPx(x);
    const pxY = this._mmToPx(y);
    const pxFontSize = this._mmToPx(fontSizeMm);

    // Разбираем опции стиля
    const isBold = options.bold ? 'bold ' : '';
    const isItalic = options.italic ? 'italic ' : '';
    const fontFamily = options.font || 'OswaldCustom';

    this.ctx.save();

    // Формируем полную строку шрифта для Canvas
    this.ctx.font = `${isBold}${isItalic}${pxFontSize}px ${fontFamily}`;
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
* Текстовый блок с автопереносом, автоуменьшением шрифта, поворотом,
* горизонтальным и вертикальным выравниванием, а также кастомными стилями.
* 
* @param {string} text - Текст
* @param {number} x - Левый верхний угол X (мм)
* @param {number} y - Левый верхний угол Y (мм)
* @param {number} widthMm - Ширина рамки (мм)
* @param {number} heightMm - Высота рамки (мм)
* @param {number} startFontSizeMm - Стартовый размер шрифта (мм)
* @param {number} angleDegrees - Угол поворота (0, 90, 180, 270)
* @param {string} align - Горизонтально: 'left', 'center', 'right'
* @param {boolean} fitSingleWord - Сжимать ли длинные слова без переноса по буквам
* @param {string} vAlign - Вертикально: 'top', 'center', 'bottom'
* @param {Object} options - Настройки стиля: { bold: false, italic: false, font: 'arial' }
*/

  block(text, x, y, widthMm, heightMm, startFontSizeMm = 4, angleDegrees = 0, align = 'left', fitSingleWord = true, vAlign = 'top', options = {}) {
    const pxX = this._mmToPx(x);
    const pxY = this._mmToPx(y);
    const maxWidth = this._mmToPx(widthMm);
    const maxHeight = this._mmToPx(heightMm);

    const isBold = options.bold ? 'bold ' : '';
    const isItalic = options.italic ? 'italic ' : '';
    const fontFamily = options.font || 'OswaldCustom';

    let fontSizeMm = startFontSizeMm;
    let lines = [];
    let pxFontSize = 0;
    let lineHeight = 0;

    // 1. Математический подбор размера шрифта под габариты всей рамки
    while (fontSizeMm > 1.0) {
      pxFontSize = this._mmToPx(fontSizeMm);
      lineHeight = Math.round(pxFontSize * 1.2);

      this.ctx.font = `${isBold}${isItalic}${pxFontSize}px ${fontFamily}`;

      // === КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Разбиваем текст на абзацы по \n ===
      const paragraphs = text.split('\n');
      lines = []; // Сбрасываем итоговые строки для текущего размера шрифта
      let wordFits = true;

      for (let p = 0; p < paragraphs.length; p++) {
        const paragraphText = paragraphs[p];

        // Разделяем текущий абзац на отдельные слова
        const sourceWords = paragraphText.split(' ');
        const processedWords = [];

        // Проверяем монолитные длинные слова внутри абзаца
        for (let i = 0; i < sourceWords.length; i++) {
          const word = sourceWords[i];
          if (word === '') {
            // Сохраняем множественные пробелы, если они были
            processedWords.push('');
            continue;
          }

          if (this.ctx.measureText(word).width > maxWidth) {
            if (fitSingleWord) {
              wordFits = false;
              processedWords.push(word);
            } else {
              let subWord = '';
              for (let j = 0; j < word.length; j++) {
                let testSub = subWord + word[j];
                if (this.ctx.measureText(testSub).width > maxWidth) {
                  if (subWord.length > 0) processedWords.push(subWord);
                  subWord = word[j];
                } else {
                  subWord = testSub;
                }
              }
              if (subWord.length > 0) processedWords.push(subWord);
            }
          } else {
            processedWords.push(word);
          }
        }

        if (fitSingleWord && !wordFits) break;

        // Собираем строки автопереноса внутри ОДНОГО абзаца
        let currentLine = '';
        for (let n = 0; n < processedWords.length; n++) {
          const word = processedWords[n];
          if (word === '') continue;

          let testLine = currentLine ? currentLine + ' ' + word : word;

          if (this.ctx.measureText(testLine).width > maxWidth) {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              lines.push(word);
              currentLine = '';
            }
          } else {
            currentLine = testLine;
          }
        }
        // Добавляем остаток строки текущего абзаца
        lines.push(currentLine || '');
      }

      // Если в режиме fitSingleWord слово не влезло — принудительно уменьшаем шрифт
      if (fitSingleWord && !wordFits) {
        fontSizeMm -= 0.2;
        continue;
      }

      // Проверяем, влезает ли весь текст (со всеми абзацами) по высоте рамки
      if (lines.length * lineHeight <= maxHeight) break;
      fontSizeMm -= 0.2; // Если не влезает по высоте — уменьшаем шрифт
    }

    // 2. Изолированный рендеринг строк с выравниванием
    this.ctx.save();
    this.ctx.font = `${isBold}${isItalic}${pxFontSize}px ${fontFamily}`;
    this.ctx.textBaseline = 'top';

    this.ctx.translate(pxX, pxY);
    if (angleDegrees !== 0) {
      this.ctx.rotate((angleDegrees * Math.PI) / 180);
    }

    // Вертикальное выравнивание
    const totalTextHeight = lines.length * lineHeight;
    let startY = 0;

    if (vAlign === 'center') {
      startY = (maxHeight - totalTextHeight) / 2;
    } else if (vAlign === 'bottom') {
      startY = maxHeight - totalTextHeight;
    }

    // Отрисовка строк
    lines.forEach((line, index) => {
      const lineY = startY + (index * lineHeight);

      if (lineY + pxFontSize <= maxHeight && lineY >= 0) {
        let lineX = 0;

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
  round(x, y, sizeMm, heightMm = null, radiusMm = 2, fill = false, thicknessMm = 0.25) {
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

  /** 
  * Генерация любого штрихкода через bwip-js с фиксацией размеров и опциональным текстом
  */
  async barcode(code, x, y, heightMm = 15, bcid = 'code128', rotation = 'N', moduleWidthMm = 0.25, showText = false) {
    const rotationMap = { 'N': 'N', 'R': 'R', 'L': 'L', 'I': 'I', '0': 'N', '90': 'R', '270': 'L', '180': 'I' };
    const targetRotation = rotationMap[rotation] || 'N';

    const targetHeightPx = this._mmToPx(heightMm);
    const calculatedScale = Math.max(1, Math.round(moduleWidthMm * this.scaleFactor));

    const baseOptions = {
      bcid: bcid,
      text: code,
      scale: calculatedScale,
      monochrome: true,
      rotate: 'N', // Всегда 'N' для предотвращения размытия внутри bwip-js
      includetext: false
    };

    if (bcid !== 'qrcode' && bcid !== 'datamatrix') {
      baseOptions.height = Math.round(targetHeightPx / calculatedScale);
    }

    try {
      // 1. Замеряем чистые пропорции полос (без текста)
      const basePngBuffer = await bwipjs.toBuffer(baseOptions);
      const baseImg = await loadImage(basePngBuffer);

      let finalRenderWidth = baseImg.width;
      let finalRenderHeight = targetHeightPx;

      if (bcid !== 'qrcode' && bcid !== 'datamatrix') {
        const aspectRatio = baseImg.width / baseImg.height;
        finalRenderWidth = Math.round(targetHeightPx * aspectRatio);
      } else {
        finalRenderWidth = targetHeightPx;
      }

      // 2. Генерируем финальную картинку с раскомментированными текстовыми параметрами
      const finalOptions = {
        ...baseOptions,
        includetext: showText,
        textxalign: 'center',
        antialiasing: false,
        textfont: 'gfont', // Пиксельный шрифт без сглаживания
        textsize: 9,       // Размер шрифта под штрихкодом
        guarddescent: 0,   // Подрезаем длинные линии EAN по общей высоте
        textgaps: 0.5      // Отступ текста
      };

      const finalPngBuffer = await bwipjs.toBuffer(finalOptions);
      const finalImg = await loadImage(finalPngBuffer);

      // 3. Жесткий поворот силами Canvas без размытия пикселей
      this.ctx.save();
      this.ctx.imageSmoothingEnabled = false;
      if (this.ctx.patternQuality) {
        this.ctx.patternQuality = 'fast';
      }

      const pxX = this._mmToPx(x);
      const pxY = this._mmToPx(y);

      if (targetRotation === 'R') {
        this.ctx.translate(pxX, pxY);
        this.ctx.rotate(90 * Math.PI / 180);
        this.ctx.drawImage(finalImg, 0, -finalRenderHeight, finalRenderWidth, finalRenderHeight);
      } else if (targetRotation === 'L') {
        this.ctx.translate(pxX, pxY);
        this.ctx.rotate(-90 * Math.PI / 180);
        this.ctx.drawImage(finalImg, -finalRenderWidth, 0, finalRenderWidth, finalRenderHeight);
      } else if (targetRotation === 'I') {
        this.ctx.translate(pxX, pxY);
        this.ctx.rotate(180 * Math.PI / 180);
        this.ctx.drawImage(finalImg, -finalRenderWidth, -finalRenderHeight, finalRenderWidth, finalRenderHeight);
      } else {
        this.ctx.drawImage(finalImg, pxX, pxY, finalRenderWidth, finalRenderHeight);
      }

      this.ctx.restore();

    } catch (err) {
      console.error(`[Barcode Error]:`, err);
    }
    return this;
  }

  /**
   * Очищает холст от серых полутонов (бинаризация) и генерирует чистый PNG-буфер
   * @returns {Buffer} Пиксель-перфект монохромный PNG буфер
   */
  toPNG() {
    const ctx = this.canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, this.pixelWidth, this.pixelHeight);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const brightness = (r + g + b) / 3;
      const color = brightness > 240 ? 255 : 0;

      data[i] = color;
      data[i + 1] = color;
      data[i + 2] = color;
    }

    ctx.putImageData(imgData, 0, 0);
    return this.canvas.toBuffer('image/png');
  }

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

  /**
   * Генерирует универсальный бинарный TSPL-код для термопринтеров.
   */
  async toTSPL(copies = 1, useCutter = false, rotate90 = false) {
    const sourceCanvas = rotate90 ? this._getRotatedCanvas() : this.canvas;
    const widthMm = rotate90 ? this.heightMm : this.widthMm;
    const heightMm = rotate90 ? this.widthMm : this.heightMm;
    const widthPx = rotate90 ? this.pixelHeight : this.pixelWidth;
    const heightPx = rotate90 ? this.pixelWidth : this.pixelHeight;

    const ctx = sourceCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, widthPx, heightPx).data;

    const tsplWidthBytes = Math.ceil(widthPx / 8);
    const tsplData = new Uint8Array(tsplWidthBytes * heightPx);

    for (let y = 0; y < heightPx; y++) {
      for (let x = 0; x < widthPx; x++) {
        const idx = (y * widthPx + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        const brightness = a < 128 ? 255 : (r + g + b) / 3;
        const isBlack = brightness <= 240;

        if (isBlack) {
          const byteIdx = y * tsplWidthBytes + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          tsplData[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    const header = `SIZE ${widthMm} mm,${heightMm} mm\r\n` +
      (useCutter ? `SET CUTTER ON\r\n` : `SET CUTTER OFF\r\n`) +
      `CLS\r\n` +
      `BITMAP 0,0,${tsplWidthBytes},${heightPx},0,\r\n`;

    const footer = `\r\nPRINT ${copies},1\r\n` +
      (useCutter ? `SET CUTTER OFF\r\n` : '');

    return Buffer.concat([
      Buffer.from(header, 'ascii'),
      Buffer.from(tsplData.buffer, tsplData.byteOffset, tsplData.byteLength),
      Buffer.from(footer, 'ascii')
    ]);
  }
}

module.exports = UniversalLabel;