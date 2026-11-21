import { BaseScreen, roleCards, waybillCard } from './base-screen.js';
import { afterDispatch, BASE_CARRIER_TYPES, CARRIER_META } from '../domain/dispatch.js';
import { escapeHTML as e } from '../shared/dom.js';

const HERO_SAMPLES = {
  standard: { type: 'standard', weightKg: 3, distanceKm: 60, fragile: false },
  cold: { type: 'cold', weightKg: 4, distanceKm: 140, fragile: false },
  express: { type: 'express', weightKg: 2, distanceKm: 90, fragile: true }
};

export class IntroScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    this.activeType = BASE_CARRIER_TYPES.includes(this.app.progress.input.type)
      ? this.app.progress.input.type
      : 'cold';

    root.innerHTML = `<section class="intro-spread">
      <div class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>REPLACE CONDITIONAL WITH POLYMORPHISM</p>
          <h1>switch를 지우고,<br><span>객체에게 맡기다.</span></h1>
          <p class="hero-description">배송비·예상 시간·취급 안내마다 <code>switch (parcel.type)</code>을 반복하고 계신가요? 조건문을 각 배송 유형 클래스의 메서드로 옮기면, 호출 코드는 한 줄로 줄고 새 배송 수단도 안전하게 추가됩니다.</p>
          <p class="hero-detail">가상의 <strong>택배 분류 센터 운송장</strong> 한 가지 예제로, 흩어진 3개의 switch를 <strong>Parcel 계층 + 팩토리 1곳</strong>으로 바꾸고 네 번째 유형(드론)을 추가해 봅니다.</p>
          <div class="hero-actions">
            <a class="button" href="#/read" data-route="/read">분기 해부 시작하기 <span aria-hidden="true">↗</span></a>
            <span class="hero-meta">6단계 <i>·</i> 3,600조합 검증 <i>·</i> 브라우저 저장</span>
          </div>
          <div class="hero-caption">
            <span>MARTIN FOWLER · REFACTORING 2ND ED.</span>
            <span>NO EXTERNAL RUNTIME DEPS</span>
          </div>
        </div>
        <div class="hero-art">
          <div class="art-grid" aria-hidden="true"></div>
          <div class="diagram-caption"><span>DYNAMIC DISPATCH</span><span>parcel.fee / .hours / .guide</span></div>
          <div class="branch-source">
            <span class="diagram-node standard">createParcel(data)</span>
            <div class="diagram-fork" aria-hidden="true"></div>
            <div class="diagram-branches">
              <span class="diagram-node standard" data-node="standard">Standard</span>
              <span class="diagram-node cold" data-node="cold">Cold</span>
              <span class="diagram-node express" data-node="express">Express</span>
            </div>
          </div>
          <div id="hero-waybill"></div>
          <div class="waybill-stamp" aria-hidden="true">SAME<br>CALL</div>
          <div class="hero-switch" role="group" aria-label="배송 유형 미리보기">
            ${BASE_CARRIER_TYPES.map(
              t => `<button type="button" data-hero-type="${e(t)}" aria-pressed="${t === this.activeType}"><span>${e(CARRIER_META[t].badge)}</span>${e(CARRIER_META[t].label)}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="editorial-strip">
        <span class="tiny-label">CORE IDEA</span>
        <p>호출하는 쪽이 <em>“무슨 타입이지?”</em>를 묻지 않고,<br class="mobile-only"> 객체에게 <em>“네 규칙대로 계산해 줘”</em>라고 말합니다.</p>
        <span class="strip-arrow" aria-hidden="true">→</span>
      </div>

      <div class="intro-roles">
        <div class="section-label">
          <span class="tiny-label">THREE BUILDING BLOCKS</span>
          <h2>조건문을 대신하는<br>세 가지 역할</h2>
        </div>
        ${roleCards()}
      </div>

      <div class="quiet-note">
        <span class="note-icon" aria-hidden="true">◎</span>
        <p>이 실험실은 <strong>가상의 택배 배송 요금표</strong>(일반·신선 냉장·당일 특송 + 확장 드론)를 사용합니다. 모든 유형에서 <strong>변경 전후의 동작 일치</strong>를 먼저 확인한 뒤, 새 유형 추가 시 유지보수 범위 차이를 비교합니다.</p>
      </div>

      <div class="intro-next">
        <p>1단계에서는 세 함수에 흩어진 <code>switch (parcel.type)</code>을 직접 해부합니다.</p>
        <a class="text-link" href="#/read" data-route="/read">02 분기 해부로 이동 →</a>
      </div>
    </section>`;

    this.paintHero();
    this.on(root, 'click', ev => {
      const btn = ev.target.closest('[data-hero-type]');
      if (!btn) return;
      this.activeType = btn.dataset.heroType;
      this.paintHero();
    });
  }

  paintHero() {
    const sample = HERO_SAMPLES[this.activeType];
    const result = afterDispatch(sample);
    this.root.querySelector('#hero-waybill').innerHTML = waybillCard(sample, result);
    this.root.querySelectorAll('[data-hero-type]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.heroType === this.activeType));
    });
    this.root.querySelectorAll('[data-node]').forEach(node => {
      node.classList.toggle('active-node', node.dataset.node === this.activeType);
    });
  }
}
