const minioClient = require('../../../../minio.js');
const multer = require('multer');
const BUCKET_NAME = "recipes";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

module.exports = function (app) {

    // ПОСТИНГ: Загрузка файла (Поле в form-data должно называться "file")
    app.post('/elrtr/dosage/s3/files/upload/:prefix', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).type('text/plain').send('Файл не найден в запросе');
            }
            const objectName = `${req.params["prefix"]}/${req.file.originalname}`;

            // Проверяем, существует ли уже такой объект
            try {
                await minioClient.statObject(BUCKET_NAME, objectName);
                return res.status(409).type('text/plain').send(`Файл "${objectName}" уже существует. Загрузка отменена.`);
            } catch (statError) {
                // Если ошибка 'NotFound' — путь свободен, продолжаем загрузку
                if (statError.code !== 'NotFound' && statError.code !== 'NoSuchKey') {
                    throw statError; // Прочие системные ошибки отправляем в глобальный catch
                }
            }

            // Загружаем буфер файла напрямую в MinIO
            await minioClient.putObject(
                BUCKET_NAME,
                objectName,
                req.file.buffer,
                req.file.size,
                { 'Content-Type': req.file.mimetype }
            );

            res.status(201).json({
                message: 'Файл успешно загружен',
                fileName: objectName,
                size: req.file.size
            });
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    // ЗАГРУЗКА: Скачать файл из хранилища
    app.get('/elrtr/dosage/s3/files/get/*filename', async (req, res) => {
        try {
            let rawFileName = req.params.filename || req.params[0];

            if (!rawFileName) {
                return res.status(400).type('text/plain').send('Filename is required');
            }

            const fileName = decodeURIComponent(rawFileName);

            const stat = await minioClient.statObject(BUCKET_NAME, fileName);

            const contentType = stat.metaData['content-type'] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('ETag', stat.etag);
            res.setHeader('Content-Length', stat.size);

            const dataStream = await minioClient.getObject(BUCKET_NAME, fileName);
            dataStream.pipe(res);
        } catch (error) {
            if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
                return res.status(404).type('text/plain').send('Файл не найден');
            }
            res.status(500).type('text/plain').send(error.message);
        }
    });

    // УДАЛЕНИЕ: Удалить файл из хранилища
    app.delete('/elrtr/dosage/s3/files/delete/*filename', async (req, res) => {
        try {
            const fileName = req.params.filename ?
                (Array.isArray(req.params.filename) ? req.params.filename.join('/') : req.params.filename)
                : req.params[0];

            if (!fileName) {
                return res.status(400).type('text/plain').send('Filename is required');
            }

            // Пытаемся удалить объект
            await minioClient.removeObject(BUCKET_NAME, fileName);

            res.json({ message: `Файл ${fileName} успешно удален` });
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });

    // СПИСОК: Получить список файлов
    app.get('/elrtr/dosage/s3/files/list/:prefix', async (req, res) => {
        try {
            const objectsList = [];
            let folderPrefix = req.params["prefix"];
            if (folderPrefix && !folderPrefix.endsWith('/')) {
                folderPrefix += '/';
            }
            const objectsStream = minioClient.listObjects(BUCKET_NAME, folderPrefix, true);
            for await (const obj of objectsStream) {
                objectsList.push(obj);
            }
            res.json({ files: objectsList });
        } catch (error) {
            res.status(500).type('text/plain').send(error.message);
        }
    });
};