# Jobs

このディレクトリにはジョブ定義のサンプルと簡易仕様を置きます。

- `examples/`: 実行サンプル用の TOML
- `schema/`: 想定するジョブ項目のメモ

ジョブ TOML では、少なくとも `job_id`, `report_type`, `type_name`, `purpose`, `analysis_targets`, `readiness_query`, `output_formats` を定義します。

成果物は `outputs/<type_name>/<purpose>/<job_id>/...` に保存されるため、`type_name` と `purpose` は日本語を使わず slug として運用します。
