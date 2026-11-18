from __future__ import annotations
from typing import Sequence, Tuple
from snake_game.settings import GRID_COLUMNS, GRID_ROWS


def check_food_collision(next_position: Tuple[int, int], food) -> bool:
    """Check whether the next snake position contains food."""
    food_pos = food.position if hasattr(food, "position") else food
    return next_position == food_pos


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
    # If not growing, the tail pops off, so we only check against body[:-1]
    active_body = body if grow else body[:-1]
    return next_position in active_body
