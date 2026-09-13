# Deploying zfin-data-api

The target is **do2**, alongside dg-tour: Caddy terminating TLS in front of a loopback-bound
NestJS process under systemd, configuration outside the checkout, and the database on **DO Managed
MySQL 8**. This is the same model as `zf-server` and `dg-tour`, and it replaces the do1
arrangement (Apache → `localhost:4398`, MariaDB on the same box, `.env` inside `/var/www`).

Everything host-specific lives in **`deploy/deploy.conf`** (gitignored). `render-config.sh` turns
the committed templates into this host's unit files and Caddy site, so nothing in git is tied to a
particular droplet.

---

## 0. DNS — do this first, it is the one step that waits

Deploy under a **staging name** so the new host can be compared against the live one before any
traffic moves. Nothing below touches `zfin.zebrafishfacilitymanager.com` until step 6.

DNS for `zebrafishfacilitymanager.com` is **not** at DigitalOcean — the nameservers are
`ns1/2/3.dnsowl.com`, so records are managed at the registrar.

| Type | Host | Value | TTL |
|---|---|---|---|
| `A` | `zfin2` | `64.23.233.105` (do2) | `300` |

```bash
dig +short A zfin2.zebrafishfacilitymanager.com     # expect 64.23.233.105
dig +short A zfin.zebrafishfacilitymanager.com      # 137.184.239.25 — do1, unchanged
```

Caddy cannot obtain a certificate before the name resolves, so start this before the rest and let
it propagate while you work.

**Set a low TTL on anything you intend to move.** The existing records carry 7200 — two hours — so
with them untouched a cutover takes two hours to reach everyone, *and so does undoing it*. Drop
`zfin` to 300 the day before you plan to flip it, and raise it again afterwards.

---

## Credential model — read this first

Two planes, separated by privilege on purpose. Same model as the zebrafish-facility-manager
deployment docs.

- **Admin / deploy plane** — `doadmin` on DO Managed MySQL. Used **at deploy time** to create the
  database and its user, and to run migrations. **All DDL happens here.** Held by the operator;
  never stored in the application.
- **Runtime plane** — one DB user granted **DML only** (`SELECT, INSERT, UPDATE, DELETE`) on
  `zfin_data`. This is the *only* credential the app holds (`DB_USER` / `DB_PASSWORD` in
  `/etc/zfin-data-api/zfin-data-api.env`). By design it **cannot** create, alter or drop schema.

The running app never needs to change schema, so it is never granted the power to. If the app host
is compromised, the blast radius is data that regenerates itself nightly.

---

## 1. Database (DO console + admin plane)

The cluster dg-tour uses is `ted-moens-db-1-...:25060`. Adding a database to it is enough — this
is public ZFIN reference data with no facility PII, so it co-tenants harmlessly.

1. In the DO console: add the database and user, add **do2** to **Trusted Sources**, and download
   the cluster's **CA certificate** (TLS is required on managed MySQL).
2. Put the cert on the droplet and lock down the config directory:

   ```bash
   sudo install -d -m 755 /etc/zfin-data-api
   sudo cp do-db-service.crt /etc/zfin-data-api/do-db-service.crt
   sudo chmod 644 /etc/zfin-data-api/do-db-service.crt
   ```

3. Grant the runtime user DML only (as `doadmin`):

   ```sql
   CREATE DATABASE zfin_data CHARACTER SET utf8mb4;
   CREATE USER 'zfin_data'@'%' IDENTIFIED BY '<strong-password>';
   GRANT SELECT, INSERT, UPDATE, DELETE ON zfin_data.* TO 'zfin_data'@'%';
   FLUSH PRIVILEGES;
   ```

### If you are copying from `/etc/dg-tour/db.env`

dg-tour is the working example on this droplet, but **the key names differ** — it predates the
zf-server conventions this service follows. The values are the same; the names are not:

| `/etc/dg-tour/db.env` | `/etc/zfin-data-api/zfin-data-api.env` |
|---|---|
| `DB_HOST` | `DB_HOST` (same) |
| `DB_PORT` | `DB_PORT` (same) |
| `DB_DATABASE` | **`DB_NAME`** |
| `DB_USERNAME` | **`DB_USER`** |
| `DB_PASSWORD` | `DB_PASSWORD` (same) |
| `DB_CERTIFICATE_FILE` | **`DB_SSL_CA`** |

A dg-tour name pasted in here is not ignored — the allowlist rejects it and the server refuses to
start, naming the key. That is the intended behaviour, but it is worth knowing why it happened.

> **No data is migrated from do1.** Every row is re-derived from zfin.org nightly, so the cutover
> creates an empty schema and runs the loader. There is no dump, no import, and no MariaDB → MySQL
> collation drift to reconcile. See the `InitialSchema` migration for the reasoning.

## 2. Accounts, Node, and the checkout

