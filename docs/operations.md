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
