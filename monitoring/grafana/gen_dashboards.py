"""Writes the two RuMampu dashboards into grafana/dashboards/.

Run it again after editing a panel here; Grafana reloads the files on its own.
The app data dashboard only shows totals and counts, never names, emails or
one person's amounts.
"""
import json
from pathlib import Path

OUT = Path(__file__).parent / "dashboards"
PROM = {"type": "prometheus", "uid": "rumampu-prometheus"}
DB = {"type": "frser-sqlite-datasource", "uid": "rumampu-local-db"}
TEAL, PINK, ORANGE, VIOLET, GOLD = "#11A09B", "#FF4F80", "#FF9416", "#7C5CFF", "#FFC83D"


class Grid:
    """Places panels left to right on Grafana's 24 column grid."""

    def __init__(self):
        self.x = self.y = self.row_h = 0

    def at(self, w, h):
        if self.x + w > 24:
            self.x, self.y, self.row_h = 0, self.y + self.row_h, 0
        pos = {"x": self.x, "y": self.y, "w": w, "h": h}
        self.x += w
        self.row_h = max(self.row_h, h)
        return pos

    def newline(self):
        if self.x:
            self.x, self.y, self.row_h = 0, self.y + self.row_h, 0


def dashboard(uid, title, description, panels, time_from, refresh):
    for i, p in enumerate(panels, 1):
        p["id"] = i
    return {
        "uid": uid, "title": title, "description": description, "tags": ["rumampu"],
        "timezone": "Asia/Kuala_Lumpur", "schemaVersion": 39, "version": 1, "editable": False,
        "time": {"from": time_from, "to": "now"}, "refresh": refresh,
        "panels": panels, "templating": {"list": []}, "annotations": {"list": []},
    }


def text(grid, w, h, content):
    return {"type": "text", "title": "", "gridPos": grid.at(w, h), "options": {"mode": "markdown", "content": content}}


def row(grid, title):
    grid.newline()
    p = {"type": "row", "title": title, "collapsed": False, "gridPos": grid.at(24, 1), "panels": []}
    grid.newline()
    return p


# ---------------------------------------------------------------- API health

def prom(expr, legend="", instant=False):
    return {"datasource": PROM, "expr": expr, "legendFormat": legend, "refId": "A", "instant": instant, "range": not instant}


def up_stat(grid, title, name, desc):
    return {
        "type": "stat", "title": title, "description": desc, "datasource": PROM, "gridPos": grid.at(6, 4),
        "targets": [prom(f'probe_success{{name="{name}"}}', instant=True)],
        "options": {"colorMode": "background", "graphMode": "none", "textMode": "value", "reduceOptions": {"calcs": ["lastNotNull"]}},
        "fieldConfig": {"defaults": {
            "mappings": [{"type": "value", "options": {"1": {"text": "Up", "color": "green"}, "0": {"text": "Down", "color": "red"}}},
                         {"type": "special", "options": {"match": "null", "result": {"text": "No data", "color": "gray"}}}],
            "thresholds": {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "green", "value": 1}]},
        }, "overrides": []},
    }