**Two accounts, because there are two jobs.** Deploying means installing systemd units and reloading
Caddy — root's work, so it needs sudo. *Running* the service means reading the code, reading one env
file, opening a port and reaching MySQL — and nothing else. Giving both jobs to one account means
the Node process runs as a member of the sudo group, which lets anyone who compromises it wait for a
password rather than needing one.

| | `zsm-admin` | `zsm` |
|---|---|---|
| Role | deploy / operate | run the services |
| Shell | yes | none (`nologin`) |
| Password | yes — sudo checks it | none |
| sudo | yes | no |
| Owns | the checkout, `/srv/zfin-data-api` | nothing |
| Reads | everything it owns | the checkout, one env file |

One runtime account **per service**, not one shared by everything on the box — the same reasoning as
the per-facility database users. A compromise should reach one service's credentials, not all of
them. When the facility servers land here they each get their own, sharing a group that can read the
one shared checkout.

```bash
# Deploy account. A real password: sudo authenticates against the password field, so
# --disabled-password would leave it in the sudo group and still unable to sudo.
sudo adduser --gecos "" zsm-admin
sudo usermod -aG sudo zsm-admin
sudo passwd -S zsm-admin            # expect P (usable), not L (locked)

# Runtime account. A system account: no password, no shell, no home, never logged into.
sudo adduser --system --group --no-create-home --shell /usr/sbin/nologin zsm
```

### Node goes in /usr, not under nvm

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v && command -v node        # expect v24.x at /usr/bin/node
```

do1 and dg-tour both put an absolute `~/.nvm/versions/node/...` path in `ExecStart`. That cannot work
here: `zsm` cannot read another user's home (`0750`), and the units set `ProtectHome=yes`, which hides
`/home` from them regardless. A system Node also means the version that builds the code is the version
that runs it, and a deploy stops depending on whose nvm is current.

### The checkout lives in /srv

```bash
# owner deploys, runtime group reads, nobody else sees it. The setgid bit (2) is what makes
# `npm ci` keep the group on the node_modules tree it replaces.
sudo install -d -o zsm-admin -g zsm -m 2750 /srv/zfin-data-api

sudo -u zsm-admin -i
  git clone https://github.com/tmoens/zfin-data-api.git /srv/zfin-data-api
  cd /srv/zfin-data-api && git checkout update
  npm ci && npm run build
  exit

# prove the runtime account can actually read the build — the units cannot start otherwise
sudo -u zsm test -r /srv/zfin-data-api/dist/main.js && echo "zsm can read the build"
```

`/srv` rather than a home directory for the reason in the table: `zsm` cannot traverse into
`/home/zsm-admin`. The service also needs no write access anywhere — logs go to journald and all
state is in MySQL — so the units mount the whole filesystem read-only.

### What the units do beyond changing user

Running as an unprivileged account is half of it. The units also hand back privileges the service
does not use. In plain terms, if someone got code execution inside the Node process they would find:
the filesystem read-only, `/home` not there at all, a private empty `/tmp`, no sight of other
processes, no way to acquire any piece of root (Linux splits root into ~40 "capabilities"; the units
allow none, because listening above port 1024 and dialling MySQL needs none), and an account with no
password and no shell to escalate through.

`systemd-analyze security <unit>` scores that — a tally of ~50 protections, 0 to 10, lower is less
exposed. It is a checklist, not a risk measurement, so treat it as a comparison:

| Unit | Score | |
|---|---|---|
| `dg-tour-api.service`, on do2 today | 9.2 | UNSAFE |
| `zfin-data-api.service`, as installed here | 1.5 | OK |

> `MemoryDenyWriteExecute` is deliberately **absent**. V8 maps write-then-execute pages for the JIT,
> so that one directive — the most obviously correct-looking line in any hardening guide — makes Node
> exit before running a line. Verified by running it, not assumed.

**What was actually tested, and what was not.** `SystemCallFilter`, `RestrictAddressFamilies`,
`ProtectSystem=strict` and `PrivateTmp` were run against this build of Node and work. The capability
and namespace directives cannot be exercised outside a privileged systemd, so they rest on
`systemd-analyze verify` and `systemd-analyze security` against the exact rendered units under the
same systemd 255 that do2 runs. Step 5 is where they are proven for real. A unit that exits
immediately with `218/CAPABILITIES` or `226/NAMESPACE` is failing on a sandbox line, not on the
application — remove that line, restart, and keep the account split.


## 3. Configuration

```bash
sudo cp /srv/zfin-data-api/environments/sample.env /etc/zfin-data-api/zfin-data-api.env
sudo vi /etc/zfin-data-api/zfin-data-api.env     # DB_*, PORT, PUBLIC_URL, ZFIN_*_URL

