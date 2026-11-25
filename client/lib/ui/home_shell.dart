import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../data/models.dart';
import '../data/update_repository.dart';
import 'pages/download_install_page.dart';
import 'pages/home_page.dart';
import 'pages/settings_page.dart';
import 'pages/updates_page.dart';

/// 主框架：底部导航承载应用墙、更新与设置，并在启动时检测商店自身更新。
class HomeShell extends StatefulWidget {
  /// 创建主框架。
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  bool _selfUpdateChecked = false;

  @override
  void initState() {
    super.initState();
    // 首帧渲染后检测更新，避免阻塞启动
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkSelfUpdate());
  }

  /// 检测商店自身是否有更新；强制更新时弹窗不可关闭。
  ///
  /// 检测失败不打扰用户，可到「更新」页手动重试。
  Future<void> _checkSelfUpdate() async {
    if (_selfUpdateChecked) return;
    _selfUpdateChecked = true;

    try {
      final info = await PackageInfo.fromPlatform();
      final ownCode = int.tryParse(info.buildNumber.split('.').first) ?? 0;
      if (ownCode <= 0) return;

      final check = await UpdateRepository.instance.check(info.packageName, ownCode);
      if (!check.hasUpdate || check.latest == null || !mounted) return;

      await _showSelfUpdateDialog(check, ownCode, info.packageName);
    } catch (_) {
      // 启动自更新检测失败时静默忽略
    }
  }

  /// 展示商店自身更新弹窗，确认后进入下载安装流程。
  Future<void> _showSelfUpdateDialog(
    UpdateCheck check,
    int ownCode,
    String packageName,
  ) async {
    final latest = check.latest;
    if (latest == null) return;
    final force = check.forceUpdate;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: !force,
      builder: (dialogContext) => PopScope(
        canPop: !force,
        child: AlertDialog(
          title: Text(force ? '应用商店需要更新' : '发现商店新版本'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('最新版本 v${latest.versionName}（${latest.versionCode}）'),
              const SizedBox(height: 8),
              Text(
                latest.changelog.isEmpty ? '包含体验改进与问题修复。' : latest.changelog,
                maxLines: 6,
                overflow: TextOverflow.ellipsis,
              ),
              if (force) ...[
                const SizedBox(height: 12),
                const Text('当前版本已停止支持，需更新后才能继续使用。'),
              ],
            ],
          ),
          actions: [
            if (!force)
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('稍后'),
              ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(force ? '立即更新' : '更新'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true || !mounted) return;

    await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => DownloadInstallPage(
          appName: '应用商店',
          fileKey: '$packageName-${latest.versionCode}',
          loadRelease: () async {
            // 重新检查以获取最新的签名下载地址
            final fresh = await UpdateRepository.instance.check(packageName, ownCode);
            return fresh.latest ?? latest;
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          HomePage(),
          UpdatesPage(),
          SettingsPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (index) => setState(() => _index = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.apps_rounded),
            selectedIcon: Icon(Icons.apps_rounded),
            label: '应用',
          ),
          NavigationDestination(
            icon: Icon(Icons.system_update_alt_outlined),
            selectedIcon: Icon(Icons.system_update_alt_rounded),
            label: '更新',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings_rounded),
            label: '设置',
          ),
        ],
      ),
    );
  }
}
