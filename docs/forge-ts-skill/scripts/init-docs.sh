#!/usr/bin/env bash
# Scaffold a documentation site for the target SSG
set -euo pipefail

TARGET="${1:-mintlify}"
npx forge-ts docs init --target "$TARGET" --json
