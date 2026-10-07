"""Configure only the isolated migration project; never mutate the live project."""
import json
import os
from pathlib import Path
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

ACCOUNT = "2ac862d7c1f865935d185df59e7bd719"
PROJECT = "auxesis-migration-preview"
BRANCH = "codex/cloudflare-backend-migration"
DATABASE = "34a9449d-85ee-4f06-a55d-3485905ca64e"
GOOGLE_KEYS = ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_API_KEY", "GOOGLE_APP_ID")
BASE = "https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(NoRedirect())


def require(condition, message):
    if not condition:
        raise SystemExit(message)


def api(path, method="GET", body=None, missing_ok=False):
    allowed_write = (method == "POST" and path == "/pages/projects" and
                     isinstance(body, dict) and body.get("name") == PROJECT)
    # The sole D1 POST is an explicitly read-only schema query.
    schema_read = path == "/d1/database/" + DATABASE + "/query" and body == {
        "sql": "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    }
    require(method == "GET" or allowed_write or schema_read, "Write target is outside the pilot.")
    request = urllib.request.Request(BASE + path, method=method,
        headers={"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"], "Content-Type": "application/json"},
        data=json.dumps(body).encode() if body is not None else None)
    try:
        with opener.open(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as error:
        if missing_ok and error.code == 404:
            return None
        raise SystemExit(f"Cloudflare {method} {path}: HTTP {error.code}; response omitted.") from None
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise SystemExit("Cloudflare request failed; credentials and response omitted.") from None
    require(payload.get("success"), "Cloudflare rejected the request; response omitted.")
    return payload.get("result")


def live_snapshot():
    project = api("/pages/projects/auxesis-education")
    require(project.get("production_branch") == "main", "Unexpected live production branch.")
    configs = project.get("deployment_configs") or {}
    for config in configs.values():
        require(DATABASE not in [x.get("id") for x in (config.get("d1_databases") or {}).values()],
                "Pilot database is already attached to the shared live project; stop for review.")
    return {"deployment_configs": configs, "source": project.get("source"),
            "production_branch": project.get("production_branch"),
            "canonical_deployment": (project.get("canonical_deployment") or {}).get("id")}


def validate_pilot(project):
    require(project.get("name") == PROJECT and project.get("production_branch") == "main",
            "Unexpected pilot project identity.")
    require(not project.get("source"), "Pilot project has an unexpected Git integration.")
    production = (project.get("deployment_configs") or {}).get("production") or {}
    require(not production.get("d1_databases") and not production.get("env_vars"),
            "Pilot project unexpectedly has production bindings or credentials.")
    require(not project.get("canonical_deployment"), "Pilot project has a production deployment; stop for review.")


def report(lines):
    print("\n".join(lines))
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as output:
        output.write("\n## Isolated Cloudflare pilot\n\n" + "\n".join("- " + line for line in lines) + "\n")


def configure(snapshot_file):
    before = live_snapshot()
    snapshot_file.write_text(json.dumps(before))
    snapshot_file.chmod(0o600)
    db = api("/d1/database/" + DATABASE)
    require(db.get("name") == PROJECT, "Existing pilot database name does not match.")
    result = api("/d1/database/" + DATABASE + "/query", "POST", {
        "sql": "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"})
    tables = {row["name"] for item in result for row in item.get("results", [])}
    require({"portal_records", "portal_sessions", "google_connections", "portal_operations"} <= tables,
            "The existing database is missing required migration tables.")
    project = api("/pages/projects/" + PROJECT, missing_ok=True)
    if project is not None:
        validate_pilot(project)
    preview = ((project or {}).get("deployment_configs") or {}).get("preview") or {}
    bindings = preview.get("d1_databases") or {}
    require(not bindings or bindings == {"PORTAL_DB": {"id": DATABASE}}, "Unexpected pilot bindings.")
    variables = dict(preview.get("env_vars") or {})
    constants = {
        "MIGRATION_PREVIEW_ONLY": "true", "ADMIN_EMAIL": "adsouza35@gmail.com",
        "PILOT_STUDENT_ID": "5febba2d-82ee-5585-805f-a3fc5e89f803", "PILOT_STUDENT_NAME": "Andie Ng",
        "GOOGLE_SPREADSHEET_ID": "1UrdpPD4AWU1H1Ok7Txb-sL1hIXoIEVN8u--8fZqXwUQ",
        "GOOGLE_CALENDAR_ID": "classroom107924035776692772286@group.calendar.google.com",
        "PILOT_SERIES_IDS": "60r3iohi6oq68b9o6srj6b9k61h62b9p70oj4b9m6lijicb4ckqmae9mco,c5h36dph71gmabb5c5gj6b9k68sj8bb1cko3gb9n6ssj6c9n70om6opn68",
    }
    variables.update({key: {"type": "plain_text", "value": value} for key, value in constants.items()})
    for key in GOOGLE_KEYS:
        if os.environ.get(key):
            variables[key] = {"type": "secret_text", "value": os.environ[key]}
    if "PORTAL_TOKEN_KEY" not in variables:
        variables["PORTAL_TOKEN_KEY"] = {"type": "secret_text", "value": secrets.token_urlsafe(48)}
    config = {"compatibility_date": "2026-10-07", "d1_databases": {"PORTAL_DB": {"id": DATABASE}}, "env_vars": variables}
    if project is None:
        api("/pages/projects", "POST", {"name": PROJECT, "production_branch": "main",
            "deployment_configs": {"preview": config, "production": {"env_vars": {}, "d1_databases": {}}}})
    else:
        # Existing encrypted values cannot safely be recovered from a GET.
        # Reuse the configured project without rewriting or rotating secrets.
        require(bindings == {"PORTAL_DB": {"id": DATABASE}}, "Existing pilot is missing its D1 binding.")
        require("PORTAL_TOKEN_KEY" in preview.get("env_vars", {}), "Existing pilot is missing its encryption key.")
        require(all((preview.get("env_vars", {}).get(k) or {}).get("value") == v for k, v in constants.items()),
                "Existing pilot constants differ from the approved configuration.")
    configured = api("/pages/projects/" + PROJECT)
    validate_pilot(configured)
    require(live_snapshot() == before, "Live project changed during setup; stop and inspect.")
    configured_preview = configured["deployment_configs"]["preview"]
    require(configured_preview["d1_databases"]["PORTAL_DB"]["id"] == DATABASE, "Pilot D1 binding did not persist.")
    missing = [key for key in GOOGLE_KEYS if key not in configured_preview.get("env_vars", {})]
    report(["Existing database reused and bound to isolated preview project.",
            "Live project settings and production deployment: unchanged.",
            "Google setup still required: " + (", ".join(missing) if missing else "none; administrator consent remains to be tested.")])


def smoke(url, path, expected, headers=None, method="GET", body=None):
    request = urllib.request.Request(url + path, method=method, headers=headers or {}, data=body)
    try:
        with opener.open(request, timeout=30) as response:
            status = response.status
    except urllib.error.HTTPError as error:
        status = error.code
    require(status == expected, f"Pilot smoke check {path}: expected {expected}, received {status}.")


def verify(snapshot_file):
    require(live_snapshot() == json.loads(snapshot_file.read_text()), "Live configuration or production deployment changed.")
    project = api("/pages/projects/" + PROJECT)
    validate_pilot(project)
    deployments = api("/pages/projects/" + PROJECT + "/deployments?per_page=10")
    matches = [d for d in deployments if ((d.get("deployment_trigger") or {}).get("metadata") or {}).get("branch") == BRANCH
               and ((d.get("deployment_trigger") or {}).get("metadata") or {}).get("commit_hash") == os.environ["GITHUB_SHA"]]
    require(matches, "No deployment matches the exact migration branch and commit.")
    deployment = matches[0]
    require(deployment.get("environment") == "preview" and (deployment.get("latest_stage") or {}).get("status") == "success",
            "Pilot deployment is not a successful preview.")
    url = deployment["url"]
    require(url.startswith("https://") and urllib.parse.urlparse(url).hostname.endswith("." + PROJECT + ".pages.dev"), "Unexpected deployment URL.")
    smoke(url, "/portal/", 200)
    # A correctly shaped but nonexistent session exercises the real D1 binding without writing records.
    smoke(url, "/api/portal/state", 401, {"Cookie": "__Host-auxesis_session=" + "A" * 43})
    smoke(url, "/api/portal/sync", 403, {"Origin": "https://invalid.example", "Content-Type": "application/json"}, "POST", b'{"mode":"apply"}')
    aliases = [a for a in deployment.get("aliases", []) if a.endswith("." + PROJECT + ".pages.dev")]
    report(["Deployed migration commit: " + os.environ["GITHUB_SHA"], "Pilot URL: " + url,
            "Pilot aliases: " + ", ".join(aliases),
            "Live D1 query via portal session lookup: passed (401 for nonexistent session).",
            "Cross-origin apply rejection: passed (403).",
            "Live project settings and production deployment: unchanged.",
            "Google-authenticated Andie sync and repeat-sync: NOT RUN until Google setup and consent are complete."])


if __name__ == "__main__":
    require(os.environ.get("GITHUB_REPOSITORY") == "Amandadsouza77/auxesis-education" and
            os.environ.get("GITHUB_REF") == "refs/heads/" + BRANCH, "This workflow may only run on the existing migration branch.")
    require(os.environ.get("CLOUDFLARE_API_TOKEN"), "Protected preview Cloudflare credential is missing.")
    snapshot_file = Path(os.environ["RUNNER_TEMP"]) / "auxesis-live-before.json"
    {"configure": configure, "verify": verify}[sys.argv[1]](snapshot_file)
