import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/app_config.dart';
import 'ui/home_shell.dart';

/// 应用入口：先读取本地保存的服务端地址，再启动界面。
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.instance.load();
  runApp(const AppStoreApp());
}

/// 应用根组件：统一主题、中文本地化与主框架。
class AppStoreApp extends StatelessWidget {
  /// 创建应用根组件。
  const AppStoreApp({super.key});

  @override
  Widget build(BuildContext context) {
    // 品牌主色，用于生成浅色与深色两套配色
    const seed = Color(0xFF4F46E5);

    return MaterialApp(
      title: '应用商店',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: seed),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.dark),
      ),
      themeMode: ThemeMode.system,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('zh', 'CN'), Locale('en')],
      locale: const Locale('zh', 'CN'),
      home: const HomeShell(),
    );
  }
}
