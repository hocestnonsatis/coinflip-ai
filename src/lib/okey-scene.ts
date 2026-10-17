// Okey 3D table: same lamp-lit dark room / wooden table / bloom + vignette look as the coin, dice and tavla scenes.
// Every tile is one mesh keyed by its id; update(view) moves each tile to where the view says it is (tweened), so draws,
// discards, reorders and reveals all animate from one code path. Render-on-demand: frames only while tweening or after invalidate().
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTextures, VignetteShader } from './scene';
import { ttype, tcol, tval, FJ } from './okey-engine';

export const SLOTS = 26, ROW = 13;
export type Zone = 'pile' | 'take' | 'discard';
export type View = {
	rack: (number | null)[]; // 26 slots (2 rows × 13) of the human's istaka
	opp: number[][]; // hands of seats 1, 2, 3 (tile ids, in rack order)
	pile: number[]; discards: number[][]; gosterge: number; okey: number; turn: number;
	sel: number | null; sets: Map<number, number>; // tile id → set index (highlight)
	zones: Record<Zone, boolean>; reveal: boolean; names: string[]; // names[1..3] for the bots
};
import { INK, IVORY } from './okey-ink';
export { INK };
const SET_TINT = ['#36e27e', '#4ab8ff', '#ff9a3a', '#d070ff', '#ffd84a'];

