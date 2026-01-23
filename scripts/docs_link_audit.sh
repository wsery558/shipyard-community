#!/usr/bin/env bash
set -euo pipefail

REPORT_DIR="reports"
mkdir -p "$REPORT_DIR"
EXTERNAL_REPORT="$REPORT_DIR/link_audit_external.tsv"
INTERNAL_REPORT="$REPORT_DIR/link_audit_internal.tsv"

python3 - <<'PY'
import pathlib
import re
import shlex
import subprocess
import urllib.parse

BASE = pathlib.Path('.')
FILES = [BASE / 'README.md'] + sorted(BASE.glob('docs/**/*.md'))
LINK_RE = re.compile(r'\[[^\]]*\]\(([^)]+)\)')
EXTERNAL = []
INTERNAL = []
EXTERNAL_REPORT = BASE / 'reports/link_audit_external.tsv'
INTERNAL_REPORT = BASE / 'reports/link_audit_internal.tsv'

for path in FILES:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8', errors='ignore')
    for match in LINK_RE.finditer(text):
        target = match.group(1).strip()
        if not target or target.startswith('mailto:'):
            continue
        target = target.split('#', 1)[0]
        if not target:
            continue
        if target.startswith(('http://', 'https://')):
            parsed = urllib.parse.urlparse(target)
            host = parsed.hostname or ''
            if host in ('localhost', '127.0.0.1', '0.0.0.0'):
                continue
            EXTERNAL.append((target, str(path)))
        else:
            candidate = (path.parent / target).resolve()
            try:
                base = BASE.resolve()
            except Exception:
                base = BASE
            if not str(candidate).startswith(str(base)):
                if not candidate.exists():
                    INTERNAL.append((str(path), target))
            elif not candidate.exists():
                INTERNAL.append((str(path), target))


def check_external(url):
    try:
        result = subprocess.run(
            ['curl', '--head', '--silent', '--show-error', '--fail', '--max-time', '10', url],
            capture_output=True,
            text=True,
            check=True,
        )
        code = 0
        for line in (result.stderr or '').splitlines() + (result.stdout or '').splitlines():
            if line.startswith('HTTP/'):  # parse HTTP status
                parts = line.split()
                if len(parts) >= 2 and parts[1].isdigit():
                    code = int(parts[1])
        return code or 200
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr or ''
        stdout = exc.stdout or ''
        for line in stderr.splitlines() + stdout.splitlines():
            if line.startswith('HTTP/'):
                parts = line.split()
                if len(parts) >= 2 and parts[1].isdigit():
                    return int(parts[1])
        return 'ERR'
    except Exception:
        return 'ERR'

EXTERNAL_BAD = []
seen = set()
for url, source in EXTERNAL:
    if url in seen:
        continue
    seen.add(url)
    status = check_external(url)
    if isinstance(status, int) and status < 400:
        continue
    EXTERNAL_BAD.append((url, status, source))

with open(INTERNAL_REPORT, 'w', encoding='utf-8') as fh:
    fh.write('source\tlink\n')
    for source, link in INTERNAL:
        fh.write(f"{source}\t{link}\n")

with open(EXTERNAL_REPORT, 'w', encoding='utf-8') as fh:
    fh.write('url\tstatus\tsource\n')
    for url, status, source in EXTERNAL_BAD:
        fh.write(f"{url}\t{status}\t{source}\n")

print(f"docs_link_audit: {len(INTERNAL)} missing internal links and {len(EXTERNAL_BAD)} external failures")
if EXTERNAL_BAD:
    print('External BAD links:')
    for url, status, source in EXTERNAL_BAD:
        print(f"  {url} -> {status} referenced in {source}")
PY
