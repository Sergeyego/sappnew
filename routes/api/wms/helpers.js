class SyncHelpers {

    getFormattedDate(dateObj, includeTime = false) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');

        if (includeTime) {
            const hours = String(dateObj.getHours()).padStart(2, '0');
            const minutes = String(dateObj.getMinutes()).padStart(2, '0');
            const seconds = String(dateObj.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        }

        return `${year}-${month}-${day}T00:00:00`;
    }

    parseInnKpp(str) {
        if (!str) return { inn: "", kpp: "" };

        const parts = str.split('/');

        // Полностью удаляем любые пробелы, табы и неразрывные пробелы (\u00A0)
        const inn = parts[0] ? parts[0].replace(/\s+/g, '') : "";
        const kpp = parts[1] ? parts[1].replace(/\s+/g, '') : "";

        return { inn, kpp };
    }

    escapeODataString(value) {
        if (typeof value !== 'string') {
            return "";
        }
        // 1. Удваиваем одиночные кавычки: ' превращается в ''
        const escaped = value.replace(/'/g, "''");

        // 2. Кодируем для URL (символы &, +, ? и т.д.)
        return encodeURIComponent(escaped);
    }
}

module.exports = new SyncHelpers();