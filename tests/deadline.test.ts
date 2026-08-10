import * as api from '../src/deadline/index';
import { validate, Deadline } from '../src/deadline/index';

describe('deadline module surface', () => {
  // Pins the exported surface so placeholder scaffolding cannot creep back in.
  test('exports exactly Deadline and validate', () => {
    expect(Object.keys(api).sort()).toEqual(['Deadline', 'validate']);
  });
});

describe('validate', () => {
  const definedButFalsy: Array<[string, unknown]> = [
    ['0', 0],
    ["''", ''],
    ['false', false],
    ['NaN', NaN],
    ['{}', {}],
    ['[]', []],
  ];

  // These are the cases a naive `return !!input` would get wrong.
  test.each(definedButFalsy)('returns true for %s (defined but falsy)', (_label, value) => {
    expect(validate(value)).toBe(true);
  });

  test('returns false for undefined and null only', () => {
    expect(validate(undefined)).toBe(false);
    expect(validate(null)).toBe(false);
  });
});

describe('Deadline construction', () => {
  test('exposes the due date and description it was given', () => {
    const due = new Date('2026-12-31');
    const deadline = new Deadline(due, 'Finish project');

    expect(deadline.getDueDate()).toEqual(due);
    expect(deadline.getDescription()).toBe('Finish project');
  });

  test('description is undefined when omitted', () => {
    expect(new Deadline(new Date('2030-01-01')).getDescription()).toBeUndefined();
  });

  test('preserves an empty-string description rather than dropping it', () => {
    expect(new Deadline(new Date('2030-01-01'), '').getDescription()).toBe('');
  });

  test('throws on an unparseable date', () => {
    expect(() => new Deadline(new Date('invalid'))).toThrow(
      'Invalid dueDate: must be a valid Date object.',
    );
  });

  test('throws when dueDate is not a Date at all', () => {
    expect(() => new Deadline('2030-01-01' as unknown as Date)).toThrow(
      'Invalid dueDate: must be a valid Date object.',
    );
  });
});

describe('Deadline.isOverdue', () => {
  test('is true for a past date and false for a future one', () => {
    expect(new Deadline(new Date('2020-01-01')).isOverdue()).toBe(true);
    expect(new Deadline(new Date('2030-01-01')).isOverdue()).toBe(false);
  });

  test('honours an explicitly supplied now', () => {
    const deadline = new Deadline(new Date('2025-06-01'));

    expect(deadline.isOverdue(new Date('2025-01-01'))).toBe(false);
    expect(deadline.isOverdue(new Date('2026-01-01'))).toBe(true);
  });

  test('is false at the exact due instant and true one millisecond later', () => {
    const due = new Date('2025-06-01T12:00:00.000Z');
    const deadline = new Deadline(due);

    expect(deadline.isOverdue(new Date(due.getTime()))).toBe(false);
    expect(deadline.isOverdue(new Date(due.getTime() + 1))).toBe(true);
  });

  test('throws when now is an invalid Date', () => {
    const deadline = new Deadline(new Date('2020-01-01'));

    expect(() => deadline.isOverdue(new Date('garbage'))).toThrow(
      'Invalid now: must be a valid Date object.',
    );
  });

  test('throws when now is not a Date at all', () => {
    const deadline = new Deadline(new Date('2020-01-01'));

    expect(() => deadline.isOverdue(42 as unknown as Date)).toThrow(
      'Invalid now: must be a valid Date object.',
    );
  });
});

