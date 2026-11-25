/// 统一的接口异常，携带可展示文案与可选 HTTP 状态码。
class ApiException implements Exception {
  /// 创建接口异常。
  const ApiException(this.message, {this.statusCode});

  /// 面向用户的错误文案。
  final String message;

  /// HTTP 状态码，网络层错误时为空。
  final int? statusCode;

  @override
  String toString() => message;
}
