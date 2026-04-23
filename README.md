# f-tools

一些自用的纯前端小工具，单文件、零依赖、双击就能跑。

在线访问：<https://hnl1.github.io/f-tools/>

| 工具 | 说明 |
| --- | --- |
| [剪切板链接管理器](clipboard.html) | 名称 + URL 一键复制为富文本 / Markdown |
| [视频对比](video-compare.html) | 拖入多个视频并排播放，支持同步控制 |
| [图片对比](image-compare.html) | 多图平铺，鼠标移动同步放大相同区域 |
| [PDF 对比](pdf-compare.html) | 多个 PDF 横向平铺，上下滚动时同步 |

## 本地使用

直接浏览器打开对应 html 文件即可。如果某些 API（如剪切板）需要安全上下文，用任意静态服务器：

```bash
python3 -m http.server 8000
```
