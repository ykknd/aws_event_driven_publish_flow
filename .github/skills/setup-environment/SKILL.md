---
name: setup-environment
description: Prepare and verify the AWS-side prerequisites for publish_flow. Use when Codex needs to set up or review the environment before local validation, synth, deploy, or pipeline execution, including SSM Parameter Store values, existing VPC/private subnet assumptions, S3 VPC endpoint restrictions, and SES sender configuration.
---

# Setup Environment

Use this skill when the task is about preparing or checking the environment for `publish_flow`.

## 前提条件

- リポジトリルートで作業する
- 詳細手順は `docs/playbooks/environment-setup.md` を読む

## 実行順序

1. stage を確認する
2. SSM Parameter Store の必要項目を確認する
3. 既存 VPC / private subnet / S3 VPCE / SES sender の前提を確認する
4. ローカル依存の準備状態を確認する

## 具体コマンド

```bash
cd infra
npm install

cd ../engine
uv sync
```

## 判断基準

- stage ごとの SSM 値がそろっている
- 既存 VPC/private subnet 前提が明確
- SES sender が利用可能

## 注意点

- S3 の閲覧は `aws:SourceVpce` または社内 CIDR に制限される
- ECS タスクは private subnet で動き、public IP は付かない
