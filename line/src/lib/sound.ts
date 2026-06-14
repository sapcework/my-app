let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// タッチ・フォーカス復帰時に呼ぶ（suspended → running へ事前解除）
export function warmUpAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* ignore */ }
}

export async function playNotificationSound(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') await ctx.resume(); // resume を待ってから再生
    if (ctx.state !== 'running') return; // resume 失敗時はスキップ

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1109, ctx.currentTime + 0.08); // C#6

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.32);
  } catch { /* AudioContext非対応は無視 */ }
}
