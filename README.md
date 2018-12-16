# koa-transfer-file
[![npm version](https://img.shields.io/npm/v/koa-transfer-file.svg)](https://www.npmjs.com/package/koa-transfer-file)
[![Build Status](https://travis-ci.org/Claude-Ray/koa-transfer-file.svg?branch=master)](https://travis-ci.org/Claude-Ray/koa-transfer-file)
[![codecov](https://codecov.io/gh/Claude-Ray/koa-transfer-file/branch/master/graph/badge.svg)](https://codecov.io/gh/Claude-Ray/koa-transfer-file)

**Package under development. Please `lock` the specific version in `package.json` or `package-lock.json`.**

Transfer file stream without storing files.

This package is mainly used for the middle layer.

## Featured
- option `onDisk`: (boolean, default true) It determines whether disk I/O is being used during transmission. Converting `Stream` to `Buffer` by array is unsafe when transferring big files. To avoid this problem, using file stream as a default. The temp file will be deleted after new `Readable` stream is built.

- maintain files' name: When sending files to another server, filenames will be changed into tmpName because of the new readable stream. Solved by adding property `name` to the readable stream, due to the package `form-data` will name the file by `filestream.name` or `filestream.path` when appending data.

- option `appendField`: (boolean, default false) Append files to `ctx.request.body` in order to keep it(formData) the same as before the request was sent.

- option `appendFile`: (boolean, default true, **deprecative**) Highly recommanded `false`. Append all files in an array to `ctx.request.body` with fieldname `_files`. The difference between ctx.request.body._files and ctx.request.files is that `_files` has been formatted for the puropse of transferring directly by request.
  > The default value is only for compatibility with the old versions temporarily. It's innocent when you don't care about files' fieldname.

## Install
```
npm install koa-transfer-file
```

## Usage
The `options` almost same as `busboy`.
```js
const Koa = require('koa');
const transfer = require('koa-transfer-file');

const app = new Koa();

const options = {
  onDisk: true, // (boolean, default true)
  limits: {
    fileSize: 1024 * 5
  }
}

app.use(transfer(options));
```

## Transfer
Transfer formData by `request` directly.
```js
const request = require('request-promise');

app.use((ctx, next) => {
  const formData = ctx.request.body;
  request({
    method: 'POST',
    uri: 'http://localhost:3000',
    formData
  });
  next();
});
```

Or configure the formData's value manually when `opts.onDisk=false`.
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

Then save the readable stream to the file.
```js
rs.pipe(fs.createWriteStream(file.filename))
  .on('finish', () => console.log('saved'));;
```

# API

## Opts
Please refer to [Featured](#Featured) for description of the options.

## File information
Files (<object[]>) can be got from `ctx.request.files`.

The properties of each file are as shown below.

### Certain Properties
|Key|Desc|
|---|---|
|filename|original name of the file|
|fieldname|field name specified in the form	|
|encoding|-|
|mimetype|-|
|truncated|stream is truncated or not (file reached limit size)|

### *opts.onDisk = true*
|Key|Desc|
|---|---|
|name|alias of filename|

### *opts.onDisk = false*
|Key|Desc|
|---|---|
|value|file data in buffer|
