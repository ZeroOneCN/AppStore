import 'package:flutter/material.dart';

import '../../core/formatters.dart';
import '../../data/models.dart';
import 'app_icon.dart';

/// 应用墙卡片：横向一行的应用条目，左侧图标，中部名称与简介，右侧查看入口。
class AppWallCard extends StatelessWidget {
  /// 创建应用墙卡片。
  const AppWallCard({super.key, required this.app, required this.onTap});

  /// 应用数据。
  final AppSummary app;

  /// 点击回调。
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final version = app.currentVersion;
    final radius = BorderRadius.circular(16);

    // 版本与包大小合并为一段辅助信息，缺失时省略避免出现空白占位
    final metaParts = <String>[
      if (version != null) 'v${version.versionName}',
      if (version != null && version.fileSize > 0)
        formatBytes(version.fileSize),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: radius,
        border: Border.all(
          color: scheme.outlineVariant.withValues(alpha: 0.45),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(
              alpha: theme.brightness == Brightness.light ? 0.03 : 0.18,
            ),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Row(
              children: [
                AppIcon(name: app.name, iconUrl: app.iconUrl, size: 54),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              app.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.1,
                                fontSize: 15,
                              ),
                            ),
                          ),
                          if (app.pinned) ...[
                            const SizedBox(width: 4),
                            Icon(
                              Icons.push_pin_rounded,
                              size: 13,
                              color: scheme.tertiary,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        app.summary.isEmpty ? '暂无简介' : app.summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Row(
                        children: [
                          _TypeBadge(isAndroid: app.isAndroid),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              metaParts.isEmpty
                                  ? '未发布'
                                  : metaParts.join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${app.downloadCount} 次下载',
                            maxLines: 1,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: scheme.primary.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    '查看',
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: scheme.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 应用类型徽标。
class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.isAndroid});

  final bool isAndroid;

  @override
  Widget build(BuildContext context) {
    final color = isAndroid ? const Color(0xFF059669) : const Color(0xFF0284C7);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        isAndroid ? 'Android' : '网页',
        maxLines: 1,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
