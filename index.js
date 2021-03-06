'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Busboy = require('busboy');

module.exports = (opts = {}) => async (ctx, next) => {
  if (!ctx.is('multipart')) return next();

  if (opts.onDisk == null) opts.onDisk = true;
  // `appendFile` is deprecative
  if (opts.appendFile == null) opts.appendFile = true;

  const { files, fields } = await multipartParser(ctx.req, opts);

  if (files.length) {
    if (opts.appendField) {
      const fileFields = restoreFileField(files, opts);
      Object.assign(fields, fileFields);
    } else if (opts.appendFile) {
      ctx.request.formData = opts.onDisk
        ? files
        : files.map(file => adaptFieldValue(file));
      fields._files = ctx.request.formData;
    }
  }

  ctx.request.files = files;
  ctx.request.body = fields;

  return next();
};

/**
 * parse form-data
 * @param {object}  req            ctx.req
 * @param {object}  [opts]         options for busboy
 * @param {boolean} [opts.onDisk]  IO on disk or memory
 * @return {{files: object[], fields: object}}
 */
function multipartParser(req, opts = {}) {
  return new Promise((resolve, reject) => {
    const files = [];
    const fields = {};
    const adapterFunc = opts.onDisk ? toReadStream : toBuffer;

    const busboy = new Busboy(Object.assign({}, opts, { headers: req.headers }));

    busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
      if (!filename) return fileStream.resume();
      files.push(adapterFunc(fieldname, fileStream, filename, encoding, mimetype));
    });

    busboy.on('field', (key, val, keyTrunc, valTrunc) => {
      if (keyTrunc) return reject(new Error(`Field name too long(${key})`));
      if (valTrunc) return reject(new Error(`Field value too long(${key})`));

      if (Object.getOwnPropertyDescriptor(Object.prototype, key)) key = `_${key}`;

      return fields[key] = val;
    });

    busboy.on('error', reject);
    busboy.on('partsLimit', () => reject(new Error('Too many parts')));
    busboy.on('filesLimit', () => reject(new Error('Too many files')));
    busboy.on('fieldsLimit', () => reject(new Error('Too many fields')));
    busboy.on('finish', () => files.length
      ? Promise.all(files)
        .then(files => resolve({ fields, files }))
        .catch(reject)
      : resolve({ fields, files })
    );

    req.pipe(busboy);
  });
}

/**
 * Convert writable fileStream to readable fileStream
 * @param {string} fieldname
 * @param {string} fileStream
 * @param {string} filename
 * @param {string} encoding
 * @param {string} mimetype
 * @return {Promise.<ReadableStream>}
 */
function toReadStream(fieldname, fileStream, filename, encoding, mimetype) {
  return new Promise((resolve, reject) => {
    const tmpName = Date.now() + process.pid + fieldname + filename;
    const tmpPath = path.join(os.tmpdir(), path.basename(tmpName))
      // To Avoid Error: `Path must be a string without null bytes`
      .replace('\u0000', '');

    fileStream.pipe(fs.createWriteStream(tmpPath))
      .on('error', reject)
      .on('finish', () => {
        const rs = fs.createReadStream(tmpPath);
        rs.on('end', () => fs.unlink(tmpPath, e => e && reject(e)));

        Object.assign(rs, {
          filename,
          fieldname,
          encoding,
          mimetype,
          name: filename,
          truncated: fileStream.truncated
        });

        resolve(rs);
      });
  });
}

/**
 * Convert writable fileStream to Buffer as part of an object
 * @param {string} fieldname
 * @param {string} fileStream
 * @param {string} filename
 * @param {string} encoding
 * @param {string} mimetype
 * @return {Promise.<object>}
 */
function toBuffer(fieldname, fileStream, filename, encoding, mimetype) {
  return new Promise((resolve, reject) => {
    const bufs = [];

    fileStream
      .on('data', chunk => bufs.push(chunk))
      .on('error', reject)
      .on('end', () =>
        resolve({
          filename,
          fieldname,
          encoding,
          mimetype,
          value: Buffer.concat(bufs),
          truncated: fileStream.truncated
        })
      );
  });
}

/**
 * Restore files' fields
 * @param {object[]} files
 * @param {object} opts
 * @return {object}
 */
function restoreFileField(files, opts) {
  const fileFields = {};
  for (const file of files) {
    const fieldValue = opts.onDisk ? file : adaptFieldValue(file);

    const { fieldname: fieldName } = file;
    if (!fileFields[fieldName]) {
      fileFields[fieldName] = fieldValue;
    } else if (Array.isArray(fileFields[fieldName])) {
      fileFields[fieldName].push(fieldValue);
    } else {
      fileFields[fieldName] = [fileFields[fieldName], fieldValue];
    }
  }
  return fileFields;
}

/**
 * Adapt the file object to field value, as formData
 * @param {object} file
 * @return {object}
 */
function adaptFieldValue(file) {
  return {
    value: file.value,
    options: {
      filename: file.filename,
      contentType: file.mimetype
    }
  };
}
