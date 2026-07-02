import { useEffect, useRef } from 'react';

export default function Background3D() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let mouse = { x: W / 2, y: H / 2 };
    let animId;

    // ---- Cursor Trail Particles ----
    const trail = [];
    const TRAIL_MAX = 80;

    // ---- Cursor Ripples ----
    const ripples = [];

    // ---- Cursor Sparks ----
    const sparks = [];

    window.addEventListener('mousemove', e => {
      const prev = { ...mouse };
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      // Add trail particle
      trail.push({
        x: mouse.x,
        y: mouse.y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        life: 1,
        size: Math.random() * 3 + 1,
        color: ['167,139,250', '99,102,241', '236,72,153', '59,130,246', '52,211,153'][Math.floor(Math.random() * 5)],
      });
      if (trail.length > TRAIL_MAX) trail.shift();

      // Add sparks on fast movement
      const speed = Math.hypot(mouse.x - prev.x, mouse.y - prev.y);
      if (speed > 8) {
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const vel = Math.random() * speed * 0.3 + 1;
          sparks.push({
            x: mouse.x,
            y: mouse.y,
            vx: Math.cos(angle) * vel,
            vy: Math.sin(angle) * vel,
            life: 1,
            size: Math.random() * 2 + 0.5,
            color: ['255,200,100', '255,150,50', '200,100,255', '100,200,255'][Math.floor(Math.random() * 4)],
          });
        }
      }
    });

    // Click ripple
    window.addEventListener('click', e => {
      ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
      // Burst sparks on click
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const vel = Math.random() * 5 + 2;
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * vel,
          vy: Math.sin(angle) * vel,
          life: 1,
          size: Math.random() * 2.5 + 0.5,
          color: ['255,200,100', '167,139,250', '236,72,153', '52,211,153'][Math.floor(Math.random() * 4)],
        });
      }
    });

    window.addEventListener('resize', () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    });

    // ---- 3D Globe ----
    const GLOBE_PARTICLES = 320;
    const RADIUS = Math.min(W, H) * 0.28;
    let globeRot = 0;

    const globePts = Array.from({ length: GLOBE_PARTICLES }, (_, i) => {
      const phi = Math.acos(-1 + (2 * i) / GLOBE_PARTICLES);
      const theta = Math.sqrt(GLOBE_PARTICLES * Math.PI) * phi;
      return { phi, theta, size: Math.random() * 1.5 + 0.5 };
    });

    // ---- Rings ----
    const RINGS = [
      { rx: 1.0, ry: 0.3, rz: 0,   speed: 0.004,  color: '#7C3AED', particles: 80 },
      { rx: 0.5, ry: 1.0, rz: 0.2, speed: -0.003, color: '#2563EB', particles: 60 },
      { rx: 0.2, ry: 0.4, rz: 1.0, speed: 0.005,  color: '#DB2777', particles: 70 },
    ];
    let ringAngles = RINGS.map(() => 0);

    // ---- Floating Boxes ----
    const BOXES = Array.from({ length: 8 }, (_, i) => ({
      x: (Math.random() - 0.5) * W * 0.8,
      y: (Math.random() - 0.5) * H * 0.8,
      z: Math.random() * 400 + 100,
      rx: Math.random() * Math.PI,
      ry: Math.random() * Math.PI,
      rz: Math.random() * Math.PI,
      drx: (Math.random() - 0.5) * 0.012,
      dry: (Math.random() - 0.5) * 0.012,
      drz: (Math.random() - 0.5) * 0.008,
      size: Math.random() * 30 + 15,
      color: ['#7C3AED', '#2563EB', '#DB2777', '#0EA5E9'][i % 4],
      opacity: Math.random() * 0.4 + 0.15,
    }));

    // ---- Neural Network ----
    const NET_COUNT = 90;
    const netPts = Array.from({ length: NET_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 0.5,
      color: ['#A78BFA', '#60A5FA', '#F472B6', '#34D399'][Math.floor(Math.random() * 4)],
    }));

    // ---- 3D Helpers ----
    function rotX(p, a) {
      return { x: p.x, y: p.y * Math.cos(a) - p.z * Math.sin(a), z: p.y * Math.sin(a) + p.z * Math.cos(a) };
    }
    function rotY(p, a) {
      return { x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y, z: -p.x * Math.sin(a) + p.z * Math.cos(a) };
    }
    function rotZ(p, a) {
      return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a), z: p.z };
    }
    function project(p, cx, cy, fov = 500) {
      const scale = fov / (fov + p.z);
      return { x: cx + p.x * scale, y: cy + p.y * scale, scale };
    }

    function drawBox(b) {
      const s = b.size;
      let corners = [
        {x:-s,y:-s,z:-s},{x:s,y:-s,z:-s},{x:s,y:s,z:-s},{x:-s,y:s,z:-s},
        {x:-s,y:-s,z:s},{x:s,y:-s,z:s},{x:s,y:s,z:s},{x:-s,y:s,z:s},
      ].map(p => {
        let q = rotX(p, b.rx); q = rotY(q, b.ry); q = rotZ(q, b.rz);
        return { x: q.x + b.x, y: q.y + b.y, z: q.z + b.z };
      });
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = b.opacity;
      edges.forEach(([a, c]) => {
        const pa = project(corners[a], W / 2, H / 2);
        const pc = project(corners[c], W / 2, H / 2);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pc.x, pc.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }

    let t = 0;

    function draw() {
      ctx.fillStyle = 'rgba(5,7,15,0.18)';
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2 + (mouse.x - W / 2) * 0.03;
      const cy = H / 2 + (mouse.y - H / 2) * 0.03;

      // ---- Globe ----
      globeRot += 0.003;
      const mIX = (mouse.x - W / 2) * 0.0003;
      const mIY = (mouse.y - H / 2) * 0.0003;

      globePts.forEach(pt => {
        const theta = pt.theta + globeRot;
        const phi = pt.phi + mIY;
        let p = {
          x: RADIUS * Math.sin(phi) * Math.cos(theta),
          y: RADIUS * Math.sin(phi) * Math.sin(theta),
          z: RADIUS * Math.cos(phi),
        };
        p = rotY(p, mIX * 10);
        const proj = project(p, cx, cy - 50);
        const depth = (p.z + RADIUS) / (2 * RADIUS);
        const alpha = depth * 0.7 + 0.1;
        const size = pt.size * proj.scale;
        const colors = ['167,139,250', '99,102,241', '59,130,246'];
        const ci = Math.floor(depth * colors.length);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(0.3, size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colors[Math.min(ci, colors.length - 1)]},${alpha})`;
        ctx.fill();
      });

      // ---- Rings ----
      RINGS.forEach((ring, ri) => {
        ringAngles[ri] += ring.speed;
        const R2 = RADIUS * (1.15 + ri * 0.15);
        for (let i = 0; i < ring.particles; i++) {
          const a = (i / ring.particles) * Math.PI * 2 + ringAngles[ri];
          let p = { x: R2 * Math.cos(a), y: R2 * Math.sin(a), z: 0 };
          p = rotX(p, ring.rx * Math.PI);
          p = rotY(p, ring.ry * Math.PI + t * 0.0005);
          p = rotZ(p, ring.rz * Math.PI);
          const proj = project(p, cx, cy - 50);
          const depth = (p.z + R2) / (2 * R2);
          const alpha = depth * 0.6 + 0.15;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 1.2 * proj.scale, 0, Math.PI * 2);
          ctx.fillStyle = ring.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        }
      });

      // ---- Boxes ----
      BOXES.forEach(b => {
        b.rx += b.drx; b.ry += b.dry; b.rz += b.drz;
        b.y += Math.sin(t * 0.001 + b.x) * 0.15;
        drawBox(b);
      });

      // ---- Neural Net ----
      netPts.forEach(p => {
        p.x += p.vx + (mouse.x - p.x) * 0.0003;
        p.y += p.vy + (mouse.y - p.y) * 0.0003;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      });
      netPts.forEach((a, ai) => {
        netPts.slice(ai + 1).forEach(b => {
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(167,139,250,${(1 - dist / 130) * 0.2})`;
            ctx.lineWidth = 0.6; ctx.stroke();
          }
        });
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
        ctx.fillStyle = a.color + '99';
        ctx.fill();
      });

      // ---- Shooting Stars ----
      if (Math.random() < 0.015) {
        const sx = Math.random() * W;
        const sy = Math.random() * H * 0.4;
        const len = Math.random() * 120 + 60;
        const grad = ctx.createLinearGradient(sx, sy, sx + len, sy + len * 0.3);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(167,139,250,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy + len * 0.3);
        ctx.strokeStyle = grad; ctx.lineWidth = 1; ctx.stroke();
      }

      // ======== CURSOR EFFECTS ========

      // ---- Cursor Glow Aura ----
      const aura = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 120);
      aura.addColorStop(0, 'rgba(167,139,250,0.12)');
      aura.addColorStop(0.4, 'rgba(99,102,241,0.06)');
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 120, 0, Math.PI * 2);
      ctx.fill();

      // ---- Cursor Ring ----
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(167,139,250,0.7)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ---- Inner Dot ----
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();

      // ---- Rotating Orbit around cursor ----
      const orbitR = 28;
      const orbitCount = 4;
      for (let i = 0; i < orbitCount; i++) {
        const angle = (t * 0.04) + (i / orbitCount) * Math.PI * 2;
        const ox = mouse.x + Math.cos(angle) * orbitR;
        const oy = mouse.y + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
        const orbitColors = ['167,139,250', '236,72,153', '59,130,246', '52,211,153'];
        ctx.fillStyle = `rgba(${orbitColors[i]},0.9)`;
        ctx.fill();
      }

      // ---- Trail ----
      trail.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= 0.025;
        if (p.life <= 0) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.life * 0.7})`;
        ctx.fill();
      });
      // Cleanup dead trail
      for (let i = trail.length - 1; i >= 0; i--) {
        if (trail[i].life <= 0) trail.splice(i, 1);
      }

      // ---- Sparks ----
      sparks.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.vy += 0.08; // gravity
        p.life -= 0.03;
        if (p.life <= 0) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.life})`;
        ctx.fill();
      });
      for (let i = sparks.length - 1; i >= 0; i--) {
        if (sparks[i].life <= 0) sparks.splice(i, 1);
      }

      // ---- Ripples ----
      ripples.forEach(rp => {
        rp.r += 4;
        rp.life -= 0.03;
        if (rp.life <= 0) return;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${rp.life * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Second ring slightly delayed
        if (rp.r > 20) {
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.r - 20, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(236,72,153,${rp.life * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      for (let i = ripples.length - 1; i >= 0; i--) {
        if (ripples[i].life <= 0) ripples.splice(i, 1);
      }

      t++;
      animId = requestAnimationFrame(draw);
    }

    ctx.fillStyle = '#05070F';
    ctx.fillRect(0, 0, W, H);
    draw();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}