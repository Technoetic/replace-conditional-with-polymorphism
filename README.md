# POLY / DISPATCH — 분기를 객체의 책임으로

마틴 파울러의 리팩터링 기법 **Replace Conditional with Polymorphism**을 택배 분류 센터의 운송장 규칙으로 추상화한 한국어 인터랙티브 웹 튜토리얼입니다.

- **공개 주소:** https://technoetic.github.io/replace-conditional-with-polymorphism/
- **공식 원전:**
  - [Replace Conditional with Polymorphism](https://refactoring.com/catalog/replaceConditionalWithPolymorphism.html)
  - [Replace Type Code with Subclasses](https://refactoring.com/catalog/replaceTypeCodeWithSubclasses.html)

## 학습 흐름 (6단계)

1. **시작 (`#/`)** — 같은 호출(`parcel.fee`, `parcel.hours`, `parcel.guide`)로 일반·신선 냉장·당일 특송 운송장을 실시간 미리보기
2. **분기 해부 (`#/read`)** — `shippingFee`, `estimatedHours`, `handlingGuide` 세 함수에 흩어진 `switch (parcel.type)`을 유형별로 동시 강조하고 운송장을 계산
3. **책임 옮기기 (`#/split`)** — 공통 기반(`Parcel`), 유형별 재정의(`ColdParcel`·`ExpressParcel`), 단일 생성 지점(`createParcel`)에 책임을 직접 배치
4. **확장 실험실 (`#/lab`)** — 기본 3유형 3,600개 조합의 동치성 확인 + 4번째 유형(`drone`) 추가 시 `switch` 누락 버그와 다형성 클래스 확장의 차이 비교
5. **여섯 문제 (`#/practice`)** — 이해 점검 6문항과 개인 메모(브라우저 `localStorage` 저장·이탈 보호)
6. **코드와 정리 (`#/code`)** — 실행 가능한 전후 코드 복사, 과잉 설계 경계선 3원칙, 공식 원전 링크

## 웹앱 6원칙 적용 요약

1. **책임별 JS 모듈 분리:** 진입점(`src/main.js`), 도메인(`src/domain/dispatch.js`), 6개 화면 클래스(`src/screens/`), 5개 서비스 클래스(`src/services/`), 공통 유틸(`src/shared/`) — 외부 런타임 의존성 0개
2. **계층형 CSS:** `tokens.css` → `base.css` → `components.css` 분리 후 빌드 시 해시 자산으로 통합
3. **화면·서비스 클래스 경계:** `BaseScreen` 수명주기(`mount`/`dispose`/`dirty`)와 DOM 비소유 서비스 분리
4. **비동기 제어:** `ContentService`가 `data/lessons.json`을 `async/await` + `AbortSignal` + 타임아웃 + 스키마 검증으로 로드하며 stale 응답 덮어쓰기 방지
5. **단일 진입점과 화면 URL:** `#/`~`#/code` 해시 딥링크·새로고침·뒤로/앞으로 이동·미등록 경로 안내 및 미존재 정적 자산 HTTP 404 보장
6. **강력 새로고침 없는 안전한 배포 전환:** `<meta name="app-build">`와 `version.json` 불일치 비교(업그레이드·롤백 모두 감지), `focus`/`pageshow`/`visibilitychange` 검사, 미저장 입력·저장 중 보호 후 다음 깨끗한 이동 시 전체 문서 자동 전환, 직전 빌드 해시 자산 자동 보존(`scripts/retain-assets.mjs`)

## 로컬 실행 및 검증

```bash
npm test
npm run build
npm start
```

라이선스: MIT ([LICENSE](./LICENSE))
