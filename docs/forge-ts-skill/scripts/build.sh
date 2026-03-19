#!/usr/bin/env bash
# Generate all forge-ts documentation artifacts
set -euo pipefail

npx forge-ts build --json "$@"
