#!/bin/bash
# Demo 构建脚本（精简版 - 仅保留必需文件）

set -e

echo "🎭 开始构建 Demo 版本..."

# 构建（Vite base 配置已经处理了 /AnyNote/ 路径）
VITE_DEMO_MODE=true pnpm build

echo "🧹 清理冗余的 PWA 文件..."
# 删除 PWA 相关的图标文件（Demo 不需要 PWA 功能）
rm -f dist/apple-touch-icon-180.png
rm -f dist/icon-192.png
rm -f dist/icon-512.png
rm -f dist/manifest.json
# 删除 logo.svg（Demo 不需要，页面中用文字替代）
rm -f dist/logo.svg

echo "📝 移除 index.html 中的冗余引用..."
# 使用 sed 移除 PWA 相关的 HTML 标签
sed -i '' '/<link rel="manifest"/d' dist/index.html
sed -i '' '/<meta name="theme-color"/d' dist/index.html
sed -i '' '/<meta name="apple-mobile-web-app-capable"/d' dist/index.html
sed -i '' '/<meta name="apple-mobile-web-app-status-bar-style"/d' dist/index.html
sed -i '' '/<meta name="apple-mobile-web-app-title"/d' dist/index.html
sed -i '' '/<link rel="apple-touch-icon"/d' dist/index.html
sed -i '' '/<meta name="mobile-web-app-capable"/d' dist/index.html
sed -i '' '/<!-- PWA 配置 -->/d' dist/index.html
sed -i '' '/<!-- iOS Safari 专用 -->/d' dist/index.html
sed -i '' '/<!-- 其他移动浏览器 -->/d' dist/index.html

# 移除冗余的 logo.svg favicon 引用
sed -i '' '/<link rel="icon" type="image\/svg+xml" href=".*logo\.svg"/d' dist/index.html

echo "🔧 替换 JS 中的 logo.svg 引用为纯文字..."
# 在打包后的 JS 文件中，将 logo.svg 替换为空字符串（图片会加载失败，但不影响文字显示）
find dist/assets -name "*.js" -type f -exec sed -i '' 's/logo\.svg/LOGO_REMOVED/g' {} \;

echo "📊 保留的文件："
echo "  ✅ favicon.ico (浏览器标签页图标)"
echo "  ✅ index.html + assets/ (页面资源)"

echo "❌ 删除的文件（节省 92KB）："
echo "  ❌ apple-touch-icon-180.png (11KB)"
echo "  ❌ icon-192.png (12KB)"
echo "  ❌ icon-512.png (47KB)"
echo "  ❌ logo.svg (11KB) - 改为纯文字显示"
echo "  ❌ manifest.json (<1KB)"

echo ""
echo "✅ Demo 构建完成！"
echo "📦 输出目录：dist/"
echo ""
echo "🚀 部署到 GitHub Pages："
echo "   npx gh-pages -d dist -r https://github.com/aydomini/AnyNote.git"
