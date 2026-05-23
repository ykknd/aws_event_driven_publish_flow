# Operations

## ローカル確認

- `cd infra && npm run synth`
- `cd engine && uv sync`
- `cd engine && uv run pytest ../tests/unit`

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
