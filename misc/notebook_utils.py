from __future__ import annotations

import base64
import csv
import json
import os
from pathlib import Path
from typing import Any


_ONE_BY_ONE_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgN4L4rQAAAAASUVORK5CYII="
)


def artifact_dir_from_env() -> Path:
    path = Path(os.environ["ARTIFACT_DIR"]).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def job_context_from_env() -> dict[str, Any]:
    context_path = os.environ.get("JOB_CONTEXT_PATH")
    if not context_path:
        return {}
    return json.loads(Path(context_path).read_text(encoding="utf-8"))


def write_dummy_png(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_ONE_BY_ONE_PNG)
    return path


def write_dummy_html(path: Path, title: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    body = f"<html><body><h1>{title}</h1><p>dummy html artifact</p></body></html>"
    path.write_text(body, encoding="utf-8")
    return path


def write_dummy_csv(path: Path, rows: list[dict[str, Any]]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else ["value"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path

