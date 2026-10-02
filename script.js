console.log("Website loaded.");
(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Ink-draw header letters */
  document.querySelectorAll("header h1").forEach((h1) => {
    if (h1.dataset.inked) return;
    h1.dataset.inked = "1";
    const text = h1.textContent;
    h1.textContent = "";
    [...text].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "ink-letter";
      s.textContent = ch === " " ? "\u00A0" : ch;
      s.style.animationDelay = reduced ? "0s" : `${Math.min(i * 0.035, 1.2)}s`;
      h1.appendChild(s);
    });
  });

  /* 2. Compass rose in header */
  document.querySelectorAll("header").forEach((header) => {
    if (header.querySelector(".compass-rose")) return;
    const rose = document.createElement("div");
    rose.className = "compass-rose";
    rose.setAttribute("aria-hidden", "true");
    rose.innerHTML = `
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" fill="#faf5e8" stroke="#163041" stroke-width="2"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="#163041" stroke-width="1" stroke-dasharray="3 4" opacity="0.6"/>
        <g class="rose-spin">
          <polygon points="50,8 54,50 50,92 46,50" fill="#b23a2e"/>
          <polygon points="8,50 50,46 92,50 50,54" fill="#163041"/>
          <polygon points="20,20 50,46 50,50 46,50" fill="#b78f2e" opacity="0.9"/>
          <polygon points="80,20 54,50 50,50 50,46" fill="#b78f2e" opacity="0.9"/>
          <polygon points="20,80 46,50 50,50 50,54" fill="#b78f2e" opacity="0.9"/>
          <polygon points="80,80 50,54 50,50 54,50" fill="#b78f2e" opacity="0.9"/>
        </g>
        <circle cx="50" cy="50" r="6" fill="#163041"/>
        <circle cx="50" cy="50" r="2.4" fill="#f4ecda"/>
        <text x="50" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="#163041" font-family="Georgia">N</text>
      </svg>`;
    const hText = header.querySelector(".header-text") || header.querySelector("h1");
    header.insertBefore(rose, hText);
  });

  /* 3. Chart sea canvas (fixed background) + soundings */
  const canvas = document.createElement("canvas");
  canvas.id = "chart-sea";
  document.body.prepend(canvas);
  const vignette = document.createElement("div");
  vignette.className = "chart-vignette";
  document.body.prepend(vignette);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, t = 0;
  const soundingsLayer = document.createElement("div");
  soundingsLayer.className = "soundings";
  document.body.appendChild(soundingsLayer);

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // scattered depth soundings like old charts
  const soundings = Array.from({ length: 26 }, () => ({
    x: Math.random(), y: Math.random(),
    v: [4, 7, 12, 18, 24, 31, 42][Math.floor(Math.random() * 7)],
    s: 0.6 + Math.random() * 0.8
  }));
  function paintSoundings() {
    soundingsLayer.innerHTML = soundings.map(s =>
      `<span style="position:absolute;left:${s.x * 100}%;top:${s.y * 100}%;font-size:${12 * s.s + 8}px">${s.v}</span>`
    ).join("");
  }
  paintSoundings();

  function drawSea() {
    ctx.clearRect(0, 0, W, H);
    t += 0.008;
    // drifting depth contours
    ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(21,94,117,${0.10 + k * 0.015})`;
      for (let x = -20; x <= W + 20; x += 14) {
        const y = H * 0.25 + k * 46 + Math.sin(x * 0.008 + t * (1 + k * 0.22) + k * 1.7) * 22 + Math.cos(x * 0.003 - t * 0.7) * 14;
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (!reduced) requestAnimationFrame(drawSea);
  }
  drawSea();

  /* 4. Top-down sailing sim (rudder + sheet, shifting wind) */
  const main = document.querySelector("main");
  if (main && !main.querySelector(".voyage-hero")) {
    const hero = document.createElement("section");
    hero.className = "voyage-hero sim-hero";
    hero.setAttribute("data-reveal", "");
    const page = (document.title || "").toLowerCase();
    const headline = page.includes("project") ? "Charting builds & rigging ideas."
      : page.includes("blog") ? "Dispatches from the helm."
      : "An engineer's logbook, kept by the tide.";
    hero.innerHTML = `
      <div class="hero-copy sim-copy">
        <span class="hero-kicker">Live wind · Top-down helm</span>
        <h2>${headline}</h2>
        <p>Mouse <strong>X</strong> = rudder &nbsp;·&nbsp; Mouse <strong>Y</strong> = mainsheet (top = trimmed in). Find the groove as the wind slowly veers.</p>
      </div>
      <div class="sim-hud" aria-hidden="true">
        <div class="sim-wind"><span class="sim-arrow">➤</span><span class="sim-wind-txt">10 kn</span></div>
        <div class="sim-row"><span class="sim-label">Boat</span><span class="sim-boat-txt">0.0 kn · In irons</span></div>
        <div class="sim-row"><span class="sim-label">Rudder</span><span class="sim-bar sim-rudder-bar"><i class="sim-rudder-fill"></i><b class="sim-center"></b><em class="sim-end sim-port">P</em><em class="sim-end sim-stbd">S</em></span></div>
        <div class="sim-row"><span class="sim-label">Sheet</span><span class="sim-bar"><i class="sim-sheet-fill"></i></span></div>
      </div>
      <canvas class="sail-sim" aria-label="Top-down sailing simulator. Move mouse sideways to steer, up and down to trim the mainsheet."></canvas>`;
    main.prepend(hero);
    initSailSim(hero);
  }

  function initSailSim(hero) {
    const canvas = hero.querySelector(".sail-sim");
    const ctx2 = canvas.getContext("2d");
    const arrowEl = hero.querySelector(".sim-arrow");
    const windTxt = hero.querySelector(".sim-wind-txt");
    const boatTxt = hero.querySelector(".sim-boat-txt");
    const rudderFill = hero.querySelector(".sim-rudder-fill");
    const sheetFill = hero.querySelector(".sim-sheet-fill");

    const D2R = Math.PI / 180, R2D = 180 / Math.PI;
    const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const boat = { x: 0.5, y: 0.62, heading: 90 * D2R, speed: 0, rudder: 0, sheet: 0.55, boom: 30 };
    const mouseT = { rudder: 0, sheet: 0.55 };
    let simT = Math.random() * 100;
    const wake = [];

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const nx = clamp((e.clientX - r.left) / r.width, 0, 1);
      const ny = clamp((e.clientY - r.top) / r.height, 0, 1);
      mouseT.rudder = nx * 2 - 1;
      mouseT.sheet = 1 - ny;
    }, { passive: true });
    hero.addEventListener("pointerleave", () => { mouseT.rudder = 0; });

    function sizeCanvas() {
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(300, r.width) * dpr;
      canvas.height = 430 * dpr;
      canvas.style.height = "430px";
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    function pointName(betaDeg) {
      if (betaDeg < 28) return "In irons";
      if (betaDeg < 52) return "Close hauled";
      if (betaDeg < 75) return "Close reach";
      if (betaDeg < 115) return "Beam reach";
      if (betaDeg < 150) return "Broad reach";
      return "Run";
    }
    function pointEff(betaDeg) {
      if (betaDeg < 30) return 0.05 + (betaDeg / 30) * 0.35;
      if (betaDeg < 90) return 0.4 + ((betaDeg - 30) / 60) * 0.6;
      if (betaDeg < 150) return 1.0 - ((betaDeg - 90) / 60) * 0.25;
      return 0.75 - ((betaDeg - 150) / 30) * 0.2;
    }

    let last = performance.now();
    function frame(now) {
      const dt = clamp((now - last) / 1000, 0.001, 0.05);
      last = now;
      if (!reduced) simT += dt;

      // slowly veering / backing wind
      const windFrom = (305 * D2R) + Math.sin(simT * 0.07) * 0.42 + Math.sin(simT * 0.023 + 1.7) * 0.5;
      const windKts = 10 + Math.sin(simT * 0.11) * 3 + Math.sin(simT * 0.043 + 0.6) * 2;

      // ease mouse inputs toward targets
      boat.rudder += (mouseT.rudder - boat.rudder) * Math.min(1, dt * 6);
      boat.sheet += (mouseT.sheet - boat.sheet) * Math.min(1, dt * 4);

      const delta = wrapPi(boat.heading - windFrom);
      const betaDeg = Math.abs(delta) * R2D;
      const optBoom = clamp(betaDeg * 0.5, 8, 80);
      const maxBoom = 8 + (1 - boat.sheet) * 72;
      boat.boom += (maxBoom - boat.boom) * Math.min(1, dt * 3);
      const trimErr = Math.abs(boat.boom - optBoom);
      const trimEff = betaDeg < 28 ? 0.12 : Math.exp(-((trimErr / 28) ** 2));
      const target = windKts * 0.55 * pointEff(betaDeg) * (0.35 + 0.65 * trimEff);
      boat.speed += (target - boat.speed) * Math.min(1, dt * 0.6);

      // steering with way + fall-off in irons
      const authority = (0.35 + Math.min(boat.speed, 6) / 6 * 1.0) * (betaDeg < 28 ? 0.4 : 1);
      boat.heading += boat.rudder * authority * 0.9 * dt;
      if (boat.speed < 0.7 && betaDeg < 40) boat.heading += Math.sign(delta || 1) * dt * 0.22;

      boat.x += Math.sin(boat.heading) * boat.speed * dt * 0.035;
      boat.y += -Math.cos(boat.heading) * boat.speed * dt * 0.035;
      if (boat.x < -0.06) boat.x = 1.06; if (boat.x > 1.06) boat.x = -0.06;
      if (boat.y < -0.06) boat.y = 1.06; if (boat.y > 1.06) boat.y = -0.06;
      wake.push({ x: boat.x, y: boat.y, a: 0.5 });
      if (wake.length > 90) wake.shift();
      wake.forEach((w) => (w.a -= dt * 0.25));

      draw(windFrom, windKts, betaDeg, trimErr);
      if (!reduced) requestAnimationFrame(frame);
    }

    function draw(windFrom, windKts, betaDeg, trimErr) {
      const W = canvas.width, H = canvas.height;
      ctx2.clearRect(0, 0, W, H);

      // wind field streaks drifting downwind
      const toWind = windFrom + Math.PI;
      ctx2.save();
      ctx2.strokeStyle = "rgba(21,94,117,0.18)";
      ctx2.lineWidth = 1 * (W / 900);
      for (let i = 0; i < 14; i++) {
        const px = ((i * 197.3 + simT * 24) % (W + 120)) - 60;
        const py = (i * 131.7) % H;
        const lx = Math.sin(toWind) * 26, ly = -Math.cos(toWind) * 26;
        ctx2.beginPath(); ctx2.moveTo(px, py); ctx2.lineTo(px + lx, py + ly); ctx2.stroke();
      }
      ctx2.restore();

      // wake
      wake.forEach((w) => {
        if (w.a <= 0) return;
        ctx2.beginPath();
        ctx2.arc(w.x * W, w.y * H, 3 + (0.5 - w.a) * 14, 0, Math.PI * 2);
        ctx2.strokeStyle = `rgba(21,94,117,${w.a * 0.5})`;
        ctx2.stroke();
      });

      // boat top-down
      const bx = boat.x * W, by = boat.y * H;
      const S = W / 900; // scale
      const L = 52 * S + 26, Bm = 15 * S + 9;
      const tackSide = -Math.sign(wrapPi(windFrom - boat.heading)) || 1;
      const boomRad = boat.boom * D2R;
      const luffing = betaDeg < 28 || trimErr > 30;

      ctx2.save();
      ctx2.translate(bx, by);
      ctx2.rotate(boat.heading);
      ctx2.shadowColor = "rgba(14,58,77,0.35)";
      ctx2.shadowBlur = 10;
      // hull
      ctx2.beginPath();
      ctx2.moveTo(0, -L / 2);
      ctx2.quadraticCurveTo(Bm, -L * 0.25, Bm * 0.72, L * 0.32);
      ctx2.quadraticCurveTo(Bm * 0.5, L / 2, 0, L / 2);
      ctx2.quadraticCurveTo(-Bm * 0.5, L / 2, -Bm * 0.72, L * 0.32);
      ctx2.quadraticCurveTo(-Bm, -L * 0.25, 0, -L / 2);
      ctx2.fillStyle = "#0e3a4d";
      ctx2.fill();
      ctx2.shadowBlur = 0;
      ctx2.lineWidth = 2; ctx2.strokeStyle = "#163041"; ctx2.stroke();
      // deck stripe + mast
      ctx2.beginPath(); ctx2.moveTo(0, -L / 2 + 4); ctx2.lineTo(0, L / 2 - 12);
      ctx2.strokeStyle = "rgba(250,245,232,0.5)"; ctx2.lineWidth = 1.5; ctx2.stroke();
      const mastY = -L * 0.08;
      // jib (foretriangle, same side, smaller)
      const jibLen = L * 0.42, jibA = boomRad * 0.75 * tackSide;
      ctx2.beginPath();
      ctx2.moveTo(0, -L / 2 + 3);
      ctx2.lineTo(Math.sin(jibA) * jibLen, -L / 2 + 3 + Math.cos(jibA) * jibLen * 0.9 + L * 0.22);
      ctx2.lineTo(0, mastY);
      ctx2.closePath();
      ctx2.fillStyle = luffing ? "rgba(250,245,232,0.75)" : "#faf5e8";
      ctx2.fill(); ctx2.strokeStyle = "#163041"; ctx2.lineWidth = 1.5; ctx2.stroke();
      // main + boom to leeward
      const boomLen = L * 0.52;
      const flutter = luffing && !reduced ? Math.sin(simT * 22) * 3 * S : 0;
      const ex = Math.sin(boomRad * tackSide) * boomLen + flutter;
      const ey = mastY + Math.cos(boomRad) * boomLen;
      ctx2.beginPath();
      ctx2.moveTo(0, mastY); ctx2.lineTo(ex, ey);
      ctx2.strokeStyle = "#5b4426"; ctx2.lineWidth = 3; ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(0, mastY - 14 * S - 8); ctx2.lineTo(0, mastY); ctx2.lineTo(ex, ey);
      ctx2.closePath();
      ctx2.fillStyle = luffing ? "rgba(231,214,168,0.85)" : "#e7d6a8";
      ctx2.fill(); ctx2.strokeStyle = "#163041"; ctx2.lineWidth = 1.8; ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(0, mastY, 3, 0, Math.PI * 2); ctx2.fillStyle = "#b78f2e"; ctx2.fill();
      // rudder
      // rudder foil swings with the helm: trailing edge to the side of the turn
      const rudA = boat.rudder * 0.6;
      ctx2.beginPath();
      ctx2.moveTo(0, L / 2 - 10);
      ctx2.lineTo(Math.sin(rudA) * 12, L / 2 - 10 + Math.cos(rudA) * 12);
      ctx2.strokeStyle = "#b23a2e"; ctx2.lineWidth = 3; ctx2.stroke();
      ctx2.restore();

      // bow heading tick
      ctx2.save();
      ctx2.translate(bx, by);
      ctx2.rotate(boat.heading);
      ctx2.beginPath(); ctx2.moveTo(0, -L / 2 - 10); ctx2.lineTo(0, -L / 2 - 4);
      ctx2.strokeStyle = "#b23a2e"; ctx2.lineWidth = 3; ctx2.stroke();
      ctx2.restore();

      // HUD (DOM)
      const windDeg = ((windFrom * R2D) % 360 + 360) % 360;
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      const dirName = dirs[Math.round(windDeg / 45) % 8];
      if (arrowEl) arrowEl.style.transform = `rotate(${windDeg + 90}deg)`;
      if (windTxt) windTxt.textContent = `${windKts.toFixed(0)} kn ${dirName}`;
      if (boatTxt) {
        const label = pointName(betaDeg) + (luffing && betaDeg >= 28 ? " · luffing" : "");
        boatTxt.textContent = `${boat.speed.toFixed(1)} kn · ${label}`;
        boatTxt.style.color = betaDeg < 28 ? "#b23a2e" : "inherit";
      }
      if (rudderFill) {
        const pct = Math.abs(boat.rudder) * 50;
        rudderFill.style.width = `${pct}%`;
        rudderFill.style.left = boat.rudder < 0 ? `${50 - pct}%` : "50%";
      }
      if (sheetFill) sheetFill.style.width = `${boat.sheet * 100}%`;
    }

    if (reduced) {
      draw(305 * D2R, 10, 90, 0);
    } else {
      requestAnimationFrame((n) => { last = n; requestAnimationFrame(frame); });
    }
  }

  /* 5. Scroll reveal + header parallax + heading underline */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll("main section, header").forEach((el) => {
    el.setAttribute("data-reveal", "");
    io.observe(el);
  });

  const header = document.querySelector("header");
  if (header && !reduced) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 300);
        header.style.transform = `translateY(${y * 0.06}px)`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* 6. Tide footer */
  if (!document.querySelector(".tide-footer")) {
    const f = document.createElement("footer");
    f.className = "tide-footer";
    f.innerHTML = `<div class="tide-line"></div><div>⚓ Fair winds & following seas — <strong>David Pollard</strong> · Sea Scout Boatswain · <span id="tide-year"></span></div>`;
    document.body.appendChild(f);
    const yEl = f.querySelector("#tide-year");
    if (yEl) yEl.textContent = new Date().getFullYear();
  }
})();
