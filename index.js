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

  try {
    const { files, fields } = await multipartParser(ctx.req, opts);

    if (files.length) {
      if (opts.appendField) {
        const fileFields = {};
        for (const file of files) {
          const { fieldname: fieldName } = file;
          const fieldValue = opts.onDisk ? file : {
            value: file.value,
            options: {
              filename: file.filename,
              contentType: file.mimetype
            }
          };

          if (!fileFields[fieldName]) {
            fileFields[fieldName] = fieldValue;
          } else if (Array.isArray(fileFields[fieldName])) {
            fileFields[fieldName].push(fieldValue);
          } else {
            fileFields[fieldName] = [fileFields[fieldName], fieldValue];
          }
        }

        Object.assign(fields, fileFields);
      } else if (opts.appendFile) {
        ctx.request.formData = opts.onDisk
          ? files
          : files.map(({ value, filename, mimetype }) => ({
            value, options: { filename, contentType: mimetype }
          }));
        fields._files = ctx.request.formData;
      }
    }

    ctx.request.files = files;
    ctx.request.body = fields;
  } catch (e) {
    throw e;
  }

  return next();
};

/**
 * parse form-data
 * @param {object}  req            ctx.req
 * @param {object}  [opts]         options for busboy
 * @param {boolean} [opts.onDisk]  IO on disk or memory
 * @return {{files: array, fields: object}}
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

      if (key === 'hasOwnProperty') key = `_${key}`;

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
