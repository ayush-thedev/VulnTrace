from template_helpers import compute_safe_status

def test_system_status():
    status = compute_safe_status()
    assert "healthy" in status

def test_sample_math():
    assert 2 + 2 == 4
