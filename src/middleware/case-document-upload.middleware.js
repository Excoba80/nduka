'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx'
]);

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);


/*
 * Store uploads temporarily in memory.
 *
 * The Case Document service will perform the
 * final protected storage operation after
 * all Case/document validation has passed.
 */
const storage = multer.memoryStorage();


/*
 * Validate the uploaded file before accepting it.
 */
function fileFilter(req, file, callback) {

    const extension =
        path.extname(file.originalname || '')
            .toLowerCase();

    const mimeType =
        String(file.mimetype || '')
            .toLowerCase();


    if (!ALLOWED_EXTENSIONS.has(extension)) {

        return callback(
            new Error(
                'Unsupported document file type.'
            )
        );
    }


    if (!ALLOWED_MIME_TYPES.has(mimeType)) {

        return callback(
            new Error(
                'Unsupported document MIME type.'
            )
        );
    }


    callback(null, true);
}


const uploadCaseDocument =
    multer({
        storage,

        limits: {
            fileSize: MAX_FILE_SIZE,
            files: 1
        },

        fileFilter
    });


/*
 * Generate a cryptographically random
 * storage filename.
 *
 * The original filename is never used as
 * the physical storage filename.
 */
function generateStorageKey() {

    const randomPart =
        crypto.randomBytes(32).toString('hex');

    return randomPart;
}


module.exports = {
    uploadCaseDocument,
    generateStorageKey,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES
};
