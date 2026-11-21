import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AFTER_CODE,
  BEFORE_CODE,
  BASE_CARRIER_TYPES,
  afterDispatch,
  beforeDispatch,
  compareDispatch,
  createParcel,
  validateParcelInput
} from '../src/domain/dispatch.js';

test('beforeDispatch and afterDispatch match across all 3,600 base combinations', () => {
  let count = 0;
  for (const type of BASE_CARRIER_TYPES) {
    for (let weightKg = 1; weightKg <= 20; weightKg++) {
      for (let distanceKm = 10; distanceKm <= 300; distanceKm += 10) {
        for (const fragile of [false, true]) {
          const cmp = compareDispatch({ type, weightKg, distanceKm, fragile });
          assert.equal(cmp.equal, true, `Mismatch at ${JSON.stringify({ type, weightKg, distanceKm, fragile })}`);
          count++;
        }
      }
    }
  }
  assert.equal(count, 3600);
});

test('displayed BEFORE_CODE and AFTER_CODE execute identically to domain model across all 3,600 base inputs', () => {
  const beforeMod = new Function(
    `${BEFORE_CODE}\nreturn { shippingFee, estimatedHours, handlingGuide };`
  )();
  const afterMod = new Function(`${AFTER_CODE}\nreturn { createParcel };`)();

  for (const type of BASE_CARRIER_TYPES) {
    for (let weightKg = 1; weightKg <= 20; weightKg++) {
      for (let distanceKm = 10; distanceKm <= 300; distanceKm += 10) {
        for (const fragile of [false, true]) {
          const input = { type, weightKg, distanceKm, fragile };
          const expected = afterDispatch(input);
          assert.equal(beforeMod.shippingFee(input), expected.fee);
          assert.equal(beforeMod.estimatedHours(input), expected.hours);
          assert.equal(beforeMod.handlingGuide(input), expected.guide);
          const p = afterMod.createParcel(input);
          assert.equal(p.fee, expected.fee);
          assert.equal(p.hours, expected.hours);
          assert.equal(p.guide, expected.guide);
        }
      }
    }
  }
});

test('exact boundary values for standard (150km), cold (100km), express (40/50km), drone (5kg)', () => {
  assert.equal(afterDispatch({ type: 'standard', weightKg: 2, distanceKm: 150, fragile: false }).hours, 24);
  assert.equal(afterDispatch({ type: 'standard', weightKg: 2, distanceKm: 151, fragile: false }).hours, 48);

  const cold100 = afterDispatch({ type: 'cold', weightKg: 3, distanceKm: 100, fragile: false });
  const cold101 = afterDispatch({ type: 'cold', weightKg: 3, distanceKm: 101, fragile: false });
  assert.equal(cold100.fee, 3000 + 1200 + 2500);
  assert.equal(cold100.hours, 12);
  assert.equal(cold101.fee, 3000 + 1200 + 2500 + 2000);
  assert.equal(cold101.hours, 18);

  const exp = afterDispatch({ type: 'express', weightKg: 1, distanceKm: 10, fragile: true });
  assert.equal(exp.fee, 6000 + 700 + 1000 + 1500);
  assert.equal(exp.hours, 2);

  const drone5 = afterDispatch({ type: 'drone', weightKg: 5, distanceKm: 40, fragile: false });
  const drone6 = afterDispatch({ type: 'drone', weightKg: 6, distanceKm: 40, fragile: false });
  assert.equal(drone5.fee, 5000 + 1600);
  assert.equal(drone5.hours, 1);
  assert.equal(drone6.fee, null);
  assert.equal(drone6.hours, null);
  assert.match(drone6.guide, /5kg 초과/);
});

test('omitDroneCase bug toggle causes guide mismatch ONLY on drone type', () => {
  const droneClean = compareDispatch({ type: 'drone', weightKg: 3, distanceKm: 40, fragile: false }, { omitDroneCase: false });
  assert.equal(droneClean.equal, true);

  const droneBug = compareDispatch({ type: 'drone', weightKg: 3, distanceKm: 40, fragile: false }, { omitDroneCase: true });
  assert.equal(droneBug.equal, false);
  assert.deepEqual(droneBug.diffs, ['guide']);
  assert.equal(droneBug.before.guide, '알 수 없는 배송');
  assert.equal(droneBug.after.guide, '자동 이착륙 패드 직배송');

  for (const type of BASE_CARRIER_TYPES) {
    const baseCheck = compareDispatch({ type, weightKg: 4, distanceKm: 120, fragile: true }, { omitDroneCase: true });
    assert.equal(baseCheck.equal, true);
  }
});

test('createParcel returns distinct subclass instances and validateParcelInput rejects invalid inputs', () => {
  assert.equal(createParcel({ type: 'standard', weightKg: 2, distanceKm: 20, fragile: false }).className, 'StandardParcel');
  assert.equal(createParcel({ type: 'cold', weightKg: 2, distanceKm: 20, fragile: false }).className, 'ColdParcel');
  assert.equal(createParcel({ type: 'express', weightKg: 2, distanceKm: 20, fragile: false }).className, 'ExpressParcel');
  assert.equal(createParcel({ type: 'drone', weightKg: 2, distanceKm: 20, fragile: false }).className, 'DroneParcel');

  assert.throws(() => validateParcelInput({ type: 'rocket', weightKg: 2, distanceKm: 20, fragile: false }));
  assert.throws(() => validateParcelInput({ type: 'drone', weightKg: 2, distanceKm: 20, fragile: false }, { allowDrone: false }));
  assert.throws(() => validateParcelInput({ type: 'standard', weightKg: 0, distanceKm: 20, fragile: false }));
  assert.throws(() => validateParcelInput({ type: 'standard', weightKg: 21, distanceKm: 20, fragile: false }));
  assert.throws(() => validateParcelInput({ type: 'standard', weightKg: 2.5, distanceKm: 20, fragile: false }));
  assert.throws(() => validateParcelInput({ type: 'standard', weightKg: 2, distanceKm: 9, fragile: false }));
  assert.throws(() => validateParcelInput({ type: 'standard', weightKg: 2, distanceKm: 301, fragile: false }));
  assert.throws(() => beforeDispatch({ type: 'standard', weightKg: 2, distanceKm: 20, fragile: 'yes' }));
});
