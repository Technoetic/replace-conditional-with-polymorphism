import { BaseScreen } from './base-screen.js';
import { escapeHTML as e } from '../shared/dom.js';

export class PracticeScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    this.draftNote = this.app.progress.note;
    this.lastSavedNote = this.app.persistedProgress?.note ?? this.app.progress.note;
    this.lastSavedAnswers = { ...(this.app.persistedProgress?.answers ?? this.app.progress.answers) };
    this.failed = false;
    this.pendingSave = null;

    root.innerHTML = `<section class="lesson">
      ${this.head()}
      <div class="practice-progress">
        <div>
          <span class="tiny-label">A LITTLE SELF CHECK</span>
          <h2>언제 switch를 두고,<br>언제 다형성으로 옮길까요?</h2>
        </div>
        <div class="score">
          <strong id="practice-score">0<span> / 6</span></strong>
          <p id="practice-count" aria-live="polite"></p>
          <div class="progress-track"><i id="practice-track"></i></div>
        </div>
      </div>

      <div class="question-grid">
        ${this.app.content.questions
          .map(
            (q, i) => `<article class="question-card" data-card="${e(q.id)}">
              <span class="tiny-label">CHECK ${String(i + 1).padStart(2, '0')}</span>
              <h2>${e(q.prompt)}</h2>
              <div class="answer-options">
                ${q.options
                  .map(
                    o => `<button class="answer-option" type="button" data-question="${e(q.id)}" data-answer="${e(o.id)}" aria-pressed="false"><span class="option-dot" aria-hidden="true"></span><span>${e(o.text)}</span></button>`
                  )
                  .join('')}
              </div>
              <div class="answer-feedback" data-feedback="${e(q.id)}" aria-live="polite"></div>
            </article>`
          )
          .join('')}
      </div>

      <form id="note-form" class="note-card">
        <div class="note-heading">
          <div>
            <span class="tiny-label">MY TAKEAWAY</span>
            <h2><label for="learner-note">내 말로 남기는 한 문장</label></h2>
          </div>
          <span aria-hidden="true">◎</span>
        </div>
        <p>반복되는 switch를 하위 클래스와 팩토리로 옮길 때 어떤 기준을 기억해 두고 싶나요?</p>
        <textarea id="learner-note" maxlength="2000" rows="6" placeholder="같은 type 분기가 여러 함수에 반복되면, 먼저…">${e(this.draftNote)}</textarea>
        <div class="note-actions">
          <div>
            <p>답과 메모는 이 브라우저에 저장됩니다.</p>
            <span id="note-status" role="status"></span>
          </div>
          <span id="note-count">${this.draftNote.length} / 2000</span>
          <button class="button secondary" type="submit" id="save-note">메모 저장하기 ↗</button>
        </div>
        <p class="error" id="note-error" role="alert"></p>
      </form>
      ${this.foot()}
    </section>`;

    this.paintAnswers();
    this.paintNoteStatus();

    this.on(root, 'click', ev => {
      const b = ev.target.closest('[data-answer]');
      if (b) this.chooseAnswer(b).catch(() => {});
    });

    this.on(root, 'input', ev => {
      if (ev.target.id !== 'learner-note') return;
      this.draftNote = ev.target.value;
      this.syncDirty();
      this.paintNoteStatus();
    });

    this.on(root, 'submit', ev => {
      if (ev.target.id === 'note-form') {
        ev.preventDefault();
        this.saveDraft().catch(() => {});
      }
    });
  }

  syncDirty() {
    const saved = this.app.persistedProgress;
    this.dirty =
      this.failed ||
      this.draftNote !== (saved?.note ?? this.lastSavedNote) ||
      JSON.stringify(this.app.progress.answers) !== JSON.stringify(saved?.answers ?? this.lastSavedAnswers);
    this.app.editState?.();
  }

  paintNoteStatus() {
    if (this.disposed) return;
    this.root.querySelector('#note-count').textContent = `${this.draftNote.length} / 2000`;
    this.root.querySelector('#note-status').textContent = this.pendingSave
      ? '저장 중…'
      : this.dirty
        ? '아직 저장하지 않은 변경이 있습니다.'
        : '저장된 메모와 같습니다.';
  }

  paintAnswers() {
    if (this.disposed) return;
    const { questions } = this.app.content;
    const answers = this.app.progress.answers;
    for (const q of questions) {
      const selected = answers[q.id];
      const right = selected === q.answer;
      const card = [...this.root.querySelectorAll('[data-card]')].find(el => el.dataset.card === q.id);
      if (!card) continue;
      card.querySelectorAll('[data-answer]').forEach(b => {
        const chosen = b.dataset.answer === selected;
        b.setAttribute('aria-pressed', String(chosen));
        b.classList.toggle('chosen', chosen);
      });
      const feedback = card.querySelector('[data-feedback]');
      feedback.className = `answer-feedback ${selected ? (right ? 'correct' : 'retry') : ''}`;
      feedback.innerHTML = selected
        ? `<b>${right ? '✓ 정확해요.' : '다시 생각해 볼까요?'}</b><p>${e(q.explanation)}</p>`
        : '';
    }
    const correct = questions.filter(q => answers[q.id] === q.answer).length;
    const answered = questions.filter(q => answers[q.id]).length;
    this.root.querySelector('#practice-score').innerHTML = `${correct}<span> / 6</span>`;
    this.root.querySelector('#practice-count').textContent = `${answered}문항 선택 · ${correct}문항 이해 완료`;
    this.root.querySelector('#practice-track').style.setProperty('--progress', `${(correct / 6) * 100}%`);
  }

  async chooseAnswer(button) {
    if (this.pendingSave || this.app.saving) {
      this.app.notice?.('저장이 끝나면 다음 답을 골라 주세요.');
      return;
    }
    const question = this.app.content.questions.find(q => q.id === button.dataset.question);
    if (!question?.options.some(o => o.id === button.dataset.answer)) return;
    this.app.progress.answers[question.id] = button.dataset.answer;
    this.syncDirty();
    this.paintAnswers();
    const submitted = { ...this.app.progress.answers };
    try {
      await this.app.persist();
      if (this.disposed) return;
      this.lastSavedAnswers = { ...submitted };
      this.failed = false;
      this.root.querySelector('#note-error').textContent = '';
    } catch (error) {
      if (this.disposed) return;
      this.failed = true;
      this.root.querySelector('#note-error').textContent = error.message;
    } finally {
      if (!this.disposed) {
        this.syncDirty();
        this.paintNoteStatus();
      }
    }
  }

  async saveDraft() {
    if (this.pendingSave) return this.pendingSave;
    const submitted = this.root.querySelector('#learner-note').value;
    this.draftNote = submitted;
    this.app.progress.note = submitted;
    const answers = { ...this.app.progress.answers };
    this.pendingSave = (async () => {
      try {
        await this.app.persist();
        this.lastSavedNote = submitted;
        this.lastSavedAnswers = { ...answers };
        this.failed = false;
        if (!this.disposed) {
          this.root.querySelector('#note-error').textContent = '';
          this.app.notice?.('메모를 저장했습니다.');
        }
      } catch (error) {
        this.failed = true;
        if (!this.disposed) this.root.querySelector('#note-error').textContent = error.message;
        throw error;
      } finally {
        this.draftNote = this.disposed
          ? this.draftNote
          : (this.root.querySelector('#learner-note')?.value ?? this.draftNote);
        this.pendingSave = null;
        if (!this.disposed) {
          this.syncDirty();
          this.paintNoteStatus();
        }
      }
    })();
    this.paintNoteStatus();
    return this.pendingSave;
  }

  discard() {
    const saved = this.app.persistedProgress;
    this.draftNote = saved?.note ?? this.lastSavedNote;
    this.app.progress.note = this.draftNote;
    this.app.progress.answers = { ...(saved?.answers ?? this.lastSavedAnswers) };
    if (!this.disposed) {
      this.root.querySelector('#learner-note').value = this.draftNote;
      this.failed = false;
      this.paintAnswers();
      super.discard();
      this.paintNoteStatus();
    } else {
      super.discard();
    }
  }
}
