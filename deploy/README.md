# Deploying zfin-data-api

This is the general deployment guide: it describes the shape of a deployment, not any particular
machine. Wherever a hostname, account name, port or database endpoint appears it is an **example** —
the real values for a given host live in `deploy/deploy.conf`, which is not tracked.

**What gets deployed.** Caddy terminates TLS and reverse-proxies to a loopback-bound NestJS process
run by systemd, with a second unit and a timer for the nightly data load. All configuration lives
outside the code checkout. The database is MySQL 8, typically a managed instance reached over TLS.

**What you need before starting**

- A host you can reach over SSH with sudo, running systemd and Caddy 2.7+.
- A MySQL 8 database, and an administrative credential for it.
- Control of a DNS zone, to publish the hostname this API will answer on.
- Node 20 or newer available to install system-wide (NestJS 11 requires it).

---

## 0. DNS — do this first, it is the one step that waits

Caddy obtains its certificate automatically, but it cannot do so until the name resolves to the
host. Publish the record before anything else and let it propagate while you work.

| Type | Host | Value |
|---|---|---|
| `A` | the name this API will answer on | the target host's IP |

```bash
dig +short A zfin-api.example.org        # expect the target host
```

**Replacing an existing deployment?** Publish a *staging* name and deploy under that. The live name
keeps pointing at the old host, which keeps serving, and you can compare the two before moving
anything. Cut over at step 6.

**Check the TTL on any record you intend to move.** A record with a two-hour TTL takes two hours to
move — and two hours to move *back*. Lower it to 300 the day before a cutover, and raise it again
afterwards.

---

## Credential model — read this first

Two planes, separated by privilege on purpose.

- **Admin / deploy plane** — a privileged database credential (`root` self-hosted, `doadmin` on
  DigitalOcean Managed MySQL, the master user on RDS). Used **at deploy time** to create the
  database and its user, and to run migrations. **All DDL happens here.** Held by the operator,
  never stored in the application.
- **Runtime plane** — one database user granted **DML only** (`SELECT, INSERT, UPDATE, DELETE`) on
  this database. This is the *only* database credential the application holds. By design it
  **cannot** create, alter or drop schema.

The running application never needs to change schema, so it is never granted the power to. The same
split appears again in the operating-system accounts at step 2.

---

## 1. The runtime account

**Two jobs, but only one account to create.** Deploying means installing systemd units and reloading
Caddy — root's work, so it needs sudo. *Running* the service means reading the installed release,
reading one env file, opening a port and reaching the database, and nothing else.

Deploying is done by **a person who administers this host**. Accounts are separated *per person*
for that, so `sudo` logs, file ownership and `last` record who did what, and *per service* for the
runtime, so a compromise reaches one service's credentials rather than all of them.

The only account to create here is the one the service runs as:

```bash
# No password, no shell, no home, never logged into.
sudo adduser --system --group --no-create-home --shell /usr/sbin/nologin zfin-api
```

| | the deployer | `zfin-api` |
|---|---|---|
| Who | an administrator of this host | nothing — a system account |
| Shell | yes | none (`nologin`) |
| sudo | yes, and it genuinely needs it | no |
| Reads | everything | the installed release, one env file |

A second person who deploys gets their own account, named after them.


## 2. Node, and where releases land on the target

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v && command -v node          # expect /usr/bin/node
```

A per-user nvm install cannot work here: the runtime account cannot read another user's home
(`0750`), and the units set `ProtectHome=yes`, which hides `/home` from them regardless. A system
Node also means the version that builds the code is the version that runs it.



The target never builds anything. It receives a finished artifact, so it needs no git, no npm and no
compiler — only the Node runtime installed above.

`deploy/install-release.sh` keeps several installed versions side by side, with a `current` shortcut
pointing at whichever should be running:

```
/srv/zfin-data-api/
  releases/
    zfin-data-api-20260912T080000Z-a74c0ae/
    zfin-data-api-20260913T193000Z-c852d8f/
  current -> releases/zfin-data-api-20260913T193000Z-c852d8f
