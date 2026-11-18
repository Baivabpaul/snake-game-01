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
    FOOD_SHADOW,
    FOOD_STEM,
    FOOD_LEAF,
    FOOD_LEAF_VEIN,
    FRUIT_COLORS,
    BONUS_FRUIT_DURATION,
)


class Food:
    """Realistic 3D-styled Fruit entity supporting multiple fruit varieties

    (Apple, Grapes, Orange, Strawberry) and the Big Golden Bonus Fruit.
    """

    def __init__(self, kind: str = "apple", duration: float = 0.0):
        self.kind: str = kind
        self.is_bonus: bool = (kind == "golden")
        self.points: int = FRUIT_COLORS.get(kind, {}).get("points", 10)
        self.name: str = FRUIT_COLORS.get(kind, {}).get("name", "Fruit")
        self.duration: float = duration if self.is_bonus else 0.0
        self.max_duration: float = self.duration
        self.position: Tuple[int, int] = (0, 0)
        self.anim_timer: float = random.uniform(0, 1000)

    @property
    def is_expired(self) -> bool:
        """Check if bonus fruit has timed out."""
        if not self.is_bonus:
            return False
        return self.duration <= 0

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
        """Update idle floating animation timer and bonus countdown."""
        self.anim_timer += delta_time
        if self.is_bonus and self.duration > 0:
            self.duration -= delta_time / 1000.0

    def draw(self, surface: pygame.Surface):
        """Draw realistic fruit with drop shadow, 3D shading, and variety-specific anatomy."""
        cx, cy = self.pixel_center

        # Idle floating bob
        bob_speed = 0.008 if self.is_bonus else 0.005
        bob_amplitude = 2.2 if self.is_bonus else 1.5
        bob = math.sin(self.anim_timer * bob_speed) * bob_amplitude
        fruit_cy = cy + bob

        # Ground Drop Shadow
        shadow_w = CELL_SIZE + (10 if self.is_bonus else 4)
        shadow_h = CELL_SIZE // 2
        shadow_surf = pygame.Surface((shadow_w + 4, shadow_h + 4), pygame.SRCALPHA)
        pygame.draw.ellipse(shadow_surf, FOOD_SHADOW, (2, 2, shadow_w, shadow_h))
        surface.blit(
            shadow_surf,
            (cx - shadow_surf.get_width() // 2, cy + CELL_SIZE * 0.28),
        )

        # Draw fruit based on kind
        if self.kind == "golden":
            self._draw_golden_bonus(surface, cx, fruit_cy)
        elif self.kind == "grapes":
            self._draw_grapes(surface, cx, fruit_cy)
        elif self.kind == "orange":
            self._draw_orange(surface, cx, fruit_cy)
        elif self.kind == "strawberry":
            self._draw_strawberry(surface, cx, fruit_cy)
        else:
            self._draw_apple(surface, cx, fruit_cy)

    def _draw_apple(self, surface: pygame.Surface, cx: float, cy: float):
        """Draw realistic red apple with lobes, stem, leaf, and glint."""
        apple_w = CELL_SIZE * 0.78
        apple_h = CELL_SIZE * 0.74
        r = apple_w / 2.0

        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0

        # Base dark shadow lobe
        pygame.draw.ellipse(
            fruit_surf,
            (159, 18, 57),
            (fx - apple_w / 2, fy - apple_h / 2 + 1, apple_w, apple_h),
        )

        # Main vibrant apple red body
        lobe_r = r * 0.88
        pygame.draw.circle(fruit_surf, (225, 29, 72), (int(fx - r * 0.22), int(fy + 1)), int(lobe_r))
        pygame.draw.circle(fruit_surf, (225, 29, 72), (int(fx + r * 0.22), int(fy + 1)), int(lobe_r))

        # Bottom subtle warm blush
        pygame.draw.circle(fruit_surf, (200, 160, 40, 60), (int(fx), int(fy + lobe_r * 0.6)), int(lobe_r * 0.5))

        # Specular highlight arc
        pygame.draw.arc(
            fruit_surf,
            (255, 255, 255, 180),
            (fx - apple_w * 0.42, fy - apple_h * 0.45, apple_w * 0.55, apple_h * 0.65),
            math.radians(80),
            math.radians(170),
            width=2,
        )
        pygame.draw.circle(fruit_surf, (255, 255, 255, 220), (int(fx - apple_w * 0.24), int(fy - apple_h * 0.22)), 1)

        # Stem & Leaf
        stem_start = (fx, fy - apple_h * 0.38)
        stem_control = (fx + 2, fy - apple_h * 0.7)
        stem_end = (fx + 4, fy - apple_h * 0.82)
        pygame.draw.lines(fruit_surf, FOOD_STEM, False, [stem_start, stem_control, stem_end], width=2)

        leaf_pts = [
            (fx + 2, fy - apple_h * 0.55),
            (fx + 9, fy - apple_h * 0.75),
            (fx + 12, fy - apple_h * 0.60),
            (fx + 5, fy - apple_h * 0.45),
        ]
        pygame.draw.polygon(fruit_surf, FOOD_LEAF, leaf_pts)
        pygame.draw.line(fruit_surf, FOOD_LEAF_VEIN, (fx + 2, fy - apple_h * 0.55), (fx + 10, fy - apple_h * 0.65), width=1)

        surface.blit(fruit_surf, (cx - fx, cy - fy))

    def _draw_grapes(self, surface: pygame.Surface, cx: float, cy: float):
        """Draw 3D clustered purple grapes."""
        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0

        # Cluster berries offsets
        berries = [
            (-5, -3, 4.5), (0, -4, 4.8), (5, -3, 4.5),
            (-3, 1, 4.6), (3, 1, 4.6),
            (0, 5, 4.2),
        ]
        for bx, by, br in berries:
            px, py = fx + bx, fy + by
            pygame.draw.circle(fruit_surf, (107, 33, 168), (int(px), int(py + 1)), int(br))
            pygame.draw.circle(fruit_surf, (147, 51, 234), (int(px), int(py)), int(br - 0.5))
            pygame.draw.circle(fruit_surf, (216, 180, 254), (int(px - br * 0.3), int(py - br * 0.3)), 1)

        # Top stem & little tendril
        pygame.draw.line(fruit_surf, FOOD_STEM, (fx, fy - 6), (fx + 2, fy - 11), width=2)
        pygame.draw.polygon(fruit_surf, FOOD_LEAF, [(fx + 1, fy - 8), (fx + 7, fy - 11), (fx + 5, fy - 7)])

        surface.blit(fruit_surf, (cx - fx, cy - fy))

    def _draw_orange(self, surface: pygame.Surface, cx: float, cy: float):
        """Draw textured citrus orange with leaf."""
        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0
        r = CELL_SIZE * 0.38

        # Shadow base
        pygame.draw.circle(fruit_surf, (194, 65, 12), (int(fx), int(fy + 1)), int(r))
        # Orange body
        pygame.draw.circle(fruit_surf, (249, 115, 22), (int(fx), int(fy)), int(r - 0.5))
        # Specular crescent
        pygame.draw.arc(fruit_surf, (254, 215, 170), (fx - r * 0.75, fy - r * 0.75, r * 1.5, r * 1.5), math.radians(90), math.radians(170), width=2)
        # Stem button & leaf
        pygame.draw.circle(fruit_surf, (120, 53, 15), (int(fx), int(fy - r * 0.7)), 2)
        pygame.draw.polygon(fruit_surf, FOOD_LEAF, [(fx, fy - r * 0.7), (fx + 7, fy - r - 3), (fx + 7, fy - r + 2)])

        surface.blit(fruit_surf, (cx - fx, cy - fy))

    def _draw_strawberry(self, surface: pygame.Surface, cx: float, cy: float):
        """Draw realistic strawberry with seeds and green crown."""
        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0

        # Heart/teardrop strawberry polygon
        pts = [
            (fx, fy + 9),
            (fx - 7, fy + 2),
            (fx - 8, fy - 4),
            (fx - 3, fy - 7),
            (fx, fy - 5),
            (fx + 3, fy - 7),
            (fx + 8, fy - 4),
            (fx + 7, fy + 2),
        ]
        pygame.draw.polygon(fruit_surf, (185, 28, 28), [(p[0], p[1] + 1) for p in pts])
        pygame.draw.polygon(fruit_surf, (239, 68, 68), pts)

        # Yellow seed dots
        seeds = [(-3, -2), (3, -2), (-4, 1), (0, 2), (4, 1), (-2, 5), (2, 5), (0, 7)]
        for sx, sy in seeds:
            pygame.draw.circle(fruit_surf, (253, 224, 71), (int(fx + sx), int(fy + sy)), 1)

        # Green calyx crown
        crown = [(fx - 6, fy - 7), (fx - 3, fy - 9), (fx, fy - 6), (fx + 3, fy - 9), (fx + 6, fy - 7), (fx, fy - 5)]
        pygame.draw.polygon(fruit_surf, FOOD_LEAF, crown)

        surface.blit(fruit_surf, (cx - fx, cy - fy))

    def _draw_golden_bonus(self, surface: pygame.Surface, cx: float, cy: float):
        """Draw Big Golden Bonus Fruit with pulsing aura, sparkles, and countdown timer ring."""
        pulse = (math.sin(self.anim_timer * 0.01) + 1.0) / 2.0  # 0.0 -> 1.0
        r = CELL_SIZE * 0.44 + pulse * 1.5

        # 1. Radiating Aura Glow
        aura_r = int(r * 1.8 + pulse * 3)
        aura_surf = pygame.Surface((aura_r * 2 + 4, aura_r * 2 + 4), pygame.SRCALPHA)
        pygame.draw.circle(
            aura_surf,
            (250, 204, 21, int(45 + pulse * 35)),
            (aura_r + 2, aura_r + 2),
            aura_r,
        )
        surface.blit(aura_surf, (cx - aura_r - 2, cy - aura_r - 2))

        # 2. Main Golden Apple / Trophy Sphere
        fruit_surf = pygame.Surface((CELL_SIZE * 2, CELL_SIZE * 2), pygame.SRCALPHA)
        fx = fruit_surf.get_width() / 2.0
        fy = fruit_surf.get_height() / 2.0

        # Base deep gold
        pygame.draw.circle(fruit_surf, (202, 138, 4), (int(fx), int(fy + 1)), int(r + 1))
        # Radiant gold body
        pygame.draw.circle(fruit_surf, (250, 204, 21), (int(fx), int(fy)), int(r))
        # Warm highlight glow
        pygame.draw.circle(fruit_surf, (254, 240, 138), (int(fx - r * 0.25), int(fy - r * 0.25)), int(r * 0.55))
        # Diamond glint
        pygame.draw.circle(fruit_surf, (255, 255, 255), (int(fx - r * 0.3), int(fy - r * 0.3)), 2)

        # Crown / Star Leaf
        pygame.draw.polygon(fruit_surf, (34, 197, 94), [(fx, fy - r - 2), (fx + 5, fy - r - 5), (fx + 2, fy - r + 1)])

        surface.blit(fruit_surf, (cx - fx, cy - fy))

        # 3. Circular Countdown Timer Ring (shows how much time is left before it vanishes)
        if self.max_duration > 0 and self.duration > 0:
            fraction = max(0.0, min(1.0, self.duration / self.max_duration))
            ring_r = int(r + 4)
            ring_rect = pygame.Rect(cx - ring_r, cy - ring_r, ring_r * 2, ring_r * 2)
            # Background ring track
            pygame.draw.arc(surface, (60, 50, 20, 150), ring_rect, 0, math.pi * 2, width=2)
            # Active glowing countdown arc
            start_angle = -math.pi / 2
            end_angle = start_angle + math.pi * 2 * fraction
            pygame.draw.arc(surface, (250, 204, 21), ring_rect, start_angle, end_angle, width=2)
