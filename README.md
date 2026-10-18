# 🪙🎲🎯 Tiny Models

> **Absürt derecede küçük yapay zekâ modelleri.** Trilyon parametre kimin umurunda? Burada modeller avuç içine sığar.

🔗 **Canlı:** https://tiny-models.anil-oz.workers.dev · (eski adres `coinflip-ai.anil-oz.workers.dev` buraya yönlenir)

![Tiny Models](docs/hub.png)

| Model | Parametre | Doğruluk | Adres |
|---|---|---|---|
| 🪙 **CoinFlip‑1P** | 1 | %50,0 (SOTA) | [/coin](https://tiny-models.anil-oz.workers.dev/coin) |
| 🎲 **DiceRoll‑6P** | 6 | %16,7 (SOTA) | [/dice](https://tiny-models.anil-oz.workers.dev/dice) |
| 🎯 **Tavla‑1.6K** | 1.601 | rastgeleye karşı %99,7 · sezgisel bota karşı %75,3 | [/tavla](https://tiny-models.anil-oz.workers.dev/tavla) |
| 🀄 **Okey‑257** | 257 | 3 rastgele bota karşı %93,4 · 3 açgözlü bota karşı %24,0 (taban %25) | [/okey](https://tiny-models.anil-oz.workers.dev/okey) |
| 🐱 **Kedi‑27K** | 27.044 | bardak takibi: ayrı test turlarında %100 (240/240), hız × değişim tablosu 900/900 (taban %33,3) | [/kedi](https://tiny-models.anil-oz.workers.dev/kedi) |
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

### Tavla‑1.6K (gerçekten eğitilmiş!)
TD‑Gammon tarzı tavla (backgammon) ağı: Tesauro'nun 198 girdili kodlaması → 8 sigmoid gizli nöron → 1 sigmoid çıktı (hamleyi yapan oyuncunun kazanma olasılığı). **1.601 parametre** (198·8 + 8 + 8 + 1), ONNX 6,6 KB.

- **Eğitim:** `train/td.py`, saf numpy, TD(λ=0,7) kendine karşı oyun; 8 farklı ayar paralel 95 dk koşturuldu, seçilen model (α 0,2→0,02) **381.954 oyun** oynadı.
- **Değerlendirme** (`train/eval.py`, seçimden bağımsız tohumlarla 5.000'er oyun): rastgele oyuncuya karşı **%99,7** (4986/5000), pip sayan sezgisel bota karşı **%75,3** (3766/5000).
- **Kurallar:** `train/bg.py` (Python) ve `src/lib/tavla-engine.ts` (TS): bar'dan giriş, kırma, toplama, iki zarı da kullanma / büyük zar kuralı, çift zarlar. Katlama küpü yok. TS ve Python 1.500 rastgele pozisyonda birebir aynı yasal hamle kümesini üretir (`npm test`).
- **Tarayıcıda:** 1 hamle derinlik arama, tüm yasal hamleler tek `session.run` çağrısında puanlanır; ORT yoksa aynı ağırlıklarla TS'e döner. Tıkla‑oyna, yasal hedef vurgusu, canlı kazanma olasılığı çubuğu, akan yorumlar.
- 🤗 Hugging Face: [https://huggingface.co/hocestnonsatis/tavla-1.6k](https://huggingface.co/hocestnonsatis/tavla-1.6k) (ONNX, safetensors, eğitim kodu, örnek)
- **Tüm zamanlar sayacı:** `/tavla` panelinde küresel skor (toplam oyun, insan / model galibiyeti, mars). Depolama: `stats-worker/` içindeki ayrı **tiny-models-stats** Worker'ında tek bir **SQLite tabanlı Durable Object** (Workers Free'de çalışır); ana Worker ona `script_name` ile bağlanır. API: `GET /api/tavla/stats`, `POST /api/tavla/start` (HMAC imzalı oyun bileti), `POST /api/tavla/result` `{winner, gammon, moves, gameId}` (bilet başına bir kez, ≥30 sn, 13–2000 hamle, IP başına saatte 60 başlatma / 30 sonuç). `?pos=` test oyunları sayılmaz. Gizli anahtarlar: `TAVLA_SECRET`, `TAVLA_ADMIN` (`POST /api/tavla/reset`).
- Yeniden üret: `cd train && python3 td.py d 0.2 0.02 0.7 4 95`, sonra `python3 scripts/build-onnx-tavla.py train/best.npz`.

### Okey‑257 (klasik okey, 4 kişi)
Sen + 3 bot. 106 taş (4 renk × 1–13 × 2 + 2 sahte okey), 14/15 dağıtım, gösterge, okey = göstergenin bir fazlası (13 → 1), sahte okey okeyin yerini tutar. Ortadan ya da soldakinin attığından çek, at; perler: aynı renk ardışık ≥3 (12‑13‑1 geçerli) ve aynı sayı farklı renk 3–4; okey joker. Bitirmek = 15. taşı atınca kalan 14 taşın tamamı perde, ya da 7 çift. Puan tutulmaz; çift ve okey atarak bitiş ×2 olarak gösterilir. Motor 101'e genişletilebilecek şekilde ayrık (kurallar / çözücü / oyun durumu / bot).
- **Kurallar + çözücü:** `train-okey/okey.py` (Python) ve `src/lib/okey-engine.ts` (TS). Tam (optimal) per bölücü: jokerlerle en çok taşı perlere yerleştiren DFS + memo, TS'te ~0,02–0,04 ms / el. Kaba kuvvete karşı 3.000 elde 0 fark; TS ↔ Python 1.313 elde birebir (kapsama, çift, bölme, 14 özellik).
- **Model:** 14 el özelliği (eksik taş, çiftler, okey sayısı, yarım perler, çıkabilecek taşlar, deste…) → 16 tanh → 1 sigmoid = **257 parametre**, ONNX 1,4 KB. Karar: 1 hamle derinlik; her atış adayı tek `session.run`'da puanlanır; ortadan çekmenin değeri 8 örneklenmiş görünmeyen taşla beklenen değer, yerden alma ancak bundan 0,03 fazlaysa.
- **Eğitim:** saf numpy. Açgözlü çözücü botların (ε‑rastgele atışlı) ≈46 bin oyunundan 1.467.046 el durumu, etiket = oyunu o oyuncu kazandı mı; çapraz entropi + Adam (`datagen.py`, `fit.py`), ≈20 dk × 7 CPU süreci. Saf TD(λ) kendine karşı oyun sıfırdan zayıf kaldı (~%15); bir tur politika iterasyonu (ağ kendine karşı ≈6 bin oyun) kazanç getirmedi, kullanılmadı. Ayrıntı: `train-okey/NOTES.md`.
- **Değerlendirme** (`train-okey/evaluate.py`, eğitimde kullanılmayan tohumlar, model 0. koltukta, dağıtan dönüyor, 4.000'er oyun, 4 kişilik oyunda taban %25): 3 rastgele bota karşı **%93,4** (3736/4000), 3 açgözlü çözücü bota karşı **%24,0** (959/4000); kıyas: açgözlü botun kendisi 3 açgözlüye karşı %25,0 (998/4000). Yani ağ açgözlü çözücü kadar iyi, daha iyi değil — dürüst sonuç bu.
- **Arayüz:** tam ekran three.js masa (WebGL yoksa 2D), çift sıralı istaka: tıkla/sürükle diz, otomatik diz (çözücüyle perlere göre), ortadan/soldan çek, köşeye at, Bitir (doğrulama + per vurgusu), botların tahmini bitirme ihtimali ve "X taş uzakta" bilgisi, gerçek sayılarla akan yorumlar. `?test=win` test eli (sayılmaz).
- **Tüm zamanlar sayacı:** aynı `tiny-models-stats` Durable Object sınıfının ayrı `okey` örneği. `GET /api/okey/stats`, `POST /api/okey/start`, `POST /api/okey/result` `{winner: human|model|draw, moves, gameId}` (okey'e özel HMAC bileti, bilet başına bir kez, ≥20 sn, 4–400 atış, IP başına saatte 40 başlatma / 30 sonuç).
- Yeniden üret: `cd train-okey && for k in 0 1 2 3 4 5 6; do python3 datagen.py $k 10 & done; wait; python3 fit.py best.npz 20 && python3 evaluate.py best.npz 4000 0.03`, sonra `python3 scripts/build-onnx-okey.py train-okey/best.npz 0.03`.

### Kedi‑27K (bardak oyunu, sadece pikseller)
Oyuncağı üç bardaktan birinin altına sakla, istediğin kadar karıştır (tıkla‑tıkla, sürükle ya da "rastgele karıştır ×N" + hız kaydırıcısı), sonra "Kedi, nerede?" de. Kedi patisiyle bir bardağa dokunur, bardak kalkar.
- **Dürüstlük:** model **sadece kedi kamerasının piksellerini** görür. Sabit bir kamera, sahnenin 64×32 gri görüntüsü, oyun zamanında 30 kare/sn; bir öncekinin aynısı olan kareler atlanır. Oyun durumu, değişim olayları ya da bardak konumları modele hiç verilmez; başlangıç bardağı da verilmez, kedi saklamayı izleyerek öğrenir. Kedi, seçim halkası ve kedinin gölgesi ayrı bir katmanda, kamera onları görmez. `tests/kedi.test.ts` model kodunun sahne ve animasyon modüllerine dokunmadığını, modele giden tek girdinin kamera karesi olduğunu denetler.
- **Model:** küçük CNN (2→8→16→16 kanal; girdi = kare ve bir önceki kareyle farkı) → 32 özellik → GRU(32) → her adımda 3×3 bardak geçiş matrisi + 3 kanıt logiti. İnanç güncellemesi: `b_t ∝ (b_{t-1}·T_t) ⊙ exp(e_t)`. **27.044 parametre**, ONNX 111 KB, tarayıcıda kare başına ≈1 ms (WASM).
- **Eğitim verisi:** aynı three.js sahnesi ve aynı kedi kamerasıyla headless Chrome'da render edilen 2.003 rastgele tur, 561.703 kare. Hız, değişim sayısı (0–40), elle/karışık değişim düzeni ve ışık rastgele. PyTorch (CPU), 40 epoch ≈ 94 dk × 4 iş parçacığı, her karede çapraz entropi. Ayrıntı ve yeniden üretim: `train-cat/NOTES.md`.
- **Değerlendirme** (eğitimde ve checkpoint seçiminde hiç kullanılmayan turlar):
  - rastgele turlar **%100** (240/240);
  - hız × değişim tablosu (9 değişim sayısı × 5 hız, 752 ms…164 ms/değişim, hücre başına 20 tur) **900/900**, 30 değişimde ve en yüksek hızda dahil;
  - boş/sabit kamera → olasılıklar %29,5–%36,1 arasında kalır;
  - aynalanmış kamera → aynalanmış cevap (240/240);
  - saklamadan sonra oyuncak her kareden silinse bile doğru (135/135); yani oyuncağı değil bardakları izliyor.
  Beklediğim gibi hızlı karıştırmada şaşırmadı. Bu sahnede ve bu kamerayla ise gerçekten çözülmüş bir görev. Başka bardak, ışık ya da açı görse kör olur.
- **🎭 Hile: sahte top çıkartması.** İstersen bardakların kedi tarafına oyuncağın düz bir resmini yapıştırırsın: bir bardağa, hepsine ya da boş olanlara, saklamadan önce veya sonra. Sen görmezsin, sol üstteki "kedinin gözü" penceresinde (modelin aldığı gerçek 64×32 kareler) görürsün. Model yeniden eğitilmedi, çıkartmayı hiç görmedi. Ölçüm (7 düzen × eğitimde görülmeyen 60 tur, `train-cat/eval_stick.py`):
  - boş bir bardak (önce / sonra), iki boş bardak, üç bardak (önce / sonra), oyuncağın kendi bardağı (önce / sonra): her düzende **60/60 doğru**;
  - toplamda **420/420**, çıkartmaya **0 kez** kandı.
  Kedi oyuncağı saklama anında masada görüp sonra bardağın hareketini izliyor; kıpırdamayan bir resim ona kanıt vermiyor. Hileli turlar küresel sayaca yazılmaz.
- **Tüm zamanlar sayacı:** aynı Durable Object sınıfının `kedi` örneği: `GET /api/kedi/stats`, `POST /api/kedi/start`, `POST /api/kedi/result` `{winner: human|model, moves, gameId}`.
- Ağırlıkları ileride Hugging Face'te yayımlayabilirim (henüz yok).
- Yeniden üret: `node scripts/cdp-kedi-datagen.mjs http://localhost:5181 train-cat/data 2 2400 1000000`, `python3 train-cat/train.py train --epochs 40`, `python3 train-cat/export.py train-cat/ckpt/last.pt && python3 train-cat/eval.py train-cat/ckpt/last.pt`.

Coin ve dice'ta: 3D sahne (three.js, ahşap masa, lamba ışığı), LLM gibi token token akan yorumlar, sonucu kopyalama, 👍/👎 geri bildirim (RLHF parodisi), model kartı, 5 dil, `prefers-reduced-motion` desteği.

## Teknoloji

- **SvelteKit 3** + **Svelte 5**, **three.js**, **ONNX Runtime Web** (jsDelivr'dan tembel yükleme)
- **Cloudflare Workers** (`@sveltejs/adapter-cloudflare`), Cloudflare Web Analytics
- **Ses**: tüm efektler Web Audio API ile anında sentezlenir (`src/lib/sound.ts`; ses dosyası yok, lisans/boyut derdi yok). İlk dokunuş/tuşta açılır; her oyunda 🔊/🔇 düğmesi ve **M** kısayolu, tercih `localStorage`'da saklanır. Ana sayfa sessiz.
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
- 🎯 **Tavla‑1.6K** (`/tavla`): a *really trained* TD‑Gammon‑style backgammon net. Tesauro 198‑input encoding → 8 sigmoid hidden → 1 sigmoid (win probability): **1,601 parameters**, 6.6 KB ONNX. Trained by TD(λ=0.7) self‑play in pure numpy (`train/td.py`): 8 configs × 95 min in parallel on CPU, the shipped one played **381,954 games**. Held‑out eval, 5,000 games each: **99.7%** vs a random player, **75.3%** vs a pip‑count heuristic bot. Rules engine in Python (`train/bg.py`) and TS (`src/lib/tavla-engine.ts`), cross‑checked on 1,500 random positions (identical legal move sets); bar entry, hitting, bearing off, must‑use‑both / larger‑die, doubles; no doubling cube. In the browser: 1‑ply search, all legal moves scored in one ONNX `session.run`, TS fallback. 🤗 Model on Hugging Face: https://huggingface.co/hocestnonsatis/tavla-1.6k. **All‑time counter:** a global scoreboard (games, human / model wins, gammons) stored in one SQLite‑backed Durable Object in the small `stats-worker/` Worker (**tiny-models-stats**, Workers Free compatible), bound via `script_name`. API: `GET /api/tavla/stats`, `POST /api/tavla/start` (HMAC‑signed game ticket), `POST /api/tavla/result` `{winner, gammon, moves, gameId}` (once per ticket, ≥30 s, 13–2000 turns, 60 starts / 30 results per IP per hour). `?pos=` test games are never counted. Deploy the stats Worker first: `cd stats-worker && npx wrangler deploy`; secrets `TAVLA_SECRET`, `TAVLA_ADMIN`.
- 🀄 **Okey‑257** (`/okey`): classic 4‑player Turkish okey, you vs 3 bots. Rules engine + exact set‑partition solver (wildcards, 12‑13‑1 runs, groups, 7 pairs) in Python (`train-okey/okey.py`) and TS (`src/lib/okey-engine.ts`), 0 mismatches vs brute force on 3,000 hands and identical TS↔Python results on 1,313 hands. Value net 14 hand features → 16 tanh → 1 sigmoid = **257 parameters** (1.4 KB ONNX), used 1‑ply (each discard scored in one `session.run`; pile draw valued by 8 sampled unseen tiles). Trained supervised in numpy on 1,467,046 positions from ≈46k greedy‑solver bot games (label = did this player win), ≈20 min × 7 CPU processes; pure TD self‑play from scratch was weak and one policy‑iteration round gave no gain. Held‑out eval (4,000 games each, model in seat 0, 25% baseline): **93.4%** vs 3 random bots, **24.0%** vs 3 greedy solver bots (the greedy bot itself scores 25.0% there) — i.e. on par with the greedy solver, not better. Full‑screen three.js table with a 2D fallback, drag/click rack, auto‑arrange, Finish validation with set highlight, streamed commentary with the bots' real estimates. All‑time counter: `GET /api/okey/stats`, `POST /api/okey/start`, `POST /api/okey/result` (own HMAC ticket kind, once per ticket, ≥20 s, 4–400 discards); `?test=win` games aren't counted. Notes: `train-okey/NOTES.md`.
- 🐱 **Kedi‑27K** (`/kedi`): the shell game against a cat.
  - **How to play:** hide the toy under one of three cups, then shuffle as much as you like (click‑click, drag, or "random shuffle ×N" with a speed slider). Then ask the cat; it taps a cup with its paw.
  - **Pixels only:** the model sees nothing but the cat camera, a fixed 64×32 grayscale view at 30 frames/s of game time, with identical frames dropped. It gets no game state, swap events or cup positions, not even the starting cup: it watches you hide the toy. The cat itself, the selection ring and the cat's shadow are on a layer the camera cannot see. `tests/kedi.test.ts` checks the wiring.
  - **Model:** tiny CNN on the frame and the frame difference → GRU(32) → a per‑step 3×3 cup transition matrix plus evidence (belief update `b_t ∝ (b_{t-1}·T_t) ⊙ exp(e_t)`). **27,044 parameters**, 111 KB ONNX, ≈1 ms per frame in WASM.
  - **Training:** 2,003 random rounds / 561,703 frames rendered by the same three.js scene in headless Chrome. Speed, swap count (0–40), hand vs burst swaps and lighting are randomised. PyTorch CPU, 40 epochs ≈ 94 min × 4 threads.
  - **Held‑out results:**
    - **100%** on random rounds (240/240);
    - **900/900** on the swaps × speed grid (9 swap counts × 5 speeds from 752 ms down to 164 ms per swap, 20 rounds per cell, random = 33.3%);
    - blank camera → 29.5–36.1%;
    - mirrored camera → mirrored answer 240/240;
    - toy erased from every frame after the hide → still right 135/135, so it tracks the cups, not the toy.
  - I expected fast shuffles to fool it; they don't. Within this scene and camera the task is solved, but other cups, lights or angles would blind it.
  - **🎭 Cheat: fake toy sticker.** Stick a flat picture of the toy on the cat‑facing side of one cup, all cups or the empty ones, before or after the hide. You only see it in the "cat's eye" inset, which shows the real 64×32 frames the model gets. The model was not retrained and never saw a sticker. Measured on 7 configs × 60 unseen rounds (`train-cat/eval_stick.py`): **60/60 in every config, 420/420 overall, fooled 0 times**. The cat locates the toy while it is hidden, then tracks cup motion, and a picture that never moves gives it no evidence. Cheated rounds are not counted.
  - Counter: `/api/kedi/{stats,start,result}`. Weights may go to Hugging Face later. Notes: `train-cat/NOTES.md`.
- ✊ RockPaperScissors‑3P and 🎱 Magic8Ball‑20P: coming soon.

Type an optional question, **hold** the button (or Space / Enter) and release. The hold duration, hashed with crypto‑random jitter, becomes the model input. Each model is a real ONNX file run by ONNX Runtime Web (WebGPU, else WASM), lazy‑loaded from jsDelivr, with a silent TypeScript fallback. Every language has its own URL (`/`, `/tr`, `/de`, `/es`, `/fr`, plus `/coin` and `/dice` under each).

Sound: every effect is synthesised on the fly with the Web Audio API (`src/lib/sound.ts`, no sample files, so no licensing or download size); audio starts on the first tap/key, each game has a 🔊/🔇 button plus the **M** shortcut, and the choice is remembered in `localStorage`. The hub is silent.

Stack: SvelteKit 3, Svelte 5, three.js, ONNX Runtime Web, Cloudflare Workers. Run: Node 22, `npm i && npm run dev`, `npm test`, deploy with `npm run build && npx wrangler deploy`. Rebuild models: `python3 scripts/build-onnx.py && python3 scripts/build-onnx-dice.py`.
