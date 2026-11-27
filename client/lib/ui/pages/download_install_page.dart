import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../core/api_exception.dart';
import '../../core/formatters.dart';
import '../../data/models.dart';
import '../../services/analytics_service.dart';
import '../../services/download_service.dart';
import '../../services/install_service.dart';

/// 下载并安装页面：展示进度、校验结果与未知来源授权引导。
class DownloadInstallPage extends StatefulWidget {
  /// 创建下载安装页。
  const DownloadInstallPage({
    super.key,
    required this.appName,
    required this.fileKey,
    required this.loadRelease,
    this.packageName,
  });

  /// 应用名称，用于标题与提示。
  final String appName;

  /// 目标应用包名，用于安装上报；未知时为空。
  final String? packageName;

  /// 本地文件名标识，同一标识支持断点续传。
  final String fileKey;

  /// 加载最新版本信息，调用时可获取新的签名下载地址。
  final Future<ReleaseInfo> Function() loadRelease;

  @override
  State<DownloadInstallPage> createState() => _DownloadInstallPageState();
}

/// 页面阶段。
enum _Phase { downloading, verified, needPermission, error }

class _DownloadInstallPageState extends State<DownloadInstallPage> {
  _Phase _phase = _Phase.downloading;
  CancelToken? _cancelToken;
  int _received = 0;
  int _total = 0;
  String? _error;
  String? _filePath;
  bool _installing = false;
  ReleaseInfo? _release;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _cancelToken?.cancel('页面已关闭');
    super.dispose();
  }

  /// 执行下载与校验流程。
  Future<void> _start() async {
    final token = CancelToken();
    _cancelToken = token;
    setState(() {
      _phase = _Phase.downloading;
      _received = 0;
      _total = 0;
      _error = null;
    });

    try {
      final release = await widget.loadRelease();
      _release = release;
      if (!mounted) return;
      if (release.downloadUrl.isEmpty) {
        throw const ApiException('该版本暂无下载地址');
      }

      final file = await DownloadService.instance.download(
        url: release.downloadUrl,
        fileKey: widget.fileKey,
        expectedSize: release.fileSize,
        expectedSha256: release.sha256,
        cancelToken: token,
        onProgress: (received, total) {
          if (!mounted) return;
          setState(() {
            _received = received;
            _total = total > 0 ? total : release.fileSize;
          });
        },
      );

      if (!mounted || token.isCancelled) return;
      _filePath = file.path;
      await _install();
    } on ApiException catch (error) {
      if (!mounted || token.isCancelled) return;
      setState(() {
        _phase = _Phase.error;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted || token.isCancelled) return;
      setState(() {
        _phase = _Phase.error;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  /// 检查未知来源权限并调起系统安装程序。
  Future<void> _install() async {
    final path = _filePath;
    if (path == null) return;

    setState(() => _phase = _Phase.verified);
    final allowed = await InstallService.instance.canInstallPackages();
    if (!mounted) return;

    if (!allowed) {
      setState(() => _phase = _Phase.needPermission);
      return;
    }

    setState(() => _installing = true);
    try {
      final release = _release;
      final packageName = widget.packageName ?? '';
      // 安装前判断目标包是否已存在，用于区分首次安装与更新安装
      var isUpdate = false;
      if (packageName.isNotEmpty) {
        final installed = await InstallService.instance.installedVersionCodes([packageName]);
        isUpdate = installed.containsKey(packageName);
      }

      final launched = await InstallService.instance.installApk(path);
      if (launched && release != null && packageName.isNotEmpty) {
        // 写入待上报队列，下次启动确认安装成功后上报，避免中止安装造成高估
        await AnalyticsService.instance.recordPendingInstall(
          packageName: packageName,
          versionCode: release.versionCode,
          isUpdate: isUpdate,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.error;
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _installing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text('下载 ${widget.appName}')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.system_update_rounded,
                      size: 34,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ..._buildBody(context),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// 按当前阶段构建主体内容。
  List<Widget> _buildBody(BuildContext context) {
    final theme = Theme.of(context);

    switch (_phase) {
      case _Phase.downloading:
        final fraction = _total > 0
            ? (_received / _total).clamp(0.0, 1.0)
            : null;
        return [
          Text(
            '正在下载 ${widget.appName}',
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          LinearProgressIndicator(value: fraction),
          const SizedBox(height: 10),
          Text(
            '${formatPercent(_received, _total)} · ${formatBytes(_received)} / ${formatBytes(_total)}',
            style: theme.textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            '支持断点续传，下载完成后自动校验 SHA-256',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('取消下载'),
          ),
        ];

      case _Phase.verified:
        return [
          Text(
            _installing ? '正在打开安装程序…' : '安装包已下载并通过 SHA-256 校验',
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          const CircularProgressIndicator(),
        ];

      case _Phase.needPermission:
        return [
          Text(
            '需要允许安装未知应用',
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            '安装包已下载并通过校验，请在系统设置中允许本应用安装应用，然后返回重试。',
            style: theme.textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => InstallService.instance.openInstallSettings(),
            child: const Text('去授权'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _install, child: const Text('我已授权，继续安装')),
        ];

      case _Phase.error:
        return [
          Text(
            '下载失败',
            style: theme.textTheme.titleMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            _error ?? '未知错误',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.error,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          FilledButton(onPressed: _start, child: const Text('重试')),
        ];
    }
  }
}
