import { ALL_CARRIER_TYPES } from '../domain/dispatch.js';

export const emptyProgress = () => ({
  schema: 1,
  answers: {},
  note: '',
  input: { type: 'cold', weightKg: 4, distanceKm: 120, fragile: false },
  omitDroneCase: false,
  slots: { superclass: '', cold: '', express: '', factory: '' }
});

export const defaultProgress = emptyProgress;

const plain = x =>
  x !== null &&
  typeof x === 'object' &&
  !Array.isArray(x) &&
  (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

const exact = (x, keys) =>
  plain(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));

const safeId = x =>
  typeof x === 'string' &&
  /^[a-z][a-z0-9-]{0,39}$/.test(x) &&
  !['__proto__', 'prototype', 'constructor'].includes(x);

export class LabStorageService {
  constructor({ storage, key = 'poly-dispatch.progress.v1', questions = [] } = {}) {
    this.key = key;
    this.warning = '';
    this.setQuestions(questions);
    try {
      this.storage = storage ?? globalThis.localStorage;
      if (!this.storage) throw Error('blocked');
    } catch {
      this.storage = {
        getItem: () => null,
        setItem: () => {
          throw Error('blocked');
        }
      };
      this.warning = '저장소가 차단되어 이 브라우저에 저장할 수 없어요.';
    }
  }

  setQuestions(questions) {
    this.allowed = new Map();
    for (const q of questions.slice(0, 6)) {
      if (q && typeof q.id === 'string' && Array.isArray(q.options)) {
        this.allowed.set(q.id, new Set(q.options.map(o => o.id)));
      }
    }
  }

  validShape(p) {
    if (
      !exact(p, ['schema', 'answers', 'note', 'input', 'omitDroneCase', 'slots']) ||
      p.schema !== 1 ||
      !plain(p.answers) ||
      Object.keys(p.answers).length > 6 ||
      typeof p.note !== 'string' ||
      p.note.length > 2000 ||
      typeof p.omitDroneCase !== 'boolean'
    ) {
      return false;
    }
    if (!Object.entries(p.answers).every(([k, v]) => safeId(k) && safeId(v))) return false;
    if (
      !exact(p.input, ['type', 'weightKg', 'distanceKm', 'fragile']) ||
      !ALL_CARRIER_TYPES.includes(p.input.type) ||
      !Number.isInteger(p.input.weightKg) ||
      p.input.weightKg < 1 ||
      p.input.weightKg > 20 ||
      !Number.isInteger(p.input.distanceKm) ||
      p.input.distanceKm < 10 ||
      p.input.distanceKm > 300 ||
      typeof p.input.fragile !== 'boolean'
    ) {
      return false;
    }
    return (
      exact(p.slots, ['superclass', 'cold', 'express', 'factory']) &&
      Object.values(p.slots).every(v => typeof v === 'string' && v.length <= 40)
    );
  }

  valid(p) {
    return (
      this.validShape(p) &&
      Object.entries(p.answers).every(([k, v]) => this.allowed.has(k) && this.allowed.get(k).has(v))
    );
  }

  reconcile(p) {
    if (!this.validShape(p)) throw Error('invalid progress');
    const result = structuredClone(p);
    for (const [k, v] of Object.entries(result.answers)) {
      if (!this.allowed.has(k) || !this.allowed.get(k).has(v)) delete result.answers[k];
    }
    return result;
  }

  load() {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return emptyProgress();
      return this.reconcile(JSON.parse(raw));
    } catch {
      this.warning = '저장된 기록을 읽지 못해 새 실험으로 시작했어요.';
      return emptyProgress();
    }
  }

  async save(progress) {
    try {
      if (!this.valid(progress)) throw Error('invalid');
      const serialized = JSON.stringify(progress);
      await this.storage.setItem(this.key, serialized);
    } catch {
      throw Error('이 브라우저에 저장하지 못했어요. 입력은 그대로 유지돼요.');
    }
  }
}

export default emptyProgress;
