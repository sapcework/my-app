// リリースビルドでコンソールウィンドウを出さない。
// 保護者が使う画面なので、黒い窓が一緒に開くのは不自然
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ifilter_ui_lib::run();
}
