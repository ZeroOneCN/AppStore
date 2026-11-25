import '../core/api_client.dart';
import '../core/api_exception.dart';
import 'models.dart';

/// 公开应用接口仓库。
class AppRepository {
  AppRepository._();

  /// 全局单例。
  static final AppRepository instance = AppRepository._();

  /// 查询公开应用列表。
  ///
  /// [type] 可取 ANDROID / WEB，[sort] 可取 recent / name / downloads。
  Future<List<AppSummary>> listApps({
    String? q,
    String? type,
    String? category,
    String? tag,
    String? sort,
  }) async {
    final data = await ApiClient.instance.getJson(
      '/api/public/apps',
      query: {
        if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
        if (type != null && type.isNotEmpty) 'type': type,
        if (category != null && category.isNotEmpty) 'category': category,
        if (tag != null && tag.isNotEmpty) 'tag': tag,
        if (sort != null && sort.isNotEmpty) 'sort': sort,
      },
    );

    if (data is! Map<String, dynamic>) {
      throw const ApiException('应用列表返回格式异常');
    }
    final items = data['items'];
    if (items is! List) return const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(AppSummary.fromJson)
        .toList(growable: false);
  }

  /// 按访问标识查询应用详情。
  Future<AppDetail> getApp(String slug) async {
    final data = await ApiClient.instance.getJson('/api/public/apps/$slug');
    if (data is! Map<String, dynamic>) {
      throw const ApiException('应用详情返回格式异常');
    }
    return AppDetail.fromJson(data);
  }

  /// 获取某个版本的签名下载地址。
  ///
  /// 返回的地址可能是服务端的绝对地址，下载前需经 AppConfig.resolve 重写主机。
  Future<String> downloadTicket(String releaseId) async {
    final data = await ApiClient.instance.getJson('/api/public/releases/$releaseId/download-ticket');
    if (data is! Map<String, dynamic>) {
      throw const ApiException('下载票据返回格式异常');
    }
    final url = data['url'];
    if (url is! String || url.isEmpty) {
      throw const ApiException('下载票据缺少地址');
    }
    return url;
  }
}
