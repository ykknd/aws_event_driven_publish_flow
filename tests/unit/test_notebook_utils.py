from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from misc.notebook_utils import write_dummy_csv, write_dummy_html, write_dummy_png


def test_dummy_artifacts_are_created(tmp_path: Path) -> None:
    png_path = write_dummy_png(tmp_path / "chart.png")
    html_path = write_dummy_html(tmp_path / "snippet.html", "Demo")
    csv_path = write_dummy_csv(tmp_path / "table.csv", [{"value": 1}])

    assert png_path.exists()
    assert png_path.read_bytes().startswith(b"\x89PNG")
    assert "Demo" in html_path.read_text(encoding="utf-8")
    assert "value" in csv_path.read_text(encoding="utf-8")

