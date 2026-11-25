# 自家应用接入更新示例

本文说明如何让已有的 Android 应用（原生 Kotlin 或 Flutter）只接入「更新检查 + 下载 + 安装」三项能力，不依赖后台发布流程。

## 1. 接口约定

```http
GET /api/update/check?packageName=com.example.notes&versionCode=12
```

```json
{
  "hasUpdate": true,
  "forceUpdate": false,
  "reason": null,
  "latest": {
    "versionName": "1.3.0",
    "versionCode": 13,
    "changelog": "新增暗色模式",
    "fileSize": 18350080,
    "sha256": "9f2c...64位十六进制",
    "minSdk": 24,
    "downloadUrl": "http://192.168.1.10:3000/api/download/ckx?exp=1764...&sig=...",
    "publishedAt": "2026-11-25T08:00:00.000Z"
  }
}
```

规则：

- 应用不存在或未发布版本时返回 `200` 且 `hasUpdate=false`、`reason="NOT_FOUND"`，客户端不要当错误反复重试。
- `forceUpdate=true` 表示必须更新（版本被标记强制，或当前版本低于 `minSupportedVersionCode`）。
- `downloadUrl` 为 10 分钟有效的签名链接；下载前才请求，不要长期缓存。
- 批量检测多个应用时，请求间隔建议 ≥ 300 ms。
- 下载支持 `Range` 断点续传；校验 `sha256` 与 `fileSize` 后再安装。
- 未发布/未公开的应用不会出现在结果中。

## 2. Kotlin 最小示例

### 2.1 检查更新

```kotlin
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * 查询当前应用是否有新版本。
 * @param context 上下文
 * @param baseUrl 商店基地址，如 http://192.168.1.10:3000
 * @param onResult 回调：最新版本信息，无更新时为 null
 */
fun checkUpdate(context: Context, baseUrl: String, onResult: (JSONObject?) -> Unit) {
    Thread {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode.toInt()
        } else {
            @Suppress("DEPRECATION") info.versionCode
        }
        val url = URL("$baseUrl/api/update/check?packageName=${context.packageName}&versionCode=$versionCode")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 10_000
        }
        val body = connection.inputStream.bufferedReader().use { it.readText() }
        val json = JSONObject(body)
        val latest = if (json.optBoolean("hasUpdate")) json.optJSONObject("latest") else null
        onResult(latest)
        connection.disconnect()
    }.start()
}
```

### 2.2 下载与安装

```kotlin
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment

/**
 * 使用系统 DownloadManager 下载 APK。
 * @return DownloadManager 任务 ID，可用于监听完成广播
 */
fun downloadApk(context: Context, url: String, fileName: String): Long {
    val request = DownloadManager.Request(Uri.parse(url))
        .setTitle(fileName)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
    return (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
}
```

下载完成后用 `FileProvider` 把文件交给系统安装器（需在 Manifest 声明 `REQUEST_INSTALL_PACKAGES` 与 provider）：

```kotlin
/**
 * 调起系统安装器。
 * @param apk FileProvider 可访问的 APK 文件
 */
fun installApk(context: Context, apk: java.io.File) {
    val uri = androidx.core.content.FileProvider.getUriForFile(
        context, "${context.packageName}.fileprovider", apk,
    )
    val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/vnd.android.package-archive")
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
}
```

Android 8.0+ 还需引导用户开启「安装未知应用」：用 `PackageManager.canRequestPackageInstalls()` 判断，未授权时跳转 `Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES`。

## 3. Flutter 最小示例

```dart
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

/// 检查更新并返回最新版本信息（无更新返回 null）。
Future<Map<String, dynamic>?> checkUpdate(String baseUrl) async {
  final info = await PackageInfo.fromPlatform();
  final code = int.tryParse(info.buildNumber) ?? 0;
  final response = await Dio().get<Map<String, dynamic>>(
    '$baseUrl/api/update/check',
    queryParameters: {'packageName': info.packageName, 'versionCode': code},
  );
  final data = response.data!;
  return data['hasUpdate'] == true ? data['latest'] as Map<String, dynamic> : null;
}

/// 下载并校验 APK，返回本地路径；校验失败抛出异常并删除文件。
Future<String> downloadApk(Map<String, dynamic> latest) async {
  final dir = Directory('${(await getApplicationSupportDirectory()).path}/downloads');
  await dir.create(recursive: true);
  final file = File('${dir.path}/${latest['versionCode']}.apk');

  await Dio().download(latest['downloadUrl'] as String, file.path);
  // 生产实现应支持 Range 续传，并在此校验长度与 SHA-256
  final digest = sha256.convert(await file.readAsBytes()).toString();
  if (digest != latest['sha256']) {
    await file.delete();
    throw StateError('安装包校验失败');
  }
  return file.path;
}
```

安装通过 MethodChannel 调用原生 `ACTION_VIEW + FileProvider`；完整实现（断点续传、权限引导、进度回调）可直接参考本仓库 [client/lib/services](file:///c:/Code/AppStore/client/lib/services)。

## 4. 常见坑

| 问题 | 处理 |
|---|---|
| 客户端拿到的下载地址是 `localhost` | 服务端 `BASE_URL` 必须是对设备可达的地址；客户端也可把绝对地址的主机重写为当前基地址 |
| 下载 410 | 签名链接过期，重新调用更新检查获取新链接 |
| 安装失败 `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 新 APK 必须与已安装应用使用同一签名 |
| 国产 ROM 提示风险/备案 | MIUI 等需手动「继续安装」；个人内网分发属预期行为 |
| 更新检测频繁请求 | 启动检测一次 + 手动刷新，批量检测间隔 ≥ 300 ms |
