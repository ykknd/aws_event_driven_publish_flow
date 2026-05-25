# Local Validation

## 目的

ローカルで `infra` と `engine` の雛形が壊れていないことを確認する。

## 前提

- `environment-setup.md` の前提が満たされている
- repo ルートでコマンドを実行できる

## 入力

- 検証対象 stage
- サンプル TOML または確認したい job TOML

## 実行手順

1. TypeScript CDK をビルドする。

```bash
cd infra
npm run build
```

2. `staging` の synth を実行する。

```bash
cd infra
npx cdk synth -c stage=staging
```

3. 必要なら `prod` の synth も実行する。

```bash
cd infra
npx cdk synth -c stage=prod
```

4. Python の unit test を実行する。

```bash
cd engine
uv run pytest ../tests/unit
```

5. readiness チェックをサンプル TOML で実行する。

```bash
cd ..
set SIMULATED_AVAILABLE_TARGETS=inventory_snapshot,warehouse_delta
uv run --project engine python engine/app/check_readiness.py --job jobs/examples/inventory_report.toml
```

6. 解析実行をサンプル TOML で実行する。

```bash
uv run --project engine python engine/app/run_analysis.py --job jobs/examples/inventory_report.toml
```

## 期待結果

- `npm run build` が成功する
- `cdk synth` が成功する
- unit test が通る
- readiness 実行で `ready: true/false` とサイズ情報が出る
- 解析実行で `outputs/<type_name>/<purpose>/<job_id>/...` に成果物が作られる

## 失敗時の見方

- `uv sync` や `pytest` に失敗した場合は `engine/pyproject.toml` と `uv.lock` を確認する
- `cdk synth` に失敗した場合は SSM Parameter Store か context 値を確認する
- readiness 実行時に Athena を使う場合は `ATHENA_WORKGROUP` と `ATHENA_OUTPUT_LOCATION` を確認する
