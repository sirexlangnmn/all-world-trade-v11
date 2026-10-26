const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_UPLOAD_DIRECTORY = path.resolve(__dirname, '../../public/uploads/users_upload_files');
const FAILURE_RESPONSE = {
    status: 'error',
    message: 'The upload could not be saved.',
};

async function removeRequestFiles(req, uploadDirectory, unlink) {
    const root = path.resolve(uploadDirectory);
    const files = Object.values(req.files || {}).flat();
    const paths = new Set();
    const errors = [];

    for (const file of files) {
        if (!file || typeof file.path !== 'string') {
            continue;
        }

        const filePath = path.resolve(file.path);
        const relativePath = path.relative(root, filePath);
        if (
            !relativePath ||
            relativePath === '..' ||
            relativePath.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativePath)
        ) {
            errors.push(new Error('Refused to remove a business media file outside the upload directory.'));
            continue;
        }

        paths.add(filePath);
    }

    for (const filePath of paths) {
        try {
            await unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                errors.push(error);
            }
        }
    }

    return errors;
}

function executeBusinessMediaQuery(db, req, res, query, values, onSuccess, options = {}) {
    const { uploadDirectory = DEFAULT_UPLOAD_DIRECTORY, unlink = fs.unlink, logger = console } = options;
    let completed = false;

    function sendFailureResponse() {
        if (!res.headersSent) {
            res.status(500).json(FAILURE_RESPONSE);
        }
    }

    function handleFailure(error) {
        if (completed) {
            return;
        }
        completed = true;

        logger.error('Business media persistence failed:', error);
        removeRequestFiles(req, uploadDirectory, unlink)
            .then((cleanupErrors) => {
                cleanupErrors.forEach((cleanupError) => {
                    logger.error('Business media upload cleanup failed:', cleanupError);
                });
                sendFailureResponse();
            })
            .catch((cleanupError) => {
                logger.error('Business media upload cleanup failed:', cleanupError);
                sendFailureResponse();
            });
    }

    try {
        db.query(query, values, (error, result) => {
            if (completed) {
                return;
            }

            if (error) {
                handleFailure(error);
                return;
            }

            completed = true;
            onSuccess(error, result);
        });
    } catch (error) {
        if (completed) {
            throw error;
        }
        handleFailure(error);
    }
}

module.exports = executeBusinessMediaQuery;
