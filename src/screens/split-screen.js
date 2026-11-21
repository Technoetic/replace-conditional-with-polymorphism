import { BaseScreen } from './base-screen.js';
import { RESPONSIBILITY_CHIPS, SPLIT_SLOTS } from '../domain/dispatch.js';
import { escapeHTML as e } from '../shared/dom.js';

export class SplitScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    this.selectedChip = RESPONSIBILITY_CHIPS[0].id;
    this.slots = { ...this.app.progress.slots };

    root.innerHTML = `<section class="lesson">
      ${this.head()}
      <div class="studio-banner">
        <div>
          <span class="tiny-label">ARCHITECTURE STUDIO</span>
          <h2>네 가지 책임을<br>알맞은 자리에 배치해 보세요</h2>
        </div>
        <p>아래 책임 조각을 하나 고른 뒤, 어울리는 클래스나 팩토리 카드를 클릭하세요.<br><span>공통 계산은 부모로, 유형별 규칙은 자식으로, 타입 판별은 팩토리 한 곳으로 모입니다.</span></p>
      </div>

      <div class="name-palette" role="group" aria-label="책임 조각 선택">
        ${RESPONSIBILITY_CHIPS.map(
          c => `<button type="button" class="name-chip" data-chip="${e(c.id)}" aria-pressed="${c.id === this.selectedChip}"><span>◈</span><div><code>${e(c.label)}</code><small>${e(c.summary)}</small></div></button>`
        ).join('')}
      </div>
      <p id="selection-status" class="selection-status" aria-live="polite"></p>

      <div class="assignment-grid">
        ${SPLIT_SLOTS.map(
          s => `<article class="assignment-card ${e(s.role)}" data-slot-card="${e(s.id)}">
            <span class="role-number">${e(s.number)}</span>
            <h2>${e(s.title)}</h2>
            <p>${e(s.description)}</p>
            <button type="button" class="assignment-slot" data-slot="${e(s.id)}"></button>
            <p class="slot-feedback" data-slot-feedback="${e(s.id)}" aria-live="polite"></p>
          </article>`
        ).join('')}
      </div>

      <div class="studio-actions">
        <p id="studio-summary" aria-live="polite"></p>
        <button type="button" class="text-button" id="reset-slots">배치 비우기</button>
        <button type="button" class="button secondary" id="fill-slots">정답 배치 보기 →</button>
      </div>

      <div id="assembled-preview" class="assembled-preview" hidden>
        <span class="tiny-label">ASSEMBLED DISPATCH CALL</span>
        <pre><code>const parcel = createParcel(orderData); // 타입 분기는 여기 1곳뿐
return { fee: parcel.fee, hours: parcel.hours, guide: parcel.guide };</code></pre>
      </div>
      ${this.foot()}
    </section>`;

    this.paint();

    this.on(root, 'click', ev => {
      const chip = ev.target.closest('[data-chip]');
      if (chip) {
        this.selectedChip = chip.dataset.chip;
        this.paint();
        return;
      }
      const slot = ev.target.closest('[data-slot]');
      if (slot) {
        const id = slot.dataset.slot;
        this.slots[id] = this.slots[id] === this.selectedChip ? '' : this.selectedChip;
        this.saveSlots();
        return;
      }
      if (ev.target.id === 'reset-slots') {
        this.slots = { superclass: '', cold: '', express: '', factory: '' };
        this.saveSlots();
        return;
      }
      if (ev.target.id === 'fill-slots') {
        for (const s of SPLIT_SLOTS) this.slots[s.id] = s.expected;
        this.saveSlots();
      }
    });
  }

  saveSlots() {
    this.app.progress.slots = { ...this.slots };
    this.app.schedulePersist();
    this.paint();
  }

  paint() {
    const activeChip = RESPONSIBILITY_CHIPS.find(c => c.id === this.selectedChip);
    this.root.querySelectorAll('[data-chip]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.chip === this.selectedChip));
    });
    this.root.querySelector('#selection-status').textContent = activeChip
      ? `선택한 책임: ${activeChip.label} — 배치할 아래 카드를 눌러 주세요.`
      : '위에서 책임 조각을 먼저 골라 주세요.';

    let matched = 0;
    for (const s of SPLIT_SLOTS) {
      const placedId = this.slots[s.id];
      const placed = RESPONSIBILITY_CHIPS.find(c => c.id === placedId);
      const ok = placedId === s.expected;
      if (ok) matched++;
      const btn = this.root.querySelector(`[data-slot="${s.id}"]`);
      btn.classList.toggle('filled', Boolean(placed));
      btn.innerHTML = placed
        ? `<code>${e(placed.label)}</code><span>${e(placed.summary)} · 다시 누르면 비움</span>`
        : `<span class="slot-plus" aria-hidden="true">+</span><span>여기에 책임 배치</span>`;
      const fb = this.root.querySelector(`[data-slot-feedback="${s.id}"]`);
      fb.className = `slot-feedback ${placed ? (ok ? 'correct' : 'retry') : ''}`;
      fb.textContent = !placed
        ? ''
        : ok
          ? `✓ 정확해요. ${s.hint}`
          : `다시 생각해 볼까요? 힌트: ${s.hint}`;
    }

    const summary = this.root.querySelector('#studio-summary');
    const preview = this.root.querySelector('#assembled-preview');
    if (matched === SPLIT_SLOTS.length) {
      summary.textContent = '4 / 4 완료! 호출 쪽의 switch가 전부 사라졌습니다.';
      preview.hidden = false;
    } else {
      summary.textContent = `${matched} / ${SPLIT_SLOTS.length} 자리 일치`;
      preview.hidden = true;
    }
  }
}
