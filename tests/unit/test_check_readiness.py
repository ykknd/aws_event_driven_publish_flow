from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.app.check_readiness import (
    load_task_size_profiles,
    select_task_size_profile,
)


def test_load_task_size_profiles_uses_defaults_when_env_is_missing(monkeypatch) -> None:
    monkeypatch.delenv("TASK_SIZE_PROFILES_JSON", raising=False)

    profiles = load_task_size_profiles()

    assert [profile["name"] for profile in profiles] == ["small", "medium", "large", "max"]
    assert profiles[0]["cpu"] == 4096
    assert profiles[-1]["memory_limit_mib"] == 106496


def test_select_task_size_profile_picks_expected_bucket() -> None:
    profiles = [
        {"name": "small", "max_targets": 5, "cpu": 4096, "memory_limit_mib": 30720},
        {"name": "medium", "max_targets": 20, "cpu": 8192, "memory_limit_mib": 61440},
        {"name": "large", "max_targets": 50, "cpu": 16384, "memory_limit_mib": 81920},
        {"name": "max", "cpu": 16384, "memory_limit_mib": 106496},
    ]

    assert select_task_size_profile(1, profiles)["name"] == "small"
    assert select_task_size_profile(12, profiles)["name"] == "medium"
    assert select_task_size_profile(40, profiles)["name"] == "large"
    assert select_task_size_profile(80, profiles)["name"] == "max"
