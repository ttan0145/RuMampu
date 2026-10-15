# RuMampu monitoring with Grafana

This folder runs a local monitoring setup for RuMampu: Grafana dashboards that show whether the app is up, how fast it answers, and how the app data grows over time. Everything runs on your own Mac, binds to `127.0.0.1` only, and never connects to the shared Neon database.

## Contents

1. [What you get](#1-what-you-get)
2. [How it fits together](#2-how-it-fits-together)
3. [What you need](#3-what-you-need)
4. [First time setup](#4-first-time-setup)
5. [Everyday use](#5-everyday-use)
6. [Dashboard: API health](#6-dashboard-api-health)
7. [Dashboard: App data (local copy)](#7-dashboard-app-data-local-copy)
8. [Files in this folder](#8-files-in-this-folder)
9. [Changing the setup](#9-changing-the-setup)
10. [Privacy and safety](#10-privacy-and-safety)
11. [Troubleshooting](#11-troubleshooting)
12. [Ideas for later](#12-ideas-for-later)
13. [Removing it](#13-removing-it)

## 1. What you get

| Dashboard | Answers | Data source |
| --- | --- | --- |
| RuMampu · API health | Is the API up? Is the web app up? How fast do they answer? When did they go down? | Prometheus, filled by the probe |
| RuMampu · App data (local copy) | How many profiles, records and house tests exist? How much was added each day? How do people enter income and expenses? | A snapshot of `backend/db.sqlite3` |

The API health dashboard opens by default when you sign in.

## 2. How it fits together

```
 Django API :8000 ─┐
                   ├─(GET every 15 s)── Probe :9115 ──(scrape every 15 s)── Prometheus :9090 ──┐
 Expo web  :8081 ──┘                                                                            ├── Grafana :3000
 backend/db.sqlite3 ──(refresh-db.sh: online backup)── .data/rumampu-local.sqlite3 ─────────────┘
```

| Part | Port | What it does |
| --- | --- | --- |
| Probe (`probe/probe_exporter.py`) | 9115 | Sends a plain GET to each address in `probe/targets.json` on its own schedule and publishes the result as Prometheus metrics. Standard library Python only. |
| Prometheus | 9090 | Reads the probe every 15 seconds and keeps 15 days of history in `.data/prometheus`. |
| Grafana | 3000 | Draws the dashboards. Its data sources and dashboards are created from files when it starts, so nobody has to click them together. |
| Database snapshot | none | A copy of the local app database taken with SQLite's online backup. Grafana reads the copy, never the live file. |

What the probe checks:

| Check | Address | How often | Why |
| --- | --- | --- | --- |
| API health | `http://127.0.0.1:8000/api/v1/health/` | 15 s | The backend is running and answering. |
| Web app | `http://127.0.0.1:8081/` | 15 s | The Expo web server is running. |
| House price data | `http://127.0.0.1:8000/api/v1/housing/price-explorer/trend/?state=SGR&property_type=terrace` | 60 s | The database and the price model are reachable. Checked less often because the query takes a few seconds. |

The probe sends no `X-RuMampu-Client-ID` header and no token, and only calls read only endpoints, so it never creates guest profiles or changes data.

## 3. What you need

* macOS (Apple silicon by default; see the note below for an Intel Mac)
* `python3`, `sqlite3`, `curl` and `shasum` (all come with macOS)
* The RuMampu backend database at `backend/db.sqlite3` (created by `python manage.py migrate` when the backend runs without `PGHOST`)
* An internet connection the first time only, to download Grafana, Prometheus and Grafana's SQLite plugin (`frser-sqlite-datasource`)

You do not install Grafana or Prometheus yourself, and Homebrew is not needed. `./start.sh` runs `install-tools.sh` automatically when the programs are missing. That script downloads the official prebuilt builds into `.data/bin`: Grafana 13.2.3 from dl.grafana.com and Prometheus 3.15.0 from the Prometheus GitHub releases. Before unpacking, it checks each download against its published SHA-256 checksum and stops if they do not match. Nothing is installed system wide; everything stays inside `.data/bin`.

On an Intel Mac, run `ARCH=darwin-amd64 ./install-tools.sh` once before `./start.sh`. To try other versions, set `GRAFANA_VERSION` or `PROMETHEUS_VERSION` the same way.

The API health dashboard needs the backend (port 8000) and the web app (port 8081) running to show them as up. It still works when they are down: it shows them as down, which is the point.

## 4. First time setup

```bash
cd ~/RuMampu/monitoring && ./start.sh
```

On its first run `start.sh`:

1. creates `.data/` for runtime files;
2. runs `install-tools.sh`, which downloads Grafana and Prometheus into `.data/bin` and verifies their SHA-256 checksums (this takes a minute or two, once);
3. makes a random Grafana admin password and saves it in `.data/admin-password.txt` (readable only by you);
4. takes the first database snapshot (`refresh-db.sh`);
5. downloads the Grafana SQLite plugin into `.data/plugins`;
6. starts the probe, Prometheus and Grafana in the background.

Then open <http://127.0.0.1:3000>, sign in as `admin` with the password from:

```bash
cat ~/RuMampu/monitoring/.data/admin-password.txt
```

## 5. Everyday use

| Task | Command |
| --- | --- |
| Start everything | `./start.sh` |
| See what is up | `./status.sh` |
| Stop everything | `./stop.sh` |
| Refresh the app data | `./refresh-db.sh`, then reload the dashboard |
| Rebuild the dashboards after editing them | `python3 grafana/gen_dashboards.py` (Grafana picks up the change by itself within a few seconds) |
| Read the logs | `tail -f .data/logs/grafana.log` (also `probe.log`, `prometheus.log`) |

`start.sh` is safe to run twice: anything already running is left alone. Collected history stays in `.data` when you stop, so graphs continue where they left off.

The app data dashboard shows the snapshot, not the live database. Run `./refresh-db.sh` whenever you want newer numbers, for example after a test run.

## 6. Dashboard: API health

| Panel | What it shows | How to read it |
| --- | --- | --- |
| API, Web app, House price data | The result of the latest check | Green **Up** when the last check returned HTTP 200, red **Down** otherwise, grey **No data** before the first check. |
| API uptime in this time range | Share of API checks that passed in the selected range | Green at 99% or more, orange from 95%, red below. |
| Response time by check | Seconds each check took, over time | A rising line means the server or the database is slowing down. The legend shows mean, max and last value. |
| Response time now | Latest response time per check | Orange from 1 second, red from 3 seconds. |
| Up and down over time | A strip per check, green while up and red while down | Shows exactly when an outage started and ended. |
| Last result per check | HTTP status of the latest check | 0 means the server could not be reached at all (not running, wrong port). |
| Failed checks per hour | Number of failed checks in each hour | Spikes point to restarts or crashes. |

The dashboard refreshes every 30 seconds and shows the last 6 hours by default. Use the time picker (top right) to look further back, up to the 15 days Prometheus keeps.

## 7. Dashboard: App data (local copy)

All panels count rows in the snapshot. None shows a name, email, amount or anything about one person.

| Panel | Query in plain words |
| --- | --- |
| Guest profiles | Every profile (guests and accounts each have one). |
| Accounts | Signed up accounts, admins left out. |
| Active in the last 7 days | Profiles whose last activity is within 7 days of now. |
| Income entries, Daily expenses, House tests kept | Row totals. |
| New profiles per day | Guests created and accounts signed up each day. |
| Records added per day | Income, daily expenses and work costs added each day, stacked. |
| House tests per day | House scenarios tested and tests kept each day. |
| Income imports per day | CSV statement imports started each day. |
| How income is entered | Share of income entries by method: typed (`manual`), CSV (`import`) and month totals (`historical_total`). |
| How expenses are entered | The same for daily expenses. |
| App language | Language each profile chose (`en`, `ms`, `zh`). |
| Finished onboarding, Bought a home, Income sources added | Counts of profiles or items with that flag. |
| House price model | The latest Price Explorer model versions and which one is active. |

The default range is the last 60 days. The per day panels follow the time picker; the totals always count the whole snapshot.

How the per day panels work: each one draws a bar per day in Malaysia time (the backend stores UTC, so the queries add 8 hours before grouping) and shows 0 on days with no rows, so every bar has the same width. The SQLite plugin has no `$__timeFilter` or `$__unixEpochFrom()` macros, so the queries take the time picker range as unix seconds through Grafana's `${__from:date:seconds}` and `${__to:date:seconds}` variables, and the panels use the plugin's `time series` format with `time` as the time column. Grafana fills these variables in the browser, so if you test a query through the HTTP API (`/api/ds/query`) you must put the numbers in yourself.

Note: the local database is filled by Playwright runs and sample scenarios, so these numbers describe test activity, not real users. The same dashboard works on any copy of a RuMampu database (see section 9).

## 8. Files in this folder

| File | Purpose |
| --- | --- |
| `start.sh`, `stop.sh`, `status.sh` | Start, stop and check the three services. |
| `install-tools.sh` | Downloads Grafana and Prometheus into `.data/bin` and checks their SHA-256 checksums. Called by `start.sh` when needed. |
| `refresh-db.sh` | Takes a new database snapshot with SQLite's online backup and switches the copy from WAL to a plain rollback journal, so Grafana's parallel panel queries cannot lock each other out. |
| `probe/probe_exporter.py` | The uptime probe. |
| `probe/targets.json` | What the probe checks, how often, and which status counts as up. |
| `prometheus/prometheus.yml` | What Prometheus collects and how often. |
| `grafana/grafana.ini` | Grafana settings: local address only, no sign up, no usage reporting, default home dashboard. |
| `grafana/provisioning/datasources/datasources.yml` | Creates the Prometheus and SQLite data sources. |
| `grafana/provisioning/dashboards/dashboards.yml` | Loads every dashboard in `grafana/dashboards/` into a RuMampu folder. |
| `grafana/provisioning/plugins/`, `grafana/provisioning/alerting/` | Empty on purpose. Grafana looks for these folders when it starts and logs an error if they are missing, so they exist only to keep Grafana's log clean. |
| `grafana/gen_dashboards.py` | Builds the two dashboard files. Edit panels here, not in the JSON. |
| `grafana/dashboards/*.json` | The generated dashboards. |
| `.data/` | Runtime only and ignored by git: the downloaded Grafana and Prometheus programs (`bin`), Prometheus history, Grafana's own database, plugins, logs, process ids, the snapshot and the admin password. |

## 9. Changing the setup

**Check another address.** Add an entry to `probe/targets.json` (`name`, `label`, `url`, `every_seconds`, `expect_status`), then restart: `./stop.sh && ./start.sh`. It appears on every API health panel automatically. Only add endpoints that are read only and need no client id, or each check would create a guest profile.

**Watch the deployed app.** Point a target at the deployed health URL, for example the Vercel backend's `/api/v1/health/`. Keep the interval at 60 seconds or more to stay polite.

**Use another database copy.** `RUMAMPU_DB=/path/to/copy.sqlite3 ./refresh-db.sh`. The file must have the RuMampu tables (any database the backend has migrated).

**Keep history longer.** Change `--storage.tsdb.retention.time=15d` in `start.sh`.

**Change ports.** The probe port is in `probe/targets.json` and `prometheus/prometheus.yml`; Prometheus in `start.sh` and `datasources.yml`; Grafana in `grafana.ini`.

**Reset the Grafana password.** `./stop.sh`, delete `.data/admin-password.txt` and `.data/grafana/grafana.db`, then `./start.sh`. Dashboards come back from the files; only settings made in the Grafana UI are lost.

**Edit a dashboard.** Dashboards are read only in the UI on purpose, so the files stay the single source. Change `grafana/gen_dashboards.py`, run it, and reload. To experiment, use Save as in Grafana to make an editable copy.

## 10. Privacy and safety

* Nothing here connects to Neon or any other shared database. The app data comes only from a local SQLite copy.
* Dashboards show counts and totals only: no names, emails, amounts or per person rows.
* All three services listen on `127.0.0.1`, so other devices on your network cannot open them.
* Grafana sign up is off, anonymous access is off, and usage reporting and update checks are off.
* The admin password and the database snapshot live in `.data/`, which git ignores. Do not copy `.data/` into a shared drive or the repo.
* The probe only sends GET requests to read only endpoints, without a client id or token.

## 11. Troubleshooting

| What you see | Likely cause | Fix |
| --- | --- | --- |
| `start.sh` stops while downloading Grafana or Prometheus | No internet connection, or the download site was unreachable | Check the connection and run `./start.sh` again. It only downloads what is still missing. |
| `Checksum mismatch` from `start.sh` | The download was damaged or is not the official file | Nothing was installed and the bad file was deleted. Run `./start.sh` again; if it keeps failing, do not work around it, check the versions in `install-tools.sh`. |
| Grafana or Prometheus will not start on an Intel Mac | The Apple silicon build was downloaded | `./stop.sh`, delete `.data/bin`, run `ARCH=darwin-amd64 ./install-tools.sh`, then `./start.sh`. |
| API and Web app show **Down** | The backend or Expo is not running | Start them (`python manage.py runserver` in `backend`, `npm run web` in `frontend`). |
| House price data **Down**, API **Up** | Price model not loaded or the database is unreachable | Load it with `python manage.py load_price_model ../ml/app_export --activate` in `backend`. |
| Every panel says **No data** | Prometheus or the probe is not running | `./status.sh`, then read `.data/logs/prometheus.log` and `.data/logs/probe.log`. |
| App data panels show a plugin error | The SQLite plugin did not download | Check the internet connection, delete `.data/plugins`, run `./start.sh` again. |
| App data panels are empty | No snapshot, or the time range has no activity | Run `./refresh-db.sh`; widen the range in the time picker. |
| A random app data panel shows `database is locked (261)` | The snapshot is still in WAL mode (taken by an older `refresh-db.sh`) | Run `./refresh-db.sh` and reload the dashboard. |
| Grafana does not open on port 3000 | Another program uses the port | `lsof -iTCP:3000 -sTCP:LISTEN`, stop it or change `http_port` in `grafana.ini`. |
| Forgot the password | | `cat .data/admin-password.txt`, or reset it as in section 9. |
| A service will not stop | Stale process id | `./stop.sh`; if it persists, find it with `ps aux | grep -E "grafana|prometheus|probe_exporter"`. |

## 12. Ideas for later

* **Alerts.** Grafana can notify by email or Slack when a check stays down for a few minutes (Alerting, then Alert rules, using the `probe_success` metric).
* **Backend metrics.** Request counts, error rates and slow endpoints per URL need a metrics library inside Django (for example `django-prometheus`). That changes the shared backend, so agree it with the team first.
* **Production data.** To chart real usage, create a read only Postgres role on Neon and add it as a separate data source. Agree this with the team, because it reads shared data.
* **Hosted.** Grafana Cloud's free tier can host the same dashboards and receive the same metrics.

## 13. Removing it

```bash
cd ~/RuMampu/monitoring && ./stop.sh
```

```bash
rm -rf ~/RuMampu/monitoring/.data
```

Deleting `.data` removes everything the setup created: the downloaded Grafana and Prometheus programs, their history, the plugin, logs, the snapshot and the admin password. There is nothing to uninstall, because nothing was installed system wide. The folder itself can then be deleted. Nothing outside it was changed.
