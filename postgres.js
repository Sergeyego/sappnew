const initOptions = {/* initialization options */};
const pgp = require('pg-promise')(initOptions);
const db = pgp('postgres://user:szsm@192.168.1.10:5432/neo_rtx');
module.exports = db;
