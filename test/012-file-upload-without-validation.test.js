const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const createBusinessMediaUpload = require('../app/middleware/business-media-upload.middleware.js');

const MiB = 1024 * 1024;

async function startUploadServer(t, fields) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awt-media-upload-test-'));
    const destination = path.join(root, 'public-uploads');
    const tempDirectory = path.join(root, 'staging');
    await fs.mkdir(tempDirectory);

    t.after(async () => {
        await fs.rm(root, { recursive: true, force: true });
    });

    const app = express();
    const upload = createBusinessMediaUpload(destination, tempDirectory);
    app.post('/upload', upload.fields(fields), (req, res) => {
        res.status(200).json(
            Object.fromEntries(Object.entries(req.files).map(([field, [file]]) => [field, file.filename])),
        );
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(
        () =>
            new Promise((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    );

    return {
        destination,
        tempDirectory,
        url: `http://127.0.0.1:${server.address().port}/upload`,
    };
}

async function postFile(url, { field, content, contentType, filename }) {
    const formData = new FormData();
    formData.append(field, new Blob([content], { type: contentType }), filename);
    return fetch(url, { method: 'POST', body: formData });
}

async function readFilesIfPresent(directory) {
    try {
        return await fs.readdir(directory);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

function createPdfBuffer() {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument();
        const chunks = [];
        document.on('data', (chunk) => chunks.push(chunk));
        document.on('error', reject);
        document.on('end', () => resolve(Buffer.concat(chunks)));
        document.text('Business brochure');
        document.end();
    });
}

function createMp4Buffer() {
    const box = (type, content = Buffer.alloc(0)) => {
        const header = Buffer.alloc(8);
        header.writeUInt32BE(header.length + content.length);
        header.write(type, 4, 'ascii');
        return Buffer.concat([header, content]);
    };
    const handler = Buffer.concat([Buffer.alloc(8), Buffer.from('vide'), Buffer.alloc(12), Buffer.from([0])]);
    const movie = box('moov', box('trak', box('mdia', box('hdlr', handler))));

    return Buffer.concat([box('ftyp', Buffer.from('isom\0\0\0\0')), movie, box('mdat', Buffer.from([0, 0, 0, 0]))]);
}

test('valid media is content-checked, sanitized, and stored using a generated filename', async (t) => {
    const fields = [
        { name: 'companyLogo', maxCount: 1 },
        { name: 'companyBanner', maxCount: 1 },
        { name: 'thumbnailInput', maxCount: 1 },
        { name: 'webinarsThumbnailInput', maxCount: 1 },
        { name: 'brochureInput', maxCount: 1 },
        { name: 'brochure', maxCount: 1 },
        { name: 'editBrochure', maxCount: 1 },
        { name: 'videoInput', maxCount: 1 },
    ];
    const server = await startUploadServer(t, fields);
    const png = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#336699' },
    })
        .png()
        .toBuffer();
    const pdf = await createPdfBuffer();
    const mp4 = createMp4Buffer();
    const formData = new FormData();
    for (const field of fields) {
        const isImage = ['companyLogo', 'companyBanner', 'thumbnailInput', 'webinarsThumbnailInput'].includes(
            field.name,
        );
        const isVideo = field.name === 'videoInput';
        const content = isImage ? png : isVideo ? mp4 : pdf;
        const contentType = isImage ? 'image/png' : isVideo ? 'video/mp4' : 'application/pdf';
        const filename =
            field.name === 'companyLogo'
                ? '../../active.html'
                : `${field.name}.${isImage ? 'png' : isVideo ? 'mp4' : 'pdf'}`;
        formData.append(field.name, new Blob([content], { type: contentType }), filename);
    }

    const response = await fetch(server.url, { method: 'POST', body: formData });
    const filenames = await response.json();

    assert.equal(response.status, 200);
    assert.match(filenames.companyLogo, /^companyLogo-[0-9a-f-]+\.png$/i);

    const storedFiles = await fs.readdir(server.destination);
    assert.equal(storedFiles.length, fields.length);
    assert.ok(storedFiles.every((storedFile) => !storedFile.startsWith('.')));
    assert.equal(storedFiles.filter((storedFile) => storedFile.endsWith('.pdf')).length, 3);
    assert.equal(storedFiles.filter((storedFile) => storedFile.endsWith('.png')).length, 4);
    assert.equal(storedFiles.filter((storedFile) => storedFile.endsWith('.mp4')).length, 1);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);

    const sanitizedImage = await sharp(path.join(server.destination, filenames.companyLogo)).metadata();
    assert.equal(sanitizedImage.format, 'png');
});

