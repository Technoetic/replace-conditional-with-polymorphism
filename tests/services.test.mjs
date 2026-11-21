import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { VersionService } from '../src/services/version-service.js';
import { EntryService } from '../src/services/entry-service.js';
import { ContentService } from '../src/services/content-service.js';
import { LabStorageService, emptyProgress } from '../src/services/storage-service.js';
import { APP } from '../scripts/build.mjs';

const jsonResp = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('VersionService detects upgrade A->B, rollback B->A, failures, timeout, and navigation state recheck', async () => {
  assert.throws(() => new VersionService({ baseUrl: 'https://example.com/app/', loadedBuild: '' }));

  let serverBuild = 'pc-aaaaaaaaaaaa';
  let failNext = false;
  const seenOpts = [];
  const vs = new VersionService({
    baseUrl: 'https://example.com/app/',
    loadedBuild: 'pc-aaaaaaaaaaaa',
    timeoutMs: 80,
    fetcher: async (url, opts) => {
      seenOpts.push({ url: String(url), cache: opts.cache });
      if (failNext) return new Response('err', { status: 503 });
      return jsonResp({ schema: 1, buildId: serverBuild });
    }
  });

  const r1 = await vs.refresh();
  assert.equal(r1.changed, false);
  assert.equal(seenOpts[0].cache, 'no-store');
  assert.match(seenOpts[0].url, /version\.json\?_pc_check=/);

  // Upgrade A -> B
  serverBuild = 'pc-bbbbbbbbbbbb';
  const r2 = await vs.refresh();
  assert.equal(r2.changed, true);
  assert.equal(r2.buildId, 'pc-bbbbbbbbbbbb');

  // Clean nav -> reload; dirty nav -> protect; saving nav -> protect
  const navReload = await vs.navigation('https://example.com/app/#/lab', () => ({ dirty: false, saving: false }));
  assert.equal(navReload.kind, 'reload');
  const navDirty = await vs.navigation('https://example.com/app/#/lab', () => ({ dirty: true, saving: false }));
  assert.equal(navDirty.kind, 'protect');
  const navSaving = await vs.navigation('https://example.com/app/#/lab', () => ({ dirty: false, saving: true }));
  assert.equal(navSaving.kind, 'protect');

  // Rollback B -> A (loaded is B, server is A)
  const vsB = new VersionService({
    baseUrl: 'https://example.com/app/',
    loadedBuild: 'pc-bbbbbbbbbbbb',
    fetcher: async () => jsonResp({ schema: 1, buildId: 'pc-aaaaaaaaaaaa' })
  });
  const rollback = await vsB.refresh();
  assert.equal(rollback.changed, true);
  assert.equal(rollback.buildId, 'pc-aaaaaaaaaaaa');

  // Network/HTTP failure preserves app & recovers
  failNext = true;
  const rFail = await vs.refresh();
  assert.equal(rFail.status, 'unavailable');
  failNext = false;
  serverBuild = 'pc-aaaaaaaaaaaa';
  const rRecover = await vs.refresh();
  assert.equal(rRecover.status, 'available');
  assert.equal(rRecover.changed, false);

  // Timeout handled cleanly
  const vsSlow = new VersionService({
    baseUrl: 'https://example.com/app/',
    loadedBuild: 'pc-aaaaaaaaaaaa',
    timeoutMs: 25,
    fetcher: () => new Promise(() => {})
  });
  const rTimeout = await vsSlow.refresh();
  assert.equal(rTimeout.status, 'unavailable');
});

