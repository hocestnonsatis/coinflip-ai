// Tavla-1.6K 3D board: same lamp-lit dark room / wooden table / bloom + vignette look as the coin and dice scenes.
// Render-on-demand: frames are drawn only while something animates or after invalidate().
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTextures, VignetteShader } from './scene';
import { faceTex, FACE_OF_MAT, NORMALS } from './dice-scene';
import type { Board } from './tavla-engine';

import { layout, ptX, near, R, CH, TRAY_X, type Loc, type Highlights } from './tavla-layout';
export type { Loc, Highlights };

function inlayTex(light: boolean) {
	const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d')!;
	g.fillStyle = light ? '#e6cfa0' : '#5a1f16'; g.fillRect(0, 0, s, s);
	for (let y = 0; y < s; y++) { const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 3) * 0.5 + 0.5; g.fillStyle = light ? `rgba(150,105,55,${0.05 + v * 0.12})` : `rgba(20,5,3,${0.08 + v * 0.18})`; g.fillRect(0, y, s, 1); }
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function fieldTex() {
	const w = 512, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
	g.fillStyle = '#a8743f'; g.fillRect(0, 0, w, h);
	for (let x = 0; x < w; x++) { const v = Math.sin(x * 0.11 + Math.sin(x * 0.013) * 5) * 0.5 + 0.5 + (Math.random() - 0.5) * 0.3; g.fillStyle = `rgba(70,35,12,${0.06 + v * 0.16})`; g.fillRect(x, 0, 1, h); }
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function labelTex(text: string) {
	const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
	g.fillStyle = '#000a'; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
	g.fillStyle = '#ffd36b'; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createTavlaScene(canvas: HTMLCanvasElement, opts: { onPick: (loc: number) => void; reducedMotion: () => boolean }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#050403'); scene.fog = new THREE.Fog('#050403', 22, 48);
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
	const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);

	const key = new THREE.SpotLight('#ffc98a', 380, 60, Math.PI / 5, 0.6, 1.4);
	key.position.set(2, 20, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0003;
	key.shadow.camera.near = 8; key.shadow.camera.far = 40;
	scene.add(key, key.target, new THREE.HemisphereLight('#4a3624', '#0a0604', 0.45));
	const bounce = new THREE.PointLight('#ff9a50', 8, 22); bounce.position.set(-7, 2, 6); scene.add(bounce);

	// table
	const wood = woodTextures(); wood.color.repeat.set(4, 4); wood.bump.repeat.set(4, 4);
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: wood.color, roughnessMap: wood.bump, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.85 }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -0.42; floor.receiveShadow = true; scene.add(floor);

	// board: case, two playing fields, frame rails, middle bar with brass hinges, bear-off trays
	const caseWood = woodTextures(); caseWood.color.repeat.set(2, 1);
	const caseMat = new THREE.MeshStandardMaterial({ map: caseWood.color, bumpMap: caseWood.bump, bumpScale: 0.8, roughness: 0.6, color: '#c08a5a' });
	const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = caseMat, r = 0.06) => {
		const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
	};
	box(16.6, 0.4, 13.4, 0.4, -0.22, 0); // base
	const field = new THREE.MeshStandardMaterial({ map: fieldTex(), roughness: 0.75, color: '#d6a46e' });
	for (const x of [-3.5, 3.5]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 11.9), field); f.rotation.x = -Math.PI / 2; f.position.set(x, 0.005, 0); f.receiveShadow = true; scene.add(f); }
	for (const z of [-6.3, 6.3]) box(16.6, 0.34, 0.7, 0.4, 0.1, z); // long rails
	for (const x of [-6.85, 6.85, 8.35]) box(0.6, 0.34, 13.3, x, 0.1, 0); // short rails
	box(1.0, 0.36, 11.9, 0, 0.1, 0); // bar
	const brass = new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 0.9, roughness: 0.32 });
	for (const z of [-3.6, 3.6]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 20), brass); h.rotation.x = Math.PI / 2; h.position.set(0, 0.3, z); h.castShadow = true; scene.add(h); }
	const trayMat = new THREE.MeshStandardMaterial({ color: '#3a1f10', roughness: 0.8 });
	const trays = [-1, 1].map((s) => { const t = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 5.6), trayMat.clone()); t.position.set(TRAY_X, 0.02, s * 3.15); t.receiveShadow = true; scene.add(t); return t; });

	// inlaid triangles (each has its own material so it can glow)
	const triShape = new THREE.Shape(); triShape.moveTo(-0.47, 0); triShape.lineTo(0.47, 0); triShape.lineTo(0, 5.0); triShape.closePath();
	const triGeo = new THREE.ShapeGeometry(triShape);
	const texL = inlayTex(true), texD = inlayTex(false);
	const tris: THREE.Mesh[] = [];
	for (let i = 0; i < 24; i++) {
		const m = new THREE.Mesh(triGeo, new THREE.MeshStandardMaterial({ map: i % 2 ? texL : texD, roughness: 0.55, emissive: new THREE.Color('#ffb040'), emissiveIntensity: 0 }));
		m.rotation.x = -Math.PI / 2; if (!near(i)) m.rotation.z = Math.PI; // tips toward the centre
		m.position.set(ptX(i), 0.012, near(i) ? 5.95 : -5.95); m.receiveShadow = true; scene.add(m); tris.push(m);
	}
	// invisible, generous hit areas (whole half-column per point; bar; trays)
	const hits: THREE.Mesh[] = [], hitMat = new THREE.MeshBasicMaterial({ visible: false });
	const hit = (w: number, d: number, x: number, z: number, loc: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), hitMat); m.position.set(x, 0.4, z); m.userData.loc = loc; scene.add(m); hits.push(m); };
	for (let i = 0; i < 24; i++) hit(1, 6.2, ptX(i), near(i) ? 3.1 : -3.1, i);
	hit(1, 6.2, 0, 3.1, 24); hit(1.4, 13, TRAY_X, 0, -1);

	// checkers: beveled cylinders, ivory and walnut-red, 15 each
	const prof = [new THREE.Vector2(0, -CH / 2), new THREE.Vector2(R - 0.05, -CH / 2), new THREE.Vector2(R, -CH / 2 + 0.04), new THREE.Vector2(R, CH / 2 - 0.04), new THREE.Vector2(R - 0.05, CH / 2), new THREE.Vector2(R * 0.72, CH / 2), new THREE.Vector2(R * 0.66, CH / 2 - 0.025), new THREE.Vector2(0, CH / 2 - 0.025)];
	const ckGeo = new THREE.LatheGeometry(prof, 40);
	const mkMat = (human: boolean) => new THREE.MeshPhysicalMaterial({ color: human ? '#d8cbb0' : '#5a1a14', roughness: human ? 0.45 : 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: new THREE.Color(human ? '#ffcf5a' : '#ff8040'), emissiveIntensity: 0 });
	const pool = { h: [] as THREE.Mesh[], m: [] as THREE.Mesh[] };
	for (let i = 0; i < 15; i++) for (const k of ['h', 'm'] as const) { const c = new THREE.Mesh(ckGeo, mkMat(k === 'h')); c.castShadow = true; c.receiveShadow = true; scene.add(c); pool[k].push(c); }
	const labels: THREE.Sprite[] = [];

	// dice (same ivory look as /dice)
	const DS = 0.62, up = new THREE.Vector3(0, 1, 0);
	const diceMats = FACE_OF_MAT.map((n) => new THREE.MeshPhysicalMaterial({ map: faceTex(n, 'color'), bumpMap: faceTex(n, 'bump'), bumpScale: 2.5, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
	const dice = [0, 1].map(() => { const d = new THREE.Mesh(new RoundedBoxGeometry(DS, DS, DS, 4, 0.08), diceMats); d.castShadow = true; d.visible = false; scene.add(d); return d; });
	const alignFace = (f: number) => new THREE.Quaternion().setFromUnitVectors(NORMALS[FACE_OF_MAT.indexOf(f)], up);

	let assign = new Map<Loc, THREE.Mesh[]>(), board: Board = new Array(28).fill(0), hl: Highlights = { sources: new Set(), targets: new Set(), sel: null, lastTo: new Set() };
	function applyHighlights() {
		tris.forEach((t, i) => { (t.material as THREE.MeshStandardMaterial).emissiveIntensity = hl.targets.has(i) ? 0.9 : hl.lastTo.has(i) ? 0.18 : 0; });
		(trays[1].material as THREE.MeshStandardMaterial).color.set(hl.targets.has(-1) ? '#8a5a12' : '#3a1f10');
		for (const k of ['h', 'm'] as const) for (const c of pool[k]) (c.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0;
		for (const loc of hl.sources) { const a = assign.get(loc); const top = a?.[a.length - 1]; if (top) { const m = top.material as THREE.MeshPhysicalMaterial; m.emissive.set(hl.sel === loc ? '#36e27e' : '#ffcf5a'); m.emissiveIntensity = hl.sel === loc ? 0.55 : 0.28; } }
		invalidate();
	}
	/** Place every checker for board b instantly (identical checkers ⇒ re-assignment is invisible). */
	function sync(b: Board) {
		board = b.slice(); assign = new Map();
		let hi = 0, mi = 0;
		for (const l of labels) scene.remove(l); labels.length = 0;
		for (const [loc, { human, pos }] of layout(b)) {
			const arr: THREE.Mesh[] = [];
			for (const p of pos) { const c = human ? pool.h[hi++] : pool.m[mi++]; c.visible = true; c.position.copy(p); c.rotation.set(loc >= 26 ? Math.PI / 2 : 0, 0, 0); arr.push(c); }
			assign.set(loc, arr);
			if (pos.length > 5 && loc < 24) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(String(pos.length)), depthTest: false })); s.scale.set(0.7, 0.7, 1); const top = pos[pos.length - 1]; s.position.set(top.x, top.y + 0.45, top.z); scene.add(s); labels.push(s); }
		}
		for (; hi < 15; hi++) pool.h[hi].visible = false;
		for (; mi < 15; mi++) pool.m[mi].visible = false;
		applyHighlights();
	}

	type Tween = { t0: number; dur: number; step: (u: number) => void; done: () => void };
	const tweens: Tween[] = [];
	const tween = (dur: number, step: (u: number) => void) => new Promise<void>((done) => { if (opts.reducedMotion() || dur <= 0) { step(1); done(); invalidate(); return; } tweens.push({ t0: performance.now(), dur, step, done }); kick(); });
	const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
	function arc(m: THREE.Mesh, to: THREE.Vector3, h: number, dur: number, flip = false) {
		const from = m.position.clone(), r0 = m.rotation.x;
		return tween(dur, (u) => { const e = ease(u); m.position.lerpVectors(from, to, e); m.position.y += 4 * h * e * (1 - e); if (flip) m.rotation.x = r0 + (Math.PI / 2 - r0) * e; });
	}
	/** Animate one checker move. before/after are human-view boards, from/to are locations in human view. */
	async function move(before: Board, after: Board, from: Loc, to: Loc, humanMoved: boolean) {
		sync(before);
		const src = assign.get(from); const mover = src?.[src.length - 1];
		const lay = layout(after), dest = lay.get(to)?.pos, jobs: Promise<void>[] = [];
		if (mover && dest) { const d = mover.position.distanceTo(dest[dest.length - 1]); jobs.push(arc(mover, dest[dest.length - 1], 0.6 + d * 0.06, 280 + d * 40, to >= 26)); }
		const hitLoc = humanMoved ? 25 : 24, victims = assign.get(to);
		if (to < 24 && victims?.length === 1 && victims[0] !== mover && (before[to] > 0) !== humanMoved) {
			const bp = lay.get(hitLoc)!.pos; const v = victims[0];
			jobs.push(new Promise((r) => setTimeout(r, opts.reducedMotion() ? 0 : 160)).then(() => arc(v, bp[bp.length - 1], 1.4, 520)));
		}
		await Promise.all(jobs);
		sync(after);
	}
	/** Throw two dice onto one half of the board; resolves when they rest showing exactly `values`. */
	function rollDice(values: number[], humanSide: boolean) {
		const sx = humanSide ? 1 : -1, jobs: Promise<void>[] = [];
		dice.forEach((d, k) => {
			const v = values[k] ?? values[0];
			const qT = new THREE.Quaternion().setFromAxisAngle(up, (crypto.getRandomValues(new Uint8Array(1))[0] / 255) * 0.8 - 0.4).multiply(alignFace(v));
			const to = new THREE.Vector3(sx * (2.6 + k * 1.1), DS / 2 + 0.005, (k ? 0.5 : -0.5)), from = new THREE.Vector3(sx * 6.5, 3.2, k ? 5 : 4);
			const axis = new THREE.Vector3(1, 0.3 * k, 0.6).normalize(), turns = 3 + k;
			d.visible = true;
			jobs.push(tween(1100 + k * 120, (u) => {
				const e = 1 - (1 - u) ** 3;
				d.quaternion.copy(qT).multiply(new THREE.Quaternion().setFromAxisAngle(axis, turns * Math.PI * 2 * (1 - e)));
				d.position.lerpVectors(from, to, e);
				const bounce = u < 0.6 ? 0 : Math.abs(Math.sin((u - 0.6) * Math.PI * 5)) * 0.35 * (1 - u);
				d.position.y = to.y + (from.y - to.y) * (1 - e) * (1 - e) + bounce;
			}).then(() => { d.quaternion.copy(qT); d.position.copy(to); }));
		});
		return Promise.all(jobs).then(() => invalidate());
	}
	/** Face value currently on top of each 3D die (for tests: must equal the crypto roll). */
	const diceTop = () => dice.map((d) => { let best = 0, f = 0; NORMALS.forEach((n, i) => { const y = n.clone().applyQuaternion(d.quaternion).y; if (y > best) { best = y; f = FACE_OF_MAT[i]; } }); return f; });
	const hideDice = () => { dice.forEach((d) => (d.visible = false)); invalidate(); };

	// camera fit: angled from the human side; portrait goes more top-down
	const look = new THREE.Vector3(0.5, 0, 0.4);
	function fit() {
		const a = camera.aspect, portrait = a < 0.9;
		camera.fov = 34;
		const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * a);
		if (portrait) {
			// phone: board turned 90° on screen (long side vertical) → each point gets ~25% more pixels than the flat SVG board
			const tilt = 1.36, W = 17.4, D = 13.9;
			const d = Math.max(D / 2 / Math.tan(hf / 2), (W * Math.sin(tilt)) / 2 / Math.tan(vf / 2)) * 1.03;
			camera.up.set(-1, 0, 0);
			camera.position.set(look.x - Math.cos(tilt) * d, Math.sin(tilt) * d, look.z * 0);
			camera.lookAt(look.x, 0, 0);
		} else {
			const tilt = 0.98, W = 17.6, D = 14.2 * Math.sin(tilt) + 1.2 * Math.cos(tilt);
			const d = Math.max(W / 2 / Math.tan(hf / 2), D / 2 / Math.tan(vf / 2)) * 1.08;
			camera.up.set(0, 1, 0);
			camera.position.set(look.x, look.y + Math.sin(tilt) * d, look.z + Math.cos(tilt) * d);
			camera.lookAt(look);
		}
		camera.updateProjectionMatrix();
	}
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.4, 0.92));
	const vignette = new ShaderPass(VignetteShader); vignette.uniforms.strength.value = 1.0; composer.addPass(vignette);
	composer.addPass(new OutputPass());
	function resize() {
		const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h);
		camera.aspect = w / h; fit(); invalidate();
	}
	const ro = new ResizeObserver(resize); ro.observe(canvas);

	let raf = 0, dirty = true;
	function invalidate() { dirty = true; kick(); }
	function kick() { if (!raf) raf = requestAnimationFrame(frame); }
	function frame(now: number) {
		raf = 0;
		for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], u = Math.min(1, (now - t.t0) / t.dur); t.step(u); if (u >= 1) { tweens.splice(i, 1); t.done(); } }
		if (dirty || tweens.length) { composer.render(); dirty = false; }
		if (tweens.length) kick();
	}
	// picking (tap = pointerdown/up without much movement)
	const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
	let down: { x: number; y: number } | null = null;
	const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
	const onUp = (e: PointerEvent) => {
		if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { down = null; return; } down = null;
		const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(hits, false)[0];
		if (h) opts.onPick(h.object.userData.loc as number);
	};
	canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
	/** Screen position (CSS px, relative to canvas) of a location — used by tests. */
	function screenOf(loc: number) {
		const h = hits.find((m) => m.userData.loc === loc)!; const p = h.position.clone(); p.y = 0.1;
		if (loc < 24) p.z = near(loc) ? 3.6 : -3.6;
		p.project(camera); const r = canvas.getBoundingClientRect();
		return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
	}
	resize();
	return {
		sync, move, rollDice, hideDice, diceTop, screenOf, invalidate,
		setHighlights(h: Highlights) { hl = h; applyHighlights(); },
		get board() { return board; },
		destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); composer.dispose(); pmrem.dispose(); renderer.dispose(); scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
	};
}
export type TavlaScene = ReturnType<typeof createTavlaScene>;
