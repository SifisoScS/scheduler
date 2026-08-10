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
 */
export class Deadline {
  private readonly dueDate: Date;
  private readonly description?: string;

  /**
   * Creates a new Deadline.
   * @param dueDate - The date by which the task must be completed. Copied defensively.
   * @param description - Optional description of the deadline.
   * @throws {Error} If dueDate is not a valid Date.
   */
  constructor(dueDate: Date, description?: string) {
    assertValidDate(dueDate, 'dueDate');
    this.dueDate = new Date(dueDate.getTime());
    this.description = description;
  }

  /**
   * Returns a copy of the due date.
   */
  getDueDate(): Date {
    return new Date(this.dueDate.getTime());
  }

  /**
   * Returns the description, if any.
   */
  getDescription(): string | undefined {
    return this.description;
  }

  /**
   * Checks if the deadline has passed.
   * @param now - Optional current date (defaults to new Date()).
   * @returns true if the deadline is strictly in the past.
   * @throws {Error} If now is not a valid Date.
   */
  isOverdue(now: Date = new Date()): boolean {
    assertValidDate(now, 'now');
    return this.dueDate.getTime() < now.getTime();
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
