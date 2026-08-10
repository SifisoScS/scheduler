# @sifiso-guy/scheduler

[![CI](https://github.com/SifisoScS/scheduler/actions/workflows/ci.yml/badge.svg)](https://github.com/SifisoScS/scheduler/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

Building blocks for task scheduling: small, immutable, dependency-free
primitives that model time correctly.

> **Status: 0.x.** One module ships today. The API may change before 1.0.

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
import { Deadline } from '@sifiso-guy/scheduler';
// or
import { Deadline } from '@sifiso-guy/scheduler/deadline';
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
| `validate(input): boolean`              | Defined-ness check — `0`, `''` and `false` are all `true`.  |

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
