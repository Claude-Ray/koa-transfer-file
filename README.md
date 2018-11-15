# koa-transfer-file
transfer file stream without saving to disk

## Featured
- option `noDisk`: (boolean) It determines whether disk I/O is being used during transmission. Converting `Stream` to `Buffer` by array is unsafe when transferring big files. To avoid this problem, using file stream as a default. The temp file will be deleted after new `Readable` stream is built.

- maintain files' name: When sending files to another server, filenames will be changed into tmpName because of the new readable stream. Solved by adding property `name` to the readable stream, due to the package `form-data` will name the file by `filestream.name` or `filestream.path` when appending data.

## Usage
The `options` almost same as `busboy`.
```js
const Koa = require('koa');
const transfer = require('koa-transfer-file');

const app = new Koa();

const options = {
  noDisk: false, // (default false)
  limits: {
    fileSize: 1024 * 5
  }
}

app.use(transfer(options));
```

Files can be got from `ctx.request.files`.
```js
ctx.request.files.forEach(file => {
  const {
    filename,
    fieldname,
    encoding,
    mimetype,
    value, // data in buffer
    truncated,
  } = file;
});
```

## Transfer
transfer formData by `request`
```js
const formData = {};

formData[file.fieldname] = {
  value: file.value,
  options: {
    filename: file.filename,
    contentType: file.mimetype
  }
}
```

## Save
For each `file` of `ctx.request.files`:

1. By default, `file` is a readable stream.
```js
const rs = file;
```

2. When `opts.onDisk` is set to false, `file.value` contains a Buffer.
```js
const { Readable } = require('stream');

const rs = new Readable();
rs._read = () => {};

rs.push(file.value);
```

Then write the stream to the file.
```js
rs.pipe(fs.createWriteStream(file.filename))
  .on('finish', () => console.log('saved'));;
```
