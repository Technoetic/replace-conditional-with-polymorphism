import { BaseScreen, roleCards } from './base-screen.js';
import { AFTER_CODE, BEFORE_CODE } from '../domain/dispatch.js';
import { escapeHTML as e } from '../shared/dom.js';

export class CodeScreen extends BaseScreen {
  mount(root) {
    this.root = root;
    const sources = this.app.content.sources;

    root.innerHTML = `<section class="lesson">
      ${this.head()}
      <div class="code-intro">
        <span class="tiny-label">SIDE-BY-SIDE EXECUTABLE CODE</span>
        <h2>세 함수의 switch를<br>클래스 계층과 팩토리로 정리한 전체 코드</h2>
        <p>아래 두 코드는 기본 3유형(<code>standard</code>·<code>cold</code>·<code>express</code>)의 3,600개 유효 입력 조합에서 배송비·예상 시간·취급 안내가 100% 동일하게 동작합니다. 복사해 Node.js나 브라우저 콘솔에서 바로 실행해 볼 수 있습니다.</p>
      </div>

      <div class="full-code-grid">
        <article class="full-code">
          <div class="full-code-head">
            <div><span class="tiny-label">BEFORE · 3 SCATTERED SWITCHES</span><h2>함수마다 parcel.type 분기 반복</h2></div>
            <button type="button" class="copy-button" data-copy="before">코드 복사</button>
          </div>
          <pre tabindex="0"><code>${e(BEFORE_CODE)}</code></pre>
        </article>

        <article class="full-code">
          <div class="full-code-head">
            <div><span class="tiny-label">AFTER · CLASS HIERARCHY + FACTORY</span><h2>각 유형 클래스가 자기 규칙을 소유</h2></div>
            <button type="button" class="copy-button" data-copy="after">코드 복사</button>
          </div>
          <pre tabindex="0"><code>${e(AFTER_CODE)}</code></pre>
        </article>
      </div>

      <p id="copy-status" class="copy-status" role="status" aria-live="polite"></p>
      <div id="copy-fallback" hidden>
        <label for="copy-text">클립보드 권한이 제한되어 아래 상자에서 직접 복사할 수 있어요.</label>
        <textarea id="copy-text" rows="6" readonly></textarea>
      </div>

      <div class="code-roles">
        <span class="tiny-label">ARCHITECTURE RECAP</span>
        ${roleCards()}
      </div>

      <section class="guardrail-section">
        <div>
          <span class="tiny-label">WHEN NOT TO USE IT</span>
          <h2>모든 조건문을<br>클래스로 바꾸진 마세요</h2>
        </div>
        <div class="guardrail-list">
          <article>
            <span>01</span>
            <div>
              <h3>한 곳에만 있는 짧은 조건문이라면 그대로 두세요</h3>
              <p>분기 대상이 한 함수에만 존재하고 몇 줄이면 충분히 읽힌다면, 클래스를 여러 개 만드는 편이 오히려 복잡합니다. 먼저 <strong>Decompose Conditional</strong>이나 단순한 조회 표(lookup map)를 고려하세요.</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>공통 동작과 예외 동작을 먼저 구분하세요</h3>
              <p>모든 하위 클래스가 완전히 다를 필요는 없습니다. 기본 규칙은 상위 클래스 <code>Parcel</code>에 두고, 정말 다른 동작만 하위 클래스가 재정의(override)해야 상속 계층이 가볍게 유지됩니다.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>팩토리 분기 1곳은 결함이 아니라 경계선입니다</h3>
              <p>외부 JSON이나 DB 문자열을 객체로 바꿀 때는 <code>createParcel(data)</code> 같은 진입점에 분기가 한 번 필요합니다. 핵심은 그 선택이 비즈니스 로직 곳곳으로 퍼지지 않게 1곳에 가두는 것입니다.</p>
            </div>
          </article>
        </div>
      </section>

      <section class="source-section">
        <div>
          <span class="tiny-label">CANONICAL REFERENCES</span>
          <h2>마틴 파울러 공식 원전</h2>
          <p>이 튜토리얼의 택배 배송 예제는 아래 카탈로그의 원리를 한국어 학습용으로 새로 구성한 가상 사례입니다.</p>
        </div>
        <div class="source-links">
          ${sources
            .map(
              s => `<a href="${e(s.url)}" target="_blank" rel="noopener noreferrer"><div><strong>${e(s.title)}</strong><small>${e(s.note || '')}</small></div><span aria-hidden="true">↗</span></a>`
            )
            .join('')}
        </div>
      </section>
      ${this.foot()}
    </section>`;

    this.on(root, 'click', ev => {
      const btn = ev.target.closest('[data-copy]');
      if (!btn) return;
      const text = btn.dataset.copy === 'after' ? AFTER_CODE : BEFORE_CODE;
      const label = btn.dataset.copy === 'after' ? '변경 후(다형성)' : '변경 전(switch)';
      this.copyCode(text, label).catch(() => {});
    });
  }

  async copyCode(text, label) {
    const status = this.root.querySelector('#copy-status');
    const fallback = this.root.querySelector('#copy-fallback');
    const area = this.root.querySelector('#copy-text');
    try {
      if (!navigator.clipboard?.writeText) throw Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (this.disposed) return;
      fallback.hidden = true;
      status.textContent = `${label} 코드를 클립보드에 복사했습니다.`;
    } catch {
      if (this.disposed) return;
      area.value = text;
      fallback.hidden = false;
      area.focus();
      area.select();
      status.textContent = `${label} 코드를 아래 상자에 표시했습니다. Ctrl+C로 복사해 주세요.`;
    }
  }
}
