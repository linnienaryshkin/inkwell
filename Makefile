.PHONY: install install-ui install-api dev dev-ui dev-api test-ui test-api lint-ui lint-api quality-gate-ui

install: install-ui install-api

install-ui:
	cd ui && npm install

install-api:
	cd api && uv sync --extra dev

dev:
	make dev-api & make dev-ui

dev-ui:
	cd ui && npm run dev

dev-api:
	cd api && uv run uvicorn app.main:app --reload

test-ui:
	cd ui && npm run test

test-api:
	cd api && uv run pytest tests/ -v

lint-ui:
	cd ui && npm run lint && npm run format && npm run types:check

lint-api:
	cd api && uv run ruff check app/ tests/
