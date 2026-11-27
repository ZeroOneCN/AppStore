import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/app_config.dart';
import 'install_service.dart';

/// 安装统计上报：记录待上报任务，在下次启动确认安装成功后上报。
///
/// 拉起系统安装器时无法得知用户是否真正完成安装，因此先写入本地待上报队列；
/// 下次启动时对比已安装版本，确认版本号达到目标后再调用服务端接口。
class AnalyticsService {
  AnalyticsService._();

  /// 全局单例。
  static final AnalyticsService instance = AnalyticsService._();

  /// 待上报队列的本地存储键。
  static const String _pendingKey = 'pending_install_reports';

  /// 记录一次待确认的安装，同包名只保留最新一条。
  Future<void> recordPendingInstall({
    required String packageName,
    required int versionCode,
    required bool isUpdate,
  }) async {
    if (packageName.isEmpty || versionCode <= 0) return;
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_pendingKey) ?? <String>[];

    list.removeWhere((raw) {
      try {
        final item = jsonDecode(raw) as Map<String, dynamic>;
        return item['packageName'] == packageName;
      } catch (_) {
        return true;
      }
    });

    list.add(
      jsonEncode({
        'packageName': packageName,
        'versionCode': versionCode,
        'isUpdate': isUpdate,
      }),
    );
    await prefs.setStringList(_pendingKey, list);
  }

  /// 启动时检查待上报队列，确认已安装后上报并从队列移除。
  Future<void> flushPendingInstalls() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_pendingKey) ?? <String>[];
    if (list.isEmpty) return;

    final pending = <Map<String, dynamic>>[];
    for (final raw in list) {
      try {
        pending.add(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        // 损坏的记录直接丢弃
      }
    }
    if (pending.isEmpty) {
      await prefs.remove(_pendingKey);
      return;
    }

    final packages = pending
        .map((item) => item['packageName'] as String)
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();
    final installed = await InstallService.instance.installedVersionCodes(packages);

    final remaining = <String>[];
    for (final item in pending) {
      final packageName = item['packageName'] as String? ?? '';
      final versionCode = (item['versionCode'] as num?)?.toInt() ?? 0;
      final installedCode = installed[packageName];

      // 尚未安装或版本低于目标，保留到下次启动继续确认
      if (installedCode == null || installedCode < versionCode) {
        remaining.add(jsonEncode(item));
        continue;
      }

      final reported = await _postInstall(
        packageName: packageName,
        versionCode: versionCode,
        isUpdate: item['isUpdate'] == true,
      );
      if (!reported) remaining.add(jsonEncode(item));
    }

    await prefs.setStringList(_pendingKey, remaining);
  }

  /// 调用服务端安装上报接口，网络异常时返回 false 以便下次重试。
  Future<bool> _postInstall({
    required String packageName,
    required int versionCode,
    required bool isUpdate,
  }) async {
    try {
      final dio = Dio(
        BaseOptions(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 8),
        ),
      );
      final response = await dio.postUri(
        AppConfig.instance.resolve('/api/analytics/install'),
        data: {
          'packageName': packageName,
          'versionCode': versionCode,
          'installType': isUpdate ? 'update' : 'install',
          'osVersion': Platform.operatingSystemVersion,
        },
      );
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
