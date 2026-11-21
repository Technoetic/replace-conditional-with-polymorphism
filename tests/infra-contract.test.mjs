import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP } from '../scripts/build.mjs';
import { ROUTES } from '../src/shared/routes.js';

test('GitHub Pages workflow pins all Actions to 40-char commit SHAs and runs test/retain/build/manifest', async () => {
  const yml = await readFile(path.join(APP, '.github/workflows/pages.yml'), 'utf8');
  const uses = [...yml.matchAll(/uses:\s*([^\s#]+)/g)].map(m => m[1]);
  assert.equal(uses.length, 4);
  for (const ref of uses) {
    assert.match(ref, /^actions\/[a-z-]+@[a-f0-9]{40}$/, `Action not SHA-pinned: ${ref}`);
  }
  assert.match(yml, /npm test/);
  assert.match(yml, /retain-assets\.mjs/);
  assert.match(yml, /npm run build/);
  assert.match(yml, /manifest\.mjs/);
});

test('CSS layers, CSP, build meta, lessons.json, and screen lifecycle contracts are intact', async () => {
  for (const layer of ['tokens.css', 'base.css', 'components.css']) {
    const css = await readFile(path.join(APP, 'src/styles', layer), 'utf8');
    assert.ok(css.trim().length > 50, `${layer} too short`);
  }

  const html = await readFile(path.join(APP, 'index.html'), 'utf8');
  assert.match(html, /<meta name="app-build" content="__BUILD_ID__">/);
  assert.match(html, /Content-Security-Policy/);

  const content = JSON.parse(await readFile(path.join(APP, 'data/lessons.json'), 'utf8'));
  assert.equal(content.schema, 1);
  assert.deepEqual(
    content.lessons.map(l => l.id),
    ROUTES.map(r => r.id)
  );
  assert.equal(content.questions.length, 6);
  assert.equal(content.sources.length, 2);

  // CodeScreen guards clipboard async completion against disposed screen
  const codeScreen = await readFile(path.join(APP, 'src/screens/code-screen.js'), 'utf8');
  assert.match(codeScreen, /if \(this\.disposed\) return;/);

  // VersionService compares inequality (!== or === -> null) rather than version ordering
  const versionSvc = await readFile(path.join(APP, 'src/services/version-service.js'), 'utf8');
  assert.match(versionSvc, /buildId === this\.loadedBuild \? null : buildId/);
});
