import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../screens/budget/budget_setting_screen.dart';
import '../screens/calculator/calculator_screen.dart';
import '../screens/category/category_screen.dart';
import '../screens/expense/expense_form_screen.dart';
import '../screens/expense/expense_list_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/recurring/recurring_expense_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/stats/stats_screen.dart';
import '../screens/table/expense_table_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute( // BottomNavBarを共有するメイン画面群
        builder: (context, state, child) => _AppShell(
          location: state.uri.path,
          child: child,
        ),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
          GoRoute(path: '/expenses', builder: (context, state) => const ExpenseListScreen()),
          GoRoute(path: '/stats', builder: (context, state) => const StatsScreen()),
          GoRoute(path: '/table', builder: (context, state) => const ExpenseTableScreen()),
          GoRoute(path: '/settings', builder: (context, state) => const SettingsScreen()),
        ],
      ),
      // モーダル系ルート（BottomNavBarなし）
      GoRoute(path: '/expenses/add', builder: (context, state) => const ExpenseFormScreen()),
      GoRoute(
        path: '/expenses/:id/edit',
        builder: (context, state) => ExpenseFormScreen(editId: state.pathParameters['id']),
      ),
      GoRoute(path: '/categories', builder: (context, state) => const CategoryScreen()),
      GoRoute(path: '/budget', builder: (context, state) => const BudgetSettingScreen()),
      GoRoute(path: '/recurring', builder: (context, state) => const RecurringExpenseScreen()),
      GoRoute(
        path: '/calculator',
        builder: (context, state) => CalculatorScreen(initialValue: state.extra as double?),
      ),
    ],
  );
});

class _AppShell extends StatelessWidget {
  final String location;
  final Widget child;

  const _AppShell({required this.location, required this.child});

  int get _selectedIndex {
    if (location.startsWith('/expenses')) return 1;
    if (location.startsWith('/table')) return 2; // Web版と順序を合わせる
    if (location.startsWith('/stats')) return 3;
    if (location.startsWith('/settings')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/');
            case 1:
              context.go('/expenses');
            case 2:
              context.go('/table');
            case 3:
              context.go('/stats');
            case 4:
              context.go('/settings');
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'ホーム',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: '支出',
          ),
          NavigationDestination(
            icon: Icon(Icons.table_chart_outlined),
            selectedIcon: Icon(Icons.table_chart),
            label: '表',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: '統計',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: '設定',
          ),
        ],
      ),
    );
  }
}
