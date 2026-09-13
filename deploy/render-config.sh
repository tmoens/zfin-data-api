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

[ -x "$NODE_BIN" ] || echo "warning: NODE_BIN ($NODE_BIN) is not executable on this host." >&2
id "$RUNTIME_USER" >/dev/null 2>&1 || echo "warning: RUNTIME_USER ($RUNTIME_USER) does not exist yet — the units will fail to start until it does." >&2
# A release has to be installed before the units can start, and the runtime account has to be able
# to read it. Both are easy to get wrong and neither shows up until the service fails to start.
if [ -d "$APP_DIR" ] && [ -e "$APP_DIR/current" ] \
   && ! sudo -u "$RUNTIME_USER" test -r "$APP_DIR/current/dist/main.js" 2>/dev/null; then
  echo "warning: $RUNTIME_USER cannot read $APP_DIR/current/dist/main.js — check the mode on $APP_DIR (expected 755, world-readable)." >&2
fi

# The port the unit serves and the port the app binds are set in two different files; a mismatch
# gives a site that 502s with both halves looking correct in isolation.
env_file=/etc/zfin-data-api/zfin-data-api.env
if [ -r "$env_file" ]; then
  configured_port="$(grep -E '^[[:space:]]*PORT=' "$env_file" | tail -1 | cut -d= -f2 | tr -d '[:space:]')"
  if [ -n "$configured_port" ] && [ "$configured_port" != "$APP_PORT" ]; then
    echo "error: APP_PORT ($APP_PORT) in deploy.conf disagrees with PORT ($configured_port) in $env_file." >&2
    echo "       Caddy would proxy to a port nothing is listening on. Make them match." >&2
    exit 1
  fi
fi

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
check_caddy_import() {
  if [ -r /etc/caddy/Caddyfile ] && ! grep -qE '^\s*import\s+/etc/caddy/conf\.d/' /etc/caddy/Caddyfile; then
    cat >&2 <<'MSG'

  WARNING: /etc/caddy/Caddyfile does not import /etc/caddy/conf.d/.
  This site file will be installed but IGNORED — Caddy will reload without error and serve nothing
  for this host. Add this line at top level in the Caddyfile, and in whatever template renders it
  (edit the TEMPLATE that generates it, not just the generated file, or the next render undoes it):

      import /etc/caddy/conf.d/*.caddy

MSG
    return 1
  fi
  return 0
}

if [ "${1:-}" = "--install" ]; then
  echo "installing (sudo)..."
  sudo install -d -m 755 /etc/caddy/conf.d
  sudo cp "$out/zfin-data-api.service" "$out/zfin-data-loader.service" "$out/zfin-data-loader.timer" /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo cp "$out/zfin-data-api.caddy" /etc/caddy/conf.d/zfin-data-api.caddy
  check_caddy_import || true
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl reload caddy
  echo
  echo "installed. Then:"
  echo "  sudo systemctl enable --now zfin-data-api"
  echo "  sudo systemctl enable --now zfin-data-loader.timer   # the TIMER, not the service"
  echo "  sudo systemctl restart zfin-data-api                 # to pick up unit changes"
else
  check_caddy_import || true
  cat <<MSG

rendered into $out/ — NOT installed.

The service user owns the checkout but has no sudo, so rendering and installing are usually done by
different people. Either re-run this as a sudoer with --install, or run these by hand:

  sudo install -d -m 755 /etc/caddy/conf.d
  sudo cp $out/*.service $out/*.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo cp $out/zfin-data-api.caddy /etc/caddy/conf.d/zfin-data-api.caddy
  sudo caddy validate --config /etc/caddy/Caddyfile
  sudo systemctl reload caddy
MSG
fi
