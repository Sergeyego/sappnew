const {QueryFile} = require('pg-promise');
const {join: joinPath} = require('path');

function sql(file) {
    const fullPath = joinPath(__dirname, file);
    return new QueryFile(fullPath, {minify: true});
}
module.exports = sql;