import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../core/api_exception.dart';
import '../core/app_config.dart';

/// APK 下载服务：支持断点续传、进度回调与 SHA-256 校验。
class DownloadService {
  DownloadService._();

  /// 全局单例。
  static final DownloadService instance = DownloadService._();

  static const Duration _connectTimeout = Duration(seconds: 15);
  static const Duration _receiveTimeout = Duration(minutes: 10);

  /// 下载安装包到应用私有目录。
  ///
  /// - 已存在部分文件时使用 `Range` 续传，服务端不支持时自动从头下载；
  /// - 完成后按 [expectedSize] 与 [expectedSha256] 校验，失败会删除文件并抛出
  ///   [ApiException]；
  /// - 通过 [onProgress] 回调已接收字节与总字节，总字节未知时传 0。
  ///
  /// 返回校验通过的本地文件。
  Future<File> download({
    required String url,
    required String fileKey,
    required int expectedSize,
    required String expectedSha256,
    required void Function(int received, int total) onProgress,
    CancelToken? cancelToken,
  }) async {
    final supportDir = await getApplicationSupportDirectory();
    final dir = Directory('${supportDir.path}/downloads');
    await dir.create(recursive: true);

    final safeKey = fileKey.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${dir.path}/$safeKey.apk');

    var existing = await file.exists() ? await file.length() : 0;
    // 已完整下载过的文件直接校验，避免重复流量
    if (existing > 0 && expectedSize > 0 && existing >= expectedSize) {
      if (await _matchesSha256(file, expectedSha256)) {
        onProgress(expectedSize, expectedSize);
        return file;
      }
      await file.delete();
      existing = 0;
    }

    final dio = Dio(
      BaseOptions(
        connectTimeout: _connectTimeout,
        receiveTimeout: _receiveTimeout,
      ),
    );

    final uri = AppConfig.instance.resolve(url);
    final response = await dio.getUri<ResponseBody>(
      uri,
      options: Options(
        responseType: ResponseType.stream,
        headers: existing > 0 ? {'Range': 'bytes=$existing-'} : null,
        validateStatus: (status) => status != null && status < 500,
      ),
      cancelToken: cancelToken,
    );

    final status = response.statusCode ?? 0;
    if (status == 416) {
      // 续传位置无效，清理后由用户重试
      if (await file.exists()) await file.delete();
      throw const ApiException('续传位置已失效，请重新下载');
    }
    if (status == 410) {
      throw const ApiException('下载链接已过期，请重试');
    }
    if (status >= 400) {
      throw ApiException('下载失败（HTTP $status）');
    }

    final body = response.data;
    if (body == null) throw const ApiException('下载响应为空');

    final contentLength =
        int.tryParse(response.headers.value(Headers.contentLengthHeader) ?? '') ?? 0;
    var received = existing;
    var total = contentLength;
    if (status == 200) {
      // 服务端忽略了 Range，需要从头写入
      received = 0;
      total = contentLength;
    } else if (status == 206) {
      total = existing + contentLength;
    }

    final append = status == 206 && existing > 0;
    final raf = await file.open(mode: append ? FileMode.append : FileMode.write);
    try {
      await for (final chunk in body.stream) {
        raf.writeFromSync(chunk);
        received += chunk.length;
        onProgress(received, total > 0 ? total : expectedSize);
      }
    } finally {
      await raf.close();
    }

    final length = await file.length();
    if (expectedSize > 0 && length != expectedSize) {
      await file.delete();
      throw ApiException('下载不完整（$length/$expectedSize 字节），请重试');
    }
    if (!await _matchesSha256(file, expectedSha256)) {
      await file.delete();
      throw const ApiException('SHA-256 校验失败，安装包已删除');
    }

    return file;
  }

  /// 计算文件 SHA-256 并与期望值比较，期望值为空时视为通过。
  Future<bool> _matchesSha256(File file, String expected) async {
    if (expected.trim().isEmpty) return true;
    final digest = await sha256.bind(file.openRead()).first;
    return digest.toString().toLowerCase() == expected.trim().toLowerCase();
  }
}
