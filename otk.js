const autorest = require('./autorest/autorest.js');

const checkVal = function (tu, val) {
    let color = "#FFFFFF";
    let inf = "";

    if (tu.max == null && tu.min != null) {
        inf += ": min " + tu.min;
        color = (val < tu.min) ? "#FFAAAA" : (val > tu.min ? "#AAFFAA" : "#FFFF00");
    } else if (tu.min == null && tu.max != null) {
        inf += ": max " + tu.max;
        color = (val > tu.max) ? "#FFAAAA" : (val < tu.max ? "#AAFFAA" : "#FFFF00");
    } else if (tu.min != null && tu.max != null) {
        inf += ": min " + tu.min + " max " + tu.max;
        color = (val < tu.min || val > tu.max) ? "#FFAAAA" : ((val > tu.min && val < tu.max) ? "#AAFFAA" : "#FFFF00");
    }
    return { color: color, inf: inf };
}

// Вспомогательная функция обхода и подкраски данных химии/механики
const processTuColoring = async (data, tableName, getTuFn, idFieldMechOrChem, idFieldPart = "id_part") => {
    if (!data || !data.length) return; // Защита от пустых ответов базы данных
    
    // Безопасное извлечение id_part из первой строки
    const firstRowPart = data[0] && data[0][idFieldPart] ? data[0][idFieldPart].edit_role : null;
    const id_part = Number(firstRowPart);
    
    if (id_part > 0) {
        const mapStat = await getTuFn(id_part);
        const tbl = await autorest.getTblInfo(tableName);
        const col = tbl.columns;
        
        for (let i = 0; i < data.length; i++) {
            // Динамически получаем поле (id_chem или id_mech) в зависимости от контекста вызова
            const targetField = data[i][idFieldMechOrChem];
            
            if (targetField && mapStat.has(targetField.edit_role)) {
                const tu = mapStat.get(targetField.edit_role);
                const val = Number(data[i].kvo ? data[i].kvo.edit_role : 0);
                const ch = checkVal(tu, val);
                
                col.forEach(function (cl) {
                    if (data[i][cl.nam]) {
                        data[i][cl.nam].background_role = ch.color;
                        data[i][cl.nam].tooltip_role = (targetField.display_role || '') + ch.inf;
                    }
                });
            }
        }
    }
};

module.exports = {
    processTuColoring
};