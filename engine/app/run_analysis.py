from __future__ import annotations

import argparse
import boto3
import json
import os
import shutil
import sys
import tomllib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from misc.pptx_utils import build_pptx_from_manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dummy analysis runner")
    parser.add_argument("--job", help="Local path to a job TOML file")
    parser.add_argument("--workspace", help="Workspace root")
    parser.add_argument("--output-root", default="outputs", help="Local output root")
    return parser.parse_args()


def load_job(path: Path) -> dict[str, Any]:
    return tomllib.loads(path.read_text(encoding="utf-8"))


def load_job_from_env(args: argparse.Namespace) -> tuple[dict[str, Any], str]:
    if args.job:
        path = Path(args.job).resolve()
        return load_job(path), str(path)

    job_bucket = os.environ.get("JOB_BUCKET")
    job_key = os.environ.get("JOB_KEY")
    if job_bucket and job_key:
        s3 = boto3.client("s3")
        payload = s3.get_object(Bucket=job_bucket, Key=job_key)["Body"].read().decode("utf-8")
        return tomllib.loads(payload), job_key

    raise SystemExit("A local job path or JOB_BUCKET/JOB_KEY pair is required")


def load_report_config(report_dir: Path) -> dict[str, Any]:
    return tomllib.loads((report_dir / "report.toml").read_text(encoding="utf-8"))


def detect_workspace_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).resolve()

    candidates = [
        Path.cwd().resolve(),
        Path.cwd().resolve().parent,
        ROOT,
    ]
    for candidate in candidates:
        if (candidate / "reports").exists() and (candidate / "misc").exists():
            return candidate
    return ROOT


def execute_notebook(notebook_path: Path, artifact_dir: Path, job_context_path: Path, workspace_root: Path) -> None:
    jupyter_root = artifact_dir.parent / ".jupyter-runtime"
    (jupyter_root / "ipython").mkdir(parents=True, exist_ok=True)
    (jupyter_root / "data").mkdir(parents=True, exist_ok=True)
    existing_pythonpath = os.environ.get("PYTHONPATH", "")
    pythonpath_parts = [str(workspace_root.resolve())]
    if existing_pythonpath:
        pythonpath_parts.append(existing_pythonpath)
    os.environ["ARTIFACT_DIR"] = str(artifact_dir)
    os.environ["JOB_CONTEXT_PATH"] = str(job_context_path)
    os.environ["IPYTHONDIR"] = str((jupyter_root / "ipython").resolve())
    os.environ["JUPYTER_DATA_DIR"] = str((jupyter_root / "data").resolve())
    os.environ["JUPYTER_PATH"] = str((jupyter_root / "data").resolve())
    os.environ["PYTHONPATH"] = os.pathsep.join(pythonpath_parts)
    notebook = nbformat.read(notebook_path, as_version=4)
    client = NotebookClient(notebook, timeout=300, kernel_name="python3")
    client.execute()


def upload_local_artifacts(
    job_id: str, artifact_dir: Path, rendered_dir: Path, output_root: Path
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    artifacts: list[dict[str, Any]] = []
    rendered_outputs: list[dict[str, Any]] = []

    artifact_target = output_root / job_id / "artifacts"
    rendered_target = output_root / job_id / "rendered"
    artifact_target.mkdir(parents=True, exist_ok=True)
    rendered_target.mkdir(parents=True, exist_ok=True)

    for path in sorted(artifact_dir.iterdir()):
        copied = artifact_target / path.name
        shutil.copy2(path, copied)
        artifacts.append(
            {
                "kind": path.suffix.lstrip("."),
                "label": path.stem.replace("_", " ").title(),
                "local_path": str(copied.resolve()),
                "s3_key": f"outputs/{job_id}/artifacts/{path.name}",
            }
        )

    for path in sorted(rendered_dir.iterdir()):
        copied = rendered_target / path.name
        shutil.copy2(path, copied)
        rendered_outputs.append(
            {
                "kind": path.suffix.lstrip("."),
                "label": path.stem.replace("_", " ").title(),
                "local_path": str(copied.resolve()),
                "s3_key": f"outputs/{job_id}/rendered/{path.name}",
            }
        )

    return artifacts, rendered_outputs


def upload_outputs_to_s3(bucket: str, prefix: str, artifacts: list[dict[str, Any]], rendered_outputs: list[dict[str, Any]], manifest_path: Path) -> None:
    s3 = boto3.client("s3")
    for artifact in artifacts:
        local_path = Path(artifact["local_path"])
        s3.upload_file(str(local_path), bucket, artifact["s3_key"])

    for rendered in rendered_outputs:
        local_path = Path(rendered["local_path"])
        s3.upload_file(str(local_path), bucket, rendered["s3_key"])

    s3.upload_file(str(manifest_path), bucket, f"{prefix}/manifest.json")


def build_presigned_url(bucket: str, rendered_outputs: list[dict[str, Any]], expires_in: int) -> tuple[str | None, str | None]:
    pptx_output = next((output for output in rendered_outputs if output["kind"] == "pptx"), None)
    if not pptx_output:
        return None, None

    s3 = boto3.client("s3")
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": pptx_output["s3_key"]},
        ExpiresIn=expires_in,
    )
    return pptx_output["s3_key"], url


