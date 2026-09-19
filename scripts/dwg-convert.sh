#!/usr/bin/env bash
# ==============================================================================
# 本地 2D CAD DWG 零授权费转换适配器 (GNU LibreDWG)
# 
# 原理：基于开源自由软件 GNU LibreDWG (GPLv3+) 的 `dwg2dxf` 工具，
# 将专有 DWG 转换为标准的 ASCII DXF，供前端 Web CAD 查看器纯本地浏览。
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

show_help() {
    cat << EOF
使用方法:
  ./scripts/dwg-convert.sh <输入文件.dwg> [输出文件.dxf]

说明:
  将 AutoCAD DWG 格式图纸转换为标准 DXF 格式，供本地 CAD 查看器打开。
  使用 100% 自由开源的 GNU LibreDWG (GPLv3+)，零商业授权费。

示例:
  ./scripts/dwg-convert.sh drawing.dwg
  ./scripts/dwg-convert.sh project.dwg /tmp/project.dxf
EOF
}

if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

INPUT_FILE="$1"

if [[ ! -f "$INPUT_FILE" ]]; then
    echo -e "${RED}错误: 找不到输入文件 '$INPUT_FILE'${NC}" >&2
    exit 1
fi

# 探测 dwg2dxf 命令行路径
DWG2DXF_BIN=""
if command -v dwg2dxf >/dev/null 2>&1; then
    DWG2DXF_BIN="$(command -v dwg2dxf)"
elif [[ -x "/opt/homebrew/bin/dwg2dxf" ]]; then
    DWG2DXF_BIN="/opt/homebrew/bin/dwg2dxf"
elif [[ -x "/usr/local/bin/dwg2dxf" ]]; then
    DWG2DXF_BIN="/usr/local/bin/dwg2dxf"
fi

if [[ -z "$DWG2DXF_BIN" ]]; then
    echo -e "${YELLOW}======================================================${NC}"
    echo -e "${RED}未检测到 GNU LibreDWG 工具 (dwg2dxf)${NC}"
    echo -e "${YELLOW}======================================================${NC}"
    echo -e "GNU LibreDWG 是纯开源、零授权费的 DWG 读取工具。"
    echo -e "在 macOS 上请通过 Homebrew 进行一键安装："
    echo ""
    echo -e "    ${CYAN}brew install libredwg${NC}"
    echo ""
    echo -e "安装完成后即可直接运行此脚本进行转换。"
    exit 2
fi

# 确定输出路径
BASENAME=$(basename "$INPUT_FILE" .dwg)
if [[ $# -ge 2 ]]; then
    OUTPUT_FILE="$2"
else
    CACHE_DIR="/tmp/cad-viewer"
    mkdir -p "$CACHE_DIR"
    OUTPUT_FILE="${CACHE_DIR}/${BASENAME}.dxf"
fi

echo -e "${CYAN}正在调用 LibreDWG 转换: ${INPUT_FILE} -> ${OUTPUT_FILE}...${NC}"

# 调用 dwg2dxf 执行转换 (-y 允许覆盖)
"$DWG2DXF_BIN" -y -o "$OUTPUT_FILE" "$INPUT_FILE"

if [[ -f "$OUTPUT_FILE" ]]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}✓ 转换成功! 生成 DXF 大小: ${FILE_SIZE}${NC}"
    echo -e "输出路径: ${CYAN}${OUTPUT_FILE}${NC}"
    echo -e "使用方式: 将该文件直接拖入浏览器 CAD Viewer 界面即可查看。"
else
    echo -e "${RED}转换失败: 未生成输出文件。${NC}" >&2
    exit 1
fi
