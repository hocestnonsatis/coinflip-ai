# 🪙🎲 Tiny Models

> **Absürt derecede küçük yapay zekâ modelleri.** Trilyon parametre kimin umurunda? Burada modeller avuç içine sığar.

🔗 **Canlı:** https://tiny-models.anil-oz.workers.dev · (eski adres `coinflip-ai.anil-oz.workers.dev` buraya yönlenir)

![Tiny Models](docs/hub.png)

| Model | Parametre | Doğruluk | Adres |
|---|---|---|---|
| 🪙 **CoinFlip‑1P** | 1 | %50,0 (SOTA) | [/coin](https://tiny-models.anil-oz.workers.dev/coin) |
| 🎲 **DiceRoll‑6P** | 6 | %16,7 (SOTA) | [/dice](https://tiny-models.anil-oz.workers.dev/dice) |
| ✊ RockPaperScissors‑3P | 3 | yakında | — |
| 🎱 Magic8Ball‑20P | 20 | yakında | — |

Her dil kendi adresinde: `/`, `/tr`, `/de`, `/es`, `/fr` (ve `/tr/coin`, `/tr/dice` …). İngilizce adreslere tarayıcı dili (Accept-Language) veya seçilen dil çereziyle gelen ziyaretçiler kendi dillerine yönlendirilir.

## Nasıl çalışır?

1. (İsteğe bağlı) bir soru yazın: *“Bugün şemsiye almalı mıyım?”* ya da *“Kaç saat uyumalıyım?”*
2. Butonu **basılı tutun** (veya Space / Enter), güç toplansın, sonra **bırakın**.
3. Basılı tutma süreniz kriptografik rastgele bir titreşimle (crypto.getRandomValues) hash'lenip modelin girdisi olur.
4. Model **gerçek bir ONNX dosyası** olarak tarayıcıda **ONNX Runtime Web** ile (WebGPU, olmazsa WASM) çalışır; yüklenemezse sessizce TypeScript matematiğine döner.

### CoinFlip‑1P
`z ~ 𝒩(0,1)` → `σ(w · z · 1,5)` · tek parametre `w` · `static/model/coinflip-1p.onnx` (`scripts/build-onnx.py`). **Yazı = Evet, Tura = Hayır.**

### DiceRoll‑6P
6 Gumbel gürültüsü `g` → `softmax((g + b) · 1,0)` · altı parametre `b` (hepsi 1/6, elle ayarlandı) · `static/model/diceroll-6p.onnx` (`scripts/build-onnx-dice.py`). Sonuç 1–6, güven = softmax maksimumu. Eşit bias'lar sayesinde her yüz tam olarak 1/6 olasılıklı (bkz. `npm test`).

Her iki modelde: 3D sahne (three.js, ahşap masa, lamba ışığı), LLM gibi token token akan yorumlar, sonucu kopyalama, model kartı, 5 dil, `prefers-reduced-motion` desteği.

## Teknoloji

- **SvelteKit 3** + **Svelte 5**, **three.js**, **ONNX Runtime Web** (jsDelivr'dan tembel yükleme)
- **Cloudflare Workers** (`@sveltejs/adapter-cloudflare`), Cloudflare Web Analytics
- `redirect-worker/`: eski `coinflip-ai` Worker'ı, yeni adrese 301 yönlendirme

## Çalıştırma

Node **22+** gerekir.

```bash
npm i
npm run dev        # geliştirme sunucusu
npm test           # her iki modelin dağılım testleri (1e6 örnek)
npm run build && npx wrangler deploy
python3 scripts/build-onnx.py && python3 scripts/build-onnx-dice.py   # ONNX modellerini yeniden üret (pip install onnx onnxruntime)
```

---

## English

**Absurdly tiny AI models.** Who needs a trillion parameters? Live at https://tiny-models.anil-oz.workers.dev (the old `coinflip-ai.anil-oz.workers.dev` address redirects here).

- 🪙 **CoinFlip‑1P** (`/coin`): 1 parameter, `σ(w · z · 1.5)`, 50.0% accuracy (SOTA). Heads = Yes, Tails = No.
- 🎲 **DiceRoll‑6P** (`/dice`): 6 parameters (one bias per face, all 1/6), `softmax((g + b) · 1.0)` over Gumbel noise, 16.7% accuracy (SOTA). Answers 1–6; confidence = softmax max; exactly uniform faces (see `npm test`).
- ✊ RockPaperScissors‑3P and 🎱 Magic8Ball‑20P: coming soon.

Type an optional question, **hold** the button (or Space / Enter) and release. The hold duration, hashed with crypto‑random jitter, becomes the model input. Each model is a real ONNX file run by ONNX Runtime Web (WebGPU, else WASM), lazy‑loaded from jsDelivr, with a silent TypeScript fallback. Every language has its own URL (`/`, `/tr`, `/de`, `/es`, `/fr`, plus `/coin` and `/dice` under each).

Stack: SvelteKit 3, Svelte 5, three.js, ONNX Runtime Web, Cloudflare Workers. Run: Node 22, `npm i && npm run dev`, `npm test`, deploy with `npm run build && npx wrangler deploy`. Rebuild models: `python3 scripts/build-onnx.py && python3 scripts/build-onnx-dice.py`.
