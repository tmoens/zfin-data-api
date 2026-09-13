#!/usr/bin/env bash
#
# pack-release.sh — build a deployable artifact. RUNS ON A BUILD MACHINE, never on the target.
#
# That separation is the point. `npm ci` executes package lifecycle scripts, so wherever it runs,
# arbitrary code from the registry runs as the invoking user. Doing it here means that user is you
# on a workstation, not a sudo-capable account on a production host. It also means the target needs
# no git, no npm and no compiler — only a Node runtime.
#
# The artifact holds dist/, a PRODUCTION-ONLY node_modules/, the package files, and a RELEASE file
# recording what it was built from. TypeORM is a production dependency, so its CLI comes along and
# migrations can be run on the target from the artifact alone.
#
# Usage:
#   deploy/pack-release.sh                 # -> dist-releases/<name>.tgz
#   deploy/pack-release.sh --allow-dirty   # build from a working tree with uncommitted changes
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$here/dist-releases"
allow_dirty=false
[ "${1:-}" = "--allow-dirty" ] && allow_dirty=true

cd "$here"

# --- what are we building? ---------------------------------------------------
sha="$(git rev-parse --short HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  if [ "$allow_dirty" = true ]; then
    echo "warning: building from a DIRTY working tree — the artifact will not match $sha." >&2
    sha="${sha}-dirty"
  else
    echo "error: working tree has uncommitted changes. Commit them, or pass --allow-dirty." >&2
    git status --short >&2
    exit 1
  fi
fi

# UTC, and sortable, so `ls releases/` on the target reads in deploy order regardless of where the
# build happened.
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="zfin-data-api-${stamp}-${sha}"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

echo "==> building $name (branch $branch)"

# --- build with the full toolchain ------------------------------------------
npm ci
npm run build

# --- assemble a production-only tree ----------------------------------------
# A second, clean install rather than pruning the existing one: `npm prune --omit=dev` leaves
# whatever a previous install left behind, while `npm ci` in an empty directory is reproducible from
# the lockfile alone.
echo "==> assembling production tree"
mkdir -p "$staging/$name"
cp -r dist "$staging/$name/dist"
cp package.json package-lock.json "$staging/$name/"
( cd "$staging/$name" && npm ci --omit=dev --no-audit --no-fund )

# --- portability check -------------------------------------------------------
# A compiled module is built against this machine's architecture and libc. The whole approach
# assumes the artifact is portable, so say so loudly the day that stops being true.
native="$(find "$staging/$name/node_modules" -name '*.node' -print -quit 2>/dev/null || true)"
if [ -n "$native" ]; then
  cat >&2 <<MSG

  WARNING: this artifact contains a compiled native module:
      ${native#"$staging/$name/"}
  It will only run on a target with the same architecture and a compatible libc. Build on a machine
  matching the target, or move that dependency to a pure-JavaScript alternative.

MSG
fi

# --- record what this is -----------------------------------------------------
cat > "$staging/$name/RELEASE" <<META
name=$name
commit=$sha
branch=$branch
built_at=$stamp
built_by=$(id -un)@$(hostname -f 2>/dev/null || hostname)
node=$(node -v)
npm=$(npm -v)
META

mkdir -p "$out"
tar -czf "$out/$name.tgz" -C "$staging" "$name"

echo
echo "==> $out/$name.tgz  ($(du -h "$out/$name.tgz" | cut -f1))"
echo
sed 's/^/    /' "$staging/$name/RELEASE"
echo
echo "    Ship it:"
echo "      scp $out/$name.tgz <target>:/tmp/"
echo "      ssh <target> 'sudo zfin-data-api-deploy /tmp/$name.tgz'"
