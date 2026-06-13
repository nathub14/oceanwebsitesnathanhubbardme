# 3D-frontend

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that teaches Claude how to build immersive, scroll-driven 3D websites — single-file HTML, no build tools required.

When this skill is installed, asking Claude Code to create a "3D landing page", "scroll-driven 3D experience", or "room walkthrough" will produce a self-contained `.html` file featuring a Three.js WebGL scene controlled by scroll position, with HTML content overlaid on the 3D world.

## Quick Start

Install this skill into your Claude Code project:

```bash
claude install-skill https://github.com/liuzy/3d-frontend
```

Then just ask:

```
> Make me a 3D landing page for a coffee brand with a fly-through effect
```

## What's Inside

```
3D-frontend.md            # Skill definition — the instructions Claude follows
references/PATTERNS.md     # 40+ copy-paste code patterns (1800 lines)
demo/                      # Example pages built with this skill
```

**`3D-frontend.md`** — Covers scene architecture, camera animation, scroll binding, content overlays, room walkthroughs, visual polish, anti-patterns, and aesthetic direction.

**`PATTERNS.md`** — Production-ready patterns for spline camera paths, three-point lighting, fake bloom, procedural textures (marble, wood), gradient sky domes, water shaders, Fresnel glow, fog transitions, InstancedMesh, particles, and more. All Three.js r128 compatible.

## Tech Stack

| Library | Version | Role |
|---------|---------|------|
| [Three.js](https://threejs.org/) | r128 | WebGL 3D rendering |
| [GSAP](https://gsap.com/) | 3.12.5 | Animation engine |
| [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) | 3.12.5 | Scroll-to-animation binding |

Everything loads via CDN. Outputs are single `.html` files — no npm, no bundler, no framework.

## Demo Pages

The `demo/` folder contains example pages showcasing different experience types. Open any file directly in a browser.

## Experience Types

The skill supports several 3D scroll experiences:

| Type | Camera Behavior |
|------|----------------|
| Room Walk-through | Move through connected interior spaces |
| Tunnel / Corridor | Fly forward along a path |
| Landscape Flyover | Sweep over terrain |
| Orbit / Showcase | Rotate around a central object |
| Vertical Descent | Drop down through layers |
| Spline Path | Follow a curved 3D trajectory |

## License

MIT
