from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from misc.notebook_utils import write_dummy_png
from misc.pptx_utils import build_pptx_from_manifest


def test_build_pptx_from_manifest(tmp_path: Path) -> None:
    image_path = write_dummy_png(tmp_path / "artifact.png")
    manifest = {
        "job_id": "demo-job",
        "report_type": "inventory_report",
        "artifacts": [
            {
                "kind": "png",
                "label": "Artifact",
                "local_path": str(image_path),
                "s3_key": "outputs/demo-job/artifacts/artifact.png",
            }
        ],
    }

    output_path = build_pptx_from_manifest(manifest, tmp_path / "demo.pptx")
    assert output_path.exists()
    assert output_path.stat().st_size > 0

