import { BaseScreen, parcelFields } from './base-screen.js';
import { CARRIER_META, compareDispatch, validateParcelInput } from '../domain/dispatch.js';
import { escapeHTML as e, hoursText, won } from '../shared/dom.js';

const PRESETS = [
  { id: 'std-small', label: '일반 소형', sub: '2kg · 30km', input: { type: 'standard', weightKg: 2, distanceKm: 30, fragile: false } },
  { id: 'cold-long', label: '신선 장거리', sub: '6kg · 180km', input: { type: 'cold', weightKg: 6, distanceKm: 180, fragile: false } },
  { id: 'exp-fragile', label: '당일 파손', sub: '4kg · 120km', input: { type: 'express', weightKg: 4, distanceKm: 120, fragile: true } },
  { id: 'drone-ok', label: '드론 신규', sub: '3kg · 40km', input: { type: 'drone', weightKg: 3, distanceKm: 40, fragile: false } },
  { id: 'drone-heavy', label: '드론 과중', sub: '8kg · 40km', input: { type: 'drone', weightKg: 8, distanceKm: 40, fragile: false } }
];

export class LabScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    this.input = { ...this.app.progress.input };
    this.omitDroneCase = Boolean(this.app.progress.omitDroneCase);

    root.innerHTML = `<section class="lesson">
      ${this.head()}
      <div class="lab-layout">
        <aside class="lab-controls">
          <span class="tiny-label">TEST SCENARIOS</span>
          <h2>운송장 조건과<br>확장 버그를 실험해 보세요</h2>
          <div class="date-presets" role="group" aria-label="빠른 시나리오 선택">
            ${PRESETS.map(
              p => `<button type="button" data-preset="${e(p.id)}" aria-pressed="false"><b>${e(p.label)}</b><span>${e(p.sub)}</span></button>`
            ).join('')}
          </div>
          <form id="lab-form">
            ${parcelFields(this.input, 'lab', { includeDrone: true })}
            <button type="submit" class="button full">전후 결과 비교 →</button>
            <p class="error" id="lab-error" role="alert"></p>
          </form>
          <div class="bug-box">
            <label class="bug-label" for="omit-drone-toggle">
              <input id="omit-drone-toggle" type="checkbox"${this.omitDroneCase ? ' checked' : ''}>
              <span><b>switch 누락 버그 재현</b><small>handlingGuide에 case 'drone'을 빠뜨린 상태</small></span>
              <span class="bug-badge">의도적 버그</span>
            </label>
            <p>이 스위치는 올바른 리팩터링이 아니라, <strong>흩어진 switch 구조에 4번째 유형(드론)을 추가할 때 흔히 생기는 누락 실수</strong>를 의도적으로 재현합니다.</p>
          </div>
          <button type="button" class="text-button" id="reset-lab">기본 실험 조건으로 초기화</button>
        </aside>

        <div class="lab-results">
          <div class="comparison-heading">
            <span class="tiny-label">BEFORE (3 SWITCHES) VS AFTER (POLYMORPHISM)</span>
            <span id="lab-mode-tag" class="mode-tag"></span>
          </div>
          <div class="comparison-cards">
            <article class="price-card" id="card-before"></article>
            <div class="comparison-arrow" aria-hidden="true">⇄</div>
            <article class="price-card after" id="card-after"></article>
          </div>
          <div id="equivalence-banner" class="equivalence" aria-live="polite"></div>

          <div class="touch-metric">
            <div class="touch-box before">
              <span class="tiny-label">EDIT SURFACE · BEFORE</span>
              <strong>함수 3곳 수정</strong>
              <p>새 유형 추가 시 <code>shippingFee</code>·<code>estimatedHours</code>·<code>handlingGuide</code>를 모두 열어야 합니다.</p>
            </div>
            <div class="touch-box after">
              <span class="tiny-label">EDIT SURFACE · AFTER</span>
              <strong>새 클래스 1개 + 팩토리 1줄</strong>
              <p>기존 3개 클래스는 건드리지 않고 <code>class DroneParcel extends Parcel</code>만 추가합니다.</p>
            </div>
          </div>

          <div class="lab-rule">
            <span>RULE TABLE</span>
            <div>
              <p><b>일반 택배</b> 3,000 + 400×kg · 150km 초과 48h (이하 24h)</p>
              <p><b>신선 냉장</b> 기본 + 보냉 2,500 + 100km 초과 아이스팩 2,000 · 18h/12h</p>
              <p><b>당일 특송</b> 6,000 + 700×kg + ⌈km/50⌉×1,000 · max(2, ⌈km/40⌉)h</p>
              <p><b>드론(확장)</b> 5kg 초과 적재 불가 · 이하 5,000 + ⌈km/20⌉×800 · max(1, ⌈km/60⌉)h</p>
            </div>
            <small>모든 유형 공통: 파손 주의(fragile) +1,500원 · 기본 3유형 3,600개 입력 조합 전수 동치 검증 완료.</small>
          </div>
        </div>
      </div>
      ${this.foot()}
    </section>`;

    this.paint();

    this.on(root, 'click', ev => {
      const presetBtn = ev.target.closest('[data-preset]');
      if (presetBtn) {
        const found = PRESETS.find(p => p.id === presetBtn.dataset.preset);
        if (!found) return;
        this.input = { ...found.input };
        this.syncFormInputs();
        this.persistState();
        this.paint();
        return;
      }
      if (ev.target.id === 'reset-lab') {
        this.input = { type: 'cold', weightKg: 4, distanceKm: 120, fragile: false };
        this.omitDroneCase = false;
        this.syncFormInputs();
        this.root.querySelector('#omit-drone-toggle').checked = false;
        this.persistState();
        this.paint();
      }
    });

    this.on(root, 'change', ev => {
      if (ev.target.id === 'omit-drone-toggle') {
        this.omitDroneCase = ev.target.checked;
        this.persistState();
        this.paint();
        return;
      }
      if (ev.target.closest('#lab-form')) this.applyForm();
    });

    this.on(root, 'submit', ev => {
      if (ev.target.id !== 'lab-form') return;
      ev.preventDefault();
      this.applyForm();
    });
  }

  syncFormInputs() {
    const form = this.root.querySelector('#lab-form');
    form.elements.type.value = this.input.type;
    form.elements.weightKg.value = String(this.input.weightKg);
    form.elements.distanceKm.value = String(this.input.distanceKm);
    form.elements.fragile.checked = this.input.fragile;
    this.root.querySelector('#lab-error').textContent = '';
  }

  applyForm() {
    const form = this.root.querySelector('#lab-form');
    const errorEl = this.root.querySelector('#lab-error');
    const candidate = {
      type: form.elements.type.value,
      weightKg: Number(form.elements.weightKg.value),
      distanceKm: Number(form.elements.distanceKm.value),
      fragile: form.elements.fragile.checked
    };
    try {
      this.input = validateParcelInput(candidate, { allowDrone: true });
      errorEl.textContent = '';
      this.persistState();
      this.paint();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  persistState() {
    this.app.progress.input = { ...this.input };
    this.app.progress.omitDroneCase = this.omitDroneCase;
    this.app.schedulePersist();
  }

  paint() {
    const cmp = compareDispatch(this.input, { omitDroneCase: this.omitDroneCase });
    const meta = CARRIER_META[this.input.type];

    this.root.querySelectorAll('[data-preset]').forEach(btn => {
      const p = PRESETS.find(item => item.id === btn.dataset.preset);
      const match =
        p &&
        p.input.type === this.input.type &&
        p.input.weightKg === this.input.weightKg &&
        p.input.distanceKm === this.input.distanceKm &&
        p.input.fragile === this.input.fragile;
      btn.setAttribute('aria-pressed', String(Boolean(match)));
    });

    const tag = this.root.querySelector('#lab-mode-tag');
    const bugActive = this.omitDroneCase && this.input.type === 'drone';
    tag.className = `mode-tag ${bugActive ? 'bug-active' : ''}`;
    tag.textContent = bugActive
      ? 'switch 누락 버그 발생 중'
      : this.omitDroneCase
        ? '누락 스위치 ON (drone 선택 시 재현)'
        : '정상 동작 비교 모드';

    this.root.querySelector('#card-before').innerHTML = `
      <span class="tiny-label">BEFORE · SWITCH × 3</span>
      <span class="branch-label ${e(meta.role)}">switch (parcel.type) → '${e(this.input.type)}'</span>
      <strong>${e(won(cmp.before.fee))}</strong>
      <div class="metric-row"><span>예상 시간</span><b>${e(hoursText(cmp.before.hours))}</b></div>
      <div class="metric-row${cmp.diffs.includes('guide') ? ' diff-hit' : ''}"><span>취급 안내</span><b>${e(cmp.before.guide)}</b></div>
      <code>shippingFee() · estimatedHours() · handlingGuide()</code>
    `;

    this.root.querySelector('#card-after').innerHTML = `
      <span class="tiny-label">AFTER · POLYMORPHIC CLASS</span>
      <span class="branch-label ${e(meta.role)}">new ${e(cmp.after.className)}(data)</span>
      <strong>${e(won(cmp.after.fee))}</strong>
      <div class="metric-row"><span>예상 시간</span><b>${e(hoursText(cmp.after.hours))}</b></div>
      <div class="metric-row"><span>취급 안내</span><b>${e(cmp.after.guide)}</b></div>
      <code>parcel.fee · parcel.hours · parcel.guide</code>
    `;

    const banner = this.root.querySelector('#equivalence-banner');
    banner.className = `equivalence ${cmp.equal ? '' : 'different'}`;
    banner.innerHTML = cmp.equal
      ? `<span aria-hidden="true">✓</span><div><h3>배송비 · 예상 시간 · 취급 안내 모두 일치</h3><p>${e(meta.label)}(${e(this.input.weightKg)}kg · ${e(this.input.distanceKm)}km) 입력에서 switch 방식과 <code>${e(cmp.after.className)}</code> 객체가 완벽히 같은 결과를 냈습니다.</p></div>`
      : `<span aria-hidden="true">!</span><div><h3>불일치 감지 — handlingGuide가 '알 수 없는 배송'으로 빠졌습니다</h3><p><code>shippingFee</code>와 <code>estimatedHours</code>에는 <code>case 'drone'</code>을 넣었지만 <code>handlingGuide</code>에서 누락된 상황입니다. 반면 <code>DroneParcel</code>은 세 메서드가 한 클래스 안에 묶여 있어 일부만 빠뜨릴 위험이 크게 줄어듭니다.</p></div>`;
  }
}
