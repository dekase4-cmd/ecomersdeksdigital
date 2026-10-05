#!/bin/bash
# ==============================================
# SCRIPT STARTER - DEKSDIGITAL E-COMMERCE
# ==============================================

PROJECT_DIR="/home/deka/projek ecomers deksdigital"
NODE_BIN="/home/deka/node-local/bin/node"

echo ""
echo "  ██████╗ ███████╗██╗  ██╗███████╗"
echo "  ██╔══██╗██╔════╝██║ ██╔╝██╔════╝"
echo "  ██║  ██║█████╗  █████╔╝ ███████╗"
echo "  ██║  ██║██╔══╝  ██╔═██╗ ╚════██║"
echo "  ██████╔╝███████╗██║  ██╗███████║"
echo "  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝"
echo "  DEKSDIGITAL E-COMMERCE PLATFORM"
echo ""
echo "============================================="

# Hentikan proses server sebelumnya jika ada
pkill -f "node server.js" 2>/dev/null
sleep 1

cd "$PROJECT_DIR"

echo " Memulai server..."
echo " Buka browser dan kunjungi:"
echo ""
echo "   🛒 Toko Utama  : http://localhost:3000"
echo "   🤝 Kemitraan   : http://localhost:3000/kemitraan.html"
echo "   🛡️  Admin Panel : http://localhost:3000/admin-dashboard/login.html"
echo "   🏪 Mitra Panel : http://localhost:3000/mitra-dashboard/login.html"
echo ""
echo " Login Admin Default:"
echo "   Username : admin"
echo "   Password : admin123"
echo ""
echo "============================================="
echo ""

$NODE_BIN server.js
