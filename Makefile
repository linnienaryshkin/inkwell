.PHONY: dev-ui dev-api test-ui test-api lint-api quality-gate-ui

dev-ui:
	cd ui && npm run dev

dev-api:
	cd api && uv run uvicorn app.main:app --reload

test-ui:
	cd ui && npm run test

test-api:
	cd api && uv run pytest tests/ -v

lint-api:
	cd api && uv run ruff check app/ tests/

quality-gate-ui:
	cd ui && npm run quality-gate
