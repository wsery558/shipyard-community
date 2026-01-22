#!/usr/bin/env bash
set -euo pipefail

# This script audits Markdown files for dead external links and missing internal targets.
repo_root="$(pwd)"
report_dir="$repo_root/reports"
external_report="$report_dir/link_audit_external.tsv"
internal_report="$report_dir/link_audit_internal.tsv"
mkdir -p "$report_dir"

printf 'url\tstatus\tsource\n' > "$external_report"
printf 'source\tlink\n' > "$internal_report"

declare -A seen_external=()
external_fail=0
internal_fail=0
python_cmd="${PYTHON:-python3}"

mapfile -t link_entries < <($python_cmd - <<'PY'
from pathlib import Path
import re

files = [Path("README.md")]
files.extend(sorted(Path("docs").rglob("*.md")))
pattern_inline = re.compile(r'\[[^\]]*\]\(([^)]+)\)')
pattern_ref = re.compile(r'^\s*\[[^\]]+\]:\s*(\S+)', re.MULTILINE)

for path in files:
    if not path.exists():
        continue
    text = path.read_text(errors="ignore")
    seen = set()
    for pattern in (pattern_inline, pattern_ref):
        for match in pattern.finditer(text):
            url = match.group(1).strip()
            if not url:
                continue
            if url in seen:
                continue
            seen.add(url)
            print(f"{path}\t{url}")
PY
)

for entry in "${link_entries[@]}"; do
  IFS=$'\t' read -r source url <<< "$entry"
  # Skip empty links and anchors/mailto
  cleaned="${url%%#*}"
  cleaned="${cleaned//$'\r'/}"
  cleaned="${cleaned//$'\n'/}"
  cleaned="${cleaned%)}"
  if [[ -z "$cleaned" || "$cleaned" == "#" ]]; then
    continue
  fi
  if [[ "$cleaned" == mailto:* || "$cleaned" == javascript:* ]]; then
    continue
  fi

  if [[ "$cleaned" =~ ^https?:// ]]; then
    if [[ "$cleaned" =~ localhost|127\.0\.0\.1|0\.0\.0\.0 ]]; then
      continue
    fi
    if [[ -n "${seen_external[$cleaned]:-}" ]]; then
      continue
    fi
    seen_external[$cleaned]=1

    if http_code=$(curl -s -S -L -I -o /dev/null -w '%{http_code}' --max-time 15 "$cleaned"); then
      status="$http_code"
    else
      status="curl-fail"
    fi

    if [[ "$status" =~ ^[0-9]+$ && "$status" -lt 400 ]]; then
      continue
    fi

    echo -e "$cleaned\t$status\t$source" >> "$external_report"
    external_fail=$((external_fail + 1))
  else
    if [[ "$cleaned" == /* ]]; then
      target="${cleaned#/}"
      target="${target#./}"
      if [[ -n "$target" && -e "$target" ]]; then
        continue
      fi
    else
      base_dir="$(dirname "$source")"
      target="$base_dir/$cleaned"
      target="${target#./}"
      if [[ -n "$target" && -e "$target" ]]; then
        continue
      fi
      candidate="${cleaned#./}"
      if [[ -n "$candidate" && -e "$candidate" ]]; then
        continue
      fi
    fi
    echo -e "$source\t$cleaned" >> "$internal_report"
    internal_fail=$((internal_fail + 1))
  fi
done

if [[ $internal_fail -gt 0 || $external_fail -gt 0 ]]; then
  echo "Link audit failed: $internal_fail missing internal link(s), $external_fail bad external link(s)"
  [[ $internal_fail -gt 0 ]] && cat "$internal_report"
  [[ $external_fail -gt 0 ]] && cat "$external_report"
  exit 1
fi

echo "Link audit passed (internal: $internal_fail, external: $external_fail)."
