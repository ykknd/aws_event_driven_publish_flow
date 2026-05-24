# Job Authoring

## 目的

S3 の `jobs/` prefix に配置するジョブ TOML を正しく作成する。

## 前提

- 対象レポートの `report_type` が決まっている
- readiness 用の Athena SQL が用意できる
- 通知先と件名が決まっている

## 入力

- `job_id`
- `report_type`
- `type_name`
- `purpose`
- `analysis_targets`
- `readiness_query`
- `output_formats`
- `notification.to`
- `notification.subject`

## 必須項目

```toml
job_id = "inventory-report-demo"
report_type = "inventory_report"
type_name = "inventory"
purpose = "monthly-summary"
analysis_targets = ["inventory_snapshot", "warehouse_delta"]
readiness_query = "SELECT target_id FROM readiness_inventory_demo"
output_formats = ["pptx"]
```

## 任意項目

```toml
[parameters]
title = "Inventory Report"

[notification]
to = ["inventory-team@example.com"]
subject = "Inventory Report"
```

## 運用ルール

- `job_id` はジョブごとに一意にする
- `type_name` と `purpose` は日本語を使わず slug にする
- 許可文字は英小文字、数字、`-`、`_` を基本にする
- `output_formats` は現状 `pptx` を前提にする

## 出力先

成果物は次に保存される。

```text
outputs/<type_name>/<purpose>/<job_id>/artifacts/...
outputs/<type_name>/<purpose>/<job_id>/rendered/...
outputs/<type_name>/<purpose>/<job_id>/manifest.json
```

## 期待結果

- readiness 用 Athena SQL と通知情報を含む TOML が作れる
- `type_name` / `purpose` / `job_id` から出力 prefix が一意に決まる

## 失敗時の見方

- 同じ `job_id` を使うと成果物の衝突や追跡の混乱が起きる
- `type_name` / `purpose` に日本語や空白を入れると運用上扱いづらくなる
- `notification` 未指定時の通知方針は運用で明確化しておく
