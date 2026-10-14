import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type Side = 'yazi' | 'tura' | 'dik';

function faceTexture(label: string, sub: string, kind: 'color' | 'bump', legend: string): THREE.CanvasTexture {
	const s = 1024, c = document.createElement('canvas');
	c.width = c.height = s;
	const g = c.getContext('2d')!;
	const cx = s / 2;
	const bump = kind === 'bump';
	if (bump) { g.fillStyle = '#777'; g.fillRect(0, 0, s, s); }
	else {
		const grd = g.createRadialGradient(cx * 0.8, cx * 0.7, 40, cx, cx, cx);
		grd.addColorStop(0, '#ffe9a8'); grd.addColorStop(0.6, '#e0ad4a'); grd.addColorStop(1, '#9a6a1c');
		g.fillStyle = grd; g.fillRect(0, 0, s, s);
	}
	const ink = bump ? '#fff' : 'rgba(120,75,10,0.55)';
	g.strokeStyle = ink; g.fillStyle = ink;
	g.lineWidth = 28; g.beginPath(); g.arc(cx, cx, cx - 40, 0, Math.PI * 2); g.stroke();
	g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, cx - 90, 0, Math.PI * 2); g.stroke();
	for (let i = 0; i < 120; i++) { // dotted beading
		const a = (i / 120) * Math.PI * 2;
		g.beginPath(); g.arc(cx + Math.cos(a) * (cx - 66), cx + Math.sin(a) * (cx - 66), 7, 0, Math.PI * 2); g.fill();
	}
	g.textAlign = 'center'; g.textBaseline = 'middle';
	g.font = '900 220px Georgia, serif'; const lw = g.measureText(label).width; g.font = `900 ${Math.floor(220 * Math.min(1, 560 / lw))}px Georgia, serif`; g.fillText(label, cx, cx - 30);
	g.font = '700 58px Georgia, serif'; g.fillText(sub, cx, cx + 130);
	// circular legend
	g.font = '700 44px Georgia, serif';
	for (let i = 0; i < legend.length; i++) {
		const a = -Math.PI / 2 + (i / legend.length) * Math.PI * 2;
		g.save(); g.translate(cx + Math.cos(a) * (cx - 150), cx + Math.sin(a) * (cx - 150));
		g.rotate(a + Math.PI / 2); g.fillText(legend[i], 0, 0); g.restore();
	}
	if (!bump) { // patina + wear
		for (let i = 0; i < 60; i++) { const x = Math.random() * s, y = Math.random() * s, r = 20 + Math.random() * 120;
			const pg = g.createRadialGradient(x, y, 0, x, y, r); pg.addColorStop(0, 'rgba(60,40,15,0.18)'); pg.addColorStop(1, 'rgba(60,40,15,0)');
			g.fillStyle = pg; g.fillRect(x - r, y - r, r * 2, r * 2); }
		const edge = g.createRadialGradient(cx, cx, cx * 0.7, cx, cx, cx); edge.addColorStop(0, 'rgba(40,25,5,0)'); edge.addColorStop(1, 'rgba(40,25,5,0.35)');
		g.fillStyle = edge; g.fillRect(0, 0, s, s);
		g.globalAlpha = 0.12; g.strokeStyle = '#fff'; g.lineWidth = 1;
		for (let i = 0; i < 400; i++) { g.beginPath(); const x = Math.random() * s, y = Math.random() * s; g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80); g.stroke(); }
	}
	const t = new THREE.CanvasTexture(c);
	if (!bump) t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

