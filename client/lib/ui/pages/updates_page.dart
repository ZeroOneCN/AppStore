import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/api_exception.dart';
import '../../core/app_config.dart';
import '../../core/formatters.dart';
import '../../data/app_repository.dart';
import '../../data/models.dart';
import '../../data/update_repository.dart';
import '../../services/install_service.dart';
import '../widgets/app_icon.dart';
import '../widgets/state_views.dart';
import 'download_install_page.dart';

/// 更新页：读取已安装版本、检测更新并支持单个或全部更新。
class UpdatesPage extends StatefulWidget {
  /// 创建更新页。
  const UpdatesPage({super.key});

  @override
  State<UpdatesPage> createState() => _UpdatesPageState();
}

class _UpdatesPageState extends State<UpdatesPage> {
  bool _loading = true;
  String? _error;
  List<UpdateItem> _items = const [];
  String _selfVersionName = '';
  int _selfVersionCode = 0;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    AppConfig.instance.addListener(_onConfigChanged);
    _load();
  }

  @override
  void dispose() {
    AppConfig.instance.removeListener(_onConfigChanged);
    super.dispose();
  }

  /// 基地址变化后重新检测更新。
  void _onConfigChanged() {
    if (mounted) _load();
  }

  /// 读取商店自身与已安装应用的版本，逐个检查更新。
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final info = await PackageInfo.fromPlatform();
      final ownCode = int.tryParse(info.buildNumber.split('.').first) ?? 0;
      _selfVersionName = info.version;
      _selfVersionCode = ownCode;

      final items = <UpdateItem>[];

      // 商店自身的更新（自更新）
      if (ownCode > 0) {
        final ownCheck = await UpdateRepository.instance.check(
          info.packageName,
          ownCode,
        );
        if (ownCheck.hasUpdate) {
          items.add(
            UpdateItem(
              appName: '应用仓库',
              packageName: info.packageName,
              installedVersionCode: ownCode,
              check: ownCheck,
              isSelf: true,
            ),
          );
        }
      }

      // 已安装的其他应用
      final apps = await AppRepository.instance.listApps(type: 'ANDROID');
      final candidates = apps
          .where(
            (app) =>
                app.packageName != null &&
                app.packageName!.isNotEmpty &&
                app.packageName != info.packageName,
          )
          .toList(growable: false);
      final installed = await InstallService.instance.installedVersionCodes(
        candidates.map((app) => app.packageName!).toList(),
      );

      for (final app in candidates) {
        final installedCode = installed[app.packageName!];
        if (installedCode == null) continue;

        final current = app.currentVersion;
        if (current != null && current.versionCode <= installedCode) continue;

        final check = await UpdateRepository.instance.check(
          app.packageName!,
          installedCode,
        );
        if (check.hasUpdate) {
          items.add(
            UpdateItem(
              appName: app.name,
              packageName: app.packageName!,
              installedVersionCode: installedCode,
              check: check,
              slug: app.slug,
              iconUrl: app.iconUrl,
            ),
          );
        }
        // 控制请求频率，避免一次性冲击服务端
        await Future<void>.delayed(const Duration(milliseconds: 320));
      }

      items.sort((a, b) {
        if (a.forceUpdate != b.forceUpdate) return a.forceUpdate ? -1 : 1;
        return a.appName.compareTo(b.appName);
      });

      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '检测更新失败：$error';
      });
    }
  }

  /// 更新单个应用：进入下载安装页并在返回后刷新列表。
  Future<void> _updateOne(UpdateItem item) async {
    final latest = item.latest;
    await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => DownloadInstallPage(
          appName: item.appName,
          fileKey:
              '${item.packageName}-${latest?.versionCode ?? item.installedVersionCode}',
          loadRelease: () async {
            // 重新检查以获取最新的签名下载地址
            final check = await UpdateRepository.instance.check(
              item.packageName,
              item.installedVersionCode,
            );
            final release = check.latest;
            if (release == null) throw const ApiException('该应用暂无可用更新');
            return release;
          },
        ),
      ),
    );
    if (mounted) _load();
  }

  /// 依次更新全部可更新项。
  Future<void> _updateAll() async {
    if (_items.isEmpty || _busy) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('全部更新'),
        content: Text('将依次下载并安装 ${_items.length} 个更新，安装时需要在系统弹窗中确认。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('开始'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      for (final item in List<UpdateItem>.from(_items)) {
        if (!mounted) return;
        await _updateOne(item);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('更新'),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '重新检测',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  /// 按加载与错误状态构建主体。
  Widget _buildBody() {
    if (_loading && _items.isEmpty) {
      return const LoadingView(message: '正在检测更新…');
    }
    if (_error != null && _items.isEmpty) {
      return ErrorRetryView(message: _error!, onRetry: _load);
    }

    final theme = Theme.of(context);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '商店版本 v$_selfVersionName（$_selfVersionCode）',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _items.isEmpty ? '已安装应用均为最新版本' : '发现 ${_items.length} 个可更新项',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.outline,
                  ),
                ),
                if (_items.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _updateAll,
                      icon: const Icon(Icons.system_update_alt_rounded),
                      label: Text(_busy ? '正在更新…' : '全部更新'),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (_items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: EmptyView(
                title: '所有应用都是最新版本',
                subtitle: '下拉可重新检测更新',
                icon: Icons.check_circle_outline_rounded,
              ),
            )
          else
            ..._items.map(
              (item) => _UpdateCard(
                item: item,
                onUpdate: _busy ? null : () => _updateOne(item),
              ),
            ),
        ],
      ),
    );
  }
}

/// 单个更新项卡片。
class _UpdateCard extends StatelessWidget {
  const _UpdateCard({required this.item, required this.onUpdate});

  final UpdateItem item;
  final VoidCallback? onUpdate;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final latest = item.latest;

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIcon(name: item.appName, iconUrl: item.iconUrl, size: 44),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            item.appName,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (item.isSelf) ...[
                          const SizedBox(width: 6),
                          Text(
                            '商店自身',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '已安装 ${item.installedVersionCode} → 最新 v${latest?.versionName ?? ''}（${latest?.versionCode ?? ''}）',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                    if (latest != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        formatBytes(latest.fileSize),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (latest != null && latest.changelog.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              latest.changelog,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              if (item.forceUpdate)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.errorContainer,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '强制更新',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onErrorContainer,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              const Spacer(),
              FilledButton(
                onPressed: onUpdate,
                child: Text(item.forceUpdate ? '立即更新' : '更新'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
