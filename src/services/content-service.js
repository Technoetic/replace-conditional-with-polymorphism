const IDS = ['intro', 'read', 'split', 'lab', 'practice', 'code'];
const SOURCES = new Set([
  'https://refactoring.com/catalog/replaceConditionalWithPolymorphism.html',
  'https://refactoring.com/catalog/replaceTypeCodeWithSubclasses.html'
]);

const text = x => typeof x === 'string' && x.trim().length > 0;
const id = x => typeof x === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(x);
const unique = xs => new Set(xs).size === xs.length;

export class ContentService {
  constructor({ baseUrl, fetcher = globalThis.fetch.bind(globalThis), timeoutMs = 6000 }) {
    Object.assign(this, { baseUrl: new URL(baseUrl), fetcher, timeoutMs });
  }

  async load(signal) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const ctrl = new AbortController();
    let timer;
    let rejectAbort;
    const aborted = new Promise((_, reject) => {
      rejectAbort = reject;
    });
    const cancel = () => {
      ctrl.abort();
      rejectAbort(new DOMException('Cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });

    try {
      const request = (async () => {
        const url = new URL('data/lessons.json', this.baseUrl);
        url.searchParams.set('_fresh', crypto.randomUUID());
        const response = await this.fetcher(url, { cache: 'no-store', signal: ctrl.signal });
        if (!response.ok) throw Error('내용을 불러오지 못했어요 (' + response.status + ').');
        const d = await response.json();
        const lessons =
          Array.isArray(d?.lessons) &&
          d.lessons.length === 6 &&
          unique(d.lessons.map(x => x?.id)) &&
          IDS.every(v =>
            d.lessons.some(x => x?.id === v && ['title', 'intro', 'takeaway', 'kicker'].every(k => text(x[k])))
          );
        const qs =
          Array.isArray(d?.questions) &&
          d.questions.length === 6 &&
          unique(d.questions.map(q => q?.id)) &&
          d.questions.every(
            q =>
              q &&
              id(q.id) &&
              text(q.prompt) &&
              text(q.explanation) &&
              Array.isArray(q.options) &&
              q.options.length >= 2 &&
              q.options.length <= 20 &&
              q.options.every(o => o && id(o.id) && text(o.text)) &&
              unique(q.options.map(o => o.id)) &&
              unique(q.options.map(o => o.text)) &&
              q.options.filter(o => o.id === q.answer).length === 1
          );
        const sources =
          Array.isArray(d?.sources) &&
          d.sources.length === 2 &&
          unique(d.sources.map(s => s?.url)) &&
          d.sources.every(s => s && text(s.title) && SOURCES.has(s.url));
        if (d?.schema !== 1 || !lessons || !qs || !sources) {
          throw Error('학습 내용의 형식이 올바르지 않아요.');
        }
        return d;
      })();

      return await Promise.race([
        request,
        aborted,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            ctrl.abort();
            reject(Error('응답 시간이 길어지고 있어요. 다시 시도해 주세요.'));
          }, this.timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}
