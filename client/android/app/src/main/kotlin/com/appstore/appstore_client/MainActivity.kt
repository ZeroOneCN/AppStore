package com.appstore.appstore_client

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * 主 Activity：通过 MethodChannel 向 Flutter 提供 APK 安装、未知来源权限、
 * 已安装版本查询与链接跳转能力，避免引入额外的第三方插件。
 */
class MainActivity : FlutterActivity() {
    private companion object {
        /** 与 Dart 侧 InstallService 保持一致的通道名。 */
        const val CHANNEL_NAME = "com.appstore.client/installer"
    }

    /**
     * 注册原生方法通道。
     * @param flutterEngine Flutter 引擎实例
     */
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL_NAME)
            .setMethodCallHandler { call, result ->
                try {
                    when (call.method) {
                        "canInstallPackages" -> result.success(canInstallPackages())
                        "openInstallSettings" -> {
                            openInstallSettings()
                            result.success(null)
                        }
                        "installApk" -> {
                            val path = call.argument<String>("path")
                            if (path.isNullOrBlank()) {
                                result.error("INVALID_PATH", "安装包路径为空", null)
                            } else {
                                installApk(path)
                                result.success(true)
                            }
                        }
                        "getInstalledVersionCodes" -> {
                            val packages = call.argument<List<String>>("packages") ?: emptyList()
                            result.success(installedVersionCodes(packages))
                        }
                        "openUrl" -> {
                            val url = call.argument<String>("url")
                            if (url.isNullOrBlank()) {
                                result.success(false)
                            } else {
                                result.success(openUrl(url))
                            }
                        }
                        else -> result.notImplemented()
                    }
                } catch (error: Exception) {
                    result.error("INSTALL_FAILED", error.message ?: "操作失败", null)
                }
            }
    }

    /**
     * 判断当前应用是否被允许安装未知来源应用。
     * Android 8.0 以下默认允许。
     * @return 是否已获得安装权限
     */
    private fun canInstallPackages(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    /**
     * 跳转到本应用的「安装未知应用」授权页。
     */
    private fun openInstallSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:$packageName"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }

    /**
     * 通过 FileProvider 将私有目录中的 APK 交给系统安装程序。
     * @param path APK 绝对路径
     */
    private fun installApk(path: String) {
        val file = File(path)
        if (!file.exists()) throw IllegalStateException("安装包不存在：$path")

        val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
    }

    /**
     * 批量查询已安装应用的版本号（Android 9 起使用 longVersionCode）。
     * @param packages 包名列表
     * @return 包名到 versionCode 的映射，未安装的包不会出现在结果中
     */
    private fun installedVersionCodes(packages: List<String>): Map<String, Int> {
        val result = mutableMapOf<String, Int>()
        for (name in packages) {
            try {
                val info = packageManager.getPackageInfo(name, 0)
                val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    info.longVersionCode.toInt()
                } else {
                    @Suppress("DEPRECATION")
                    info.versionCode
                }
                result[name] = code
            } catch (_: PackageManager.NameNotFoundException) {
                // 包未安装时跳过
            }
        }
        return result
    }

    /**
     * 使用系统浏览器打开 http/https 链接。
     * @param url 目标链接
     * @return 是否成功调起
     */
    private fun openUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        if (uri.scheme != "http" && uri.scheme != "https") return false
        val intent = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
        return true
    }
}
