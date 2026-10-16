// DiceRoll-6P scene: an ivory d6 on the same lamp-lit wooden table as the coin.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { woodTextures, VignetteShader } from './scene';

// BoxGeometry material order: +x, -x, +y, -y, +z, -z  → face values (opposites sum to 7)
export const FACE_OF_MAT = [2, 5, 1, 6, 3, 4];
export const NORMALS = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
const PIPS: Record<number, [number, number][]> = {
	1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
	4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
	6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]]
};

export function faceTex(n: number, kind: 'color' | 'bump'): THREE.CanvasTexture {
	const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
	const g = c.getContext('2d')!;
	if (kind === 'color') {
		const grd = g.createRadialGradient(s * 0.42, s * 0.38, 20, s / 2, s / 2, s * 0.75);
		grd.addColorStop(0, '#fbf3df'); grd.addColorStop(0.7, '#efe2c2'); grd.addColorStop(1, '#d9c79f');
		g.fillStyle = grd; g.fillRect(0, 0, s, s);
		for (let i = 0; i < 30; i++) { const x = Math.random() * s, y = Math.random() * s, r = 10 + Math.random() * 60;
			const pg = g.createRadialGradient(x, y, 0, x, y, r); pg.addColorStop(0, 'rgba(120,90,40,0.06)'); pg.addColorStop(1, 'rgba(120,90,40,0)');
			g.fillStyle = pg; g.fillRect(x - r, y - r, r * 2, r * 2); }
	} else { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); }
	const r = n === 1 ? 0.12 : 0.085;
	for (const [x, y] of PIPS[n]) {
		if (kind === 'color') {
			const pg = g.createRadialGradient(x * s - 6, y * s - 6, 2, x * s, y * s, r * s);
			const red = n === 1;
			pg.addColorStop(0, red ? '#8a0f12' : '#0b0806'); pg.addColorStop(0.85, red ? '#b3181c' : '#241a12'); pg.addColorStop(1, red ? '#5a0a0c' : '#000');
			g.fillStyle = pg;
		} else g.fillStyle = '#000';
		g.beginPath(); g.arc(x * s, y * s, r * s, 0, Math.PI * 2); g.fill();
	}
	const t = new THREE.CanvasTexture(c);
	if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

export interface RollOpts { face: number; rare?: boolean; reducedMotion: boolean; power?: number; onLand?: () => void; onLegendary?: () => void; onDone?: () => void }

