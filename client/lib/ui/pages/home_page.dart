import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api_exception.dart';
import '../../core/app_config.dart';
import '../../data/app_repository.dart';
import '../../data/models.dart';
import '../widgets/app_card.dart';
import '../widgets/state_views.dart';
import 'app_detail_page.dart';

/// 应用墙首页：搜索、类型/分类筛选、排序与自适应网格。
class HomePage extends StatefulWidget {
  /// 创建首页。
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  List<AppSummary> _apps = const [];
  List<String> _categories = const [];
  bool _loading = true;
  String? _error;
  String _type = '';
  String _category = '';
  String _sort = 'recent';

  @override
  void initState() {
    super.initState();
    AppConfig.instance.addListener(_onConfigChanged);
    _load();
  }

  @override
  void dispose() {
    AppConfig.instance.removeListener(_onConfigChanged);
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  /// 基地址变更后重新加载应用列表。
  void _onConfigChanged() {
    if (mounted) _load();
  }

  /// 拉取应用列表，首次加载时同时收集分类选项。
  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final apps = await AppRepository.instance.listApps(
        q: _searchController.text,
        type: _type.isEmpty ? null : _type,
        category: _category.isEmpty ? null : _category,
        sort: _sort,
      );

      List<String>? categories;
      if (_categories.isEmpty) {
        final all = await AppRepository.instance.listApps();
        categories = all.map((item) => item.category).where((item) => item.isNotEmpty).toSet().toList()
          ..sort();
      }

      if (!mounted) return;
      setState(() {
        _apps = apps;
        _loading = false;
        if (categories != null) _categories = categories;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '加载失败：$error';
      });
    }
  }

  /// 搜索输入防抖，350 毫秒后发起请求。
  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('应用商店'),
        actions: [
          PopupMenuButton<String>(
            initialValue: _sort,
            icon: const Icon(Icons.sort_rounded),
            tooltip: '排序方式',
            onSelected: (value) {
              setState(() => _sort = value);
              _load();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'recent', child: Text('最近更新')),
              PopupMenuItem(value: 'name', child: Text('按名称')),
              PopupMenuItem(value: 'downloads', child: Text('下载最多')),
            ],
          ),
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: '刷新',
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: '搜索应用名称或简介',
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
                filled: true,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          _ChipRow(
            children: [
              _FilterChip(
                label: '全部',
                selected: _type.isEmpty,
                onSelected: () {
                  setState(() => _type = '');
                  _load();
                },
              ),
              _FilterChip(
                label: 'Android',
                selected: _type == 'ANDROID',
                onSelected: () {
                  setState(() => _type = _type == 'ANDROID' ? '' : 'ANDROID');
                  _load();
                },
              ),
              _FilterChip(
                label: '网页',
                selected: _type == 'WEB',
                onSelected: () {
                  setState(() => _type = _type == 'WEB' ? '' : 'WEB');
                  _load();
                },
              ),
            ],
          ),
          if (_categories.isNotEmpty)
            _ChipRow(
              children: [
                _FilterChip(
                  label: '全部分类',
                  selected: _category.isEmpty,
                  onSelected: () {
                    setState(() => _category = '');
                    _load();
                  },
                ),
                ..._categories.map(
                  (category) => _FilterChip(
                    label: category,
                    selected: _category == category,
                    onSelected: () {
                      setState(() => _category = _category == category ? '' : category);
                      _load();
                    },
                  ),
                ),
              ],
            ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          Expanded(child: _buildContent(theme)),
        ],
      ),
    );
  }

  /// 根据加载状态、错误与数据量构建主体区域。
  Widget _buildContent(ThemeData theme) {
    if (_loading && _apps.isEmpty) {
      return const LoadingView(message: '正在加载应用…');
    }
    if (_error != null && _apps.isEmpty) {
      return ErrorRetryView(message: _error!, onRetry: _load);
    }
    if (_apps.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: SizedBox(
              height: constraints.maxHeight,
              child: EmptyView(
                title: '没有找到应用',
                subtitle: _searchController.text.isEmpty ? '等待管理员发布应用' : '试试更换关键词或筛选条件',
                icon: Icons.search_off_rounded,
              ),
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = (constraints.maxWidth ~/ 170).clamp(2, 5);
          final textScale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6);
          final extent = 172.0 * textScale;

          return GridView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              mainAxisExtent: extent,
            ),
            itemCount: _apps.length,
            itemBuilder: (context, index) {
              final app = _apps[index];
              return AppWallCard(
                app: app,
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => AppDetailPage(slug: app.slug, initialName: app.name),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

/// 横向滚动的筛选行。
class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: children.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) => Center(child: children[index]),
      ),
    );
  }
}

/// 紧凑的筛选标签。
class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onSelected});

  final String label;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(),
      labelStyle: const TextStyle(fontSize: 12),
      visualDensity: VisualDensity.compact,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}
