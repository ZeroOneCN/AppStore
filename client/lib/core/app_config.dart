import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 全局配置：应用仓库服务端基地址，支持编译期默认值与运行时修改。
class AppConfig extends ChangeNotifier {
  AppConfig._();

  /// 全局单例。
  static final AppConfig instance = AppConfig._();

  /// 本地存储键名。
  static const String _prefsKey = 'appstore_base_url';

  /// 编译期默认地址，可通过 `--dart-define=APPSTORE_BASE_URL=...` 覆盖。
  static const String _compileTimeBaseUrl = String.fromEnvironment(
    'APPSTORE_BASE_URL',
    defaultValue: 'https://apps.01iot.top',
  );

  /// 旧版本内置的本地调试地址；升级后若本地仍保存这些地址，自动改用新的云服务地址。
  static const Set<String> _legacyDefaults = {
    'http://10.0.2.2:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  };

  String _baseUrl = _compileTimeBaseUrl;
  bool _loaded = false;

  /// 当前生效的基地址（不带结尾斜杠）。
  String get baseUrl => _baseUrl;

  /// 配置是否已完成本地读取。
  bool get loaded => _loaded;

  /// 从本地存储加载用户保存的基地址。
  ///
  /// 读取失败时保留编译期默认值，不阻塞应用启动。
  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefsKey);
      if (saved != null && saved.trim().isNotEmpty) {
        final normalized = _normalize(saved);
        if (_legacyDefaults.contains(normalized)) {
          // 旧版本保存的模拟器/本机地址已失效，写回新的默认云服务地址
          await prefs.setString(_prefsKey, _compileTimeBaseUrl);
        } else {
          _baseUrl = normalized;
        }
      }
    } catch (_) {
      // 本地存储不可用时使用编译期默认地址
    }
    _loaded = true;
    notifyListeners();
  }

  /// 校验并保存新的基地址。
  ///
  /// 返回 `true` 表示已生效并写入本地存储；地址格式不合法时返回 `false`。
  Future<bool> save(String value) async {
    final normalized = _normalize(value);
    if (!isValid(normalized)) return false;

    _baseUrl = normalized;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, normalized);
    } catch (_) {
      // 存储失败不影响本次会话使用
    }
    return true;
  }

  /// 判断地址是否为合法的 http/https 基地址。
  static bool isValid(String value) {
    final uri = Uri.tryParse(value);
    if (uri == null) return false;
    return (uri.scheme == 'http' || uri.scheme == 'https') && uri.host.isNotEmpty;
  }

  /// 规范化输入：补全协议、去掉结尾斜杠。
  static String _normalize(String value) {
    var text = value.trim();
    if (text.isEmpty) return _compileTimeBaseUrl;
    if (!text.contains('://')) text = 'http://$text';
    while (text.endsWith('/')) {
      text = text.substring(0, text.length - 1);
    }
    return text;
  }

  /// 将站内相对路径或服务端返回的绝对地址转换为当前基地址下的完整地址。
  ///
  /// 服务端签名下载地址可能基于部署时的 BASE_URL，客户端必须替换主机部分，
  /// 只保留路径与查询参数，以适配内网或模拟器访问。
  Uri resolve(String raw) {
    final text = raw.trim();
    if (text.isEmpty) return Uri.parse('$_baseUrl/');
    if (text.startsWith('/')) return Uri.parse('$_baseUrl$text');

    final parsed = Uri.tryParse(text);
    if (parsed == null) return Uri.parse('$_baseUrl/$text');
    if (!parsed.hasScheme) return Uri.parse('$_baseUrl/${text.startsWith('/') ? text.substring(1) : text}');

    final path = parsed.path.isEmpty ? '/' : parsed.path;
    final query = parsed.hasQuery ? '?${parsed.query}' : '';
    return Uri.parse('$_baseUrl$path$query');
  }
}
