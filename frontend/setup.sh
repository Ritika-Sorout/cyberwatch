#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
#  CyberWatch — One-Command Setup
#  Usage: bash setup.sh
# ═══════════════════════════════════════════════════════

set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ██████╗██╗   ██╗██████╗ ███████╗██████╗ "
echo " ██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██╔══██╗"
echo " ██║      ╚████╔╝ ██████╔╝█████╗  ██████╔╝"
echo " ██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██╗"
echo " ╚██████╗   ██║   ██████╔╝███████╗██║  ██║"
echo "  ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "${CYAN}CyberWatch SOC Platform — Setup${NC}"
echo "────────────────────────────────"

# Check node
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}Node.js not found. Install from https://nodejs.org${NC}"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo -e "${YELLOW}Node 18+ required. Current: $(node -v)${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node $(node -v) detected${NC}"

# Install deps
echo "→ Installing dependencies..."
npm install

echo ""
echo -e "${GREEN}════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ CyberWatch is ready!${NC}"
echo -e "${GREEN}════════════════════════════════${NC}"
echo ""
echo "  Start dev server:   npm run dev"
echo "  Build for deploy:   npm run build"
echo "  Preview build:      npm run preview"
echo ""
echo -e "  Then open: ${CYAN}http://localhost:5173${NC}"
echo ""
