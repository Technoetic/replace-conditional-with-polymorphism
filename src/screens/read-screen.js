import { BaseScreen, parcelFields, waybillCard } from './base-screen.js';
import { BASE_CARRIER_TYPES, beforeDispatch, CARRIER_META, validateParcelInput } from '../domain/dispatch.js';
import { escapeHTML as e } from '../shared/dom.js';

const TYPE_NOTES = {
  standard: {
    label: 'CASE: STANDARD · 3곳에 분산',
    title: '일반 택배 규칙이 세 함수에 흩어져 있습니다',
    body: 'shippingFee의 4번째 줄, estimatedHours의 3번째 줄, handlingGuide의 3번째 줄이 모두 일반 택배의 규칙입니다. 일반 택배의 장거리 기준(150km)을 바꾸려면 세 함수를 전부 뒤져야 합니다.'
  },
  cold: {
    label: 'CASE: COLD · 3곳에 분산',
    title: '신선 냉장(100km 기준)이 세 함수에 중복됩니다',
    body: 'distanceKm > 100 조건이 shippingFee(아이스팩 2,000원), estimatedHours(18시간 vs 12시간), handlingGuide(아이스팩 2매 문구) 세 곳에 따로 적혀 있습니다. 한 곳만 120km로 고치면 곧바로 불일치가 생깁니다.'
  },
  express: {
    label: 'CASE: EXPRESS · 3곳에 분산',
    title: '당일 특송만의 퀵 공식이 switch 안에 섞여 있습니다',
    body: '기본 요금 6,000원, 50km 단위 할증, 40km/h 소요 시간, 퀵 직배 안내가 다른 배송 수단 코드 사이에 끼어 있어 한눈에 파악하기 어렵습니다.'
  }
};

