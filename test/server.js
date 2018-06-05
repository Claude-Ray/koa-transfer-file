'use strict';

const fs = require('fs');
const http = require('http');
const Koa = require('koa');
const stream = require('stream');
const { Readable } = stream;

const transfer = require('..');

const app = new Koa();

app.use(transfer({
  limits: {
    files: 2,
    fileSize: 1024 * 15
  }
}));

app.use((ctx, next) => {
  const { files = [] } = ctx.request;

  ctx.body = 'Hello World';
  files.forEach(file => {
    const rs = new Readable();
    rs._read = () => { };
    rs.push(file.value);

    rs.pipe(fs.createWriteStream(file.filename))
      .on('finish', () => console.log('saved'));
  });
});

app.on('error', e => {
  console.error('server error', e);
});

http.createServer(app.callback())
  .on('error', e => console.error(e))
  .on('listening', () => console.info(`listening port 3000`))
  .listen(3000);
