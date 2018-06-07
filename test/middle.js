'use strict';

const http = require('http');
const Koa = require('koa');
const request = require('request-promise');

const transfer = require('..');

const app = new Koa();

app.use(transfer({
  noDisk: true,
  limits: {
    files: 2,
    fileSize: 1024 * 15
  }
}));

app.use((ctx, next) => {
  request({
    method: 'POST',
    uri: 'http://localhost:3000',
    formData: ctx.request.body
  });
  next();
});

app.on('error', e => {
  console.error('server error', e);
});

http.createServer(app.callback())
  .on('error', e => console.error(e))
  .on('listening', () => console.info(`listening port 3001`))
  .listen(3001);
