const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform, pipeline } = require('node:stream');
const multer = require('multer');
const sharp = require('sharp');

const MiB = 1024 * 1024;
const MAX_FILE_SIZE = 50 * MiB;
const MAX_IMAGE_PIXELS = 40_000_000;

const FILE_POLICIES = Object.freeze({
    companyLogo: { mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 2 * MiB },
    companyBanner: { mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 2 * MiB },
    thumbnailInput: { mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 2 * MiB },
    webinarsThumbnailInput: { mimeTypes: ['image/jpeg', 'image/png'], maxBytes: 2 * MiB },
    brochureInput: { mimeTypes: ['application/pdf'], maxBytes: 10 * MiB },
    brochure: { mimeTypes: ['application/pdf'], maxBytes: 10 * MiB },
    editBrochure: { mimeTypes: ['application/pdf'], maxBytes: 10 * MiB },
    videoInput: { mimeTypes: ['video/mp4'], maxBytes: 50 * MiB },
});

const CONTENT_TYPES = Object.freeze({
    'image/jpeg': { extension: 'jpg', sharpFormat: 'jpeg' },
    'image/png': { extension: 'png', sharpFormat: 'png' },
    'application/pdf': { extension: 'pdf' },
    'video/mp4': { extension: 'mp4' },
});

class InvalidUploadError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidUploadError';
        this.code = 'INVALID_UPLOAD';
    }
}

class UploadTooLargeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UploadTooLargeError';
        this.code = 'UPLOAD_TOO_LARGE';
    }
}

function getFiles(files = {}) {
    return Object.values(files).flat();
}

async function removeFiles(filePaths) {
    const errors = [];

    for (const filePath of new Set(filePaths.filter(Boolean))) {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                errors.push(error);
            }
        }
    }

    if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to remove temporary upload files.');
    }
}

async function validateImage(file, policy) {
    const expectedFormat = CONTENT_TYPES[file.mimetype].sharpFormat;
    let metadata;

    try {
        metadata = await sharp(file.path, {
            failOn: 'error',
            limitInputPixels: MAX_IMAGE_PIXELS,
        }).metadata();
    } catch {
        throw new InvalidUploadError('The uploaded image is invalid or unsupported.');
    }

    if (!policy.mimeTypes.includes(file.mimetype) || metadata.format !== expectedFormat) {
        throw new InvalidUploadError('The uploaded image content does not match its declared type.');
    }

    const sanitizedPath = `${file.path}.${CONTENT_TYPES[file.mimetype].extension}`;

    try {
        const image = sharp(file.path, {
            failOn: 'error',
            limitInputPixels: MAX_IMAGE_PIXELS,
        }).rotate();

        if (expectedFormat === 'jpeg') {
            await image.jpeg({ quality: 90 }).toFile(sanitizedPath);
        } else {
            await image.png({ compressionLevel: 9 }).toFile(sanitizedPath);
        }
    } catch {
        throw new InvalidUploadError('The uploaded image could not be safely processed.');
    }

    file.sanitizedPath = sanitizedPath;
    return CONTENT_TYPES[file.mimetype].extension;
}

async function validatePdf(file) {
    const content = await fs.readFile(file.path);
    const text = content.toString('latin1');
    const startXref = text.lastIndexOf('startxref');
    const xrefMatch = text.slice(startXref).match(/^startxref\s+(\d+)\s+%%EOF\b/s);

    if (!text.startsWith('%PDF-') || startXref < 0 || !xrefMatch || !text.includes('/Type /Catalog')) {
        throw new InvalidUploadError('The uploaded PDF is invalid.');
    }

    const xrefOffset = Number(xrefMatch[1]);
    const xrefEntry = text.slice(xrefOffset, xrefOffset + 1024);
    if (!/^xref(?:\s|$)/.test(xrefEntry) && !/^\d+\s+\d+\s+obj\b[\s\S]*?\/Type\s*\/XRef\b/.test(xrefEntry)) {
        throw new InvalidUploadError('The uploaded PDF has an invalid cross-reference table.');
    }

    return 'pdf';
}

