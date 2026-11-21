export const BASE_CARRIER_TYPES = ['standard', 'cold', 'express'];
export const ALL_CARRIER_TYPES = ['standard', 'cold', 'express', 'drone'];

export const CARRIER_META = {
  standard: {
    id: 'standard',
    label: '일반 택배',
    className: 'StandardParcel',
    role: 'standard',
    badge: 'STANDARD',
    summary: '기본 3,000원 + kg당 400원 · 150km 초과 시 48시간'
  },
  cold: {
    id: 'cold',
    label: '신선 냉장',
    className: 'ColdParcel',
    role: 'cold',
    badge: 'COLD CHAIN',
    summary: '기본요금 + 보냉 2,500원 + 100km 초과 아이스팩 2,000원'
  },
  express: {
    id: 'express',
    label: '당일 특송',
    className: 'ExpressParcel',
    role: 'express',
    badge: 'EXPRESS',
    summary: '기본 6,000원 + kg당 700원 + 50km당 1,000원 · 퀵 직배'
  },
  drone: {
    id: 'drone',
    label: '드론 배송',
    className: 'DroneParcel',
    role: 'drone',
    badge: 'NEW · DRONE',
    summary: '5kg 이하 전용 · 기본 5,000원 + 20km당 800원 · 자동 이착륙'
  }
};

export const SPLIT_SLOTS = [
  {
    id: 'superclass',
    number: '01 / BASE',
    title: '상위 클래스 Parcel',
    role: 'standard',
    description: '모든 택배가 공통으로 쓰는 필드와 파손 주의 할증(+1,500원)을 한 곳에 둡니다.',
    expected: 'fragileSurcharge',
    hint: '공통 계산인 fragileSurcharge()와 baseFee()를 Parcel에 두면 하위 클래스 중복이 사라집니다.'
  },
  {
    id: 'cold',
    number: '02 / OVERRIDE',
    title: '하위 클래스 ColdParcel',
    role: 'cold',
    description: '2°C 보냉비와 100km 초과 장거리 아이스팩 규칙만 자기 클래스에 모읍니다.',
    expected: 'coldChainRule',
    hint: '냉장 전용 보냉비·장거리 아이스팩·12/18시간 배송 규칙은 ColdParcel이 전담합니다.'
  },
  {
    id: 'express',
    number: '03 / OVERRIDE',
    title: '하위 클래스 ExpressParcel',
    role: 'express',
    description: '전용 퀵 직배 요금(6,000원 시작)과 거리 비례 단축 시간을 재정의합니다.',
    expected: 'expressQuickRule',
    hint: '당일 특송만의 요금 공식·40km/h 기준 시간·퀵 직배 안내는 ExpressParcel의 책임입니다.'
  },
  {
    id: 'factory',
    number: '04 / FACTORY',
    title: '팩토리 createParcel()',
    role: 'drone',
    description: '외부 데이터(parcel.type)를 알맞은 하위 클래스 인스턴스로 바꾸는 선택을 단 한 곳에 격리합니다.',
    expected: 'typeFactory',
    hint: 'createParcel(data) 한 곳에서만 type을 판별하면 나머지 계산·안내 함수에서 switch가 사라집니다.'
  }
];

export const RESPONSIBILITY_CHIPS = [
  { id: 'fragileSurcharge', label: 'fragileSurcharge() · baseFee()', summary: '모든 택배 공통 할증·기본 계산' },
  { id: 'coldChainRule', label: 'ColdParcel.fee / hours / guide', summary: '보냉비 + 100km 초과 아이스팩' },
  { id: 'expressQuickRule', label: 'ExpressParcel.fee / hours / guide', summary: '당일 퀵 요금 + 40km/h 직배' },
  { id: 'typeFactory', label: 'createParcel(data)', summary: 'type 문자열 → 하위 클래스 1회 선택' }
];

export function validateParcelInput(input, { allowDrone = true } = {}) {
  const allowed = allowDrone ? ALL_CARRIER_TYPES : BASE_CARRIER_TYPES;
  if (!input || typeof input !== 'object') throw Error('운송장 입력 형식이 올바르지 않아요.');
  if (!allowed.includes(input.type)) throw Error('지원하지 않는 배송 유형이에요.');
  if (!Number.isInteger(input.weightKg) || input.weightKg < 1 || input.weightKg > 20) {
    throw Error('무게는 1~20kg 사이의 정수로 입력해 주세요.');
  }
  if (!Number.isInteger(input.distanceKm) || input.distanceKm < 10 || input.distanceKm > 300) {
    throw Error('거리는 10~300km 사이의 정수로 입력해 주세요.');
  }
  if (typeof input.fragile !== 'boolean') {
    throw Error('파손 주의 여부는 참/거짓이어야 해요.');
  }
  return {
    type: input.type,
    weightKg: input.weightKg,
    distanceKm: input.distanceKm,
    fragile: input.fragile
  };
}

