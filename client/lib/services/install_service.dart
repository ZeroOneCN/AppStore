import 'package:flutter/services.dart';

/// 原生安装与包信息桥接。
///
/// 通过 Kotlin 侧 MethodChannel 完成 APK 安装（FileProvider）、未知来源权限检查、
/// 已安装版本读取与链接跳转，避免引入额外插件依赖。
class InstallService {
  InstallService._();

  /// 全局单例。
  static final InstallService instance = InstallService._();

  static const MethodChannel _channel = MethodChannel('com.appstore.client/installer');

  /// 是否已获得「安装未知应用」权限。
  Future<bool> canInstallPackages() async {
    try {
      return await _channel.invokeMethod<bool>('canInstallPackages') ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  /// 打开系统的「安装未知应用」授权页。
  Future<void> openInstallSettings() async {
    try {
      await _channel.invokeMethod<void>('openInstallSettings');
    } on PlatformException {
      // 部分系统不支持该设置页，忽略即可
    } on MissingPluginException {
      // 非 Android 环境忽略
    }
  }

  /// 调起系统安装程序安装指定 APK。
  ///
  /// 返回 `true` 表示已成功拉起安装界面。
  Future<bool> installApk(String path) async {
    try {
      return await _channel.invokeMethod<bool>('installApk', {'path': path}) ?? false;
    } on PlatformException catch (error) {
      throw Exception(error.message ?? '无法调起安装程序');
    } on MissingPluginException {
      throw Exception('当前环境不支持 APK 安装');
    }
  }

  /// 查询多个包名的已安装版本号，未安装的包不会出现在结果中。
  Future<Map<String, int>> installedVersionCodes(List<String> packages) async {
    if (packages.isEmpty) return const {};
    try {
      final result = await _channel.invokeMethod<Map<dynamic, dynamic>>(
        'getInstalledVersionCodes',
        {'packages': packages},
      );
      if (result == null) return const {};
      return result.map((key, value) => MapEntry('$key', (value as num).toInt()));
    } on PlatformException {
      return const {};
    } on MissingPluginException {
      return const {};
    }
  }

  /// 使用系统浏览器打开链接。
  Future<bool> openUrl(String url) async {
    try {
      return await _channel.invokeMethod<bool>('openUrl', {'url': url}) ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
