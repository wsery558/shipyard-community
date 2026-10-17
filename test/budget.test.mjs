import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBudgetExceeded } from '../packages/open-core/src/core/budget.mjs';

test('spend below a positive budget remains within the limit', () => {
  const result = checkBudgetExceeded(99.75, 100);
  assert.equal(result.exceeded, false);
  assert.equal(result.spent, 99.75);
  assert.equal(result.budget, 100);
  assert.equal(Object.hasOwn(result, 'reason'), false);
});

test('reaching the exact budget triggers the limit', () => {
  const result = checkBudgetExceeded(100, 100);
  assert.equal(result.exceeded, true);
  assert.equal(result.spent, 100);
  assert.equal(result.budget, 100);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
});

test('spending above the budget reports the original amounts', () => {
  const result = checkBudgetExceeded(101.25, 100);
  assert.equal(result.exceeded, true);
  assert.equal(result.spent, 101.25);
  assert.equal(result.budget, 100);
  assert.match(result.reason, /101\.25/);
  assert.match(result.reason, /100/);
});

test('a zero budget is the documented unlimited mode', () => {
  assert.deepEqual(checkBudgetExceeded(1000, 0), {
    exceeded: false, spent: 1000, budget: 0,
  });
});

test('a negative budget also means no limit', () => {
  assert.deepEqual(checkBudgetExceeded(1000, -1), {
    exceeded: false, spent: 1000, budget: -1,
  });
});

test('non-numeric spend returns the invalid-input sentinel without coercion', () => {
  for (const spent of [undefined, null, '100', true, [], {}]) {
    assert.deepEqual(checkBudgetExceeded(spent, 100), {
      exceeded: false, spent: 0, budget: 0,
    }, `unexpected handling of ${String(spent)}`);
  }
});

test('non-numeric budget returns the invalid-input sentinel without coercion', () => {
  for (const budget of [undefined, null, '100', true, [], {}]) {
    assert.deepEqual(checkBudgetExceeded(100, budget), {
      exceeded: false, spent: 0, budget: 0,
    }, `unexpected handling of ${String(budget)}`);
  }
});
