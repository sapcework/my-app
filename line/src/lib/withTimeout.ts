// Promiseにタイムアウトを付与する。
// スマホの電源ON直後・スリープ復帰直後など回線がまだ不安定なタイミングでは、
// fetchが応答しないまま固まり「読み込み中」から進めなくなることがあるため、
// 一定時間で諦めて呼び出し元に制御を返せるようにする。
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
