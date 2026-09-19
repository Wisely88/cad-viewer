#!/usr/bin/env bash
# ==============================================================================
# 本地一键部署到 GitHub Pages 脚本
# 构建 dist 生产目录，并推送到远程仓库的 gh-pages 分支
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${CYAN}==> 1. 执行静态生产构建...${NC}"
npm run build

if [[ ! -d "dist" ]]; then
    echo -e "${RED}错误: 未找到 dist 目录${NC}" >&2
    exit 1
fi

GIT_CMD="/Library/Developer/CommandLineTools/usr/bin/git"
if ! command -v "$GIT_CMD" >/dev/null 2>&1; then
    GIT_CMD="git"
fi

# 检查是否存在远程仓库配置
if ! "$GIT_CMD" remote get-url origin >/dev/null 2>&1; then
    echo -e "${RED}提示: 当前仓库尚未配置远程 origin 仓库。${NC}"
    echo -e "请先在 GitHub 上创建仓库，然后关联远程地址："
    echo -e "    ${CYAN}git remote add origin https://github.com/<你的用户名>/cad-viewer.git${NC}"
    echo -e "    ${CYAN}git push -u origin main${NC}"
    exit 1
fi

REMOTE_URL="$("$GIT_CMD" remote get-url origin)"
echo -e "${CYAN}==> 2. 准备发布到远程: ${REMOTE_URL} (gh-pages 分支)...${NC}"

# 创建临时发布目录
TMP_DIR=$(mktemp -d)
cp -r dist/* "$TMP_DIR/"

cd "$TMP_DIR"
"$GIT_CMD" init
"$GIT_CMD" checkout -b gh-pages
"$GIT_CMD" add -A
"$GIT_CMD" commit -m "deploy: update CAD Viewer PWA to GitHub Pages"

echo -e "${CYAN}==> 3. 推送至 GitHub gh-pages 分支...${NC}"
"$GIT_CMD" push -f "$REMOTE_URL" gh-pages

rm -rf "$TMP_DIR"

echo -e "${GREEN}✓ 部署完成！${NC}"
echo -e "请确保在 GitHub 仓库的 [Settings -> Pages] 中，将 Source 设置为 [Deploy from a branch -> gh-pages / root]。"
echo -e "部署生效后，手机可通过 https 链接在任何地方随时访问并离线添加到桌面！"
