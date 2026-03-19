#!/usr/bin/env bash
# forge-ts TSDoc coverage check with agent-friendly output
# Returns LAFS JSON envelope with exact fix suggestions at --mvi full
set -euo pipefail

npx forge-ts check --json --mvi "${MVI_LEVEL:-full}" "$@"
