import pygame
from typing import Tuple, Optional

from snake_game.settings import (
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
    ARENA_OFFSET_X,
    ARENA_OFFSET_Y,
    ARENA_WIDTH,
    ARENA_HEIGHT,
    CELL_SIZE,
    GRID_COLUMNS,
    GRID_ROWS,
    ARENA_BG_1,
    ARENA_BG_2,
    ARENA_BORDER_OUTER,
    ARENA_BORDER_INNER,
    HUD_BG,
    HUD_BORDER,
    CARD_BG,
    CARD_BORDER,
    FOOTER_BG,
    TEXT_WHITE,
    TEXT_MUTED,
    TEXT_ACCENT,
    TEXT_GOLD,
    TEXT_RED,
)


def get_font(size: int, bold: bool = False) -> pygame.font.Font:
    """Safely obtain system font with fallback to default pygame font."""
    try:
        font = pygame.font.SysFont(
            ["Helvetica Neue", "Arial", "Segoe UI", "DejaVu Sans", "sans-serif"],
            size,
            bold=bold,
        )
        if font:
            return font
    except Exception:
        pass
    return pygame.font.Font(None, size)


class HUD:
    """Handles rendering of the arena floor, header HUD, controls footer,

    and modal overlays for Start, Pause, and Game Over.
    """

    def __init__(self):
        pygame.font.init()
        self.font_logo = get_font(20, bold=True)
        self.font_title = get_font(32, bold=True)
        self.font_h2 = get_font(24, bold=True)
        self.font_body = get_font(16, bold=False)
        self.font_bold = get_font(16, bold=True)
        self.font_stat = get_font(18, bold=True)
        self.font_small = get_font(13, bold=False)
        self.font_tiny = get_font(11, bold=False)

        # Pre-render static arena background texture for 60 FPS performance
        self.arena_surface = self._create_arena_surface()

    def _create_arena_surface(self) -> pygame.Surface:
        """Pre-bake alternating checkerboard lawn tiles and border onto a surface."""
        surf = pygame.Surface((ARENA_WIDTH, ARENA_HEIGHT))

        for col in range(GRID_COLUMNS):
            for row in range(GRID_ROWS):
                color = ARENA_BG_1 if (col + row) % 2 == 0 else ARENA_BG_2
                rect = pygame.Rect(
                    col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE
                )
                pygame.draw.rect(surf, color, rect)

        # Subtle inner grid line dot in tile corners
        for col in range(1, GRID_COLUMNS):
            for row in range(1, GRID_ROWS):
                gx = col * CELL_SIZE
                gy = row * CELL_SIZE
                surf.set_at((gx, gy), (36, 52, 42))

        return surf

    def draw_arena(self, surface: pygame.Surface):
        """Draw the playfield arena with borders."""
        # Blit pre-rendered checkerboard floor
        surface.blit(self.arena_surface, (ARENA_OFFSET_X, ARENA_OFFSET_Y))

        # Outer metallic frame border
        outer_rect = pygame.Rect(
            ARENA_OFFSET_X - 2,
            ARENA_OFFSET_Y - 2,
            ARENA_WIDTH + 4,
            ARENA_HEIGHT + 4,
        )
        pygame.draw.rect(
            surface, ARENA_BORDER_OUTER, outer_rect, width=2, border_radius=6
        )

        # Inner highlight border
        inner_rect = pygame.Rect(
            ARENA_OFFSET_X,
            ARENA_OFFSET_Y,
            ARENA_WIDTH,
            ARENA_HEIGHT,
        )
        pygame.draw.rect(
            surface, ARENA_BORDER_INNER, inner_rect, width=1, border_radius=4
        )

    def draw_top_hud(
        self,
        surface: pygame.Surface,
        score: int,
        high_score: int,
        length: int,
        speed_ms: int,
        is_new_record: bool = False,
    ):
        """Draw sleek modern glassmorphism header bar with score cards and stats."""
        # HUD background strip
        hud_rect = pygame.Rect(0, 0, WINDOW_WIDTH, ARENA_OFFSET_Y - 4)
        pygame.draw.rect(surface, HUD_BG, hud_rect)
        pygame.draw.line(
            surface,
            HUD_BORDER,
            (0, ARENA_OFFSET_Y - 5),
            (WINDOW_WIDTH, ARENA_OFFSET_Y - 5),
            width=1,
        )

        # 1. Left Brand Title Badge
        badge_rect = pygame.Rect(ARENA_OFFSET_X, 12, 175, 42)
        pygame.draw.rect(
            surface, (24, 34, 46), badge_rect, border_radius=8
        )
        pygame.draw.rect(
            surface, (45, 62, 82), badge_rect, width=1, border_radius=8
        )

        logo_text = self.font_logo.render("🐍 SNAKE", True, TEXT_ACCENT)
        pro_text = self.font_tiny.render("PRO", True, TEXT_GOLD)
        surface.blit(logo_text, (badge_rect.x + 12, badge_rect.y + 7))
        surface.blit(pro_text, (badge_rect.x + 130, badge_rect.y + 14))

        # 2. Stats Cards
        card_start_x = badge_rect.right + 20
        card_w = 160
        card_h = 42
        spacing = 15

        # Card A: Score
        self._draw_stat_card(
            surface,
            card_start_x,
            12,
            card_w,
            card_h,
            label="SCORE",
            value=f"🍎 {score}",
            value_color=TEXT_WHITE,
        )

        # Card B: High Score
        high_color = TEXT_GOLD if is_new_record else (220, 225, 230)
        high_border = (250, 204, 21, 180) if is_new_record else CARD_BORDER
        self._draw_stat_card(
            surface,
            card_start_x + (card_w + spacing),
            12,
            card_w,
            card_h,
            label="RECORD",
            value=f"🏆 {high_score}",
            value_color=high_color,
            border_color=high_border,
            glow=is_new_record,
        )

        # Card C: Snake Length
        self._draw_stat_card(
            surface,
            card_start_x + (card_w + spacing) * 2,
            12,
            card_w,
            card_h,
            label="LENGTH",
            value=f"📏 {length}",
            value_color=TEXT_WHITE,
        )

        # Card D: Speed / Pace
        speed_level = max(1, min(10, int((240 - speed_ms) / 19) + 1))
        self._draw_stat_card(
            surface,
            card_start_x + (card_w + spacing) * 3,
            12,
            card_w,
            card_h,
            label="SPEED [+/-]",
            value=f"⚡ Lv.{speed_level} ({speed_ms}ms)",
            value_color=TEXT_ACCENT,
        )

    def _draw_stat_card(
        self,
        surface: pygame.Surface,
        x: int,
        y: int,
        w: int,
        h: int,
        label: str,
        value: str,
        value_color: Tuple[int, int, int],
        border_color: Tuple[int, int, int] = CARD_BORDER,
        glow: bool = False,
    ):
        """Draw an individual status metric card with label and value."""
        rect = pygame.Rect(x, y, w, h)
        pygame.draw.rect(surface, CARD_BG, rect, border_radius=6)
        pygame.draw.rect(surface, border_color, rect, width=1, border_radius=6)

        lbl_surf = self.font_tiny.render(label, True, TEXT_MUTED)
        val_surf = self.font_stat.render(value, True, value_color)

        surface.blit(lbl_surf, (x + 10, y + 5))
        surface.blit(val_surf, (x + 10, y + 19))

    def draw_footer_controls(self, surface: pygame.Surface):
        """Draw bottom hint bar with clear, human-friendly control keys."""
        footer_y = ARENA_OFFSET_Y + ARENA_HEIGHT + 4
        footer_h = WINDOW_HEIGHT - footer_y

        footer_rect = pygame.Rect(0, footer_y, WINDOW_WIDTH, footer_h)
        pygame.draw.rect(surface, FOOTER_BG, footer_rect)
        pygame.draw.line(
            surface,
            HUD_BORDER,
            (0, footer_y),
            (WINDOW_WIDTH, footer_y),
            width=1,
        )

        controls_text = (
            "🎮 CONTROLS:  [W/A/S/D] or [ARROWS] Move   •   [SPACE / P] Pause   •   [R] Restart   •   [+ / -] Speed   •   [ESC] Menu"
        )
        ctrl_surf = self.font_small.render(controls_text, True, TEXT_MUTED)
        text_x = (WINDOW_WIDTH - ctrl_surf.get_width()) // 2
        text_y = footer_y + (footer_h - ctrl_surf.get_height()) // 2
        surface.blit(ctrl_surf, (text_x, text_y))

    def draw_start_screen(self, surface: pygame.Surface, high_score: int):
        """Draw friendly welcoming start screen overlay with controls instructions."""
        self._draw_dim_backdrop(surface, alpha=180)

        card_w = 580
        card_h = 420
        card_x = (WINDOW_WIDTH - card_w) // 2
        card_y = (WINDOW_HEIGHT - card_h) // 2

        self._draw_dialog_box(surface, card_x, card_y, card_w, card_h)

        # Title
        title_surf = self.font_title.render("🐍 REALISTIC SNAKE PRO", True, TEXT_ACCENT)
        surface.blit(
            title_surf,
            (card_x + (card_w - title_surf.get_width()) // 2, card_y + 28),
        )

        subtitle_surf = self.font_body.render(
            "Organic Sinuous Physics  •  3D Fruits  •  Dynamic Speed", True, TEXT_MUTED
        )
        surface.blit(
            subtitle_surf,
            (card_x + (card_w - subtitle_surf.get_width()) // 2, card_y + 70),
        )

        # Trophy record pill
        rec_pill = pygame.Rect(card_x + 190, card_y + 105, 200, 32)
        pygame.draw.rect(surface, (36, 48, 62), rec_pill, border_radius=16)
        pygame.draw.rect(surface, (60, 80, 105), rec_pill, width=1, border_radius=16)
        rec_text = self.font_body.render(f"🏆 Best Score: {high_score}", True, TEXT_GOLD)
        surface.blit(
            rec_text,
            (rec_pill.x + (rec_pill.w - rec_text.get_width()) // 2, rec_pill.y + 7),
        )

        # Instructions grid box
        box_rect = pygame.Rect(card_x + 40, card_y + 155, card_w - 80, 160)
        pygame.draw.rect(surface, (18, 25, 34), box_rect, border_radius=8)
        pygame.draw.rect(surface, (35, 48, 64), box_rect, width=1, border_radius=8)

        instructions = [
            ("Move / Slither", "[W / A / S / D] or [Arrow Keys]"),
            ("Pause Game", "[SPACE] or [P]"),
            ("Speed Up / Down", "[+] / [-] (adjust difficulty any time)"),
            ("Quick Restart", "[R]"),
        ]

        curr_y = box_rect.y + 16
        for action, key in instructions:
            act_surf = self.font_body.render(action, True, TEXT_WHITE)
            key_surf = self.font_bold.render(key, True, TEXT_ACCENT)
            surface.blit(act_surf, (box_rect.x + 20, curr_y))
            surface.blit(key_surf, (box_rect.right - key_surf.get_width() - 20, curr_y))
            curr_y += 34

        # Start CTA button
        cta_rect = pygame.Rect(card_x + 90, card_y + 340, card_w - 180, 48)
        pygame.draw.rect(surface, (34, 160, 80), cta_rect, border_radius=8)
        pygame.draw.rect(surface, (74, 222, 128), cta_rect, width=1, border_radius=8)

        cta_text = self.font_h2.render("Press SPACE to Play", True, TEXT_WHITE)
        surface.blit(
            cta_text,
            (cta_rect.x + (cta_rect.w - cta_text.get_width()) // 2, cta_rect.y + 10),
        )

    def draw_pause_screen(
        self, surface: pygame.Surface, score: int, high_score: int
    ):
        """Draw clean pause overlay modal with resume instructions."""
        self._draw_dim_backdrop(surface, alpha=160)

        card_w = 460
        card_h = 280
        card_x = (WINDOW_WIDTH - card_w) // 2
        card_y = (WINDOW_HEIGHT - card_h) // 2

        self._draw_dialog_box(surface, card_x, card_y, card_w, card_h)

        # Title
        pause_title = self.font_title.render("⏸  GAME PAUSED", True, TEXT_GOLD)
        surface.blit(
            pause_title,
            (card_x + (card_w - pause_title.get_width()) // 2, card_y + 35),
        )

        # Current Score info
        info_text = f"Current Score: {score}   |   Record: {high_score}"
        info_surf = self.font_body.render(info_text, True, TEXT_WHITE)
        surface.blit(
            info_surf,
            (card_x + (card_w - info_surf.get_width()) // 2, card_y + 88),
        )

        # Action hints
        hints = [
            ("Press [SPACE] or [P]", "Resume Game"),
            ("Press [R]", "Restart New Game"),
            ("Press [ESC]", "Return to Menu"),
        ]

        hy = card_y + 135
        for key_text, desc in hints:
            kt_surf = self.font_bold.render(key_text, True, TEXT_ACCENT)
            desc_surf = self.font_body.render(desc, True, TEXT_MUTED)
            surface.blit(kt_surf, (card_x + 60, hy))
            surface.blit(desc_surf, (card_x + 235, hy))
            hy += 34

    def draw_game_over_screen(
        self,
        surface: pygame.Surface,
        score: int,
        high_score: int,
        food_eaten: int,
        length: int,
        death_reason: str,
        is_new_record: bool = False,
    ):
        """Draw game over results dialog with stats and play again action."""
        self._draw_dim_backdrop(surface, alpha=195)

        card_w = 540
        card_h = 390
        card_x = (WINDOW_WIDTH - card_w) // 2
        card_y = (WINDOW_HEIGHT - card_h) // 2

        self._draw_dialog_box(surface, card_x, card_y, card_w, card_h)

        # Game over title
        go_title = self.font_title.render("GAME OVER", True, TEXT_RED)
        surface.blit(
            go_title,
            (card_x + (card_w - go_title.get_width()) // 2, card_y + 26),
        )

        # Cause of death
        reason_surf = self.font_body.render(death_reason, True, TEXT_MUTED)
        surface.blit(
            reason_surf,
            (card_x + (card_w - reason_surf.get_width()) // 2, card_y + 68),
        )

        # New high score celebration banner
        if is_new_record:
            rec_pill = pygame.Rect(card_x + 130, card_y + 98, 280, 28)
            pygame.draw.rect(surface, (180, 83, 9), rec_pill, border_radius=14)
            pygame.draw.rect(surface, TEXT_GOLD, rec_pill, width=1, border_radius=14)
            rec_surf = self.font_bold.render("🎉 NEW ALL-TIME RECORD! 🎉", True, TEXT_WHITE)
            surface.blit(
                rec_surf,
                (rec_pill.x + (rec_pill.w - rec_surf.get_width()) // 2, rec_pill.y + 5),
            )

        # Stats summary box
        stats_y = card_y + (138 if is_new_record else 115)
        stats_box = pygame.Rect(card_x + 40, stats_y, card_w - 80, 130)
        pygame.draw.rect(surface, (18, 25, 34), stats_box, border_radius=8)
        pygame.draw.rect(surface, (35, 48, 64), stats_box, width=1, border_radius=8)

        stats = [
            ("Final Score", f"🍎 {score}", TEXT_WHITE),
            ("High Score", f"🏆 {high_score}", TEXT_GOLD),
            ("Apples Eaten", f"{food_eaten}", TEXT_ACCENT),
            ("Snake Length", f"🐍 {length} segments", TEXT_WHITE),
        ]

        sy = stats_box.y + 14
        for label, val, color in stats:
            lbl_surf = self.font_body.render(label, True, TEXT_MUTED)
            val_surf = self.font_bold.render(val, True, color)
            surface.blit(lbl_surf, (stats_box.x + 20, sy))
            surface.blit(val_surf, (stats_box.right - val_surf.get_width() - 20, sy))
            sy += 27

        # Action buttons prompt
        action_y = stats_box.bottom + 18
        cta_rect = pygame.Rect(card_x + 70, action_y, card_w - 140, 46)
        pygame.draw.rect(surface, (34, 160, 80), cta_rect, border_radius=8)
        pygame.draw.rect(surface, (74, 222, 128), cta_rect, width=1, border_radius=8)

        cta_text = self.font_h2.render("Press SPACE to Play Again", True, TEXT_WHITE)
        surface.blit(
            cta_text,
            (cta_rect.x + (cta_rect.w - cta_text.get_width()) // 2, cta_rect.y + 9),
        )

    def _draw_dim_backdrop(self, surface: pygame.Surface, alpha: int = 180):
        """Draw a full-screen semi-transparent dimming layer."""
        dim = pygame.Surface(surface.get_size(), pygame.SRCALPHA)
        dim.fill((10, 14, 20, alpha))
        surface.blit(dim, (0, 0))

    def _draw_dialog_box(
        self, surface: pygame.Surface, x: int, y: int, w: int, h: int
    ):
        """Draw standard dark glassmorphism dialog modal container."""
        dialog_rect = pygame.Rect(x, y, w, h)
        pygame.draw.rect(surface, (22, 30, 40), dialog_rect, border_radius=12)
        pygame.draw.rect(surface, (45, 62, 82), dialog_rect, width=2, border_radius=12)
