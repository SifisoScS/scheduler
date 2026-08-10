# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `deadline` module — an immutable `Deadline` value object and a `validate`
  defined-ness check, available from the package root or the `./deadline`
  subpath. Carried over unchanged from `scheduler-deadline`.
- `interval` module — an immutable `Interval` value object modelling a fixed
  period, with occurrence lookup by index, next-occurrence and range queries,
  and `nextDeadline()` to hand the next occurrence to the `deadline` module.
- `toJSON()` and `fromJSON()` on both modules — a documented serialisation
  contract, validated on the way in, so scheduler state survives a restart.
- `Deadline.compare(a, b)` — a sort comparator, and `Deadline.msUntil(now?)`
  for the delay a scheduling loop needs.
- An integration exercise (`tests/integration/`) that drives a realistic poller
  against the primitives. It is where the four gaps above were found.
- Dual ESM and CommonJS builds with per-module subpath exports and type
  definitions for each format.

### Changed

- Fields are now ECMAScript `#private` rather than TypeScript `private`, which
  is erased at compile time. The internal representation previously leaked
  through `JSON.stringify` and `Object.keys`, making field names part of the
  observable surface by accident.
- Compilation target raised to ES2022 so private fields emit natively.
