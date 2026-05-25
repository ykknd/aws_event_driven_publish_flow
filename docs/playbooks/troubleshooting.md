# Troubleshooting

## 目的

`publish_flow` 実行時の典型的な障害を切り分ける。

## 前提

- Step Functions、ECS、S3、SES、DynamoDB の基本フローを把握している

## 主な確認観点

### readiness が通らない

- `readiness_query` の SQL が正しいか
- Athena workgroup が正しいか
- `ATHENA_OUTPUT_LOCATION` が必要な環境で未設定になっていないか
- `analysis_targets` に対して Athena の戻り 1 列目が期待どおりの値になっているか

### give up になる

- 未充足対象が DynamoDB の `missing_targets_text` にどう記録されているか
- 3 時間待機と retry 回数が期待どおり進んでいるか
- upstream のデータ到着タイミングにズレがないか

### SES 通知が失敗する

- `from-address` が verify 済みか
- SES sandbox 制約に引っかかっていないか
- TOML の `[notification]` に `to` と `subject` が入っているか

### S3 にアクセスできない

- `s3-vpce-id` が正しいか
- `allowed-cidrs` に社内 IP が入っているか
- ECS タスクが private subnet から S3 に到達できるか

### ECS タスクが起動しない

- 既存 VPC と private subnet IDs が正しいか
- public IP なしで動く前提の経路があるか
- `publisher` ロールに必要な権限があるか

### 既存資産差し替え後に壊れた

- `process.ipynb` が `misc/` を import できるか
- 出力先 prefix が `outputs/<type_name>/<purpose>/<job_id>` の規約を守っているか
- `manifest.json` の最低限の項目を維持しているか

## 期待結果

- 障害時に、どの AWS サービスか、どの設定値か、どのファイルかを順に切り分けられる

## 失敗時の見方

- 1 つの症状だけで原因を決め打ちしない
- まず `TOML`、`DynamoDB の状態`, `Step Functions の履歴`, `CloudWatch Logs` の順で追う
