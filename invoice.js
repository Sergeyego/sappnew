let createDoc = async function (dataTitle, dataItems) {
    const docx = require("docx");
    const { Document, Packer, Paragraph, Table, TableCell, 
        TableRow, WidthType, PageOrientation, AlignmentType, 
        HeadingLevel, TableBorders, LineRuleType } = docx;
    const table1 = new Table({
        columnWidths: [7650, 1900, 1700],
        rows: [
            new TableRow({//1
                children: [
                    new TableCell({
                        width: {
                            size: 7650,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1900,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara3"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1700,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Коды", style: "normalPara"})],
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
            new TableRow({//2
                children: [
                    new TableCell({
                        width: {
                            size: 7650,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Организация ООО Судиславский завод сварочных материалов", style: "normalPara"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1900,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text:"Форма по ОКУД", style: "normalPara3"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),                      
                    new TableCell({
                        width: {
                            size: 1700,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "0315003", style: "normalPara"})],
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
            new TableRow({//3
                children: [
                    new TableCell({
                        width: {
                            size: 7650,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Структурное подразделение", style: "normalPara"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1900,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "по ОКПО", style: "normalPara3"})],
                        borders: TableBorders.NONE,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1700,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara"})],
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
        ],
    });

    const table2 = new Table({
        columnWidths: [1670, 680, 680, 5103, 850, 1134, 850, 1134, 1134, 1132, 680],
        rows: [
            new TableRow({ //1
                children: [
                    new TableCell({
                        width: {
                            size: 1670,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Дата составления", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Код вида операции", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Склад", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 5103,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Поставщик", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Страховая компания", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Корреспондирующий счет", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Номер документа", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
            new TableRow({ //2
                children: [
                    new TableCell({
                        width: {
                            size: 5103,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Наименование", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Код", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "счет, субсчет", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "код аналитического учета", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "сопроводительного", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1132,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "платежного", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
            new TableRow({ //3
                children: [
                    new TableCell({width: {
                        size: 1670,
                        type: WidthType.DXA,
                    },
                        children: [new Paragraph({text: dataTitle.period!=null ? dataTitle.period  : dataTitle.dat.toLocaleDateString('ru-RU',{year: 'numeric', month: 'long', day: 'numeric' }), style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 5103,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: (dataTitle.tnam!=null ? dataTitle.tnam.toUpperCase() : ""), style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1134,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1132,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 680,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "", style: "normalPara4"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
        ],
    });

    let table3 = new Table({
        columnWidths: [5103, 850, 870, 1024, 1016, 1020, 860, 860, 862, 867, 859, 864],
        rows: [
            new TableRow({ //1
                children: [
                    new TableCell({
                        width: {
                            size: 5953,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Материальные ценности", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1894,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Единица измерения", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 2036,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Количество", style: "tablePara"})],
                        columnSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 860,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: dataTitle.tnam!="Переупаковка" ? "Цена, руб. коп." : "В т.ч. брак", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 860,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Сумма без учета НДС, руб. коп.", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 862,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Сумма НДС, руб. коп.", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 867,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Всего с учетом НДС, руб. коп.", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 859,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Номер паспорта", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 864,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "Порядковый номер по складской картотеке", style: "tablePara"})],
                        rowSpan: 2,
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
            new TableRow({ //2
                children: [
                    new TableCell({
                        width: {
                            size: 5103,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "наименование, сорт, размер, марка", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "номенклатурный номер", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 870,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "код", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1024,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "наименование", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1016,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "по документу", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1020,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "принято", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    
                ],
            }),
            new TableRow({ //3
                children: [
                    new TableCell({
                        width: {
                            size: 5103,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "1", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 850,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "2", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 870,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "3", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1024,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "4", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1016,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "5", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 1020,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "6", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 860,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "7", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 860,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "8", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 862,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "9", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 867,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "10", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 859,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "11", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                    new TableCell({
                        width: {
                            size: 864,
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({text: "12", style: "tablePara"})],
                        verticalAlign: AlignmentType.CENTER,
                        margins: {
                            top: 57,
                            bottom: 57,
                            left: 57,
                            right: 57,
                        },
                    }),
                ],
            }),
        ],
    });

    let sum = 0.0;
    let sumbreak = 0.0;

    for (i = 0; i < dataItems.length; i++) {

        let nams = dataItems[i].nam.split('\n');
        let cellNam = new TableCell ({
                width: {
                    size: 5103,
                    type: WidthType.DXA,
                },
                children: [],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                }
            }
        );
        for (j=0; j<nams.length; j++){
            let str = j!=0 ? nams[j] : String(i+1)+". "+nams[j];
            cellNam.addChildElement(new Paragraph({text: str, style: "normalPara"}))
        }

        sum+=dataItems[i].kvo;
        if (dataItems[i].break!=null){
            sumbreak+=dataItems[i].break;
        }
        table3.addChildElement(new TableRow({ 
            children: [
                cellNam,
                new TableCell({
                    width: {
                        size: 850,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: dataItems[i].npart, style: "normalPara4"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 870,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara4"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 1024,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "кг", style: "normalPara4"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 1016,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara4"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 1020,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: new Intl.NumberFormat("ru", {style: "decimal", minimumFractionDigits: 2}).format(dataItems[i].kvo), style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 860,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: dataItems[i].break!=null ? new Intl.NumberFormat("ru", {style: "decimal", minimumFractionDigits: 2}).format(dataItems[i].break) : "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 860,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 862,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 867,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 859,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
                new TableCell({
                    width: {
                        size: 864,
                        type: WidthType.DXA,
                    },
                    children: [new Paragraph({text: "", style: "normalPara3"})],
                    verticalAlign: AlignmentType.CENTER,
                    margins: {
                        top: 57,
                        bottom: 57,
                        left: 57,
                        right: 57,
                    },
                }),
            ],
        }))
    }
    
    table3.addChildElement(new TableRow({ //sum
        children: [
            new TableCell({
                width: {
                    size: 5103,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "ИТОГО", style: "normalPara"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 850,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara4"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 870,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara4"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 1024,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "кг", style: "normalPara4"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 1016,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara4"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 1020,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: new Intl.NumberFormat("ru", {style: "decimal", minimumFractionDigits: 2}).format(sum), style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 860,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: sumbreak>0 ? new Intl.NumberFormat("ru", {style: "decimal", minimumFractionDigits: 2}).format(sumbreak) : "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 860,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 862,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 867,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 859,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
            new TableCell({
                width: {
                    size: 864,
                    type: WidthType.DXA,
                },
                children: [new Paragraph({text: "", style: "normalPara3"})],
                verticalAlign: AlignmentType.CENTER,
                margins: {
                    top: 57,
                    bottom: 57,
                    left: 57,
                    right: 57,
                },
            }),
        ],
    }))

    let sign = "";
    if (dataTitle.etnam!=null){
        sign+="ПРИНЯЛ _________________ "+dataTitle.etnam;
    }
    if (sign!="" && dataTitle.efnam!=null){
        sign+="                               ";
    }
    if (dataTitle.efnam!=null){
        sign+="СДАЛ _________________ "+dataTitle.efnam;
    }

    const doc = new Document({
        styles: {
            default: {
                heading1: {
                    run: {
                        font: "Arial",
                        size: 20,
                        bold: true,
                    },
                    paragraph: {
                        alignment: AlignmentType.CENTER,
                        spacing: { line: 340 },
                    },
                },
            },
            paragraphStyles: [
                {
                    id: "normalPara",
                    name: "Normal Para",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Arial",
                        size: 20,
                        bold: false,
                    },
                    paragraph: {
                        spacing: { lineRule: LineRuleType.AUTO, before: 0, after: 0 },
                        alignment: AlignmentType.LEFT,
                    },
                },
                {
                    id: "normalPara2",
                    name: "Normal Para2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Arial",
                        size: 16,
                    },
                    paragraph: {
                        alignment: AlignmentType.RIGHT,
                        spacing: { lineRule: LineRuleType.AUTO, before: 0, after: 0 },
                    },
                },
                {
                    id: "normalPara3",
                    name: "Normal Para3",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Arial",
                        size: 20,
                        bold: false,
                    },
                    paragraph: {
                        spacing: { lineRule: LineRuleType.AUTO, before: 0, after: 0 },
                        alignment: AlignmentType.RIGHT,
                    },
                },
                {
                    id: "normalPara4",
                    name: "Normal Para4",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Arial",
                        size: 20,
                        bold: false,
                    },
                    paragraph: {
                        spacing: { lineRule: LineRuleType.AUTO, before: 0, after: 0 },
                        alignment: AlignmentType.CENTER,
                    },
                },
                {
                    id: "tablePara",
                    name: "Table Para",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Arial",
                        size: 16,
                    },
                    paragraph: {
                        alignment: AlignmentType.CENTER,
                        spacing: { lineRule: LineRuleType.AUTO, before: 0, after: 0 },
                    },
                    
                },
            ],
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            orientation: PageOrientation.LANDSCAPE,
                        },
                        margin: {
                            top: 850,
                            bottom: 850,
                            left: 850,
                            right: 850,
                        },
                    },
                },
                children: [
                    new Paragraph({ text: "Типовая межотраслевая форма № М-4", style: "normalPara2"}),
                    new Paragraph({ text: "Утверждена Постановлением Госкомстата России", style: "normalPara2"}),
                    new Paragraph({ text: "от 30.10.1997 № 71а", style: "normalPara2"}),
                    new Paragraph({ text: dataTitle.dnam+" №"+dataTitle.num, heading: HeadingLevel.HEADING_1 }),
                    table1,
                    new Paragraph({text: "", style: "normalPara"}),
                    table2,
                    new Paragraph({text: "", style: "normalPara"}),
                    table3,
                    new Paragraph({text: "", style: "normalPara"}),
                    new Paragraph({text: "", style: "normalPara"}),
                    new Paragraph({text: sign, style: "normalPara"}),
                ],
            },
        ],
    });

    const b64string = await Packer.toBase64String(doc);
    return b64string;
};
module.exports = {createDoc};