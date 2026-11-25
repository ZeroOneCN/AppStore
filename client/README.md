# 应用商店 Android 客户端

个人自建应用商店的 Flutter 客户端，支持应用浏览、搜索筛选、断点续传下载、SHA-256 校验、安装引导与更新检测。

## 运行

```bash
flutter pub get
flutter run --dart-define=APPSTORE_BASE_URL=http://10.0.2.2:3000
```

Android 模拟器访问宿主机使用 `10.0.2.2`；真机调试时在「设置」页填写局域网地址（如 `http://192.168.1.10:3000`）。

## 校验

```bash
flutter analyze
flutter test
flutter build apk --debug
```
