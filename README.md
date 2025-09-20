# 剪切板链接管理器

一个轻量级的剪切板链接管理工具，支持 Python 桌面版和 Web 版本。

## 🌟 功能特色

- **双向剪切板操作**：支持将格式化链接写入剪切板，也可以从剪切板读取链接
- **富文本支持**：同时复制 HTML 和纯文本格式，兼容各种应用
- **智能解析**：自动识别剪切板中的链接并填充表单

## 🚀 Web 版本（推荐）

### 快速开始

1. **通过本地服务器（推荐）**
    ```bash
    python3 -m http.server 8000
    # 然后访问 http://localhost:8000
    ```

2. **直接使用（需要每次都请求剪切板权限）**
    - 直接用浏览器打开 index.html 文件即可

3. **在线使用**
    - 访问在线版本

## 🖥️ Python 版本

### 安装依赖

```bash
# 安装项目依赖
uv sync
```

### 使用方法

1. **交互式输入**
   ```bash
   uv run copy_link_to_clipboard.py
   ```
   然后按提示输入链接名称和 URL

2. **命令行参数**
   ```bash
   uv run copy_link_to_clipboard.py "链接名称" "https://example.com"
   ```
