'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Busboy = require('busboy');

module.exports = opts => async (ctx, next) => {
  if (!ctx.is('multipart')) return next();

  try {
    const { files, fields } = await makeMiddleware(ctx.req, opts);

    fields._files = opts.noDisk
      ? files.map(({ value, filename, mimetype }) => ({
        value, options: { filename, contentType: mimetype }
      }))
      : files;

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
 * @param {boolean} [opts.noDisk]  IO on disk or memory
 * @return {{files: array, fields: object}}
 */
function makeMiddleware(req, opts = {}) {
  return new Promise((resolve, reject) => {
    const files = [];
    const fields = {};
    const cacheFn = opts.noDisk ? onMem : onDisk;

    const busboy = new Busboy(Object.assign({}, opts, { headers: req.headers }));

    busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
      if (!filename) return fileStream.resume();
      files.push(cacheFn(fieldname, fileStream, filename, encoding, mimetype));
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

function onDisk(fieldname, fileStream, filename, encoding, mimetype) {
  return new Promise((resolve, reject) => {
    const tmpName = Date.now() + process.pid + fieldname + filename;
    const tmpPath = path.join(os.tmpdir(), path.basename(tmpName));

    fileStream.pipe(fs.createWriteStream(tmpPath))
      .on('error', reject)
      .on('finish', () => {
        const rs = fs.createReadStream(tmpPath);
        rs.on('end', () => {
          try {
            fs.unlinkSync(tmpPath);
          } catch (e) {
            reject(e);
          }
        });

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

function onMem(fieldname, fileStream, filename, encoding, mimetype) {
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