test('EntryService replaces once on startup build mismatch and prevents reload loop', async () => {
  const version = new VersionService({
    baseUrl: 'https://example.com/app/',
    loadedBuild: 'pc-aaaaaaaaaaaa',
    fetcher: async () => jsonResp({ schema: 1, buildId: 'pc-bbbbbbbbbbbb' })
  });

  const replaced = [];
  const entry = new EntryService({
    version,
    currentURL: 'https://example.com/app/#/lab',
    replace: url => replaced.push(url)
  });
  assert.equal(await entry.start(), 'replaced');
  assert.equal(replaced.length, 1);
  assert.match(replaced[0], /_pc=pc-bbbbbbbbbbbb-/);
  assert.match(replaced[0], /#\/lab$/);

  // Already carrying _pc for pendingBuild -> continue (no loop)
  const entry2 = new EntryService({
    version,
    currentURL: replaced[0],
    replace: () => {
      throw Error('should not loop');
    }
  });
  assert.equal(await entry2.start(), 'continue');

  // Dirty state -> continue
  const entryDirty = new EntryService({
    version,
    currentURL: 'https://example.com/app/#/practice',
    readState: () => ({ dirty: true }),
    replace: () => {
      throw Error('should not replace dirty');
    }
  });
  assert.equal(await entryDirty.start(), 'continue');
});

test('ContentService loads valid lessons, rejects invalid schema/source/HTTP, and obeys AbortSignal', async () => {
  const validLessons = JSON.parse(await readFile(path.join(APP, 'data/lessons.json'), 'utf8'));

  const cs = new ContentService({
    baseUrl: 'https://example.com/app/',
    fetcher: async (url, opts) => {
      assert.equal(opts.cache, 'no-store');
      assert.match(String(url), /data\/lessons\.json\?_fresh=/);
      return jsonResp(validLessons);
    }
  });
  const loaded = await cs.load();
  assert.equal(loaded.lessons.length, 6);
  assert.equal(loaded.questions.length, 6);

  // Bad HTTP status
  const cs500 = new ContentService({
    baseUrl: 'https://example.com/app/',
    fetcher: async () => new Response('boom', { status: 500 })
  });
  await assert.rejects(() => cs500.load(), /500/);

  // Bad external source URL
  const badSource = structuredClone(validLessons);
  badSource.sources[0].url = 'https://evil.example/phish';
  const csBadSrc = new ContentService({
    baseUrl: 'https://example.com/app/',
    fetcher: async () => jsonResp(badSource)
  });
  await assert.rejects(() => csBadSrc.load(), /형식/);

  // AbortSignal cancellation
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(() => cs.load(ac.signal), err => err.name === 'AbortError');
});

test('LabStorageService persists, validates, reconciles stale answers, and tolerates blocked storage', async () => {
  const validLessons = JSON.parse(await readFile(path.join(APP, 'data/lessons.json'), 'utf8'));
  const mem = new Map();
  const fakeStorage = {
    getItem: k => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v)
  };
  const svc = new LabStorageService({ storage: fakeStorage, questions: validLessons.questions });

  const p = emptyProgress();
  p.note = '공통 계산은 Parcel에 두고 유형별 차이만 재정의한다.';
  p.answers['q1-signal'] = 'repeated-type-switch';
  p.slots.superclass = 'fragileSurcharge';
  await svc.save(p);

  const restored = svc.load();
  assert.equal(restored.note, p.note);
  assert.equal(restored.answers['q1-signal'], 'repeated-type-switch');
  assert.equal(restored.slots.superclass, 'fragileSurcharge');

  // Reconcile drops stale option while preserving note & slots
  const trimmedQuestions = structuredClone(validLessons.questions);
  trimmedQuestions[0].options = trimmedQuestions[0].options.filter(o => o.id !== 'repeated-type-switch');
  svc.setQuestions(trimmedQuestions);
  const reconciled = svc.reconcile(restored);
  assert.equal(reconciled.answers['q1-signal'], undefined);
  assert.equal(reconciled.note, p.note);
  assert.equal(reconciled.slots.superclass, 'fragileSurcharge');

  // Blocked storage warns and rejects save without throwing in constructor
  const blocked = new LabStorageService({
    storage: {
      getItem() {
        throw Error('denied');
      },
      setItem() {
        throw Error('denied');
      }
    },
    questions: validLessons.questions
  });
  assert.deepEqual(blocked.load(), emptyProgress());
  await assert.rejects(() => blocked.save(emptyProgress()), /저장하지 못했어요/);
});