async function containsVideoHandler(handle, boxOffset, boxSize) {
    const chunkSize = 64 * 1024;
    const overlap = 16;
    const end = boxOffset + boxSize;

    for (let offset = boxOffset + 8; offset < end; ) {
        const length = Math.min(chunkSize, end - offset);
        const chunk = Buffer.alloc(length);
        const result = await handle.read(chunk, 0, length, offset);
        const hdlrType = Buffer.from('hdlr');

        for (let index = chunk.indexOf(hdlrType); index >= 0; index = chunk.indexOf(hdlrType, index + 1)) {
            const handlerTypeOffset = index + 12;
            if (
                handlerTypeOffset + 4 <= result.bytesRead &&
                chunk.toString('ascii', handlerTypeOffset, handlerTypeOffset + 4) === 'vide'
            ) {
                return true;
            }
        }

        if (offset + result.bytesRead >= end) {
            break;
        }
        offset += Math.max(1, result.bytesRead - overlap);
    }

    return false;
}

async function validateMp4(file) {
    const handle = await fs.open(file.path, 'r');

    try {
        const { size } = await handle.stat();
        let offset = 0;
        let hasFileType = false;
        let hasMovie = false;
        let hasMediaData = false;
        let movieOffset = 0;
        let movieSize = 0;
        let boxCount = 0;

        while (offset + 8 <= size && boxCount < 1024) {
            const header = Buffer.alloc(16);
            const readLength = Math.min(header.length, size - offset);
            const result = await handle.read(header, 0, readLength, offset);
            if (result.bytesRead < 8) {
                break;
            }

            const boxType = header.toString('ascii', 4, 8);
            let boxSize = header.readUInt32BE(0);
            let headerSize = 8;

            if (boxSize === 1) {
                if (result.bytesRead < 16) {
                    break;
                }
                const largeSize = header.readBigUInt64BE(8);
                if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
                    break;
                }
                boxSize = Number(largeSize);
                headerSize = 16;
            } else if (boxSize === 0) {
                boxSize = size - offset;
            }

            if (boxSize < headerSize || boxSize > size - offset) {
                break;
            }

            hasFileType ||= boxType === 'ftyp';
            if (boxType === 'moov') {
                hasMovie = true;
                movieOffset = offset;
                movieSize = boxSize;
            }
            hasMediaData ||= boxType === 'mdat';
            offset += boxSize;
            boxCount += 1;
        }

        if (
            offset !== size ||
            !hasFileType ||
            !hasMovie ||
            !hasMediaData ||
            !(await containsVideoHandler(handle, movieOffset, movieSize))
        ) {
            throw new InvalidUploadError('The uploaded file is not a valid MP4 video.');
        }
    } finally {
        await handle.close();
    }

    return 'mp4';
}

async function validateContent(file, policy) {
    if (file.mimetype.startsWith('image/')) {
        return validateImage(file, policy);
    }
    if (file.mimetype === 'application/pdf') {
        return validatePdf(file);
    }
    if (file.mimetype === 'video/mp4') {
        return validateMp4(file);
    }

    throw new InvalidUploadError('The uploaded file type is not supported.');
}

function getErrorResponse(error) {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return { status: 413, message: 'The uploaded file exceeds the maximum allowed size.' };
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return { status: 400, message: 'The upload contains an unsupported file field or too many files.' };
        }

        return { status: 400, message: 'The upload request contains too many fields or files.' };
    }

    if (error instanceof InvalidUploadError) {
        return { status: 400, message: error.message };
    }

    if (error instanceof UploadTooLargeError) {
        return { status: 413, message: error.message };
    }

    return { status: 500, message: 'The upload could not be processed.' };
}

