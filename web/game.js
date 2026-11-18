/**
 * Realistic Snake Pro - Browser HTML5 Edition
 * 1:1 match of the Python Realistic Snake Pro game.
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
  const INITIAL_SPEED = 140; // ms per tick
  const MIN_SPEED = 50;
  const MAX_SPEED = 240;
  const SPEED_INCREMENT = 4;
  const POINTS_PER_FOOD = 10;

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

  // Web Audio Synthesizer (Zero external sound assets, 100% reliable)
  class SoundManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    playEat() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
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

      // Specular core
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
    constructor(text, x, y, color = "#facc15", lifetime = 40) {
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
      ctx.font = "bold 18px -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.text, this.x, this.y);
      ctx.restore();
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
  // Subtle corner dots
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
      this.state = "START"; // 'START', 'PLAYING', 'PAUSED', 'GAME_OVER'
      this.score = 0;
      this.foodEaten = 0;
      this.isNewRecord = false;
      this.deathReason = "";

      this.snake = [];
      this.direction = Direction.RIGHT;
      this.inputQueue = [];
      this.moveInterval = INITIAL_SPEED;
      this.moveTimer = 0;

      // Realistic details
      this.isAlive = true;
      this.tongueTimer = 0;
      this.tongueFlicking = false;
      this.tongueFlickDuration = 0;

      this.food = { x: 0, y: 0 };
      this.foodAnimTimer = Math.random() * 1000;

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
      this.isNewRecord = false;
      this.deathReason = "";
      this.isAlive = true;

      this.tongueTimer = 0;
      this.tongueFlicking = false;
      this.tongueFlickDuration = 0;

      this.particles = [];
      this.floatingTexts = [];

      this.spawnFood();
      this.state = toStart ? "START" : "PLAYING";
    }

    spawnFood() {
      const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
      const free = [];
      for (let x = 0; x < GRID_COLUMNS; x++) {
        for (let y = 0; y < GRID_ROWS; y++) {
          if (!occupied.has(`${x},${y}`)) free.push({ x, y });
        }
      }
      if (free.length > 0) {
        this.food = free[Math.floor(Math.random() * free.length)];
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

      // Burst death particles
      const headPix = this.gridToPixel(this.snake[0].x, this.snake[0].y);
      this.emitFoodBurst(headPix.x, headPix.y);
    }

    emitFoodBurst(x, y) {
      const colors = ["#ef4444", "#f43f5e", "#fb7185", "#facc15", "#4ade80", "#ffffff"];
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
      // Idle food animation & particles
      this.foodAnimTimer += dt;
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

      this.moveTimer += dt;
      if (this.moveTimer >= this.moveInterval) {
        if (this.inputQueue.length > 0) {
          this.direction = this.inputQueue.shift();
        }

        const head = this.snake[0];
        const nextX = head.x + this.direction.x;
        const nextY = head.y + this.direction.y;

        // 1. Wall collision
        if (nextX < 0 || nextX >= GRID_COLUMNS || nextY < 0 || nextY >= GRID_ROWS) {
          this.handleDeath("Crashed into the arena wall!");
          return;
        }

        const willEat = nextX === this.food.x && nextY === this.food.y;

        // 2. Self collision
        const bodyToCheck = willEat ? this.snake : this.snake.slice(0, -1);
        if (bodyToCheck.some((seg) => seg.x === nextX && seg.y === nextY)) {
          this.handleDeath("Ran into your own tail!");
          return;
        }

        // Move forward
        this.snake.unshift({ x: nextX, y: nextY });

        if (willEat) {
          const speedBonus = Math.max(1, Math.floor((240 - this.moveInterval) / 30));
          const earned = POINTS_PER_FOOD * speedBonus;
          this.score += earned;
          this.foodEaten++;

          if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewRecord = true;
            localStorage.setItem("snake_high_score", this.highScore.toString());
          }

          const foodPix = this.gridToPixel(this.food.x, this.food.y);
          this.emitFoodBurst(foodPix.x, foodPix.y);
          this.floatingTexts.push(new FloatingText(`+${earned}`, foodPix.x, foodPix.y - 12));
          sound.playEat();

          this.moveInterval = Math.max(MIN_SPEED, this.moveInterval - SPEED_INCREMENT);
          this.spawnFood();
        } else {
          this.snake.pop();
        }

        this.moveTimer -= this.moveInterval;
      }
    }

    render() {
      // 1. Clear background
      ctx.fillStyle = "rgb(15, 20, 26)";
      ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

      // 2. Arena Floor & Borders
      ctx.drawImage(arenaCanvas, ARENA_OFFSET_X, ARENA_OFFSET_Y);

      // Outer frame
      ctx.strokeStyle = "rgb(45, 68, 52)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ARENA_OFFSET_X - 1, ARENA_OFFSET_Y - 1, ARENA_WIDTH + 2, ARENA_HEIGHT + 2);

      // 3. Render Food (Apple)
      this.drawFood();

      // 4. Render Snake
      this.drawSnake();

      // 5. Render Particles & Floating Text
      this.particles.forEach((p) => p.draw(ctx));
      this.floatingTexts.forEach((ft) => ft.draw(ctx));

      // 6. Top HUD
      this.drawTopHUD();

      // 7. Footer Controls
      this.drawFooter();

      // 8. Modal Overlays
      if (this.state === "START") this.drawStartScreen();
      else if (this.state === "PAUSED") this.drawPauseScreen();
      else if (this.state === "GAME_OVER") this.drawGameOverScreen();
    }

    drawFood() {
      const pix = this.gridToPixel(this.food.x, this.food.y);
      const cx = pix.x;
      const cy = pix.y;
      const bob = Math.sin(this.foodAnimTimer * 0.005) * 1.5;
      const appleY = cy + bob;

      // Drop shadow on ground
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + CELL_SIZE * 0.3, CELL_SIZE * 0.45, CELL_SIZE * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const appleW = CELL_SIZE * 0.78;
      const appleH = CELL_SIZE * 0.74;
      const r = appleW / 2;

      // Dark base lobe
      ctx.fillStyle = "rgb(159, 18, 57)";
      ctx.beginPath();
      ctx.ellipse(cx, appleY + 1, appleW / 2, appleH / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Vibrant apple red lobes
      ctx.fillStyle = "rgb(225, 29, 72)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.22, appleY + 1, r * 0.88, 0, Math.PI * 2);
      ctx.arc(cx + r * 0.22, appleY + 1, r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Warm blush
      ctx.fillStyle = "rgba(200, 160, 40, 0.25)";
      ctx.beginPath();
      ctx.arc(cx, appleY + r * 0.5, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight arc
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx - 3, appleY - 2, r * 0.65, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();

      // Specular glint dot
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(cx - appleW * 0.22, appleY - appleH * 0.22, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Woody curved stem
      ctx.strokeStyle = "rgb(120, 72, 36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, appleY - appleH * 0.38);
      ctx.quadraticCurveTo(cx + 2, appleY - appleH * 0.7, cx + 4, appleY - appleH * 0.82);
      ctx.stroke();

      // Green leaf
      ctx.fillStyle = "rgb(34, 197, 94)";
      ctx.beginPath();
      ctx.moveTo(cx + 2, appleY - appleH * 0.55);
      ctx.lineTo(cx + 9, appleY - appleH * 0.75);
      ctx.lineTo(cx + 12, appleY - appleH * 0.6);
      ctx.lineTo(cx + 5, appleY - appleH * 0.45);
      ctx.closePath();
      ctx.fill();

      // Leaf vein
      ctx.strokeStyle = "rgb(134, 239, 172)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 2, appleY - appleH * 0.55);
      ctx.lineTo(cx + 10, appleY - appleH * 0.65);
      ctx.stroke();
    }

    drawSnake() {
      const total = this.snake.length;
      const pixels = this.snake.map((s) => this.gridToPixel(s.x, s.y));

      // 1. Ground Drop Shadow
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

      // 2. Continuous Body Capsules
      for (let i = total - 1; i > 0; i--) {
        const curr = pixels[i];
        const prev = pixels[i - 1];
        const r = this.getSegmentRadius(i, total);
        const pr = this.getSegmentRadius(i - 1, total);

        // Dark edge connector
        ctx.strokeStyle = "rgb(24, 115, 55)";
        ctx.lineWidth = (r + pr) * 0.92;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(curr.x, curr.y);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();

        // Vibrant body connector
        ctx.strokeStyle = "rgb(46, 180, 90)";
        ctx.lineWidth = Math.max(2, (r + pr) * 0.92 - 3);
        ctx.beginPath();
        ctx.moveTo(curr.x, curr.y);
        ctx.lineTo(prev.x, prev.y);
        ctx.stroke();

        // Base circular joint
        ctx.fillStyle = "rgb(24, 115, 55)";
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgb(46, 180, 90)";
        ctx.beginPath();
        ctx.arc(curr.x, curr.y, r - 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 3D Dorsal highlight
        ctx.fillStyle = "rgb(110, 230, 145)";
        ctx.beginPath();
        ctx.arc(curr.x - r * 0.25, curr.y - r * 0.25, Math.max(1.5, r * 0.45), 0, Math.PI * 2);
        ctx.fill();

        // Scale chevron dot
        if (i % 2 === 0 && r > 6) {
          ctx.fillStyle = "rgb(20, 105, 50)";
          ctx.beginPath();
          ctx.arc(curr.x, curr.y, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Animated Forked Tongue
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

        // Forks
        const forkLen = reach * 0.35;
        const forkSpread = reach * 0.25;
        ctx.beginPath();
        ctx.moveTo(stemEndX, stemEndY);
        ctx.lineTo(stemEndX + dx * forkLen + ox * forkSpread, stemEndY + dy * forkLen + oy * forkSpread);
        ctx.moveTo(stemEndX, stemEndY);
        ctx.lineTo(stemEndX + dx * forkLen - ox * forkSpread, stemEndY + dy * forkLen - oy * forkSpread);
        ctx.stroke();
      }

      // 4. Directional Sculpted Head
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

      // Crown highlight
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

      // 5. Expressive Eyes
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

          // Focused pupil looking forward
          ctx.fillStyle = "rgb(20, 24, 28)";
          ctx.beginPath();
          ctx.arc(eyeX + dx * (eyeR * 0.35), eyeY + dy * (eyeR * 0.35), Math.max(1, eyeR * 0.6), 0, Math.PI * 2);
          ctx.fill();

          // Glint
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(eyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Knocked out X
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
      // Header background
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
      this.roundRect(ctx, ARENA_OFFSET_X, 12, 175, 42, 8, true, true, "rgb(45, 62, 82)");
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 20px -apple-system, sans-serif";
      ctx.fillText("🐍 SNAKE", ARENA_OFFSET_X + 12, 38);
      ctx.fillStyle = "#facc15";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.fillText("PRO", ARENA_OFFSET_X + 130, 36);

      // Stat Cards
      const cardStartX = ARENA_OFFSET_X + 195;
      const cardW = 160;
      const cardH = 42;
      const gap = 15;

      this.drawStatCard(cardStartX, 12, cardW, cardH, "SCORE", `🍎 ${this.score}`, "#ffffff");
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
      this.drawStatCard(cardStartX + (cardW + gap) * 2, 12, cardW, cardH, "LENGTH", `📏 ${this.snake.length}`, "#ffffff");
      const speedLevel = Math.max(1, Math.min(10, Math.floor((240 - this.moveInterval) / 19) + 1));
      this.drawStatCard(cardStartX + (cardW + gap) * 3, 12, cardW, cardH, "SPEED [+/-]", `⚡ Lv.${speedLevel} (${this.moveInterval}ms)`, "#4ade80");
    }

    drawStatCard(x, y, w, h, label, value, valColor, borderColor = "rgb(45, 60, 78)") {
      ctx.fillStyle = "rgb(28, 38, 50)";
      this.roundRect(ctx, x, y, w, h, 6, true, true, borderColor);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "11px -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 10, y + 15);

      ctx.fillStyle = valColor;
      ctx.font = "bold 16px -apple-system, sans-serif";
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
      const cardH = 420;
      const cardX = (WINDOW_WIDTH - cardW) / 2;
      const cardY = (WINDOW_HEIGHT - cardH) / 2;

      ctx.fillStyle = "rgb(22, 30, 40)";
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 12, true, true, "rgb(45, 62, 82)");

      ctx.textAlign = "center";
      ctx.fillStyle = "#4ade80";
      ctx.font = "bold 30px -apple-system, sans-serif";
      ctx.fillText("🐍 REALISTIC SNAKE PRO", WINDOW_WIDTH / 2, cardY + 48);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "15px -apple-system, sans-serif";
      ctx.fillText("Organic Sinuous Physics  •  3D Fruits  •  Dynamic Pace", WINDOW_WIDTH / 2, cardY + 80);

      // Record Pill
      ctx.fillStyle = "rgb(36, 48, 62)";
      this.roundRect(ctx, cardX + 190, cardY + 105, 200, 32, 16, true, true, "rgb(60, 80, 105)");
      ctx.fillStyle = "#facc15";
      ctx.font = "14px -apple-system, sans-serif";
      ctx.fillText(`🏆 Best Record: ${this.highScore}`, WINDOW_WIDTH / 2, cardY + 126);

      // Keybinds Box
      const boxW = cardW - 80;
      const boxH = 150;
      const boxX = cardX + 40;
      const boxY = cardY + 155;
      ctx.fillStyle = "rgb(18, 25, 34)";
      this.roundRect(ctx, boxX, boxY, boxW, boxH, 8, true, true, "rgb(35, 48, 64)");

      const instructions = [
        ["Move / Slither", "[W / A / S / D] or [Arrow Keys]"],
        ["Pause / Resume", "[SPACE] or [P]"],
        ["Speed Pace", "[+] / [-] (adjust difficulty any time)"],
        ["Quick Restart", "[R]"],
      ];

      instructions.forEach(([action, key], idx) => {
        const rowY = boxY + 28 + idx * 32;
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px -apple-system, sans-serif";
        ctx.fillText(action, boxX + 20, rowY);

        ctx.textAlign = "right";
        ctx.fillStyle = "#4ade80";
        ctx.font = "bold 14px -apple-system, sans-serif";
        ctx.fillText(key, boxX + boxW - 20, rowY);
      });

      // Play Button
      const ctaW = cardW - 180;
      const ctaH = 48;
      const ctaX = cardX + 90;
      const ctaY = cardY + 335;
      ctx.fillStyle = "rgb(34, 160, 80)";
      this.roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 8, true, true, "#4ade80");

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px -apple-system, sans-serif";
      ctx.fillText("Click or Press SPACE to Play", WINDOW_WIDTH / 2, ctaY + 31);
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
      ctx.fillText(`Current Score: ${this.score}   |   Record: ${this.highScore}`, WINDOW_WIDTH / 2, cardY + 95);

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
      const cardH = 390;
      const cardX = (WINDOW_WIDTH - cardW) / 2;
      const cardY = (WINDOW_HEIGHT - cardH) / 2;

      ctx.fillStyle = "rgb(22, 30, 40)";
      this.roundRect(ctx, cardX, cardY, cardW, cardH, 12, true, true, "rgb(45, 62, 82)");

      ctx.textAlign = "center";
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 32px -apple-system, sans-serif";
      ctx.fillText("GAME OVER", WINDOW_WIDTH / 2, cardY + 46);

      ctx.fillStyle = "rgb(140, 160, 180)";
      ctx.font = "15px -apple-system, sans-serif";
      ctx.fillText(this.deathReason, WINDOW_WIDTH / 2, cardY + 76);

      if (this.isNewRecord) {
        ctx.fillStyle = "rgb(180, 83, 9)";
        this.roundRect(ctx, cardX + 130, cardY + 95, 280, 28, 14, true, true, "#facc15");
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px -apple-system, sans-serif";
        ctx.fillText("🎉 NEW ALL-TIME RECORD! 🎉", WINDOW_WIDTH / 2, cardY + 114);
      }

      // Stats box
      const statY = cardY + (this.isNewRecord ? 135 : 112);
      const statBoxW = cardW - 80;
      const statBoxH = 135;
      const statBoxX = cardX + 40;
      ctx.fillStyle = "rgb(18, 25, 34)";
      this.roundRect(ctx, statBoxX, statY, statBoxW, statBoxH, 8, true, true, "rgb(35, 48, 64)");

      const stats = [
        ["Final Score", `🍎 ${this.score}`, "#ffffff"],
        ["High Score", `🏆 ${this.highScore}`, "#facc15"],
        ["Apples Eaten", `${this.foodEaten}`, "#4ade80"],
        ["Snake Length", `🐍 ${this.snake.length} segments`, "#ffffff"],
      ];

      stats.forEach(([label, val, color], idx) => {
        const sy = statY + 24 + idx * 28;
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
      const ctaY = statY + statBoxH + 18;
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
    // Audio unlock on user interaction
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

  // Canvas Click Handler (for Start & Play Again button clicks)
  canvas.addEventListener("click", () => {
    sound.init();
    if (game.state === "START") {
      game.state = "PLAYING";
    } else if (game.state === "GAME_OVER") {
      game.reset(false);
    }
  });

  // Touch Swipe Gesture Detection for Mobile WhatsApp players
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

  // Top Nav Buttons: Sound, Pop-out Window & Fullscreen
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

  const btnPopup = document.getElementById("btn-popup");
  if (btnPopup) {
    btnPopup.addEventListener("click", () => {
      const w = 1016;
      const h = 750;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(
        window.location.href,
        "SnakeGamePopup",
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
      );
      if (popup) popup.focus();
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

  // Check if opened as dedicated mini-popup window
  if (window.opener && window.name === "SnakeGamePopup") {
    document.body.classList.add("is-popup-window");
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
