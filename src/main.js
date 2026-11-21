import { ROUTES } from './shared/routes.js';
import { escapeHTML as e } from './shared/dom.js';
import { SHELL } from './shared/shell-copy.js';
import { Router } from './services/router.js';
import { VersionService } from './services/version-service.js';
import { EntryService } from './services/entry-service.js';
import { ContentService } from './services/content-service.js';
import { LabStorageService, emptyProgress } from './services/storage-service.js';
import { IntroScreen } from './screens/intro-screen.js';
import { ReadScreen } from './screens/read-screen.js';
import { SplitScreen } from './screens/split-screen.js';
import { LabScreen } from './screens/lab-screen.js';
import { PracticeScreen } from './screens/practice-screen.js';
import { CodeScreen } from './screens/code-screen.js';

const SCREENS = {
  intro: IntroScreen,
  read: ReadScreen,
  split: SplitScreen,
  lab: LabScreen,
  practice: PracticeScreen,
  code: CodeScreen
};

const clone = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class TutorialApp {
  constructor({ version } = {}) {
    this.root = document.querySelector('#main');
    this.loadedBuild = document.querySelector('meta[name="app-build"]').content;
    this.baseUrl = new URL('./', location.href);
    this.baseUrl.hash = '';
    this.baseUrl.search = '';
    this.storage = new LabStorageService();
    this.progress = emptyProgress();
    this.persistedProgress = clone(this.progress);
    this.saving = false;
    this.unsaved = false;
    this.sequence = 0;
    this.hydrated = false;
    this.pendingSave = null;
    this.currentRoute = null;
    this.contentService = new ContentService({ baseUrl: this.baseUrl });
    this.version = version ?? new VersionService({ baseUrl: this.baseUrl, loadedBuild: this.loadedBuild });
    document.body.dataset.build = this.loadedBuild;

    this.nav = document.querySelector('#lesson-nav');
    this.nav.innerHTML = ROUTES.map(
      (r, i) => `<a href="#${r.path}" data-route="${r.path}"><span>${String(i + 1).padStart(2, '0')}</span><b>${e(r.label)}</b></a>`
    ).join('');

    document.querySelector('.skip').addEventListener('click', event => {
      event.preventDefault();
      this.root.focus();
      this.root.scrollIntoView({ block: 'start' });
    });

    document.querySelector('#motion-toggle').addEventListener('click', ev => {
      const b = ev.currentTarget;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      document.body.classList.toggle('reduce-motion', on);
    });

    this.router = new Router({
      baseUrl: this.baseUrl,
      version: this.version,
      readState: () => this.editState(),
      onNavigate: r => this.render(r),
      onProtect: info => this.protect(info),
      onUpdate: () => this.showUpdate(),
      onError: err => this.notice(err.message)
    });

    addEventListener('beforeunload', ev => {
      const s = this.editState();
      if (s.dirty || s.saving) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });
  }

  editState() {
    return { dirty: !!this.screen?.dirty || this.unsaved, saving: this.saving };
  }

  notice(message) {
    const el = document.querySelector('#notice');
    el.textContent = message;
    el.hidden = !message;
  }

  showUpdate() {
    if (this.version.pendingBuild) this.notice(SHELL.updateReady);
  }

  async persist() {
    if (this.saving) throw Error(SHELL.busySave);
    const snapshot = clone(this.progress);
    this.saving = true;
    this.unsaved = true;
    const work = Promise.resolve().then(() => this.storage.save(snapshot));
    this.pendingSave = work;
    try {
      await work;
      this.persistedProgress = clone(snapshot);
      this.unsaved = !same(snapshot, this.progress);
      this.notice(SHELL.savedLocal);
      this.showUpdate();
    } catch (error) {
      this.notice(error.message);
      throw error;
    } finally {
      this.saving = false;
      if (this.pendingSave === work) this.pendingSave = null;
    }
  }

  schedulePersist() {
    this.unsaved = true;
    if (this._autoFlush) return this._autoFlush;
    this._autoFlush = (async () => {
      try {
        while (this.unsaved) {
          if (this.pendingSave) {
            await this.pendingSave.catch(() => {});
          }
          if (!this.unsaved) break;
          await this.persist();
        }
      } catch {
        // Storage failure keeps unsaved=true so navigation guard still protects edits
      } finally {
        this._autoFlush = null;
      }
    })();
    return this._autoFlush;
  }

  restoreSavedProgress() {
    if (this.saving) return false;
    this.progress = clone(this.persistedProgress);
    this.unsaved = false;
    return true;
  }

  reconcileContent(content) {
    this.storage.setQuestions(content.questions);
    if (!this.hydrated) {
      this.progress = this.storage.load();
      this.persistedProgress = clone(this.progress);
      this.hydrated = true;
      if (this.storage.warning) this.notice(this.storage.warning);
    } else {
      this.progress = this.storage.reconcile(this.progress);
      this.persistedProgress = this.storage.reconcile(this.persistedProgress);
    }
  }

  async render(route) {
    const sequence = ++this.sequence;
    this.currentRoute = route;
    this.screen?.dispose();
    this.screen = null;
    this.request?.abort();
    this.request = new AbortController();

    const info = ROUTES.find(r => r.path === route.path);
    document.body.dataset.screen = info?.id || 'missing';
    document.body.dataset.ready = 'false';

    this.nav.querySelectorAll('a').forEach(a => {
      if (a.dataset.route === route.path) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });

    if (!info) {
      this.root.innerHTML =
        '<section class="lesson missing"><p class="eyebrow">길을 잠깐 벗어났어요</p><h1>이 학습 단계는 없어요.</h1><p class="lede">첫 화면에서 차례대로 시작해 보세요.</p><a class="button" href="#/" data-route="/">시작으로 돌아가기 →</a></section>';
      document.body.dataset.ready = 'true';
      return;
    }

    this.root.innerHTML =
      '<div class="loading" role="status"><span class="loading-mark" aria-hidden="true">◎</span>택배 분류 실험실을 펼치는 중…</div>';
    try {
      const content = await this.contentService.load(this.request.signal);
      if (sequence !== this.sequence) return;
      this.content = content;
      document.body.dataset.dataRevision = content.dataRevision || '';
      this.reconcileContent(content);
      const lesson = content.lessons.find(l => l.id === info.id);
      this.screen = new SCREENS[info.id](this, lesson);
      this.screen.mount(this.root);
      document.title = `${lesson.title} — ${SHELL.brand}`;
      document.body.dataset.ready = 'true';
      this.root.focus({ preventScroll: true });
      scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) {
      if (sequence !== this.sequence || error.name === 'AbortError') return;
      this.root.innerHTML = `<section class="lesson load-error"><p class="eyebrow">다시 연결해 볼까요?</p><h1>학습 내용을 펼치지 못했어요.</h1><p>${e(error.message)}</p><button type="button" class="button" id="retry-load">다시 시도 →</button></section>`;
      this.root.querySelector('#retry-load').addEventListener('click', () => this.render(route), { once: true });
      document.body.dataset.ready = 'error';
    }
  }

  async protect({ changed }) {
    const dialog = document.querySelector('#guard');
    const error = document.querySelector('#guard-error');
    error.textContent = '';
    document.querySelector('#guard-description').textContent = changed
      ? '새 버전이 준비됐어요. 작성한 입력을 저장하거나 취소하면, 다음 단계에 새 버전이 적용돼요.'
      : '작성한 입력이나 메모가 남아 있어요. 저장하거나 취소한 뒤 이동할 수 있어요.';
    const stay = document.querySelector('#guard-stay');
    const discard = document.querySelector('#guard-discard');
    const save = document.querySelector('#guard-save');
    const controller = new AbortController();

    const refreshBusy = () => {
      if (!controller.signal.aborted) {
        discard.disabled = this.saving;
        save.disabled = this.saving;
      }
    };
    refreshBusy();
    if (this.pendingSave) this.pendingSave.finally(() => queueMicrotask(refreshBusy)).catch(() => {});

    return new Promise(resolve => {
      const done = value => {
        controller.abort();
        dialog.close();
        resolve(value);
      };
      stay.addEventListener('click', () => done(false), { signal: controller.signal });
      discard.addEventListener(
        'click',
        () => {
          if (this.saving) return;
          this.screen?.discard();
          this.restoreSavedProgress();
          done(true);
        },
        { signal: controller.signal }
      );
      save.addEventListener(
        'click',
        async () => {
          if (this.saving) return;
          discard.disabled = true;
          save.disabled = true;
          try {
            if (this.screen?.dirty) await this.screen.saveDraft();
            if (this.unsaved) await this.persist();
            done(true);
          } catch (err) {
            error.textContent = err.message;
            refreshBusy();
          }
        },
        { signal: controller.signal }
      );
      dialog.addEventListener(
        'cancel',
        ev => {
          ev.preventDefault();
          done(false);
        },
        { signal: controller.signal }
      );
      dialog.showModal();
    });
  }

  async start() {
    await this.router.start();
  }
}

export async function boot() {
  const loadedBuild = document.querySelector('meta[name="app-build"]').content;
  const baseUrl = new URL('./', location.href);
  baseUrl.hash = '';
  baseUrl.search = '';
  const version = new VersionService({ baseUrl, loadedBuild });
  const entry = new EntryService({ version, currentURL: location.href, replace: url => location.replace(url) });
  if ((await entry.start()) === 'replaced') return;
  await new TutorialApp({ version }).start();
}

if (typeof document !== 'undefined') {
  boot().catch(error => {
    document.querySelector('#main').textContent = '실험실을 시작하지 못했어요. ' + error.message;
    document.body.dataset.ready = 'error';
  });
}
