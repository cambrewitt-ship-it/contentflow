#!/bin/zsh
# Run by launchd (com.oneonethree.autopublish) shortly after the nightly
# oneonethree-content routine drafts new content. Pulls the vault's latest
# commit, publishes any not-yet-published product-social drafts to
# ContentFlow's calendar, and pushes the updated ledger back if it changed.
set -uo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

VAULT_DIR="/Users/cambrewitt/oneonethree-content"
SCRIPT_DIR="/Users/cambrewitt/Desktop/web-apps/contentflow-v2/scripts/oneonethree-autopost"
LOG_FILE="/Users/cambrewitt/Library/Logs/oneonethree-autopublish.log"

{
  echo "===== $(date) ====="

  cd "$VAULT_DIR" || exit 1
  git pull origin main || echo "[warn] git pull failed"

  cd "$SCRIPT_DIR" || exit 1
  npm run publish || echo "[warn] publish run failed (see above)"

  cd "$VAULT_DIR" || exit 1
  if ! git diff --quiet -- runs/published-ledger.json 2>/dev/null; then
    git add runs/published-ledger.json
    git commit -m "runs: update published-ledger from auto-publish

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
    git push origin main || echo "[warn] ledger push failed"
  else
    echo "[info] ledger unchanged, nothing to commit"
  fi

  echo "===== done $(date) ====="
  echo ""
} >> "$LOG_FILE" 2>&1
