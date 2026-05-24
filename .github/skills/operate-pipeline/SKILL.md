---
name: operate-pipeline
description: Operate the publish_flow pipeline end to end. Use when Codex needs to describe or verify the normal runtime flow from uploading a job TOML to S3, through Step Functions and ECS execution, to checking outputs and SES notifications.
---

# Operate Pipeline

Use this skill for normal pipeline operation and run confirmation.

## 前提条件

- `docs/playbooks/pipeline-operations.md` を読む
- ジョブ TOML とデプロイ済み環境がある

## 実行順序

1. TOML を `jobs/` prefix に置く
2. Step Functions 実行を確認する
3. readiness の結果を見る
4. analysis タスクの起動を確認する
5. S3 出力と SES 通知を確認する

## 重点確認箇所

- `jobs/<job-file>.toml`
- Step Functions 実行履歴
- DynamoDB のジョブ状態
- `outputs/<type_name>/<purpose>/<job_id>/...`
- SES 通知

## 判断基準

- readiness 未充足時は retry に進む
- readiness 充足時は analysis が起動する
- artifact / rendered / manifest が保存される
- 成功通知に presigned URL が入る

## 注意点

- `type_name` / `purpose` / `job_id` の組み合わせで出力先を追う
- 3 時間待機は Step Functions の Wait であり、ECS タスクは保持されない
