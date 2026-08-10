# @sifiso-guy/scheduler

[![CI](https://github.com/SifisoScS/scheduler/actions/workflows/ci.yml/badge.svg)](https://github.com/SifisoScS/scheduler/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

Building blocks for task scheduling: small, immutable, dependency-free
primitives that model time correctly.

> **Status: 0.x.** Two modules ship today. The API may change before 1.0.

## Why this exists

Scheduling bugs are rarely arithmetic bugs. They come from mutable dates
changing under you, invalid dates comparing `false` against everything, and
boundary conditions nobody wrote down. These primitives close those holes so the
scheduler built on top of them does not have to.

Every module here is a **value object**: no timers, no I/O, no ambient clock
reads unless you ask.

## Installation

```bash
npm install @sifiso-guy/scheduler
```

Node.js 20+. Ships ESM and CommonJS with type definitions for each, and has
**zero runtime dependencies**.

## Usage

Import from the root, or from a module directly — both give you the same
bindings, and the subpath lets a bundler drop everything else:

```typescript
import { Deadline, Interval } from '@sifiso-guy/scheduler';
// or
import { Deadline } from '@sifiso-guy/scheduler/deadline';
import { Interval } from '@sifiso-guy/scheduler/interval';
```

```typescript
const deadline = new Deadline(new Date('2026-12-31'), 'Finish project');

deadline.getDueDate(); // 2026-12-31T00:00:00.000Z — a copy
deadline.getDescription(); // 'Finish project'
deadline.isOverdue(); // false
deadline.isOverdue(new Date('2027-01-01')); // true
```

## Modules

### `deadline`

A due date with an optional description, and one question answered precisely:
has it passed?

- **Validated on construction** — an invalid `Date` throws, rather than
  producing an object whose every comparison silently returns `false`
- **Immutable** — the date is copied in and out, so nobody can move a deadline
  through a reference they hold
- **Defined boundary** — at the exact due instant it is _not_ overdue; one
  millisecond later it is
- **Injectable clock** — `isOverdue(now?)` takes time as an argument, so
  scheduling logic is testable without freezing timers

```typescript
const due = new Date('2030-01-01');
const deadline = new Deadline(due);

due.setFullYear(1990); // does not affect the deadline
deadline.getDueDate().setFullYear(1990); // nor does this

deadline.isOverdue(); // still false
```

#### API

| Member                                  | Behaviour                                                   |
| --------------------------------------- | ----------------------------------------------------------- |
| `new Deadline(dueDate, description?)`   | Throws if `dueDate` is not a valid `Date`. Copies it.       |
| `getDueDate(): Date`                    | Returns a **copy**. Mutating it does nothing.               |
| `getDescription(): string \| undefined` | `undefined` if omitted; `''` is preserved as `''`.          |
| `isOverdue(now?): boolean`              | `true` only when strictly past. Throws on an invalid `now`. |
| `msUntil(now?): number`                 | Milliseconds until due; negative once overdue.              |
| `toJSON(): DeadlineJSON`                | The documented serialised form.                             |
| `Deadline.fromJSON(value)`              | Rebuilds one, validating the input.                         |
| `Deadline.compare(a, b)`                | Sort comparator, earliest first.                            |
| `validate(input): boolean`              | Defined-ness check — `0`, `''` and `false` are all `true`.  |

### `interval`

A fixed-period repetition: a starting instant and a gap between occurrences.
Holds no timers — occurrences are computed arithmetically on demand.

```typescript
const every5min = new Interval(new Date('2026-01-01T00:00:00Z'), 5 * 60_000);

every5min.occurrenceAt(0); // the start itself — indices are zero-based
every5min.nextOccurrenceAfter(now); // first occurrence strictly after now
every5min.countBetween(from, to); // half-open [from, to)
every5min.occurrencesBetween(from, to); // the same range, materialised
```

`everyMs` must be a positive integer, and occurrences that would fall outside
the range of a `Date` throw a `RangeError` rather than yielding an Invalid Date.

`occurrencesBetween` caps at 1000 results by default and throws if the range
holds more, so a wide window cannot quietly allocate an enormous array. Raise
the limit deliberately with the third argument.

**Persistence.** Both modules serialise to a documented shape and validate on
the way back in, so scheduler state survives a restart:

```typescript
const persisted = JSON.stringify(every5min);
const restored = Interval.fromJSON(JSON.parse(persisted));
```

Fields are ECMAScript `#private`, so the internal representation cannot leak
through `JSON.stringify` or `Object.keys` — `toJSON` is the only serialised
form, and it is covered by semantic versioning.

**Ordering.** `Deadline.compare` is a ready-made sort comparator, which is what
picking the soonest of several schedules actually needs:

```typescript
const next = jobs.map((j) => j.interval.nextDeadline(j.name, now)).sort(Deadline.compare)[0];
const delayMs = Math.max(0, next.msUntil(now));
```

**Composing with `deadline`** — this is why the modules share a package:

```typescript
const deadline = every5min.nextDeadline('poll upstream');
deadline.isOverdue(); // false, until the next occurrence passes
```

#### API

| Member                                         | Behaviour                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| `new Interval(startsAt, everyMs)`              | Throws unless `startsAt` is valid and `everyMs` a positive integer. |
| `getStartsAt(): Date`                          | Returns a **copy**.                                                 |
| `getEveryMs(): number`                         | The gap, in milliseconds.                                           |
| `occurrenceAt(index): Date`                    | Zero-based. `RangeError` if it overflows `Date`.                    |
| `nextOccurrenceAfter(now?): Date`              | Strictly after `now`; at an occurrence exactly, returns the next.   |
| `countBetween(from, to): number`               | Half-open `[from, to)`.                                             |
| `occurrencesBetween(from, to, limit?): Date[]` | Same range, materialised. Throws above `limit` (default 1000).      |
| `nextDeadline(description?, now?): Deadline`   | The next occurrence, as a `Deadline`.                               |

## Adding a module

1. Create `src/<name>/index.ts`.
2. Re-export it from `src/index.ts`, **with an explicit `.js` extension** — the
   ESM build needs it at runtime, and omitting it produces a bundle that fails
   to load. Jest maps the extension away via `moduleNameMapper`.
3. Add a `./<name>` entry to `exports` in `package.json`, with `import` and
   `require` conditions pointing at `dist/esm` and `dist/cjs`.
4. Add `tests/<name>.test.ts`, and update the surface test in
   `tests/index.test.ts` — it asserts the root barrel's exports exactly, so it
   will fail until you do.
5. Extend the subpath verification step in `.github/workflows/ci.yml`.

## Relationship to `scheduler-deadline`

[`scheduler-deadline`](https://www.npmjs.com/package/scheduler-deadline) ships
the same `Deadline` as a standalone package and remains published. This package
is where further modules land, so that a scheduler built from several primitives
is one dependency and one version rather than six.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through
[SECURITY.md](SECURITY.md), not the issue tracker.

## License

MIT © Sifiso Cyprian Shezi
