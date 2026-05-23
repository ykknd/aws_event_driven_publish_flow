# Job fields

- `job_id`: ワークフロー実行を一意に識別する ID
- `report_type`: `reports/` 配下のレポートディレクトリ名
- `analysis_targets`: Athena readiness 判定結果に含まれるべき対象一覧
- `readiness_query`: `check_readiness.py` が実行する Athena SQL
- `output_formats`: 出力形式一覧。現状は `pptx`
- `parameters`: レポート設定用の自由形式テーブル
