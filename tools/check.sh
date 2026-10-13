#!/usr/bin/env bash
# Run before every commit (and in CI): syntax-checks every card and blocks anything that looks like a secret.
# This repo is PUBLIC — nothing that grants access to the house belongs here.
set -euo pipefail
cd "$(dirname "$0")/.."
fail=0

echo "== syntax"
for f in src/*.js loader/*.js retired/*.js tools/*.mjs; do
  node --check "$f" || { echo "  syntax error: $f"; fail=1; }
done
python3 -m py_compile scripts/*.py || fail=1

echo "== secrets"
# HA long-lived tokens are JWTs (eyJ...); also GitHub/AWS/OpenAI-style keys, private keys, credentialed URLs.
pattern='eyJ[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|https?://[^/[:space:]]+:[^@[:space:]]+@'
if grep -rnIE "$pattern" --exclude-dir=.git --exclude-dir=node_modules . ; then
  echo "  ^ possible secret"; fail=1
fi
# Things that are not secrets but should never be published: home-network addresses and HA remote URLs.
if grep -rnIE '\b(10|127|192\.168|172\.(1[6-9]|2[0-9]|3[01]))(\.[0-9]{1,3}){2,3}\b|ui\.nabu\.casa|duckdns\.org|webhook_id' \
     --exclude-dir=.git --exclude-dir=node_modules --exclude=check.sh . ; then
  echo "  ^ LAN address / remote URL / webhook id — keep these in Home Assistant, not here"; fail=1
fi
if git rev-parse --git-dir >/dev/null 2>&1 && git ls-files --error-unmatch secrets.yaml >/dev/null 2>&1; then
  echo "  secrets.yaml is tracked"; fail=1
fi

[ "$fail" -eq 0 ] && echo "OK" || { echo "FAILED"; exit 1; }
