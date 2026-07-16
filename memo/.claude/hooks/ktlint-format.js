// Stop フック本体。ターンの終わりに ktlintFormat を1回だけ実行する。
//
// 編集ごと(PostToolUse)に走らせる方式は次の実害があったため採らない:
//  1. 分割リファクタリングの中間状態で、一時的に未使用になったimportをktlintが削除し
//     ビルドが壊れる。
//  2. 編集のたびにGradleを起動するため、進行中のビルドとロックを奪い合う。
//
// gradlew.bat は使わない。Git Bash配下ではPATHがUnix形式(/c/...)に変換されるため、
// cmd.exe がバッチ内のコマンドを解決できず即座に失敗する。
// gradlew.bat の実体は「JVMでGradleWrapperMainを起動する」だけなので、java.exeを直接呼び
// シェルとPATHへの依存を断つ。
//
// 応答を妨げないよう、常に exit 0 で終了する。

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", ".."); // .claude/hooks/ → memo/
const javaHome = "C:\\Program Files\\Android\\Android Studio\\jbr"; // PATH上にjavaが無いためJBRを使う
const javaExe = path.join(javaHome, "bin", "java.exe");
const wrapperJar = path.join(projectRoot, "gradle", "wrapper", "gradle-wrapper.jar");

/** 失敗を握り潰さず利用者に見せる。exit 0 は維持する。 */
function notify(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

/** Kotlinソースが1つも無い間は起動コストを払わない。 */
function hasKotlinSources() {
  const sourceRoot = path.join(projectRoot, "app", "src");
  if (!fs.existsSync(sourceRoot)) return false;
  const stack = [sourceRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.kts?$/i.test(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

if (!hasKotlinSources()) process.exit(0);
if (!fs.existsSync(javaExe)) notify("ktlintフック: javaが見つかりません (" + javaExe + ")");

try {
  execFileSync(
    javaExe,
    [
      "-Xmx64m", // ランチャ自体は軽量。実処理はGradleデーモン側
      "-classpath",
      wrapperJar,
      "org.gradle.wrapper.GradleWrapperMain",
      "ktlintFormat",
      "-q",
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, JAVA_HOME: javaHome },
      stdio: "ignore",
      timeout: 170000,
    },
  );
} catch (e) {
  // ktlintが自動修正できない違反やコンパイル不能な状態は想定内なので黙認する。
  // 一方でjavaを起動できない/時間切れは設定不備のため通知する。
  if (e.code === "ENOENT" || e.code === "ETIMEDOUT") {
    notify("ktlintフック: 実行に失敗しました (" + e.code + ")");
  }
}
process.exit(0);
