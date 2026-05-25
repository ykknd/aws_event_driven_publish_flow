# Pipeline Operations

## 目的

ジョブ TOML を S3 に投入して、Step Functions と ECS による通常実行を確認する。

## 前提

- `environment-setup.md` と `job-authoring.md` が完了している
- デプロイ済みの `publish_flow` リソースが存在する

## 入力

- 実行対象 stage
- ジョブ TOML
- 対象バケット名

## 実行手順

1. ジョブ TOML を S3 の `jobs/` prefix に配置する。

```text
s3://<bucket-name>/jobs/<job-file>.toml
```

2. EventBridge から Step Functions 実行が起きることを確認する。

3. readiness チェックが動いたことを確認する。

- DynamoDB のジョブ状態
- CloudWatch Logs
- Step Functions 実行履歴

4. 入力未充足なら 3 時間待機に入ることを確認する。

5. 入力充足後に analysis タスクが起動することを確認する。

6. 出力先を確認する。

```text
outputs/<type_name>/<purpose>/<job_id>/artifacts/...
outputs/<type_name>/<purpose>/<job_id>/rendered/...
outputs/<type_name>/<purpose>/<job_id>/manifest.json
```

7. SES 通知を確認する。

- 件名
- 通知先
- presigned URL
- 有効期限

## 期待結果

- TOML 配置だけでワークフローが起動する
- readiness 未充足時は retry へ進む
- readiness 充足時は `run_analysis.py` が起動する
- 成果物が期待 prefix に保存される
- 成功時に通知メールが届く

## 失敗時の見方

- ワークフロー未起動時は S3 EventBridge 設定と配置先 prefix を確認する
- analysis 未起動時は DynamoDB の `ready` と `task_size_profile` を確認する
- 出力が見つからない場合は `type_name` / `purpose` / `job_id` の組み合わせを確認する
- 通知が届かない場合は SES sender と TOML の `[notification]` を確認する
