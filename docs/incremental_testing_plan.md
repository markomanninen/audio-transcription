# Incremental Test Plan for Backend ↔ Frontend State Synchronisation

This plan describes how to validate every layer of the transcription stack — from database rows through backend services to the UI progress components — in small, independent checkpoints. Each stage should pass before moving to the next so that regressions in status propagation are caught early.

## 0. Prerequisites
- Python 3.11 virtual environment with `backend/requirements.txt` installed.
- Node 20+ with pnpm or npm; install dependencies via `npm install` inside `frontend`.
- Redis and Postgres reachable via `docker-compose up backend redis postgres` (or equivalent local services).
- Test data directory write access (backend fixtures rely on `tempfile`).
- Optional: Playwright browsers installed once via `npx playwright install --with-deps`.

## 1. Baseline Environment & Health Checks
1. **Smoke start**: `docker-compose up backend frontend redis postgres` and confirm `/health` and `/api/ai/health` return 200 via `scripts/log_inspector.py --watch`.
2. **Database bootstrap**: ensure migrations are applied (`alembic upgrade head` if using migrations, otherwise `backend/tests/conftest.py` fixtures).
3. **Log sanitiser**: enable backend structured logging (already configured in `logging.ini`); tail using `npm run logs:backend`. Record the current commit SHA for later comparisons.

## 2. Database & Model Integrity Tests
Goal: guarantee stored transcription status values align with the `TranscriptionStatus` Enum and that stale lowercase entries are surfaced.

- **Targeted pytest selection**: `pytest backend/tests/test_models.py -k transcriptionstatus`.
- **New validation test**: add a fixture to insert lowercase `pending` and assert conversion or hard failure with remediation guidance (`Suggested fix: data migration to uppercase + API normalisation`). Track in `tests/test_model_enum_sync.py`.
- **Data lint**: provide SQL snippet (`SELECT id, status FROM audio_files WHERE status NOT IN (...)`) and script in `scripts/check_status_enum.py` for CI gating.

## 3. Backend Service Unit Tests
Focus on the orchestration code that mutates status/progress.

1. **Transcription service** (`app/services/transcription_service.py`):
   - Existing test `test_transcription_service` verifies Whisper integration. Extend with assertions on `audio_file.status` transitions (`PENDING → PROCESSING → COMPLETED`) using the SQLAlchemy session.
2. **Queue manager / scheduler**:
   - Identify worker module (`app/worker.py` or Celery equivalent). Add unit tests with `pytest` + `freezegun` to simulate progress callbacks every 5s.
3. **Progress publisher**:
   - If Server-Sent Events/WebSocket layer exists (`app/api/progress.py`), use `starlette.testclient` to connect and assert incremental messages.

Commands:
```bash
cd backend
pytest tests/test_transcription.py::test_transcription_service
pytest tests/test_force_restart.py
pytest tests/test_main.py -k progress
```

## 4. API Contract Tests (Backend)
Purpose: ensure frontend polling endpoints deliver consistent payload shapes and status casing.

1. **Status endpoint**: create contractual tests using `pytest` + `respx` to verify JSON includes `status`, `progress`, `pending_steps`. Add snapshot (via `pytest-approvaltests` or manual assertion dictionary).
2. **Upload listings**: cover `/api/upload/files/{project}` when statuses span the full enum set.
3. **Error reproduction**: reproduce the failing `"pending"` case by seeding lowercase entries, ensuring the API response normalises to uppercase before JSON response. Document fix expectation (likely convert in the ORM model or response schema).

Command grouping:
```bash
pytest tests/test_transcription.py::test_get_transcription_status_pending
pytest tests/test_upload.py::test_list_files_status_values
```

## 5. Background Worker & External Services
Testing the asynchronous job runner separate from the API.

1. **Mocked Whisper downloads**: use `pytest.mark.asyncio` to test `ModelManager.ensure_model("base")` to avoid network downloads in CI.
2. **Redis queue tests**: if using RQ/Celery, spin up ephemeral Redis via `docker compose exec redis` and run `pytest tests/test_queue_processing.py`.
3. **Resilience scenarios**: add regression tests replicating log snippet behaviour (`force-restart` cycle) so status resets are validated (`FAILED → PENDING`).

## 6. Frontend Unit & Contract Tests
Ensure UI components react to the API states.