function faceTex(t: number) {
	const w = 128, h = 176, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
	g.fillStyle = IVORY; g.fillRect(0, 0, w, h); // flat matte ivory (no baked gradient: the lamp already shades it)
	g.textAlign = 'center'; g.textBaseline = 'middle';
	if (t === FJ) { g.fillStyle = '#1d6b3a'; g.font = '900 96px Georgia, serif'; g.fillText('★', w / 2, h * 0.46); g.font = '700 22px system-ui, sans-serif'; g.fillText('OKEY', w / 2, h * 0.82); }
	else {
		// thicker numerals: fill + same-colour stroke; colour-blind hint under the number: red ◆, yellow ▲, blue ■, black ●
		const col = tcol(t), txt = String(tval(t));
		g.fillStyle = g.strokeStyle = INK[col]; g.lineJoin = 'round'; g.lineWidth = 5; g.font = `900 ${tval(t) >= 10 ? 78 : 92}px Georgia, serif`;
		g.strokeText(txt, w / 2, h * 0.42); g.fillText(txt, w / 2, h * 0.42);
		const cx = w / 2, cy = h * 0.79, r = 12; g.beginPath();
		if (col === 0) { g.moveTo(cx, cy - r * 1.15); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r * 1.15); g.lineTo(cx - r, cy); }
		else if (col === 1) { g.moveTo(cx, cy - r * 1.1); g.lineTo(cx + r * 1.15, cy + r * 0.85); g.lineTo(cx - r * 1.15, cy + r * 0.85); }
		else if (col === 2) g.rect(cx - r * 0.9, cy - r * 0.9, r * 1.8, r * 1.8);
		else g.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
		g.closePath(); g.fill();
	}
	const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
}
function backTex() {
	const w = 64, h = 88, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
	g.fillStyle = '#efe6cf'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9b88e'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
	const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function labelTex(text: string, active: boolean) {
	const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d')!;
	g.fillStyle = active ? '#ffcf5add' : '#000000aa'; g.beginPath(); g.roundRect(4, 8, 504, 80, 40); g.fill();
	g.fillStyle = active ? '#1a1205' : '#eae6da'; g.font = '700 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 50);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createOkeyScene(canvas: HTMLCanvasElement, opts: { onTile: (id: number) => void; onSlot: (slot: number) => void; onZone: (z: Zone) => void; onDrop: (id: number, to: { slot: number } | { zone: Zone }) => void; reducedMotion: () => boolean }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.78;
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#050403'); scene.fog = new THREE.Fog('#050403', 22, 48);
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.25;
	const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
	const key = new THREE.SpotLight('#ffd9a8', 130, 60, Math.PI / 3.4, 0.95, 1.2); // softer hotspot, wide falloff (legibility)
	key.position.set(1, 20, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.camera.near = 8; key.shadow.camera.far = 40;
	scene.add(key, key.target, new THREE.HemisphereLight('#5a4630', '#0a0604', 0.75));
	// even, low fill from behind the camera onto the human rack (keeps inks readable at the table edge)
	const fill = new THREE.SpotLight('#fff1dc', 16, 40, 0.42, 0.85, 1); fill.position.set(0, 9, 16); fill.target.position.set(0, 0.6, 6.2); scene.add(fill, fill.target); // cone on the rack only, so the floor stays dark
	const bounce = new THREE.PointLight('#ff9a50', 8, 22); bounce.position.set(-7, 2, 7); scene.add(bounce);

	const wood = woodTextures(); wood.color.repeat.set(4, 4); wood.bump.repeat.set(4, 4);
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: wood.color, roughnessMap: wood.bump, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.85 }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);
	// felt‑less okey table top: a darker inlaid square with a brass edge
	const top = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.06, 15.4), new THREE.MeshStandardMaterial({ color: '#2a4a32', roughness: 0.95 }));
	top.position.y = 0.0; top.receiveShadow = true; scene.add(top);
	const brass = new THREE.MeshStandardMaterial({ color: '#c9a25a', metalness: 0.85, roughness: 0.35 });
	for (const [w, d, x, z] of [[15.6, 0.1, 0, 7.75], [15.6, 0.1, 0, -7.75], [0.1, 15.6, 7.75, 0], [0.1, 15.6, -7.75, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), brass); b.position.set(x, 0.03, z); scene.add(b); }

	// racks (istaka)
	const rackWood = woodTextures(); rackWood.color.repeat.set(3, 1);
	const rackMat = new THREE.MeshStandardMaterial({ map: rackWood.color, bumpMap: rackWood.bump, bumpScale: 0.6, roughness: 0.6, color: '#b98455' });
	const TW = 0.74, TH = 1.0, TD = 0.26, GAP = 0.05, PITCH = TW + GAP;
	const human = new THREE.Group(); scene.add(human);
	const mk = (w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D, mat: THREE.Material = rackMat) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.05), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
	const RX = ROW * PITCH + 0.5;
	mk(RX, 0.32, 1.25, 0, 0.16, 6.95, human); mk(RX, 0.85, 0.9, 0, 0.43, 5.95, human); // front tier, back tier
	const rowY = [0.86 + TH / 2 - 0.05, 0.32 + TH / 2 - 0.05], rowZ = [5.85, 6.85], TILT = -0.32;
	const slotPos = (k: number) => new THREE.Vector3((k % ROW - (ROW - 1) / 2) * PITCH, rowY[Math.floor(k / ROW)], rowZ[Math.floor(k / ROW)]);
	// opponents: one rack each, seats 1 (right), 2 (across), 3 (left)
	const seatRot = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
	const oppRacks = [1, 2, 3].map((s) => { const g = new THREE.Group(); g.rotation.y = seatRot[s]; const r = 6.95; g.position.set(Math.sin(seatRot[s]) * r, 0, Math.cos(seatRot[s]) * r); mk(11.6, 0.5, 0.9, 0, 0.25, 0, g); scene.add(g); return g; });
	const strips = [0, 1, 2, 3].map((s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(s ? 11.4 : RX - 0.2, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: '#2a1d0a', emissive: new THREE.Color('#ffb040'), emissiveIntensity: 0 })); const r = s ? 6.38 : 7.62; m.position.set(Math.sin(seatRot[s]) * r, 0.06, Math.cos(seatRot[s]) * r); m.rotation.y = seatRot[s]; scene.add(m); return m; });
	const labels = [1, 2, 3].map((s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('', false), depthTest: false })); sp.scale.set(2.6, 0.49, 1); const r = 5.6; sp.position.set(Math.sin(seatRot[s]) * r, 1.6, Math.cos(seatRot[s]) * r); scene.add(sp); return sp; });
	const labelState = ['', '', '', ''];

	// corners: discard piles (seat s throws to the corner on its right), pile + gösterge in the middle
	// layout (table top ±7.7): pile x −3.3…1.5, gösterge stand x 2.1…3.0, discard corners x/z ±(3.4…5.2) / ±(2.4…4.8), revealed side hands x ±(5.4…6.4)
	const corner = [new THREE.Vector3(4.3, 0, 3.6), new THREE.Vector3(4.3, 0, -3.6), new THREE.Vector3(-4.3, 0, -3.6), new THREE.Vector3(-4.3, 0, 3.6)];
	const PILE_X = -2.9, GOST = new THREE.Vector3(2.55, 0, 0), GOST_TILT = 0.5;
	const zoneMat = (c: string) => new THREE.MeshStandardMaterial({ color: '#1d3324', emissive: new THREE.Color(c), emissiveIntensity: 0, transparent: true, opacity: 0.9 });
	const zoneMesh = (x: number, z: number, w: number, d: number, zone: Zone, c: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), zoneMat(c)); m.position.set(x, 0.035, z); m.userData.zone = zone; scene.add(m); return m; };
	const zones: Record<Zone, THREE.Mesh> = { discard: zoneMesh(corner[0].x, corner[0].z, 1.8, 2.4, 'discard', '#36e27e'), take: zoneMesh(corner[3].x, corner[3].z, 1.8, 2.4, 'take', '#ffcf5a'), pile: zoneMesh(PILE_X + 2.5 * (TW + 0.06), 0, 5.0, 2.6, 'pile', '#ffcf5a') };
	// gösterge stand: a small wooden wedge right of the pile; the indicator leans on it, face up, tilted toward the human camera
	const stand = mk(1.05, 0.34, 1.25, GOST.x, 0.17, GOST.z, scene); void stand;

	// tiles
	const tileGeo = new RoundedBoxGeometry(TW, TH, TD, 2, 0.06);
	const faces = Array.from({ length: 53 }, (_, t) => faceTex(t)), back = backTex();
	const tiles = Array.from({ length: 106 }, (_, id) => {
		const side = new THREE.MeshPhysicalMaterial({ color: '#d9cfb6', roughness: 0.78, clearcoat: 0, emissive: new THREE.Color('#000'), emissiveIntensity: 0.6 });
		const face = new THREE.MeshPhysicalMaterial({ map: faces[ttype(id)], color: '#ece6d8', roughness: 0.8, clearcoat: 0, specularIntensity: 0.35, emissive: new THREE.Color('#000'), emissiveIntensity: 0.6 });
		const bk = new THREE.MeshPhysicalMaterial({ map: back, color: '#cfc4a8', roughness: 0.8, clearcoat: 0 });
		const m = new THREE.Mesh(tileGeo, [side, side, side, side, face, bk]); m.castShadow = true; m.receiveShadow = true; m.userData.id = id; m.visible = false;
		m.rotation.order = 'YXZ'; scene.add(m); return m;
	});
	const hitMat = new THREE.MeshBasicMaterial({ visible: false });
	const slotHits = Array.from({ length: SLOTS }, (_, k) => { const m = new THREE.Mesh(new THREE.BoxGeometry(PITCH, TH * 1.1, 0.9), hitMat); m.position.copy(slotPos(k)); m.userData.slot = k; scene.add(m); return m; });

	// targets for every tile in a view
	type T = { p: THREE.Vector3; e: THREE.Euler };
	function targets(v: View): Map<number, T> {
		const out = new Map<number, T>();
		// real okeys (wildcards) sit upside down in the rack, like players flip them at a real table; false jokers stay upright
		v.rack.forEach((id, k) => { if (id !== null) { const p = slotPos(k); if (id === v.sel) { p.y += 0.28; p.z -= 0.05; } out.set(id, { p, e: new THREE.Euler(TILT, 0, flipZ(id, v), 'YXZ') }); } });
		v.opp.forEach((hand, j) => {
			const s = j + 1, n = hand.length, a = seatRot[s], r = 6.92;
			hand.forEach((id, k) => {
				const off = (k - (n - 1) / 2) * (TW * (v.reveal ? 0.99 : 0.98)) * (v.reveal && s === 2 ? -1 : 1), local = new THREE.Vector3(off, 0.5 + TH / 2 - 0.02, 0);
				const p = local.applyAxisAngle(new THREE.Vector3(0, 1, 0), a).add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r));
				// tiles face their owner (away from the table centre: the camera only sees backs); at the end the hand is laid face up in front of the rack
				if (v.reveal) { p.y = 0.03 + TD / 2; p.add(new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)).multiplyScalar(0.95)); } // revealed: inner edge 5.47 from centre, ±5.13 along the side → clear of corners and neighbours
				out.set(id, { p, e: v.reveal ? new THREE.Euler(-Math.PI / 2, s === 2 ? 0 : a, 0, 'YXZ') : new THREE.Euler(-0.18, a, 0, 'YXZ') });
			});
		});
		// pile: stacks of 4 face down, 2 rows
		v.pile.forEach((id, k) => { const st = Math.floor(k / 4), h = k % 4; out.set(id, { p: new THREE.Vector3(PILE_X + (st % 6) * (TW + 0.06), 0.03 + TD / 2 + h * TD, (st >= 6 ? 0.58 : -0.58)), e: new THREE.Euler(Math.PI / 2, 0, 0, 'YXZ') }); });
		out.set(v.gosterge, { p: new THREE.Vector3(GOST.x, 0.34 + TD / 2 + 0.22, GOST.z + 0.05), e: new THREE.Euler(-Math.PI / 2 + GOST_TILT, 0, 0, 'YXZ') });
		v.discards.forEach((d, s) => d.forEach((id, k) => {
			const c = corner[s], j = d.length - 1 - k; // newest on top, older ones fan out underneath
			out.set(id, { p: new THREE.Vector3(c.x + Math.min(j, 6) * 0.05 * (s < 2 ? -1 : 1), 0.03 + TD / 2 + k * 0.02, c.z + Math.min(j, 6) * 0.07 * (s === 0 || s === 3 ? -1 : 1)), e: new THREE.Euler(-Math.PI / 2, seatRot[s] * 0 + (((id * 37) % 9) - 4) * 0.03, 0, 'YXZ') });
		}));
		return out;
	}
	const flipZ = (id: number, v: View) => (id < 104 && ttype(id) === v.okey ? Math.PI : 0);
	let view: View | null = null;
	type Tween = { t0: number; dur: number; step: (u: number) => void; done: () => void };
	const tweens: Tween[] = [];
	const tween = (dur: number, step: (u: number) => void) => new Promise<void>((done) => { if (opts.reducedMotion() || dur <= 0) { step(1); done(); invalidate(); return; } tweens.push({ t0: performance.now(), dur, step, done }); kick(); });
	const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
	let dragging: number | null = null;
	/** Move every tile to where view v puts it; tiles that change place fly there (arc for long moves). */
	function update(v: View, animate = true): Promise<void> {
		view = v; const tg = targets(v), jobs: Promise<void>[] = [];
		for (const m of tiles) {
			const id = m.userData.id as number, t = tg.get(id);
			if (!t) { m.visible = false; continue; }
			if (id === dragging) continue;
			const was = m.visible; m.visible = true;
			const q1 = new THREE.Quaternion().setFromEuler(t.e);
			const d = m.position.distanceTo(t.p);
			if (!animate || !was || d < 1e-3 && m.quaternion.angleTo(q1) < 1e-3) { m.position.copy(t.p); m.quaternion.copy(q1); continue; }
			const p0 = m.position.clone(), q0 = m.quaternion.clone(), h = d > 2 ? 0.8 + d * 0.06 : 0.1;
			jobs.push(tween(d > 2 ? 380 + d * 25 : 200, (u) => { const e = ease(u); m.position.lerpVectors(p0, t.p, e); m.position.y += 4 * h * e * (1 - e); m.quaternion.slerpQuaternions(q0, q1, e); }));
		}
		// highlights: selection, okey tiles in the human rack, sets
		for (const m of tiles) {
			const id = m.userData.id as number, [side, , , , face] = m.material as THREE.MeshPhysicalMaterial[];
			const inRack = v.rack.includes(id);
			const c = id === v.sel ? '#36e27e' : v.sets.has(id) ? SET_TINT[v.sets.get(id)! % SET_TINT.length] : inRack && ttype(id) === v.okey ? '#ffb000' : null;
			// tint the tile body; the face only gets a whisper so the numbers stay readable
			const k = id === v.sel ? 0.55 : v.sets.has(id) ? 0.4 : 0.5; // okey: gold rim on the body, a whisper on the face
			side.emissive.set(c ?? '#000'); side.emissiveIntensity = c ? k : 0;
			face.emissive.set(c ?? '#000'); face.emissiveIntensity = c ? (id === v.sel ? 0.12 : 0.05) : 0;
		}
		for (const z of Object.keys(zones) as Zone[]) (zones[z].material as THREE.MeshStandardMaterial).emissiveIntensity = v.zones[z] ? 0.55 : 0.0;
		strips.forEach((s, i) => ((s.material as THREE.MeshStandardMaterial).emissiveIntensity = v.turn === i ? 4.5 : 0));
		labels.forEach((sp, j) => { const s = j + 1, lr = v.reveal ? 7.9 : 5.6; sp.position.set(Math.sin(seatRot[s]) * lr, v.reveal ? 1.9 : 1.6, Math.cos(seatRot[s]) * lr);
			const txt = `${v.names[s]} · ${v.opp[j].length}`, st = `${txt}|${v.turn === s}`; if (labelState[s] !== st) { labelState[s] = st; const mat = sp.material as THREE.SpriteMaterial; mat.map?.dispose(); mat.map = labelTex(txt, v.turn === s); mat.needsUpdate = true; } });
		invalidate();
		return Promise.all(jobs).then(() => undefined);
	}

	// camera: fixed tilt per orientation, distance chosen by bisection so all key points land inside the free rectangle
	let insets = { top: 0, right: 0, bottom: 0, left: 0 };
	const look = new THREE.Vector3();
	function keyPoints(portrait: boolean) {
		const pts: THREE.Vector3[] = [];
		for (const x of [-RX / 2, RX / 2]) for (const [y, z] of [[1.5, 5.6], [0, 7.6]]) pts.push(new THREE.Vector3(x, y, z));
		if (portrait) pts.push(new THREE.Vector3(0, 0, -7.2), new THREE.Vector3(-4.6, 0, 0), new THREE.Vector3(4.6, 0, 0), new THREE.Vector3(0, 1.6, -7.2));
		else pts.push(new THREE.Vector3(0, 0, -7.6), new THREE.Vector3(-7.6, 0, 0), new THREE.Vector3(7.6, 0, 0), new THREE.Vector3(0, 1.8, -7.4), new THREE.Vector3(-7.4, 1.8, 0), new THREE.Vector3(7.4, 1.8, 0));
		return pts;
	}
	function fit() {
		const W = canvas.clientWidth, H = canvas.clientHeight; if (!W || !H) return;
		const rw = Math.max(50, W - insets.left - insets.right), rh = Math.max(50, H - insets.top - insets.bottom);
		const portrait = rw / rh < 0.9;
		camera.aspect = W / H; camera.up.set(0, 1, 0);
		const tilt = portrait ? 1.2 : 0.95; // elevation angle
		look.set(0, 0, portrait ? 1.4 : 0.9);
		camera.setViewOffset(W, H, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, W, H);
		const pts = keyPoints(portrait), x0 = insets.left + 6, x1 = W - insets.right - 6, y0 = insets.top + 6, y1 = H - insets.bottom - 6;
		const ok = (d: number) => {
			camera.position.set(look.x, look.y + Math.sin(tilt) * d, look.z + Math.cos(tilt) * d); camera.lookAt(look); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
			return pts.every((p) => { const q = p.clone().project(camera); const sx = ((q.x + 1) / 2) * W, sy = ((1 - q.y) / 2) * H; return q.z < 1 && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1; });
		};
		let lo = 4, hi = 120; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
		ok(hi);
		const fog = scene.fog as THREE.Fog; fog.near = hi + 6; fog.far = hi + 34; camera.far = hi + 80; camera.updateProjectionMatrix();
	}
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.4, 2.6)); // HDR threshold above the brightest lit tile: tiles never bloom, only the hot turn strips
	const vignette = new ShaderPass(VignetteShader); vignette.uniforms.strength.value = 1.0; composer.addPass(vignette);
	composer.addPass(new OutputPass());
	let curPr = 0, raf = 0, dirty = true;
	function pixelRatio(animating: boolean) { const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2); return Math.max(0.5, Math.min(dpr, Math.sqrt((animating ? 3.7e6 : 8.3e6) / Math.max(1, w * h)))); }
	function applyPr(pr: number) { if (Math.abs(pr - curPr) < 0.01) return; curPr = pr; const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); dirty = true; }
	function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; curPr = 0; applyPr(pixelRatio(tweens.length > 0)); fit(); invalidate(); }
	const ro = new ResizeObserver(resize); ro.observe(canvas);
	function invalidate() { dirty = true; kick(); }
	function kick() { if (!raf) raf = requestAnimationFrame(frame); }
	function frame(now: number) {
		raf = 0;
		for (let i = tweens.length - 1; i >= 0; i--) { const t = tweens[i], u = Math.min(1, (now - t.t0) / t.dur); t.step(u); if (u >= 1) { tweens.splice(i, 1); t.done(); } }
		const busy = tweens.length > 0 || dragging !== null;
		applyPr(pixelRatio(busy));
		if (dirty || tweens.length) { composer.render(); dirty = false; }
		if (tweens.length) kick(); else if (!busy && Math.abs(curPr - pixelRatio(false)) > 0.01) { applyPr(pixelRatio(false)); composer.render(); dirty = false; }
	}

	// input: tap (tile / slot / zone) or drag a rack tile onto a slot or the discard corner
	const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
	const rackTiles = () => tiles.filter((m) => view?.rack.includes(m.userData.id));
	const setRay = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
	let down: { x: number; y: number; id: number | null } | null = null;
	const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), hitPt = new THREE.Vector3();
	const onDown = (e: PointerEvent) => { setRay(e); const h = ray.intersectObjects(rackTiles(), false)[0]; down = { x: e.clientX, y: e.clientY, id: h ? (h.object.userData.id as number) : null }; if (down.id !== null) canvas.setPointerCapture(e.pointerId); };
	const onMove = (e: PointerEvent) => {
		if (!down || down.id === null) return;
		if (dragging === null && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) dragging = down.id;
		if (dragging === null) return;
		setRay(e); if (ray.ray.intersectPlane(dragPlane, hitPt)) { const m = tiles[dragging]; m.position.set(hitPt.x, 1.2, hitPt.z); m.quaternion.setFromEuler(new THREE.Euler(-0.6, 0, view ? flipZ(dragging, view) : 0, 'YXZ')); invalidate(); }
	};
	const nearestSlot = (p: THREE.Vector3) => { let best = -1, bd = 1.2; slotHits.forEach((s, k) => { const d = Math.hypot(s.position.x - p.x, s.position.z - p.z); if (d < bd) { bd = d; best = k; } }); return best; };
	const onUp = (e: PointerEvent) => {
		const d = down; down = null;
		if (dragging !== null) {
			const id = dragging; dragging = null; const p = tiles[id].position;
			const slot = nearestSlot(p), dz = zones.discard.position;
			if (Math.abs(p.x - dz.x) < 1.6 && Math.abs(p.z - dz.z) < 1.8) opts.onDrop(id, { zone: 'discard' });
			else if (slot >= 0) opts.onDrop(id, { slot });
			if (view) update(view); return;
		}
		if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
		if (d.id !== null) { opts.onTile(d.id); return; }
		setRay(e);
		const z = ray.intersectObjects([...Object.values(zones), ...tiles.filter((m) => view?.pile.includes(m.userData.id) || view?.discards[3].includes(m.userData.id) || view?.discards[0].includes(m.userData.id))], false)[0];
		const sl = ray.intersectObjects(slotHits, false)[0];
		if (sl && (!z || sl.distance < z.distance)) { opts.onSlot(sl.object.userData.slot as number); return; }
		if (z) { const o = z.object; if (o.userData.zone) opts.onZone(o.userData.zone as Zone); else { const id = o.userData.id as number; opts.onZone(view?.pile.includes(id) ? 'pile' : view?.discards[3].includes(id) ? 'take' : 'discard'); } }
	};
	canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp);
	const toScreen = (p: THREE.Vector3) => { const q = p.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + ((q.x + 1) / 2) * r.width, y: r.top + ((1 - q.y) / 2) * r.height }; };
	resize();
	return {
		update, invalidate,
		setInsets(i: typeof insets) { insets = i; fit(); invalidate(); },
		/** Screen position (CSS px) of a tile, slot or zone — used by the headless tests. */
		screenOf(t: { tile: number } | { slot: number } | { zone: Zone }) {
			if ('tile' in t) return toScreen(tiles[t.tile].position);
			if ('slot' in t) return toScreen(slotPos(t.slot));
			return toScreen(zones[t.zone].position);
		},
		lastView: () => view,
		busy: () => tweens.length > 0 || dragging !== null,
		/** Layout audit for the headless tests: tile boxes from different groups (rack, each opponent, pile, gösterge, each discard
		 * corner) that intersect, and whether the gösterge's face centre is the first thing a camera ray hits (i.e. not covered). */
		audit() {
			if (!view) return null;
			const v: View = view, grp = new Map<number, string>();
			v.rack.forEach((id) => id !== null && grp.set(id, 'rack')); v.opp.forEach((h, j) => h.forEach((id) => grp.set(id, `opp${j + 1}`)));
			v.pile.forEach((id) => grp.set(id, 'pile')); grp.set(v.gosterge, 'gosterge'); v.discards.forEach((d, s) => d.forEach((id) => grp.set(id, `disc${s}`)));
			const tg = targets(v), boxes: [number, string, THREE.Box3][] = [];
			for (const [id, t] of tg) { const m = new THREE.Mesh(tileGeo); m.position.copy(t.p); m.quaternion.setFromEuler(t.e); m.updateMatrixWorld(); const b = new THREE.Box3().setFromObject(m).expandByScalar(-0.03); boxes.push([id, grp.get(id) ?? '?', b]); }
			const overlaps: string[] = [];
			for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (boxes[i][1] !== boxes[j][1] && boxes[i][2].intersectsBox(boxes[j][2])) overlaps.push(`${boxes[i][1]}#${boxes[i][0]}×${boxes[j][1]}#${boxes[j][0]}`);
			const g = tiles[v.gosterge], face = new THREE.Vector3(0, 0, TD / 2 + 0.001).applyQuaternion(g.quaternion).add(g.position);
			const dir = face.clone().sub(camera.position).normalize(); ray.set(camera.position, dir);
			const hit = ray.intersectObjects(tiles.filter((m) => m.visible), false)[0];
			const sp = toScreen(face), r = canvas.getBoundingClientRect();
			return { overlaps, gostergeVisible: hit?.object === g, gostergeInFreeArea: sp.x >= r.left + insets.left && sp.x <= r.right - insets.right && sp.y >= r.top + insets.top && sp.y <= r.bottom - insets.bottom, gostergeScreen: sp };
		},
		/** Projected human-rack rectangle (CSS px) — for the layout tests. */
		rackRect() { const ps = [[-RX / 2, 1.5, 5.6], [RX / 2, 1.5, 5.6], [-RX / 2, 0, 7.6], [RX / 2, 0, 7.6]].map(([x, y, z]) => toScreen(new THREE.Vector3(x, y, z))); return { x0: Math.min(...ps.map((p) => p.x)), x1: Math.max(...ps.map((p) => p.x)), y0: Math.min(...ps.map((p) => p.y)), y1: Math.max(...ps.map((p) => p.y)), pr: curPr }; },
		destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); composer.dispose(); pmrem.dispose(); renderer.dispose(); faces.forEach((f) => f.dispose()); scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
	};
}
export type OkeyScene = ReturnType<typeof createOkeyScene>;
