---
name: author-job-toml
description: Create or review publish_flow job TOML files. Use when Codex needs to author, validate, or explain job definitions for S3 jobs/, including report_type, type_name, purpose, analysis_targets, readiness_query, output_formats, and notification fields.
---

# Author Job TOML

Use this skill when working on job definition TOML files for `publish_flow`.

## 前提条件

- `docs/playbooks/job-authoring.md` を読む
- 対象レポートと readiness SQL が決まっている

## 実行順序

1. 必須項目をそろえる
2. `type_name` と `purpose` を slug で決める
3. `notification` を必要に応じて入れる
4. 出力先 prefix が期待どおりになるか確認する

## 具体例

```toml
job_id = "inventory-report-demo"
report_type = "inventory_report"
type_name = "inventory"
purpose = "monthly-summary"
analysis_targets = ["inventory_snapshot", "warehouse_delta"]
readiness_query = "SELECT target_id FROM readiness_inventory_demo"
output_formats = ["pptx"]

[notification]
to = ["inventory-team@example.com"]
subject = "Inventory Report"
```

## 判断基準

- 必須項目がそろっている
- `type_name` / `purpose` が日本語なしの slug になっている
- 出力先が `outputs/<type_name>/<purpose>/<job_id>/...` で一意に決まる

## 注意点

- `job_id` は再利用しない
- `output_formats` は現状 `pptx` を前提にする
