---
name: run-local-checks
description: Run local validation flows for publish_flow. Use when Codex needs to verify that infra, engine, and sample jobs still work locally by running build, synth, tests, readiness checks, or dummy analysis commands.
---

# Run Local Checks

Use this skill to validate the repository locally before or after changes.

## 前提条件

- `docs/playbooks/local-validation.md` を読む
- 依存関係が入っている

## 実行順序

1. `infra` を build する
2. `cdk synth` を実行する
3. Python unit test を実行する
4. sample TOML で readiness と analysis を確認する

## 具体コマンド

```bash
cd infra
npm run build
npx cdk synth -c stage=staging

cd ../engine
uv run pytest ../tests/unit

cd ..
set SIMULATED_AVAILABLE_TARGETS=inventory_snapshot,warehouse_delta
uv run --project engine python engine/app/check_readiness.py --job jobs/examples/inventory_report.toml
uv run --project engine python engine/app/run_analysis.py --job jobs/examples/inventory_report.toml
```

## 判断基準

- build / synth / pytest が通る
- readiness が実行できる
- `outputs/<type_name>/<purpose>/<job_id>/...` に成果物が出る

## 注意点

- Athena を実際に使う場合は workgroup と output location の設定も確認する
