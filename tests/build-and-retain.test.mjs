import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { APP, build } from '../scripts/build.mjs';
import { retainAssets } from '../scripts/retain-assets.mjs';

test('build emits hashed JS/CSS/SVG assets, version.json, lessons.json, and resolves all tokens', async () => {
  const outDir = '.qa/test-build-out';
  const fullOut = path.join(APP, outDir);
  await rm(fullOut, { recursive: true, force: true });
  try {
    const report = await build({ outDir, tag: 'a1' });
    assert.match(report.buildId, /^pc-[a-f\d]{12}-a1$/);
    assert.equal(report.modules, 17);
    assert.equal(report.externalDependencies, 0);

    const html = await readFile(path.join(fullOut, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /__[A-Z_]+__/);
    assert.match(html, new RegExp(`content="${report.buildId}"`));
    assert.match(html, new RegExp(`assets/main\\.${report.buildId}\\.js`));
    assert.match(html, new RegExp(`assets/app\\.${report.buildId}\\.css`));
    assert.match(html, new RegExp(`assets/poly-mark\\.${report.buildId}\\.svg`));

    const version = JSON.parse(await readFile(path.join(fullOut, 'version.json'), 'utf8'));
    assert.equal(version.buildId, report.buildId);
    await stat(path.join(fullOut, '.nojekyll'));
    await stat(path.join(fullOut, 'data/lessons.json'));
  } finally {
    await rm(fullOut, { recursive: true, force: true });
  }
});

test('retainAssets retains ONLY immediately previous build assets, verifies SHA-256, and rejects tampering', async () => {
  const outDir = path.join(APP, '.qa/test-retain-out');
  await rm(outDir, { recursive: true, force: true });
  try {
    // allowEmpty on 404
    const empty = await retainAssets({
      outDir,
      allowEmpty: true,
      fetcher: async () => new Response('not found', { status: 404 })
    });
    assert.deepEqual(empty, { retained: 0, previousBuild: null });

    const assetCurr = Buffer.from('console.log("curr");');
    const assetOld = Buffer.from('console.log("old-n-minus-2");');
    const shaCurr = createHash('sha256').update(assetCurr).digest('hex');
    const shaOld = createHash('sha256').update(assetOld).digest('hex');
    const manifest = {
      schema: 1,
      buildId: 'pc-111111111111',
      sourceCommit: 'a'.repeat(40),
      files: {
        'index.html': '0'.repeat(64),
        'version.json': '0'.repeat(64),
        'data/lessons.json': '0'.repeat(64),
        'assets/main.pc-111111111111.js': shaCurr,
        'assets/main.pc-000000000000.js': shaOld
      }
    };
    const fakeFetch = async url => {
      const pathname = new URL(url).pathname;
      if (pathname.endsWith('pages-manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 });
      if (pathname.endsWith('version.json')) return new Response(JSON.stringify({ schema: 1, buildId: manifest.buildId }), { status: 200 });
      if (pathname.endsWith('assets/main.pc-111111111111.js')) return new Response(assetCurr, { status: 200 });
      return new Response('missing', { status: 404 });
    };

    const res = await retainAssets({ outDir, fetcher: fakeFetch });
    assert.equal(res.retained, 1);
    assert.equal(res.previousBuild, 'pc-111111111111');
    const saved = await readFile(path.join(outDir, 'assets/main.pc-111111111111.js'));
    assert.deepEqual(saved, assetCurr);

    // Tampered hash must throw
    await assert.rejects(
      () =>
        retainAssets({
          outDir,
          fetcher: async url => {
            const pathname = new URL(url).pathname;
            if (pathname.endsWith('pages-manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 });
            if (pathname.endsWith('version.json')) return new Response(JSON.stringify({ schema: 1, buildId: manifest.buildId }), { status: 200 });
            return new Response(Buffer.from('tampered!'), { status: 200 });
          }
        }),
      /hash mismatch/
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
