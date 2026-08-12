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
                return res.status(400).send('Файл не найден в запросе');
            }

            // Генерируем уникальное имя файла, чтобы избежать перезаписи
            const objectName = `${req.params["prefix"]}/${Date.now()}-${req.file.originalname}`;

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
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });

    app.get('/elrtr/dosage/s3/files/get/*filename', async (req, res) => {
        try {
            // В Express переменная будет доступна в req.params.filename как массив строк
            // либо как строка в req.params[0] в зависимости от точной минорной версии.
            // Самый надежный способ получить полный хвост пути:
            const fileName = req.params.filename ? 
                (Array.isArray(req.params.filename) ? req.params.filename.join('/') : req.params.filename) 
                : req.params[0];

            if (!fileName) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            const stat = await minioClient.statObject(BUCKET_NAME, fileName);
            res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
            res.setHeader('ETag', stat.etag);

            const dataStream = await minioClient.getObject(BUCKET_NAME, fileName);
            dataStream.pipe(res);
        } catch (error) {
            if (error.code === 'NoSuchKey') return res.status(404).json({ error: 'File not found' });
            res.status(500).json({ error: error.message });
        }
    });

    // УДАЛЕНИЕ: Удалить файл из хранилища
    app.delete('/elrtr/dosage/s3/files/delete/*filename', async (req, res) => {
        try {
            const fileName = req.params.filename ? 
                (Array.isArray(req.params.filename) ? req.params.filename.join('/') : req.params.filename) 
                : req.params[0];

            if (!fileName) {
                return res.status(400).json({ error: 'Filename is required' });
            }

            // Пытаемся удалить объект
            await minioClient.removeObject(BUCKET_NAME, fileName);

            res.json({ message: `Файл ${fileName} успешно удален` });
        } catch (error) {
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });

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
            res.status(500).type('text/plain');
            res.send(error.message);
        }
    });
}