import collections
import random
from enum import Enum
from typing import List, Optional
import pygame

from snake_game.entities.snake import Snake
from snake_game.entities.food import Food
from snake_game.entities.direction import Direction
from snake_game.core.collision import (
    check_food_collision,
    find_eaten_food,
    check_wall_collision,
    check_self_collision,
)
from snake_game.core.highscore import HighScoreManager
from snake_game.core.particles import ParticleManager
from snake_game.ui.hud import HUD, get_font
from snake_game.settings import (
    WINDOW_WIDTH,
    WINDOW_HEIGHT,
    WINDOW_TITLE,
    BACKGROUND_COLOR,
    FPS,
    GRID_COLUMNS,
    GRID_ROWS,
    LEVEL_TIMER_START_LEVEL,
    LEVEL_TIMER_SECONDS,
    LEVEL_THRESHOLDS,
    LEVEL_SPEEDS,
    LEVEL_MAX_FOODS,
    BONUS_FRUIT_DURATION,
    BONUS_FRUIT_INTERVAL,
)


class GameState(Enum):
    START = "START"
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"
    GAME_OVER = "GAME_OVER"


class Game:
    """Main Game controller for Realistic Snake Pro with multi-level progression,

    fruit varieties, 2-minute timer frenzy after Level 4, and Big Golden Bonus Fruits.
    """

    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WINDOW_WIDTH, WINDOW_HEIGHT))
        pygame.display.set_caption(WINDOW_TITLE)
        self.clock = pygame.time.Clock()

        # Managers & UI
        self.hud = HUD()
        self.highscore_mgr = HighScoreManager()
        self.particle_mgr = ParticleManager()
        self.floating_font = get_font(18, bold=True)

        # Game State
        self.state: GameState = GameState.START
        self.running: bool = True

        # Input buffer (prevents dropped inputs or 180-degree self-collisions)
        self.input_queue = collections.deque(maxlen=2)

        # Gameplay Entities & Metrics
        self.snake = Snake()
        self.foods: List[Food] = []

        self.score: int = 0
        self.food_eaten: int = 0
        self.level: int = 1
        self.level_fruits_eaten: int = 0
        self.is_timed_mode: bool = False
        self.timer_seconds: float = float(LEVEL_TIMER_SECONDS)
        self.bonus_spawn_timer: float = 0.0

        self.death_reason: str = ""
        self.is_new_record: bool = False
        self.movement_timer: float = 0.0

        # Start with fresh setup
        self.reset_game(to_start_screen=True)

    @property
    def food(self) -> Optional[Food]:
        """Backward compatibility for single food reference."""
        return self.foods[0] if self.foods else None

    def reset_game(self, to_start_screen: bool = False):
        """Reset entities and metrics for a fresh round."""
        self.snake.reset()
        self.foods.clear()

        self.score = 0
        self.food_eaten = 0
        self.level = 1
        self.level_fruits_eaten = 0
        self.is_timed_mode = False
        self.timer_seconds = float(LEVEL_TIMER_SECONDS)
        self.bonus_spawn_timer = 0.0

        self.death_reason = ""
        self.is_new_record = False
        self.movement_timer = 0.0
        self.input_queue.clear()
        self.particle_mgr.clear()

        # Initial food spawn
        self._replenish_foods()

        self.state = GameState.START if to_start_screen else GameState.PLAYING

    def _get_available_fruit_kinds(self) -> List[str]:
        """Return allowed fruit varieties depending on current level."""
        if self.level == 1:
            return ["apple"]
        elif self.level == 2:
            return ["apple", "grapes"]
        elif self.level == 3:
            return ["apple", "grapes", "orange"]
        else:
            return ["apple", "grapes", "orange", "strawberry"]

    def _replenish_foods(self):
        """Maintain appropriate fruit count on the board (Level 4+ features a rich feast of 6+ fruits!)."""
        target_count = LEVEL_MAX_FOODS.get(self.level, 6 if self.level >= 4 else 1)
        kinds = self._get_available_fruit_kinds()

        occupied = set(self.snake.body)
        for f in self.foods:
            occupied.add(f.position)

        while len(self.foods) < target_count:
            kind = random.choice(kinds)
            new_f = Food(kind=kind)
            if new_f.spawn(occupied):
                occupied.add(new_f.position)
                self.foods.append(new_f)
            else:
                break

    def _queue_direction(self, new_dir: Direction):
        """Safely buffer player direction changes, preventing reverse collisions."""
        last_dir = self.input_queue[-1] if self.input_queue else self.snake.direction
        if not last_dir.is_opposite(new_dir) and last_dir != new_dir:
            self.input_queue.append(new_dir)

    def handle_events(self):
        """Process keyboard inputs, window events, and user controls."""
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                return

            if event.type != pygame.KEYDOWN:
                continue

            # Global shortcuts
            if event.key == pygame.K_r:
                self.reset_game(to_start_screen=False)
                continue

            # Speed adjustment
            if event.key in (pygame.K_PLUS, pygame.K_EQUALS, pygame.K_KP_PLUS):
                self.snake.speed_up()
                continue
            elif event.key in (pygame.K_MINUS, pygame.K_KP_MINUS):
                self.snake.slow_down()
                continue

            # Directional mapping (WASD & Arrow Keys)
            key_directions = {
                pygame.K_UP: Direction.UP,
                pygame.K_w: Direction.UP,
                pygame.K_DOWN: Direction.DOWN,
                pygame.K_s: Direction.DOWN,
                pygame.K_LEFT: Direction.LEFT,
                pygame.K_a: Direction.LEFT,
                pygame.K_RIGHT: Direction.RIGHT,
                pygame.K_d: Direction.RIGHT,
            }

            if self.state == GameState.START:
                if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                    self.state = GameState.PLAYING
                elif event.key in key_directions:
                    self.snake.direction = key_directions[event.key]
                    self.state = GameState.PLAYING

            elif self.state == GameState.PLAYING:
                if event.key in (pygame.K_SPACE, pygame.K_p, pygame.K_ESCAPE):
                    self.state = GameState.PAUSED
                elif event.key in key_directions:
                    self._queue_direction(key_directions[event.key])

            elif self.state == GameState.PAUSED:
                if event.key in (pygame.K_SPACE, pygame.K_p):
                    self.state = GameState.PLAYING
                elif event.key == pygame.K_ESCAPE:
                    self.state = GameState.START

            elif self.state == GameState.GAME_OVER:
                if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                    self.reset_game(to_start_screen=False)
                elif event.key == pygame.K_ESCAPE:
                    self.reset_game(to_start_screen=True)

    def update(self, delta_time: float):
        """Update game physics, level timers, entity animations, and bonus fruit spawns."""
        # 1. Update fruit animations & clean expired golden bonus fruits
        for f in self.foods:
            f.update(delta_time)
        self.foods = [f for f in self.foods if not f.is_expired]

        # Ensure board is populated with fruits
        self._replenish_foods()

        # Update snake tongue animation & particle effects
        self.snake.update_animation(delta_time)
        self.particle_mgr.update()

        if self.state != GameState.PLAYING:
            return

        # 2. Level 4+ Countdown Timer (2-Minute Frenzy!)
        if self.is_timed_mode:
            self.timer_seconds -= delta_time / 1000.0
            if self.timer_seconds <= 0:
                self.timer_seconds = 0.0
                self._handle_death(f"Time's Up! You ate {self.food_eaten} fruits in 2 minutes!")
                return

        # 3. Big Golden Bonus Fruit periodic spawn (Level 4+)
        if self.level >= 4:
            self.bonus_spawn_timer += delta_time / 1000.0
            if self.bonus_spawn_timer >= BONUS_FRUIT_INTERVAL:
                self.bonus_spawn_timer = 0.0
                if not any(f.kind == "golden" for f in self.foods):
                    occupied = set(self.snake.body)
                    for f in self.foods:
                        occupied.add(f.position)
                    golden = Food(kind="golden", duration=BONUS_FRUIT_DURATION)
                    if golden.spawn(occupied):
                        self.foods.append(golden)
                        gx, gy = golden.pixel_center
                        self.particle_mgr.emit_floating_text(
                            "⭐ BONUS FRUIT!", gx, gy - 16, self.floating_font, color=(250, 204, 21)
                        )

        # 4. Snake Movement Step
        self.movement_timer += delta_time
        move_interval = self.snake.move_interval

        if self.movement_timer >= move_interval:
            if self.input_queue:
                next_dir = self.input_queue.popleft()
                self.snake.change_direction(next_dir)

            head_x, head_y = self.snake.head
            dx, dy = self.snake.direction.value
            next_position = (head_x + dx, head_y + dy)

            # Check Wall Collision
            if check_wall_collision(next_position, GRID_COLUMNS, GRID_ROWS):
                self._handle_death("Crashed into the arena wall!")
                return

            # Check Food Collision against all active fruits
            eaten_food = find_eaten_food(next_position, self.foods)
            will_eat = (eaten_food is not None)

            # Check Self Collision
            if check_self_collision(next_position, self.snake.body, grow=will_eat):
                self._handle_death("Ran into your own tail!")
                return

            # Advance snake forward
            self.snake.move(grow=will_eat)

            # Handle Ingesting Fruit
            if will_eat and eaten_food is not None:
                # Calculate earned points (bonus fruit = 100 pts!)
                speed_bonus = max(1, int((260 - self.snake.move_interval) / 30))
                points_earned = eaten_food.points * (1 if eaten_food.is_bonus else speed_bonus)
                self.score += points_earned
                self.food_eaten += 1
                self.level_fruits_eaten += 1

                if self.highscore_mgr.update(self.score):
                    self.is_new_record = True

                # Visual FX
                fcx, fcy = eaten_food.pixel_center
                self.particle_mgr.emit_food_burst(fcx, fcy)
                popup_text = f"+{points_earned} BONUS!" if eaten_food.is_bonus else f"+{points_earned}"
                popup_color = (250, 204, 21) if eaten_food.is_bonus else (74, 222, 128)
                self.particle_mgr.emit_floating_text(popup_text, fcx, fcy - 12, self.floating_font, color=popup_color)

                # Remove eaten fruit & replenish
                if eaten_food in self.foods:
                    self.foods.remove(eaten_food)
                self._replenish_foods()

                # Dynamic pace increase
                self.snake.increase_speed()

                # Check Level Progression
                target_fruits = LEVEL_THRESHOLDS.get(self.level, 30)
                if self.level_fruits_eaten >= target_fruits:
                    self.level += 1
                    self.level_fruits_eaten = 0

                    # Slightly increase snake movement pace per level
                    if self.level in LEVEL_SPEEDS:
                        self.snake.move_interval = LEVEL_SPEEDS[self.level]
                    else:
                        self.snake.move_interval = max(65, self.snake.move_interval - 10)

                    # Trigger 2-Minute Frenzy Timer at Level 4
                    if self.level >= LEVEL_TIMER_START_LEVEL and not self.is_timed_mode:
                        self.is_timed_mode = True
                        self.timer_seconds = float(LEVEL_TIMER_SECONDS)

                    # Level Up celebratory visual burst
                    head_cx, head_cy = self.snake._grid_to_pixel(*self.snake.head)
                    self.particle_mgr.emit_food_burst(head_cx, head_cy)
                    lvl_banner = f"⭐ LEVEL {self.level}!" + (" 2-MIN FRENZY!" if self.level >= 4 else "")
                    self.particle_mgr.emit_floating_text(
                        lvl_banner, head_cx, head_cy - 20, self.floating_font, color=(250, 204, 21)
                    )

            self.movement_timer -= move_interval

    def _handle_death(self, reason: str):
        """Trigger death state, knock-out visuals, and high score persistence."""
        self.snake.is_alive = False
        self.death_reason = reason
        self.is_new_record = self.highscore_mgr.update(self.score)
        self.state = GameState.GAME_OVER

        head_cx, head_cy = self.snake._grid_to_pixel(*self.snake.head)
        self.particle_mgr.emit_food_burst(head_cx, head_cy)

    def render(self):
        """Draw complete scene: arena, particles, fruits, snake, and HUD overlays."""
        self.screen.fill(BACKGROUND_COLOR)

        # 1. Arena Floor & Frame
        self.hud.draw_arena(self.screen)

        # 2. Interactive Game Entities (All active fruits & snake)
        for f in self.foods:
            f.draw(self.screen)
        self.snake.draw(self.screen)

        # 3. Particles & Floating Scores
        self.particle_mgr.draw(self.screen)

        # 4. Top Header HUD & Bottom Controls
        self.hud.draw_top_hud(
            self.screen,
            score=self.score,
            high_score=self.highscore_mgr.high_score,
            length=len(self.snake.body),
            speed_ms=self.snake.move_interval,
            level=self.level,
            timer_seconds=self.timer_seconds if self.is_timed_mode else None,
            is_new_record=self.is_new_record,
        )
        self.hud.draw_footer_controls(self.screen)

        # 5. Modal Overlays
        if self.state == GameState.START:
            self.hud.draw_start_screen(self.screen, self.highscore_mgr.high_score)
        elif self.state == GameState.PAUSED:
            self.hud.draw_pause_screen(
                self.screen, self.score, self.highscore_mgr.high_score
            )
        elif self.state == GameState.GAME_OVER:
            self.hud.draw_game_over_screen(
                self.screen,
                score=self.score,
                high_score=self.highscore_mgr.high_score,
                food_eaten=self.food_eaten,
                length=len(self.snake.body),
                death_reason=self.death_reason,
                level=self.level,
                is_new_record=self.is_new_record,
            )

        pygame.display.flip()

    def run(self):
        """Main game loop."""
        while self.running:
            delta_time = self.clock.tick(FPS)
            self.handle_events()
            self.update(delta_time)
            self.render()

        pygame.quit()
