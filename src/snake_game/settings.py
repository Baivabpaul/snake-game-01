"""Game settings and visual configurations for Realistic Snake Pro."""

# Window configuration
WINDOW_WIDTH = 1000
WINDOW_HEIGHT = 700
WINDOW_TITLE = "Realistic Snake Pro"

# Performance
FPS = 60

# Grid & Arena layout
CELL_SIZE = 24
GRID_COLUMNS = 40
GRID_ROWS = 25
ARENA_WIDTH = GRID_COLUMNS * CELL_SIZE   # 960
ARENA_HEIGHT = GRID_ROWS * CELL_SIZE     # 600
ARENA_OFFSET_X = (WINDOW_WIDTH - ARENA_WIDTH) // 2  # 20
ARENA_OFFSET_Y = 68                                  # Leaves 68px for HUD, 32px for footer
FOOTER_OFFSET_Y = ARENA_OFFSET_Y + ARENA_HEIGHT      # 668

# Snake configuration
INITIAL_SNAKE_LENGTH = 3
INITIAL_SNAKE_SPEED = 165   # ms per movement step (relaxed pace)
MIN_SNAKE_SPEED = 65        # fastest possible speed (lowest interval)
MAX_SNAKE_SPEED = 260       # slowest speed
SPEED_INCREMENT = 3         # speed increase per food eaten

# Scoring
POINTS_PER_FOOD = 10
BONUS_SPEED_MULTIPLIER = True

# General colors (RGB)
BACKGROUND_COLOR = (15, 20, 26)
WHITE = (255, 255, 255)
GREEN = (46, 204, 113)
RED = (231, 76, 60)

# Arena colors
ARENA_BG_1 = (22, 32, 25)          # Subtle alternating checkerboard green/slate
ARENA_BG_2 = (26, 38, 30)
ARENA_BORDER_OUTER = (45, 68, 52)
ARENA_BORDER_INNER = (28, 44, 34)
ARENA_GRID_LINE = (30, 46, 36)

# HUD & UI colors
HUD_BG = (20, 27, 36)
HUD_BORDER = (35, 48, 64)
CARD_BG = (28, 38, 50)
CARD_BORDER = (45, 60, 78)
FOOTER_BG = (13, 17, 22)
TEXT_WHITE = (245, 247, 250)
TEXT_MUTED = (140, 160, 180)
TEXT_ACCENT = (74, 222, 128)
TEXT_GOLD = (250, 204, 21)
TEXT_RED = (248, 113, 113)

# Snake realistic colors
SNAKE_HEAD_COLOR = (34, 160, 80)
SNAKE_BODY_COLOR = (46, 180, 90)
SNAKE_BODY_DARK = (24, 115, 55)
SNAKE_DORSAL_RIDGE = (110, 230, 145)
SNAKE_TAIL_COLOR = (20, 100, 50)
SNAKE_OUTLINE_COLOR = (15, 80, 40)
SNAKE_SHADOW_COLOR = (0, 0, 0, 90)

# Snake details
EYE_WHITE = (250, 250, 240)
EYE_PUPIL = (20, 24, 28)
EYE_GLINT = (255, 255, 255)
EYE_DEAD = (239, 68, 68)
TONGUE_COLOR = (244, 63, 94)
SCALE_MARK_COLOR = (20, 105, 50)

# Food colors (Realistic 3D Apple)
FOOD_COLOR = (225, 29, 72)
FOOD_DARK = (159, 18, 57)
FOOD_HIGHLIGHT = (254, 205, 211)
FOOD_STEM = (120, 72, 36)
FOOD_LEAF = (34, 197, 94)
FOOD_LEAF_VEIN = (134, 239, 172)
FOOD_SHADOW = (0, 0, 0, 80)