export function createDiceScene(canvas: HTMLCanvasElement) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
	renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#050403'); scene.fog = new THREE.Fog('#050403', 6, 16);
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18;
	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
	const camHome = new THREE.Vector3(0, 3.6, 6.6); camera.position.copy(camHome);

	const key = new THREE.SpotLight('#ffc98a', 160, 25, Math.PI / 7, 0.75, 1.5);
	key.position.set(1.2, 7, 1.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0002;
	scene.add(key, key.target, new THREE.HemisphereLight('#3a2a1c', '#0a0604', 0.25));
	const bounce = new THREE.PointLight('#ff9a50', 1.5, 6); bounce.position.set(-2, 0.6, 1); scene.add(bounce);

	const wood = woodTextures(); wood.color.repeat.set(3, 3); wood.bump.repeat.set(3, 3);
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: wood.color, roughnessMap: wood.bump, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.85, metalness: 0 }));
	floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

	// die
	const S = 0.95, HALF = S / 2;
	const mats = FACE_OF_MAT.map((n) => new THREE.MeshPhysicalMaterial({ map: faceTex(n, 'color'), bumpMap: faceTex(n, 'bump'), bumpScale: 2.5, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.2 }));
	const die = new THREE.Mesh(new RoundedBoxGeometry(S, S, S, 5, 0.11), mats);
	die.castShadow = true; scene.add(die);
	const up = new THREE.Vector3(0, 1, 0);
	const alignFace = (face: number) => new THREE.Quaternion().setFromUnitVectors(NORMALS[FACE_OF_MAT.indexOf(face)], up);
	const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(up, a);
	const rest = new THREE.Quaternion().copy(yaw(0.5)).multiply(alignFace(6)); // idle: 6 on top
	die.quaternion.copy(rest);
	const m4 = new THREE.Matrix4();
	/** height of the lowest corner below the center for the current orientation (cube support function) */
	const lowest = (q: THREE.Quaternion) => { m4.makeRotationFromQuaternion(q); const e = m4.elements; return HALF * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])); };
	die.position.set(0, lowest(rest), 0);
	let restPos = die.position.clone();

	const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.2, 96), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
	ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);

	const N = 380, pGeo = new THREE.BufferGeometry();
	const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3);
	pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	const pMat = new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
	const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
	let pLife = 0;
	const palette = [new THREE.Color('#d9b48a'), new THREE.Color('#ffb36b'), new THREE.Color('#a08060'), new THREE.Color('#ffd8a8')];
	function burst(strength: number, at: THREE.Vector3) {
		for (let i = 0; i < N; i++) {
			const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 1.2) * strength;
			pos.set([at.x + Math.cos(a) * HALF, 0.05, at.z + Math.sin(a) * HALF], i * 3);
			vel.set([Math.cos(a) * sp, 0.4 + Math.random() * 1.6 * strength, Math.sin(a) * sp], i * 3);
			const c = palette[i % palette.length]; col.set([c.r * 0.8, c.g * 0.8, c.b * 0.8], i * 3);
		}
		pGeo.attributes.color.needsUpdate = true; pLife = 1;
	}

	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.4, 0.95));
	const vignette = new ShaderPass(VignetteShader); composer.addPass(vignette);
	composer.addPass(new OutputPass());
	function resize() {
		const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); composer.setPixelRatio(dpr); composer.setSize(w, h);
		camera.aspect = w / h; camera.fov = w < h ? 55 : 38; camera.updateProjectionMatrix();
	}
	const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

	interface Roll { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; peak: number; q0: THREE.Quaternion; qT: THREE.Quaternion; axis: THREE.Vector3; turns: number; opts: RollOpts; landed: boolean; legendary: boolean }
	let roll: Roll | null = null, shake = 0, charge = 0, chargeLift = 0, thinking = 0, restRare = false;
	const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
	const tmpQ = new THREE.Quaternion();

	function rollDie(opts: RollOpts) {
		const pw = Math.min(1, Math.max(0, opts.power ?? 0.6));
		const qT = new THREE.Quaternion().copy(yaw(Math.random() * Math.PI * 2));
		if (opts.rare) qT.multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 1, 1).normalize(), up));
		else qT.multiply(alignFace(opts.face));
		const a = Math.random() * Math.PI * 2, d = opts.reducedMotion ? 0 : 0.2 + Math.random() * 0.5;
		const to = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d * 0.6);
		const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize();
		charge = 0; key.intensity = 160;
		roll = { t0: performance.now(), dur: opts.reducedMotion ? 400 : (opts.rare ? 3600 : 1500) + pw * 1600, from: die.position.clone(), to, peak: 1 + pw * 3.4,
			q0: die.quaternion.clone(), qT, axis, turns: opts.reducedMotion ? 0 : 2 + Math.round(pw * 5), opts, landed: false, legendary: false };
	}

	function animate(now: number) {
		const r = roll!; const u = Math.min(1, (now - r.t0) / r.dur);
		if (r.opts.reducedMotion) { die.quaternion.copy(r.qT); die.position.set(r.to.x, lowest(r.qT), r.to.z); }
		else {
			const air = r.opts.rare ? 0.32 : 0.55;
			// orientation: target ⊗ spin(axis, remaining angle) — continuous, ends exactly on the target face
			const spinLeft = r.turns * Math.PI * 2 * (1 - easeOut(Math.min(1, u / 0.92)));
			const q = tmpQ.copy(r.qT).multiply(new THREE.Quaternion().setFromAxisAngle(r.axis, spinLeft));
			if (u < air * 0.25) { const qs = q.clone(); q.slerpQuaternions(r.q0, qs, u / (air * 0.25)); } // blend out of the resting pose
			if (r.opts.rare && u > 0.55) { // wobble on the corner, settle
				const w = (1 - (u - 0.55) / 0.45) ** 2; q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, -1).normalize(), Math.sin(u * 60) * 0.12 * w));
			}
			die.quaternion.copy(q);
			const base = lowest(q);
			let y = base, x: number, z: number;
			if (u < air) { const s = u / air; y = base + chargeLift * (1 - s) + 4 * r.peak * s * (1 - s); x = r.from.x + (r.to.x - r.from.x) * s; z = r.from.z + (r.to.z - r.from.z) * s; }
			else {
				const b = (u - air) / (1 - air);
				if (!r.landed) { r.landed = true; burst(r.opts.rare ? 0.6 : 1, r.to); shake = 0.8; r.opts.onLand?.(); }
				for (const [a0, e0, h] of [[0, 0.2, 0.5], [0.2, 0.34, 0.14], [0.34, 0.42, 0.04]]) if (b >= a0 && b < e0) { const s = (b - a0) / (e0 - a0); y = base + 4 * h * s * (1 - s); }
				x = r.to.x; z = r.to.z;
				if (r.opts.rare && b > 0.8 && !r.legendary) { r.legendary = true; burst(2.4, r.to); shake = 0.3; r.opts.onLegendary?.(); }
			}
			die.position.set(x, y, z);
			camera.position.set(camHome.x + Math.sin(u * Math.PI) * 0.6, camHome.y + (y - base) * 0.3, camHome.z - Math.sin(u * Math.PI) * 0.5);
			if (r.opts.rare && u > air) { const k = easeOut((u - air) / (1 - air)); camera.position.lerp(new THREE.Vector3(1.3, 2.2, 4.4), k); }
		}
		if (u >= 1) {
			die.quaternion.copy(r.qT); die.position.set(r.to.x, lowest(r.qT), r.to.z); restPos = die.position.clone(); restRare = !!r.opts.rare; chargeLift = 0;
			if (r.opts.reducedMotion) { if (r.opts.rare) { burst(2, r.to); r.opts.onLegendary?.(); } r.opts.onLand?.(); }
			roll = null; r.opts.onDone?.();
		}
	}

	let raf = 0, last = performance.now();
	const look = new THREE.Vector3(0, 0.35, 0);
	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		if (roll) animate(now);
		else {
			const c = Math.min(charge, 1.4);
			chargeLift += (c * 0.3 - chargeLift) * 0.2;
			const tr = c * c * 0.03 + (charge > 1 ? 0.05 : 0);
			die.position.set(restPos.x + (Math.random() - 0.5) * tr, restPos.y + chargeLift + (Math.random() - 0.5) * tr, restPos.z + (Math.random() - 0.5) * tr);
			if (c > 0) die.rotateOnWorldAxis(up, dt * c * 3);
			key.intensity = 160 * (1 + c * 0.35);
			const target = restRare ? new THREE.Vector3(1.3 + Math.sin(now * 0.0003) * 0.3, 2.2, 4.4) : new THREE.Vector3(camHome.x + Math.sin(now * 0.0002) * 0.6, camHome.y, camHome.z);
			camera.position.lerp(target, 0.03);
		}
		const rm = ring.material as THREE.MeshBasicMaterial;
		rm.opacity += ((thinking ? 0.18 + Math.sin(now * 0.02) * 0.08 : Math.min(charge, 1.2) * 0.35) - rm.opacity) * 0.15;
		ring.position.x = die.position.x; ring.position.z = die.position.z;
		if (pLife > 0) {
			pLife -= dt * 0.55;
			for (let i = 0; i < N; i++) {
				vel[i * 3 + 1] -= 6 * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
				if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.4; vel[i * 3] *= 0.8; vel[i * 3 + 2] *= 0.8; }
			}
			pGeo.attributes.position.needsUpdate = true; pMat.opacity = Math.max(0, pLife);
		}
		if (shake > 0) { camera.position.x += (Math.random() - 0.5) * 0.04 * shake; camera.position.y += (Math.random() - 0.5) * 0.04 * shake; shake = Math.max(0, shake - dt * 3); }
		look.set(die.position.x * 0.5, restRare || (roll?.opts.rare && roll.landed) ? 0.5 : 0.35 + Math.max(0, die.position.y - HALF) * 0.6, die.position.z * 0.5);
		camera.lookAt(look);
		vignette.uniforms.time.value = now * 0.001;
		composer.render();
	}
	raf = requestAnimationFrame(frame);
	return {
		rollDie, setCharge: (c: number) => { charge = c; }, setThinking: (v: number) => { thinking = v; },
		destroy() { cancelAnimationFrame(raf); ro.disconnect(); composer.dispose(); pmrem.dispose(); renderer.dispose(); scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
	};
}
export type DiceScene = ReturnType<typeof createDiceScene>;
