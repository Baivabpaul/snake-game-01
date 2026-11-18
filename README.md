# 🐍 Realistic Snake Pro

A realistic, modern, and polished Snake game built with Python and Pygame.

---

## 🌟 Key Features

### 🐍 Realistic Snake Mechanics & Visuals
- **Continuous Sinuous Body**: Instead of disjointed blocks, segments connect with organic capsule joints and 3D cylindrical lighting.
- **Organic Tapering**: Smoothly tapers from a full-bodied neck and chest down to a pointed, realistic tail tip.
- **3D Scale Shading & Depth**: Features drop shadows cast onto the arena floor, dorsal spine highlights, and fine scale markings.
- **Directional Sculpted Head**: Contoured serpent snout with nostril pits and expressive eyes featuring pupils, white sclera, and specular light reflections that gaze where the snake is moving.
- **Animated Forked Tongue**: A realistic pink/red forked tongue periodically flicks out, vibrates, and zips back into the mouth.
- **Knocked-out Death State**: Expressive knocked-out eyes upon collision with walls or self.

### 🍎 Fruit Varieties & Big Bonus Fruits
- 🍎 **Red Apples (10 pts)**: Classic juicy fruit with stem and leaf.
- 🍇 **Purple Grapes (20 pts)**: Clustered 3D violet berries (unlocks at Level 2).
- 🍊 **Fresh Oranges (30 pts)**: Citrus fruit with textured peel (unlocks at Level 3).
- 🍓 **Sweet Strawberries (40 pts)**: Teardrop ruby fruit with yellow seeds and crown (unlocks at Level 4).
- ⭐ **Big Golden Bonus Fruit (100 pts)**: Spawns periodically with a radiating aura, sparkling stars, and an active circular countdown ring!

### ⏱️ Level Progression & Level 4+ 2-Minute Frenzy Mode
- **Levels 1 to 3**: Classic progression. Eat fruits to advance levels as the snake speed gradually picks up.
- **Level 4 and Above (The 2-Minute Frenzy!)**:
  - **Automatic 2-Minute Countdown Timer (`02:00`)**: The clock starts ticking down in the HUD!
  - **100+ Fruits Feast**: The board continuously maintains 6 to 8 fruits simultaneously across the arena for an endless eating feast.
  - **Challenging Pace**: Snake movement speed slightly increases with each level.
  - **Time's Up Victory Summary**: When the 2 minutes run out, your total fruits eaten and final score are evaluated for the leaderboard!

### 🎮 Human-Friendly UI & Live Score HUD
- **Glassmorphic Top Bar**: Displays live **Score**, persistent **High Score** (with record celebration), **Snake Length**, and current **Speed Level**.
- **Interactive Game States**:
  - **Start Screen**: Welcoming banner, controls summary, and quick start.
  - **Pause Menu**: Semi-transparent dark overlay with pause indicator and resume instructions.
  - **Game Over Screen**: Displays exact cause of death (*Crashed into wall* / *Ran into tail*), final score, apples eaten, length, and "Play Again" action.
- **Input Queue Buffering**: Smooth, responsive control handling that prevents rapid multi-key input drops or accidental 180° self-reversals.
- **Always-Visible Controls Footer**: Keybindings reference visible at the bottom of the screen.

---

## 🎮 Controls

| Key | Action |
| :--- | :--- |
| **`W` / `A` / `S` / `D`** or **Arrow Keys** | Slither / Change Direction |
| **`SPACE`** or **`P`** | Pause / Resume Game (or Start from menu) |
| **`R`** | Quick Restart |
| **`+`** / **`-`** | Increase / Decrease Speed Pace |
| **`ESC`** | Pause Game / Return to Menu |

---

## 🚀 How to Run

### 1. Web Browser Edition (Click & Play / Shareable via WhatsApp & MS Teams)
To launch the browser version locally and share it with colleagues:
```bash
python server.py
```
This serves the game and displays:
- **Local link**: `http://localhost:8000`
- **Network link**: `http://<your-ip>:8000` (shareable over office/home Wi-Fi on MS Teams or WhatsApp)

#### 🌐 Instant Public Hosting (Free Permanent Shareable Link):
- **Netlify Drop (Easiest - 10 seconds)**: Drag & drop the `web/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) to receive a public link you can share with anyone worldwide!
- **GitHub Pages**: Push this repo to GitHub and enable **GitHub Pages** under repository *Settings > Pages*.

---

### 2. Desktop Pygame Edition
```bash
source venv/bin/activate
python -m snake_game.main
```

---

## 📁 Project Structure

```
snake-game/
├── highscore.json                  # Persistent high scores
├── pyproject.toml                  # Project packaging configuration
├── requirements.txt                # Python dependencies (pygame-ce)
├── README.md                       # Documentation
└── src/
    └── snake_game/
        ├── __init__.py
        ├── main.py                 # Application entry point
        ├── game.py                 # Game state machine & main loop
        ├── settings.py             # Arena, palette, and gameplay constants
        ├── core/
        │   ├── collision.py        # Food, wall, and self collision checks
        │   ├── highscore.py        # Persistent JSON high score manager
        │   └── particles.py        # Juice droplet burst & floating score popups
        ├── entities/
        │   ├── direction.py        # Direction enum & reverse-movement validation
        │   ├── food.py             # Realistic 3D Apple entity with leaf & stem
        │   └── snake.py            # Organic serpent with scales, eyes & flicking tongue
        └── ui/
            ├── __init__.py
            └── hud.py              # Header HUD, checkerboard arena & modal overlays
```
