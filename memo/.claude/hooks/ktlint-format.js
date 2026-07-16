// PostToolUse(Write|Edit) フック本体。Kotlinファイル編集時に ktlintFormat を実行する。
//
// gradlew.bat は使わない。Git Bash配下ではPATHがUnix形式(/c/...)に変換されるため、
// cmd.exe がバッチ内のコマンドを解決できず即座に失敗する。
// gradlew.bat の実体は「JVMでGradleWrapperMainを起動する」だけなので、java.exeを直接呼び
// シェルとPATHへの依存を断つ。
//
// 編集操作をブロックしないよう、常に exit 0 で終了する。

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..", ".."); // .claude/hooks/ → memo/
const javaHome = "C:\\Program Files\\Android\\Android Studio\\jbr"; // PATH上にjavaが無いためJBRを使う
const javaExe = path.join(javaHome, "bin", "java.exe");
const wrapperJar = path.join(projectRoot, "gradle", "wrapper", "gradle-wrapper.jar");

/** 失敗を握り潰さず利用者に見せる。exit 0 は維持し編集は妨げない。 */
function notify(message) {
  process.stdout.write(JSON.stringify({ systemMessage: message }));
  process.exit(0);
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let filePath = "";
  try {
    const payload = JSON.parse(input);
    filePath =
      (payload.tool_input && payload.tool_input.file_path) ||
      (payload.tool_response && payload.tool_response.filePath) ||
      "";
  } catch {
    process.exit(0); // 解析不能なら何もしない
  }

  if (!filePath || !/\.kts?$/i.test(filePath)) process.exit(0); // Kotlin以外は対象外

  const resolved = path.resolve(filePath);
  if (!resolved.toLowerCase().startsWith(projectRoot.toLowerCase())) process.exit(0); // memo配下のみ

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
        timeout: 110000,
      },
    );
  } catch (e) {
    // ktlintが自動修正できない違反やコンパイル不能な状態は想定内なので黙認する。
    // 一方でjavaを起動できない/時間切れは設定不備なので通知する。
    if (e.code === "ENOENT" || e.code === "ETIMEDOUT") {
      notify("ktlintフック: 実行に失敗しました (" + e.code + ")");
    }
  }
  process.exit(0);
});
