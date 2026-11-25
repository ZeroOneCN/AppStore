import '../core/api_client.dart';
import '../core/api_exception.dart';
import 'models.dart';

/// 更新检查接口仓库。
class UpdateRepository {
  UpdateRepository._();

  /// 全局单例。
  static final UpdateRepository instance = UpdateRepository._();

  /// 按包名与已安装版本号检查更新。
  ///
  /// 应用不存在时接口仍返回 200 与 `hasUpdate=false`，由 [UpdateCheck.reason] 标记。
  Future<UpdateCheck> check(String packageName, int versionCode) async {
    final data = await ApiClient.instance.getJson(
      '/api/update/check',
      query: {
        'packageName': packageName,
        'versionCode': '$versionCode',
      },
    );
    if (data is! Map<String, dynamic>) {
      throw const ApiException('更新检查返回格式异常');
    }
    return UpdateCheck.fromJson(data);
  }
}
