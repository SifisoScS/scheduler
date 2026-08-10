# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `deadline` module — an immutable `Deadline` value object and a `validate`
  defined-ness check, available from the package root or the `./deadline`
  subpath. Carried over unchanged from `scheduler-deadline`.
- Dual ESM and CommonJS builds with per-module subpath exports and type
  definitions for each format.