test('rejects spoofed MIME types and removes staged uploads', async (t) => {
    const server = await startUploadServer(t, [{ name: 'companyLogo', maxCount: 1 }]);
    const png = await sharp({
        create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
        .png()
        .toBuffer();

    const response = await postFile(server.url, {
        field: 'companyLogo',
        content: png,
        contentType: 'image/jpeg',
        filename: 'company-logo.jpg',
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).status, 'error');
    assert.deepEqual(await readFilesIfPresent(server.destination), []);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);

    const malformedResponse = await postFile(server.url, {
        field: 'companyLogo',
        content: Buffer.from('not an image'),
        contentType: 'image/png',
        filename: 'malformed.png',
    });
    assert.equal(malformedResponse.status, 400);
    assert.deepEqual(await readFilesIfPresent(server.destination), []);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);
});

test('rejects unsupported types, empty requests, and oversized images explicitly', async (t) => {
    const server = await startUploadServer(t, [{ name: 'companyLogo', maxCount: 1 }]);

    const emptyResponse = await fetch(server.url, { method: 'POST', body: new FormData() });
    assert.equal(emptyResponse.status, 400);

    const unsupportedResponse = await postFile(server.url, {
        field: 'companyLogo',
        content: Buffer.from('<script>alert(1)</script>'),
        contentType: 'text/html',
        filename: 'image.png',
    });
    assert.equal(unsupportedResponse.status, 400);

    const oversizedResponse = await postFile(server.url, {
        field: 'companyLogo',
        content: Buffer.alloc(2 * MiB + 1),
        contentType: 'image/png',
        filename: 'oversized.png',
    });
    assert.equal(oversizedResponse.status, 413);
    assert.equal((await oversizedResponse.json()).status, 'error');
    assert.deepEqual(await readFilesIfPresent(server.destination), []);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);
});

test('accepts a brochure at the 10 MiB limit and rejects the next byte', async (t) => {
    const server = await startUploadServer(t, [{ name: 'brochureInput', maxCount: 1 }]);
    const pdf = await createPdfBuffer();
    const startXref = pdf.lastIndexOf(Buffer.from('startxref'));
    const maxSize = 10 * MiB;
    const padding = Buffer.alloc(maxSize - pdf.length, 0x20);
    const atLimit = Buffer.concat([pdf.subarray(0, startXref), padding, pdf.subarray(startXref)]);

    assert.equal(atLimit.length, maxSize);
    const accepted = await postFile(server.url, {
        field: 'brochureInput',
        content: atLimit,
        contentType: 'application/pdf',
        filename: 'brochure.pdf',
    });
    assert.equal(accepted.status, 200);

    const rejected = await postFile(server.url, {
        field: 'brochureInput',
        content: Buffer.concat([atLimit, Buffer.from(' ')]),
        contentType: 'application/pdf',
        filename: 'brochure.pdf',
    });
    assert.equal(rejected.status, 413);
    assert.equal((await readFilesIfPresent(server.destination)).length, 1);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);
});

test('rejects unexpected multipart fields', async (t) => {
    const server = await startUploadServer(t, [{ name: 'companyLogo', maxCount: 1 }]);
    const response = await postFile(server.url, {
        field: 'untrustedField',
        content: Buffer.from('not allowed'),
        contentType: 'application/octet-stream',
        filename: 'file.bin',
    });

    assert.equal(response.status, 400);
    assert.equal((await response.json()).status, 'error');
    assert.deepEqual(await readFilesIfPresent(server.destination), []);

    const duplicateForm = new FormData();
    duplicateForm.append('companyLogo', new Blob(['first'], { type: 'image/png' }), 'one.png');
    duplicateForm.append('companyLogo', new Blob(['second'], { type: 'image/png' }), 'two.png');
    const duplicateResponse = await fetch(server.url, { method: 'POST', body: duplicateForm });
    assert.equal(duplicateResponse.status, 400);
    assert.deepEqual(await readFilesIfPresent(server.destination), []);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);
});

test('rejects PDFs without a valid cross-reference and MP4s without a video track', async (t) => {
    const server = await startUploadServer(t, [
        { name: 'brochureInput', maxCount: 1 },
        { name: 'videoInput', maxCount: 1 },
    ]);
    const invalidPdfResponse = await postFile(server.url, {
        field: 'brochureInput',
        content: Buffer.from('%PDF-1.4\n%%EOF\n'),
        contentType: 'application/pdf',
        filename: 'bad.pdf',
    });
    assert.equal(invalidPdfResponse.status, 400);

    const invalidMp4 = Buffer.concat([
        Buffer.from([0, 0, 0, 16]),
        Buffer.from('ftyp'),
        Buffer.from('isom'),
        Buffer.from([0, 0, 0, 0]),
        Buffer.from([0, 0, 0, 8]),
        Buffer.from('moov'),
        Buffer.from([0, 0, 0, 8]),
        Buffer.from('mdat'),
    ]);
    const invalidMp4Response = await postFile(server.url, {
        field: 'videoInput',
        content: invalidMp4,
        contentType: 'video/mp4',
        filename: 'bad.mp4',
    });
    assert.equal(invalidMp4Response.status, 400);

    assert.deepEqual(await readFilesIfPresent(server.destination), []);
    assert.deepEqual(await fs.readdir(server.tempDirectory), []);
});
