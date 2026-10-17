import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTask, mergePlans, computeProgress,
} from '../packages/open-core/src/core/plan.mjs';

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeDeep(item);
    Object.freeze(value);
  }
  return value;
}

test('normalizing a missing task supplies a usable identity and defaults', () => {
  const task = normalizeTask(null, 3);
  assert.match(task.id, /^task_\d+_3$/);
  assert.deepEqual({ ...task, id: 'generated' }, {
    id: 'generated', title: 'Untitled', points: 1,
    status: 'todo', verify: [], notes: '',
  });
});

test('normalization preserves an explicit identity and task details', () => {
  const input = freezeDeep({
    id: 'review-7', title: 'Review patch', points: '5', status: 'blocked',
    verify: ['node --test'], notes: 'Waiting for approval',
  });
  const before = structuredClone(input);
  const task = normalizeTask(input);
  assert.deepEqual(task, { ...before, points: 5 });
  assert.deepEqual(input, before);
  assert.notEqual(task, input);
});

test('tasks with the same title get distinct generated identities by position', () => {
  const first = normalizeTask({ title: 'Review patch' }, 0);
  const second = normalizeTask({ title: 'Review patch' }, 1);
  assert.notEqual(first.id, second.id);
  assert.equal(first.title, 'Review patch');
  assert.equal(second.title, 'Review patch');
});

test('omitted points and invalid verification lists receive defaults', () => {
  const task = normalizeTask({ title: 'Build', verify: 'pnpm build' });
  assert.equal(task.points, 1);
  assert.equal(task.status, 'todo');
  assert.deepEqual(task.verify, []);
  assert.equal(task.notes, '');
});

test('merging a renamed completed task retains its ID, status, estimate and notes', () => {
  const result = mergePlans({ tasks: [{
    id: 'fixed-id', title: 'Old title', status: 'done',
    points: 8, notes: 'Verified locally',
  }] }, { tasks: [{
    id: 'fixed-id', title: 'New title', status: 'todo',
    points: 1, notes: 'Replacement note',
  }] });
  assert.deepEqual(result.tasks, [{
    id: 'fixed-id', title: 'New title', status: 'done',
    points: 8, notes: 'Verified locally',
  }]);
});

test('matching a blocked task by title preserves the existing identity', () => {
  const result = mergePlans({ tasks: [{
    id: 'original-id', title: 'Publish release', status: 'blocked',
    points: 3, notes: 'Awaiting review',
  }] }, { tasks: [{
    id: 'replacement-id', title: 'Publish release', status: 'done', points: 1,
  }] });
  assert.equal(result.tasks[0].id, 'original-id');
  assert.equal(result.tasks[0].status, 'blocked');
  assert.equal(result.tasks[0].points, 3);
  assert.equal(result.tasks[0].notes, 'Awaiting review');
});

test('an explicit ID match takes precedence over another task with the same title', () => {
  const result = mergePlans({ tasks: [
    { id: 'task-a', title: 'Original A', status: 'done', points: 2 },
    { id: 'task-b', title: 'Shared title', status: 'blocked', points: 7 },
  ] }, { tasks: [
    { id: 'task-a', title: 'Shared title', status: 'todo', points: 1 },
  ] });
  assert.equal(result.tasks[0].id, 'task-a');
  assert.equal(result.tasks[0].status, 'done');
  assert.equal(result.tasks[0].points, 2);
});

test('an unfinished task can adopt a new status while a new task is normalized', () => {
  const result = mergePlans({ tasks: [
    { id: 'known', title: 'Prepare', status: 'todo', points: 2 },
  ] }, { tasks: [
    { id: 'known', title: 'Prepare', status: 'done', points: 4 },
    { title: 'Document release' },
  ] });
  assert.equal(result.tasks[0].status, 'done');
  assert.equal(result.tasks[0].points, 2);
  assert.equal(result.tasks[1].title, 'Document release');
  assert.equal(result.tasks[1].points, 1);
  assert.equal(result.tasks[1].status, 'todo');
  assert.deepEqual(result.tasks[1].verify, []);
  assert.ok(result.tasks[1].id);
});

test('merging frozen input plans leaves both plans unchanged', () => {
  const existing = freezeDeep({ tasks: [{
    id: 'a', title: 'Build', points: 5, status: 'done', notes: 'Approved',
  }] });
  const incoming = freezeDeep({ tasks: [
    { id: 'a', title: 'Build again', points: 2, status: 'todo' },
    { id: 'b', title: 'Review', points: 3, verify: ['inspect output'] },
  ] });
  const beforeExisting = structuredClone(existing);
  const beforeIncoming = structuredClone(incoming);
  const result = mergePlans(existing, incoming);
  assert.deepEqual(existing, beforeExisting);
  assert.deepEqual(incoming, beforeIncoming);
  assert.notEqual(result, existing);
  assert.notEqual(result, incoming);
  assert.notEqual(result.tasks[0], existing.tasks[0]);
  assert.notEqual(result.tasks[1], incoming.tasks[1]);
});

test('missing or empty plans merge into an empty task list', () => {
  assert.deepEqual(mergePlans(undefined, undefined), { tasks: [] });
  assert.deepEqual(mergePlans({ tasks: [] }, { tasks: [] }), { tasks: [] });
});

test('progress is weighted by points and blocked tasks do not count as done', () => {
  const plan = freezeDeep({ tasks: [
    { id: 'a', points: 5, status: 'done' },
    { id: 'b', points: 10, status: 'blocked' },
    { id: 'c', points: 5, status: 'todo' },
  ] });
  const before = structuredClone(plan);
  assert.deepEqual(computeProgress(plan), {
    donePoints: 5, totalPoints: 20, percent: 25,
  });
  assert.deepEqual(plan, before);
});

test('progress rounds to the nearest whole percent', () => {
  assert.deepEqual(computeProgress({ tasks: [
    { points: 1, status: 'done' },
    { points: 2, status: 'todo' },
  ] }), { donePoints: 1, totalPoints: 3, percent: 33 });
});

test('completed plans report 100 percent including numeric point strings', () => {
  assert.deepEqual(computeProgress({ tasks: [
    { points: '3', status: 'done' },
    { points: 2, status: 'done' },
  ] }), { donePoints: 5, totalPoints: 5, percent: 100 });
});

test('empty plans and zero-point tasks have a defined zero progress', () => {
  for (const plan of [undefined, {}, { tasks: [] }, {
    tasks: [{ points: 0, status: 'done' }],
  }]) {
    assert.deepEqual(computeProgress(plan), {
      donePoints: 0, totalPoints: 0, percent: 0,
    });
  }
});
