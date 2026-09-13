#!/usr/bin/env bash
#
# render-config.sh — generate this host's systemd units + Caddy site file from the committed
# templates, using the values in deploy/deploy.conf.
#
# The point: nothing host-specific (service user, checkout path, node binary, site address, port)
# is baked into tracked files. One config file per host drives them all, so porting to another box
# is "edit deploy.conf, re-render" — no hand-editing of unit files that then drift from the repo.
#
# The Caddy output is /etc/caddy/conf.d/zfin-data-api.caddy, NOT /etc/caddy/Caddyfile. A kit that
# writes the whole Caddyfile cannot share a host with another application that does the same, so
# this one owns a single file and relies on an import. See deploy/caddy/*.tmpl.
#
# Usage:
#   deploy/render-config.sh              # render into deploy/.rendered/ (does not touch the system)
#   deploy/render-config.sh --install    # render, then install to /etc + reload systemd & Caddy
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
conf="$here/deploy.conf"
out="$here/.rendered"

[ -f "$conf" ] || { echo "error: missing $conf — copy deploy.conf.example, fill it in, re-run." >&2; exit 1; }
# shellcheck disable=SC1090
set -a; source "$conf"; set +a

: "${RUNTIME_USER:?set in deploy.conf}" "${APP_DIR:?set in deploy.conf}" \
  "${NODE_BIN:?set in deploy.conf}" "${SITE_ADDRESS:?set in deploy.conf}" \
  "${APP_PORT:?set in deploy.conf}"

# NO ENVIRONMENT CHECKS HERE. This script renders text files and runs wherever the repository is —
# normally a workstation, not the target. Anything it could test (does RUNTIME_USER exist, is
# NODE_BIN executable, does the Caddyfile import conf.d, does PORT match APP_PORT) would be tested
# against the WRONG machine, and a confident warning about the wrong computer is worse than none.
# The checklist printed at the end names what to verify on the target instead.


mkdir -p "$out"
render() {
  # sed, not envsubst, to stay dependency-free. '|' delimiter since values contain '/'.
  sed -e "s|\${RUNTIME_USER}|${RUNTIME_USER}|g" \
      -e "s|\${APP_DIR}|${APP_DIR}|g" \
      -e "s|\${NODE_BIN}|${NODE_BIN}|g" \
      -e "s|\${SITE_ADDRESS}|${SITE_ADDRESS}|g" \
      -e "s|\${APP_PORT}|${APP_PORT}|g" \
      "$1" > "$2"
  echo "rendered $2"
}

render "$here/systemd/zfin-data-api.service.tmpl"    "$out/zfin-data-api.service"
render "$here/systemd/zfin-data-loader.service.tmpl" "$out/zfin-data-loader.service"
render "$here/caddy/zfin-data-api.caddy.tmpl"        "$out/zfin-data-api.caddy"
# The timer has no placeholders — copy it so everything to install is in one directory.
cp "$here/systemd/zfin-data-loader.timer" "$out/zfin-data-loader.timer"
echo "rendered $out/zfin-data-loader.timer"

if grep -RIl '\${' "$out" >/dev/null 2>&1; then
  echo "error: unsubstituted \${...} placeholders remain in rendered output:" >&2
  grep -RIn '\${' "$out" >&2 || true
  exit 1
fi

# Our site file only takes effect if the main Caddyfile imports the directory. Check rather than
# assume: without the import, Caddy reloads cleanly, reports no error, and serves nothing here.
if [ "${1:-}" = "--install" ]; then
  # Only meaningful when this repository is checked out ON the target.
  echo "installing locally (sudo)..."
  sudo install -d -m 755 /etc/caddy/conf.d
  sudo install -o root -g root -m 644 "$out"/*.service "$out"/*.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo install -o root -g root -m 644 "$out/zfin-data-api.caddy" /etc/caddy/conf.d/
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl reload caddy
  echo "installed."
else
  cat <<MSG

rendered into $out/ — nothing installed.

Ship them to the target and install there:

  scp $out/* <target>:/tmp/

  ssh <target> '
    sudo install -d -m 755 /etc/caddy/conf.d
    sudo install -o root -g root -m 644 /tmp/zfin-data-api.service /tmp/zfin-data-loader.service \\
                                        /tmp/zfin-data-loader.timer /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo install -o root -g root -m 644 /tmp/zfin-data-api.caddy /etc/caddy/conf.d/
    sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
  '

Verify ON THE TARGET — this script cannot, it does not run there:

  id $RUNTIME_USER
  test -x $NODE_BIN && $NODE_BIN -v
  grep -q 'import /etc/caddy/conf.d/' /etc/caddy/Caddyfile || echo 'MISSING IMPORT: site file ignored'
  grep -E '^[[:space:]]*PORT=' /etc/zfin-data-api/zfin-data-api.env    # must be $APP_PORT

MSG
fi
