# Job fields

- `job_id`: ワークフロー実行を一意に識別する ID
- `report_type`: `reports/` 配下のレポートディレクトリ名
- `type_name`: 成果物のカテゴリ。`outputs/<type_name>/...` に使う slug
- `purpose`: 解析目的。`outputs/<type_name>/<purpose>/...` に使う slug
- `analysis_targets`: Athena readiness 判定結果に含まれるべき対象一覧
- `readiness_query`: `check_readiness.py` が実行する Athena SQL
- `output_formats`: 出力形式一覧。現状は `pptx`
- `parameters`: レポート設定用の自由形式テーブル
- `notification.to`: SES 通知の宛先メールアドレス一覧
- `notification.subject`: SES 通知の件名
- `analysis_targets` の件数は、解析用 Fargate タスクのサイズ自動選択にも使われる
- 成果物は `outputs/<type_name>/<purpose>/<job_id>/...` に保存される
