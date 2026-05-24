# Job TOML Spec

## 必須項目

- `job_id`: ジョブを一意に識別する ID
- `report_type`: `reports/` 配下のレポートディレクトリ名
- `analysis_targets`: readiness 判定でそろっているべき対象一覧
- `readiness_query`: readiness 用に実行する Athena SQL
- `output_formats`: 出力形式一覧

## 任意項目

- `parameters`: レポート固有の追加パラメータ
- `notification.to`: 通知先メールアドレス一覧
- `notification.subject`: 通知メールの件名

## Fargate サイズ制御

- Fargate の `vCPU` / `memory` は TOML の `analysis_targets` 件数から自動判定されます
- 現在の既定値は次です
  - `small`: 1-5 件, `4 vCPU / 30 GiB`
  - `medium`: 6-20 件, `8 vCPU / 60 GiB`
  - `large`: 21-50 件, `16 vCPU / 80 GiB`
  - `max`: 51 件以上, `16 vCPU / 104 GiB`
- 判定は `check_readiness.py` で行い、Step Functions が対応する解析用 task definition を選択します

## 例

```toml
job_id = "inventory-report-demo"
report_type = "inventory_report"
analysis_targets = ["inventory_snapshot", "warehouse_delta"]
readiness_query = "SELECT target_id FROM readiness_inventory_demo"
output_formats = ["pptx"]

[parameters]
title = "Inventory Report"

[notification]
to = ["inventory-team@example.com"]
subject = "Inventory Report"
```
