/// 版本摘要，用于应用卡片与历史版本列表。
class VersionSummary {
  /// 创建版本摘要。
  const VersionSummary({
    required this.versionName,
    required this.versionCode,
    required this.changelog,
    required this.fileSize,
    required this.sha256,
    this.minSdk,
    this.publishedAt,
  });

  /// 从接口 JSON 解析版本摘要。
  factory VersionSummary.fromJson(Map<String, dynamic> json) {
    return VersionSummary(
      versionName: json['versionName'] as String? ?? '',
      versionCode: (json['versionCode'] as num?)?.toInt() ?? 0,
      changelog: json['changelog'] as String? ?? '',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      sha256: json['sha256'] as String? ?? '',
      minSdk: (json['minSdk'] as num?)?.toInt(),
      publishedAt: json['publishedAt'] as String?,
    );
  }

  /// 版本名，如 1.0.0。
  final String versionName;

  /// 版本号（versionCode）。
  final int versionCode;

  /// 该版本的更新日志。
  final String changelog;

  /// 安装包大小（字节）。
  final int fileSize;

  /// 安装包 SHA-256。
  final String sha256;

  /// 最低 Android API。
  final int? minSdk;

  /// 发布时间（ISO 字符串）。
  final String? publishedAt;
}

/// 应用归属开发者。
class AppDeveloper {
  /// 创建开发者信息。
  const AppDeveloper({
    required this.id,
    required this.username,
    required this.displayName,
  });

  /// 从接口 JSON 解析开发者信息。
  factory AppDeveloper.fromJson(Map<String, dynamic> json) {
    return AppDeveloper(
      id: json['id'] as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
    );
  }

  /// 开发者 ID。
  final String id;

  /// 登录用户名。
  final String username;

  /// 显示名称，可为空。
  final String displayName;

  /// 展示用名称：优先显示名称加用户名，未填写显示名称时仅展示用户名。
  String get label =>
      displayName.isEmpty ? '@$username' : '$displayName @$username';
}

/// 应用卡片数据。
class AppSummary {
  /// 创建应用卡片。
  const AppSummary({
    required this.id,
    required this.slug,
    required this.name,
    required this.summary,
    required this.type,
    required this.category,
    required this.tags,
    required this.iconUrl,
    this.packageName,
    this.developer,
    required this.pinned,
    required this.downloadCount,
    required this.updatedAt,
    required this.currentVersion,
  });

  /// 从接口 JSON 解析应用卡片。
  factory AppSummary.fromJson(Map<String, dynamic> json) {
    final version = json['currentVersion'];
    final developer = json['developer'];
    return AppSummary(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      type: json['type'] as String? ?? 'ANDROID',
      category: json['category'] as String? ?? '',
      tags: (json['tags'] as List?)?.whereType<String>().toList(growable: false) ?? const [],
      iconUrl: json['iconUrl'] as String?,
      packageName: json['packageName'] as String?,
      developer: developer is Map<String, dynamic>
          ? AppDeveloper.fromJson(developer)
          : null,
      pinned: json['pinned'] as bool? ?? false,
      downloadCount: (json['downloadCount'] as num?)?.toInt() ?? 0,
      updatedAt: json['updatedAt'] as String?,
      currentVersion: version is Map<String, dynamic> ? VersionSummary.fromJson(version) : null,
    );
  }

  /// 应用 ID。
  final String id;

  /// 访问标识。
  final String slug;

  /// 应用名称。
  final String name;

  /// 一句话简介。
  final String summary;

  /// 类型：ANDROID / WEB。
  final String type;

  /// 分类。
  final String category;

  /// 标签。
  final List<String> tags;

  /// 图标相对地址。
  final String? iconUrl;

  /// Android 包名，用于更新检测；网页作品为 null。
  final String? packageName;

  /// 归属开发者，未指派时为 null（平台官方）。
  final AppDeveloper? developer;

  /// 是否置顶。
  final bool pinned;

  /// 下载次数。
  final int downloadCount;

  /// 最近更新时间（ISO 字符串）。
  final String? updatedAt;

  /// 当前版本摘要。
  final VersionSummary? currentVersion;

  /// 是否为 Android 应用。
  bool get isAndroid => type == 'ANDROID';
}

/// 单个可下载版本。
class ReleaseInfo {
  /// 创建版本信息。
  const ReleaseInfo({
    required this.id,
    required this.versionName,
    required this.versionCode,
    required this.changelog,
    required this.fileSize,
    required this.sha256,
    required this.downloadUrl,
    this.minSdk,
    this.minSupportedVersionCode,
    this.forceUpdate = false,
    this.publishedAt,
  });

