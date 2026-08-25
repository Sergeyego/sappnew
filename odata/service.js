const http = require('http');
const https = require('https');

class ODataService {
    constructor() {
        this.url = "";
        this.authHeader = "";
        // Переиспользуем агент для Keep-Alive (замена QNetworkAccessManager в private)
        this.httpAgent = new http.Agent({ keepAlive: true });
        this.httpsAgent = new https.Agent({ keepAlive: true });
    }

    /**
     * Инициализация настроек связи с 1С (аналог updateBaseSettings)
     */
    init(url, user, password) {
        this.url = url.endsWith('/') ? url : url + '/';
        const authData = Buffer.from(`${user}:${password}`).toString('base64');
        this.authHeader = `Basic ${authData}`;
    }

    /**
     * Универсальный метод отправки запросов к 1С (аналог sendRequest)
     */
    async request(obj, method = 'GET', body = null) {
        const url = `${this.url}${obj}`;
        const isHttps = url.startsWith('https');

        const headers = {
            'Accept': 'application/json',
            'Accept-Charset': 'UTF-8',
            'Content-Type': 'application/json',
            'User-Agent': 'NodeJS-Express-Sync',
            'Authorization': this.authHeader
        };

        const options = {
            method,
            headers,
            agent: isHttps ? this.httpsAgent : this.httpAgent
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson['odata.error']?.message?.value || response.statusText;
            } catch {
                errText = response.statusText;
            }
            throw new Error(`1С OData Error (${response.status}): ${errText}`);
        }

        // DELETE обычно возвращает 204 No Content
        if (response.status === 204) return true;

        return await response.json();
    }

    async get(obj) { return this.request(obj, 'GET'); }
    async post(obj, data) { return this.request(obj, 'POST', data);{} }
    async patch(obj, data) { return this.request(obj, 'PATCH', data);{} }
    async delete(obj) { return this.request(obj, 'DELETE');{} }
}

module.exports = new ODataService();