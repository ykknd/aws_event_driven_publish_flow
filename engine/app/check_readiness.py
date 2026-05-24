from __future__ import annotations

import argparse
import boto3
import json
import os
import time
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_TASK_SIZE_PROFILES = [
    {"name": "small", "max_targets": 5, "cpu": 4096, "memory_limit_mib": 30720},
    {"name": "medium", "max_targets": 20, "cpu": 8192, "memory_limit_mib": 61440},
    {"name": "large", "max_targets": 50, "cpu": 16384, "memory_limit_mib": 81920},
    {"name": "max", "cpu": 16384, "memory_limit_mib": 106496},
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Dummy readiness checker")
    parser.add_argument("--job", help="Local path to a job TOML file")
    parser.add_argument("--output", help="Local path for the readiness JSON output")
    return parser.parse_args()


def load_job(args: argparse.Namespace) -> tuple[dict[str, Any], str]:
    if args.job:
        path = Path(args.job)
        return tomllib.loads(path.read_text(encoding="utf-8")), str(path)

    job_bucket = os.environ.get("JOB_BUCKET")
    job_key = os.environ.get("JOB_KEY")
    if job_bucket and job_key:
        s3 = boto3.client("s3")
        payload = s3.get_object(Bucket=job_bucket, Key=job_key)["Body"].read().decode("utf-8")
        return tomllib.loads(payload), job_key

    job_path = os.environ.get("JOB_PATH")
    if job_path:
        path = Path(job_path)
        return tomllib.loads(path.read_text(encoding="utf-8")), str(path)

    raise SystemExit("A local job path is required for the dummy readiness checker")


def simulated_available_targets(job: dict[str, Any]) -> list[str]:
    targets_env = os.environ.get("SIMULATED_AVAILABLE_TARGETS")
    if not targets_env:
        return execute_athena_readiness_query(job)
    return [item.strip() for item in targets_env.split(",") if item.strip()]


def execute_athena_readiness_query(job: dict[str, Any]) -> list[str]:
    readiness_query = job.get("readiness_query", "").strip()
    if not readiness_query:
        return []

    athena = boto3.client("athena")
    start_query_kwargs: dict[str, Any] = {
        "QueryString": readiness_query,
        "WorkGroup": os.environ.get("ATHENA_WORKGROUP", "primary"),
    }

    athena_output_location = os.environ.get("ATHENA_OUTPUT_LOCATION")
    if athena_output_location:
        start_query_kwargs["ResultConfiguration"] = {"OutputLocation": athena_output_location}

    response = athena.start_query_execution(**start_query_kwargs)
    query_execution_id = response["QueryExecutionId"]

    while True:
        execution = athena.get_query_execution(QueryExecutionId=query_execution_id)
        state = execution["QueryExecution"]["Status"]["State"]
        if state == "SUCCEEDED":
            break
        if state in {"FAILED", "CANCELLED"}:
            reason = execution["QueryExecution"]["Status"].get("StateChangeReason", "unknown Athena error")
            raise RuntimeError(f"Athena readiness query {state.lower()}: {reason}")
        time.sleep(1)

    paginator = athena.get_paginator("get_query_results")
    target_ids: list[str] = []
    header_skipped = False
    for page in paginator.paginate(QueryExecutionId=query_execution_id):
        for row in page["ResultSet"]["Rows"]:
            values = [column.get("VarCharValue", "") for column in row.get("Data", [])]
            if not header_skipped:
                header_skipped = True
                continue
            if values and values[0]:
                target_ids.append(values[0])

    return target_ids


def load_task_size_profiles() -> list[dict[str, Any]]:
    payload = os.environ.get("TASK_SIZE_PROFILES_JSON")
    if not payload:
        return DEFAULT_TASK_SIZE_PROFILES

    raw_profiles = json.loads(payload)
    profiles: list[dict[str, Any]] = []
    for profile in raw_profiles:
        normalized = {
            "name": profile["name"],
            "cpu": int(profile["cpu"]),
            "memory_limit_mib": int(profile["memoryLimitMiB"]),
        }
        if "maxTargets" in profile and profile["maxTargets"] is not None:
            normalized["max_targets"] = int(profile["maxTargets"])
        profiles.append(normalized)
    return profiles


def select_task_size_profile(target_count: int, profiles: list[dict[str, Any]]) -> dict[str, Any]:
    for profile in profiles:
        max_targets = profile.get("max_targets")
        if max_targets is None or target_count <= max_targets:
            return profile
    return profiles[-1]


def write_local_output(result: dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")


def persist_status(result: dict[str, Any]) -> None:
    table_name = os.environ.get("JOB_STATE_TABLE")
    if not table_name:
        return

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    item: dict[str, Any] = {
        "job_key": result["job_key"],
        "job_id": result["job_id"],
        "report_type": result["report_type"],
        "type_name": result["type_name"],
        "purpose": result["purpose"],
        "ready": result["ready"],
        "missing_targets": result["missing_targets"],
        "missing_targets_text": result["missing_targets_text"],
        "checked_at": result["checked_at"],
        "retry_count": result["retry_count"],
        "readiness_query": result["readiness_query"],
        "notification_subject": result["notification_subject"],
        "analysis_target_count": result["analysis_target_count"],
        "task_size_profile": result["task_size_profile"],
        "task_cpu": result["task_cpu"],
        "task_memory_limit_mib": result["task_memory_limit_mib"],
        "output_prefix": result["output_prefix"],
    }

    if result["notification_to"]:
        item["notification_to"] = set(result["notification_to"])

    table.put_item(Item=item)


def main() -> int:
    args = parse_args()
    job, job_path = load_job(args)

    expected_targets = list(job.get("analysis_targets", []))
    available_targets = simulated_available_targets(job)
    missing_targets = [target for target in expected_targets if target not in available_targets]
    task_size_profiles = load_task_size_profiles()
    selected_task_size = select_task_size_profile(len(expected_targets), task_size_profiles)
    notification = job.get("notification", {})
    notification_to = list(notification.get("to", []))
    notification_subject = notification.get("subject", job["job_id"])

    result = {
        "job_id": job["job_id"],
        "job_key": os.environ.get("JOB_KEY", job_path),
        "report_type": job["report_type"],
        "type_name": job["type_name"],
        "purpose": job["purpose"],
        "ready": not missing_targets,
        "missing_targets": missing_targets,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "retry_count": int(os.environ.get("RETRY_COUNT", "0")),
        "readiness_query": job.get("readiness_query", ""),
        "missing_targets_text": ", ".join(missing_targets) if missing_targets else "none",
        "notification_to": notification_to,
        "notification_subject": notification_subject,
        "analysis_target_count": len(expected_targets),
        "task_size_profile": selected_task_size["name"],
        "task_cpu": selected_task_size["cpu"],
        "task_memory_limit_mib": selected_task_size["memory_limit_mib"],
        "output_prefix": f"outputs/{job['type_name']}/{job['purpose']}/{job['job_id']}",
    }

    output_path = Path(args.output or os.environ.get("READINESS_OUTPUT_PATH", "tmp/readiness.json"))
    write_local_output(result, output_path)
    persist_status(result)

    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
