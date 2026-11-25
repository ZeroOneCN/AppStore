import 'package:flutter/material.dart';

import '../../core/app_config.dart';

/// 应用图标：优先加载网络图标，失败或无图标时展示名称首字占位。
class AppIcon extends StatelessWidget {
  /// 创建应用图标。
  const AppIcon({super.key, required this.name, this.iconUrl, this.size = 48});

  /// 应用名称，用于占位与语义描述。
  final String name;

  /// 图标相对地址。
  final String? iconUrl;

  /// 图标显示边长。
  final double size;

  @override
  Widget build(BuildContext context) {
    final fallback = _buildFallback(context);
    final url = iconUrl;

    if (url == null || url.isEmpty) return fallback;

    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.network(
        AppConfig.instance.resolve(url).toString(),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      ),
    );
  }

  /// 构建名称首字占位图标。
  Widget _buildFallback(BuildContext context) {
    final trimmed = name.trim();
    final letter = trimmed.isEmpty
        ? 'A'
        : trimmed.substring(0, 1).toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E51EE), Color(0xFF5B83FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(size * 0.22),
      ),
      child: Text(
        letter,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.4,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
