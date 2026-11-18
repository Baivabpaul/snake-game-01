from __future__ import annotations
from typing import Sequence, Tuple, Union, Optional, Any
from snake_game.settings import GRID_COLUMNS, GRID_ROWS


def check_food_collision(next_position: Tuple[int, int], food: Any) -> bool:
    """Check whether the next snake position contains food.
    Supports either a single Food entity or a sequence of Food entities.
    """
    if isinstance(food, (list, tuple, set)):
        return any(f.position == next_position for f in food)
    food_pos = food.position if hasattr(food, "position") else food
    return next_position == food_pos


def find_eaten_food(next_position: Tuple[int, int], foods: Sequence[Any]) -> Optional[Any]:
    """Find and return the specific Food object colliding with next_position, or None."""
    for f in foods:
        f_pos = f.position if hasattr(f, "position") else f
        if f_pos == next_position:
            return f
    return None


def check_wall_collision(
    position: Tuple[int, int],
    columns: int = GRID_COLUMNS,
    rows: int = GRID_ROWS,
) -> bool:
    """Check if the position is outside the grid bounds."""
    x, y = position
    return x < 0 or x >= columns or y < 0 or y >= rows


def check_self_collision(
    next_position: Tuple[int, int],
    body: Sequence[Tuple[int, int]],
    grow: bool = False,
) -> bool:
    """Check if the next head position collides with the snake's body.
    
    If grow is False, the tail segment will vacate its position on move,
    so colliding with the very last tail segment is safe.
    """
    if not body:
        return False
    active_body = body if grow else body[:-1]
    return next_position in active_body
