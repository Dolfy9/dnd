"""Vstupní bod charakterového enginu – přesměrováno na app.engine.

Původní implementace přepsaná na balíček app/engine (vyrazy, efekty, compute).
Název modulu se drží kvůli zpětné kompatibilitě importů.
"""
from .engine.compute import (  # noqa: F401 – re-export
    AB, AB_EN, MULTI, SKILLS, XP_LEVELS, compute, mod, sg,
)
