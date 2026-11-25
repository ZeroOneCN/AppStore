import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'app_config.dart';

/// JSON 接口客户端：统一基地址、超时、GET 重试与错误文案。
class ApiClient {
  ApiClient._();

  /// 全局单例。
  static final ApiClient instance = ApiClient._();

  static const Duration _connectTimeout = Duration(seconds: 10);
  static const Duration _receiveTimeout = Duration(seconds: 20);
  static const int _maxRetries = 2;

  final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: _connectTimeout,
      receiveTimeout: _receiveTimeout,
      responseType: ResponseType.json,
    ),
  );

  /// 发起 GET 请求并返回解码后的 JSON 数据。
  ///
  /// 仅对连接失败与超时自动重试，最多重试 [maxRetries] 次；业务错误直接抛出
  /// [ApiException]，其文案优先取服务端返回的 `error.message`。
  Future<dynamic> getJson(
    String path, {
    Map<String, String>? query,
    int maxRetries = _maxRetries,
  }) async {
    final base = AppConfig.instance.resolve(path);
    final uri = (query == null || query.isEmpty)
        ? base
        : base.replace(queryParameters: {...base.queryParameters, ...query});

    DioException? lastError;
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        final response = await _dio.getUri<dynamic>(uri);
        return response.data;
      } on DioException catch (error) {
        lastError = error;
        final retryable = _isRetryable(error);
        if (!retryable || attempt == maxRetries) break;
        await Future<void>.delayed(Duration(milliseconds: 600 * (attempt + 1)));
      }
    }

    throw ApiException(_messageOf(lastError), statusCode: lastError?.response?.statusCode);
  }

  /// 判断错误是否适合自动重试（仅网络层问题，不重试 4xx/5xx 业务响应）。
  bool _isRetryable(DioException error) {
    if (error.response != null) return false;
    return error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.unknown;
  }

  /// 将 Dio 异常转换为用户可读文案。
  String _messageOf(DioException? error) {
    if (error == null) return '请求失败，请稍后重试';

    final data = error.response?.data;
    if (data is Map && data['error'] is Map) {
      final message = (data['error'] as Map)['message'];
      if (message is String && message.trim().isNotEmpty) return message;
    }

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return '请求超时，请检查网络后重试';
      case DioExceptionType.connectionError:
        return '无法连接服务器，请检查基地址与网络';
      case DioExceptionType.cancel:
        return '请求已取消';
      default:
        final status = error.response?.statusCode;
        return status == null ? '网络异常，请稍后重试' : '请求失败（HTTP $status）';
    }
  }
}
