import * as api from '../src/interval/index';
import { Interval } from '../src/interval/index';
import { Deadline } from '../src/deadline/index';

const EPOCH = new Date('2026-01-01T00:00:00.000Z');
const MINUTE = 60_000;

describe('interval module surface', () => {
  test('exports exactly Interval', () => {
    expect(Object.keys(api).sort()).toEqual(['Interval']);
  });
});

describe('Interval construction', () => {
  test('exposes what it was given', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.getStartsAt()).toEqual(EPOCH);
    expect(interval.getEveryMs()).toBe(MINUTE);
  });

  test('throws on an unparseable startsAt', () => {
    expect(() => new Interval(new Date('nope'), MINUTE)).toThrow(
      'Invalid startsAt: must be a valid Date object.',
    );
  });

  test('throws when startsAt is not a Date at all', () => {
    expect(() => new Interval('2026-01-01' as unknown as Date, MINUTE)).toThrow(
      'Invalid startsAt: must be a valid Date object.',
    );
  });

  test.each([
    ['zero', 0],
    ['negative', -1000],
    ['fractional', 1.5],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('throws when everyMs is %s', (_label, everyMs) => {
    expect(() => new Interval(EPOCH, everyMs)).toThrow(
      'Invalid everyMs: must be a positive integer number of milliseconds.',
    );
  });
});

describe('Interval immutability', () => {
  test('mutating the Date passed to the constructor does not alter the interval', () => {
    const start = new Date(EPOCH.getTime());
    const interval = new Interval(start, MINUTE);

    start.setFullYear(1990);

    expect(interval.getStartsAt()).toEqual(EPOCH);
  });

  test('mutating the Date returned by getStartsAt does not alter the interval', () => {
    const interval = new Interval(EPOCH, MINUTE);

    interval.getStartsAt().setFullYear(1990);

    expect(interval.getStartsAt()).toEqual(EPOCH);
  });

  test('getStartsAt returns a fresh object on every call', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.getStartsAt()).not.toBe(interval.getStartsAt());
  });
});

describe('Interval.occurrenceAt', () => {
  test('index 0 is the start itself', () => {
    expect(new Interval(EPOCH, MINUTE).occurrenceAt(0)).toEqual(EPOCH);
  });

  test('steps by everyMs', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.occurrenceAt(3).getTime()).toBe(EPOCH.getTime() + 3 * MINUTE);
  });

  test.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', NaN],
  ])('throws on a %s index', (_label, index) => {
    expect(() => new Interval(EPOCH, MINUTE).occurrenceAt(index)).toThrow(
      'Invalid index: must be a non-negative integer.',
    );
  });

  test('throws when the occurrence overflows the Date range', () => {
    const interval = new Interval(new Date(0), 1e12);

    expect(() => interval.occurrenceAt(10_000)).toThrow(RangeError);
  });
});

describe('Interval.nextOccurrenceAfter', () => {
  test('returns the start when the reference is before it', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.nextOccurrenceAfter(new Date(EPOCH.getTime() - 1))).toEqual(EPOCH);
  });

  test('at an occurrence exactly, returns the following one', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.nextOccurrenceAfter(EPOCH).getTime()).toBe(EPOCH.getTime() + MINUTE);
  });

  test('skips past elapsed occurrences', () => {
    const interval = new Interval(EPOCH, MINUTE);
    const reference = new Date(EPOCH.getTime() + 3 * MINUTE + 1);

    expect(interval.nextOccurrenceAfter(reference).getTime()).toBe(EPOCH.getTime() + 4 * MINUTE);
  });

  test('defaults to the current time', () => {
    const interval = new Interval(new Date(Date.now() - MINUTE), MINUTE);

    expect(interval.nextOccurrenceAfter().getTime()).toBeGreaterThan(Date.now() - 1);
  });

  test('throws when now is invalid', () => {
    expect(() => new Interval(EPOCH, MINUTE).nextOccurrenceAfter(new Date('nope'))).toThrow(
      'Invalid now: must be a valid Date object.',
    );
  });
});

describe('Interval.countBetween', () => {
  const interval = new Interval(EPOCH, MINUTE);
  const at = (minutes: number) => new Date(EPOCH.getTime() + minutes * MINUTE);

  test('counts the half-open range, including from and excluding to', () => {
    expect(interval.countBetween(at(0), at(3))).toBe(3);
  });

  test('is zero when the range is empty', () => {
    expect(interval.countBetween(at(2), at(2))).toBe(0);
  });

  test('is zero when to precedes from', () => {
    expect(interval.countBetween(at(5), at(2))).toBe(0);
  });

  test('is zero for a range entirely before the interval starts', () => {
    expect(interval.countBetween(at(-10), at(-5))).toBe(0);
  });

  test('clamps a range that begins before the interval', () => {
    expect(interval.countBetween(at(-10), at(2))).toBe(2);
  });

  test('throws on invalid bounds', () => {
    expect(() => interval.countBetween(new Date('nope'), at(1))).toThrow('Invalid from');
    expect(() => interval.countBetween(at(0), new Date('nope'))).toThrow('Invalid to');
  });
});

describe('Interval.occurrencesBetween', () => {
  const interval = new Interval(EPOCH, MINUTE);
  const at = (minutes: number) => new Date(EPOCH.getTime() + minutes * MINUTE);

  test('lists the occurrences in range', () => {
    expect(interval.occurrencesBetween(at(1), at(4))).toEqual([at(1), at(2), at(3)]);
  });

  test('returns an empty array for an empty range', () => {
    expect(interval.occurrencesBetween(at(2), at(2))).toEqual([]);
  });

  test('throws when the range exceeds the limit', () => {
    expect(() => interval.occurrencesBetween(at(0), at(10), 5)).toThrow(RangeError);
  });

  test('honours a raised limit', () => {
    expect(interval.occurrencesBetween(at(0), at(10), 10)).toHaveLength(10);
  });

  test.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 2.5],
  ])('throws on a %s limit', (_label, limit) => {
    expect(() => interval.occurrencesBetween(at(0), at(2), limit)).toThrow(
      'Invalid limit: must be a positive integer.',
    );
  });
});

describe('Interval.nextDeadline', () => {
  test('produces a Deadline for the next occurrence', () => {
    const interval = new Interval(EPOCH, MINUTE);
    const deadline = interval.nextDeadline('ping', EPOCH);

    expect(deadline).toBeInstanceOf(Deadline);
    expect(deadline.getDueDate().getTime()).toBe(EPOCH.getTime() + MINUTE);
    expect(deadline.getDescription()).toBe('ping');
  });

  test('the deadline is not overdue at the reference instant', () => {
    const interval = new Interval(EPOCH, MINUTE);

    expect(interval.nextDeadline(undefined, EPOCH).isOverdue(EPOCH)).toBe(false);
  });

  test('defaults the description to undefined', () => {
    expect(
      new Interval(EPOCH, MINUTE).nextDeadline(undefined, EPOCH).getDescription(),
    ).toBeUndefined();
  });
});