// Regression tests for the defensive-copy fix. Each of these fails against the
// pre-fix implementation, which stored and returned the Date by reference.
// Timestamps are compared via getTime() so assertions do not depend on the
// machine's timezone.
describe('Deadline immutability', () => {
  test('mutating the Date passed to the constructor does not alter the deadline', () => {
    const due = new Date('2030-01-01');
    const original = due.getTime();
    const deadline = new Deadline(due);

    due.setFullYear(1990);

    expect(deadline.getDueDate().getTime()).toBe(original);
    expect(deadline.isOverdue()).toBe(false);
  });

  test('mutating the Date returned by getDueDate does not alter the deadline', () => {
    const deadline = new Deadline(new Date('2030-01-01'));
    const original = deadline.getDueDate().getTime();

    deadline.getDueDate().setFullYear(1990);

    expect(deadline.getDueDate().getTime()).toBe(original);
    expect(deadline.isOverdue()).toBe(false);
  });

  test('getDueDate returns a fresh object on every call', () => {
    const deadline = new Deadline(new Date('2030-01-01'));
    const first = deadline.getDueDate();
    const second = deadline.getDueDate();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('Deadline.msUntil', () => {
  const due = new Date('2026-06-01T12:00:00.000Z');

  test('is positive before the deadline', () => {
    expect(new Deadline(due).msUntil(new Date(due.getTime() - 5000))).toBe(5000);
  });

  test('is zero at the exact instant', () => {
    expect(new Deadline(due).msUntil(due)).toBe(0);
  });

  test('is negative once overdue, by exactly how long', () => {
    expect(new Deadline(due).msUntil(new Date(due.getTime() + 250))).toBe(-250);
  });

  test('defaults to the current time', () => {
    expect(new Deadline(new Date(Date.now() + 60_000)).msUntil()).toBeGreaterThan(0);
  });

  test('throws when now is invalid', () => {
    expect(() => new Deadline(due).msUntil(new Date('nope'))).toThrow(
      'Invalid now: must be a valid Date object.',
    );
  });
});

describe('Deadline.compare', () => {
  const earlier = new Deadline(new Date('2026-01-01T00:00:00.000Z'), 'earlier');
  const later = new Deadline(new Date('2026-06-01T00:00:00.000Z'), 'later');
  const alsoEarlier = new Deadline(new Date('2026-01-01T00:00:00.000Z'), 'same instant');

  test('orders earliest first', () => {
    expect(Deadline.compare(earlier, later)).toBeLessThan(0);
    expect(Deadline.compare(later, earlier)).toBeGreaterThan(0);
  });

  test('is zero for the same instant', () => {
    expect(Deadline.compare(earlier, alsoEarlier)).toBe(0);
  });

  test('works directly as a sort comparator', () => {
    expect([later, earlier].sort(Deadline.compare).map((d) => d.getDescription())).toEqual([
      'earlier',
      'later',
    ]);
  });
});

describe('Deadline serialisation', () => {
  const due = new Date('2026-06-01T12:00:00.000Z');

  test('toJSON emits the documented shape', () => {
    expect(new Deadline(due, 'ship it').toJSON()).toEqual({
      dueDate: '2026-06-01T12:00:00.000Z',
      description: 'ship it',
    });
  });

  test('toJSON omits description entirely when there is none', () => {
    expect(new Deadline(due).toJSON()).toEqual({ dueDate: '2026-06-01T12:00:00.000Z' });
    expect('description' in new Deadline(due).toJSON()).toBe(false);
  });

  test('JSON.stringify uses toJSON, not the internal fields', () => {
    expect(JSON.stringify(new Deadline(due))).toBe('{"dueDate":"2026-06-01T12:00:00.000Z"}');
  });

  test('private fields do not leak through Object.keys', () => {
    expect(Object.keys(new Deadline(due, 'x'))).toEqual([]);
  });

  test('round-trips through JSON', () => {
    const original = new Deadline(due, 'ship it');
    const restored = Deadline.fromJSON(JSON.parse(JSON.stringify(original)));

    expect(restored.getDueDate()).toEqual(original.getDueDate());
    expect(restored.getDescription()).toBe('ship it');
  });

  test('round-trips without a description', () => {
    const restored = Deadline.fromJSON(JSON.parse(JSON.stringify(new Deadline(due))));

    expect(restored.getDescription()).toBeUndefined();
  });

  test.each([
    ['a string', '2026-06-01'],
    ['null', null],
    ['a number', 42],
  ])('fromJSON rejects %s', (_label, value) => {
    expect(() => Deadline.fromJSON(value)).toThrow('Invalid Deadline JSON: expected an object.');
  });

  test('fromJSON rejects a missing dueDate', () => {
    expect(() => Deadline.fromJSON({})).toThrow(
      'Invalid Deadline JSON: dueDate must be an ISO date string.',
    );
  });

  test('fromJSON rejects a non-string dueDate', () => {
    expect(() => Deadline.fromJSON({ dueDate: 1717243200000 })).toThrow(
      'Invalid Deadline JSON: dueDate must be an ISO date string.',
    );
  });

  test('fromJSON rejects an unparseable dueDate', () => {
    expect(() => Deadline.fromJSON({ dueDate: 'not a date' })).toThrow(
      'Invalid Deadline JSON: dueDate is not a valid ISO date string.',
    );
  });

  test('fromJSON rejects a non-string description', () => {
    expect(() => Deadline.fromJSON({ dueDate: due.toISOString(), description: 7 })).toThrow(
      'Invalid Deadline JSON: description must be a string when present.',
    );
  });
});
