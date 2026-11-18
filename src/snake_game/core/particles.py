import math
import random
import pygame
from typing import List, Tuple


class Particle:
    """A single burst droplet or sparkle particle."""

    def __init__(self, x: float, y: float, color: Tuple[int, int, int], radius: float, vx: float, vy: float, lifetime: int):
        self.x = x
        self.y = y
        self.color = color
        self.radius = radius
        self.vx = vx
        self.vy = vy
        self.lifetime = lifetime
        self.max_lifetime = lifetime

    def update(self) -> bool:
        self.x += self.vx
        self.y += self.vy
        self.vx *= 0.94
        self.vy *= 0.94
        self.radius = max(0.5, self.radius * 0.96)
        self.lifetime -= 1
        return self.lifetime > 0

    def draw(self, surface: pygame.Surface):
        if self.lifetime <= 0:
            return
        alpha = int(255 * (self.lifetime / self.max_lifetime))
        p_surf = pygame.Surface((int(self.radius * 4) + 2, int(self.radius * 4) + 2), pygame.SRCALPHA)
        center = (p_surf.get_width() // 2, p_surf.get_height() // 2)
        r, g, b = self.color
        pygame.draw.circle(p_surf, (r, g, b, alpha), center, int(self.radius))
        # Specular bright center
        if self.radius > 2:
            pygame.draw.circle(p_surf, (255, 255, 255, alpha), center, max(1, int(self.radius * 0.4)))
        surface.blit(p_surf, (self.x - center[0], self.y - center[1]))


class FloatingText:
    """A floating score popup that drifts up and fades."""

    def __init__(self, text: str, x: float, y: float, color: Tuple[int, int, int], font: pygame.font.Font, lifetime: int = 40):
        self.text = text
        self.x = x
        self.y = y
        self.color = color
        self.font = font
        self.lifetime = lifetime
        self.max_lifetime = lifetime

    def update(self) -> bool:
        self.y -= 1.1
        self.lifetime -= 1
        return self.lifetime > 0

    def draw(self, surface: pygame.Surface):
        if self.lifetime <= 0:
            return
        alpha = int(255 * (self.lifetime / self.max_lifetime))
        text_surf = self.font.render(self.text, True, self.color)
        alpha_surf = pygame.Surface(text_surf.get_size(), pygame.SRCALPHA)
        alpha_surf.fill((255, 255, 255, alpha))
        text_surf.blit(alpha_surf, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
        # Center horizontally
        draw_x = self.x - text_surf.get_width() // 2
        draw_y = self.y - text_surf.get_height() // 2
        surface.blit(text_surf, (draw_x, draw_y))


class ParticleManager:
    """Manages all active particles and floating texts."""

    def __init__(self):
        self.particles: List[Particle] = []
        self.floating_texts: List[FloatingText] = []

    def emit_food_burst(self, x: float, y: float):
        colors = [
            (239, 68, 68),
            (244, 63, 94),
            (251, 113, 133),
            (250, 204, 21),
            (74, 222, 128),
            (255, 255, 255),
        ]
        for _ in range(16):
            angle = random.uniform(0, math.pi * 2)
            speed = random.uniform(1.5, 4.5)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            radius = random.uniform(2.0, 4.5)
            lifetime = random.randint(18, 30)
            color = random.choice(colors)
            self.particles.append(Particle(x, y, color, radius, vx, vy, lifetime))

    def emit_floating_text(self, text: str, x: float, y: float, font: pygame.font.Font, color: Tuple[int, int, int] = (250, 204, 21)):
        self.floating_texts.append(FloatingText(text, x, y, color, font))

    def update(self):
        self.particles = [p for p in self.particles if p.update()]
        self.floating_texts = [ft for ft in self.floating_texts if ft.update()]

    def draw(self, surface: pygame.Surface):
        for p in self.particles:
            p.draw(surface)
        for ft in self.floating_texts:
            ft.draw(surface)

    def clear(self):
        self.particles.clear()
        self.floating_texts.clear()
