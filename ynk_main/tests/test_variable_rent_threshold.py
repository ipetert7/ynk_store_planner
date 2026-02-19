from __future__ import annotations

import math

from ynk_modelo.domain.eerr import variable_rent_threshold


def test_variable_rent_threshold_uses_minimum_rent_only() -> None:
    threshold = variable_rent_threshold(1_000_000.0, 0.05)
    assert threshold == 20_000_000.0


def test_variable_rent_threshold_handles_invalid_inputs() -> None:
    assert variable_rent_threshold(0.0, 0.05) is None
    assert variable_rent_threshold(1_000_000.0, 0.0) is None
    # Percent values entered as 5 (5%) should be interpreted as 0.05
    threshold = variable_rent_threshold(1_000_000.0, 5)
    assert math.isclose(threshold or 0.0, 20_000_000.0)
