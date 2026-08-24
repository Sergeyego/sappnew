import fs from 'fs';
import { UniversalLabel } from './UniversalLabel.js';

async function buildLabelDemo() {
  // Создаем горизонтальную подложку этикетки 60мм на 40мм
  const label = new UniversalLabel(60, 40, 203);

  // Сетка геометрии и текстовых блоков
  label
    .line(2, 2, 58, 2, 0.4)
    .round(2, 5, 10, 10, 2, true) // Черный скругленный маркер-квадрат
    .text("СКЛАД А4", 15, 12, 5)
    .block("Стеллаж 14, Ячейка Б-203. Товар повышенного спроса.", 15, 16, 42, 10, 3);

  // 1. Поворачиваем штрихкод Code 128 на 90 градусов по часовой стрелке ('R')
  // Он идеально встанет вертикально в правой части этикетки
  await label.barcode("BOX-99218", 45, 5, 25, 'code128', 'R');

  // 2. Добавляем стандартный QR-код без поворота ('N')
  await label.barcode("https://mylabels.com", 2, 22, 0, 'qrcode', 'N');

  // СОХРАНЯЕМ ПРЕВЬЮ НА ДИСК (В исходной ориентации 60х40)
  fs.writeFileSync('preview_origin.png', label.canvas.toBuffer('image/png'));

  // --- ВЫГРУЗКА ДЛЯ ПРИНТЕРОВ ---

  // Сценарий А: Печать "как есть" (горизонтально)
  const standardZpl = label.toZPL(1, false, false);

  // Сценарий Б: Полный разворот макета на 90 градусов силами Canvas 
  // (Например, если в принтер заправлена узкая лента 40мм, а длина подачи 60мм)
  const rotatedZpl = label.toZPL(1, true, true); // 1 копия, отрезчик ВКЛ, поворот этикетки ВКЛ
  const rotatedTspl = await label.toTSPL(1, true, true);

  console.log("Интеграционные пакеты успешно сформированы!");
}

buildLabelDemo();
