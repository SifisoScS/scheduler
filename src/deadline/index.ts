/**
 * The serialised form of a {@link Deadline}.
 *
 * This shape is a deliberate contract, not an accident of the field names —
 * it is what {@link Deadline.toJSON} emits and {@link Deadline.fromJSON}
 * accepts, and it is covered by semantic versioning.
 */
export interface DeadlineJSON {
  /** The due date, as an ISO 8601 string. */
  dueDate: string;
  /** The description, omitted entirely when there is none. */
  description?: string;
}

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
 * Represents a deadline with a due date and optional description.
 *
 * Instances are immutable: dates are copied on the way in and on the way out,
 * so a caller can never mutate a Deadline through a reference it holds.
 *
 * Fields are ECMAScript private (`#`), not TypeScript `private`. The latter is
 * erased at compile time, leaving ordinary enumerable properties that leak the
 * internal representation into `JSON.stringify` and `Object.keys`. These are
 * genuinely inaccessible, so {@link toJSON} is the only serialised form.
 */
export class Deadline {
  readonly #dueDate: Date;
  readonly #description?: string;

  /**
   * Creates a new Deadline.
   * @param dueDate - The date by which the task must be completed. Copied defensively.
   * @param description - Optional description of the deadline.
   * @throws {Error} If dueDate is not a valid Date.
   */
  constructor(dueDate: Date, description?: string) {
    assertValidDate(dueDate, 'dueDate');
    this.#dueDate = new Date(dueDate.getTime());
    this.#description = description;
  }

  /**
   * Returns a copy of the due date.
   */
  getDueDate(): Date {
    return new Date(this.#dueDate.getTime());
  }

  /**
   * Returns the description, if any.
   */
  getDescription(): string | undefined {
    return this.#description;
  }

  /**
   * Checks if the deadline has passed.
   * @param now - Optional current date (defaults to new Date()).
   * @returns true if the deadline is strictly in the past.
   * @throws {Error} If now is not a valid Date.
   */
  isOverdue(now: Date = new Date()): boolean {
    assertValidDate(now, 'now');
    return this.#dueDate.getTime() < now.getTime();
  }

  /**
   * Milliseconds from `now` until the deadline falls due.
   *
   * Negative once overdue, by exactly how long. Clamp with `Math.max(0, …)`
   * when using this as a sleep delay.
   *
   * @param now - Optional current date (defaults to new Date()).
   * @throws {Error} If now is not a valid Date.
   */
  msUntil(now: Date = new Date()): number {
    assertValidDate(now, 'now');
    return this.#dueDate.getTime() - now.getTime();
  }

  /**
   * Returns the serialised form. Called automatically by `JSON.stringify`.
   */
  toJSON(): DeadlineJSON {
    return this.#description === undefined
      ? { dueDate: this.#dueDate.toISOString() }
      : { dueDate: this.#dueDate.toISOString(), description: this.#description };
  }

  /**
   * Rebuilds a Deadline from {@link toJSON} output.
   *
   * Validates the input rather than trusting it — this is a parsing boundary,
   * and the value has usually come from storage or the network.
   *
   * @param value - A parsed JSON value.
   * @throws {Error} If the value is not a valid serialised Deadline.
   */
  static fromJSON(value: unknown): Deadline {
    if (typeof value !== 'object' || value === null) {
      throw new Error('Invalid Deadline JSON: expected an object.');
    }

    const { dueDate, description } = value as Partial<DeadlineJSON>;

    if (typeof dueDate !== 'string') {
      throw new Error('Invalid Deadline JSON: dueDate must be an ISO date string.');
    }

    const parsed = new Date(dueDate);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid Deadline JSON: dueDate is not a valid ISO date string.');
    }

    if (description !== undefined && typeof description !== 'string') {
      throw new Error('Invalid Deadline JSON: description must be a string when present.');
    }

    return new Deadline(parsed, description);
  }

  /**
   * Compares two deadlines by due date, earliest first.
   *
   * Usable directly as an `Array.prototype.sort` comparator, which is the
   * common case — picking the soonest of several scheduled things.
   *
   * @returns A negative number when `a` is due first, positive when `b` is,
   *          and 0 when they fall due at the same instant.
   */
  static compare(this: void, a: Deadline, b: Deadline): number {
    return a.#dueDate.getTime() - b.#dueDate.getTime();
  }
}

/**
 * Validate that the given input is defined and not null.
 * @param input - Any value to check.
 * @returns true when input is not undefined or null.
 */
export function validate(input: unknown): boolean {
  return input !== undefined && input !== null;
}
