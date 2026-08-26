//const db = require('../../../postgres.js');
//const odata = require('../../../odata/service.js');
//const cache = require('./cache.js');

class SyncHelpers {

    getFormattedDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00`;
    }
}
module.exports = new SyncHelpers();