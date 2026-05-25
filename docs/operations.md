# Operations

運用手順は `docs/playbooks/` に整理しています。用途に応じて次を参照してください。

- `docs/playbooks/environment-setup.md`
- `docs/playbooks/local-validation.md`
- `docs/playbooks/job-authoring.md`
- `docs/playbooks/pipeline-operations.md`
- `docs/playbooks/troubleshooting.md`

## 役割分担

- `README.md`: 全体入口
- `docs/architecture.md`: 構成説明
- `docs/operations.md`: 手順の索引
- `docs/playbooks/*.md`: 実務手順の本体
- `.github/skills/*/SKILL.md`: GitHub Copilot 向け repo 固有 skill

## 補足

- 命名規則は `publish-flow-<stage>-<resource>` に統一します
- 成果物は `outputs/<type_name>/<purpose>/<job_id>/...` に保存します
- `type_name` と `purpose` は日本語を使わず slug として運用します

## GitHub Copilot skill の推奨順

1. `setup-environment`
2. `run-local-checks`
3. `author-job-toml`
4. `operate-pipeline`
5. 必要に応じて `debug-failures`
6. 本実装移行時に `swap-in-real-assets`

通常フローは 1 から 4 です。  
`debug-failures` は障害時、`swap-in-real-assets` は既存資産差し替え時に使います。
