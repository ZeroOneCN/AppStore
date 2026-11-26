import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/api_exception.dart';
import '../../core/app_config.dart';
import '../../data/app_repository.dart';
import '../../services/install_service.dart';
import '../widgets/brand_mark.dart';

/// 设置页：维护服务端基地址、测试连接，并提供安装权限与版本信息。
class SettingsPage extends StatefulWidget {
  /// 创建设置页。
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final TextEditingController _controller = TextEditingController(
    text: AppConfig.instance.baseUrl,
  );

  bool _saving = false;
  bool _testing = false;
  String? _message;
  bool _messageIsError = false;
  bool? _canInstall;
  PackageInfo? _packageInfo;

  @override
  void initState() {
    super.initState();
    _loadMeta();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// 读取应用版本信息与「安装未知应用」权限状态。
  Future<void> _loadMeta() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final allowed = await InstallService.instance.canInstallPackages();
      if (!mounted) return;
      setState(() {
        _packageInfo = info;
        _canInstall = allowed;
      });
    } catch (_) {
      // 读取失败时保持占位状态，不影响其他功能
    }
  }

  /// 更新提示信息。
  void _setMessage(String message, {bool isError = false}) {
    setState(() {
      _message = message;
      _messageIsError = isError;
    });
  }

  /// 保存基地址；保存成功后通知其他页面重新加载数据。
  Future<void> _save() async {
    final input = _controller.text.trim();
    if (input.isEmpty) {
      _setMessage('请输入服务端地址', isError: true);
      return;
    }

    setState(() => _saving = true);
    final saved = await AppConfig.instance.save(input);
    if (!mounted) return;
    setState(() => _saving = false);

    if (!saved) {
      _setMessage('地址格式不正确，示例：http://192.168.1.10:3000', isError: true);
      return;
    }
    _controller.text = AppConfig.instance.baseUrl;
    _setMessage('已保存：${AppConfig.instance.baseUrl}');
  }

  /// 使用当前基地址请求应用列表，验证服务端可达性。
  Future<void> _testConnection() async {
    setState(() => _testing = true);
    final stopwatch = Stopwatch()..start();
    try {
      final apps = await AppRepository.instance.listApps();
      stopwatch.stop();
      if (!mounted) return;
      _setMessage(
        '连接成功，获取到 ${apps.length} 个应用（${stopwatch.elapsedMilliseconds} ms）',
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      _setMessage('连接失败：${error.message}', isError: true);
    } catch (error) {
      if (!mounted) return;
      _setMessage('连接失败：$error', isError: true);
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  /// 跳转系统「安装未知应用」授权页，返回后刷新权限状态。
  Future<void> _openInstallSettings() async {
    await InstallService.instance.openInstallSettings();
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final allowed = await InstallService.instance.canInstallPackages();
    if (!mounted) return;
    setState(() => _canInstall = allowed);
  }

  /// 使用系统浏览器打开商店网页版。
  Future<void> _openWebStore() async {
    final opened = await InstallService.instance.openUrl(
      AppConfig.instance.baseUrl,
    );
    if (!mounted) return;
    if (!opened) _setMessage('无法打开浏览器', isError: true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final info = _packageInfo;

    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
        actions: [
          IconButton(
            onPressed: _loadMeta,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '刷新状态',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _SectionCard(
            title: '服务端地址',
            subtitle: '填写自建商店的访问地址，支持局域网 IP 或域名',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _controller,
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    hintText: 'http://192.168.1.10:3000',
                    prefixIcon: Icon(Icons.dns_rounded),
                  ),
                  onSubmitted: (_) => _save(),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _saving ? null : _save,
                        icon: _saving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.save_rounded),
                        label: Text(_saving ? '保存中…' : '保存'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _testing ? null : _testConnection,
                        icon: _testing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.wifi_tethering_rounded),
                        label: Text(_testing ? '测试中…' : '测试连接'),
                      ),
                    ),
                  ],
                ),
                if (_message != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _messageIsError
                          ? theme.colorScheme.errorContainer
                          : theme.colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _message!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: _messageIsError
                            ? theme.colorScheme.onErrorContainer
                            : theme.colorScheme.onSecondaryContainer,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: '安装权限',
            subtitle: '安装下载的安装包需要「安装未知应用」权限',
            child: Row(
              children: [
                Icon(
                  _canInstall == true
                      ? Icons.verified_rounded
                      : Icons.info_outline_rounded,
                  color: _canInstall == true
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outline,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _canInstall == null
                        ? '正在检测…'
                        : (_canInstall! ? '已授权，可直接安装' : '未授权，安装时需要手动允许'),
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
                TextButton(
                  onPressed: _openInstallSettings,
                  child: const Text('去设置'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _SectionCard(
            title: '关于',
            subtitle: '应用仓库客户端',
            child: Column(
              children: [
                const BrandMark(size: 48),
                const SizedBox(height: 14),
                _InfoRow(
                  label: '版本',
                  value: info == null
                      ? '—'
                      : 'v${info.version}（${info.buildNumber}）',
                ),
                _InfoRow(label: '包名', value: info?.packageName ?? '—'),
                _InfoRow(label: '当前地址', value: AppConfig.instance.baseUrl),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _openWebStore,
                    icon: const Icon(Icons.public_rounded),
                    label: const Text('在浏览器中打开商店'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            '下载的安装包来自你自建的商店服务端，安装前会校验 SHA-256，下载中断支持断点续传。',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.outline,
            ),
          ),
        ],
      ),
    );
  }
}

/// 带标题的分组卡片。
class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              subtitle!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ],
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

/// 左标签右取值的单行信息。
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 76,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
          ),
          Expanded(child: Text(value, style: theme.textTheme.bodySmall)),
        ],
      ),
    );
  }
}