```

The units run from `current`, so rolling back is repointing it and restarting — the previous version
is still there, complete, needing no rebuild and no network.

This folder holds no secrets (those are in `/etc/zfin-data-api`), so it does not need tight
permissions:

```bash
# `install -d` makes a directory. It stays empty until step 8 puts a release in it.
sudo install -d -o root -g root -m 755 /srv/zfin-data-api
```

Root owns and writes it — `install-release.sh` runs under sudo — and the runtime account reads it as
*other*. Nothing here is owned by a person, so a second deployer needs no change.

The day a deployer exists who is **not** root — realistically an automated one — give the directory
a group and add them to it, alongside a narrow `sudo systemctl restart` rule. Until then a group
would grant nothing that sudo does not already.

The target has no checkout, so the install script has to be put there once — it is an administrative
tool, so it goes where those live:

```bash
scp deploy/install-release.sh <target>:/tmp/

# `install src dst` copies a file. This lands in /usr/local/sbin, where admin tools live —
# not under the release directory. It is the tool, not a release.
#
# Install it under a name carrying the application. There will be one of these per service, and
# a generic `install-release` in a shared directory says nothing about which; extensionless,
# as tools there conventionally are.
ssh <target> 'sudo install -o root -g root -m 755 /tmp/install-release.sh /usr/local/sbin/zfin-data-api-deploy'
```

Copy it again whenever it changes; it is versioned in this repository alongside the units.

## 3. The configuration directory and the database certificate

The deployment configuration and the database CA certificate both live in
`/etc/zfin-data-api/`, outside the code, so that installing a release can never touch them.

```bash
sudo install -d -m 755 /etc/zfin-data-api
```

Put the CA certificate your database provider issued here as well — see step 4, which is
where you obtain it.

## 4. The database and its runtime user

```sql
-- as the administrative user
CREATE DATABASE zfin_data CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'zfin_data'@'%' IDENTIFIED BY '<strong-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON zfin_data.* TO 'zfin_data'@'%';
FLUSH PRIVILEGES;

-- confirm the grant carries no DDL privilege
SHOW GRANTS FOR 'zfin_data'@'%';
```

A managed MySQL service will require TLS and give you a CA certificate to verify against. Put it on
the host where the application can read it, and set `DB_SSL_CA` to its path:

```bash
sudo install -d -m 755 /etc/zfin-data-api
sudo cp ca-certificate.crt /etc/zfin-data-api/db-ca.crt
sudo chmod 644 /etc/zfin-data-api/db-ca.crt
```

Managed services also restrict which hosts may connect — add this host to that allow list. The port
varies by provider: 3306 self-hosted, 25060 on DigitalOcean Managed MySQL, 3306 on RDS. Don't
hard-code it.

> **Migrating from an existing deployment? Do not copy the data.** Every row in this database is
> re-derived from zfin.org nightly, so a migration is an empty schema plus one loader run. There is
> no dump, no import, and no cross-engine collation drift to reconcile.

---

## 5. The deployment configuration file

One file, read by both the server and the loader, living outside the checkout so that a `git pull`
deploy structurally cannot touch it.

```bash
sudo cp /srv/zfin-data-api/environments/sample.env /etc/zfin-data-api/zfin-data-api.env
sudo vi /etc/zfin-data-api/zfin-data-api.env      # DB_*, PORT, PUBLIC_URL, ZFIN_*_URL

