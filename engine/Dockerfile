FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

COPY engine/pyproject.toml engine/uv.lock /app/engine/
RUN cd /app/engine && uv sync --frozen --no-dev

COPY engine/app /app/engine/app
COPY reports /app/reports
COPY misc /app/misc

ENV PATH="/app/engine/.venv/bin:${PATH}"
ENV PYTHONPATH="/app"

CMD ["python", "/app/engine/app/run_analysis.py"]

