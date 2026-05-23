# publish_flow

AWS 上でイベントドリブンな解析パイプラインを構築するための雛形です。

## 構成

- `infra/`: TypeScript CDK アプリケーション
- `engine/`: `uv` 管理の Python 実行基盤
- `reports/`: レポートごとの Notebook とテンプレート
- `misc/`: Notebook から import する共通ヘルパー
- `jobs/`: ジョブ定義サンプルと仕様メモ
- `docs/`: アーキテクチャと運用メモ

## クイックスタート

### Infra

```bash
cd infra
npm install
npm run build
npm run synth
```

ECS タスクのイメージを既定の公開プレースホルダからローカルの `engine/Dockerfile` に切り替える場合は、次を実行します。

```bash
cd infra
npx cdk synth -c useDockerAsset=true
```

### Engine

```bash
cd engine
uv sync
uv run python app/check_readiness.py --job ..\jobs\examples\inventory_report.toml
uv run python app/run_analysis.py --job ..\jobs\examples\inventory_report.toml
```

## 補足

- `check_readiness.py`、`run_analysis.py`、各レポートの Notebook はダミー実装です。
- `template.pptx` はプレースホルダなので、既存実装の実ファイルに差し替えてください。
- Step Functions は `Standard` を使うため、待機ループ中に ECS タスクは保持されません。
