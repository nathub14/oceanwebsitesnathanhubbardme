/* =========================================================================
   ABYSSAL — descent engine
   Three.js r128 + GSAP ScrollTrigger. Single fixed canvas; camera sinks down
   the Y axis as you scroll. Atmosphere (fog, colour grade, marine snow,
   bioluminescence) carries the mood; HTML stations carry the content.
   ========================================================================= */
(() => {
  'use strict';

  const docEl = document.documentElement;
  docEl.classList.add('js');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 760;

  // ---- WebGL capability probe -------------------------------------------------
  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch { return false; }
  }
  const use3D = !prefersReduced && webglOK();
  if (prefersReduced) docEl.classList.add('reduce');

  // small helpers -------------------------------------------------------------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = s => document.querySelector(s);

  document.getElementById('year').textContent = new Date().getFullYear();

  /* =======================================================================
     SHARED SCROLL PROGRESS (drives both the scene and the HUD)
     ======================================================================= */
  let targetProgress = 0;   // raw 0..1 from scroll
  let smooth = 0;           // eased, for buttery sinking feel

  function rawProgress() {
    const h = document.body.scrollHeight - window.innerHeight;
    return h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
  }

  /* =======================================================================
     HUD — depth / pressure / temperature (diegetic submersible readout)
     ======================================================================= */
  const rDepth = $('#r-depth'), rPress = $('#r-press'), rTemp = $('#r-temp'),
        rZone = $('#r-zone'), bead = $('#gauge-bead');

  const ZONES = [
    [0,    'SURFACE',       '#7fe9df'],
    [80,   'SUNLIGHT ZONE', '#49c7c4'],
    [200,  'TWILIGHT ZONE', '#3f9fc0'],
    [1000, 'MIDNIGHT ZONE', '#5a7fc8'],
    [4000, 'ABYSSAL ZONE',  '#7a6cd0'],
    [6000, 'HADAL ZONE',    '#9a6ad0'],
  ];

  function zoneFor(depth) {
    let z = ZONES[0];
    for (const item of ZONES) if (depth >= item[0]) z = item;
    return z;
  }

  function updateHUD(p) {
    const depth = Math.pow(p, 1.9) * 6800;             // nonlinear so stations land right
    const press = 1 + depth / 10;
    const temp = 2 + 19 * Math.exp(-p * 4.3);          // 21°C surface -> ~2°C deep
    rDepth.textContent = depth < 1000
      ? Math.round(depth).toString()
      : (depth / 1000).toFixed(2) + 'k';
    rPress.textContent = press.toFixed(press < 100 ? 1 : 0);
    rTemp.textContent = temp.toFixed(1);
    const z = zoneFor(depth);
    if (rZone.textContent !== z[1]) { rZone.textContent = z[1]; rZone.style.color = z[2]; }
    bead.style.top = (p * 100).toFixed(2) + '%';
  }

  /* =======================================================================
     CONTENT REVEALS (GSAP) + per-section progress
     ======================================================================= */
  function setupScroll() {
    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);

      if (!prefersReduced) {
        document.querySelectorAll('.zone').forEach(zone => {
          const items = zone.querySelectorAll('.reveal');
          gsap.to(items, {
            opacity: 1, y: 0, duration: 1.1, ease: 'power2.out', stagger: 0.09,
            scrollTrigger: { trigger: zone, start: 'top 78%', once: true },
          });
        });
        gsap.to('footer .reveal', {
          opacity: 1, y: 0, duration: 1.1, stagger: 0.1,
          scrollTrigger: { trigger: 'footer', start: 'top 90%', once: true },
        });
      }

      ScrollTrigger.create({
        trigger: '#scroll', start: 'top top', end: 'bottom bottom',
        onUpdate: self => { targetProgress = self.progress; },
      });
    } else {
      window.addEventListener('scroll', () => { targetProgress = rawProgress(); }, { passive: true });
    }
    targetProgress = rawProgress();
  }

  /* =======================================================================
     REDUCED-MOTION / NO-WEBGL PATH — still alive, just static + HUD
     ======================================================================= */
  // depth colour ramp for the static (no-WebGL / reduced-motion) backdrop
  const FALL_STOPS = [
    [0.00, [0x3a, 0xa8, 0xc2]], [0.14, [0x1c, 0x6a, 0x90]], [0.36, [0x0d, 0x44, 0x67]],
    [0.60, [0x07, 0x29, 0x47]], [0.82, [0x03, 0x14, 0x28]], [1.00, [0x01, 0x07, 0x0f]],
  ];
  function depthRGB(p) {
    let a = FALL_STOPS[0], b = FALL_STOPS[FALL_STOPS.length - 1];
    for (let i = 0; i < FALL_STOPS.length - 1; i++)
      if (p >= FALL_STOPS[i][0] && p <= FALL_STOPS[i+1][0]) { a = FALL_STOPS[i]; b = FALL_STOPS[i+1]; break; }
    const t = clamp((p - a[0]) / (b[0] - a[0] || 1), 0, 1);
    return a[1].map((v, i) => Math.round(lerp(v, b[1][i], t)));
  }
  const shade = (rgb, f) => `rgb(${rgb.map(v => clamp(Math.round(v * f), 0, 255)).join(',')})`;

  function runFallback() {
    setupScroll();
    const canvas = document.getElementById('scene');
    if (canvas) canvas.style.display = 'none';     // nothing will draw to it
    const backdrop = document.getElementById('backdrop');
    function tick() {
      smooth += (targetProgress - smooth) * 0.16;
      updateHUD(smooth);
      const c = depthRGB(smooth);
      backdrop.style.background =
        `linear-gradient(180deg, ${shade(c, 1.35)} 0%, ${shade(c, 1)} 55%, ${shade(c, 0.62)} 100%)`;
      requestAnimationFrame(tick);
    }
    tick();
    hideLoader();
  }

  /* =======================================================================
     LOADER
     ======================================================================= */
  let loaderHidden = false;
  function hideLoader() {
    if (loaderHidden) return; loaderHidden = true;
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 350);
  }

  /* =======================================================================
     CONTACT FORM
     ======================================================================= */
  function setupForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    const statusEl = document.getElementById('f-status');
    const btn = document.getElementById('f-send');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      statusEl.className = 'form-status';
      const data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim(),
        depth: form.depth.value,
      };
      if (!data.name || !data.email || !data.message) {
        statusEl.textContent = '— all fields required to transmit.';
        statusEl.classList.add('err'); return;
      }
      btn.disabled = true;
      statusEl.classList.add('ok');
      statusEl.textContent = '◢ transmitting to the surface…';
      try {
        const res = await fetch('/api/contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const out = await res.json().catch(() => ({}));
        if (res.ok && out.ok) {
          form.reset();
          statusEl.className = 'form-status ok';
          statusEl.textContent = '✓ received. it reached me — I\'ll surface a reply soon.';
        } else {
          statusEl.className = 'form-status err';
          statusEl.textContent = '— ' + (out.error || 'transmission failed. try again.');
        }
      } catch {
        statusEl.className = 'form-status err';
        statusEl.textContent = '— no signal. check your connection and retry.';
      } finally {
        btn.disabled = false;
      }
    });
    // dead-link guard for placeholder project tiles
    document.querySelectorAll('[data-nojump]').forEach(a =>
      a.addEventListener('click', e => e.preventDefault()));
  }

  /* =======================================================================
     THREE.JS SCENE
     ======================================================================= */
  const DEPTH = 232;        // world units from surface to seafloor
  const yAt = p => -p * DEPTH;

  function build3D() {
    const canvas = document.getElementById('scene');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d6e86);
    scene.fog = new THREE.FogExp2(0x1d6e86, 0.0065);

    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 0, 0);

    // ---- lights ----
    const ambient = new THREE.AmbientLight(0x6fb8c8, 0.65);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xddfbff, 1.35);
    key.position.set(6, 60, 12);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x2a6f8a, 0.4);
    fill.position.set(-8, 10, -6);
    scene.add(fill);

    // ---- reusable glow sprite texture ----
    const glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.22, 'rgba(255,255,255,.55)');
      grd.addColorStop(0.5, 'rgba(255,255,255,.16)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    function glow(color, scale, opacity) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity: opacity ?? 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      s.scale.setScalar(scale);
      return s;
    }

    // Fresnel edge-glow — gives dark silhouettes a bioluminescent rim so they
    // read as *form* in the dark rather than flat black blobs.
    function fresnelMat(color, intensity) {
      return new THREE.ShaderMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
        uniforms: { glowColor: { value: new THREE.Color(color) }, intensity: { value: intensity ?? 1.0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
          void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0);
          vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 glowColor; uniform float intensity; varying vec3 vN; varying vec3 vV;
          void main(){ float f=pow(1.0-abs(dot(vN,vV)),3.0)*intensity; gl_FragColor=vec4(glowColor,f); }`,
      });
    }
    // wrap a mesh with a slightly larger fresnel shell
    function rim(mesh, color, intensity, scale) {
      const shell = new THREE.Mesh(mesh.geometry, fresnelMat(color, intensity));
      shell.scale.setScalar(scale ?? 1.03);
      mesh.add(shell);
      return shell;
    }

    // ---- SURFACE CEILING — shimmering caustic light from above ----
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.ShaderMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xa8f0ff) }, uFade: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uColor; uniform float uFade; varying vec2 vUv;
          vec2 rnd(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
          float caustic(vec2 uv){ vec2 i=floor(uv),f=fract(uv); float m=1.0;
            for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 n=vec2(float(x),float(y));
              vec2 pt=rnd(i+n); pt=0.5+0.5*sin(uTime*0.7+6.2831*pt); m=min(m,length(n+pt-f)); } return m; }
          void main(){ vec2 uv=vUv*11.0; float c=pow(caustic(uv)*caustic(uv*1.7+4.0),1.1)*3.0;
            c=smoothstep(0.12,1.0,c);
            float vig = smoothstep(1.0,0.3,length(vUv-0.5)); // brighter toward centre (the sun)
            gl_FragColor=vec4(uColor*c*(0.4+vig*0.7), (c*0.26+vig*0.14)*uFade); }`,
      })
    );
    ceiling.rotation.x = Math.PI / 2;       // faces downward, seen from below
    ceiling.position.y = 66;
    scene.add(ceiling);

    // soft "sun" bloom high above, seen through the surface
    const sun = glow(0xdffaff, 44, 0.3); sun.position.set(2, 60, -26); scene.add(sun);

    // ---- GOD RAYS at the surface ----
    const rays = new THREE.Group();
    (() => {
      const c = document.createElement('canvas'); c.width = 16; c.height = 256;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, 'rgba(220,252,255,.7)');
      grd.addColorStop(0.35, 'rgba(180,240,255,.18)');
      grd.addColorStop(1, 'rgba(180,240,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
      const tex = new THREE.CanvasTexture(c);
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6 + Math.random() * 3.4, 170),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
        );
        m.position.set((Math.random() - 0.5) * 54, 44, -14 - Math.random() * 40);
        m.rotation.z = (Math.random() - 0.5) * 0.42;
        m.rotation.y = (Math.random() - 0.5) * 0.4;
        m.userData.phase = Math.random() * Math.PI * 2;
        rays.add(m);
      }
    })();
    scene.add(rays);

    // ---- MARINE SNOW — dense, banded, camera-following particulate.
    // Particles live in a vertical band around the camera and wrap, so the
    // water stays full of suspended matter at every depth. Closer layers drift
    // faster (parallax) — the upward streaming is the main "sinking" cue.
    const BAND = 80;                                  // vertical extent of each layer
    function snow(count, color, size, opacity, spread, zBase, zSpread, drift) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i*3]   = (Math.random() - 0.5) * spread;
        pos[i*3+1] = (Math.random() - 0.18) * BAND;   // band biased above-centre
        pos[i*3+2] = zBase - Math.random() * zSpread;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex });
      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return { pts, pos: geo.attributes.position, drift, spread };
    }
    const m = isMobile ? 0.42 : 1;
    const snowLayers = [
      snow(Math.round(1300*m), 0x8fbccd, 0.55, 0.45, 130, -20, 46, 0.22),  // far haze, wide
      snow(Math.round(820*m),  0xcfe9f2, 0.95, 0.70, 78,  -7,  26, 0.45),  // mid marine snow
      snow(Math.round(300*m),  0xe9f6fb, 1.9,  0.68, 46,  -2,  9,  0.8),   // near flecks
      snow(Math.round(36*m),   0xd6eef6, 6.0,  0.16, 30,  -0.4,5,  1.25),  // foreground bokeh
    ];
    // bioluminescent plankton — close + bright so deep fog can't swallow it;
    // faded in with depth so the sunlit zones stay clean.
    const plankton = snow(Math.round(680*m), 0x79f0dc, 0.8, 0.0, 34, -1, 8, 0.5);
    plankton.bioGlow = true;
    snowLayers.push(plankton);

    // ---- helper: emissive porthole / instrument light ----
    function lamp(parent, color, x, y, z, r, lightIntensity) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(r, 24),
        new THREE.MeshBasicMaterial({ color })
      );
      disc.position.set(x, y, z);
      parent.add(disc);
      const s = glow(color, r * 9, 0.9); s.position.set(x, y, z + 0.1); parent.add(s);
      if (lightIntensity) {
        const pl = new THREE.PointLight(color, lightIntensity, r * 60, 2);
        pl.position.set(x, y, z + 1); parent.add(pl);
      }
      return { disc, glow: s };
    }

    const pulsers = [];   // emissive things that breathe
    const swayers = [];   // things that drift on sin
    const envUpdaters = []; // per-frame environment animations: fn(t, dt, camY)

    // ---- ABOUT — the submersible ----
    const sub = new THREE.Group();
    {
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x12222c, metalness: 0.5, roughness: 0.55,
        emissive: 0x05202a, emissiveIntensity: 0.4 });
      const hull = new THREE.Mesh(new THREE.SphereGeometry(2.1, 24, 18), bodyMat);
      hull.scale.set(1, 0.82, 1.15); sub.add(hull);
      rim(hull, 0x4fd8d0, 0.85);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 16), bodyMat);
      top.position.y = 1.7; sub.add(top);
      // cable upward
      const cable = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 2.2, 0), new THREE.Vector3(0.3, 40, -4)]),
        new THREE.LineBasicMaterial({ color: 0x183642, transparent: true, opacity: 0.5 }));
      sub.add(cable);
      const port = lamp(sub, 0xfff0d8, 0, 0.1, 2.05, 0.42, 1.4);   // warm porthole, faces +z
      pulsers.push({ glow: port.glow, base: port.glow.scale.x, amp: 0.12, sp: 1.2, ph: 0 });
      sub.position.set(5.5, yAt(0.165), -11);
      swayers.push({ obj: sub, baseX: sub.position.x, ax: 0.7, ay: 0.5, sp: 0.4, ph: 1 });
    }
    scene.add(sub);

    // ---- TWILIGHT — jellyfish drifters ----
    const jellies = new THREE.Group();
    for (let i = 0; i < (isMobile ? 3 : 5); i++) {
      const j = new THREE.Group();
      const bellR = 0.9 + Math.random() * 0.5;
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(bellR, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x1d4763, emissive: 0x4fc8c4, emissiveIntensity: 1.15,
          transparent: true, opacity: 0.62, roughness: 0.35, side: THREE.DoubleSide }));
      j.add(bell);
      rim(bell, 0x9ff5ec, 1.2, 1.05);
      // trailing tentacles
      const tpts = [];
      for (let k = 0; k < 5; k++) tpts.push(
        new THREE.Vector3((Math.random() - 0.5) * bellR, -0.2, (Math.random() - 0.5) * bellR),
        new THREE.Vector3((Math.random() - 0.5) * bellR * 1.4, -1.6 - Math.random(), (Math.random() - 0.5) * bellR * 1.4));
      const tent = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(tpts),
        new THREE.LineBasicMaterial({ color: 0x4fd8d0, transparent: true, opacity: 0.4 }));
      j.add(tent);
      const core = glow(0x73f0d8, 3.2, 0.5); core.position.y = -0.15; j.add(core);
      const pl = new THREE.PointLight(0x55e6d6, 0.7, 14, 2); j.add(pl);
      const near = i === 0;                                  // one large jelly drifts close
      j.scale.setScalar(near ? 1.7 : 1);
      j.position.set(near ? -7 : (Math.random() - 0.5) * 22, yAt(0.24 + i * 0.04), near ? -8 : -9 - Math.random() * 9);
      jellies.add(j);
      pulsers.push({ glow: core, base: core.scale.x, amp: 0.6, sp: 0.8 + Math.random() * 0.5, ph: i });
      swayers.push({ obj: j, baseX: j.position.x, ax: 1.4, ay: 0.9, sp: 0.25 + Math.random() * 0.2, ph: i * 1.3 });
    }
    scene.add(jellies);

    // ---- scattered bioluminescence spanning twilight → hadal (fills the dark) ----
    const bioField = new THREE.Group();
    const bioColors = [0x73f0d8, 0x5fd0e0, 0x66ff9c, 0x8fb7ff, 0x59e0c8];
    for (let i = 0; i < (isMobile ? 24 : 50); i++) {
      const col = bioColors[(Math.random() * bioColors.length) | 0];
      const sc = 1.8 + Math.random() * 4.2;
      const s = glow(col, sc, 0.6);
      s.position.set((Math.random() - 0.5) * 50, yAt(0.22 + Math.random() * 0.74), -4 - Math.random() * 13);
      bioField.add(s);
      pulsers.push({ glow: s, base: sc, amp: 0.4 + Math.random() * 0.45, sp: 0.4 + Math.random() * 1.5, ph: i * 0.7 });
    }
    scene.add(bioField);

    // ---- FISH SCHOOLS — dark silhouettes drifting through the light zones ----
    function createSchool(count, baseY, zBase, dir, speed, color) {
      const geo = new THREE.ConeGeometry(0.16, 0.6, 5);
      geo.rotateZ(dir > 0 ? -Math.PI / 2 : Math.PI / 2);   // nose points along travel
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.55, depthWrite: false }), count);
      mesh.frustumCulled = false;
      const fish = [];
      for (let i = 0; i < count; i++) fish.push({
        ox: (Math.random() - 0.5) * 26, oy: (Math.random() - 0.5) * 7,
        oz: (Math.random() - 0.5) * 12, ph: Math.random() * Math.PI * 2,
        wob: 0.4 + Math.random() * 0.6,
      });
      scene.add(mesh);
      const dummy = new THREE.Object3D();
      const span = 60;
      envUpdaters.push((t) => {
        const drift = ((t * speed) % span + span) % span;                 // 0..span
        for (let i = 0; i < count; i++) {
          const f = fish[i];
          let x = f.ox + dir * (drift - span / 2);
          // wrap within the school window so it streams continuously
          if (x > 30) x -= span; else if (x < -30) x += span;
          const y = baseY + f.oy + Math.sin(t * 1.6 + f.ph) * 0.5;
          dummy.position.set(x, y, zBase + f.oz);
          dummy.rotation.z = Math.sin(t * 6 + f.ph) * 0.25 * f.wob;        // tail wobble
          dummy.scale.setScalar(0.8 + 0.4 * Math.sin(f.ph));
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });
      return mesh;
    }
    if (!isMobile) {
      createSchool(40, yAt(0.10), -16, 1, 1.4, 0x0c2433);   // sunlight, far, drifting right
      createSchool(28, yAt(0.20), -22, -1, 1.0, 0x0a2030);  // sunlight/twilight, distant left
      createSchool(34, yAt(0.30), -11, 1, 1.9, 0x0e2a3a);   // twilight, nearer
    } else {
      createSchool(20, yAt(0.16), -16, 1, 1.4, 0x0c2433);
    }

    // ---- DISTANT GIANT — a whale silhouette glides across the twilight (scale) ----
    {
      const whale = new THREE.Group();
      const wMat = new THREE.MeshBasicMaterial({ color: 0x09202c, transparent: true, opacity: 0.5, depthWrite: false });
      const bodyW = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), wMat);
      bodyW.scale.set(4.2, 1, 1.3); whale.add(bodyW);
      const fluke = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), wMat);
      fluke.scale.set(0.5, 1.4, 0.2); fluke.position.set(-14, 0, 0); whale.add(fluke);
      const finW = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), wMat);
      finW.scale.set(1.6, 0.3, 0.6); finW.position.set(2, -1.6, 1.5); finW.rotation.z = -0.5; whale.add(finW);
      whale.position.set(0, yAt(0.34), -48);
      scene.add(whale);
      const wSpan = 150;
      envUpdaters.push((t) => {
        let x = ((t * 1.1) % wSpan) - wSpan / 2;        // very slow glide across the deep distance
        whale.position.x = x;
        whale.position.y = yAt(0.34) + Math.sin(t * 0.18) * 2;
        whale.rotation.z = Math.sin(t * 0.2) * 0.05;
      });
    }

    // ---- SIPHONOPHORES — drifting bioluminescent chains in the deep ----
    for (let s = 0; s < (isMobile ? 3 : 7); s++) {
      const chain = new THREE.Group();
      const beads = 5 + ((Math.random() * 5) | 0);
      const col = [0x66ffd0, 0x7fd8ff, 0x9affc0][s % 3];
      for (let b = 0; b < beads; b++) {
        const g = glow(col, 1.1 + Math.random() * 0.6, 0.7);
        g.position.y = -b * (0.5 + Math.random() * 0.3);
        chain.add(g);
        pulsers.push({ glow: g, base: g.scale.x, amp: 0.5, sp: 1.4, ph: b * 0.5 + s });
      }
      chain.position.set((Math.random() - 0.5) * 42, yAt(0.5 + Math.random() * 0.42), -5 - Math.random() * 11);
      scene.add(chain);
      swayers.push({ obj: chain, baseX: chain.position.x, ax: 1.2, ay: 0.6, sp: 0.18 + Math.random() * 0.16, ph: s });
    }

    // ---- VOLUME GLOW — large, faint halos that give the black water an
    // illuminated, murky sense of volume (not just empty void) ----
    for (let i = 0; i < (isMobile ? 5 : 11); i++) {
      const col = [0x1c5a66, 0x244e6e, 0x2a6a64][i % 3];
      const g = glow(col, 12 + Math.random() * 12, 0.16);
      g.position.set((Math.random() - 0.5) * 40, yAt(0.42 + Math.random() * 0.56), -7 - Math.random() * 9);
      scene.add(g);
      pulsers.push({ glow: g, base: g.scale.x, amp: 0.18, sp: 0.25 + Math.random() * 0.3, ph: i });
    }

    // ---- DEEP CREATURES — hero bioluminescent jellies through midnight→hadal,
    // dense enough that a large, close, lit form fills frame at any deep depth,
    // alternating sides to fill the space opposite the text ----
    const deepJellySpec = [
      { p: 0.56, x:  9,  col: 0x59e6d0, scale: 2.2 },
      { p: 0.61, x: -11, col: 0x7fc8ff, scale: 1.7 },
      { p: 0.66, x:  10, col: 0x66ffc0, scale: 2.0 },
      { p: 0.71, x: -10, col: 0x6fd8ff, scale: 1.8 },
      { p: 0.76, x:  11, col: 0x59e6d0, scale: 2.3 },
      { p: 0.81, x: -9,  col: 0x8affd0, scale: 1.7 },
      { p: 0.86, x:  10, col: 0x6fd8ff, scale: 2.1 },
      { p: 0.92, x: -10, col: 0x7fffd8, scale: 1.9 },
    ];
    for (const spec of (isMobile ? deepJellySpec.filter((_, i) => i % 2 === 0) : deepJellySpec)) {
      const j = new THREE.Group();
      const bellR = 1.1;
      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(bellR, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshStandardMaterial({ color: 0x16344a, emissive: new THREE.Color(spec.col),
          emissiveIntensity: 1.3, transparent: true, opacity: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
      j.add(bell); rim(bell, 0xbafff0, 1.4, 1.05);
      const tpts = [];
      for (let k = 0; k < 7; k++) tpts.push(
        new THREE.Vector3((Math.random() - 0.5) * bellR, -0.2, (Math.random() - 0.5) * bellR),
        new THREE.Vector3((Math.random() - 0.5) * bellR * 1.6, -2.2 - Math.random() * 1.2, (Math.random() - 0.5) * bellR * 1.6));
      j.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tpts),
        new THREE.LineBasicMaterial({ color: spec.col, transparent: true, opacity: 0.45 })));
      const core = glow(spec.col, 4.4, 0.6); core.position.y = -0.2; j.add(core);
      j.add(new THREE.PointLight(spec.col, 0.9, 16, 2));
      j.scale.setScalar(spec.scale);
      j.position.set(spec.x, yAt(spec.p), -8);
      scene.add(j);
      pulsers.push({ glow: core, base: core.scale.x, amp: 0.5, sp: 0.7 + Math.random() * 0.4, ph: spec.p * 10 });
      swayers.push({ obj: j, baseX: spec.x, ax: 1.1, ay: 0.7, sp: 0.16 + Math.random() * 0.12, ph: spec.p * 7 });
    }

    // ---- PROJECTS — the wreck with lit portholes ----
    const wreck = new THREE.Group();
    {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0c1a22, metalness: 0.4, roughness: 0.8,
        emissive: 0x06181f, emissiveIntensity: 0.45 });
      const hullA = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 4), mat); hullA.position.set(0, 0, 0);
      const hullB = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 8, 16), mat);
      hullB.rotation.z = Math.PI / 2; hullB.position.set(-1, -1.2, 1.5);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), mat); mast.position.set(3, 2.5, 0);
      wreck.add(hullA, hullB, mast);
      rim(hullA, 0x3fb8c8, 0.7); rim(hullB, 0x3fb8c8, 0.7);
      // lit portholes in mixed temperatures
      lamp(wreck, 0xffd9a0, -2.6, 0.3, 2.05, 0.28, 0.9);
      lamp(wreck, 0x8fe6ff, -0.4, 0.5, 2.05, 0.24, 0.8);
      const p3 = lamp(wreck, 0xffce8a, 1.8, -0.2, 2.05, 0.3, 0.9);
      lamp(wreck, 0x7fe3d0, 3.4, 1.0, 0.25, 0.2, 0.6);
      pulsers.push({ glow: p3.glow, base: p3.glow.scale.x, amp: 0.18, sp: 0.7, ph: 2 });
      wreck.rotation.set(0.08, -0.5, 0.16);
      wreck.position.set(-3.5, yAt(0.46), -13);
      swayers.push({ obj: wreck, baseX: wreck.position.x, ax: 0.4, ay: 0.3, sp: 0.16, ph: 0.5 });
    }
    scene.add(wreck);

    // ---- MIDNIGHT — moored instrument with blinking beacon ----
    const buoy = new THREE.Group();
    {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a151c, metalness: 0.6, roughness: 0.5 });
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.8, 14), mat); buoy.add(drum);
      rim(drum, 0x4fd8a0, 0.6);
      const beacon = lamp(buoy, 0x66ff9c, 0, 1.4, 0.4, 0.14, 1.2);
      pulsers.push({ glow: beacon.glow, base: beacon.glow.scale.x, amp: 0.9, sp: 2.4, ph: 0, blink: true });
      const tether = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(-0.4, -26, 2)]),
        new THREE.LineBasicMaterial({ color: 0x12303a, transparent: true, opacity: 0.5 }));
      buoy.add(tether);
      buoy.position.set(7, yAt(0.6), -12);
      swayers.push({ obj: buoy, baseX: buoy.position.x, ax: 0.5, ay: 0.6, sp: 0.3, ph: 2 });
    }
    scene.add(buoy);

    // ---- ABYSS — anglerfish lure ----
    const angler = new THREE.Group();
    {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x05090d, roughness: 1, metalness: 0,
          emissive: 0x0a1a22, emissiveIntensity: 0.5 }));
      body.scale.set(1.7, 1, 1); angler.add(body);
      rim(body, 0x6fd0ff, 1.1);
      const rod = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.6, 0.8, 0), new THREE.Vector3(-3.4, 2.4, 0.4)]),
        new THREE.LineBasicMaterial({ color: 0x142a30, transparent: true, opacity: 0.7 }));
      angler.add(rod);
      const lure = lamp(angler, 0xbfe9ff, -3.5, 2.5, 0.4, 0.16, 1.6);
      pulsers.push({ glow: lure.glow, base: lure.glow.scale.x, amp: 0.4, sp: 1.1, ph: 0 });
      angler.position.set(-6, yAt(0.72), -12);
      swayers.push({ obj: angler, baseX: angler.position.x, ax: 3.2, ay: 0.7, sp: 0.18, ph: 0 });
    }
    scene.add(angler);

    // ---- CONTACT — deep console ----
    const console3d = new THREE.Group();
    {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a141b, metalness: 0.5, roughness: 0.6 });
      const panel = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 1), mat); console3d.add(panel);
      rim(panel, 0x4fd8d0, 0.6);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.7),
        new THREE.MeshBasicMaterial({ color: 0x0c4a52 }));
      screen.position.set(0, 0.3, 0.51); console3d.add(screen);
      const sg = glow(0x4fd8d0, 9, 0.4); sg.position.set(0, 0.3, 0.7); console3d.add(sg);
      const pl = new THREE.PointLight(0x4fd8d0, 0.9, 24, 2); pl.position.set(0, 0.3, 3); console3d.add(pl);
      // row of indicator dots
      for (let i = 0; i < 6; i++) {
        const d = lamp(console3d, i % 3 === 0 ? 0x66ff9c : 0x5fd0e0, -2 + i * 0.8, -1.1, 0.52, 0.05, 0);
        if (i % 2) pulsers.push({ glow: d.glow, base: d.glow.scale.x, amp: 0.8, sp: 1.5 + i * 0.3, ph: i, blink: true });
      }
      console3d.position.set(3.5, yAt(0.865), -11);
      swayers.push({ obj: console3d, baseX: console3d.position.x, ax: 0.3, ay: 0.2, sp: 0.2, ph: 1 });
    }
    scene.add(console3d);

    // ---- SEAFLOOR ----
    {
      const geo = new THREE.PlaneGeometry(160, 160, 40, 40);
      geo.rotateX(-Math.PI / 2);
      const pa = geo.attributes.position.array;
      for (let i = 0; i < pa.length; i += 3) {
        pa[i+1] = Math.sin(pa[i] * 0.18) * Math.cos(pa[i+2] * 0.16) * 1.1
                + Math.sin(pa[i] * 0.5 + 1.3) * 0.4;
      }
      geo.computeVertexNormals();
      const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x07161f, roughness: 1, metalness: 0, flatShading: true,
        emissive: 0x040d14, emissiveIntensity: 0.5 }));
      const floorY = yAt(1) - 4.5;
      floor.position.set(0, floorY, -8);
      scene.add(floor);
      const fl = new THREE.PointLight(0x3f95a0, 1.5, 80, 2);
      fl.position.set(0, floorY + 8, 0); scene.add(fl);
      // settled bioluminescence on the seafloor — the arrival
      for (let i = 0; i < (isMobile ? 8 : 18); i++) {
        const col = [0x66ffd0, 0x7fd8ff, 0x59e6c8][i % 3];
        const g = glow(col, 1.6 + Math.random() * 2.4, 0.6);
        g.position.set((Math.random() - 0.5) * 40, floorY + 1.2 + Math.random() * 4, -3 - Math.random() * 14);
        scene.add(g);
        pulsers.push({ glow: g, base: g.scale.x, amp: 0.45, sp: 0.5 + Math.random() * 1.2, ph: i });
      }
    }

    /* ---- colour-grade stops by depth ---- */
    const grade = [
      { p: 0.00, bg: new THREE.Color(0x2c8aa2), fog: 0.0048, amb: new THREE.Color(0x86cdda), ai: 0.78, key: 1.5 },
      { p: 0.16, bg: new THREE.Color(0x14587a), fog: 0.0082, amb: new THREE.Color(0x4f9fb4), ai: 0.5, key: 0.7 },
      { p: 0.40, bg: new THREE.Color(0x082f4d), fog: 0.012,  amb: new THREE.Color(0x2c6f8c), ai: 0.32, key: 0.18 },
      { p: 0.62, bg: new THREE.Color(0x04182f), fog: 0.0145, amb: new THREE.Color(0x214a64), ai: 0.18, key: 0.04 },
      { p: 0.82, bg: new THREE.Color(0x020c18), fog: 0.0175, amb: new THREE.Color(0x12304a), ai: 0.10, key: 0 },
      { p: 1.00, bg: new THREE.Color(0x01050b), fog: 0.021,  amb: new THREE.Color(0x0a2138), ai: 0.06, key: 0 },
    ];
    const _c = new THREE.Color();
    function applyGrade(p) {
      let a = grade[0], b = grade[grade.length - 1];
      for (let i = 0; i < grade.length - 1; i++) {
        if (p >= grade[i].p && p <= grade[i+1].p) { a = grade[i]; b = grade[i+1]; break; }
      }
      const t = clamp((p - a.p) / (b.p - a.p || 1), 0, 1);
      _c.copy(a.bg).lerp(b.bg, t);
      scene.background.copy(_c);
      scene.fog.color.copy(_c);
      scene.fog.density = lerp(a.fog, b.fog, t);
      ambient.color.copy(a.amb).clone().lerp(b.amb, t);
      ambient.color.copy(a.amb).lerp(b.amb, t);
      ambient.intensity = lerp(a.ai, b.ai, t);
      key.intensity = lerp(a.key, b.key, t);
    }

    // ---- mouse parallax ----
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!isMobile) window.addEventListener('mousemove', e => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    // ---- resize ----
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- render loop ----
    const clock = new THREE.Clock();
    let firstFrame = false;
    function animate() {
      requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      smooth += (targetProgress - smooth) * 0.07;   // inertial sink
      updateHUD(smooth);
      applyGrade(smooth);

      // camera descends; gentle sway + mouse parallax
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      camera.position.y = yAt(smooth);
      camera.position.x = Math.sin(t * 0.15) * 0.5 + mouse.x * 1.1;
      camera.position.z = Math.cos(t * 0.1) * 0.3;
      // at the surface the camera tilts up into the light, then levels off as we sink
      const lookUp = lerp(4.2, -0.5, clamp(smooth / 0.13, 0, 1));
      camera.lookAt(mouse.x * 1.4, camera.position.y + lookUp - mouse.y * 0.6, -10);

      // surface light fades with depth
      const surfFade = clamp(1 - smooth / 0.2, 0, 1);
      ceiling.material.uniforms.uTime.value = t;
      ceiling.material.uniforms.uFade.value = surfFade;
      ceiling.visible = surfFade > 0.01;
      sun.material.opacity = 0.5 * surfFade;
      sun.visible = surfFade > 0.01;

      // god rays flicker + fade with depth
      const rayFade = clamp(1 - smooth / 0.2, 0, 1);
      rays.children.forEach(m => { m.material.opacity = (0.34 + 0.26 * Math.sin(t * 0.8 + m.userData.phase)) * rayFade; });
      rays.visible = rayFade > 0.01;

      // marine snow streams upward (we are sinking) and wraps within a band
      // around the camera, so the water is always full of suspended matter.
      const camY = camera.position.y;
      const top = camY + BAND * 0.32, bottom = top - BAND;
      snowLayers.forEach(s => {
        const arr = s.pos.array;
        const sp = dt * s.drift;
        for (let i = 1; i < arr.length; i += 3) {
          arr[i] += sp;
          if (arr[i] > top) { arr[i] = bottom; arr[i-1] = (Math.random() - 0.5) * s.spread; }
        }
        s.pos.needsUpdate = true;
        if (s.bioGlow) {                              // plankton: invisible up top, alive in the deep
          s.pts.material.opacity = clamp((smooth - 0.18) / 0.3, 0, 1) * 0.95;
          s.pts.material.size = 1.4 + 0.4 * Math.sin(t * 2.0);
        }
      });

      // pulse emissive glows
      for (const pu of pulsers) {
        let v;
        if (pu.blink) { v = Math.sin(t * pu.sp + pu.ph) > 0.6 ? 1 : 0.18; }
        else { v = (Math.sin(t * pu.sp + pu.ph) * 0.5 + 0.5); }
        pu.glow.scale.setScalar(pu.base * (1 - pu.amp + pu.amp * 2 * v));
        pu.glow.material.opacity = 0.45 + 0.45 * v;
      }
      // environment animations (schools, whale, etc.)
      for (const fn of envUpdaters) fn(t, dt, camY);

      // sway drifters
      for (const s of swayers) {
        s.obj.position.x = s.baseX + Math.sin(t * s.sp + s.ph) * s.ax;
        s.obj.position.z += Math.sin(t * s.sp * 0.7 + s.ph) * 0.002;
        s.obj.rotation.y += dt * 0.04 * (s.ph % 2 ? 1 : -1);
      }

      renderer.render(scene, camera);
      if (!firstFrame) { firstFrame = true; hideLoader(); }
    }
    animate();
  }

  /* =======================================================================
     BOOT
     ======================================================================= */
  function boot() {
    setupForm();
    setupScroll();
    if (use3D) {
      try { build3D(); }
      catch (err) { console.error('3D failed, falling back:', err); docEl.classList.add('reduce'); runFallback(); }
    } else {
      runFallback();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // safety: never leave the loader stuck
  window.addEventListener('load', () => setTimeout(hideLoader, 2600));
})();
