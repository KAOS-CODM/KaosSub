#!/bin/bash

echo "🌳 KaosSub Project Structure"
echo "=========================================="

echo ""
echo "📁 BACKEND:"
find backend -type f -name "*.js" -o -name "*.json" -o -name "*.js1" -o -name ".env" | grep -v node_modules | sort | sed 's/^/  /'

echo ""
echo "📁 FRONTEND:"
find frontend -type f \( -name "*.html" -o -name "*.css" -o -name "*.html1" -o -name "*.js" -o -name "*.js1" \) | grep -v node_modules | sort | sed 's/^/  /'

echo ""
echo "📁 ASSETS:"
find frontend/assets -type f 2>/dev/null | head -20 | sed 's/^/  /'

echo ""
echo "📊 Summary:"
echo "  Backend files: $(find backend -type f -name "*.js" -o -name "*.json" | grep -v node_modules | wc -l)"
echo "  Frontend HTML: $(find frontend -name "*.html" | grep -v node_modules | wc -l)"
echo "  Frontend JS:   $(find frontend -name "*.js" | grep -v node_modules | wc -l)"
echo "  CSS files:     $(find frontend -name "*.css" | grep -v node_modules | wc -l)"