def api_health():
    g = Grid()
    panels = [
        text(g, 24, 3, "### RuMampu API health\nThe probe checks the local API and web app every 15 seconds (house price data every minute). "
             "**Up** means the last check returned HTTP 200. Times are Malaysia time."),
        up_stat(g, "API", "api_health", "GET /api/v1/health/ on the Django backend (port 8000)."),
        up_stat(g, "Web app", "web_app", "The Expo web app on port 8081."),
        up_stat(g, "House price data", "price_explorer", "GET /api/v1/housing/price-explorer/trend/: needs the database and the price model."),
        {
            "type": "stat", "title": "API uptime in this time range", "datasource": PROM, "gridPos": g.at(6, 4),
            "description": "Share of API checks that passed during the selected time range.",
            "targets": [prom('avg_over_time(probe_success{name="api_health"}[$__range]) * 100', instant=True)],
            "options": {"colorMode": "value", "graphMode": "none", "reduceOptions": {"calcs": ["lastNotNull"]}},
            "fieldConfig": {"defaults": {"unit": "percent", "decimals": 2,
                "thresholds": {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "orange", "value": 95}, {"color": "green", "value": 99}]}},
                "overrides": []},
        },
        row(g, "Response time"),
        {
            "type": "timeseries", "title": "Response time by check", "datasource": PROM, "gridPos": g.at(16, 9),
            "description": "How long each check took. A rising line means the server or the database is slowing down.",
            "targets": [prom("probe_duration_seconds", "{{label}}")],
            "fieldConfig": {"defaults": {"unit": "s", "custom": {"lineWidth": 2, "fillOpacity": 12, "showPoints": "never"}}, "overrides": []},
            "options": {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["mean", "max", "lastNotNull"]}, "tooltip": {"mode": "multi"}},
        },
        {
            "type": "bargauge", "title": "Response time now", "datasource": PROM, "gridPos": g.at(8, 9),
            "targets": [prom("probe_duration_seconds", "{{label}}", instant=True)],
            "options": {"orientation": "horizontal", "displayMode": "gradient", "reduceOptions": {"calcs": ["lastNotNull"]}},
            "fieldConfig": {"defaults": {"unit": "s", "min": 0,
                "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "orange", "value": 1}, {"color": "red", "value": 3}]}},
                "overrides": []},
        },
        row(g, "Up and down"),
        {
            "type": "state-timeline", "title": "Up and down over time", "datasource": PROM, "gridPos": g.at(16, 7),
            "description": "Green while a check passes, red while it fails.",
            "targets": [prom("probe_success", "{{label}}")],
            "options": {"showValue": "never", "mergeValues": True, "rowHeight": 0.8},
            "fieldConfig": {"defaults": {
                "mappings": [{"type": "value", "options": {"1": {"text": "Up", "color": "green"}, "0": {"text": "Down", "color": "red"}}}],
                "thresholds": {"mode": "absolute", "steps": [{"color": "red", "value": None}, {"color": "green", "value": 1}]}}, "overrides": []},
        },
        {
            "type": "table", "title": "Last result per check", "datasource": PROM, "gridPos": g.at(8, 7),
            "description": "HTTP status of the latest check. 0 means the server could not be reached.",
            "targets": [prom("probe_http_status_code", "{{label}}", instant=True) | {"format": "table"}],
            "transformations": [{"id": "organize", "options": {
                "excludeByName": {"Time": True, "__name__": True, "instance": True, "job": True, "name": True, "url": True},
                "renameByName": {"label": "Check", "Value": "HTTP status"}}}],
            "fieldConfig": {"defaults": {}, "overrides": []},
        },
        {
            "type": "timeseries", "title": "Failed checks per hour", "datasource": PROM, "gridPos": g.at(24, 7),
            "description": "Failed checks in each clock hour. Each bar counts only its own hour, so an outage does not linger into later hours.",
            # one bar per clock hour: the step and the lookback are both an hour, so hours never overlap
            "interval": "1h",
            "targets": [prom("round(increase(probe_failures_total[$__interval]))", "{{label}}") | {"interval": "1h"}],
            "fieldConfig": {"defaults": {"unit": "short", "decimals": 0, "min": 0, "custom": {"drawStyle": "bars", "fillOpacity": 60, "lineWidth": 0, "axisSoftMax": 5}}, "overrides": []},
            "options": {"legend": {"displayMode": "list", "placement": "bottom"}},
        },
    ]
    return dashboard("rumampu-api-health", "RuMampu · API health",
                     "Uptime and response time of the local RuMampu API and web app.", panels, "now-6h", "30s")


# ---------------------------------------------------------------- App data

def sql(query, ref="A", series=True):
    return {"datasource": DB, "refId": ref, "queryText": query, "rawQueryText": query,
            "queryType": "time series" if series else "table", "timeColumns": ["time"] if series else []}


