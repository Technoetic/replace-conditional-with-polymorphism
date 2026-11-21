import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { APP, build } from '../scripts/build.mjs';
import { PREFIX, bind, createStaticServer } from '../scripts/server.mjs';

test('static server enforces cache headers, CSP, 304 on immutable assets, and genuine 404 on missing assets/data', async () => {
  const outDir = '.qa/test-server-dist';
  const fullOut = path.join(APP, outDir);
  await rm(fullOut, { recursive: true, force: true });
  const report = await build({ outDir });
  const server = createStaticServer({ root: fullOut, prefix: PREFIX });
  await bind(server, 0, '127.0.0.1');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}${PREFIX}`;

  try {
    // Root redirects to prefix
    const rootRes = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
    assert.equal(rootRes.status, 302);
    assert.equal(rootRes.headers.get('location'), PREFIX);

    // Entry HTML: 200, no-store, CSP
    const htmlRes = await fetch(base);
    assert.equal(htmlRes.status, 200);
    assert.equal(htmlRes.headers.get('cache-control'), 'no-store');
    assert.match(htmlRes.headers.get('content-security-policy') || '', /default-src 'self'/);
    assert.equal(htmlRes.headers.get('x-content-type-options'), 'nosniff');

    // version.json & data/lessons.json: no-store
    const verRes = await fetch(`${base}version.json`);
    assert.equal(verRes.status, 200);
    assert.equal(verRes.headers.get('cache-control'), 'no-store');
    const dataRes = await fetch(`${base}data/lessons.json`);
    assert.equal(dataRes.status, 200);
    assert.equal(dataRes.headers.get('cache-control'), 'no-store');

    // Hashed asset: immutable + ETag -> 304
    const assetUrl = `${base}assets/app.${report.buildId}.css`;
    const cssRes = await fetch(assetUrl);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('cache-control') || '', /immutable/);
    const etag = cssRes.headers.get('etag');
    assert.ok(etag);
    const notMod = await fetch(assetUrl, { headers: { 'If-None-Match': etag } });
    assert.equal(notMod.status, 304);

    // Genuine 404 on missing JS asset & missing JSON data
    const missJs = await fetch(`${base}assets/does-not-exist.js`);
    assert.equal(missJs.status, 404);
    assert.match(missJs.headers.get('content-type') || '', /text\/plain/);
    const missData = await fetch(`${base}data/does-not-exist.json`);
    assert.equal(missData.status, 404);

    // Method not allowed
    const postRes = await fetch(base, { method: 'POST' });
    assert.equal(postRes.status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(fullOut, { recursive: true, force: true });
  }
});
