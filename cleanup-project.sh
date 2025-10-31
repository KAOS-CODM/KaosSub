#!/bin/bash

echo "🧹 Starting Project Cleanup..."
echo "=========================================="

# Files to KEEP (essential)
ESSENTIAL_FILES=(
    "backend/server.js"
    "backend/package.json"
    "backend/.env"
    "backend/config/supabase.js"
    "backend/routes/"
    "backend/middleware/auth.js"
    "frontend/index.html"
    "frontend/dashboard.html"
    "frontend/data-plans.html"
    "frontend/history.html"
    "frontend/profile-settings.html"
    "frontend/login.html"
    "frontend/signup.html"
    "frontend/css/styles.css"
    "frontend/js/utils.js"
    "frontend/js/app.js"
    "frontend/assets/"
    "frontend/js/components/"
)

# Files to REMOVE (temporary/debug files)
FILES_TO_REMOVE=(
    # Test and debug files
    "backend/test-*.js"
    "backend/debug-*.js"
    "backend/*-test.js"
    "backend/*-debug.js"
    "backend/check-*.js"
    "backend/final-*.js"
    "backend/simple-*.js"
    "backend/minimal-*.js"
    "backend/quick-*.js"
    
    # Temporary route files
    "backend/routes/test-*.js"
    "backend/routes/*-temp.js"
    
    # Backup files
    "backend/*.backup"
    "backend/*.old"
    "backend/*.bak"
    "frontend/*.backup"
    "frontend/*.old"
    "frontend/*.bak"
    
    # Debug HTML files
    "frontend/debug-*.html"
    "frontend/test-*.html"
    "frontend/*-debug.html"
    "frontend/*-test.html"
    "frontend/*-enhanced.html"
    "frontend/fixed-*.html"
    "frontend/proper-*.html"
    "frontend/simple-*.html"
    "frontend/detailed-*.html"
    "frontend/compare-*.html"
    "frontend/token-*.html"
    
    # Temporary JS files
    "frontend/js/*-fixed.js"
    "frontend/js/*-temp.js"
    "frontend/js/*-backup.js"
    "frontend/js/*-unified.js"
    "frontend/js/auth-utils.js"
    
    # Log files
    "backend/*.log"
    "*.log"
)

echo "📋 Files to be removed:"
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -e "$file" ]; then
        echo "  ❌ $file"
    fi
done

echo ""
echo "📋 Essential files (will be kept):"
for file in "${ESSENTIAL_FILES[@]}"; do
    if [ -e "$file" ]; then
        echo "  ✅ $file"
    fi
done

echo ""
read -p "🚀 Proceed with cleanup? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️ Removing unnecessary files..."
    
    # Remove files
    for pattern in "${FILES_TO_REMOVE[@]}"; do
        find . -name "$(basename "$pattern")" -type f -delete 2>/dev/null
    done
    
    # Remove empty directories
    find . -type d -empty -delete 2>/dev/null
    
    echo "✅ Cleanup completed!"
    
    echo ""
    echo "📁 Final Project Structure:"
    tree -a -I 'node_modules|.git' 2>/dev/null || find . -type f | grep -v node_modules | grep -v .git | sort
else
    echo "❌ Cleanup cancelled."
fi
