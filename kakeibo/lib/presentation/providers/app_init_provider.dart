import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'isar_provider.dart';
import 'repository_providers.dart';

// アプリ起動時の初期化処理を一括管理するProvider
final appInitProvider = FutureProvider<void>((ref) async {
  await ref.watch(isarProvider.future);
  await ref.read(categoryRepositoryProvider).seedDefaults(); // デフォルトカテゴリ投入（冪等）
  await ref.read(recurringExpenseRepositoryProvider).autoRegisterForCurrentMonth(); // 定期支出の今月分を自動登録
});
