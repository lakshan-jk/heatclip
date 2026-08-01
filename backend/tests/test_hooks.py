import config
import hooks
from analyzer import HeatMarker


def _heatmap(values, marker_dur=2.0):
    return [HeatMarker(i * marker_dur, (i + 1) * marker_dur, v) for i, v in enumerate(values)]


def test_find_hot_regions_detects_peak():
    # low baseline with a clear hot plateau at indices 8..12
    values = [0.1] * 20
    for i in range(8, 13):
        values[i] = 0.9
    regions = hooks.find_hot_regions(_heatmap(values))
    assert regions, "should find at least one region"
    top = regions[0]
    # the hot core should fall within the plateau's time span (~16s..26s)
    assert 14 <= top.core_start <= 18
    assert 24 <= top.core_end <= 28
    assert top.peak >= 0.8


def test_region_bounds_respect_min_max():
    values = [0.1] * 20
    values[10] = 1.0  # single sharp spike
    regions = hooks.find_hot_regions(_heatmap(values))
    start, end = hooks._region_to_bounds(regions[0], duration=40.0)
    length = end - start
    assert hooks.MIN_CLIP <= length <= hooks.MAX_CLIP + 0.01
    assert start >= 0


def test_no_heatmap_returns_empty():
    assert hooks.find_hot_regions([]) == []


def test_plan_for_admin_resolution():
    assert config.plan_for("kumarlakshan1032@gmail.com", "free") == "admin"
    assert config.plan_for("someone@else.com", "free") == "free"
    assert config.plan_for("someone@else.com", "creator") == "creator"
    assert config.plan_for("someone@else.com", "garbage") == "free"
