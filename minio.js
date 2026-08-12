const Minio = require('minio');
const https = require('https');

// Создаем агент, который разрешает самоподписанные сертификаты
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const minioClient = new Minio.Client({
  endPoint: "192.168.1.10",
  port: 9500,
  useSSL: true,
  accessKey: "Z1CKL1xzX6lwRLvqn9WS",
  secretKey: "LSLjdZxyFx0BviSPWZp7cl2U00gSM7ZUWzogzB8d",
  transportAgent: httpsAgent
});

module.exports = minioClient;