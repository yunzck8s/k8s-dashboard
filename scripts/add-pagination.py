#!/usr/bin/env python3
"""
批量为资源列表页面添加分页功能
"""

import re
import sys
from pathlib import Path

def add_pagination_to_file(file_path: Path, resource_name: str, resource_var: str):
    """为单个文件添加分页逻辑"""

    print(f"处理文件: {file_path}")

    # 读取文件内容
    content = file_path.read_text(encoding='utf-8')

    # 检查是否已经有分页
    if 'Pagination' in content or 'currentPage' in content:
        print(f"  ⏭️  跳过 - 已有分页")
        return False

    # 1. 添加 imports
    import_pattern = r"(import.*from\s+['\"]react['\"];)"
    if 'useState' not in content:
        content = re.sub(
            import_pattern,
            r"import { useState, useEffect } from 'react';",
            content
        )
    elif 'useEffect' not in content:
        content = re.sub(
            r"(import\s+\{[^}]*)\}\s+from\s+['\"]react['\"];",
            r"\1, useEffect } from 'react';",
            content
        )

    # 添加 Pagination 组件导入
    pagination_import = "import Pagination from '../../../components/common/Pagination';"
    if resource_name == 'Nodes':
        pagination_import = "import Pagination from '../../components/common/Pagination';"

    type_import_pattern = r"(import.*from\s+['\"].*types['\"];)"
    content = re.sub(
        type_import_pattern,
        f"\\1\n{pagination_import}",
        content
    )

    # 2. 在组件函数开头添加状态变量
    component_pattern = rf"(export default function {resource_name}\(\)\s*\{{)"
    state_vars = """
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
"""

    # 检查是否有 namespace
    has_namespace = 'currentNamespace' in content
    if has_namespace:
        state_vars += """
  // 命名空间变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [currentNamespace]);
"""

    content = re.sub(component_pattern, f"\\1{state_vars}", content)

    # 3. 在获取数据后添加分页逻辑
    items_pattern = rf"(const {resource_var} = data\?\.items \?\? \[\];)"
    pagination_logic = f"""\\1

  // 分页逻辑
  const totalItems = {resource_var}.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const current{resource_name} = {resource_var}.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {{
    setCurrentPage(page);
  }};

  const handlePageSizeChange = (size: number) => {{
    setPageSize(size);
    setCurrentPage(1);
  }};
"""
    content = re.sub(items_pattern, pagination_logic, content)

    # 4. 更新 map 函数使用分页后的数据
    map_pattern = rf"\{{{resource_var}\.map\("
    content = re.sub(map_pattern, f"{{current{resource_name}.map(", content)

    # 5. 在最后的 </div> 前添加 Pagination 组件
    end_pattern = r"(\s*</div>\s*</div>\s*\);\s*\})"
    pagination_component = """
      {/* 分页 */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}"""
    content = re.sub(end_pattern, pagination_component, content)

    # 写回文件
    file_path.write_text(content, encoding='utf-8')
    print(f"  ✅ 完成")
    return True

def main():
    # 定义需要处理的文件
    frontend_dir = Path(__file__).parent.parent / 'frontend' / 'src' / 'pages'

    files_to_process = [
        (frontend_dir / 'network/services/Services.tsx', 'Services', 'services'),
        (frontend_dir / 'workloads/statefulsets/StatefulSets.tsx', 'StatefulSets', 'statefulSets'),
        (frontend_dir / 'workloads/daemonsets/DaemonSets.tsx', 'DaemonSets', 'daemonSets'),
        (frontend_dir / 'workloads/jobs/Jobs.tsx', 'Jobs', 'jobs'),
        (frontend_dir / 'workloads/jobs/CronJobs.tsx', 'CronJobs', 'cronJobs'),
        (frontend_dir / 'network/ingresses/Ingresses.tsx', 'Ingresses', 'ingresses'),
        (frontend_dir / 'config/configmaps/ConfigMaps.tsx', 'ConfigMaps', 'configMaps'),
        (frontend_dir / 'config/secrets/Secrets.tsx', 'Secrets', 'secrets'),
    ]

    print("=" * 60)
    print("批量添加分页功能")
    print("=" * 60)
    print()

    success_count = 0
    skip_count = 0
    error_count = 0

    for file_path, resource_name, resource_var in files_to_process:
        if not file_path.exists():
            print(f"⚠️  文件不存在: {file_path}")
            error_count += 1
            continue

        try:
            if add_pagination_to_file(file_path, resource_name, resource_var):
                success_count += 1
            else:
                skip_count += 1
        except Exception as e:
            print(f"  ❌ 错误: {e}")
            error_count += 1

    print()
    print("=" * 60)
    print(f"处理完成: {success_count} 成功, {skip_count} 跳过, {error_count} 错误")
    print("=" * 60)

if __name__ == '__main__':
    main()
