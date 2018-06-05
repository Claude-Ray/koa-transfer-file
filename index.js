'use strict';

const appendField = require('append-field');
const Busboy = require('busboy');

module.exports = opts => async (ctx, next) => {
  if (!ctx.is('multipart')) return next();

  try {
    const { files, fields } = await makeMiddleware(ctx.req, opts);
    ctx.request.files = files;
    ctx.request.body = fields;
  } catch (e) {
    throw e;
  }

  return next();
};

function makeMiddleware(req, opts = {}) {
  return new Promise((resolve, reject) => {
    const files = [];
    const fields = Object.create(null);

    const busboy = new Busboy(Object.assign({}, opts, {headers: req.headers}));

    busboy.on('file', (fieldname, fileStream, filename, encoding, mimetype) => {
      if (!filename) return fileStream.resume();

      files.push(new Promise((resolve, reject) => {
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
      }));
    });

    busboy.on('field', (key, val, keyTrunc, valTrunc) => {
      if (keyTrunc) return reject(new Error(`Field name too long(${key})`));
      if (valTrunc) return reject(new Error(`Field value too long(${key})`));

      return appendField(fields, key, val);
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
