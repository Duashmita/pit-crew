.PHONY: dev smoke smoke-live test
PY=.venv/bin/python

dev:
	$(PY) -m uvicorn agent.app:app --port 8000 --reload & (cd web && npm run dev); wait

smoke:
	DIAGNOSE_MODE=fixture ALERT_COUNTDOWN_S=1 $(PY) smoke.py

smoke-live:
	DIAGNOSE_MODE=live ALERT_COUNTDOWN_S=1 $(PY) smoke.py

test:
	$(PY) -m pytest -q car agent || true
	swipl -g run_tests -t halt triage/test_triage.pl