function edgeLabel(text: string): THREE.CanvasTexture {
	const c = document.createElement('canvas'); c.width = 2048; c.height = 64;
	const g = c.getContext('2d')!;
	const grd = g.createLinearGradient(0, 0, 0, 64); grd.addColorStop(0, '#7a5a2c'); grd.addColorStop(0.5, '#c9a46a'); grd.addColorStop(1, '#7a5a2c');
	g.fillStyle = grd; g.fillRect(0, 0, 2048, 64);
	g.fillStyle = 'rgba(50,30,8,0.75)'; g.font = '700 34px Georgia, serif'; g.textBaseline = 'middle';
	const w = g.measureText(text).width; for (let x = 0; x < 2048; x += w) g.fillText(text, x, 34);
	const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

function edgeTexture(): THREE.CanvasTexture {
	const c = document.createElement('canvas'); c.width = 1024; c.height = 32;
	const g = c.getContext('2d')!;
	for (let x = 0; x < 1024; x += 8) { g.fillStyle = '#fff'; g.fillRect(x, 0, 4, 32); g.fillStyle = '#333'; g.fillRect(x + 4, 0, 4, 32); }
	const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}

function woodTextures() {
	const s = 1024;
	const mk = () => { const c = document.createElement('canvas'); c.width = c.height = s; return [c, c.getContext('2d')!] as const; };
	const [cc, g] = mk(), [bc, bg] = mk();
	const planks = 6, pw = s / planks;
	let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const ci = g.createImageData(s, s), bi = bg.createImageData(s, s);
	for (let p = 0; p < planks; p++) {
		const hue = 22 + rnd() * 8, light = 18 + rnd() * 10, off = rnd() * 1000;
		const base = new THREE.Color().setHSL(hue / 360, 0.5, light / 100);
		for (let x = 0; x < pw; x++) for (let y = 0; y < s; y++) {
			const gx = Math.floor(p * pw + x), i = (y * s + gx) * 4;
			const ring = Math.sin(x * 0.09 + Math.sin(y * 0.004 + off) * 6 + Math.sin(y * 0.021 + off) * 1.2 + off);
			const fine = Math.sin(x * 0.9 + y * 0.002 + off * 3) * 0.5;
			let v = ring * 0.5 + fine * 0.25 + (Math.random() - 0.5) * 0.25;
			if (x < 3) v = -2.5;
			const k = 1 + v * 0.28;
			ci.data[i] = Math.min(255, base.r * 255 * k); ci.data[i + 1] = Math.min(255, base.g * 255 * k); ci.data[i + 2] = Math.min(255, base.b * 255 * k); ci.data[i + 3] = 255;
			const bv = Math.max(0, Math.min(255, 128 + v * 50)); bi.data[i] = bi.data[i + 1] = bi.data[i + 2] = bv; bi.data[i + 3] = 255;
		}
	}
	g.putImageData(ci, 0, 0); bg.putImageData(bi, 0, 0);
	const color = new THREE.CanvasTexture(cc), bump = new THREE.CanvasTexture(bc);
	color.colorSpace = THREE.SRGBColorSpace;
	for (const t of [color, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
	return { color, bump };
}

const VignetteShader = {
	uniforms: { tDiffuse: { value: null }, strength: { value: 1.25 }, grain: { value: 0.025 }, time: { value: 0 } },
	vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
	fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; uniform float grain; uniform float time; varying vec2 vUv;
	float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))+time)*43758.5453); }
	void main(){ vec4 c=texture2D(tDiffuse,vUv); float d=distance(vUv,vec2(0.5)); c.rgb*=smoothstep(0.85,0.2,d*strength);
	c.rgb+= (h(vUv*1000.0)-0.5)*grain; gl_FragColor=c; }`
};

export interface FlipOpts { result: Side; reducedMotion: boolean; power?: number; onLand?: () => void; onLegendary?: () => void; onDone?: () => void }

export function createScene(canvas: HTMLCanvasElement) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.95;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#050403');
	scene.fog = new THREE.Fog('#050403', 6, 16);
	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.12;

	const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
	const camHome = new THREE.Vector3(0, 3.2, 6.2);
	camera.position.copy(camHome);

	// lights
	const key = new THREE.SpotLight('#ffc98a', 160, 25, Math.PI / 7, 0.75, 1.5);
	key.position.set(1.2, 7, 1.5); key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0002;
	scene.add(key, key.target);
	scene.add(new THREE.HemisphereLight('#3a2a1c', '#0a0604', 0.25));
	const bounce = new THREE.PointLight('#ff9a50', 1.5, 6); bounce.position.set(-2, 0.6, 1); scene.add(bounce);

	// wooden table
	const wood = woodTextures();
	wood.color.repeat.set(3, 3); wood.bump.repeat.set(3, 3);
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40),
		new THREE.MeshStandardMaterial({ map: wood.color, roughnessMap: wood.bump, bumpMap: wood.bump, bumpScale: 1.5, roughness: 0.85, metalness: 0 }));
	floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

	// coin
	const R = 1, H = 2 * R * (1.95 / 21.21); // US nickel proportions, t/d = 0.0919
	const gold = { color: '#c9a46a', metalness: 0.85, roughness: 0.55, envMapIntensity: 0.5 };
	const edgeBump = edgeTexture(); edgeBump.repeat.set(1, 1);
	const sideMat = new THREE.MeshStandardMaterial({ ...gold, color: '#ffffff', bumpMap: edgeBump, bumpScale: 0.6 });
	const topMat = new THREE.MeshStandardMaterial({ ...gold, bumpScale: 3 });
	const botMat = new THREE.MeshStandardMaterial({ ...gold, bumpScale: 3 });
	function setFaces(heads: string, tails: string, legend: string, edgeText = legend) {
		sideMat.map?.dispose(); sideMat.map = edgeLabel(edgeText); sideMat.needsUpdate = true;
		for (const [m, l, sub] of [[topMat, heads, '1P · 2026'], [botMat, tails, 'w = 0.4271']] as const) {
			m.map?.dispose(); m.bumpMap?.dispose();
			m.map = faceTexture(l.toLocaleUpperCase(), sub, 'color', legend);
			m.bumpMap = faceTexture(l.toLocaleUpperCase(), sub, 'bump', legend);
			m.needsUpdate = true;
		}
	}
	setFaces('Yazı', 'Tura', '• 1 PARAMETRE • 0 HALÜSİNASYON ');
	const coinGeo = new THREE.CylinderGeometry(R, R, H, 128, 1);
	const coin = new THREE.Mesh(coinGeo, [sideMat, topMat, botMat]);
	coin.castShadow = true;
	const pivot = new THREE.Group(); pivot.rotation.order = 'YXZ'; pivot.add(coin); scene.add(pivot);
	const thick = H;
	const restYFor = (side: Side) => (side === 'dik' ? R : thick / 2);
	let restSide: Side = 'yazi';
	let restY = restYFor(restSide);
	pivot.position.y = restY;

	// glow ring under coin
	const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.35, 96),
		new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
	ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);

	// particles
	const N = 420;
	const pGeo = new THREE.BufferGeometry();
	const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3);
	pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	const pMat = new THREE.PointsMaterial({ size: 0.025, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
	const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);
	let pLife = 0;
	const palette = [new THREE.Color('#d9b48a'), new THREE.Color('#ffb36b'), new THREE.Color('#a08060'), new THREE.Color('#ffd8a8')];
	function burst(strength: number) {
		for (let i = 0; i < N; i++) {
			const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 1.2) * strength;
			pos.set([Math.cos(a) * R, 0.05, Math.sin(a) * R], i * 3);
			vel.set([Math.cos(a) * sp, 0.4 + Math.random() * 1.6 * strength, Math.sin(a) * sp], i * 3);
			const c = palette[i % palette.length]; col.set([c.r * 0.8, c.g * 0.8, c.b * 0.8], i * 3);
		}
		pGeo.attributes.color.needsUpdate = true; pLife = 1;
	}

	// postprocessing
	const composer = new EffectComposer(renderer);
	composer.addPass(new RenderPass(scene, camera));
	const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.4, 0.95);
	composer.addPass(bloom);
	const vignette = new ShaderPass(VignetteShader); composer.addPass(vignette);
	composer.addPass(new OutputPass());

	function resize() {
		const w = canvas.clientWidth, h = canvas.clientHeight;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
		composer.setPixelRatio(dpr); composer.setSize(w, h);
		camera.aspect = w / h;
		camera.fov = w < h ? 55 : 38; // portrait: wider
		camera.updateProjectionMatrix();
	}
	const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

	// flip state
	interface Flip { peak: number; t0: number; dur: number; turns: number; final: number; opts: FlipOpts; landed: boolean; axisZ: number; landY: number; edge: boolean; legendary: boolean }
	let flip: Flip | null = null;
	let restAngle = 0; // current x rotation at rest (0 = yazi up, PI = tura up)
	let shake = 0;

	function flipCoin(opts: FlipOpts) {
		const edge = opts.result === 'dik';
		const final = opts.result === 'yazi' ? 0 : opts.result === 'tura' ? Math.PI : Math.PI / 2;
		const pw = Math.min(1, Math.max(0, opts.power ?? 0.6));
		// stronger toss => higher arc, longer flight, more full turns; half-rotations = 2·turns (+1 for tails)
		const turns = opts.reducedMotion ? 0 : 1 + Math.round(pw * 8);
		const peak = 0.9 + pw * 3.6;
		charge = 0; key.intensity = 160;
		flip = { peak, t0: performance.now(), dur: opts.reducedMotion ? 400 : (edge ? 3400 : 1300) + pw * 1800, turns, final, opts, landed: false, axisZ: (Math.random() - 0.5) * 0.6,
			landY: restYFor(opts.result), edge, legendary: false };
	}

	// toss timeline (seconds normalized): airborne 0..0.62, bounces 0.62..0.85, settle wobble 0.85..1
	const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
	function animateFlip(now: number) {
		if (!flip) return;
		const f = flip;
		const u = Math.min(1, (now - f.t0) / f.dur);
		if (f.opts.reducedMotion) {
			pivot.rotation.set(f.final, 0, 0); pivot.position.y = f.landY;
			coin.scale.x = coin.scale.z = 1 - Math.sin(u * Math.PI) * 0.08;
		} else {
			const air = f.edge ? 0.34 : 0.62;
			const restY = f.landY;
			let y = restY, ang: number, wob = 0, spinY = 0;
			const startAng = restAngle;
			const target = f.final + Math.PI * 2 * f.turns + (startAng % (Math.PI * 2) > 1 ? 0 : 0);
			if (u < air) {
				const s = u / air; // parabola peak 3.4
				y = restY + chargeLift * (1 - s) + 4 * f.peak * s * (1 - s);
				ang = startAng + (target - startAng) * easeOut(s) * 0.97;
			} else {
				const b = (u - air) / (1 - air);
				if (!f.landed) { f.landed = true; burst(f.edge ? 0.6 : 1); shake = f.edge ? 0.5 : 1; f.opts.onLand?.(); }
				// two decaying bounces
				const bounces = [[0, 0.22, 0.45], [0.22, 0.38, 0.12]];
				for (const [a, e, h] of bounces) if (b >= a && b < e) { const s = (b - a) / (e - a); y = restY + 4 * h * s * (1 - s); }
				const rem = target * 0.03 * Math.max(0, 1 - b / 0.38);
				ang = target - rem;
				// precession wobble (Euler's disk) decaying
				const w = Math.max(0, 1 - b) ** 2;
				wob = Math.sin(b * 38) * 0.22 * w;
				if (f.edge) {
					// rolls on its rim in a shrinking circle, wobbles, then stands upright
					const e = easeOut(Math.min(1, b / 0.8));
					spinY = e * Math.PI * 3;
					wob = Math.sin(b * 22) * 0.35 * (1 - e);
					y = restY - (1 - e) * (R - thick / 2) * 0.35 + (y - restY);
					pivot.position.x = Math.sin(spinY) * 0.5 * (1 - e);
					pivot.position.z = (Math.cos(spinY) - 1) * 0.5 * (1 - e);
					if (b > 0.82 && !f.legendary) { f.legendary = true; burst(2.4); shake = 0.3; f.opts.onLegendary?.(); }
				}
			}
			pivot.position.y = y;
			pivot.rotation.order = 'YXZ';
			pivot.rotation.set(ang, spinY + now * 0.0004 * (u < air ? 6 : 0), f.axisZ * (1 - u) + wob);
			if (f.edge && u >= air) {
				// slow-mo dolly-in on the standing coin
				const k = easeOut(Math.min(1, (u - air) / (1 - air)));
				camera.position.set(camHome.x * (1 - k) + 1.4 * k, camHome.y * (1 - k) + 1.9 * k, camHome.z * (1 - k) + 4.8 * k);
			} else camera.position.set(camHome.x + Math.sin(u * Math.PI) * 0.8, camHome.y + y * 0.35, camHome.z - Math.sin(u * Math.PI) * 0.6);
		}
		if (u >= 1) {
			restAngle = f.final; restSide = f.opts.result; restY = f.landY; chargeLift = 0;
			pivot.rotation.set(f.final, pivot.rotation.y, 0); pivot.position.set(0, restY, 0); coin.scale.x = coin.scale.z = 1;
			if (f.edge && f.opts.reducedMotion) { burst(2); f.opts.onLegendary?.(); }
			if (f.opts.reducedMotion) f.opts.onLand?.();
			flip = null; f.opts.onDone?.();
		}
	}

	let raf = 0, last = performance.now(), thinking = 0, charge = 0, chargeLift = 0;
	function setCharge(c: number) { charge = c; }
	function setThinking(v: number) { thinking = v; }
	const look = new THREE.Vector3(0, -0.4, 0);
	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		if (flip) animateFlip(now);
		else {
			// idle: gentle hover breathing
			// wind-up: coin lifts, trembles harder as charge builds; >1 = overcharge wobble
			const c = Math.min(charge, 1.4);
			chargeLift += ((restSide === 'dik' ? 0 : c * 0.25) - chargeLift) * 0.2;
			const tr = c * c * 0.03 + (charge > 1 ? 0.05 : 0);
			pivot.position.set((Math.random() - 0.5) * tr, restY + chargeLift + (Math.random() - 0.5) * tr, (Math.random() - 0.5) * tr);
			pivot.rotation.z = (Math.random() - 0.5) * tr * 2 + (charge > 1 ? Math.sin(now * 0.03) * 0.12 : 0);
			pivot.rotation.y += dt * (0.15 + c * 4);
			key.intensity = 160 * (1 + c * 0.35);
			camera.position.lerp(restSide === 'dik' ? new THREE.Vector3(1.4 + Math.sin(now * 0.0003) * 0.4, 1.9, 4.8) : new THREE.Vector3(camHome.x + Math.sin(now * 0.0002) * 0.6, camHome.y, camHome.z), 0.03);
		}
		// glow ring reacts to "inference"
		const rm = ring.material as THREE.MeshBasicMaterial;
		rm.opacity += ((thinking ? 0.18 + Math.sin(now * 0.02) * 0.08 : Math.min(charge, 1.2) * 0.35) - rm.opacity) * 0.15;
		ring.scale.setScalar(1 + (thinking ? Math.sin(now * 0.01) * 0.05 : 0));
		// particles
		if (pLife > 0) {
			pLife -= dt * 0.55;
			for (let i = 0; i < N; i++) {
				vel[i * 3 + 1] -= 6 * dt;
				pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
				if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.4; vel[i * 3] *= 0.8; vel[i * 3 + 2] *= 0.8; }
			}
			pGeo.attributes.position.needsUpdate = true;
			pMat.opacity = Math.max(0, pLife);
		}
		if (shake > 0) { camera.position.x += (Math.random() - 0.5) * 0.04 * shake; camera.position.y += (Math.random() - 0.5) * 0.04 * shake; shake = Math.max(0, shake - dt * 3); }
		const edgeView = (flip?.edge && flip.landed) || (!flip && restSide === 'dik');
		const ly = edgeView ? 0.45 : -0.4 + (pivot.position.y - thick / 2) * 0.8;
		look.y += (ly - look.y) * (edgeView ? 0.05 : 1);
		camera.lookAt(look);
		vignette.uniforms.time.value = now * 0.001;
		composer.render();
	}
	raf = requestAnimationFrame(frame);

	return {
		flipCoin, setThinking, setFaces, setCharge,
		destroy() {
			cancelAnimationFrame(raf); ro.disconnect();
			composer.dispose(); pmrem.dispose(); renderer.dispose();
			scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
		}
	};
}
export type CoinScene = ReturnType<typeof createScene>;
