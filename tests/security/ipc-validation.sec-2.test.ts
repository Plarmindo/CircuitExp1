import { expect, test } from 'vitest';
import { validateSchema } from '../../ipc-validation.cjs';

test('SEC-2 validateSchema string nonEmpty', () => {
  const ok = validateSchema([{ type: 'string', nonEmpty: true }], ['abc']);
  expect(ok.ok).toBe(true);
  const bad = validateSchema([{ type: 'string', nonEmpty: true }], ['   ']);
  expect(bad.ok).toBe(false);
});

test('SEC-2 validateSchema object optional', () => {
  const res = validateSchema([{ type: 'object', optional: true }], [undefined]);
  expect(res.ok).toBe(true);
});

test('SEC-2 tuple nested', () => {
  const res = validateSchema(
    [{ type: 'tuple', items: [{ type: 'string', nonEmpty: true }, { type: 'record' }] }],
    [['root', { a: 1 }]]
  );
  expect(res.ok).toBe(true);
  const fail = validateSchema(
    [{ type: 'tuple', items: [{ type: 'string', nonEmpty: true }, { type: 'record' }] }],
    [['', 5]]
  );
  expect(fail.ok).toBe(false);
});

test('SEC-2 path traversal detection', () => {
  const res = validateSchema(
    [{ type: 'string', nonEmpty: true, noTraversal: true }],
    ['C:/data/folder']
  );
  expect(res.ok).toBe(true);
  const bad = validateSchema(
    [{ type: 'string', nonEmpty: true, noTraversal: true }],
    ['../secret']
  );
  expect(bad.ok).toBe(false);
  expect(bad.errors?.[0]).toMatch(/path traversal/);
});
