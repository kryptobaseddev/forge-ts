#!/usr/bin/env bash
# Run TSDoc coverage check with full MVI suggestions
npx forge-ts check --json --mvi full "$@"
