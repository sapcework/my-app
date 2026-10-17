import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/settings.dart';

// 高速メモ帳の「色」ダイアログ。ナイトモードとアプリの色を選ぶと、その場で反映する
Future<void> showThemeDialog(BuildContext context) => showDialog<void>(
      context: context,
      builder: (context) => Consumer(builder: (context, ref, _) {
        final settings = ref.watch(settingsProvider);
        final night = Theme.of(context).brightness == Brightness.dark;
        return AlertDialog(
          title: const Text('色'),
          contentPadding: const EdgeInsets.fromLTRB(8, 16, 8, 0),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(title: const Text('ナイトモード'), value: night, onChanged: settings.setNightMode),
              const Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 8), child: Text('アプリの色')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (i, (name, color)) in appColors.indexed)
                      Semantics(
                        button: true,
                        selected: i == settings.appColorIndex,
                        label: name,
                        child: InkWell(
                          onTap: () => settings.setAppColor(i),
                          child: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: color,
                              border: Border.all(color: i == settings.appColorIndex ? Theme.of(context).colorScheme.onSurface : Colors.transparent, width: 3),
                            ),
                            child: i == settings.appColorIndex ? const Icon(Icons.check, color: Colors.white) : null,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('閉じる'))],
        );
      }),
    );