# root writes it (you edit with sudo); the runtime account reads it; nobody else can.
sudo chown root:zfin-api /etc/zfin-data-api/zfin-data-api.env
sudo chmod 640           /etc/zfin-data-api/zfin-data-api.env
sudo -u zfin-api test -r /etc/zfin-data-api/zfin-data-api.env && echo "runtime account can read it"
```

`environments/sample.env` documents every key the server accepts, and that list is exhaustive: the
schema is an **allowlist**, so an unrecognised key stops the server and names itself rather than
being silently ignored.

Set `DB_SSL_CA` when the database requires TLS — without it the connection is refused. Leave `HOST`
at its `127.0.0.1` default: Caddy runs on the same host and is the only thing that should reach the
process directly. `0640 root:<runtime account>` on the file means exactly one account can read the
database password, and it is one that cannot log in.

---

## 6. If another application shares this host's Caddy

Deploy kits commonly install Caddy configuration by replacing `/etc/caddy/Caddyfile` wholesale. Two
applications cannot both do that, so this kit renders its site configuration to
`/etc/caddy/conf.d/zfin-data-api.caddy` and relies on the main Caddyfile importing that directory:

```caddy
import /etc/caddy/conf.d/*.caddy
```

Add it to whatever **template** generates the Caddyfile, not only to the generated file, or the next
render silently removes it. `render-config.sh` checks for the line and warns if it is missing —
without it Caddy reloads cleanly, reports no error, and serves nothing for this host.

---

## 7. Install the units and the Caddy site

```bash
cp deploy/deploy.conf.example deploy/deploy.conf
vi deploy/deploy.conf          # accounts, APP_DIR, NODE_BIN, SITE_ADDRESS, APP_PORT
deploy/render-config.sh        # inspect deploy/.rendered/ first
deploy/render-config.sh --install
```

**Do not enable the units yet** — there is no code for them to run until step 5. Installing the unit
files and the Caddy site is all that happens here.

`zfin-data-loader.service` is `Type=oneshot` — it loads and exits. Enabling the *service* would run
it once at boot and nothing more; the timer is what makes it nightly.

`render-config.sh` cross-checks `APP_PORT` against `PORT` in the installed env file and refuses to
render on a mismatch — otherwise Caddy proxies to a port nothing is listening on, and both files
look correct read separately.

### What the units do beyond changing user

Running as an unprivileged account is half of it. The units also hand back privileges the service
does not use. If someone got code execution inside the Node process they would find: the filesystem
read-only, `/home` absent, a private empty `/tmp`, no sight of other processes, no way to acquire
any piece of root (Linux splits root into ~40 "capabilities"; the units allow none, because
listening above port 1024 and dialling a database needs none), and an account with no password and
no shell to escalate through.

`systemd-analyze security <unit>` scores that — a tally of ~50 protections, 0 to 10, lower is less
exposed. It is a checklist rather than a risk measurement, so treat it as a comparison: these units
score **1.5**, where a unit with no hardening at all scores around **9**.

> `MemoryDenyWriteExecute` is deliberately **absent**. V8 maps write-then-execute pages for the JIT,
> so that one directive — the most obviously correct-looking line in any hardening guide — makes
> Node exit before running a line.

**What was tested, and what was not.** `SystemCallFilter`, `RestrictAddressFamilies`,
`ProtectSystem=strict` and `PrivateTmp` were run against Node and work, as was the absence of
`MemoryDenyWriteExecute`. The capability and namespace directives cannot be exercised outside a
privileged systemd, so they rest on `systemd-analyze verify` against the rendered units. Step 6 is
where they are proven on the host. A unit that exits immediately with `218/CAPABILITIES` or
`226/NAMESPACE` is failing on a sandbox line, not on the application — remove that line, restart,
and keep the account split.

---

## 8. Build and install the first release

The target builds nothing, so the code arrives as an artifact built elsewhere.

**On the build machine** — your workstation, or later a CI runner:

```bash
deploy/pack-release.sh                       # -> dist-releases/<name>.tgz, about 25 MB
scp dist-releases/<name>.tgz <target>:/tmp/
```

**On the target:**

```bash
sudo zfin-data-api-deploy /tmp/<name>.tgz
sudo systemctl enable --now zfin-data-api
sudo systemctl enable --now zfin-data-loader.timer    # the TIMER, not the service
```

`zfin-data-loader.service` is `Type=oneshot` — it loads and exits. Enabling the *service* would run
it once at boot and nothing more; the timer is what makes it nightly.

The install script unpacks beside any existing version, repoints `current`, restarts, and then checks
the service is actually answering. If it is not, it puts `current` back and exits non-zero.

## 9. Create the schema, and fill the tables

The tables do not exist yet. Migrations run on the **admin plane** with the administrative database
credential — the runtime user in the config file cannot execute DDL.

They run from the installed release: TypeORM is a production dependency, so its CLI ships in the
artifact and the migrations are compiled into `dist/`. No npm, no TypeScript, no toolchain.

```bash
cd /srv/zfin-data-api/current
 DB_HOST=<host> DB_PORT=<port> DB_NAME=zfin_data \
 DB_USER=<admin-user> DB_PASSWORD=<admin-password> \
 DB_SSL_CA=/etc/zfin-data-api/db-ca.crt \
 node node_modules/typeorm/cli.js migration:run -d dist/data-source.js
```

The leading space keeps the password out of shell history. Re-running is safe — applied migrations
are recorded and skipped. `migration:show` lists them without changing anything.

Then fill the tables:

```bash
sudo systemctl start zfin-data-loader
journalctl -u zfin-data-loader -n 20 --no-pager
```

A good load takes seconds and logs both datasets. Until it has run, the service answers `/health`
but every allele lookup returns nothing.

**When a future release needs a schema change**, apply it *before* installing that release. Deploys
never alter your database on their own.

## 10. Verify, and cut over

```bash
systemctl is-active zfin-data-api
ps -o user= -C node                       # the runtime account, not the deploy account or root
ss -ltn | grep <port>                     # 127.0.0.1:<port>, not *:<port>
curl -s localhost:<port>/health

# first population — the oneshot unit runs as the runtime account with the right config
sudo systemctl start zfin-data-loader && journalctl -u zfin-data-loader -n 20 --no-pager
```

A good load takes seconds and logs both datasets. Then, from outside:

```bash
curl -s https://zfin-api.example.org/health
curl -s https://zfin-api.example.org/mutation/allele/sa12986
```

**Replacing an existing deployment?** Both are live at this point, answering from separate databases
built from the same source, so they should agree exactly:

```bash
for a in sa12986 y1Tg; do
  diff <(curl -s https://<old-host>/mutation/allele/$a) \
       <(curl -s https://<new-host>/mutation/allele/$a) && echo "$a agrees"
done
```

When they agree, set `SITE_ADDRESS` and `PUBLIC_URL` to the real name, re-render, reinstall the
Caddy file, reload, and move the DNS record. Caddy obtains the certificate for the new name itself
once DNS resolves.

**Check the consumers before decommissioning anything.** This API's client is the Zebrafish Facility
Manager server, which reaches it through a runtime-editable setting in *each facility's*
`FacilitySettings` document — not one shared value. Confirm every facility points at the new host
first.

---

## Operating it

```bash
systemctl status zfin-data-api
journalctl -u zfin-data-api -f              # journald owns the logs; there is no log directory
systemctl list-timers zfin-data-loader.timer
journalctl -u zfin-data-loader --since today
sudo systemctl start zfin-data-loader       # force a reload now
```

The loader **exits non-zero when a load fails**, so a failed unit means what it says. It also
refuses to empty a table when a download parses to nothing: an outage at ZFIN leaves yesterday's
data in place rather than replacing it with none.

Set `SENTRY_DSN` to hear about failures without going to look; with no DSN the processes run
normally and report nothing.

## Deploying a new version

**On the build machine** — a workstation or a CI runner, never the target:

```bash
deploy/pack-release.sh                 # -> dist-releases/<name>.tgz, about 25 MB
scp dist-releases/<name>.tgz <target>:/tmp/
```

`npm ci` executes package lifecycle scripts, so wherever it runs, code from the registry runs as the
invoking user. Keeping it here means that user is you on a workstation, not a sudo-capable account
on a production host.

**On the target:**

```bash
sudo zfin-data-api-deploy /tmp/<name>.tgz
```

It unpacks beside the current version, repoints `current`, restarts the service, and then checks
that the service is actually answering — `systemctl restart` returns success as soon as the process
*starts*, which is not the same as it working. If the health check fails it puts `current` back,
restarts, and exits non-zero.

```bash
sudo zfin-data-api-deploy --list        # what is installed, and what is live
sudo zfin-data-api-deploy --rollback    # back to the previous version
```

**Schema changes** are separate and deliberate — see step 9. If a release needs one, apply it before
installing that release.

Configuration lives in `/etc/zfin-data-api/`, so none of this can touch it.
