import 'package:appstore_client/core/app_config.dart';
import 'package:appstore_client/core/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

/// 单元测试：格式化工具与基地址解析。
void main() {
  group('formatBytes', () {
    test('按单位换算并保留一位小数', () {
      expect(formatBytes(0), '0 B');
      expect(formatBytes(-1), '0 B');
      expect(formatBytes(512), '512 B');
      expect(formatBytes(1024), '1.0 KB');
      expect(formatBytes(1536), '1.5 KB');
      expect(formatBytes(1024 * 1024), '1.0 MB');
    });
  });

  group('formatPercent', () {
    test('按总量换算百分比', () {
      expect(formatPercent(0, 0), '—');
      expect(formatPercent(50, 100), '50%');
      expect(formatPercent(200, 100), '100%');
    });
  });

  group('AppConfig', () {
    test('仅接受 http/https 地址', () {
      expect(AppConfig.isValid('http://192.168.1.10:3000'), isTrue);
      expect(AppConfig.isValid('https://store.example.com'), isTrue);
      expect(AppConfig.isValid('ftp://example.com'), isFalse);
      expect(AppConfig.isValid('随便写点什么'), isFalse);
    });

    test('相对路径拼接到当前基地址', () {
      final uri = AppConfig.instance.resolve('/api/public/apps?q=包裹');
      expect(uri.path, '/api/public/apps');
      expect(uri.queryParameters['q'], '包裹');
      expect(uri.host, Uri.parse(AppConfig.instance.baseUrl).host);
    });

    test('绝对地址重写为当前基地址主机', () {
      final uri = AppConfig.instance.resolve('http://localhost:3000/api/download/abc?sig=1');
      expect(uri.path, '/api/download/abc');
      expect(uri.query, 'sig=1');
      expect(uri.host, Uri.parse(AppConfig.instance.baseUrl).host);
    });
  });
}