def persist_job_state(
    job_key: str,
    manifest_s3_key: str,
    rendered_outputs: list[dict[str, Any]],
    pptx_s3_key: str | None,
    pptx_presigned_url: str | None,
    pptx_presigned_url_expires_at: str | None,
) -> None:
    table_name = os.environ.get("JOB_STATE_TABLE")
    if not table_name:
        return

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    expression_values: dict[str, Any] = {
        ":status": "completed",
        ":manifest_s3_key": manifest_s3_key,
        ":rendered_outputs": rendered_outputs,
    }
    update_expression = "SET #status = :status, manifest_s3_key = :manifest_s3_key, rendered_outputs = :rendered_outputs"

    if pptx_s3_key and pptx_presigned_url and pptx_presigned_url_expires_at:
        expression_values[":pptx_s3_key"] = pptx_s3_key
        expression_values[":pptx_presigned_url"] = pptx_presigned_url
        expression_values[":pptx_presigned_url_expires_at"] = pptx_presigned_url_expires_at
        update_expression += ", pptx_s3_key = :pptx_s3_key, pptx_presigned_url = :pptx_presigned_url, pptx_presigned_url_expires_at = :pptx_presigned_url_expires_at"

    table.update_item(
        Key={"job_key": job_key},
        UpdateExpression=update_expression,
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues=expression_values,
    )


def build_manifest(job: dict[str, Any], artifacts: list[dict[str, Any]], rendered_outputs: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "job_id": job["job_id"],
        "report_type": job["report_type"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "artifacts": artifacts,
        "rendered_outputs": rendered_outputs,
        "parameters": job.get("parameters", {}),
    }


def main() -> int:
    args = parse_args()
    workspace = detect_workspace_root(args.workspace)
    runtime_root = Path.cwd().resolve()
    job, job_reference = load_job_from_env(args)
    report_dir = workspace / "reports" / job["report_type"]
    report_config = load_report_config(report_dir)

    scratch_root = runtime_root / "tmp" / job["job_id"]
    artifact_dir = scratch_root / "artifacts"
    rendered_dir = scratch_root / "rendered"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    rendered_dir.mkdir(parents=True, exist_ok=True)

    job_context_path = scratch_root / "job_context.json"
    job_context_path.write_text(json.dumps(job, indent=2), encoding="utf-8")

    notebook_path = report_dir / report_config["notebook"]
    execute_notebook(notebook_path, artifact_dir, job_context_path, workspace)

    pptx_path = rendered_dir / f"{job['job_id']}.pptx"
    provisional_manifest = {
        "job_id": job["job_id"],
        "report_type": job["report_type"],
        "artifacts": [
            {
                "kind": path.suffix.lstrip("."),
                "label": path.stem.replace("_", " ").title(),
                "local_path": str(path.resolve()),
                "s3_key": f"outputs/{job['job_id']}/artifacts/{path.name}",
            }
            for path in sorted(artifact_dir.iterdir())
        ],
    }
    build_pptx_from_manifest(provisional_manifest, pptx_path)

    output_root = Path(args.output_root)
    if not output_root.is_absolute():
        output_root = runtime_root / output_root

    artifacts, rendered_outputs = upload_local_artifacts(job["job_id"], artifact_dir, rendered_dir, output_root)
    manifest = build_manifest(job, artifacts, rendered_outputs)
    manifest_path = output_root / job["job_id"] / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    output_bucket = os.environ.get("OUTPUT_BUCKET")
    output_prefix = os.environ.get("OUTPUT_PREFIX", f"outputs/{job['job_id']}")
    presigned_url_expires_in = int(os.environ.get("PRESIGNED_URL_EXPIRES_IN", "86400"))
    pptx_s3_key: str | None = None
    pptx_presigned_url: str | None = None
    pptx_presigned_url_expires_at: str | None = None
    if output_bucket:
        upload_outputs_to_s3(output_bucket, output_prefix, artifacts, rendered_outputs, manifest_path)
        pptx_s3_key, pptx_presigned_url = build_presigned_url(output_bucket, rendered_outputs, presigned_url_expires_in)
        if pptx_presigned_url:
            pptx_presigned_url_expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=presigned_url_expires_in)
            ).isoformat()

    persist_job_state(
        os.environ.get("JOB_KEY", job_reference),
        f"{output_prefix}/manifest.json",
        rendered_outputs,
        pptx_s3_key,
        pptx_presigned_url,
        pptx_presigned_url_expires_at,
    )

    print(json.dumps({"manifest": str(manifest_path), "report_type": job["report_type"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