  /// 从接口 JSON 解析版本信息。
  factory ReleaseInfo.fromJson(Map<String, dynamic> json) {
    return ReleaseInfo(
      id: json['id'] as String? ?? '',
      versionName: json['versionName'] as String? ?? '',
      versionCode: (json['versionCode'] as num?)?.toInt() ?? 0,
      changelog: json['changelog'] as String? ?? '',
      fileSize: (json['fileSize'] as num?)?.toInt() ?? 0,
      sha256: json['sha256'] as String? ?? '',
      downloadUrl: json['downloadUrl'] as String? ?? '',
      minSdk: (json['minSdk'] as num?)?.toInt(),
      minSupportedVersionCode: (json['minSupportedVersionCode'] as num?)?.toInt(),
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      publishedAt: json['publishedAt'] as String?,
    );
  }

  /// 版本 ID。
  final String id;

  /// 版本名。
  final String versionName;

  /// 版本号。
  final int versionCode;

  /// 更新日志。
  final String changelog;

  /// 文件字节数。
  final int fileSize;

  /// 安装包 SHA-256。
  final String sha256;

  /// 下载地址（可能为绝对地址，使用前需经 AppConfig.resolve 重写主机）。
  final String downloadUrl;

  /// 最低 Android API。
  final int? minSdk;

  /// 最低支持版本号。
  final int? minSupportedVersionCode;

  /// 是否强制更新。
  final bool forceUpdate;

  /// 发布时间（ISO 字符串）。
  final String? publishedAt;

  /// 复制并替换下载地址。
  ReleaseInfo copyWith({String? downloadUrl}) {
    return ReleaseInfo(
      id: id,
      versionName: versionName,
      versionCode: versionCode,
      changelog: changelog,
      fileSize: fileSize,
      sha256: sha256,
      downloadUrl: downloadUrl ?? this.downloadUrl,
      minSdk: minSdk,
      minSupportedVersionCode: minSupportedVersionCode,
      forceUpdate: forceUpdate,
      publishedAt: publishedAt,
    );
  }
}

/// 应用详情。
class AppDetail {
  /// 创建应用详情。
  const AppDetail({
    required this.app,
    required this.description,
    required this.screenshots,
    required this.webUrl,
    required this.packageName,
    required this.currentRelease,
    required this.releases,
  });

  /// 从接口 JSON 解析应用详情。
  factory AppDetail.fromJson(Map<String, dynamic> json) {
    final release = json['currentRelease'];
    return AppDetail(
      app: AppSummary.fromJson(json),
      description: json['description'] as String? ?? '',
      screenshots:
          (json['screenshots'] as List?)?.whereType<String>().toList(growable: false) ?? const [],
      webUrl: json['webUrl'] as String?,
      packageName: json['packageName'] as String?,
      currentRelease: release is Map<String, dynamic> ? ReleaseInfo.fromJson(release) : null,
      releases: (json['releases'] as List?)
              ?.whereType<Map<String, dynamic>>()
              .map(VersionSummary.fromJson)
              .toList(growable: false) ??
          const [],
    );
  }

  /// 基础卡片信息。
  final AppSummary app;

  /// 详细介绍。
  final String description;

  /// 截图相对地址列表。
  final List<String> screenshots;

  /// 网页作品访问链接。
  final String? webUrl;

  /// Android 包名。
  final String? packageName;

  /// 当前可下载版本。
  final ReleaseInfo? currentRelease;

  /// 已发布历史版本。
  final List<VersionSummary> releases;
}

/// 更新检查结果。
class UpdateCheck {
  /// 创建更新检查结果。
  const UpdateCheck({
    required this.hasUpdate,
    required this.forceUpdate,
    required this.reason,
    required this.latest,
  });

  /// 从接口 JSON 解析更新检查结果。
  factory UpdateCheck.fromJson(Map<String, dynamic> json) {
    final latest = json['latest'];
    return UpdateCheck(
      hasUpdate: json['hasUpdate'] as bool? ?? false,
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      reason: json['reason'] as String?,
      latest: latest is Map<String, dynamic> ? ReleaseInfo.fromJson(latest) : null,
    );
  }

  /// 是否有可用更新。
  final bool hasUpdate;

  /// 是否强制更新。
  final bool forceUpdate;

  /// 未找到应用时的原因标记。
  final String? reason;

  /// 最新版本信息。
  final ReleaseInfo? latest;
}

/// 待更新项，用于更新页展示。
class UpdateItem {
  /// 创建待更新项。
  const UpdateItem({
    required this.appName,
    required this.packageName,
    required this.installedVersionCode,
    required this.check,
    this.slug,
    this.iconUrl,
    this.isSelf = false,
  });

  /// 应用名称。
  final String appName;

  /// 包名。
  final String packageName;

  /// 已安装版本号。
  final int installedVersionCode;

  /// 更新检查结果。
  final UpdateCheck check;

  /// 应用访问标识。
  final String? slug;

  /// 图标相对地址。
  final String? iconUrl;

  /// 是否为商店自身。
  final bool isSelf;

  /// 最新版本。
  ReleaseInfo? get latest => check.latest;

  /// 是否强制更新。
  bool get forceUpdate => check.forceUpdate;
}
