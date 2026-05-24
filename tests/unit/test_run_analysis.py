from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.app.run_analysis import build_manifest, build_output_prefix


def test_build_output_prefix_uses_type_name_purpose_and_job_id() -> None:
    job = {
        "job_id": "inventory-report-demo",
        "report_type": "inventory_report",
        "type_name": "inventory",
        "purpose": "monthly-summary",
    }

    assert build_output_prefix(job) == "outputs/inventory/monthly-summary/inventory-report-demo"


def test_build_manifest_includes_type_name_and_purpose() -> None:
    job = {
        "job_id": "inventory-report-demo",
        "report_type": "inventory_report",
        "type_name": "inventory",
        "purpose": "monthly-summary",
        "parameters": {"title": "Inventory Report"},
    }

    manifest = build_manifest(job, [], [])

    assert manifest["type_name"] == "inventory"
    assert manifest["purpose"] == "monthly-summary"
    assert manifest["parameters"]["title"] == "Inventory Report"
