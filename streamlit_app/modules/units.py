KG_TO_LBS = 2.20462262185
STEP_LBS = 1.25  # smallest loadable plate increment


def kg_to_display(kg: float, unit: str) -> float:
    if unit == "kg":
        return kg
    return round_to_plate(kg * KG_TO_LBS)


def display_to_kg(val: float, unit: str) -> float:
    if unit == "kg":
        return val
    return val / KG_TO_LBS


def round_to_plate(lbs: float) -> float:
    return round(lbs / STEP_LBS) * STEP_LBS


def cols_to_kg(kg_whole: int, kg_half: bool) -> float:
    return kg_whole + (0.5 if kg_half else 0)


def kg_to_cols(kg: float) -> dict:
    whole = int(kg)
    half = (kg - whole) >= 0.25
    return {"kg_whole": whole, "kg_half": half}


def format_weight(kg: float, unit: str) -> str:
    val = kg_to_display(kg, unit)
    if unit == "kg":
        return f"{val:.1f} kg" if val % 1 != 0 else f"{int(val)} kg"
    formatted = f"{val:.2f}".rstrip("0").rstrip(".")
    return f"{formatted} lbs"


def unit_label(unit: str) -> str:
    return unit


def drum_step(unit: str) -> float:
    return 0.5 if unit == "kg" else 2.5


def drum_min(unit: str) -> float:
    return 20.0 if unit == "kg" else 45.0


def drum_max(unit: str) -> float:
    return 250.0 if unit == "kg" else 550.0
