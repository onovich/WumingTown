# WM-0103 Plan

## Goal

Create controlled external test instructions for the M6-reviewed unsigned
Windows unpacked directory build without starting release, signing, installer,
store or telemetry work.

## Inputs

- `coordination/reports/WM-0090.md`
- `coordination/reports/WM-0091.md`
- `coordination/reports/WM-0092.md`
- `coordination/reports/WM-0093.md`
- `coordination/reports/WM-0094.md`
- `coordination/reports/WM-0097.md`
- `docs/05_tech/01_technical_architecture.md`
- `docs/05_tech/04_persistence_mods_security.md`
- `docs/05_tech/05_testing_observability_ci.md`
- `docs/05_tech/06_platform_matrix.md`

## Work

1. Add `docs/05_tech/09_m7_windows_controlled_external_test.md`.
2. Add a narrow platform-matrix note pointing to the M7 instructions.
3. Write WM-0103 report.
4. Run required checks and complete to independent reviewer.

## Non-Goals

- No code signing, installer, updater, Steam/store package or public release.
- No telemetry, account, crash upload, paid service or public feedback system.
- No broad host bridge, arbitrary IPC or weakened Electron security boundary.
- No public save compatibility commitment.
- No M8 work.
