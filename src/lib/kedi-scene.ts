// Kedi 3D scene: lamp-lit dark room, wooden table, three cups, a yarn ball and a low-poly cat behind the table.
// The cat's eyes are a separate fixed camera ("cat camera") that renders only layer 0 (cups, toy, table, room — never the cat
// itself) into a tiny render target; capture() turns it into a 64×32 grayscale frame. That frame is the ONLY input the model gets.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTextures, VignetteShader } from './scene';
import { pose, SLOT_X, FPS, type Ev, type Pose } from './kedi-anim';

export const CAM_W = 64, CAM_H = 32; // model input
const RT_W = CAM_W * 2, RT_H = CAM_H * 2; // rendered at 2× and box-filtered (anti-aliasing)
export const CUP_H = 0.95;
export type Mood = 'idle' | 'think' | 'happy' | 'sad';
export type Light = { key: number; hemi: number; kx: number; kz: number };
export const LIGHT0: Light = { key: 120, hemi: 0.7, kx: 0.6, kz: 1.4 };

function yarnTex() {
	const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
	g.fillStyle = '#ffc93a'; g.fillRect(0, 0, 256, 128);
	g.strokeStyle = '#e09a1e'; g.lineWidth = 3;
	for (let i = 0; i < 26; i++) { g.beginPath(); const y = (i * 37) % 128, a = (i * 53) % 256; g.moveTo(0, y); g.bezierCurveTo(80, y + ((a % 60) - 30), 170, y - ((a % 40) - 20), 256, y); g.stroke(); }
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** The cheat: a flat 2D picture of the yarn ball (same colours and strands as the toy, painted shading, transparent outside). */
function stickerTex() {
	const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
	g.save(); g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.clip();
	g.fillStyle = '#ffc93a'; g.fillRect(0, 0, 128, 128);
	g.strokeStyle = '#e09a1e'; g.lineWidth = 3;
	for (let i = 0; i < 14; i++) { g.beginPath(); const y = (i * 37) % 128, a = (i * 53) % 128; g.moveTo(0, y); g.bezierCurveTo(40, y + ((a % 60) - 30), 85, y - ((a % 40) - 20), 128, y); g.stroke(); }
	const sh = g.createRadialGradient(46, 42, 6, 64, 64, 64); sh.addColorStop(0, '#ffffff40'); sh.addColorStop(0.55, '#00000000'); sh.addColorStop(1, '#0000008a');
	g.fillStyle = sh; g.fillRect(0, 0, 128, 128); g.restore();
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cupGeometry() {
	// upside-down cup: closed top at y = CUP_H, open bottom (rim) at y = 0, slight taper and a lip
	const p = [new THREE.Vector2(0, CUP_H), new THREE.Vector2(0.3, CUP_H), new THREE.Vector2(0.36, CUP_H - 0.04), new THREE.Vector2(0.43, 0.2),
		new THREE.Vector2(0.48, 0.07), new THREE.Vector2(0.5, 0.0), new THREE.Vector2(0.46, 0.0), new THREE.Vector2(0.44, 0.07), new THREE.Vector2(0.4, 0.2), new THREE.Vector2(0.33, CUP_H - 0.08), new THREE.Vector2(0, CUP_H - 0.08)];
	const g = new THREE.LatheGeometry(p, 40); g.computeVertexNormals(); return g;
}

export function createKediScene(canvas: HTMLCanvasElement, opts: { onCup: (cup: number) => void; onDrag: (from: number, to: number) => void; reducedMotion: () => boolean; onFrame?: (f: Uint8Array, t: number) => void }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
	renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#050403'); scene.fog = new THREE.Fog('#050403', 14, 34);
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22;
	const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
	camera.layers.enable(1);

	const key = new THREE.SpotLight('#ffd9a8', LIGHT0.key, 40, Math.PI / 4.2, 0.9, 1.2);
	key.position.set(LIGHT0.kx, 11, LIGHT0.kz); key.target.position.set(0, 0, -0.3); key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.camera.near = 5; key.shadow.camera.far = 20;
	const hemi = new THREE.HemisphereLight('#5a4630', '#0a0604', LIGHT0.hemi);
	const bounce = new THREE.PointLight('#ff9a50', 5, 16); bounce.position.set(-5, 1.5, 4);
	scene.add(key, key.target, hemi, bounce);

	// room + table
	const wood = woodTextures(); wood.color.repeat.set(5, 5); wood.bump.repeat.set(5, 5);
	const FLOOR_Y = -3.0;
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: wood.color, bumpMap: wood.bump, bumpScale: 1.2, roughness: 0.85, color: '#8a7a6a' }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);
	const tw = woodTextures(); tw.color.repeat.set(1.4, 1); tw.bump.repeat.set(1.4, 1);
	const tableMat = new THREE.MeshStandardMaterial({ map: tw.color, bumpMap: tw.bump, bumpScale: 0.8, roughness: 0.55, color: '#c08a5c' });
	const TW = 7.4, TD = 4.6;
	const top = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.24, TD), tableMat); top.position.set(0, -0.12, 0); top.receiveShadow = true; top.castShadow = true; scene.add(top);
	const legMat = new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 0.7 });
	for (const [x, z] of [[-3.3, -1.9], [3.3, -1.9], [-3.3, 1.9], [3.3, 1.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, -FLOOR_Y - 0.24, 0.28), legMat); l.position.set(x, (FLOOR_Y - 0.24) / 2, z); l.castShadow = true; scene.add(l); }
	// a felt mat under the cups (gives the cat camera a calm, even background)
	const mat = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.02, 3.2), new THREE.MeshStandardMaterial({ color: '#23402e', roughness: 1 }));
	mat.position.set(0, 0.0, 0.1); mat.receiveShadow = true; scene.add(mat);
	const TABLE_Y = 0.011;

	// cups + toy
	const cupGeo = cupGeometry();
	const cupMat = new THREE.MeshStandardMaterial({ color: '#b5452c', roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide });
	const cups = [0, 1, 2].map((i) => { const m = new THREE.Mesh(cupGeo, cupMat); m.castShadow = true; m.receiveShadow = true; m.userData.cup = i; scene.add(m); return m; });
	const band = new THREE.MeshStandardMaterial({ color: '#f1e3c4', roughness: 0.5 });
	for (const c of cups) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.03, 8, 40), band); b.rotation.x = Math.PI / 2; b.position.y = 0.42; c.add(b); }
	// cheat stickers: a toy picture on the cat-facing (−z) side of each cup, layer 0 (the cat camera sees them; the player's camera
	// looks from +z, so the cup itself hides them). Invisible unless switched on: with no stickers the frames are bit-identical.
	const stickTex = stickerTex(); // glossy print: a little emissive so it reads about as bright as the real (front-lit) toy in the cat camera
	const stickMat = new THREE.MeshStandardMaterial({ map: stickTex, emissiveMap: stickTex, emissive: '#ffffff', emissiveIntensity: 0.55, transparent: true, alphaTest: 0.5, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
	const stickers = cups.map((c) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), stickMat); m.position.set(0, 0.25, -0.49);
		m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.1, -1).normalize()); m.visible = false; c.add(m); return m; });
	let stick = { on: [false, false, false], since: [0, 0, 0] };
	const applyStickers = (t: number) => stickers.forEach((m, i) => { m.visible = stick.on[i] && t >= stick.since[i]; });
	const toy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 2), new THREE.MeshStandardMaterial({ map: yarnTex(), roughness: 0.9 }));
	toy.castShadow = true; scene.add(toy);

	// the cat (layer 1: visible to the main camera only, never to the cat camera)
	const cat = new THREE.Group(); cat.position.set(0, -0.15, -3.05); cat.scale.setScalar(1.28); scene.add(cat);
	const fur = new THREE.MeshStandardMaterial({ color: '#e08636', roughness: 0.8, flatShading: true });
	const cream = new THREE.MeshStandardMaterial({ color: '#f6e2c0', roughness: 0.85, flatShading: true });
	const pink = new THREE.MeshStandardMaterial({ color: '#f39aa6', roughness: 0.7, flatShading: true });
	const dark = new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.3 });
	const eyeMat = new THREE.MeshStandardMaterial({ color: '#b9e86a', roughness: 0.25, emissive: new THREE.Color('#2a3a10'), emissiveIntensity: 0.4 });
	const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number] = [1, 1, 1], parent: THREE.Object3D = cat) => { const o = new THREE.Mesh(g, m); o.position.set(...p); o.scale.set(...s); o.castShadow = true; parent.add(o); return o; };
	const body = mesh(new THREE.IcosahedronGeometry(1, 1), fur, [0, 0.15, -0.25], [0.95, 1.15, 0.8]);
	mesh(new THREE.IcosahedronGeometry(0.62, 1), cream, [0, 0.35, 0.38], [0.9, 1.1, 0.5]); // chest
	const head = new THREE.Group(); head.position.set(0, 1.62, 0.12); cat.add(head);
	mesh(new THREE.IcosahedronGeometry(0.66, 1), fur, [0, 0, 0], [1.12, 0.92, 0.95], head);
	mesh(new THREE.IcosahedronGeometry(0.3, 1), cream, [0, -0.2, 0.5], [1.15, 0.7, 0.6], head); // muzzle
	mesh(new THREE.ConeGeometry(0.07, 0.07, 3), pink, [0, -0.08, 0.66], [1.3, 1, 1], head).rotation.x = Math.PI; // nose
	const ears = [-1, 1].map((sx) => { const e = new THREE.Group(); e.position.set(sx * 0.4, 0.5, -0.02); e.rotation.z = -sx * 0.32; head.add(e); mesh(new THREE.ConeGeometry(0.24, 0.48, 4), fur, [0, 0.18, 0], [1, 1, 0.6], e); mesh(new THREE.ConeGeometry(0.14, 0.32, 4), pink, [0, 0.14, 0.06], [1, 1, 0.4], e); return e; });
	const eyes = [-1, 1].map((sx) => { const e = new THREE.Group(); e.position.set(sx * 0.27, 0.06, 0.52); head.add(e); mesh(new THREE.SphereGeometry(0.15, 16, 12), eyeMat, [0, 0, 0], [1, 1.05, 0.6], e); const p = mesh(new THREE.SphereGeometry(0.075, 12, 10), dark, [0, 0, 0.08], [0.6, 1.25, 0.5], e); return { e, p }; });
	const whisk = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([-1, 1].flatMap((sx) => [0, 1, 2].flatMap((k) => [new THREE.Vector3(sx * 0.2, -0.2 + k * 0.05, 0.62), new THREE.Vector3(sx * 0.75, -0.26 + k * 0.1, 0.5)]))), new THREE.LineBasicMaterial({ color: '#f4efe6' }));
	head.add(whisk);
	const pawGeo = new THREE.IcosahedronGeometry(0.2, 1), armGeo = new THREE.CylinderGeometry(0.15, 0.17, 1, 7);
	const arms = [-1, 1].map((sx) => {
		const shoulder = new THREE.Vector3(sx * 0.55, 0.85, 0.2), rest = new THREE.Vector3(sx * 0.62, 0.13, 0.95);
		const paw = mesh(pawGeo, cream, [rest.x, rest.y, rest.z], [1.1, 0.75, 1.3]), arm = mesh(armGeo, fur, [0, 0, 0]);
		return { shoulder, rest, paw, arm, cur: rest.clone() };
	});
	const tail = new THREE.Mesh(new THREE.BufferGeometry(), fur); tail.castShadow = true; cat.add(tail);
	const tailPts = Array.from({ length: 7 }, () => new THREE.Vector3());
	// selection ring for hand swaps: also layer 1, so the cat camera never sees it
	const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffcf5a' }));
	ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); ring.layers.set(1);
	let selCup: number | null = null;
	cat.traverse((o) => o.layers.set(1));

	// cat camera: fixed at the cat's eyes, sees layer 0 only
	const catCam = new THREE.PerspectiveCamera(38, CAM_W / CAM_H, 0.5, 20);
	catCam.position.set(0, 3.9, -2.3); catCam.lookAt(0, 0.3, 0.3); catCam.layers.set(0);
	const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, { samples: 0, depthBuffer: true });
	const px = new Uint8Array(RT_W * RT_H * 4);
	const LUT = new Uint8Array(256 * 4); // linear luminance (0..1020 = sum of 4 samples) → 8-bit display value
	for (let i = 0; i < LUT.length; i++) { const l = i / (LUT.length - 1); LUT[i] = Math.round(255 * Math.pow(1 - Math.exp(-3.2 * l), 1 / 2.2) / Math.pow(1 - Math.exp(-3.2), 1 / 2.2)); }

	// timeline / clock
	let ev: Ev[] = [], time = 0, running = true, nextK = 0, capturing = false, capT0 = 0, lastFrame: Uint8Array | null = null;
	let shown: Pose = pose(ev, 0);
	let timers: { t: number; f: () => void }[] = [];
	const knocked = new Map<number, { t0: number; dir: number }>();
	function apply(p: Pose, now: number) {
		p.cups.forEach((c, i) => { const m = cups[i]; m.position.set(c.x, TABLE_Y + c.y, c.z); m.rotation.set(0, 0, 0); });
		for (const [i, k] of knocked) { // hidden surprise: a cup knocked off the table (main view only, after the round)
			const u = now - k.t0, m = cups[i], g = 9.8, vx = 3.2 * k.dir, vy = 2.6;
			let x = SLOT_X[i] + vx * u, y = TABLE_Y + vy * u - (g * u * u) / 2, r = u * 7 * k.dir;
			const yFloor = FLOOR_Y + 0.0; if (y < yFloor) { y = yFloor; x = SLOT_X[i] + vx * Math.min(u, 1.2) ; r = Math.PI / 2 * k.dir; }
			m.position.set(x, y, 0.4 * u); m.rotation.set(0, 0, -r);
		}
		if (selCup !== null) ring.position.set(cups[selCup].position.x, TABLE_Y + 0.02, cups[selCup].position.z);
		toy.position.set(p.toy.x, TABLE_Y + 0.215, p.toy.z); toy.visible = p.toy.on; toy.rotation.y = p.toy.x * 1.7;
	}
	/** Render the cat camera at pose p and return the 64×32 grayscale frame (row 0 = bottom, like readPixels). */
	function captureAt(p: Pose, tk = time): Uint8Array {
		apply(p, time); applyStickers(tk);
		renderer.setRenderTarget(rt); renderer.render(scene, catCam); renderer.setRenderTarget(null);
		renderer.readRenderTargetPixels(rt, 0, 0, RT_W, RT_H, px);
		const f = new Uint8Array(CAM_W * CAM_H);
		for (let y = 0; y < CAM_H; y++) for (let x = 0; x < CAM_W; x++) {
			let s = 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const i = ((2 * y + dy) * RT_W + 2 * x + dx) * 4; s += px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722; }
			f[y * CAM_W + x] = LUT[Math.min(LUT.length - 1, Math.round(s))];
		}
		return f;
	}
	const same = (a: Uint8Array, b: Uint8Array) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
	/** Fixed-rate capture: every 1/FPS of game time, render the cat camera at exactly that time; identical frames are dropped. */
	function pump() {
		if (!capturing) return;
		while (capT0 + nextK / FPS <= time) {
			const tk = capT0 + nextK / FPS; nextK++;
			const f = captureAt(pose(ev, tk), tk);
			if (lastFrame && same(f, lastFrame)) continue;
			lastFrame = f; opts.onFrame?.(f, tk);
		}
	}

	// main camera: fixed tilt, distance by bisection so the table, cups and the cat's ears fit the free rectangle
	let insets = { top: 0, right: 0, bottom: 0, left: 0 };
	const look = new THREE.Vector3();
	function fit() {
		const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
		const rw = Math.max(50, W - insets.left - insets.right), rh = Math.max(50, H - insets.top - insets.bottom), portrait = rw / rh < 0.9;
		camera.aspect = W / H; camera.setViewOffset(W, H, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, W, H);
		const tilt = portrait ? 0.62 : 0.5; look.set(0, 0.55, -0.35);
		const pts = [[-2.4, 0, 1.4], [2.4, 0, 1.4], [-2.4, 0, -1.2], [2.4, 0, -1.2], [-1.1, 3.05, -3.0], [1.1, 3.05, -3.0], [-1.6, 1.3, -3.0], [1.6, 1.3, -3.0], [0, CUP_H + 1.1, 0]].map(([x, y, z]) => new THREE.Vector3(x, y, z));
		const x0 = insets.left + 8, x1 = W - insets.right - 8, y0 = insets.top + 8, y1 = H - insets.bottom - 8;
		const ok = (d: number) => {
			camera.position.set(look.x, look.y + Math.sin(tilt) * d, look.z + Math.cos(tilt) * d); camera.lookAt(look); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
			return pts.every((p) => { const q = p.clone().project(camera); const sx = ((q.x + 1) / 2) * W, sy = ((1 - q.y) / 2) * H; return q.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
		};
		let lo = 3, hi = 80; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
		ok(hi);
	}
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.1, 0.4, 2.6));
	const vignette = new ShaderPass(VignetteShader); vignette.uniforms.strength.value = 1.0; composer.addPass(vignette);
	composer.addPass(new OutputPass());
	let curPr = 0, raf = 0, mainOn = true;
	function pixelRatio() { const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2); return Math.max(0.5, Math.min(dpr, Math.sqrt(4.2e6 / Math.max(1, w * h)))); }
	function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; const pr = pixelRatio(); curPr = pr; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); fit(); }
	const ro = new ResizeObserver(resize); ro.observe(canvas);

	// cat animation state (main view only)
	let mood: Mood = 'idle', moodT = 0, gaze = new THREE.Vector3(0, 0.4, 0), gazeTarget = new THREE.Vector3(0, 0.4, 0);
	let paw: { slot: number; t0: number; done: () => void } | null = null;
	const tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3();
	function animateCat(now: number, dt: number) {
		const rm = opts.reducedMotion();
		gaze.lerp(gazeTarget, 1 - Math.exp(-dt * 9));
		const hw = head.getWorldPosition(tmpV).clone();
		tmpM.lookAt(gaze, hw, UP); tmpQ.setFromRotationMatrix(tmpM); // head faces the gaze point (+z toward it)
		const parentQ = cat.quaternion.clone().invert(); tmpQ.premultiply(parentQ);
		const base = new THREE.Quaternion().slerp(tmpQ, 0.75);
		const mt = now - moodT, bounce = mood === 'happy' && !rm ? Math.abs(Math.sin(mt * 9)) * 0.12 * Math.max(0, 1 - mt / 2.5) : 0;
		const tiltZ = mood === 'sad' ? 0.22 : mood === 'think' ? Math.sin(now * 1.3) * 0.08 : 0;
		head.quaternion.copy(base).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(mood === 'sad' ? 0.25 : 0, 0, tiltZ)));
		head.position.y = 1.62 + bounce + (rm ? 0 : Math.sin(now * 2) * 0.012);
		body.scale.y = 1.15 + (rm ? 0 : Math.sin(now * 2) * 0.012);
		ears.forEach((e, i) => { const sx = i ? 1 : -1; e.rotation.z = -sx * (mood === 'sad' ? 0.95 : 0.32); e.rotation.x = mood === 'sad' ? -0.4 : mood === 'think' ? Math.sin(now * 3 + i) * 0.06 : 0; });
		const blink = !rm && (now % 4.1) < 0.12;
		eyes.forEach(({ e, p }) => {
			e.scale.y = mood === 'happy' ? 0.25 : blink ? 0.1 : 1;
			const ew = e.getWorldPosition(new THREE.Vector3()), d = gaze.clone().sub(ew).normalize();
			const local = d.applyQuaternion(e.getWorldQuaternion(new THREE.Quaternion()).invert());
			p.position.set(local.x * 0.06, local.y * 0.05, 0.085);
			p.scale.x = mood === 'think' ? 0.85 : 0.6;
		});
		// tail sways (faster when happy)
		const sp = mood === 'happy' ? 7 : mood === 'sad' ? 0.8 : 1.8, amp = rm ? 0.05 : mood === 'sad' ? 0.1 : 0.35;
		tailPts.forEach((q, i) => { const k = i / (tailPts.length - 1); q.set(0.75 + k * 0.4 + Math.sin(now * sp - k * 2.2) * amp * k, -0.45 + k * 1.8, -0.6 - k * 0.15); });
		tail.geometry.dispose(); tail.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.1, 7, false);
		// paws: rest on the table edge; when pointing, the right (or left) paw reaches out and taps a cup
		arms.forEach((a, i) => {
			let target = a.rest.clone();
			if (paw && ((SLOT_X[paw.slot] >= 0) === (i === 1))) {
				const u = (now - paw.t0) / (rm ? 0.6 : 1.3), cx = SLOT_X[paw.slot];
				const top = cat.worldToLocal(new THREE.Vector3(cx, CUP_H + 0.2, -0.2)); // just above the cup's top, cat side
				const reach = u < 0.4 ? smoothstep(u / 0.4) : u < 0.75 ? 1 : 1 - smoothstep((u - 0.75) / 0.25);
				const tap = u > 0.4 && u < 0.75 ? Math.abs(Math.sin(((u - 0.4) / 0.35) * Math.PI * 2)) * 0.18 : 0;
				target = a.rest.clone().lerp(top, reach); target.y -= tap;
				if (u >= 1) { const d = paw.done; paw = null; d(); }
			}
			a.cur.lerp(target, 1 - Math.exp(-dt * 30));
			a.paw.position.copy(a.cur);
			const mid = a.shoulder.clone().add(a.cur).multiplyScalar(0.5), len = a.shoulder.distanceTo(a.cur);
			a.arm.position.copy(mid); a.arm.scale.set(1, len, 1);
			a.arm.quaternion.setFromUnitVectors(UP, a.cur.clone().sub(a.shoulder).normalize());
		});
	}
	const smoothstep = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

	let last = performance.now() / 1000;
	function frame(ms: number) {
		raf = requestAnimationFrame(frame);
		const now = ms / 1000, dt = Math.min(0.1, Math.max(0, now - last)); last = now; // game clock pauses with the tab
		if (running) time += dt;
		pump();
		if (timers.length) { const due = timers.filter((x) => x.t <= time); if (due.length) { timers = timers.filter((x) => x.t > time); for (const x of due) x.f(); } }
		shown = pose(ev, time); apply(shown, time); applyStickers(time);
		animateCat(now, dt);
		vignette.uniforms.time.value = now % 100;
		if (mainOn) composer.render();
	}
	resize(); raf = requestAnimationFrame(frame);

	// input: click a cup, or drag one cup onto another
	const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
	const pick = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(cups, true)[0]; let o: THREE.Object3D | null = h?.object ?? null; while (o && o.userData.cup === undefined) o = o.parent; return o ? (o.userData.cup as number) : -1; };
	let down: { x: number; y: number; cup: number } | null = null;
	const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, cup: pick(e) }; };
	const onUp = (e: PointerEvent) => {
		const d = down; down = null; if (!d || d.cup < 0) return;
		const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
		if (moved < 12) { opts.onCup(d.cup); return; }
		const to = pick(e); if (to >= 0 && to !== d.cup) opts.onDrag(d.cup, to);
	};
	canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
	const toScreen = (p: THREE.Vector3) => { const q = p.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height }; };

	return {
		/** Replace the round's timeline (game time restarts at 0). Capture starts with startCapture(). */
		/** Run f once game time reaches t (sounds and UI follow the animation even when frames are slow). */
		at(t: number, f: () => void) { timers.push({ t, f }); },
		reset() { stick = { on: stick.on, since: [0, 0, 0] }; timers = []; ev = []; time = 0; nextK = 0; capturing = false; lastFrame = null; knocked.clear(); selCup = null; ring.visible = false; },
		push(e: Ev) { ev.push(e); },
		events: () => ev,
		time: () => time,
		/** Start sampling the cat camera at game time t0 (the moment the toy is hidden). */
		startCapture(t0: number) { capturing = true; capT0 = t0; nextK = 0; lastFrame = null; },
		stopCapture() { pump(); capturing = false; },
		setRunning(r: boolean) { running = r; },
		setInsets(i: typeof insets) { insets = i; fit(); },
		setMood(m: Mood) { if (m !== mood) { mood = m; moodT = performance.now() / 1000; } },
		/** Where the cat looks (world x of the cup it currently believes in, or null = the middle of the table). */
		lookAt(x: number | null, conf = 1) { gazeTarget.set(x ?? 0, 0.45 + (1 - conf) * 0.2, 0); },
		pawAt(slot: number): Promise<void> { return new Promise((res) => { paw = { slot, t0: performance.now() / 1000, done: res }; }); },
		knock(cup: number) { knocked.set(cup, { t0: time, dir: SLOT_X[shown.at.indexOf(cup)] >= 0 ? 1 : -1 }); },
		screenOfCup(cup: number) { return toScreen(cups[cup].position.clone().setY(CUP_H * 0.6)); },
		screenOfSlot(slot: number, y = CUP_H * 0.6, z = 0) { return toScreen(new THREE.Vector3(SLOT_X[slot], y, z)); },
		select(cup: number | null) { selCup = cup; ring.visible = cup !== null; },
		pose: () => shown,
		/** Data generator / tests: render the cat camera for a whole timeline at fixed-rate times, without the realtime clock. */
		renderEpisode(e: Ev[], t0: number, end: number, light: Light = LIGHT0, st?: { on: boolean[]; since: number[] }) {
			const save = ev, saveSt = stick; ev = e; setLight(light); if (st) stick = { on: [...st.on], since: [...st.since] };
			const frames: Uint8Array[] = [], times: number[] = [], poses: Pose[] = [];
			let prev: Uint8Array | null = null;
			for (let k = 0; t0 + k / FPS <= end; k++) { const tk = t0 + k / FPS, p = pose(e, tk), f = captureAt(p, tk); if (prev && same(f, prev)) continue; prev = f; frames.push(f); times.push(tk); poses.push(p); }
			ev = save; stick = saveSt; setLight(LIGHT0);
			return { frames, times, poses };
		},
		captureNow: () => captureAt(pose(ev, time)),
		/** Cheat stickers by cup id: on/off, visible from game time `since` (0 = already there before the hide). */
		setSticker(cup: number, on: boolean, since = time) { stick = { on: stick.on.map((v, i) => (i === cup ? on : v)), since: stick.since.map((v, i) => (i === cup ? (on ? since : 0) : v)) }; },
		stickers: () => ({ on: [...stick.on], since: [...stick.since] }),
		/** Data generator: stop drawing the main view (the cat camera still renders on demand). */
		mainView(on: boolean) { mainOn = on; },
		_cam: catCam, _r: renderer, _key: key, _scene: scene, _rt: rt, _apply: (p: Pose) => apply(p, time), _capAt: (p: Pose) => captureAt(p),
		destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); composer.dispose(); rt.dispose(); pmrem.dispose(); renderer.dispose(); scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
	};
	function setLight(l: Light) { key.intensity = l.key; hemi.intensity = l.hemi; key.position.set(l.kx, 11, l.kz); }
}
export type KediScene = ReturnType<typeof createKediScene>;