// --- BEFORE: Scattered switch statements across 3 functions ---
export function shippingFeeBefore(parcel) {
  const fragileFee = parcel.fragile ? 1500 : 0;
  switch (parcel.type) {
    case 'standard':
      return 3000 + parcel.weightKg * 400 + fragileFee;
    case 'cold':
      return 3000 + parcel.weightKg * 400 + 2500 + (parcel.distanceKm > 100 ? 2000 : 0) + fragileFee;
    case 'express':
      return 6000 + parcel.weightKg * 700 + Math.ceil(parcel.distanceKm / 50) * 1000 + fragileFee;
    case 'drone':
      if (parcel.weightKg > 5) return null;
      return 5000 + Math.ceil(parcel.distanceKm / 20) * 800 + fragileFee;
    default:
      return null;
  }
}

export function estimatedHoursBefore(parcel) {
  switch (parcel.type) {
    case 'standard':
      return parcel.distanceKm > 150 ? 48 : 24;
    case 'cold':
      return parcel.distanceKm > 100 ? 18 : 12;
    case 'express':
      return Math.max(2, Math.ceil(parcel.distanceKm / 40));
    case 'drone':
      if (parcel.weightKg > 5) return null;
      return Math.max(1, Math.ceil(parcel.distanceKm / 60));
    default:
      return null;
  }
}

export function handlingGuideBefore(parcel, { omitDroneCase = false } = {}) {
  switch (parcel.type) {
    case 'standard':
      return parcel.fragile ? '완충재 보강 · 상단 적재' : '일반 컨베이어 분류';
    case 'cold':
      return parcel.distanceKm > 100 ? '2°C 냉장 · 아이스팩 2매 보강' : '2°C 냉장 차량 직송';
    case 'express':
      return parcel.fragile ? '전용 퀵 직배 · 완충 포장' : '전용 퀵 직배 · 우선 출고';
    case 'drone':
      if (omitDroneCase) return '알 수 없는 배송';
      return parcel.weightKg > 5 ? '5kg 초과 — 드론 적재 불가' : '자동 이착륙 패드 직배송';
    default:
      return '알 수 없는 배송';
  }
}

export function beforeDispatch(input, { omitDroneCase = false } = {}) {
  const p = validateParcelInput(input, { allowDrone: true });
  return {
    fee: shippingFeeBefore(p),
    hours: estimatedHoursBefore(p),
    guide: handlingGuideBefore(p, { omitDroneCase }),
    touchedSwitches: 3,
    missingCaseHit: Boolean(omitDroneCase && p.type === 'drone')
  };
}

// --- AFTER: Polymorphic class hierarchy + single factory ---
export class Parcel {
  constructor({ type, weightKg, distanceKm, fragile }) {
    this.type = type;
    this.weightKg = weightKg;
    this.distanceKm = distanceKm;
    this.fragile = fragile;
  }
  get fragileSurcharge() {
    return this.fragile ? 1500 : 0;
  }
  get baseFee() {
    return 3000 + this.weightKg * 400;
  }
  get fee() {
    return this.baseFee + this.fragileSurcharge;
  }
  get hours() {
    return this.distanceKm > 150 ? 48 : 24;
  }
  get guide() {
    return this.fragile ? '완충재 보강 · 상단 적재' : '일반 컨베이어 분류';
  }
  get className() {
    return this.constructor.name;
  }
}

export class StandardParcel extends Parcel {}

export class ColdParcel extends Parcel {
  get fee() {
    const longHaulIce = this.distanceKm > 100 ? 2000 : 0;
    return this.baseFee + 2500 + longHaulIce + this.fragileSurcharge;
  }
  get hours() {
    return this.distanceKm > 100 ? 18 : 12;
  }
  get guide() {
    return this.distanceKm > 100 ? '2°C 냉장 · 아이스팩 2매 보강' : '2°C 냉장 차량 직송';
  }
}

export class ExpressParcel extends Parcel {
  get fee() {
    return 6000 + this.weightKg * 700 + Math.ceil(this.distanceKm / 50) * 1000 + this.fragileSurcharge;
  }
  get hours() {
    return Math.max(2, Math.ceil(this.distanceKm / 40));
  }
  get guide() {
    return this.fragile ? '전용 퀵 직배 · 완충 포장' : '전용 퀵 직배 · 우선 출고';
  }
}

