.PHONY: infra-install infra-build infra-synth engine-lock engine-sync test

infra-install:
	cd infra && npm install

infra-build:
	cd infra && npm run build

infra-synth:
	cd infra && npm run synth

engine-lock:
	cd engine && uv lock

engine-sync:
	cd engine && uv sync

test:
	cd engine && uv run pytest ../tests/unit

