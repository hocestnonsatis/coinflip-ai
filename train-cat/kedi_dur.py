def swap_dur(speed):  # = swapDur() in src/lib/kedi-anim.ts
    s = min(1.0, max(0.0, speed)); return 0.9 * (0.15 / 0.9) ** s
