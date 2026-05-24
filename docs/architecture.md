# Architecture

## 概要

1. `jobs/` 配下に対応する S3 オブジェクトが作成されます。
2. EventBridge が Standard Step Functions ワークフローを起動します。
3. ワークフローは ECS Fargate 上で `check_readiness.py` を実行します。
4. データが未充足なら 3 時間待機し、最大 80 回まで再試行します。
5. 充足したら ECS Fargate 上で `run_analysis.py` を実行します。
6. 解析用 Notebook が PNG、HTML、CSV などの artifact を生成します。
7. engine がそれらを `outputs/<type_name>/<purpose>/<job_id>/artifacts/` に保存し、`manifest.json` を生成します。
8. engine が artifact から PPTX を作成し、`outputs/<type_name>/<purpose>/<job_id>/rendered/` に保存します。

## 設計上の前提

- Python コードは `uv` で管理します。
- Notebook 共有ヘルパーは `misc/` 配下に置きます。
- レポート Notebook は `reports/<report_type>/process.ipynb` に配置します。
- 待機は Step Functions の `Wait` 状態で持ち、ECS タスクは起動したままにしません。
- `type_name` と `purpose` は日本語を使わず、slug として運用します。
- readiness 判定は Athena の `readiness_query` を実行し、既定の workgroup は `primary` を使います。
