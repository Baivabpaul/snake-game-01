/**
 * Realistic Snake Pro - Browser HTML5 Edition
 * Supports Multi-Level Progression, Fruit Varieties,
 * 2-Minute Frenzy Mode after Level 4, and Big Golden Bonus Fruits.
 */

(function () {
  // Canvas & Context
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Layout & Arena Configuration (Matches settings.py)
  const WINDOW_WIDTH = 1000;
  const WINDOW_HEIGHT = 700;
  const CELL_SIZE = 24;
  const GRID_COLUMNS = 40;
  const GRID_ROWS = 25;
  const ARENA_WIDTH = GRID_COLUMNS * CELL_SIZE; // 960
  const ARENA_HEIGHT = GRID_ROWS * CELL_SIZE; // 600
  const ARENA_OFFSET_X = Math.floor((WINDOW_WIDTH - ARENA_WIDTH) / 2); // 20
  const ARENA_OFFSET_Y = 68;

  // Speeds & Gameplay
  const INITIAL_SNAKE_LENGTH = 3;
  const INITIAL_SPEED = 165; // ms per tick
  const MIN_SPEED = 65;
  const MAX_SPEED = 260;
  const SPEED_INCREMENT = 3;

  // Level & Frenzy Constants
  const LEVEL_THRESHOLDS = { 1: 5, 2: 10, 3: 15, 4: 30, 5: 50 };
  const LEVEL_SPEEDS = { 1: 165, 2: 150, 3: 138, 4: 124, 5: 112 };
  const LEVEL_MAX_FOODS = { 1: 1, 2: 2, 3: 3, 4: 6, 5: 8 };
  const BONUS_DURATION = 14; // seconds before golden fruit disappears
  const BONUS_INTERVAL = 22; // seconds between bonus spawns

  // Directions
  const Direction = {
    UP: { x: 0, y: -1, name: "UP" },
    DOWN: { x: 0, y: 1, name: "DOWN" },
    LEFT: { x: -1, y: 0, name: "LEFT" },
    RIGHT: { x: 1, y: 0, name: "RIGHT" },
  };

  function isOpposite(d1, d2) {
    if (!d1 || !d2) return false;
    return d1.x === -d2.x && d1.y === -d2.y;
  }

  // Web Audio Synthesizer
  class SoundManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    playEat(isBonus = false) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBonus ? "triangle" : "sine";
      const now = this.ctx.currentTime;
      const startFreq = isBonus ? 440 : 320;
      const endFreq = isBonus ? 1100 : 780;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + (isBonus ? 0.22 : 0.1));
      gain.gain.setValueAtTime(isBonus ? 0.35 : 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + (isBonus ? 0.24 : 0.12));
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + (isBonus ? 0.25 : 0.13));
    }

    playDeath() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    playRecord() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        const now = this.ctx.currentTime + idx * 0.08;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      });
    }
  }

  const sound = new SoundManager();

  // Particle System
  class Particle {
    constructor(x, y, color, radius, vx, vy, lifetime) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.radius = radius;
      this.vx = vx;
      this.vy = vy;
      this.lifetime = lifetime;
      this.maxLifetime = lifetime;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.94;
      this.vy *= 0.94;
      this.radius = Math.max(0.5, this.radius * 0.96);
      this.lifetime--;
      return this.lifetime > 0;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.lifetime / this.maxLifetime);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      if (this.radius > 2) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  class FloatingText {
    constructor(text, x, y, color = "#facc15", lifetime = 42) {
      this.text = text;
      this.x = x;
      this.y = y;
      this.color = color;
      this.lifetime = lifetime;
      this.maxLifetime = lifetime;
    }

    update() {
      this.y -= 1.1;
      this.lifetime--;
      return this.lifetime > 0;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.lifetime / this.maxLifetime);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.font = "bold 17px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
    }
  }

  // Fruit Class (Supports Apple, Grapes, Orange, Strawberry, and Big Golden Bonus)
  class Food {
    constructor(kind = "apple", duration = 0) {
      this.kind = kind;
      this.isBonus = (kind === "golden");
      this.duration = this.isBonus ? duration : 0;
      this.maxDuration = this.duration;
      this.x = 0;
      this.y = 0;
      this.animTimer = Math.random() * 1000;

      // Points map
      const pointsMap = { apple: 10, grapes: 20, orange: 30, strawberry: 40, golden: 100 };
      this.points = pointsMap[kind] || 10;
    }

    get isExpired() {
      return this.isBonus && this.duration <= 0;
    }

    update(dt) {
      this.animTimer += dt;
      if (this.isBonus && this.duration > 0) {
        this.duration -= dt / 1000;
      }
    }

    draw(ctx) {
      const cx = ARENA_OFFSET_X + this.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = ARENA_OFFSET_Y + this.y * CELL_SIZE + CELL_SIZE / 2;
      const bob = Math.sin(this.animTimer * (this.isBonus ? 0.008 : 0.005)) * (this.isBonus ? 2.2 : 1.5);
      const fruitY = cy + bob;

      // Drop shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      const shadowW = CELL_SIZE * (this.isBonus ? 0.55 : 0.45);
      ctx.ellipse(cx, cy + CELL_SIZE * 0.3, shadowW, CELL_SIZE * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (this.kind === "golden") {
        this.drawGolden(ctx, cx, fruitY);
      } else if (this.kind === "grapes") {
        this.drawGrapes(ctx, cx, fruitY);
      } else if (this.kind === "orange") {
        this.drawOrange(ctx, cx, fruitY);
      } else if (this.kind === "strawberry") {
        this.drawStrawberry(ctx, cx, fruitY);
      } else {
        this.drawApple(ctx, cx, fruitY);
      }
    }

    drawApple(ctx, cx, cy) {
      const appleW = CELL_SIZE * 0.78;
      const appleH = CELL_SIZE * 0.74;
      const r = appleW / 2;

      // Dark base lobe
      ctx.fillStyle = "rgb(159, 18, 57)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, appleW / 2, appleH / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Main red body lobes
      ctx.fillStyle = "rgb(225, 29, 72)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.22, cy + 1, r * 0.88, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.22, cy + 1, r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Highlight arc & glint
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 2, r * 0.65, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(cx - appleW * 0.22, cy - appleH * 0.22, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Stem & Leaf
      ctx.strokeStyle = "rgb(120, 72, 36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - appleH * 0.38);
      ctx.quadraticCurveTo(cx + 2, cy - appleH * 0.7, cx + 4, cy - appleH * 0.82);
      ctx.stroke();

      ctx.fillStyle = "rgb(34, 197, 94)";
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy - appleH * 0.55);
      ctx.lineTo(cx + 9, cy - appleH * 0.75);
      ctx.lineTo(cx + 12, cy - appleH * 0.6);
      ctx.lineTo(cx + 5, cy - appleH * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    drawGrapes(ctx, cx, cy) {
      const berries = [
        [-5, -3, 4.5], [0, -4, 4.8], [5, -3, 4.5],
        [-3, 1, 4.6], [3, 1, 4.6],
        [0, 5, 4.2]
      ];
      berries.forEach(([bx, by, br]) => {
        ctx.fillStyle = "rgb(107, 33, 168)";
        ctx.beginPath();
        ctx.arc(cx + bx, cy + by + 1, br, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(147, 51, 234)";
        ctx.beginPath();
        ctx.arc(cx + bx, cy + by, br - 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(216, 180, 254)";
        ctx.beginPath();
        ctx.arc(cx + bx - br * 0.3, cy + by - br * 0.3, 1, 0, Math.PI * 2);
        ctx.fill();
      });

      // Stem & leaf
      ctx.strokeStyle = "rgb(120, 72, 36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + 2, cy - 11);
      ctx.stroke();

      ctx.fillStyle = "rgb(34, 197, 94)";
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy - 8);
      ctx.lineTo(cx + 7, cy - 11);
      ctx.lineTo(cx + 5, cy - 7);
      ctx.closePath();
      ctx.fill();
    }

    drawOrange(ctx, cx, cy) {
      const r = CELL_SIZE * 0.38;
      ctx.fillStyle = "rgb(194, 65, 12)";
      ctx.beginPath();
      ctx.arc(cx, cy + 1, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgb(249, 115, 22)";
      ctx.beginPath();
      ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(254, 215, 170, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, r * 0.65, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();

      // Leaf
      ctx.fillStyle = "rgb(34, 197, 94)";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.7);
      ctx.lineTo(cx + 7, cy - r - 3);
      ctx.lineTo(cx + 7, cy - r + 2);
      ctx.closePath();
      ctx.fill();
    }

    drawStrawberry(ctx, cx, cy) {
      const pts = [
        [cx, cy + 9], [cx - 7, cy + 2], [cx - 8, cy - 4], [cx - 3, cy - 7],
        [cx, cy - 5], [cx + 3, cy - 7], [cx + 8, cy - 4], [cx + 7, cy + 2]
      ];
      ctx.fillStyle = "rgb(185, 28, 28)";
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py + 1) : ctx.lineTo(px, py + 1)));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgb(239, 68, 68)";
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.fill();

      // Yellow seeds
      ctx.fillStyle = "rgb(253, 224, 71)";
      [[-3, -2], [3, -2], [-4, 1], [0, 2], [4, 1], [-2, 5], [2, 5], [0, 7]].forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(cx + sx, cy + sy, 1, 0, Math.PI * 2);
        ctx.fill();
      });

      // Calyx crown
      ctx.fillStyle = "rgb(34, 197, 94)";
      ctx.beginPath();
      [[cx - 6, cy - 7], [cx - 3, cy - 9], [cx, cy - 6], [cx + 3, cy - 9], [cx + 6, cy - 7], [cx, cy - 5]].forEach(
        ([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
      );
      ctx.closePath();
      ctx.fill();
    }

    drawGolden(ctx, cx, cy) {
      const pulse = (Math.sin(this.animTimer * 0.01) + 1.0) / 2.0;
      const r = CELL_SIZE * 0.44 + pulse * 1.5;

      // Aura
      ctx.save();
      const auraR = r * 1.8 + pulse * 3;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, auraR);
      grad.addColorStop(0, "rgba(250, 204, 21, 0.4)");
      grad.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Gold sphere
      ctx.fillStyle = "rgb(202, 138, 4)";
      ctx.beginPath();
      ctx.arc(cx, cy + 1, r + 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgb(250, 204, 21)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgb(254, 240, 138)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Countdown Timer Ring
      if (this.maxDuration > 0 && this.duration > 0) {
        const frac = Math.max(0, Math.min(1, this.duration / this.maxDuration));
        ctx.strokeStyle = "rgba(60, 50, 20, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
        ctx.stroke();
      }
    }
  }

  // Pre-bake Checkerboard Floor Pattern
  const arenaCanvas = document.createElement("canvas");
  arenaCanvas.width = ARENA_WIDTH;
  arenaCanvas.height = ARENA_HEIGHT;
  const arenaCtx = arenaCanvas.getContext("2d");

  for (let c = 0; c < GRID_COLUMNS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      arenaCtx.fillStyle = (c + r) % 2 === 0 ? "rgb(22, 32, 25)" : "rgb(26, 38, 30)";
      arenaCtx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
  arenaCtx.fillStyle = "rgb(36, 52, 42)";
  for (let c = 1; c < GRID_COLUMNS; c++) {
    for (let r = 1; r < GRID_ROWS; r++) {
      arenaCtx.fillRect(c * CELL_SIZE - 0.5, r * CELL_SIZE - 0.5, 1, 1);
    }
  }

  // Game Engine Class
  class Game {
    constructor() {
      this.highScore = parseInt(localStorage.getItem("snake_high_score") || "0", 10);
      this.state = "START";
      this.score = 0;
      this.foodEaten = 0;
      this.level = 1;
      this.levelFruitsEaten = 0;
      this.isTimedMode = false;
      this.timerSeconds = 120.0;
      this.bonusSpawnTimer = 0.0;

      this.isNewRecord = false;
      this.deathReason = "";

      this.snake = [];
      this.foods = [];
      this.direction = Direction.RIGHT;
      this.inputQueue = [];
      this.moveInterval = INITIAL_SPEED;
      this.moveTimer = 0;

      this.isAlive = true;
      this.tongueTimer = 0;
      this.tongueFlicking = false;
      this.tongueFlickDuration = 0;

      this.particles = [];
      this.floatingTexts = [];

      this.reset(true);
    }

    reset(toStart = false) {
      const centerX = Math.floor(GRID_COLUMNS / 2);
      const centerY = Math.floor(GRID_ROWS / 2);

      this.snake = [];
      for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
        this.snake.push({ x: centerX - i, y: centerY });
      }

      this.direction = Direction.RIGHT;
      this.inputQueue = [];
      this.moveInterval = INITIAL_SPEED;
      this.moveTimer = 0;
      this.score = 0;
      this.foodEaten = 0;
      this.level = 1;
      this.levelFruitsEaten = 0;
      this.isTimedMode = false;
      this.timerSeconds = 120.0;
      this.bonusSpawnTimer = 0.0;

      this.isNewRecord = false;
      this.deathReason = "";
      this.isAlive = true;

      this.tongueTimer = 0;
      this.tongueFlicking = false;
      this.tongueFlickDuration = 0;

      this.particles = [];
      this.floatingTexts = [];
      this.foods = [];

      this.replenishFoods();
      this.state = toStart ? "START" : "PLAYING";
    }

    getAvailableFruitKinds() {
      if (this.level === 1) return ["apple"];
      if (this.level === 2) return ["apple", "grapes"];
      if (this.level === 3) return ["apple", "grapes", "orange"];
      return ["apple", "grapes", "orange", "strawberry"];
    }

    replenishFoods() {
      const targetCount = LEVEL_MAX_FOODS[this.level] || (this.level >= 4 ? 6 : 1);
      const kinds = this.getAvailableFruitKinds();

      const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
      this.foods.forEach((f) => occupied.add(`${f.x},${f.y}`));

      const free = [];
      for (let x = 0; x < GRID_COLUMNS; x++) {
        for (let y = 0; y < GRID_ROWS; y++) {
          if (!occupied.has(`${x},${y}`)) free.push({ x, y });
        }
      }

      while (this.foods.length < targetCount && free.length > 0) {
        const idx = Math.floor(Math.random() * free.length);
        const pos = free.splice(idx, 1)[0];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const newFood = new Food(kind);
        newFood.x = pos.x;
        newFood.y = pos.y;
        this.foods.push(newFood);
      }
    }

    queueDirection(newDir) {
      const lastDir = this.inputQueue.length > 0 ? this.inputQueue[this.inputQueue.length - 1] : this.direction;
      if (!isOpposite(lastDir, newDir) && lastDir !== newDir) {
        if (this.inputQueue.length < 2) {
          this.inputQueue.push(newDir);
        }
      }
    }

    gridToPixel(gx, gy) {
      return {
        x: ARENA_OFFSET_X + gx * CELL_SIZE + CELL_SIZE / 2,
        y: ARENA_OFFSET_Y + gy * CELL_SIZE + CELL_SIZE / 2,
      };
    }

    getSegmentRadius(index, total) {
      const baseR = CELL_SIZE * 0.44;
      if (index === 0) return baseR;
      if (index <= 2) return baseR * 0.98;
      const tailDist = total - 1 - index;
      if (tailDist < 4) {
        const factor = 0.45 + (tailDist / 4) * 0.5;
        return Math.max(CELL_SIZE * 0.18, baseR * factor);
      }
      return baseR * 0.94;
    }

    handleDeath(reason) {
      this.isAlive = false;
      this.deathReason = reason;
      this.state = "GAME_OVER";
      sound.playDeath();

      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.isNewRecord = true;
        localStorage.setItem("snake_high_score", this.highScore.toString());
        sound.playRecord();
      }

      const headPix = this.gridToPixel(this.snake[0].x, this.snake[0].y);
      this.emitFoodBurst(headPix.x, headPix.y);
    }

    emitFoodBurst(x, y, customColors = null) {
      const colors = customColors || ["#ef4444", "#f43f5e", "#fb7185", "#facc15", "#4ade80", "#ffffff"];
      for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const radius = 2 + Math.random() * 2.5;
        const lifetime = 18 + Math.floor(Math.random() * 12);
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.particles.push(new Particle(x, y, color, radius, vx, vy, lifetime));
      }
    }

    update(dt) {
      // 1. Update fruit animations & clean expired golden bonus fruits
      this.foods.forEach((f) => f.update(dt));
      this.foods = this.foods.filter((f) => !f.isExpired);
      this.replenishFoods();

      this.particles = this.particles.filter((p) => p.update());
      this.floatingTexts = this.floatingTexts.filter((ft) => ft.update());

      // Tongue animation
      if (this.isAlive) {
        this.tongueTimer += dt;
        if (!this.tongueFlicking) {
          if (this.tongueTimer >= 1700) {
            this.tongueFlicking = true;
            this.tongueFlickDuration = 0;
            this.tongueTimer = 0;
          }
        } else {
          this.tongueFlickDuration += dt;
          if (this.tongueFlickDuration >= 220) {
            this.tongueFlicking = false;
          }
        }
      }

      if (this.state !== "PLAYING") return;

      // 2. 2-Minute Timer Frenzy Mode (Level 4+)
      if (this.isTimedMode) {
        this.timerSeconds -= dt / 1000;
        if (this.timerSeconds <= 0) {
          this.timerSeconds = 0;
          this.handleDeath(`Time's Up! You ate ${this.foodEaten} fruits in 2 minutes!`);
          return;
        }
      }

      // 3. Periodic Big Golden Bonus Fruit Spawn (Level 4+)
      if (this.level >= 4) {
        this.bonusSpawnTimer += dt / 1000;
        if (this.bonusSpawnTimer >= BONUS_INTERVAL) {
          this.bonusSpawnTimer = 0;
          if (!this.foods.some((f) => f.isBonus)) {
            const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
            this.foods.forEach((f) => occupied.add(`${f.x},${f.y}`));
            const free = [];
            for (let x = 0; x < GRID_COLUMNS; x++) {
              for (let y = 0; y < GRID_ROWS; y++) {
                if (!occupied.has(`${x},${y}`)) free.push({ x, y });
              }
            }
            if (free.length > 0) {
              const pos = free[Math.floor(Math.random() * free.length)];
              const golden = new Food("golden", BONUS_DURATION);
              golden.x = pos.x;
              golden.y = pos.y;
              this.foods.push(golden);
              const gPix = this.gridToPixel(pos.x, pos.y);
              this.floatingTexts.push(new FloatingText("⭐ BONUS FRUIT!", gPix.x, gPix.y - 15, "#facc15"));
            }
          }
        }
      }

      // 4. Movement Step
      this.moveTimer += dt;
      if (this.moveTimer >= this.moveInterval) {
        if (this.inputQueue.length > 0) {
          this.direction = this.inputQueue.shift();
        }

        const head = this.snake[0];
        const nextX = head.x + this.direction.x;
        const nextY = head.y + this.direction.y;

        // Wall collision
        if (nextX < 0 || nextX >= GRID_COLUMNS || nextY < 0 || nextY >= GRID_ROWS) {
          this.handleDeath("Crashed into the arena wall!");
          return;
        }

        // Check Food Collision against all active fruits
        const eatenIdx = this.foods.findIndex((f) => f.x === nextX && f.y === nextY);
        const willEat = (eatenIdx !== -1);
        const eatenFood = willEat ? this.foods[eatenIdx] : null;

        // Self collision
        const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1);
        if (bodyToCheck.some((seg) => seg.x === nextX && seg.y === nextY)) {
          this.handleDeath("Ran into your own tail!");
          return;
        }

        // Advance snake
        this.snake.unshift({ x: nextX, y: nextY });

        if (willEat && eatenFood) {
          const speedBonus = Math.max(1, Math.floor((260 - this.moveInterval) / 30));
          const earned = eatenFood.points * (eatenFood.isBonus ? 1 : speedBonus);
          this.score += earned;
          this.foodEaten++;
          this.levelFruitsEaten++;

          if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewRecord = true;
            localStorage.setItem("snake_high_score", this.highScore.toString());
          }

          const foodPix = this.gridToPixel(eatenFood.x, eatenFood.y);
          this.emitFoodBurst(foodPix.x, foodPix.y, eatenFood.isBonus ? ["#facc15", "#fde047", "#ffffff"] : null);
          const popupText = eatenFood.isBonus ? `+${earned} BONUS!` : `+${earned}`;
          const popupColor = eatenFood.isBonus ? "#facc15" : "#4ade80";
          this.floatingTexts.push(new FloatingText(popupText, foodPix.x, foodPix.y - 12, popupColor));
          sound.playEat(eatenFood.isBonus);

          // Remove eaten & replenish
          this.foods.splice(eatenIdx, 1);
          this.replenishFoods();

          this.moveInterval = Math.max(MIN_SPEED, this.moveInterval - SPEED_INCREMENT);

          // Level Progression Check
          const target = LEVEL_THRESHOLDS[this.level] || 30;
          if (this.levelFruitsEaten >= target) {
            this.level++;
            this.levelFruitsEaten = 0;

            if (LEVEL_SPEEDS[this.level]) {
              this.moveInterval = LEVEL_SPEEDS[this.level];
            } else {
              this.moveInterval = Math.max(MIN_SPEED, this.moveInterval - 10);
            }

            if (this.level >= 4 && !this.isTimedMode) {
              this.isTimedMode = true;
              this.timerSeconds = 120.0;
            }

            const headPix = this.gridToPixel(this.snake[0].x, this.snake[0].y);
            this.emitFoodBurst(headPix.x, headPix.y);
            const lvlMsg = `⭐ LEVEL ${this.level}!` + (this.level >= 4 ? " 2-MIN FRENZY!" : "");
            this.floatingTexts.push(new FloatingText(lvlMsg, headPix.x, headPix.y - 20, "#facc15"));
          }
        } else {
          this.snake.pop();
        }

        this.moveTimer -= this.moveInterval;
      }
    }

    render() {
      // 1. Background
      ctx.fillStyle = "rgb(15, 20, 26)";
      ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

      // 2. Arena Floor & Borders
      ctx.drawImage(arenaCanvas, ARENA_OFFSET_X, ARENA_OFFSET_Y);
      ctx.strokeStyle = "rgb(45, 68, 52)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ARENA_OFFSET_X - 1, ARENA_OFFSET_Y - 1, ARENA_WIDTH + 2, ARENA_HEIGHT + 2);

      // 3. Render all active fruits
      this.foods.forEach((f) => f.draw(ctx));

      // 4. Render Snake
      this.drawSnake();

      // 5. Particles & Floating Texts
      this.particles.forEach((p) => p.draw(ctx));
      this.floatingTexts.forEach((ft) => ft.draw(ctx));

      // 6. Top Header HUD & Footer
      this.drawTopHUD();
      this.drawFooter();

      // 7. Modal Overlays
      if (this.state === "START") this.drawStartScreen();
      else if (this.state === "PAUSED") this.drawPauseScreen();
      else if (this.state === "GAME_OVER") this.drawGameOverScreen();
    }

    drawSnake() {
      const total = this.snake.length;
      const pixels = this.snake.map((s) => this.gridToPixel(s.x, s.y));

      // Ground Drop Shadow
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.38)";
      for (let i = total - 1; i >= 0; i--) {
        const { x, y } = pixels[i];
        const r = this.getSegmentRadius(i, total);
        const sx = x + 2;
        const sy = y + 3;

        if (i < total - 1) {
          const prev = pixels[i + 1];
          ctx.lineWidth = r * 1.8;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(prev.x + 2, prev.y + 3);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Continuous Body Capsules
      for (let i = total - 1; i > 0; i--) {
        const curr = pixels[i];
        const prev = pixels[i - 1];
        const r = this.getSegmentRadius(i, total);
        const pr = this.getSegmentRadius(i - 1, total);

        ctx.strokeStyle = "rgb(24, 115, 55)";
        ctx.lineWidth = (r + pr) * 0.92;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(curr.x, curr.y);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();

        ctx.strokeStyle = "rgb(46, 180, 90)";
        ctx.lineWidth = Math.max(2, (r + pr) * 0.92 - 3);
        ctx.beginPath();
        ctx.moveTo(curr.x, curr.y);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();

        ctx.fillStyle = "rgb(24, 115, 55)";
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(46, 180, 90)";
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, r - 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(110, 230, 145)";
        ctx.beginPath();
        ctx.arc(curr.x - r * 0.25, curr.y - r * 0.25, Math.max(1.5, r * 0.45), 0, Math.PI * 2);
        ctx.fill();

        if (i % 2 === 0 && r > 6) {
          ctx.fillStyle = "rgb(20, 105, 50)";
          ctx.beginPath();
          ctx.arc(curr.x, curr.y, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Animated Forked Tongue
      const headPix = pixels[0];
      const dx = this.direction.x;
      const dy = this.direction.y;
      const ox = -dy;
      const oy = dx;

      if (this.isAlive && this.tongueFlicking) {
        const phase = this.tongueFlickDuration / 220;
        const reach = Math.sin(phase * Math.PI) * (CELL_SIZE * 0.65);
        const vibe = Math.sin(this.tongueFlickDuration * 0.2) * 1.5;

        const tipX = headPix.x + dx * (CELL_SIZE * 0.48);
        const tipY = headPix.y + dy * (CELL_SIZE * 0.48);
        const stemEndX = tipX + dx * reach + ox * vibe;
        const stemEndY = tipY + dy * reach + oy * vibe;

        ctx.strokeStyle = "rgb(244, 63, 94)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(stemEndX, stemEndY);
        ctx.stroke();

        const forkLen = reach * 0.35;
        const forkSpread = reach * 0.25;
        ctx.beginPath();
        ctx.moveTo(stemEndX, stemEndY);
        ctx.lineTo(stemEndX + dx * forkLen + ox * forkSpread, stemEndY + dy * forkLen + oy * forkSpread);
        ctx.moveTo(stemEndX, stemEndY);
        ctx.lineTo(stemEndX + dx * forkLen - ox * forkSpread, stemEndY + dy * forkLen - oy * forkSpread);
        ctx.stroke();
      }

      // Head
      const headR = this.getSegmentRadius(0, total);
      const snoutX = headPix.x + dx * (headR * 0.35);
      const snoutY = headPix.y + dy * (headR * 0.35);

      ctx.fillStyle = "rgb(24, 115, 55)";
      ctx.beginPath();
      ctx.arc(snoutX, snoutY, headR + 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgb(34, 160, 80)";
      ctx.beginPath();
      ctx.arc(snoutX, snoutY, headR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgb(110, 230, 145)";
      ctx.beginPath();
      ctx.arc(snoutX - dx * 2 - 2, snoutY - dy * 2 - 2, headR * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Nostrils
      const nostrilDist = headR * 0.32;
      ctx.fillStyle = "rgb(15, 80, 40)";
      [1, -1].forEach((dir) => {
        ctx.beginPath();
        ctx.arc(snoutX + dx * (headR * 0.65) + ox * nostrilDist * dir, snoutY + dy * (headR * 0.65) + oy * nostrilDist * dir, 1, 0, Math.PI * 2);
        ctx.fill();
      });

      // Eyes
      const eyeFwd = headR * 0.15;
      const eyeLat = headR * 0.55;
      const eyeR = Math.max(2.5, headR * 0.3);

      [1, -1].forEach((dir) => {
        const eyeX = headPix.x + dx * eyeFwd + ox * eyeLat * dir;
        const eyeY = headPix.y + dy * eyeFwd + oy * eyeLat * dir;

        if (this.isAlive) {
          ctx.fillStyle = "rgb(15, 80, 40)";
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, eyeR + 1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgb(250, 250, 240)";
          ctx.beginPath();
          ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgb(20, 24, 28)";
          ctx.beginPath();
          ctx.arc(eyeX + dx * (eyeR * 0.35), eyeY + dy * (eyeR * 0.35), Math.max(1, eyeR * 0.6), 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(eyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = "rgb(239, 68, 68)";
          ctx.lineWidth = 2;
          const s = eyeR * 0.9;
          ctx.beginPath();
          ctx.moveTo(eyeX - s, eyeY - s);
          ctx.lineTo(eyeX + s, eyeY + s);
          ctx.moveTo(eyeX - s, eyeY + s);
          ctx.lineTo(eyeX + s, eyeY - s);
          ctx.stroke();
        }
      });
    }

    drawTopHUD() {
      ctx.fillStyle = "rgb(20, 27, 36)";
      ctx.fillRect(0, 0, WINDOW_WIDTH, ARENA_OFFSET_Y - 4);
      ctx.strokeStyle = "rgb(35, 48, 64)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ARENA_OFFSET_Y - 5);
      ctx.lineTo(WINDOW_WIDTH, ARENA_OFFSET_Y - 5);
      ctx.stroke();

      // Brand badge
      ctx.fillStyle = "rgb(24, 34, 46)";
      this.roundRect(ctx, ARENA_OFFSET_X, 12, 150, 42, 8, true, true, "rgb(45, 62, 82)");
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.fillText("🐍 SNAKE", ARENA_OFFSET_X + 10, 37);
      ctx.fillStyle = "#facc15";
      ctx.font = "10px -apple-system, sans-serif";
      ctx.fillText("PRO", ARENA_OFFSET_X + 115, 36);

      // Stat Cards
      const cardStartX = ARENA_OFFSET_X + 162;
      const cardW = 125;
      const cardH = 42;
      const gap = 10;

      // Card 1: Score
      this.drawStatCard(cardStartX, 12, cardW, cardH, "SCORE", `🍎 ${this.score}`, "#ffffff");

      // Card 2: High Score
      this.drawStatCard(
        cardStartX + (cardW + gap),
        12,
        cardW,
        cardH,
        "RECORD",
        `🏆 ${this.highScore}`,
        this.isNewRecord ? "#facc15" : "#e2e8f0",
        this.isNewRecord ? "#facc15" : "rgb(45, 60, 78)"
      );

      // Card 3: Level Badge
      const lvlLabel = `⭐ Lv.${this.level}` + (this.level >= 4 ? " FRENZY" : "");
      this.drawStatCard(
        cardStartX + (cardW + gap) * 2,
        12,
        cardW + 10,
        cardH,
        "LEVEL",
        lvlLabel,
        this.level >= 4 ? "#facc15" : "#4ade80",
        this.level >= 4 ? "rgba(250, 204, 21, 0.6)" : "rgb(45, 60, 78)"
      );

      // Card 4: 2-Min Timer (Level 4+) OR Length
      const card4X = cardStartX + (cardW + gap) * 3 + 10;
      if (this.isTimedMode && this.level >= 4) {
        const totalSec = Math.max(0, Math.floor(this.timerSeconds));
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const timeStr = `⏳ ${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
        const isUrgent = totalSec < 20;
        this.drawStatCard(
          card4X,
          12,
          cardW + 10,
          cardH,
          "2-MIN TIMER",
          timeStr,
          isUrgent ? "#ef4444" : "#facc15",
          isUrgent ? "rgba(239, 68, 68, 0.8)" : "rgb(45, 60, 78)"
        );
      } else {
        this.drawStatCard(card4X, 12, cardW, cardH, "LENGTH", `📏 ${this.snake.length}`, "#ffffff");
      }

      // Card 5: Speed / Pace
      const card5X = card4X + (this.isTimedMode ? cardW + 10 : cardW) + gap;
      const speedLevel = Math.max(1, Math.min(10, Math.floor((260 - this.moveInterval) / 20) + 1));
      this.drawStatCard(
        card5X,
        12,
        cardW,
        cardH,
        "SPEED [+/-]",
        `⚡ Lv.${speedLevel} (${this.moveInterval}ms)`,
        "#4ade80"
      );
    }

    drawStatCard(x, y, w, h, label, value, valColor, borderColor = "rgb(45, 60, 78)") {
      ctx.fillStyle = "rgb(28, 38, 50)";
      this.roundRect(ctx, x, y, w, h, 6, true, true, borderColor);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 10, y + 15);

      ctx.fillStyle = valColor;
      ctx.font = "bold 15px -apple-system, sans-serif";
      ctx.fillText(value, x + 10, y + 33);
    }

    drawFooter() {
      const footerY = ARENA_OFFSET_Y + ARENA_HEIGHT + 4;
      const footerH = WINDOW_HEIGHT - footerY;

      ctx.fillStyle = "rgb(13, 17, 22)";
      ctx.fillRect(0, footerY, WINDOW_WIDTH, footerH);
      ctx.strokeStyle = "rgb(35, 48, 64)";
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(WINDOW_WIDTH, footerY);
      ctx.stroke();

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "13px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "🎮 CONTROLS:  [W/A/S/D] or [ARROWS] Move   •   [SPACE / P] Pause   •   [R] Restart   •   [+ / -] Speed   •   [M] Audio",
        WINDOW_WIDTH / 2,
        footerY + 18
      );
    }

    drawStartScreen() {
      this.dimBackdrop(0.7);
      const cardW = 580;
      const cardH = 430;
      const cardX = (WINDOW_WIDTH - cardW) / 2;
      const cardY = (WINDOW_HEIGHT - cardH) / 2;

      ctx.fillStyle = "rgb(22, 30, 40)";
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 12, true, true, "rgb(45, 62, 82)");

      ctx.textAlign = "center";
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 28px -apple-system, sans-serif";
      ctx.fillText("🐍 REALISTIC SNAKE PRO", WINDOW_WIDTH / 2, cardY + 45);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.fillText("Level 1-3: Classic Feast  •  Level 4+: 2-Min Frenzy & 100+ Fruits!", WINDOW_WIDTH / 2, cardY + 75);

      // Record Pill
      ctx.fillStyle = "rgb(36, 48, 62)";
      this.roundRect(ctx, cardX + 190, cardY + 98, 200, 32, 16, true, true, "rgb(60, 80, 105)");
      ctx.fillStyle = "#facc15";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.fillText(`🏆 Best Record: ${this.highScore}`, WINDOW_WIDTH / 2, cardY + 119);

      // Keybinds Box
      const boxW = cardW - 80;
      const boxH = 155;
      const boxX = cardX + 40;
      const boxY = cardY + 148;
      ctx.fillStyle = "rgb(18, 25, 34)";
      this.roundRect(ctx, boxX, boxY, boxW, boxH, 8, true, true, "rgb(35, 48, 64)");

      const instructions = [
        ["Move / Slither", "[W / A / S / D] or [Arrow Keys]"],
        ["Pause / Resume", "[SPACE] or [P]"],
        ["Fruit Variety", "Apples 🍎, Grapes 🍇, Oranges 🍊, Strawberries 🍓"],
        ["Big Bonus Fruit", "⭐ Golden Fruit (100 Bonus Pts!)"],
      ];

      instructions.forEach(([action, key], idx) => {
        const rowY = boxY + 26 + idx * 32;
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "13px -apple-system, sans-serif";
        ctx.fillText(action, boxX + 20, rowY);

        ctx.textAlign = "right";
        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 13px -apple-system, sans-serif";
        ctx.fillText(key, boxX + boxW - 20, rowY);
      });

      // Play Button
      const ctaW = cardW - 180;
      const ctaH = 46;
      const ctaX = cardX + 90;
      const ctaY = cardY + 345;
      ctx.fillStyle = "rgb(34, 160, 80)";
      this.roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 8, true, true, "#4ade80");

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 19px -apple-system, sans-serif";
      ctx.fillText("Click or Press SPACE to Play", WINDOW_WIDTH / 2, ctaY + 30);
    }

    drawPauseScreen() {
      this.dimBackdrop(0.65);
      const cardW = 460;
      const cardH = 280;
      const cardX = (WINDOW_WIDTH - cardW) / 2;
      const cardY = (WINDOW_HEIGHT - cardH) / 2;

      ctx.fillStyle = "rgb(22, 30, 40)";
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 12, true, true, "rgb(45, 62, 82)");

      ctx.textAlign = "center";
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 28px -apple-system, sans-serif";
      ctx.fillText("⏸  GAME PAUSED", WINDOW_WIDTH / 2, cardY + 50);

      ctx.fillStyle = "#ffffff";
      ctx.font = "15px -apple-system, sans-serif";
      ctx.fillText(`Current Score: ${this.score}   |   Level: ${this.level}`, WINDOW_WIDTH / 2, cardY + 95);

      const hints = [
        ["Press [SPACE] or [P]", "Resume Game"],
        ["Press [R]", "Restart New Game"],
        ["Press [ESC]", "Return to Menu"],
      ];

      hints.forEach(([key, desc], idx) => {
        const hy = cardY + 145 + idx * 34;
        ctx.textAlign = "left";
        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 15px -apple-system, sans-serif";
        ctx.fillText(key, cardX + 60, hy);

        ctx.fillStyle = "rgb(140, 160, 180)";
        ctx.font = "15px -apple-system, sans-serif";
        ctx.fillText(desc, cardX + 245, hy);
      });
    }

    drawGameOverScreen() {
      this.dimBackdrop(0.75);
      const cardW = 540;
      const cardH = 410;
      const cardX = (WINDOW_WIDTH - cardW) / 2;
      const cardY = (WINDOW_HEIGHT - cardH) / 2;

      ctx.fillStyle = "rgb(22, 30, 40)";
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 12, true, true, "rgb(45, 62, 82)");

      const isTimeUp = this.deathReason.toLowerCase().includes("time");
      ctx.textAlign = "center";
      ctx.fillStyle = isTimeUp ? "#facc15" : "#ef4444";
      ctx.font = "bold 32px -apple-system, sans-serif";
      ctx.fillText(isTimeUp ? "TIME'S UP!" : "GAME OVER", WINDOW_WIDTH / 2, cardY + 44);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "15px -apple-system, sans-serif";
      ctx.fillText(this.deathReason, WINDOW_WIDTH / 2, cardY + 76);

      if (this.isNewRecord) {
        ctx.fillStyle = "rgb(180, 83, 9)";
        this.roundRect(ctx, cardX + 130, cardY + 92, 280, 26, 13, true, true, "#facc15");
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px -apple-system, sans-serif";
        ctx.fillText("🎉 NEW ALL-TIME RECORD! 🎉", WINDOW_WIDTH / 2, cardY + 110);
      }

      // Stats box
      const statY = cardY + (this.isNewRecord ? 128 : 105);
      const statBoxW = cardW - 80;
      const statBoxH = 145;
      const statBoxX = cardX + 40;
      ctx.fillStyle = "rgb(18, 25, 34)";
      this.roundRect(ctx, statBoxX, statY, statBoxW, statBoxH, 8, true, true, "rgb(35, 48, 64)");

      const stats = [
        ["Final Score", `🍎 ${this.score}`, "#ffffff"],
        ["High Score", `🏆 ${this.highScore}`, "#facc15"],
        ["Level Reached", `⭐ Level ${this.level}` + (this.level >= 4 ? " (Frenzy)" : ""), this.level >= 4 ? "#facc15" : "#4ade80"],
        ["Fruits Eaten", `${this.foodEaten} fruits`, "#4ade80"],
        ["Snake Length", `🐍 ${this.snake.length} segments`, "#ffffff"],
      ];

      stats.forEach(([label, val, color], idx) => {
        const sy = statY + 22 + idx * 26;
        ctx.textAlign = "left";
        ctx.fillStyle = "rgb(140, 160, 180)";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(label, statBoxX + 20, sy);

        ctx.textAlign = "right";
        ctx.fillStyle = color;
        ctx.font = "bold 14px -apple-system, sans-serif";
        ctx.fillText(val, statBoxX + statBoxW - 20, sy);
      });

      // Play Again CTA
      const ctaW = cardW - 140;
      const ctaH = 46;
      const ctaX = cardX + 70;
      const ctaY = statY + statBoxH + 16;
      ctx.fillStyle = "rgb(34, 160, 80)";
      this.roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 8, true, true, "#4ade80");

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.fillText("Click or Press SPACE to Play Again", WINDOW_WIDTH / 2, ctaY + 29);
    }

    dimBackdrop(alpha) {
      ctx.save();
      ctx.fillStyle = `rgba(10, 14, 20, ${alpha})`;
      ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
      ctx.restore();
    }

    roundRect(ctx, x, y, w, h, radius, fill, stroke, strokeColor) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      if (fill) ctx.fill();
      if (stroke) {
        ctx.strokeStyle = strokeColor || "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  const game = new Game();

  // Keyboard Event Handlers
  window.addEventListener("keydown", (e) => {
    sound.init();

    if (e.key === "r" || e.key === "R") {
      game.reset(false);
      return;
    }

    if (e.key === "+" || e.key === "=") {
      game.moveInterval = Math.max(MIN_SPEED, game.moveInterval - SPEED_INCREMENT);
      return;
    }
    if (e.key === "-") {
      game.moveInterval = Math.min(MAX_SPEED, game.moveInterval + SPEED_INCREMENT);
      return;
    }

    if (e.key === "m" || e.key === "M") {
      sound.enabled = !sound.enabled;
      updateSoundUI();
      return;
    }

    const keyDirections = {
      ArrowUp: Direction.UP,
      KeyW: Direction.UP,
      w: Direction.UP,
      W: Direction.UP,

      ArrowDown: Direction.DOWN,
      KeyS: Direction.DOWN,
      s: Direction.DOWN,
      S: Direction.DOWN,

      ArrowLeft: Direction.LEFT,
      KeyA: Direction.LEFT,
      a: Direction.LEFT,
      A: Direction.LEFT,

      ArrowRight: Direction.RIGHT,
      KeyD: Direction.RIGHT,
      d: Direction.RIGHT,
      D: Direction.RIGHT,
    };

    if (game.state === "START") {
      if (e.code === "Space" || e.key === "Enter") {
        game.state = "PLAYING";
      } else if (keyDirections[e.code] || keyDirections[e.key]) {
        game.direction = keyDirections[e.code] || keyDirections[e.key];
        game.state = "PLAYING";
      }
    } else if (game.state === "PLAYING") {
      if (e.code === "Space" || e.key === "p" || e.key === "P" || e.key === "Escape") {
        game.state = "PAUSED";
      } else if (keyDirections[e.code] || keyDirections[e.key]) {
        e.preventDefault();
        game.queueDirection(keyDirections[e.code] || keyDirections[e.key]);
      }
    } else if (game.state === "PAUSED") {
      if (e.code === "Space" || e.key === "p" || e.key === "P") {
        game.state = "PLAYING";
      } else if (e.key === "Escape") {
        game.state = "START";
      }
    } else if (game.state === "GAME_OVER") {
      if (e.code === "Space" || e.key === "Enter") {
        game.reset(false);
      } else if (e.key === "Escape") {
        game.reset(true);
      }
    }
  });

  // Canvas Click Handler
  canvas.addEventListener("click", () => {
    sound.init();
    if (game.state === "START") {
      game.state = "PLAYING";
    } else if (game.state === "GAME_OVER") {
      game.reset(false);
    }
  });

  // Mobile Touch Swipe Gesture Detection
  let touchStartX = 0;
  let touchStartY = 0;

  canvas.addEventListener(
    "touchstart",
    (e) => {
      sound.init();
      const touch = e.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      if (game.state === "START") game.state = "PLAYING";
      else if (game.state === "GAME_OVER") game.reset(false);
    },
    { passive: true }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 20) {
        if (absDx > absDy) {
          game.queueDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
        } else {
          game.queueDirection(dy > 0 ? Direction.DOWN : Direction.UP);
        }
      }
    },
    { passive: true }
  );

  // Virtual On-Screen D-Pad (for mobile screens)
  function bindTouchBtn(id, dir) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const trigger = (e) => {
      e.preventDefault();
      sound.init();
      if (game.state === "START") game.state = "PLAYING";
      else if (game.state === "GAME_OVER") game.reset(false);
      else game.queueDirection(dir);
    };
    btn.addEventListener("touchstart", trigger, { passive: false });
    btn.addEventListener("mousedown", trigger);
  }

  bindTouchBtn("ctrl-up", Direction.UP);
  bindTouchBtn("ctrl-down", Direction.DOWN);
  bindTouchBtn("ctrl-left", Direction.LEFT);
  bindTouchBtn("ctrl-right", Direction.RIGHT);

  const pauseBtn = document.getElementById("ctrl-pause");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      sound.init();
      if (game.state === "PLAYING") game.state = "PAUSED";
      else if (game.state === "PAUSED") game.state = "PLAYING";
      else if (game.state === "START") game.state = "PLAYING";
      else if (game.state === "GAME_OVER") game.reset(false);
    });
  }

  // Top Nav Buttons: Sound & Fullscreen
  function updateSoundUI() {
    const btn = document.getElementById("btn-sound");
    const icon = document.getElementById("audio-icon");
    const label = document.getElementById("audio-label");
    if (icon) icon.textContent = sound.enabled ? "🔊" : "🔇";
    if (label) label.textContent = `Sound: ${sound.enabled ? "ON" : "OFF"}`;
    if (btn) btn.classList.toggle("audio-active", sound.enabled);
  }

  const btnSound = document.getElementById("btn-sound");
  if (btnSound) {
    btnSound.addEventListener("click", () => {
      sound.enabled = !sound.enabled;
      updateSoundUI();
    });
  }

  const btnFullscreen = document.getElementById("btn-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // Main 60 FPS Animation Loop
  let lastTime = performance.now();
  function gameLoop(currentTime) {
    const dt = Math.min(100, currentTime - lastTime);
    lastTime = currentTime;

    game.update(dt);
    game.render();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
})();