export class ReadScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    const saved = this.app.progress.input;
    this.input = {
      type: BASE_CARRIER_TYPES.includes(saved.type) ? saved.type : 'cold',
      weightKg: saved.weightKg,
      distanceKm: saved.distanceKm,
      fragile: saved.fragile
    };
    this.focusedType = this.input.type;

    root.innerHTML = `<section class="lesson">
      ${this.head()}
      <div class="reading-layout">
        <div>
          <div class="panel-top">
            <span class="tiny-label">BEFORE · SCATTERED SWITCHES (3 FUNCTIONS)</span>
            <span class="file-label">dispatch-before.js</span>
          </div>
          <div class="code-paper">
            <pre><code>function shippingFee(parcel) {
  const fragileFee = parcel.fragile ? 1500 : 0;
  switch (parcel.type) {
    <button type="button" class="code-fragment standard" data-frag="standard">case 'standard': return 3000 + parcel.weightKg * 400 + fragileFee;</button>
    <button type="button" class="code-fragment cold" data-frag="cold">case 'cold':     return 3000 + parcel.weightKg * 400 + 2500 + (parcel.distanceKm &gt; 100 ? 2000 : 0) + fragileFee;</button>
    <button type="button" class="code-fragment express" data-frag="express">case 'express':  return 6000 + parcel.weightKg * 700 + Math.ceil(parcel.distanceKm / 50) * 1000 + fragileFee;</button>
  }
}

function estimatedHours(parcel) {
  switch (parcel.type) {
    <button type="button" class="code-fragment standard" data-frag="standard">case 'standard': return parcel.distanceKm &gt; 150 ? 48 : 24;</button>
    <button type="button" class="code-fragment cold" data-frag="cold">case 'cold':     return parcel.distanceKm &gt; 100 ? 18 : 12;</button>
    <button type="button" class="code-fragment express" data-frag="express">case 'express':  return Math.max(2, Math.ceil(parcel.distanceKm / 40));</button>
  }
}

function handlingGuide(parcel) {
  switch (parcel.type) {
    <button type="button" class="code-fragment standard" data-frag="standard">case 'standard': return parcel.fragile ? '완충재 보강 · 상단 적재' : '일반 컨베이어 분류';</button>
    <button type="button" class="code-fragment cold" data-frag="cold">case 'cold':     return parcel.distanceKm &gt; 100 ? '2°C 냉장 · 아이스팩 2매 보강' : '2°C 냉장 차량 직송';</button>
    <button type="button" class="code-fragment express" data-frag="express">case 'express':  return parcel.fragile ? '전용 퀵 직배 · 완충 포장' : '전용 퀵 직배 · 우선 출고';</button>
  }
}</code></pre>
          </div>
          <p class="code-hint">각 <code>case</code> 줄이나 아래 탭을 누르면, 같은 유형의 규칙이 세 함수에 어떻게 찢어져 있는지 한꺼번에 강조됩니다.</p>
          <div class="role-tabs" role="group" aria-label="유형별 분기 강조">
            ${BASE_CARRIER_TYPES.map(
              t => `<button type="button" class="${e(t)}" data-focus-type="${e(t)}" aria-pressed="${t === this.focusedType}">${e(CARRIER_META[t].label)} (${e(t)})</button>`
            ).join('')}
          </div>
          <article id="type-detail" class="role-detail" aria-live="polite"></article>
        </div>

        <aside class="order-panel">
          <span class="tiny-label">LIVE WAYBILL CHECK</span>
          <h2>운송장을 바꿔 보며<br>실행 분기 확인</h2>
          <form id="read-form">
            ${parcelFields(this.input, 'read', { includeDrone: false })}
            <button type="submit" class="button full">운송장 계산 반영 →</button>
            <p class="error" id="read-error" role="alert"></p>
          </form>
          <div id="read-waybill"></div>
        </aside>
      </div>

      <div class="teaching-note">
        <b>왜 문제일까요? — 변경이 생길 때마다 세 곳을 동시에 열어 고쳐야 합니다</b>
        <p>특히 신선 냉장(<code>cold</code>)은 <code>distanceKm &gt; 100</code> 조건이 세 함수에 똑같이 복제되어 있습니다. 다음 단계에서는 이 세 조각을 <code>ColdParcel</code> 클래스 한 곳에 모으고, 공통 할증은 부모 <code>Parcel</code>로 올립니다.</p>
      </div>
      ${this.foot()}
    </section>`;

    this.paintFocus();
    this.paintWaybill();

    this.on(root, 'click', ev => {
      const frag = ev.target.closest('[data-frag], [data-focus-type]');
      if (!frag) return;
      this.focusedType = frag.dataset.frag || frag.dataset.focusType;
      this.paintFocus();
    });

    this.on(root, 'submit', ev => {
      if (ev.target.id !== 'read-form') return;
      ev.preventDefault();
      this.applyForm();
    });

    this.on(root, 'change', ev => {
      if (ev.target.closest('#read-form')) this.applyForm();
    });
  }

  applyForm() {
    const form = this.root.querySelector('#read-form');
    const errorEl = this.root.querySelector('#read-error');
    const candidate = {
      type: form.elements.type.value,
      weightKg: Number(form.elements.weightKg.value),
      distanceKm: Number(form.elements.distanceKm.value),
      fragile: form.elements.fragile.checked
    };
    try {
      const valid = validateParcelInput(candidate, { allowDrone: false });
      this.input = valid;
      this.focusedType = valid.type;
      errorEl.textContent = '';
      this.app.progress.input = { ...valid };
      this.app.schedulePersist();
      this.paintFocus();
      this.paintWaybill();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  paintFocus() {
    const info = TYPE_NOTES[this.focusedType] || TYPE_NOTES.cold;
    this.root.querySelectorAll('[data-frag]').forEach(el => {
      el.setAttribute('aria-pressed', String(el.dataset.frag === this.focusedType));
    });
    this.root.querySelectorAll('[data-focus-type]').forEach(el => {
      el.setAttribute('aria-pressed', String(el.dataset.focusType === this.focusedType));
    });
    const detail = this.root.querySelector('#type-detail');
    detail.className = `role-detail ${this.focusedType}`;
    detail.innerHTML = `<span class="tiny-label">${e(info.label)}</span><h2>${e(info.title)}</h2><p>${e(info.body)}</p>`;
  }

  paintWaybill() {
    const result = beforeDispatch(this.input);
    this.root.querySelector('#read-waybill').innerHTML = waybillCard(this.input, result);
  }
}
