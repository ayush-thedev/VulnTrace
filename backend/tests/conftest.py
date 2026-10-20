import pytest
from fastapi.testclient import TestClient
from backend.app.config import settings
from backend.app.main import app

# Ensure tests run with offline fixtures per PRD §18 Phase 3 ("so tests don't need network")
settings.OFFLINE_FIXTURE_MODE = True

@pytest.fixture
def client():
    return TestClient(app)
