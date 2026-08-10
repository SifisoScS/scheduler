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