function createBusinessMediaUpload(destination, tempDirectory = os.tmpdir()) {
    const storage = {
        _handleFile(req, file, callback) {
            const policy = FILE_POLICIES[file.fieldname];
            const filename = randomUUID();
            const filePath = path.join(tempDirectory, filename);
            let size = 0;
            const sizeLimit = new Transform({
                transform(chunk, encoding, transformCallback) {
                    size += chunk.length;
                    if (size > policy.maxBytes) {
                        return transformCallback(
                            new UploadTooLargeError(
                                'The uploaded file exceeds the maximum allowed size for this field.',
                            ),
                        );
                    }
                    transformCallback(null, chunk);
                },
            });

            pipeline(file.stream, sizeLimit, createWriteStream(filePath, { flags: 'wx' }), (error) => {
                if (error) {
                    return fs.unlink(filePath).then(
                        () => callback(error),
                        (cleanupError) => {
                            if (cleanupError.code === 'ENOENT') {
                                return callback(error);
                            }
                            callback(
                                new AggregateError(
                                    [error, cleanupError],
                                    'Upload failed and temporary file cleanup failed.',
                                ),
                            );
                        },
                    );
                }

                callback(null, {
                    destination: tempDirectory,
                    filename,
                    path: filePath,
                    size,
                });
            });
        },
        _removeFile(req, file, callback) {
            fs.unlink(file.path).then(
                () => callback(null),
                (error) => callback(error.code === 'ENOENT' ? null : error),
            );
        },
    };

    const upload = multer({
        storage,
        fileFilter: (req, file, callback) => {
            const policy = FILE_POLICIES[file.fieldname];
            if (!policy || !policy.mimeTypes.includes(file.mimetype)) {
                const error = new InvalidUploadError('The uploaded file type is not supported for this field.');
                return callback(error);
            }
            callback(null, true);
        },
        limits: {
            fileSize: MAX_FILE_SIZE,
            files: Object.keys(FILE_POLICIES).length,
            fields: 128,
            fieldSize: 64 * 1024,
            parts: 128 + Object.keys(FILE_POLICIES).length,
        },
    });

    return {
        fields(fieldDefinitions) {
            const parseFields = upload.fields(fieldDefinitions);

            return (req, res, next) => {
                parseFields(req, res, (parseError) => {
                    const files = getFiles(req.files);
                    if (parseError) {
                        return handleUploadError(parseError, files, res);
                    }
                    if (files.length === 0) {
                        return res.status(400).json({
                            status: 'error',
                            message: 'At least one file is required for this upload.',
                        });
                    }

                    processFiles(files, destination)
                        .then(() => next())
                        .catch((error) => handleUploadError(error, files, res));
                });
            };
        },
    };
}

async function processFiles(files, destination) {
    const publicPaths = [];

    try {
        for (const file of files) {
            const policy = FILE_POLICIES[file.fieldname];
            if (!policy) {
                throw new InvalidUploadError('The uploaded file field is not supported.');
            }
            if (file.size > policy.maxBytes) {
                throw new UploadTooLargeError('The uploaded file exceeds the maximum allowed size for this field.');
            }

            file.extension = await validateContent(file, policy);
        }

        await fs.mkdir(destination, { recursive: true });

        for (const file of files) {
            file.temporaryPath = file.path;
            const filename = `${file.fieldname}-${randomUUID()}.${file.extension}`;
            const finalPath = path.join(destination, filename);
            const stagingPath = path.join(destination, `.${randomUUID()}.upload`);
            const sourcePath = file.sanitizedPath || file.path;

            await fs.copyFile(sourcePath, stagingPath);
            publicPaths.push(stagingPath);
            await fs.rename(stagingPath, finalPath);
            publicPaths[publicPaths.length - 1] = finalPath;
            file.filename = filename;
            file.path = finalPath;
        }

        await removeFiles(files.flatMap((file) => [file.temporaryPath, file.sanitizedPath]));
        files.forEach((file) => {
            file.path = path.join(destination, file.filename);
            delete file.temporaryPath;
            delete file.sanitizedPath;
        });
    } catch (error) {
        try {
            await removeFiles([
                ...publicPaths,
                ...files.flatMap((file) => [file.path, file.temporaryPath, file.sanitizedPath]),
            ]);
        } catch (cleanupError) {
            throw new AggregateError([error, cleanupError], 'Upload processing and cleanup both failed.');
        }
        throw error;
    }
}

async function handleUploadError(error, files, res) {
    try {
        await removeFiles(files.flatMap((file) => [file.path, file.temporaryPath, file.sanitizedPath]));
    } catch (cleanupError) {
        console.error('Business media upload cleanup failed:', cleanupError);
        if (!res.headersSent) {
            return res.status(500).json({ status: 'error', message: 'The upload could not be processed.' });
        }
        return;
    }

    const response = getErrorResponse(error);
    if (response.status === 500) {
        console.error('Business media upload failed:', error);
    }

    if (!res.headersSent) {
        res.status(response.status).json({ status: 'error', message: response.message });
    }
}

module.exports = createBusinessMediaUpload;