export class DroneParcel extends Parcel {
  get overweight() {
    return this.weightKg > 5;
  }
  get fee() {
    if (this.overweight) return null;
    return 5000 + Math.ceil(this.distanceKm / 20) * 800 + this.fragileSurcharge;
  }
  get hours() {
    if (this.overweight) return null;
    return Math.max(1, Math.ceil(this.distanceKm / 60));
  }
  get guide() {
    return this.overweight ? '5kg 초과 — 드론 적재 불가' : '자동 이착륙 패드 직배송';
  }
}

const CARRIER_REGISTRY = Object.freeze({
  standard: StandardParcel,
  cold: ColdParcel,
  express: ExpressParcel,
  drone: DroneParcel
});

export function createParcel(input) {
  const valid = validateParcelInput(input, { allowDrone: true });
  const Subclass = CARRIER_REGISTRY[valid.type];
  return new Subclass(valid);
}

export function afterDispatch(input) {
  const parcel = createParcel(input);
  return {
    fee: parcel.fee,
    hours: parcel.hours,
    guide: parcel.guide,
    className: parcel.className,
    touchedSwitches: 0
  };
}

export function compareDispatch(input, { omitDroneCase = false } = {}) {
  const valid = validateParcelInput(input, { allowDrone: true });
  const before = beforeDispatch(valid, { omitDroneCase });
  const after = afterDispatch(valid);
  const diffs = [];
  if (before.fee !== after.fee) diffs.push('fee');
  if (before.hours !== after.hours) diffs.push('hours');
  if (before.guide !== after.guide) diffs.push('guide');
  return { input: valid, before, after, equal: diffs.length === 0, diffs };
}

export const BEFORE_CODE = `function shippingFee(parcel) {
  const fragileFee = parcel.fragile ? 1500 : 0;
  switch (parcel.type) {
    case 'standard':
      return 3000 + parcel.weightKg * 400 + fragileFee;
    case 'cold':
      return 3000 + parcel.weightKg * 400 + 2500
        + (parcel.distanceKm > 100 ? 2000 : 0) + fragileFee;
    case 'express':
      return 6000 + parcel.weightKg * 700
        + Math.ceil(parcel.distanceKm / 50) * 1000 + fragileFee;
    default:
      return null;
  }
}

function estimatedHours(parcel) {
  switch (parcel.type) {
    case 'standard': return parcel.distanceKm > 150 ? 48 : 24;
    case 'cold':     return parcel.distanceKm > 100 ? 18 : 12;
    case 'express':  return Math.max(2, Math.ceil(parcel.distanceKm / 40));
    default:         return null;
  }
}

function handlingGuide(parcel) {
  switch (parcel.type) {
    case 'standard':
      return parcel.fragile ? '완충재 보강 · 상단 적재' : '일반 컨베이어 분류';
    case 'cold':
      return parcel.distanceKm > 100 ? '2°C 냉장 · 아이스팩 2매 보강' : '2°C 냉장 차량 직송';
    case 'express':
      return parcel.fragile ? '전용 퀵 직배 · 완충 포장' : '전용 퀵 직배 · 우선 출고';
    default:
      return '알 수 없는 배송';
  }
}`;

export const AFTER_CODE = `class Parcel {
  constructor({ type, weightKg, distanceKm, fragile }) {
    Object.assign(this, { type, weightKg, distanceKm, fragile });
  }
  get fragileSurcharge() { return this.fragile ? 1500 : 0; }
  get baseFee()          { return 3000 + this.weightKg * 400; }
  get fee()              { return this.baseFee + this.fragileSurcharge; }
  get hours()            { return this.distanceKm > 150 ? 48 : 24; }
  get guide() {
    return this.fragile ? '완충재 보강 · 상단 적재' : '일반 컨베이어 분류';
  }
}

class StandardParcel extends Parcel {}

class ColdParcel extends Parcel {
  get fee() {
    const ice = this.distanceKm > 100 ? 2000 : 0;
    return this.baseFee + 2500 + ice + this.fragileSurcharge;
  }
  get hours() { return this.distanceKm > 100 ? 18 : 12; }
  get guide() {
    return this.distanceKm > 100 ? '2°C 냉장 · 아이스팩 2매 보강' : '2°C 냉장 차량 직송';
  }
}

class ExpressParcel extends Parcel {
  get fee() {
    return 6000 + this.weightKg * 700
      + Math.ceil(this.distanceKm / 50) * 1000 + this.fragileSurcharge;
  }
  get hours() { return Math.max(2, Math.ceil(this.distanceKm / 40)); }
  get guide() {
    return this.fragile ? '전용 퀵 직배 · 완충 포장' : '전용 퀵 직배 · 우선 출고';
  }
}

function createParcel(data) {
  switch (data.type) {
    case 'standard': return new StandardParcel(data);
    case 'cold':     return new ColdParcel(data);
    case 'express':  return new ExpressParcel(data);
    default:         throw new Error('지원하지 않는 배송 유형');
  }
}`;
