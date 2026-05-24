---
name: swap-in-real-assets
description: Replace the publish_flow dummy assets with real implementation assets. Use when Codex needs to swap in the production readiness script, analysis runner, notebooks, Dockerfile, or templates while preserving the current interfaces and output conventions.
---

# Swap In Real Assets

Use this skill when replacing dummy implementation files with production assets.

## 前提条件

- `docs/playbooks/troubleshooting.md` の既存資産差し替え観点も確認する
- 現行の interface を壊さない方針で進める

## 実行順序

1. `check_readiness.py` の I/O 契約を確認する
2. `run_analysis.py` と Notebook の責務境界を確認する
3. 既存 Notebook と Dockerfile を差し替える
4. `manifest.json` と出力 prefix 規約が維持されているか確認する

## 重点確認箇所

- `engine/app/check_readiness.py`
- `engine/app/run_analysis.py`
- `reports/<report_type>/process.ipynb`
- `engine/Dockerfile`
- `outputs/<type_name>/<purpose>/<job_id>/...`

## 判断基準

- 既存資産に差し替えても Step Functions 側の前提が変わらない
- artifact / manifest / rendered output の構造が維持される

## 注意点

- Notebook から `misc/` を import できる前提を壊さない
- Athena readiness、SES 通知、S3 出力先規約は維持する
