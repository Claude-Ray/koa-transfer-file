# koa-transfer-file
transfer file stream without saving to disk

## Usage
The `options` same as `busboy`.
```js
const Koa = require('koa');
const transfer = require('koa-transfer-file');

const app = new Koa();

const options = {
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

```js
const { Readable } = require('stream');

const rs = new Readable();
rs._read = () => {};

rs.push(file.value);
rs.pipe(fs.createWriteStream(file.filename))
  .on('finish', () => console.log('saved'));;
```
