# zfin-data-api

A single-purpose API that resolves a zebrafish **allele name** to its **ZFIN Id**.

## Why it exists

[ZFIN](https://zfin.org) holds a wealth of zebrafish genetics information. Two of its classes —
mutations and transgenes — are known to researchers by an abbreviated name loosely called an
*allele*. The allele is the human-friendly identifier; the ZFIN Id is the key by which other
systems know the same mutation or transgene.

The [Zebrafish Facility Manager](https://zebrafishfacilitymanager.com) needs to resolve one to the
other constantly, and ZFIN publishes no API that does it. Without this service the only route is
for a user to visit ZFIN by hand, search the allele name, copy the ZFIN Id, and paste it back.

## How it works

1. ZFIN publishes a tab-separated list of mutations and another of transgenes, daily.
2. A systemd timer runs `dist/loader.js` once a night, which reads both files and rebuilds two
   database tables from them.
3. This server answers lookups against those tables.

Every row is re-derived from zfin.org nightly, so **the database holds no original data**. That
single fact shapes a lot of what follows: there is nothing here to back up, and moving the service
to a new database means creating an empty schema and running the loader.

## The API

| Route | Answers |
|---|---|
| `GET /mutation/allele/:alleleName` | the mutation record, including `zfinId` |
| `GET /transgene/allele/:alleleName` | the transgene record, including `zfinId` |
| `GET /health` | `{"status":"ok","production":true}` — liveness, no DB access |
| `GET /` | a plain-text description of the above |

```console
$ curl https://zfin.zebrafishfacilitymanager.com/mutation/allele/sa12986
{"zfinId":"ZDB-ALT-130411-2656","alleleName":"sa12986","geneName":"lhfpl4a",
 "mutationType":"POINT_MUTATION","consequence":"splice site","zfinGeneId":"ZDB-GENE-111017-1"}
```

> **Known wart: an unknown allele returns `200` with an empty body**, not a `404`. zf-server
> documents this as issue #202 and absorbs it in `ZfinService.mustFindMutationByName`. Fixing it
> here is a wire-contract change to the only consumer, so it is deliberately left alone — change
> both together or neither.

`GET /mutation/loadFromZfin` and `GET /transgene/loadFromZfin` trigger a full reload, and exist for
development. They have **no authentication**, so `ALLOW_LOADING_VIA_API` is false unless a
deployment says otherwise and production never should: anyone who learned the URL could drop and
rebuild both tables at will. The nightly loader does not use them — it calls the services directly.

## Configuration

One file holds all deployment configuration, read by both the server and the loader.

- **In production** it lives at **`/etc/zfin-data-api/zfin-data-api.env`** — *outside* the code
  checkout, owned by the service user, `chmod 600`. A deploy is `git pull` plus a rebuild, and
  keeping the file elsewhere means a deploy structurally cannot touch the database password.
- **In development**, copy the sample and point the app at your copy:

  ```bash
  cp environments/sample.env environments/zfin-data-api.env
  export ZFIN_API_CONFIG_DIR=environments
  ```

`environments/sample.env` documents **every key the server accepts** — and that list is exhaustive,
because the Joi schema in `src/config/config.service.ts` is an **allowlist**. An unrecognised key is
a startup error that names itself, so a typo stops the server rather than silently taking a default:

```
Config validation error: "DB_HSOT" is not allowed
```

This mirrors `zf-server`'s `ConfigService`, with one difference: zf-server is multi-tenant and uses
`FACILITY` to choose among several env files. This service has one deployment, so it reads one file
and there is nothing to select.

## Development

```bash
npm install
docker compose up -d                  # MySQL 8.0.45 on 127.0.0.1:3309
cp environments/sample.env environments/zfin-data-api.env    # then edit DB_* for the container
export ZFIN_API_CONFIG_DIR=environments

npm run migration:run                 # create the schema
npm run start:dev                     # or: npm run build && npm start
npm run load                          # populate from ZFIN (takes a few seconds)
```

The container is MySQL **8.0.45**, pinned to match DO Managed MySQL. That matters: production ran
MariaDB until the do2 migration, and MariaDB and MySQL 8 differ enough in collations, DDL parsing
and reserved words that migrations must be authored against the engine that will actually run them.

While iterating on the loader, download the two ZFIN files once and serve them locally rather than
pulling many megabytes from ZFIN repeatedly — see the commented `ZFIN_*_URL` values in the sample.

```bash
npm run verify      # typecheck + test + lint
```

## Schema changes

**Migrations only.** `synchronize` is off and must stay off; the runtime database user holds
`SELECT, INSERT, UPDATE, DELETE` and cannot alter schema even if asked to.

```bash
npm run migration:generate -- src/migrations/WhatItDoes
npm run migration:run
npm run migration:show
npm run migration:revert
```

The CLI reads `src/data-source.ts`, which takes plain `DB_*` environment variables and defaults to
the local container. It deliberately does not go through `ConfigService` — migrations run on the
**admin plane** with a privileged credential, and have no business requiring a full deployment
config file. To target a real database:

```bash
DB_HOST=<cluster> DB_PORT=25060 DB_NAME=zfin_data DB_USER=doadmin DB_PASSWORD=<pw> \
  DB_SSL_CA=/etc/zfin-data-api/do-db-service.crt npm run migration:run
```

## Deployment

See **[deploy/README.md](deploy/README.md)** for the full runbook: provisioning the database on DO
Managed MySQL, the Caddy + systemd arrangement, and the do1 → do2 cutover.

In short: Caddy terminates TLS and proxies to a loopback-bound Node process under systemd, with a
second unit and a timer for the nightly load, and all configuration in `/etc/zfin-data-api/`. It
follows the same model as `zf-server` and `dg-tour`; `deploy/render-config.sh` generates this
host's unit files and Caddy site from `deploy/deploy.conf`.
