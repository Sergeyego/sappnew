const { QueryFile } = require('pg-promise');
const { join: joinPath } = require('path');

// Объект для хранения уже созданных инстансов QueryFile
const cache = {};

function sql(file) {
    const fullPath = joinPath(__dirname, file);
    
    // Если этот файл уже загружался, возвращаем его из кэша
    if (!cache[fullPath]) {
        cache[fullPath] = new QueryFile(fullPath, { minify: true });
    }
    
    return cache[fullPath];
}

module.exports = sql;