---
name: debug-failures
description: Troubleshoot publish_flow failures. Use when Codex needs to investigate readiness misses, give-up flows, SES notification failures, private subnet reachability issues, Athena query problems, or S3 VPC endpoint restrictions.
---

# Debug Failures

Use this skill when the pipeline does not behave as expected.

## 前提条件

- `docs/playbooks/troubleshooting.md` を読む

## 実行順序

1. 症状を `readiness`, `analysis`, `notification`, `network`, `output` のどこかに分類する
2. `TOML`、`DynamoDB`、`Step Functions`、`CloudWatch Logs` を順に確認する
3. 必要なら Athena、S3 VPCE、SES sender を確認する

## 重点確認箇所

- `readiness_query`
- `missing_targets_text`
- `task_size_profile`
- `notification.to`
- `notification.subject`
- `outputs/<type_name>/<purpose>/<job_id>/...`

## 判断基準

- どのサービス境界で失敗しているかを切り分けられる
- 設定値かコードか運用データかを区別できる

## 注意点

- SES sandbox や sender verify 漏れは通知失敗の典型
- private subnet からの到達性は S3, SES, Athena それぞれ別に確認する
