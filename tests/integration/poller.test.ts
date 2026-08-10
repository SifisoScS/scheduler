import { Deadline, Interval } from '../../src/index';

/**
 * Integration exercise, not a unit test.
 *
 * Drives a realistic scheduling loop against the primitives: a poller that runs
 * every 5 minutes, survives a restart after downtime, and has to decide how
 * long to sleep. The clock is injected throughout, so nothing here depends on
 * wall time.
 *
 * This file is where the API gets judged in use. Four rough edges surfaced the
 * first time it was written — no comparison, no delay helper, no serialisation
 * contract, and internals leaking through JSON — and the assertions below now
 * pin the fixes.
 */

const MINUTE = 60_000;
const START = new Date('2026-03-01T09:00:00.000Z');

/** A named schedule, which is what a real caller actually has. */
interface Job {
  name: string;
  interval: Interval;
}

describe('poller: steady-state ticking', () => {
  test('advances one occurrence at a time from an injected clock', () => {
    const poll = new Interval(START, 5 * MINUTE);
    const fired: string[] = [];

    let clock = START;
    for (let tick = 0; tick < 4; tick += 1) {
      const due = poll.nextOccurrenceAfter(clock);
      clock = due;
      fired.push(due.toISOString());
    }

    expect(fired).toEqual([
      '2026-03-01T09:05:00.000Z',
      '2026-03-01T09:10:00.000Z',
      '2026-03-01T09:15:00.000Z',
      '2026-03-01T09:20:00.000Z',
    ]);
  });

  test('a deadline built from the next occurrence is not overdue at that instant', () => {
    const poll = new Interval(START, 5 * MINUTE);
    const next = poll.nextDeadline('poll upstream', START);

    // The boundary semantics of the two modules line up: arriving exactly on
    // time is not late.
    expect(next.isOverdue(next.getDueDate())).toBe(false);
    expect(next.isOverdue(new Date(next.getDueDate().getTime() + 1))).toBe(true);
  });
});

describe('poller: catching up after downtime', () => {
  test('recovers every missed occurrence in order', () => {
    const poll = new Interval(START, 5 * MINUTE);

    const wentDown = new Date(START.getTime() + 5 * MINUTE);
    const cameBack = new Date(START.getTime() + 27 * MINUTE);

    // occurrencesBetween is exactly the right shape for this: half-open, so
    // resuming from the last handled occurrence does not re-run it.
    const missed = poll.occurrencesBetween(new Date(wentDown.getTime() + 1), cameBack);

    expect(missed.map((d) => d.toISOString())).toEqual([
      '2026-03-01T09:10:00.000Z',
      '2026-03-01T09:15:00.000Z',
      '2026-03-01T09:20:00.000Z',
      '2026-03-01T09:25:00.000Z',
    ]);
  });

  test('a long outage is reported rather than silently allocating', () => {
    const poll = new Interval(START, MINUTE);
    const cameBack = new Date(START.getTime() + 5000 * MINUTE);

    // countBetween lets a caller decide before materialising anything.
    expect(poll.countBetween(START, cameBack)).toBe(5000);
    expect(() => poll.occurrencesBetween(START, cameBack)).toThrow(RangeError);
  });
});

describe('poller: several jobs on one loop', () => {
  const jobs: Job[] = [
    { name: 'poll upstream', interval: new Interval(START, 5 * MINUTE) },
    { name: 'flush metrics', interval: new Interval(START, 2 * MINUTE) },
    { name: 'rotate logs', interval: new Interval(START, 60 * MINUTE) },
  ];

  const dueNow = (now: Date): Deadline[] =>
    jobs.map((job) => job.interval.nextDeadline(job.name, now));

  test('ordering by due time is a one-liner with Deadline.compare', () => {
    const order = dueNow(START)
      .sort(Deadline.compare)
      .map((d) => d.getDescription());

    expect(order).toEqual(['flush metrics', 'poll upstream', 'rotate logs']);
  });

  test('the soonest job falls out of the same comparator', () => {
    const [soonest] = dueNow(START).sort(Deadline.compare);

    expect(soonest?.getDescription()).toBe('flush metrics');
    expect(soonest?.getDueDate().toISOString()).toBe('2026-03-01T09:02:00.000Z');
  });
});

describe('poller: deciding how long to sleep', () => {
  test('msUntil gives the delay directly', () => {
    const poll = new Interval(START, 5 * MINUTE);
    const now = new Date(START.getTime() + 90_000);

    expect(poll.nextDeadline('poll upstream', now).msUntil(now)).toBe(3 * MINUTE + 30_000);
  });

  test('an overdue deadline reports a negative delay, which a loop clamps', () => {
    const overdue = new Deadline(new Date(START.getTime() - 1000));

    expect(overdue.msUntil(START)).toBe(-1000);
    expect(Math.max(0, overdue.msUntil(START))).toBe(0);
  });
});

describe('poller: surviving a process restart', () => {
  test('scheduler state round-trips through JSON without hand-rolled mapping', () => {
    const jobs = {
      'poll upstream': new Interval(START, 5 * MINUTE),
      'rotate logs': new Interval(START, 60 * MINUTE),
    };

    const persisted = JSON.stringify(jobs);
    const parsed = JSON.parse(persisted) as Record<string, unknown>;

    const restored = Object.fromEntries(
      Object.entries(parsed).map(([name, value]) => [name, Interval.fromJSON(value)]),
    );

    expect(restored['poll upstream']?.getEveryMs()).toBe(5 * MINUTE);
    expect(restored['rotate logs']?.getStartsAt()).toEqual(START);
  });

  test('the internal representation no longer leaks', () => {
    const poll = new Interval(START, 5 * MINUTE);
    const deadline = poll.nextDeadline('poll upstream', START);

    // ECMAScript private fields are genuinely inaccessible, so the only
    // serialised form is the documented one.
    expect(Object.keys(poll)).toEqual([]);
    expect(Object.keys(deadline)).toEqual([]);
    expect(JSON.stringify(poll)).toBe('{"startsAt":"2026-03-01T09:00:00.000Z","everyMs":300000}');
  });

  test('corrupt persisted state is rejected at the boundary, not later', () => {
    expect(() => Interval.fromJSON({ startsAt: 'garbage', everyMs: 1000 })).toThrow(
      'Invalid Interval JSON: startsAt is not a valid ISO date string.',
    );
    expect(() => Deadline.fromJSON({ dueDate: null })).toThrow(
      'Invalid Deadline JSON: dueDate must be an ISO date string.',
    );
  });
});
