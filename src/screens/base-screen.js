import { escapeHTML as e, won, hoursText } from '../shared/dom.js';
import { ROUTES } from '../shared/routes.js';
import { ALL_CARRIER_TYPES, BASE_CARRIER_TYPES, CARRIER_META } from '../domain/dispatch.js';

export class BaseScreen {
  constructor(app, lesson) {
    this.app = app;
    this.lesson = lesson;
    this.abort = new AbortController();
    this.dirty = false;
    this.disposed = false;
  }

  on(target, event, handler) {
    target.addEventListener(event, handler, { signal: this.abort.signal });
  }

  head() {
    const i = ROUTES.findIndex(r => r.id === this.lesson.id);
    return `<header class="lesson-heading"><p class="eyebrow">FIELD NOTE ${String(i + 1).padStart(2, '0')} <span>${e(this.lesson.kicker)}</span></p><h1>${e(this.lesson.title)}</h1><p class="lede">${e(this.lesson.intro)}</p></header>`;
  }

  foot() {
    const i = ROUTES.findIndex(r => r.id === this.lesson.id);
    const next = ROUTES[i + 1];
    return `<footer class="lesson-bottom"><div><span class="tiny-label">TAKE THIS WITH YOU</span><p>${e(this.lesson.takeaway)}</p></div>${
      next
        ? `<a class="button" href="#${next.path}" data-route="${next.path}">${e(next.label)} <span aria-hidden="true">↗</span></a>`
        : '<a class="button secondary" href="#/lab" data-route="/lab">확장 실험실로 돌아가기 ↗</a>'
    }</footer>`;
  }

  changed() {
    this.dirty = true;
    this.app.editState?.();
  }

  async saveDraft() {
    this.dirty = false;
    this.app.editState?.();
  }

  discard() {
    this.dirty = false;
    this.app.editState?.();
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
  }
}

export function waybillCard(input, result) {
  const meta = CARRIER_META[input.type] || CARRIER_META.standard;
  return `<div class="waybill ${e(meta.role)}">
    <div class="waybill-top"><span>POLY / DISPATCH</span><span>${e(meta.badge)}</span></div>
    <div class="waybill-title">${e(meta.label)}<small>${e(meta.className)}</small></div>
    <div class="waybill-rule"></div>
    <div class="waybill-line"><span>WEIGHT · DISTANCE</span><b>${e(input.weightKg)}kg · ${e(input.distanceKm)}km</b></div>
    <div class="waybill-line"><span>FRAGILE HANDLING</span><b>${input.fragile ? '파손 주의 (+1,500원)' : '일반 포장'}</b></div>
    <div class="waybill-line"><span>ETA · HOURS</span><b>${e(hoursText(result.hours))}</b></div>
    <div class="waybill-guide">${e(result.guide)}</div>
    <div class="waybill-rule"></div>
    <div class="waybill-total"><span>SHIPPING FEE</span><strong>${e(won(result.fee))}</strong></div>
    <div class="waybill-barcode" aria-hidden="true"></div>
    <p class="waybill-sign">same dispatch call · polymorphic rule.</p>
  </div>`;
}

export function roleCards() {
  return `<div class="role-cards">
    <article class="role-card standard"><span class="role-number">01 / SUPERCLASS</span><h3>공통 기반</h3><code>class Parcel</code><p>무게·거리·파손 주의 할증을 한 번만 정의합니다.</p></article>
    <article class="role-card cold"><span class="role-number">02 / SUBCLASSES</span><h3>유형별 책임</h3><code>Standard · Cold · Express</code><p>각 배송 수단이 자기 요금·시간·안내를 재정의합니다.</p></article>
    <article class="role-card express"><span class="role-number">03 / FACTORY</span><h3>단일 생성 지점</h3><code>createParcel(data)</code><p>type 문자열 분기를 객체 생성 시점 1곳에 격리합니다.</p></article>
  </div>`;
}

export function parcelFields(input, prefix = 'parcel', { includeDrone = false } = {}) {
  const types = includeDrone ? ALL_CARRIER_TYPES : BASE_CARRIER_TYPES;
  return `<div class="parcel-fields">
    <div class="field">
      <label for="${prefix}-type">배송 유형 <span>${includeDrone ? '4종 (드론 포함)' : '기본 3종'}</span></label>
      <select id="${prefix}-type" name="type">
        ${types
          .map(t => `<option value="${e(t)}"${input.type === t ? ' selected' : ''}>${e(CARRIER_META[t].label)} (${e(t)})</option>`)
          .join('')}
      </select>
    </div>
    <div class="input-pair">
      <div class="field">
        <label for="${prefix}-weight">무게 <span>1–20kg</span></label>
        <input id="${prefix}-weight" name="weightKg" type="number" min="1" max="20" step="1" value="${e(input.weightKg)}" required inputmode="numeric">
      </div>
      <div class="field">
        <label for="${prefix}-distance">거리 <span>10–300km</span></label>
        <input id="${prefix}-distance" name="distanceKm" type="number" min="10" max="300" step="10" value="${e(input.distanceKm)}" required inputmode="numeric">
      </div>
    </div>
    <label class="fragile-check" for="${prefix}-fragile">
      <input id="${prefix}-fragile" name="fragile" type="checkbox"${input.fragile ? ' checked' : ''}>
      <span><b>파손 주의 상품</b><small>모든 배송 유형 공통 할증 +1,500원 (Parcel.fragileSurcharge)</small></span>
    </label>
  </div>`;
}
