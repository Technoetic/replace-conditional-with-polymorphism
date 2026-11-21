import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, normalizePath, parseRoute, routeUrl } from '../src/shared/routes.js';

test('ROUTES defines 6 unique screens and route helpers normalize and resolve URLs', () => {
  assert.equal(ROUTES.length, 6);
  assert.equal(new Set(ROUTES.map(r => r.id)).size, 6);
  assert.equal(new Set(ROUTES.map(r => r.path)).size, 6);

  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('#'), '/');
  assert.equal(normalizePath('#/'), '/');
  assert.equal(normalizePath('#/lab/'), '/lab');
  assert.equal(normalizePath('#/practice?foo=1'), '/practice');
  assert.equal(normalizePath('code'), '/code');

  assert.deepEqual(parseRoute('#/lab'), { path: '/lab', id: 'lab', known: true });
  assert.deepEqual(parseRoute('#/unknown-screen'), { path: '/unknown-screen', id: null, known: false });

  const url = routeUrl('/code', 'https://technoetic.github.io/replace-conditional-with-polymorphism/');
  assert.equal(url.href, 'https://technoetic.github.io/replace-conditional-with-polymorphism/#/code');
});
