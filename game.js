(() => {
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySubtitle = document.getElementById("overlay-subtitle");
  const startBtn = document.getElementById("start-btn");
  const wrapBtn = document.getElementById("wrap-btn");
  const soundBtn = document.getElementById("sound-btn");
  const pauseBtn = document.getElementById("pause-btn");

  const GRID = 20;
  const CELL = canvas.width / GRID;
  const BASE_STEP_MS = 130;
  const MIN_STEP_MS = 60;
  const BEST_KEY = "neon-snake-best-v1";

  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 12, y: 10 };
  let particles = [];
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let wrapWalls = false;
  let soundOn = true;
  let running = false;
  let paused = false;
  let lastTick = 0;
  let audioCtx = null;

  bestEl.textContent = String(best);

  function beep(freq, duration = 0.08, type = "triangle", volume = 0.08) {
    if (!soundOn) return;
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Ignore audio errors when blocked by browser autoplay policy
    }
  }

  function stepMs() {
    return Math.max(MIN_STEP_MS, BASE_STEP_MS - Math.floor(score / 3) * 6);
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    const mult = (BASE_STEP_MS / stepMs()).toFixed(1).replace(/\.0$/, "");
    speedEl.textContent = `${mult}x`;
  }

  function spawnFood() {
    const occupied = new Set(snake.map((seg) => `${seg.x},${seg.y}`));
    const open = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(`${x},${y}`)) open.push({ x, y });
      }
    }
    if (open.length === 0) {
      gameOver(true);
      return;
    }
    food = open[Math.floor(Math.random() * open.length)];
  }

  function burst(gx, gy, color) {
    const cx = gx * CELL + CELL / 2;
    const cy = gy * CELL + CELL / 2;
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const speed = 1.2 + Math.random() * 2.6;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
    }
  }

  function resetGame() {
    snake = [
      { x: 6, y: 10 },
      { x: 5, y: 10 },
      { x: 4, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    particles = [];
    score = 0;
    paused = false;
    running = true;
    lastTick = performance.now();
    spawnFood();
    updateHud();
    overlay.classList.add("hidden");
    pauseBtn.textContent = "Pause";
    beep(440, 0.08, "sine");
  }

  function gameOver(won = false) {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      updateHud();
    }
    overlayTitle.textContent = won ? "YOU WIN!" : "GAME OVER";
    overlaySubtitle.textContent = `Score: ${score} · Best: ${best}`;
    startBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
    beep(won ? 660 : 150, 0.22, "sawtooth", 0.09);
  }

  function setDirection(nx, ny) {
    if (!running || paused) return;
    if (nx === -dir.x && ny === -dir.y) return;
    nextDir = { x: nx, y: ny };
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    if (paused) {
      overlayTitle.textContent = "PAUSED";
      overlaySubtitle.textContent = "Take a breather.";
      startBtn.textContent = "Resume";
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
      lastTick = performance.now();
    }
  }

  function tick() {
    dir = nextDir;
    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;

    if (wrapWalls) {
      nx = (nx + GRID) % GRID;
      ny = (ny + GRID) % GRID;
    } else if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      burst(snake[0].x, snake[0].y, "#f43f5e");
      gameOver(false);
      return;
    }

    const ate = nx === food.x && ny === food.y;
    const bodyToCheck = ate ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((seg) => seg.x === nx && seg.y === ny)) {
      burst(nx, ny, "#f43f5e");
      gameOver(false);
      return;
    }

    snake.unshift({ x: nx, y: ny });
    if (ate) {
      score += 1;
      if (score > best) {
        best = score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      burst(food.x, food.y, "#4ade80");
      beep(520 + Math.min(score * 14, 320), 0.09, "triangle");
      spawnFood();
      updateHud();
    } else {
      snake.pop();
    }
  }

  function drawGrid() {
    ctx.fillStyle = "#0a0d1c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(35, 43, 77, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      const pos = i * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }
  }

  function drawFood(now) {
    const pulse = 0.85 + Math.sin(now / 180) * 0.15;
    const cx = food.x * CELL + CELL / 2;
    const cy = food.y * CELL + CELL / 2;
    const radius = (CELL * 0.34) * pulse;

    ctx.save();
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffe4e6";
    ctx.beginPath();
    ctx.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSnake() {
    snake.forEach((seg, idx) => {
      const pad = idx === 0 ? 2 : 3;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const size = CELL - pad * 2;
      const t = idx / Math.max(snake.length - 1, 1);

      ctx.save();
      if (idx === 0) {
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#67e8f9";
      } else {
        const lightness = Math.round(58 - t * 22);
        ctx.fillStyle = `hsl(188, 90%, ${lightness}%)`;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 6);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= 0.04;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function loop(now) {
    if (running && !paused && now - lastTick >= stepMs()) {
      lastTick = now;
      tick();
    }
    drawGrid();
    drawFood(now);
    drawSnake();
    drawParticles();
    requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      e.preventDefault();
    }
    if (key === "arrowup" || key === "w") setDirection(0, -1);
    else if (key === "arrowdown" || key === "s") setDirection(0, 1);
    else if (key === "arrowleft" || key === "a") setDirection(-1, 0);
    else if (key === "arrowright" || key === "d") setDirection(1, 0);
    else if (key === " ") {
      if (!running) resetGame();
      else togglePause();
    }
  });

  startBtn.addEventListener("click", () => {
    if (running && paused) togglePause();
    else resetGame();
  });

  pauseBtn.addEventListener("click", togglePause);

  wrapBtn.addEventListener("click", () => {
    wrapWalls = !wrapWalls;
    wrapBtn.textContent = wrapWalls ? "Walls: Wrap" : "Walls: Solid";
    wrapBtn.setAttribute("aria-pressed", String(wrapWalls));
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound: On" : "Sound: Off";
    soundBtn.setAttribute("aria-pressed", String(soundOn));
  });

  document.querySelectorAll(".dpad-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = btn.dataset.dir;
      if (d === "up") setDirection(0, -1);
      if (d === "down") setDirection(0, 1);
      if (d === "left") setDirection(-1, 0);
      if (d === "right") setDirection(1, 0);
    });
  });

  // Initial attract state on board
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  requestAnimationFrame(loop);
})();
