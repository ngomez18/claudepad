#!/usr/bin/env bash
set -euo pipefail

# Updates the Homebrew cask formula with the new version and SHA256.
# Expects the tap to be checked out at homebrew-tap/ relative to the repo root.
#
# Required env vars:
#   VERSION  — full tag, e.g. v0.0.3
#   SHA256   — SHA256 hash of the DMG

BARE_VERSION="${VERSION#v}"   # strip leading 'v' → 0.0.3

sed -i '' \
  "s/version \"[^\"]*\"/version \"${BARE_VERSION}\"/" \
  homebrew-tap/Casks/claudepad.rb

sed -i '' \
  "s/sha256 \"[^\"]*\"/sha256 \"${SHA256}\"/" \
  homebrew-tap/Casks/claudepad.rb
