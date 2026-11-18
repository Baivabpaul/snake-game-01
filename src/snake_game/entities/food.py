import math
import random
import pygame
from typing import Tuple, Sequence, Optional

from snake_game.settings import (
    ARENA_OFFSET_X,
    ARENA_OFFSET_Y,
    CELL_SIZE,
    GRID_COLUMNS,
    GRID_ROWS,
    FOOD_COLOR,
    FOOD_DARK,
    FOOD_HIGHLIGHT,
    FOOD_STEM,
    FOOD_LEAF,
    FOOD_LEAF_VEIN,
    FOOD_SHADOW,
)


class Food:
    """Realistic 3D-styled Food (Apple) with stem, leaf, glossy highlight, drop shadow, and idle float."""

    def __init__(self):
        self.position: Tuple[int, int] = (0, 0)
        self.anim_timer: float = random.uniform(0, 1000)
        self.spawn()

    def spawn(self, occupied_positions: Optional[Sequence[Tuple[int, int]]] = None) -> bool:
        """Generate food at a random unoccupied grid position."""
        if occupied_positions is None:
            occupied_positions = []

        occupied_set = set(occupied_positions)
        available_positions = [
            (x, y)
            for x in range(GRID_COLUMNS)
            for y in range(GRID_ROWS)
            if (x, y) not in occupied_set
        ]

        if not available_positions:
            return False

        self.position = random.choice(available_positions)
        return True

    @property
    def pixel_center(self) -> Tuple[float, float]:
        """Return the exact center of the food in screen pixel coordinates."""
        gx, gy = self.position
        cx = ARENA_OFFSET_X + gx * CELL_SIZE + CELL_SIZE / 2.0
        cy = ARENA_OFFSET_Y + gy * CELL_SIZE + CELL_SIZE / 2.0
        return (cx, cy)

    def update(self, delta_time: float):
        """Update idle floating animation timer."""
        self.anim_timer += delta_time

    def draw(self, surface: pygame.Surface):
        """Draw realistic apple with shadow, 3D shading, stem, leaf, and specular glint."""
        cx, cy = self.pixel_center

        # Gentle floating bob animation (approx 1.5px amplitude)
        bob = math.sin(self.anim_timer * 0.005) * 1.5
        apple_cy = cy + bob

        # 1. Ground Drop Shadow (stays on the floor below the apple)
        shadow_surf = pygame.Surface((CELL_SIZE + 8, CELL_SIZE // 2 + 4), pygame.SRCALPHA)
        shadow_rect = pygame.Rect(2, 2, CELL_SIZE + 4, CELL_SIZE // 2)
        pygame.draw.ellipse(shadow_surf, FOOD_SHADOW, shadow_rect)
        surface.blit(
            shadow_surf,
            (cx - shadow_surf.get_width() // 2, cy + CELL_SIZE * 0.28),
        )

        # 2. Apple Body (Two overlapping lobes for natural heart-indented shape)
        apple_w = CELL_SIZE * 0.78
        apple_h = CELL_SIZE * 0.74
        r = apple_w / 2.0

        # Dedicated transparent surface for crisp anti-aliased fruit rendering
        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0

        # Base dark shadow lobe (gives 3D depth)
        pygame.draw.ellipse(
            fruit_surf,
            FOOD_DARK,
            (fx - apple_w / 2, fy - apple_h / 2 + 1, apple_w, apple_h),
        )

        # Main vibrant apple red body (two lobes slightly separated horizontally)
        lobe_r = r * 0.88
        pygame.draw.circle(fruit_surf, FOOD_COLOR, (int(fx - r * 0.22), int(fy + 1)), int(lobe_r))
        pygame.draw.circle(fruit_surf, FOOD_COLOR, (int(fx + r * 0.22), int(fy + 1)), int(lobe_r))

        # Bottom subtle warm blush
        pygame.draw.circle(fruit_surf, (200, 160, 40, 60), (int(fx), int(fy + lobe_r * 0.6)), int(lobe_r * 0.5))

        # 3. Glossy Specular Highlight (creates the realistic shiny waxed skin look)
        highlight_color = (255, 255, 255, 180)
        pygame.draw.arc(
            fruit_surf,
            highlight_color,
            (fx - apple_w * 0.42, fy - apple_h * 0.45, apple_w * 0.55, apple_h * 0.65),
            math.radians(80),
            math.radians(170),
            width=2,
        )
        # Specular glint dot
        pygame.draw.circle(
            fruit_surf,
            (255, 255, 255, 220),
            (int(fx - apple_w * 0.24), int(fy - apple_h * 0.22)),
            1,
        )

        # 4. Realistic Woody Curved Stem
        stem_start = (fx, fy - apple_h * 0.38)
        stem_control = (fx + 2, fy - apple_h * 0.7)
        stem_end = (fx + 4, fy - apple_h * 0.82)
        pygame.draw.lines(
            fruit_surf,
            FOOD_STEM,
            False,
            [stem_start, stem_control, stem_end],
            width=2,
        )

        # 5. Fresh Green Leaf
        leaf_pts = [
            (fx + 2, fy - apple_h * 0.55),
            (fx + 9, fy - apple_h * 0.75),
            (fx + 12, fy - apple_h * 0.60),
            (fx + 5, fy - apple_h * 0.45),
        ]
        pygame.draw.polygon(fruit_surf, FOOD_LEAF, leaf_pts)
        # Leaf center vein
        pygame.draw.line(
            fruit_surf,
            FOOD_LEAF_VEIN,
            (fx + 2, fy - apple_h * 0.55),
            (fx + 10, fy - apple_h * 0.65),
            width=1,
        )

        # Blit the rendered fruit onto the game screen at current animated position
        surface.blit(
            fruit_surf,
            (cx - fx, apple_cy - fy),
        )
