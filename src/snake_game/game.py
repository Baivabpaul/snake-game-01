import collections
from enum import Enum
import pygame

from snake_game.entities.snake import Snake
from snake_game.entities.food import Food
from snake_game.entities.direction import Direction
from snake_game.core.collision import (
    check_food_collision,
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
    POINTS_PER_FOOD,
    GRID_COLUMNS,
    GRID_ROWS,
)


class GameState(Enum):
    START = "START"
    PLAYING = "PLAYING"
    PAUSED = "PAUSED"
    GAME_OVER = "GAME_OVER"


class Game:
    """Main Game controller for Realistic Snake Pro."""

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

        # Input buffer (prevents dropped inputs or 180-degree self-collisions on rapid key presses)
        self.input_queue = collections.deque(maxlen=2)

        # Gameplay Entities & Metrics
        self.snake = Snake()
        self.food = Food()
        self.score: int = 0
        self.food_eaten: int = 0
        self.death_reason: str = ""
        self.is_new_record: bool = False

        self.movement_timer: float = 0.0

        # Start with fresh setup
        self.reset_game(to_start_screen=True)

    def reset_game(self, to_start_screen: bool = False):
        """Reset entities and score for a fresh game round."""
        self.snake.reset()
        self.food.spawn(self.snake.body)
        self.score = 0
        self.food_eaten = 0
        self.death_reason = ""
        self.is_new_record = False
        self.movement_timer = 0.0
        self.input_queue.clear()
        self.particle_mgr.clear()
        self.state = GameState.START if to_start_screen else GameState.PLAYING

    def _queue_direction(self, new_dir: Direction):
        """Safely buffer player direction changes, preventing reverse collisions."""
        # Find the reference direction to check against
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
                # Instant restart
                self.reset_game(to_start_screen=False)
                continue

            # Speed adjustment controls
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

            # State-specific event handling
            if self.state == GameState.START:
                if event.key in (pygame.K_SPACE, pygame.K_RETURN):
                    self.state = GameState.PLAYING
                elif event.key in key_directions:
                    # Pressing any arrow/WASD directly starts the game in that direction!
                    new_dir = key_directions[event.key]
                    self.snake.direction = new_dir
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
        """Update game physics, entity animations, timers, and particle effects."""
        # Always update animations and particles for smooth visual feel
        self.food.update(delta_time)
        self.snake.update_animation(delta_time)
        self.particle_mgr.update()

        # Gameplay update is only active in PLAYING state
        if self.state != GameState.PLAYING:
            return

        self.movement_timer += delta_time
        move_interval = self.snake.move_interval

        if self.movement_timer >= move_interval:
            # Drain one direction input from buffer if available
            if self.input_queue:
                next_dir = self.input_queue.popleft()
                self.snake.change_direction(next_dir)

            head_x, head_y = self.snake.head
            dx, dy = self.snake.direction.value
            next_position = (head_x + dx, head_y + dy)

            # 1. Wall Collision Check
            if check_wall_collision(next_position, GRID_COLUMNS, GRID_ROWS):
                self._handle_death("Crashed into the arena wall!")
                return

            # 2. Food Collision Check
            will_eat = check_food_collision(next_position, self.food)

            # 3. Self Collision Check
            if check_self_collision(next_position, self.snake.body, grow=will_eat):
                self._handle_death("Ran into your own tail!")
                return

            # Move snake forward
            self.snake.move(grow=will_eat)

            # Handle Food Ingestion
            if will_eat:
                # Calculate points with speed multiplier
                speed_bonus = max(1, int((240 - self.snake.move_interval) / 30))
                points_earned = POINTS_PER_FOOD * speed_bonus
                self.score += points_earned
                self.food_eaten += 1

                # Check high score
                if self.highscore_mgr.update(self.score):
                    self.is_new_record = True

                # Visual FX: Juice burst and floating score popup
                food_cx, food_cy = self.food.pixel_center
                self.particle_mgr.emit_food_burst(food_cx, food_cy)
                self.particle_mgr.emit_floating_text(
                    f"+{points_earned}",
                    food_cx,
                    food_cy - 10,
                    self.floating_font,
                )

                # Increase snake movement pace
                self.snake.increase_speed()

                # Spawn next food item
                food_spawned = self.food.spawn(self.snake.body)
                if not food_spawned:
                    # Board completely filled (win condition)
                    self._handle_death("Incredible! You filled the entire board!")
                    return

            self.movement_timer -= move_interval

    def _handle_death(self, reason: str):
        """Trigger death state, knock-out visuals, and high score persistence."""
        self.snake.is_alive = False
        self.death_reason = reason
        self.is_new_record = self.highscore_mgr.update(self.score)
        self.state = GameState.GAME_OVER

        # Burst death particles at head location
        head_cx, head_cy = self.snake._grid_to_pixel(*self.snake.head)
        self.particle_mgr.emit_food_burst(head_cx, head_cy)

    def render(self):
        """Draw complete scene: background, arena, particles, food, snake, and HUD overlays."""
        self.screen.fill(BACKGROUND_COLOR)

        # 1. Render Arena Floor and Frame
        self.hud.draw_arena(self.screen)

        # 2. Render Interactive Game Entities
        self.food.draw(self.screen)
        self.snake.draw(self.screen)

        # 3. Render Particles & Floating Scores
        self.particle_mgr.draw(self.screen)

        # 4. Render Top HUD Bar and Bottom Controls Hint
        self.hud.draw_top_hud(
            self.screen,
            score=self.score,
            high_score=self.highscore_mgr.high_score,
            length=len(self.snake.body),
            speed_ms=self.snake.move_interval,
            is_new_record=self.is_new_record,
        )
        self.hud.draw_footer_controls(self.screen)

        # 5. Render Modal Overlays based on GameState
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
