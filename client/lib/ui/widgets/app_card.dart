import 'package:flutter/material.dart';

import '../../data/models.dart';
import 'app_icon.dart';

/// 应用墙卡片：图标、名称、简介、版本与下载量。
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
    final version = app.currentVersion;

    return Material(
      color: theme.colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppIcon(name: app.name, iconUrl: app.iconUrl, size: 44),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                app.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
                            if (app.pinned) ...[
                              const SizedBox(width: 4),
                              Icon(Icons.push_pin_rounded, size: 14, color: theme.colorScheme.tertiary),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          app.summary,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const Spacer(),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _TypeBadge(isAndroid: app.isAndroid),
                  Text(
                    version != null ? 'v${version.versionName}' : '未发布',
                    style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.outline),
                  ),
                  Text(
                    '${app.downloadCount} 次下载',
                    style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.outline),
                  ),
                ],
              ),
            ],
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
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
