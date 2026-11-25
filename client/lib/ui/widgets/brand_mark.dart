import 'package:flutter/material.dart';

/// 品牌标志：与应用图标同源的 Logo 图片，按尺寸等比展示。
class BrandMark extends StatelessWidget {
  /// 创建品牌标志。
  const BrandMark({super.key, this.size = 28});

  /// 显示边长。
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.26),
      child: Image.asset(
        'assets/brand/logo.png',
        width: size,
        height: size,
        filterQuality: FilterQuality.high,
        semanticLabel: '应用商店标志',
      ),
    );
  }
}