def day_series(table, column, name, ref="A", where=""):
    """One bar per Malaysia day in the selected range, with 0 on days without rows.

    Django stores UTC, so dates are shifted by 8 hours before grouping. The range
    comes from Grafana as unix seconds (${__from:date:seconds}); this plugin has
    no $__timeFilter style macros.
    """
    extra = f" AND {where}" if where else ""
    return sql(
        "WITH RECURSIVE days(d) AS ("
        "SELECT date(${__from:date:seconds}, 'unixepoch', '+8 hours') "
        "UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date(${__to:date:seconds}, 'unixepoch', '+8 hours')), "
        f"counts AS (SELECT date({column}, '+8 hours') AS d, COUNT(*) AS n FROM {table} "
        f"WHERE {column} >= datetime(${{__from:date:seconds}}, 'unixepoch', '-8 hours'){extra} GROUP BY 1) "
        f"SELECT CAST(strftime('%s', days.d) AS INTEGER) - 28800 AS time, COALESCE(counts.n, 0) AS \"{name}\" "
        "FROM days LEFT JOIN counts ON counts.d = days.d ORDER BY 1", ref)


def total(grid, title, query, desc, color):
    return {
        "type": "stat", "title": title, "description": desc, "datasource": DB, "gridPos": grid.at(4, 4),
        "targets": [sql(query, series=False)],
        "options": {"colorMode": "background", "graphMode": "none", "textMode": "value", "reduceOptions": {"calcs": ["lastNotNull"]}},
        "fieldConfig": {"defaults": {"unit": "locale", "decimals": 0, "color": {"mode": "fixed", "fixedColor": color}}, "overrides": []},
    }


