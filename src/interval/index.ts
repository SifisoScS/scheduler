import { Deadline } from '../deadline/index.js';

/**
 * Largest absolute timestamp a Date can represent (±100,000,000 days from the
 * epoch). Arithmetic beyond this yields an Invalid Date rather than throwing,
 * so occurrences are range-checked explicitly.
 */
const MAX_TIMESTAMP = 8.64e15;

/**
 * Default ceiling on how many occurrences {@link Interval.occurrencesBetween}
 * will materialise, so a wide range cannot silently allocate an enormous array.
 */
const DEFAULT_LIMIT = 1000;

/**
 * Throws if the given value is not a usable Date.
 * @param value - The value to check.
 * @param label - Parameter name used in the error message.
 * @throws {Error} If value is not a valid Date.
 */
function assertValidDate(value: Date, label: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid ${label}: must be a valid Date object.`);
  }
}

/**
 * A fixed-period repetition: a starting instant and a gap between occurrences.
 *
 * Instances are immutable and hold no timers — occurrences are computed
 * arithmetically on demand, so nothing here fires, sleeps, or reads the clock
 * unless you pass a time in.
 *
 * Occurrence indices are zero-based: occurrence 0 is `startsAt` itself.
 */
export class Interval {
  private readonly startsAt: Date;
  private readonly everyMs: number;

  /**
   * Creates an interval.
   * @param startsAt - The first occurrence. Copied defensively.
   * @param everyMs - Milliseconds between occurrences. Must be a positive integer.
   * @throws {Error} If startsAt is not a valid Date, or everyMs is not a positive integer.
   */
  constructor(startsAt: Date, everyMs: number) {
    assertValidDate(startsAt, 'startsAt');

    if (!Number.isSafeInteger(everyMs) || everyMs <= 0) {
      throw new Error('Invalid everyMs: must be a positive integer number of milliseconds.');
    }

    this.startsAt = new Date(startsAt.getTime());
    this.everyMs = everyMs;
  }

  /**
   * Returns a copy of the first occurrence.
   */
  getStartsAt(): Date {
    return new Date(this.startsAt.getTime());
  }

  /**
   * Returns the gap between occurrences, in milliseconds.
   */
  getEveryMs(): number {
    return this.everyMs;
  }

  /**
   * Returns the occurrence at a zero-based index. Occurrence 0 is `startsAt`.
   * @param index - A non-negative integer.
   * @throws {Error} If index is not a non-negative integer.
   * @throws {RangeError} If the occurrence falls outside the range of a Date.
   */
  occurrenceAt(index: number): Date {
    if (!Number.isSafeInteger(index) || index < 0) {
      throw new Error('Invalid index: must be a non-negative integer.');
    }

    const timestamp = this.startsAt.getTime() + index * this.everyMs;

    if (!Number.isSafeInteger(timestamp) || Math.abs(timestamp) > MAX_TIMESTAMP) {
      throw new RangeError(`Occurrence ${index} falls outside the range of a Date.`);
    }

    return new Date(timestamp);
  }

  /**
   * Returns the first occurrence strictly after the given instant.
   *
   * At an occurrence exactly, the *following* one is returned — matching
   * `Deadline.isOverdue`, where the boundary instant is not yet past.
   *
   * @param now - Optional reference instant (defaults to the current time).
   * @throws {Error} If now is not a valid Date.
   * @throws {RangeError} If the occurrence falls outside the range of a Date.
   */
  nextOccurrenceAfter(now: Date = new Date()): Date {
    assertValidDate(now, 'now');

    const start = this.startsAt.getTime();
    const reference = now.getTime();

    if (reference < start) {
      return new Date(start);
    }

    return this.occurrenceAt(Math.floor((reference - start) / this.everyMs) + 1);
  }

  /**
   * Counts occurrences in the half-open range `[from, to)` — `from` included,
   * `to` excluded. Returns 0 when the range is empty or entirely before the
   * interval starts.
   *
   * @throws {Error} If either bound is not a valid Date.
   */
  countBetween(from: Date, to: Date): number {
    assertValidDate(from, 'from');
    assertValidDate(to, 'to');

    const start = this.startsAt.getTime();
    const upper = to.getTime();

    if (upper <= from.getTime() || upper <= start) {
      return 0;
    }

    const firstIndex = Math.max(0, Math.ceil((from.getTime() - start) / this.everyMs));
    const countUpToUpper = Math.ceil((upper - start) / this.everyMs);

    return Math.max(0, countUpToUpper - firstIndex);
  }

  /**
   * Lists occurrences in the half-open range `[from, to)`.
   *
   * @param from - Start of the range, included.
   * @param to - End of the range, excluded.
   * @param limit - Maximum number of occurrences to materialise.
   * @throws {Error} If either bound is not a valid Date, or limit is not a positive integer.
   * @throws {RangeError} If the range contains more than `limit` occurrences.
   */
  occurrencesBetween(from: Date, to: Date, limit: number = DEFAULT_LIMIT): Date[] {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      throw new Error('Invalid limit: must be a positive integer.');
    }

    const count = this.countBetween(from, to);

    if (count > limit) {
      throw new RangeError(
        `Range contains ${count} occurrences, above the limit of ${limit}. ` +
          'Narrow the range or raise the limit deliberately.',
      );
    }

    const start = this.startsAt.getTime();
    const firstIndex = Math.max(0, Math.ceil((from.getTime() - start) / this.everyMs));

    return Array.from({ length: count }, (_unused, offset) =>
      this.occurrenceAt(firstIndex + offset),
    );
  }

  /**
   * Returns the next occurrence as a {@link Deadline}, so an interval can feed
   * straight into overdue checks.
   *
   * @param description - Optional description for the deadline.
   * @param now - Optional reference instant (defaults to the current time).
   * @throws {Error} If now is not a valid Date.
   */
  nextDeadline(description?: string, now?: Date): Deadline {
    return new Deadline(this.nextOccurrenceAfter(now), description);
  }
}
