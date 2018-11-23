'use strict';

const Busboy = require('busboy');
const Koa = require('koa');
const request = require('supertest');
const requestPromise = require('request-promise');

const transfer = require('..');

describe('transfer', () => {
  let app;
  beforeAll(() => {
    const backServer = new Koa();
    backServer.use(async ctx => {
      const busboy = new Busboy({ headers: ctx.req.headers });
      ctx.body = await new Promise(resolve => {
        let name;
        busboy.on('file', (fieldname, fileStream, filename) => {
          name = filename;
          return fileStream.resume();
        });
        busboy.on('finish', () => resolve(name));
        ctx.req.pipe(busboy);
      });
    });
    backServer.listen(3000);
  });

  beforeEach(() => {
    app = new Koa();
  });

  test('transfer buffer', async () => {
    const buff = Buffer.from('test buffer');
    app.use(transfer({ noDisk: true }));
    app.use(async ctx => {
      ctx.body = await requestPromise({
        method: 'POST',
        uri: 'http://localhost:3000',
        formData: ctx.request.body
      });
    });

    await request(app.listen())
      .post('/')
      .attach('file', buff, 'buff.md')
      .expect(200)
      .then(res => {
        expect(res.text).toBe('buff.md');
      });
  });

  test('transfer stream', async () => {
    const buff = Buffer.from('test stream');
    app.use(transfer({ noDisk: false }));
    app.use(async ctx => {
      ctx.body = await requestPromise({
        method: 'POST',
        uri: 'http://localhost:3000',
        formData: ctx.request.body
      });
    });

    await request(app.listen())
      .post('/')
      .attach('file', buff, 'stream.md')
      .expect(200)
      .then(res => {
        expect(res.text).toBe('stream.md');
      });
  });
});

describe('parser', () => {
  let app;
  beforeEach(() => {
    app = new Koa();
  });

  test('parse to buffer', async () => {
    const buff = Buffer.from('test buffer');
    app.use(transfer({ noDisk: true }));
    app.use(ctx => {
      expect(ctx.request.files).toHaveLength(1);
      ctx.request.files.map(file => {
        expect(buff.equals(file.value)).toBeTruthy();
      });
      ctx.status = 200;
    });

    await request(app.listen())
      .post('/')
      .attach('file', buff, 'buff.md')
      .expect(200);
  });

  test('parse fields', async () => {
    app.use(transfer({ noDisk: true }));
    app.use(ctx => {
      expect(ctx.request.body)
        .toMatchObject({ whoami: 'Claude', pwd: 'test' });
      ctx.status = 200;
    });

    await request(app.listen())
      .post('/')
      .field('whoami', 'Claude')
      .field('pwd', 'test')
      .expect(200);
  });

  test('ignore non-mulitpart', async () => {
    app.use(transfer({ noDisk: true }));
    app.use(ctx => {
      expect(ctx.request.body).toBeUndefined();
      ctx.status = 200;
    });

    await request(app.listen())
      .post('/')
      .send({ whoami: 'Claude' })
      .expect(200);
  });

  test('parse to stream', async () => {
    const buff = Buffer.from('test buffer');
    app.use(transfer());
    app.use(async ctx => {
      expect(ctx.request.files).toHaveLength(1);
      for (const file of ctx.request.files) {
        const fileBuff = await new Promise(resolve => {
          const chunks = [];
          file.on('data', chunk => chunks.push(chunk))
            .on('end', () => resolve(Buffer.concat(chunks)));
        });
        expect(buff.equals(fileBuff)).toBeTruthy();
      }
      ctx.status = 200;
    });

    await request(app.listen())
      .post('/')
      .attach('file', buff, 'buff.md')
      .expect(200);
  });
});
