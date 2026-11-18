import math
import pygame
from typing import List, Tuple

from snake_game.settings import (
    ARENA_OFFSET_X,
    ARENA_OFFSET_Y,
    CELL_SIZE,
    GRID_COLUMNS,
    GRID_ROWS,
    INITIAL_SNAKE_LENGTH,
    INITIAL_SNAKE_SPEED,
    MIN_SNAKE_SPEED,
    MAX_SNAKE_SPEED,
    SPEED_INCREMENT,
    SNAKE_HEAD_COLOR,
    SNAKE_BODY_COLOR,
    SNAKE_BODY_DARK,
    SNAKE_DORSAL_RIDGE,
    SNAKE_TAIL_COLOR,
    SNAKE_OUTLINE_COLOR,
    SNAKE_SHADOW_COLOR,
    EYE_WHITE,
    EYE_PUPIL,
    EYE_GLINT,
    EYE_DEAD,
    TONGUE_COLOR,
    SCALE_MARK_COLOR,
)
from snake_game.entities.direction import Direction


class Snake:
    """Realistic serpentine Snake entity with continuous tapered body, 3D scales,

    directional head, expressive eyes, and animated flicking forked tongue.
    """

    def __init__(self):
        center_x = GRID_COLUMNS // 2
        center_y = GRID_ROWS // 2

        # Initialize snake body horizontally moving right
        self.body: List[Tuple[int, int]] = [
            (center_x - i, center_y) for i in range(INITIAL_SNAKE_LENGTH)
        ]

        self.direction: Direction = Direction.RIGHT
        self.move_interval: int = INITIAL_SNAKE_SPEED
        self.is_alive: bool = True

        # Tongue animation timers (in milliseconds)
        self.tongue_timer: float = 0.0
        self.tongue_flicking: bool = False
        self.tongue_flick_duration: float = 0.0

    @property
    def head(self) -> Tuple[int, int]:
        """Return the current snake head grid position."""
        return self.body[0]

    def reset(self):
        """Reset snake to initial starting configuration."""
        center_x = GRID_COLUMNS // 2
        center_y = GRID_ROWS // 2
        self.body = [
            (center_x - i, center_y) for i in range(INITIAL_SNAKE_LENGTH)
        ]
        self.direction = Direction.RIGHT
        self.move_interval = INITIAL_SNAKE_SPEED
        self.is_alive = True
        self.tongue_timer = 0.0
        self.tongue_flicking = False
        self.tongue_flick_duration = 0.0

    def change_direction(self, new_direction: Direction) -> bool:
        """Change movement direction if not opposite to current direction."""
        if self.direction.is_opposite(new_direction):
            return False
        self.direction = new_direction
        return True

    def move(self, grow: bool = False) -> Tuple[int, int]:
        """Move snake forward by one grid cell. Returns the new head position."""
        head_x, head_y = self.head
        dx, dy = self.direction.value
        new_head = (head_x + dx, head_y + dy)

        self.body.insert(0, new_head)
        if not grow:
            self.body.pop()

        return new_head

    def increase_speed(self):
        """Increase speed (decrease move interval) after eating food."""
        self.move_interval = max(
            MIN_SNAKE_SPEED, self.move_interval - SPEED_INCREMENT
        )

    def speed_up(self):
        """Player manual speed increase."""
        self.move_interval = max(
            MIN_SNAKE_SPEED, self.move_interval - SPEED_INCREMENT
        )

    def slow_down(self):
        """Player manual speed decrease."""
        self.move_interval = min(
            MAX_SNAKE_SPEED, self.move_interval + SPEED_INCREMENT
        )

    def update_animation(self, delta_time: float):
        """Update tongue flicking animation cycle."""
        if not self.is_alive:
            self.tongue_flicking = False
            return

        self.tongue_timer += delta_time

        if not self.tongue_flicking:
            # Trigger tongue flick every ~1.6 - 2.0 seconds
            if self.tongue_timer >= 1700:
                self.tongue_flicking = True
                self.tongue_flick_duration = 0.0
                self.tongue_timer = 0.0
        else:
            self.tongue_flick_duration += delta_time
            # Flick lasts ~220ms
            if self.tongue_flick_duration >= 220:
                self.tongue_flicking = False

    def _grid_to_pixel(self, gx: int, gy: int) -> Tuple[float, float]:
        """Convert grid cell coordinates to pixel center coordinates."""
        cx = ARENA_OFFSET_X + gx * CELL_SIZE + CELL_SIZE / 2.0
        cy = ARENA_OFFSET_Y + gy * CELL_SIZE + CELL_SIZE / 2.0
        return (cx, cy)

    def _get_segment_radius(self, index: int, total_length: int) -> float:
        """Calculate smoothly tapered segment radius from head to tail."""
        base_r = CELL_SIZE * 0.44

        if index == 0:
            return base_r  # Head
        elif index <= 2:
            return base_r * 0.98  # Neck

        # Tail tapering over last 4 segments
        tail_distance = total_length - 1 - index
        if tail_distance < 4:
            taper_factor = 0.45 + (tail_distance / 4.0) * 0.50
            return max(CELL_SIZE * 0.18, base_r * taper_factor)

        return base_r * 0.94

    def draw(self, surface: pygame.Surface):
        """Render the realistic snake with drop shadows, continuous body joints,

        3D scale shading, directional head, eyes, and flicking tongue.
        """
        if not self.body:
            return

        total_segments = len(self.body)
        pixel_centers = [self._grid_to_pixel(gx, gy) for gx, gy in self.body]

        # -----------------------------------------------------------------
        # 1. GROUND DROP SHADOW (Continuous underbelly shadow)
        # -----------------------------------------------------------------
        shadow_surf = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        shadow_offset = (2, 3)

        for i in range(total_segments - 1, -1, -1):
            cx, cy = pixel_centers[i]
            r = self._get_segment_radius(i, total_segments)
            sx = int(cx + shadow_offset[0])
            sy = int(cy + shadow_offset[1])

            # Draw connector shadow to previous segment
            if i < total_segments - 1:
                ncx, ncy = pixel_centers[i + 1]
                nsx = int(ncx + shadow_offset[0])
                nsy = int(ncy + shadow_offset[1])
                nr = self._get_segment_radius(i + 1, total_segments)
                pygame.draw.line(shadow_surf, SNAKE_SHADOW_COLOR, (sx, sy), (nsx, nsy), int((r + nr) * 0.85))

            pygame.draw.circle(shadow_surf, SNAKE_SHADOW_COLOR, (sx, sy), int(r * 0.95))

        surface.blit(shadow_surf, (0, 0))

        # -----------------------------------------------------------------
        # 2. CONTINUOUS BODY JOINTS & CYLINDERS (Drawn from tail to neck)
        # -----------------------------------------------------------------
        for i in range(total_segments - 1, 0, -1):
            cx, cy = pixel_centers[i]
            prev_cx, prev_cy = pixel_centers[i - 1]
            r = self._get_segment_radius(i, total_segments)
            pr = self._get_segment_radius(i - 1, total_segments)

            # Connector capsule between adjacent segments
            connector_width = int((r + pr) * 0.92)
            pygame.draw.line(
                surface,
                SNAKE_BODY_DARK,
                (int(cx), int(cy)),
                (int(prev_cx), int(prev_cy)),
                connector_width,
            )
            pygame.draw.line(
                surface,
                SNAKE_BODY_COLOR,
                (int(cx), int(cy)),
                (int(prev_cx), int(prev_cy)),
                max(2, connector_width - 3),
            )

            # Segment base circle
            pygame.draw.circle(surface, SNAKE_BODY_DARK, (int(cx), int(cy)), int(r))
            pygame.draw.circle(surface, SNAKE_BODY_COLOR, (int(cx), int(cy)), int(r - 1.5))

            # 3D dorsal scale highlight (offset towards light source top-left)
            light_offset_x = -r * 0.25
            light_offset_y = -r * 0.25
            highlight_r = max(1.5, r * 0.45)
            pygame.draw.circle(
                surface,
                SNAKE_DORSAL_RIDGE,
                (int(cx + light_offset_x), int(cy + light_offset_y)),
                int(highlight_r),
            )

            # Subtle dorsal scale chevron/diamond pattern
            if i % 2 == 0 and r > 6:
                pygame.draw.circle(
                    surface,
                    SCALE_MARK_COLOR,
                    (int(cx), int(cy)),
                    int(r * 0.25),
                )

        # -----------------------------------------------------------------
        # 3. ANIMATED FLICKING FORKED TONGUE (Rendered behind or at snout)
        # -----------------------------------------------------------------
        head_cx, head_cy = pixel_centers[0]
        dx, dy = self.direction.value

        if self.is_alive and self.tongue_flicking:
            # Animate extension in & out
            phase = self.tongue_flick_duration / 220.0  # 0.0 -> 1.0
            reach = math.sin(phase * math.pi) * (CELL_SIZE * 0.65)
            vibe = math.sin(self.tongue_flick_duration * 0.2) * 1.5

            # Tongue root at snout tip
            snout_tip_x = head_cx + dx * (CELL_SIZE * 0.48)
            snout_tip_y = head_cy + dy * (CELL_SIZE * 0.48)

            # Main tongue stem
            stem_end_x = snout_tip_x + dx * reach
            stem_end_y = snout_tip_y + dy * reach

            # Orthogonal vector for forks & vibration
            ox = -dy
            oy = dx

            stem_end_x += ox * vibe
            stem_end_y += oy * vibe

            pygame.draw.line(
                surface,
                TONGUE_COLOR,
                (int(snout_tip_x), int(snout_tip_y)),
                (int(stem_end_x), int(stem_end_y)),
                width=2,
            )

            # Forked tip branches
            fork_len = reach * 0.35
            fork_spread = reach * 0.25
            f1 = (
                stem_end_x + dx * fork_len + ox * fork_spread,
                stem_end_y + dy * fork_len + oy * fork_spread,
            )
            f2 = (
                stem_end_x + dx * fork_len - ox * fork_spread,
                stem_end_y + dy * fork_len - oy * fork_spread,
            )

            pygame.draw.line(surface, TONGUE_COLOR, (int(stem_end_x), int(stem_end_y)), (int(f1[0]), int(f1[1])), width=2)
            pygame.draw.line(surface, TONGUE_COLOR, (int(stem_end_x), int(stem_end_y)), (int(f2[0]), int(f2[1])), width=2)

        # -----------------------------------------------------------------
        # 4. SCULPTED SNAKE HEAD
        # -----------------------------------------------------------------
        head_r = self._get_segment_radius(0, total_segments)

        # Draw head oval elongated forward
        snout_center_x = head_cx + dx * (head_r * 0.35)
        snout_center_y = head_cy + dy * (head_r * 0.35)

        # Base dark head rim
        pygame.draw.circle(surface, SNAKE_BODY_DARK, (int(snout_center_x), int(snout_center_y)), int(head_r + 1))
        # Main head crown
        pygame.draw.circle(surface, SNAKE_HEAD_COLOR, (int(snout_center_x), int(snout_center_y)), int(head_r))

        # Dorsal head highlight plate
        pygame.draw.circle(
            surface,
            SNAKE_DORSAL_RIDGE,
            (int(snout_center_x - dx * 2 - 2), int(snout_center_y - dy * 2 - 2)),
            int(head_r * 0.42),
        )

        # Nostrils (small subtle pits near snout tip)
        ox = -dy
        oy = dx
        nostril_dist = head_r * 0.32
        n1 = (
            int(snout_center_x + dx * (head_r * 0.65) + ox * nostril_dist),
            int(snout_center_y + dy * (head_r * 0.65) + oy * nostril_dist),
        )
        n2 = (
            int(snout_center_x + dx * (head_r * 0.65) - ox * nostril_dist),
            int(snout_center_y + dy * (head_r * 0.65) - oy * nostril_dist),
        )
        pygame.draw.circle(surface, SNAKE_OUTLINE_COLOR, n1, 1)
        pygame.draw.circle(surface, SNAKE_OUTLINE_COLOR, n2, 1)

        # -----------------------------------------------------------------
        # 5. EXPRESSIVE SERPENT EYES
        # -----------------------------------------------------------------
        eye_forward = head_r * 0.15
        eye_lateral = head_r * 0.55
        eye_r = max(2.5, head_r * 0.30)

        eye1_pos = (
            int(head_cx + dx * eye_forward + ox * eye_lateral),
            int(head_cy + dy * eye_forward + oy * eye_lateral),
        )
        eye2_pos = (
            int(head_cx + dx * eye_forward - ox * eye_lateral),
            int(head_cy + dy * eye_forward - oy * eye_lateral),
        )

        for eye_x, eye_y in [eye1_pos, eye2_pos]:
            if self.is_alive:
                # Sclera (almond eye white with soft dark outline)
                pygame.draw.circle(surface, SNAKE_OUTLINE_COLOR, (eye_x, eye_y), int(eye_r + 1))
                pygame.draw.circle(surface, EYE_WHITE, (eye_x, eye_y), int(eye_r))

                # Vertical slit / focused pupil looking forward in movement direction
                pupil_offset_x = dx * (eye_r * 0.35)
                pupil_offset_y = dy * (eye_r * 0.35)
                pupil_center = (int(eye_x + pupil_offset_x), int(eye_y + pupil_offset_y))
                pygame.draw.circle(surface, EYE_PUPIL, pupil_center, max(1, int(eye_r * 0.6)))

                # Specular light reflection glint dot (makes eyes look wet, glossy, alive)
                glint_pos = (int(eye_x - 1), int(eye_y - 1))
                pygame.draw.circle(surface, EYE_GLINT, glint_pos, 1)
            else:
                # Knocked-out 'X' eyes on death
                s = int(eye_r * 0.9)
                pygame.draw.line(surface, EYE_DEAD, (eye_x - s, eye_y - s), (eye_x + s, eye_y + s), width=2)
                pygame.draw.line(surface, EYE_DEAD, (eye_x - s, eye_y + s), (eye_x + s, eye_y - s), width=2)
