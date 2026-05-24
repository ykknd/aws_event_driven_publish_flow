# Environment Setup

## 目的

`publish_flow` を動かすための前提値と AWS 側の設定をそろえる。

## 前提

- AWS アカウントと対象 stage が決まっている
- 既存 VPC、private subnet、S3 VPC endpoint が利用可能
- SES の送信元アドレスまたはドメインが verify 済み

## 入力

- `stage`: `staging` または `prod`
- `vpc-id`
- `private-subnet-ids`
- `s3-vpce-id`
- `allowed-cidrs`
- `from-address`

## 実行手順

1. stage ごとの SSM Parameter Store を作成する。

```text
/publish-flow/<stage>/network/vpc-id
/publish-flow/<stage>/network/private-subnet-ids
/publish-flow/<stage>/network/s3-vpce-id
/publish-flow/<stage>/network/allowed-cidrs
/publish-flow/<stage>/notification/from-address
```

2. 値の形式を確認する。

- `vpc-id`: `vpc-xxxxxxxx`
- `private-subnet-ids`: `subnet-a,subnet-b,subnet-c`
- `s3-vpce-id`: `vpce-xxxxxxxx`
- `allowed-cidrs`: `203.0.113.10/32,203.0.113.0/24`
- `from-address`: `noreply@example.com`

3. 必要なら CDK context 用の値を整理する。

```text
stage
vpcId
privateSubnetIds
s3VpceId
allowedCidrs
senderEmail
```

4. ローカルで `infra` と `engine` の依存を入れる。

```bash
cd infra
npm install

cd ../engine
uv sync
```

## 期待結果

- stage ごとの SSM 値がそろっている
- 既存 VPC/private subnet 前提で `cdk synth` 可能な状態になっている
- SES sender が利用可能な状態になっている

## 失敗時の見方

- `cdk synth` で VPC や subnet が解決できない場合は SSM 値を確認する
- SES 送信失敗時は `from-address` の verify 状態と sandbox 制約を確認する
- S3 アクセス失敗時は `s3-vpce-id` と `allowed-cidrs` を確認する
