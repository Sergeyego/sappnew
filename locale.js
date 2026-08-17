const intFormatter = new Intl.NumberFormat("ru-RU", { style: "decimal", minimumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "numeric", day: "numeric" });
const dateLongFormatter = new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "long", day: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "numeric", minute: "numeric" });

// Кэш для форматировщиков чисел с плавающей точкой
const mapDecFormatter = new Map();
for (let i = 1; i < 5; i++) {
    mapDecFormatter.set(i, new Intl.NumberFormat("ru-RU", { style: "decimal", minimumFractionDigits: i, maximumFractionDigits: i }));
}

// Вспомогательная функция для безопасного создания/получения форматировщика из кэша
function getDecFormatter(dec) {
    if (!mapDecFormatter.has(dec)) {
        mapDecFormatter.set(dec, new Intl.NumberFormat("ru-RU", { style: "decimal", minimumFractionDigits: dec, maximumFractionDigits: dec }));
    }
    return mapDecFormatter.get(dec);
}

// Вспомогательная функция для безопасного приведения к объекту Date
function parseDate(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

let insNumber = function (val, dec) {
    if (val === null || val === undefined) return ""; 
    
    const num = Number(val);
    if (Number.isNaN(num)) return ""; // Защита от некорректных строк, приводящих к NaN
    
    // Если dec передан и он больше 0, используем кэшированный или динамический форматтер
    if (typeof dec === 'number' && dec > 0) {
        return getDecFormatter(dec).format(num);
    }
    
    return intFormatter.format(num);
}

let insDate = function (dat) {
    const d = parseDate(dat);
    return d ? dateFormatter.format(d) : "";
}

let insDateLong = function (dat) {
    const d = parseDate(dat);
    return d ? dateLongFormatter.format(d) : "";
}

let insDateTime = function (dtm) {
    const d = parseDate(dtm);
    return d ? dateTimeFormatter.format(d) : "";
}

let insTime = function (tm) {
    if (tm instanceof Date) return timeFormatter.format(tm);
    if (typeof tm === 'string' && tm.length >= 5) return tm.substring(0, 5); 
    return tm ? String(tm) : "";
}

let insUpperFirst = function (str) {
    if (isEmptyStr(str)) return "";
    const s = String(str);
    return s.charAt(0).toUpperCase() + s.slice(1);
}

let isEmptyStr = function(str) {
    if (str === '' || str === undefined || str === null) {
        return true;
    }
    return String(str).trim().length === 0;
}

let insText = function (str) {
    return isEmptyStr(str) ? '' : String(str);
}

// Создаем базовый словарь для строчных букв (один раз в памяти модуля)
const baseMap = new Map([
    ["а","a"], ["б","b"], ["в","v"], ["г","g"], ["д","d"], ["е","e"], ["ё","e"],
    ["ж","zj"], ["з","z"], ["и","i"], ["й","i"], ["к","k"], ["л","l"], ["м","m"],
    ["н","n"], ["о","o"], ["п","p"], ["р","r"], ["с","s"], ["т","t"], ["у","u"],
    ["ф","f"], ["х","kh"], ["ц","ts"], ["ч","ch"], ["ш","sh"], ["щ","shch"],
    ["ъ","ie"], ["ы","y"], ["ь",""], ["э","e"], ["ю","iu"], ["я","ia"]
]);

// Генерируем карту для стандартного транслита (включая заглавные)
const translitMap = new Map(baseMap);
for (const [key, value] of baseMap.entries()) {
    const upperKey = key.toUpperCase();
    const upperValue = value.charAt(0).toUpperCase() + value.slice(1);
    translitMap.set(upperKey, upperValue);
}

// Генерируем специальную карту для химического режима ('chem')
const chemMap = new Map(translitMap);
const chemOverrides = {
    "Б": "Nb", "В": "W", "Г": "Mn", "Д": "Cu", "М": "Mo", "Н": "Ni",
    "С": "Si", "Т": "Ti", "Ф": "V", "Х": "Cr", "Ц": "Zr", "Ю": "Al"
};
for (const [key, value] of Object.entries(chemOverrides)) {
    chemMap.set(key, value);
}

let insTrans = function (str, cfg) {
    if (!str) return ""; 
    let out = "";
    const isChem = (cfg === 'chem');
    
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        
        if (isChem && i > 1) {
            out += chemMap.has(c) ? chemMap.get(c) : c;
        } else {
            out += translitMap.has(c) ? translitMap.get(c) : c;
        }
    }
    return out;
}

module.exports = {
    insNumber,
    insDate,
    insDateLong,
    insDateTime,
    insTime,
    insUpperFirst,
    isEmptyStr,
    insText,
    insTrans
};
