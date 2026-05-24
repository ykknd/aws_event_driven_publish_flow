# Operations

## ローカル確認

- `cd infra && npx cdk synth -c stage=staging`
- `cd infra && npx cdk synth -c stage=prod`
- `cd engine && uv sync`
- `cd engine && uv run pytest ../tests/unit`

## 環境切替

- `stage` は CDK context で切り替えます
- 未指定時は `staging` を使います
- 命名規則は `publish-flow-<stage>-<resource>` に統一します
- 例: `publish-flow-staging-publisher`
- 例: `publish-flow-prod-state-machine`

## 本番保護

- `prod` は `RemovalPolicy.RETAIN` を使います
- `prod` のスタックは termination protection を有効にします
- `staging` は破棄しやすさを優先します

## ネットワーク前提

- ECS タスクは既存 VPC の private subnet に配置します
- public subnet や public IP は使いません
- 既存 VPC の S3 VPC endpoint を経由したアクセスを許可します
- 社内ネットワークからの閲覧は CIDR ベースで許可します

## Parameter Store で用意する値

`staging`

- `/publish-flow/staging/network/vpc-id`
- `/publish-flow/staging/network/private-subnet-ids`
- `/publish-flow/staging/network/s3-vpce-id`
- `/publish-flow/staging/network/allowed-cidrs`
- `/publish-flow/staging/notification/from-address`

`prod`

- `/publish-flow/prod/network/vpc-id`
- `/publish-flow/prod/network/private-subnet-ids`
- `/publish-flow/prod/network/s3-vpce-id`
- `/publish-flow/prod/network/allowed-cidrs`
- `/publish-flow/prod/notification/from-address`

値の形式

- `vpc-id`: `vpc-xxxxxxxx`
- `private-subnet-ids`: `subnet-a,subnet-b,subnet-c`
- `s3-vpce-id`: `vpce-xxxxxxxx`
- `allowed-cidrs`: `203.0.113.10/32,203.0.113.0/24`
- `from-address`: `noreply@example.com`

## GitHub Variables / CDK context で直接渡す場合

- `vpcId`
- `privateSubnetIds`
- `s3VpceId`
- `allowedCidrs`
- `senderEmail`

例:

```bash
cd infra
npx cdk synth \
  -c stage=staging \
  -c vpcId=vpc-xxxxxxxx \
  -c privateSubnetIds=subnet-a,subnet-b \
  -c s3VpceId=vpce-xxxxxxxx \
  -c allowedCidrs=203.0.113.10/32,203.0.113.0/24 \
  -c senderEmail=noreply@example.com
```

SSM に値がある場合は、context を省略するとそちらを参照します。

## SES 通知の前提

- `from-address` は SES で verify 済みのアドレスまたはドメイン配下アドレスを使います
- 通知先と件名は S3 に置かれる実ジョブ TOML の `[notification]` から読み取ります
- 成功時の本文には `pptx` の presigned URL と有効期限を入れます

## ダミー資産の差し替え

本番利用前に、次は既存実装の実ファイルへ差し替えてください。

- `engine/app/check_readiness.py`
- `engine/app/run_analysis.py`
- `reports/*/process.ipynb`
- `reports/*/template.pptx`
- `engine/Dockerfile`

## 実行時の前提

- ECS タスクは短時間で終了する想定です。
- readiness の再試行状態は DynamoDB に保持します。
- artifact とレンダリング済みファイルは `outputs/<job_id>/` 配下に保存します。