def per_day(grid, w, title, desc, targets, colors):
    return {
        "type": "timeseries", "title": title, "description": desc, "datasource": DB, "gridPos": grid.at(w, 8),
        "targets": targets,
        "fieldConfig": {"defaults": {"unit": "short", "decimals": 0, "custom": {"drawStyle": "bars", "fillOpacity": 80, "lineWidth": 0, "stacking": {"mode": "normal"}}},
                        "overrides": [{"matcher": {"id": "byName", "options": n}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": c}}]} for n, c in colors.items()]},
        "options": {"legend": {"displayMode": "list", "placement": "bottom"}, "tooltip": {"mode": "multi"}},
    }


def split(grid, w, title, desc, query):
    return {
        "type": "piechart", "title": title, "description": desc, "datasource": DB, "gridPos": grid.at(w, 8),
        "targets": [sql(query, series=False)],
        "options": {"pieType": "donut", "reduceOptions": {"values": True, "calcs": ["lastNotNull"], "fields": "/^count$/"},
                    "legend": {"displayMode": "table", "placement": "right", "values": ["value", "percent"]}, "displayLabels": []},
        "fieldConfig": {"defaults": {"unit": "short"}, "overrides": []},
    }


def app_data():
    g = Grid()
    panels = [
        text(g, 24, 3, "### RuMampu app data (local copy)\nReads a snapshot of `backend/db.sqlite3` taken by `refresh-db.sh`, never Neon. "
             "Only totals and counts are shown. Local data comes from test runs and sample scenarios, so it is not real user behaviour."),
        row(g, "Totals in the snapshot"),
        total(g, "Guest profiles", "SELECT COUNT(*) AS value FROM finance_guestprofile", "Every guest or account profile in the snapshot.", TEAL),
        total(g, "Accounts", "SELECT COUNT(*) AS value FROM auth_user WHERE is_superuser = 0", "Signed up accounts (admins left out).", VIOLET),
        total(g, "Active in the last 7 days", "SELECT COUNT(*) AS value FROM finance_guestprofile WHERE last_active_at >= datetime('now', '-7 days')", "Profiles used in the last 7 days.", GOLD),
        total(g, "Income entries", "SELECT COUNT(*) AS value FROM finance_incomeentry", "Every income entry.", TEAL),
        total(g, "Daily expenses", "SELECT COUNT(*) AS value FROM finance_expenseentry", "Every daily expense.", PINK),
        total(g, "House tests kept", "SELECT COUNT(*) AS value FROM housing_savedhousingtest", "Saved house tests.", ORANGE),
        row(g, "Activity per day"),
        per_day(g, 12, "New profiles per day", "Guests created and accounts signed up each day.",
                [day_series("finance_guestprofile", "created_at", "New guests"),
                 day_series("auth_user", "date_joined", "New accounts", "B", "is_superuser = 0")],
                {"New guests": TEAL, "New accounts": VIOLET}),
        per_day(g, 12, "Records added per day", "Income, daily expenses and work costs added each day.",
                [day_series("finance_incomeentry", "created_at", "Income"),
                 day_series("finance_expenseentry", "created_at", "Expenses", "B"),
                 day_series("finance_workcostentry", "created_at", "Work costs", "C")],
                {"Income": TEAL, "Expenses": PINK, "Work costs": ORANGE}),
        per_day(g, 12, "House tests per day", "House scenarios tested and tests kept each day.",
                [day_series("housing_housingscenario", "created_at", "Scenarios tested"),
                 day_series("housing_savedhousingtest", "created_at", "Tests kept", "B")],
                {"Scenarios tested": VIOLET, "Tests kept": ORANGE}),
        per_day(g, 12, "Income imports per day", "CSV statement imports started each day.",
                [day_series("finance_incomeimportbatch", "created_at", "Imports")], {"Imports": GOLD}),
        row(g, "How people use the app"),
        split(g, 8, "How income is entered", "Entry method of income entries (typed, scanned, imported, month totals).",
              "SELECT entry_method AS method, COUNT(*) AS count FROM finance_incomeentry GROUP BY entry_method ORDER BY count DESC"),
        split(g, 8, "How expenses are entered", "Entry method of daily expenses.",
              "SELECT entry_method AS method, COUNT(*) AS count FROM finance_expenseentry GROUP BY entry_method ORDER BY count DESC"),
        split(g, 8, "App language", "Language each profile chose.",
              "SELECT COALESCE(NULLIF(preferred_language, ''), 'not set') AS language, COUNT(*) AS count FROM finance_userappstate GROUP BY 1 ORDER BY count DESC"),
        total(g, "Finished onboarding", "SELECT COUNT(*) AS value FROM finance_userappstate WHERE onboarding_completed = 1", "Profiles that finished Get to know you.", TEAL),
        total(g, "Bought a home", "SELECT COUNT(*) AS value FROM finance_userappstate WHERE bought_home = 1", "Profiles that marked I have bought a home.", GOLD),
        total(g, "Income sources added", "SELECT COUNT(*) AS value FROM finance_incomesource WHERE is_custom = 1", "Custom income sources people added.", VIOLET),
        {
            "type": "table", "title": "House price model", "description": "Price model versions loaded for the Price Explorer.",
            "datasource": DB, "gridPos": g.at(12, 4),
            "targets": [sql("SELECT version AS Version, CASE is_active WHEN 1 THEN 'Active' ELSE '' END AS Status, strftime('%Y-%m-%d %H:%M', loaded_at, '+8 hours') AS \"Loaded (Malaysia time)\" "
                            "FROM housing_pricemodelversion ORDER BY loaded_at DESC LIMIT 5", series=False)],
            "fieldConfig": {"defaults": {}, "overrides": []},
        },
    ]
    return dashboard("rumampu-app-data", "RuMampu · App data (local copy)",
                     "Totals and daily activity from a local snapshot of the RuMampu database.", panels, "now-60d", "")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for name, dash in (("api-health.json", api_health()), ("app-data.json", app_data())):
        (OUT / name).write_text(json.dumps(dash, indent=2, ensure_ascii=False) + "\n")
        print("wrote", OUT / name)
