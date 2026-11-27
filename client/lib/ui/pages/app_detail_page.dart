import 'package:flutter/material.dart';

import '../../core/api_exception.dart';
import '../../core/app_config.dart';
import '../../core/formatters.dart';
import '../../data/app_repository.dart';
import '../../data/models.dart';
import '../../services/install_service.dart';
import '../widgets/app_icon.dart';
import '../widgets/state_views.dart';
import 'download_install_page.dart';

/// 应用详情页：截图、介绍、版本信息与下载安装入口。
class AppDetailPage extends StatefulWidget {
  /// 创建详情页。
  const AppDetailPage({super.key, required this.slug, this.initialName});

  /// 应用访问标识。
  final String slug;

  /// 初始名称，加载完成前用于标题占位。
  final String? initialName;

  @override
  State<AppDetailPage> createState() => _AppDetailPageState();
}

class _AppDetailPageState extends State<AppDetailPage> {
  AppDetail? _detail;
  List<VersionSummary> _releases = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// 加载应用详情。
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await AppRepository.instance.getApp(widget.slug);
      var releases = detail.releases;
      try {
        // 版本列表接口包含每个版本的更新日志与包信息，失败时回退到详情内置列表
        final full = await AppRepository.instance.listReleases(widget.slug);
        if (full.isNotEmpty) releases = full;
      } catch (_) {
        // 忽略版本列表加载失败，详情页仍可正常使用
      }
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _releases = releases;
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
        _error = '加载失败：$error';
      });
    }
  }

  /// 下载当前版本并调起安装。
  Future<void> _downloadAndInstall() async {
    final detail = _detail;
    final release = detail?.currentRelease;
    if (detail == null || release == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => DownloadInstallPage(
          appName: detail.app.name,
          packageName: detail.app.packageName,
          fileKey: '${detail.app.slug}-${release.versionCode}',
          loadRelease: () async {
            // 每次开始下载前重新取票据，避免使用过期签名地址
            final ticket = await AppRepository.instance.downloadTicket(
              release.id,
            );
            return release.copyWith(downloadUrl: ticket);
          },
        ),
      ),
    );
  }

  /// 使用系统浏览器打开网页作品。
  Future<void> _openWeb(String url) async {
    final opened = await InstallService.instance.openUrl(url);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('无法打开该链接')));
    }
  }

  /// 全屏查看截图。
  void _showScreenshot(List<String> images, int index) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: InteractiveViewer(
          child: Image.network(
            AppConfig.instance.resolve(images[index]).toString(),
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) => const Padding(
              padding: EdgeInsets.all(24),
              child: Text('截图加载失败', style: TextStyle(color: Colors.white70)),
            ),
          ),
        ),
      ),
    );
  }

  /// 展示指定历史版本的更新日志、包信息、截图与校验值。
  void _showVersionDetail(AppDetail detail, VersionSummary item) {
    final theme = Theme.of(context);
    final isCurrent = detail.currentRelease?.versionCode == item.versionCode;
    final meta = <String>[
      '发布于 ${formatDateTime(item.publishedAt)}',
      if (item.fileSize > 0) formatBytes(item.fileSize),
      if (item.minSdk != null) '最低 Android API ${item.minSdk}',
    ];

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: theme.colorScheme.surface,
      builder: (sheetContext) {
        return SafeArea(
          top: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.85,
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        'v${item.versionName}',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '（${item.versionCode}）',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                      if (isCurrent) ...[
                        const SizedBox(width: 8),
                        _Badge(text: '当前版本', color: theme.colorScheme.primary),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    meta.join(' · '),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  if (detail.screenshots.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text(
                      '应用截图',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 190,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: detail.screenshots.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          final url = AppConfig.instance
                              .resolve(detail.screenshots[index])
                              .toString();
                          return GestureDetector(
                            onTap: () =>
                                _showScreenshot(detail.screenshots, index),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                url,
                                width: 104,
                                height: 190,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) =>
                                    Container(
                                      width: 104,
                                      alignment: Alignment.center,
                                      color: theme
                                          .colorScheme.surfaceContainerHighest,
                                      child: const Icon(
                                        Icons.broken_image_outlined,
                                      ),
                                    ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    '更新日志',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item.changelog.isEmpty ? '该版本未填写更新日志' : item.changelog,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      height: 1.6,
                      color: item.changelog.isEmpty
                          ? theme.colorScheme.outline
                          : null,
                    ),
                  ),
                  if (item.sha256.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    Text(
                      'SHA-256',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                    SelectableText(
                      item.sha256,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontFamily: 'monospace',
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.tonal(
                      onPressed: () => Navigator.of(sheetContext).pop(),
                      child: const Text('关闭'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;

    return Scaffold(
      appBar: AppBar(
        title: Text(detail?.app.name ?? widget.initialName ?? '应用详情'),
      ),
      body: _buildBody(detail),
    );
  }

  /// 按加载状态构建页面主体。
  Widget _buildBody(AppDetail? detail) {
    if (_loading && detail == null) {
      return const LoadingView(message: '正在加载详情…');
    }
    if (_error != null && detail == null) {
      return ErrorRetryView(message: _error!, onRetry: _load);
    }
    if (detail == null) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final app = detail.app;
    final release = detail.currentRelease;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
        children: [
          // 头部信息居中展示，贴近 iOS 应用详情页
          Column(
            children: [
              AppIcon(name: app.name, iconUrl: app.iconUrl, size: 84),
              const SizedBox(height: 14),
              Text(
                app.name,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person_outline_rounded,
                    size: 15,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      app.developer?.label ?? '平台官方',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                runSpacing: 6,
                children: [
                  _Badge(
                    text: app.isAndroid ? 'Android' : '网页',
                    color: app.isAndroid
                        ? const Color(0xFF059669)
                        : const Color(0xFF0284C7),
                  ),
                  _Badge(text: app.category, color: theme.colorScheme.primary),
                  if (app.pinned)
                    _Badge(text: '置顶', color: const Color(0xFFD97706)),
                  ...app.tags.map(
                    (tag) => _Badge(
                      text: tag,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                app.summary,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '更新于 ${formatDateTime(app.updatedAt)} · ${app.downloadCount} 次下载',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildActionCard(detail, release),
          if (detail.description.isNotEmpty) ...[
            const SizedBox(height: 20),
            _Section(
              title: '应用介绍',
              child: Text(
                detail.description,
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
              ),
            ),
          ],
          if (detail.screenshots.isNotEmpty) ...[
            const SizedBox(height: 20),
            _Section(
              title: '截图',
              child: SizedBox(
                height: 240,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: detail.screenshots.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    final url = AppConfig.instance
                        .resolve(detail.screenshots[index])
                        .toString();
                    return GestureDetector(
                      onTap: () => _showScreenshot(detail.screenshots, index),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: Image.network(
                          url,
                          width: 132,
                          height: 240,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              Container(
                                width: 132,
                                alignment: Alignment.center,
                                color:
                                    theme.colorScheme.surfaceContainerHighest,
                                child: const Icon(Icons.broken_image_outlined),
                              ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
          if (release != null && release.changelog.isNotEmpty) ...[
            const SizedBox(height: 20),
            _Section(
              title: '更新日志 · v${release.versionName}',
              child: Text(
                release.changelog,
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.6),
              ),
            ),
          ],
          if (_releases.length > 1) ...[
            const SizedBox(height: 20),
            _Section(
              title: '历史版本',
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '点击任意版本查看更新日志、截图与包信息',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  for (final item in _releases)
                    InkWell(
                      onTap: () => _showVersionDetail(detail, item),
                      borderRadius: BorderRadius.circular(10),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 9),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                'v${item.versionName}（${item.versionCode}）',
                                style: theme.textTheme.bodyMedium,
                              ),
                            ),
                            Text(
                              formatDateTime(item.publishedAt),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.outline,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 18,
                              color: theme.colorScheme.outline,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// 构建下载 / 打开作品的操作卡片。
  Widget _buildActionCard(AppDetail detail, ReleaseInfo? release) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: theme.colorScheme.outlineVariant.withValues(alpha: 0.45),
        ),
      ),
      child: detail.app.isAndroid
          ? (release == null
                ? Text(
                    '暂无可下载版本，请等待管理员发布安装包。',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.outline,
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '当前版本 v${release.versionName}',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${formatBytes(release.fileSize)}'
                        '${release.minSdk != null ? ' · 最低 Android API ${release.minSdk}' : ''}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _downloadAndInstall,
                          icon: const Icon(Icons.download_rounded),
                          label: const Text('下载并安装'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'SHA-256',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.outline,
                        ),
                      ),
                      SelectableText(
                        release.sha256,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontFamily: 'monospace',
                          color: theme.colorScheme.outline,
                        ),
                      ),
                    ],
                  ))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '这是一个网页作品，点击下方按钮在浏览器中打开。',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: detail.webUrl == null
                        ? null
                        : () => _openWeb(detail.webUrl!),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: const Text('打开作品'),
                  ),
                ),
              ],
            ),
    );
  }
}

/// 带标题的内容区块。
class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

/// 小号标签。
class _Badge extends StatelessWidget {
  const _Badge({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