# root writes it (you edit with sudo); the runtime account reads it; nobody else can.
sudo chown root:zsm /etc/zfin-data-api/zfin-data-api.env
sudo chmod 640      /etc/zfin-data-api/zfin-data-api.env
sudo -u zsm test -r /etc/zfin-data-api/zfin-data-api.env && echo "zsm can read its config"
```

`chmod 600` is not ceremony: the do1 file was `-rw-r--r--`, so the database password was readable
by every account on that host.

Set `DB_SSL_CA=/etc/zfin-data-api/do-db-service.crt` — without it the connection to managed MySQL
is refused. Leave `HOST` at its `127.0.0.1` default; Caddy is on the same box and is the only thing
that should reach the process. (The do1 deployment bound `0.0.0.0`, which left port 4398 exposed to
anything the firewall happened not to be blocking.)

## 4. Schema

Migrations run on the **admin plane**, so pass `doadmin` explicitly — the runtime user in the env
file cannot do DDL:

```bash
cd /srv/zfin-data-api
DB_HOST=<cluster-host> DB_PORT=25060 DB_NAME=zfin_data \
  DB_USER=doadmin DB_PASSWORD=<doadmin-pw> \
  DB_SSL_CA=/etc/zfin-data-api/do-db-service.crt \
  npm run migration:run
```

## 5. systemd + Caddy

```bash
cp deploy/deploy.conf.example deploy/deploy.conf
vi deploy/deploy.conf          # SERVICE_USER, APP_DIR, NODE_BIN, SITE_ADDRESS, APP_PORT
deploy/render-config.sh        # inspect deploy/.rendered/ first
deploy/render-config.sh --install    # needs sudo; run it as an account that has it
sudo systemctl enable --now zfin-data-api
sudo systemctl enable --now zfin-data-loader.timer    # the TIMER, not the service
```

`render-config.sh` cross-checks `APP_PORT` against `PORT` in the installed env file and refuses to
render on a mismatch — otherwise Caddy proxies to a port nothing is listening on, and both halves
look correct read separately.

### The Caddyfile is shared with dg-tour — one line is required

dg-tour's own deploy kit installs Caddy config with `sudo cp .../Caddyfile /etc/caddy/Caddyfile`,
**replacing the file wholesale**. A site block added there by hand survives until the next dg-tour
deploy, and the first symptom is this API going dark.

So this kit renders to `/etc/caddy/conf.d/zfin-data-api.caddy` and needs the main Caddyfile to
import that directory. Add this at top level in **dg-tour's** `deploy/caddy/Caddyfile.tmpl` (in the
template, not just the rendered file, or dg-tour's next `--install` undoes it):

```caddy
import /etc/caddy/conf.d/*.caddy
```

`render-config.sh` checks for that line and warns loudly if it is missing — without it Caddy
reloads cleanly, reports no error, and serves nothing for this host.

## 6. Verify, then cut over

Point a temporary name (e.g. `zfin2.zebrafishfacilitymanager.com`) at do2 first and compare against
the live do1 service before moving DNS:

```bash
# on do2 — the oneshot unit runs as zsm-admin with the right config already
curl -s localhost:3480/health
sudo systemctl start zfin-data-loader && journalctl -u zfin-data-loader -n 20 --no-pager

# from anywhere — the two should agree
for a in sa12986 y1Tg; do
  diff <(curl -s https://zfin.zebrafishfacilitymanager.com/mutation/allele/$a) \
       <(curl -s https://zfin2.zebrafishfacilitymanager.com/mutation/allele/$a) && echo "$a ok"
done
```

Then move the `zfin.zebrafishfacilitymanager.com` A record to do2, re-render with the real
`SITE_ADDRESS`, and reload Caddy. Caddy fetches the certificate itself once DNS resolves.

**Decommission do1 only after that.** Its consumer is `zf-server`'s `zfinAlleleLookupUrl`, a
runtime-editable value in each facility's `FacilitySettings` document — check every facility points
at the new host before switching anything off.

## Operating it

```bash
systemctl status zfin-data-api
journalctl -u zfin-data-api -f              # journald owns the logs; there is no log/ directory
systemctl list-timers zfin-data-loader.timer
journalctl -u zfin-data-loader --since today
sudo systemctl start zfin-data-loader       # force a reload now
```

The loader **exits non-zero when a load fails**, so a failed unit means what it says. That is new:
the do1 version fired its downloads into an unawaited callback, slept 60 seconds and exited 0
regardless, so a broken load and a successful one looked identical. It also now refuses to empty a
table when a download parses to nothing — an outage at ZFIN leaves yesterday's data in place rather
than replacing it with none.

Set `SENTRY_DSN` if you want to hear about failures without going to look; with no DSN the
processes run normally and report nothing.

## Deploying a new version

```bash
sudo -u zsm-admin -i
cd /srv/zfin-data-api && git pull && npm ci && npm run build
exit
# apply any new migrations on the admin plane (see step 4), then:
sudo systemctl restart zfin-data-api
```

Config is in `/etc/zfin-data-api/`, so none of this can touch it.