1. **MSW-backed hooks**: in `frontend/src/hooks/useTranscriptionStatus.ts`, create Vitest suite using MSW to serve labelled responses (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`). Assert hook returns canonical statuses.
2. **Progress bar component**: `ProgressPanel.test.tsx` verifying:
   - Poll interval behaviour (advance timers via `vi.useFakeTimers()`).
   - Status badge text matches uppercase expectation.
   - Percentage rounds go to 0% when backend sends `null`.
3. **Error banner**: create test for 500 responses to ensure fallback UI (mirrors backend enumeration failure).

Commands:
```bash
cd frontend
npm run test -- src/components/__tests__/ProgressPanel.test.tsx
npm run test -- src/hooks/__tests__/useTranscriptionStatus.test.ts
```

## 7. API ↔ UI Contract Alignment
Guard against schema drift between FastAPI responses and TS interfaces.

1. **OpenAPI snapshot**: export `/openapi.json` from backend (`curl http://localhost:8000/openapi.json > docs/openapi-latest.json`).
2. **Type generation**: use `openapi-typescript` (add dev dependency) to generate `frontend/src/types/backend.ts`.
3. **Contract test**: create Vitest that imports generated types and asserts `TranscriptionStatus` union equals `['PENDING','PROCESSING','COMPLETED','FAILED']`.

Add CI check: `npm run lint && npm run type-check`.

## 8. End-to-End Playwright Flow
Full-stack validation of upload → transcription → UI progress.

1. **Scenario**:
   - Start services via `scripts/dev_e2e.sh` (new helper to run backend with mock Whisper).
   - Playwright script: `tests/e2e/transcription-status.spec.ts`.
   - Steps: upload file, trigger transcription, mock backend streaming to send staged progress (use `/api/test/progress-step` endpoint or intercept `fetch` to respond sequentially), assert UI cards update.
2. **Regression**: add test replicating `'pending'` case by hitting seeded project 1; ensure Playwright asserts UI displays `'PENDING'` label and no crash.

Execute with `npm run test:e2e`.

## 9. Observability & Telemetry Validation
- Enable backend structured logs with status breadcrumbs and ensure tests ingest log JSON (use `scripts/log_inspector.py --since=5m --grep progress`).
- Add health dashboard check verifying `/metrics` (if available) increments counters per status change.
- Record extracted logs in `debug/progress_trace_{timestamp}.json` for forensic comparison.

## 10. Automation & CI Integration

1. **Local pre-commit hook**: chain `pytest`, `npm run test`, and static lint before push.
2. **CI pipeline recommendation**:
   - Stage 1: format/lint (`ruff`, `eslint`, `prettier --check`).
   - Stage 2: backend pytest (split quick unit vs slower integration using `pytest -m "not slow"`).
   - Stage 3: frontend vitest.
   - Stage 4: contract generation check (`git diff --exit-code frontend/src/types/backend.ts`).
   - Stage 5: optional nightly Playwright run because of higher cost.
3. **Reporting**: publish coverage artifacts (`pytest --cov=app`, `vitest --coverage`) to evaluate gap coverage in worker and UI polling logic.

## 11. Remediation Checklist (Based on Current Failure)
- Run DB health script to convert legacy `pending` rows into uppercase; add migration to enforce uppercase trigger.
- Patch backend schema to coerce enumerations (`status.value.lower()` only at response layer) and re-run API contract tests.
- Verify frontend types & tests expect uppercase statuses before redeploy.
- Add regression E2E scenario that loads `/api/upload/files/1` and ensures 200 instead of 500, marking ticket closed once Playwright passes.

## 12. Execution Timeline Suggestion
| Day | Focus | Expected Outcome |
|-----|-------|------------------|
| 1 | Sections 0–3 | Backend enums & services fully tested; failing API contract reproduced. |
| 2 | Sections 4–6 | Frontend components aligned with backend responses, mocking verified. |
| 3 | Sections 7–8 | Contracts generated, e2e path green, regression recorded. |
| 4 | Sections 9–10 | CI gating, observability hooks, documentation updates. |

Follow this pipeline sequentially; only advance when the previous stage is green. This ensures every component — DB rows, background jobs, API surface, and UI consumers — remains synchronised and resilient to status-format regressions.
