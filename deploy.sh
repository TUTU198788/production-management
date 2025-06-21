#!/bin/bash

# 生产管理系统一键部署脚本
# 支持 GitHub Pages + Firebase 实时同步

echo "🚀 生产管理系统一键部署脚本"
echo "=================================="

# 检查是否在 Git 仓库中
if [ ! -d ".git" ]; then
    echo "📁 初始化 Git 仓库..."
    git init
    git branch -M main
fi

# 检查是否有远程仓库
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❓ 请输入您的 GitHub 仓库地址："
    echo "   格式：https://github.com/用户名/仓库名.git"
    read -p "仓库地址: " repo_url
    
    if [ -n "$repo_url" ]; then
        git remote add origin "$repo_url"
        echo "✅ 已添加远程仓库: $repo_url"
    else
        echo "❌ 仓库地址不能为空"
        exit 1
    fi
fi

# 检查 Firebase 配置
if grep -q "YOUR_API_KEY" firebase-config.js; then
    echo ""
    echo "⚠️  Firebase 配置未完成"
    echo "   请先配置 firebase-config.js 文件中的 Firebase 项目信息"
    echo "   配置完成后再次运行此脚本"
    echo ""
    echo "📋 配置步骤："
    echo "   1. 访问 https://console.firebase.google.com/"
    echo "   2. 创建新项目或选择现有项目"
    echo "   3. 启用 Firestore Database"
    echo "   4. 获取 Web 应用配置信息"
    echo "   5. 替换 firebase-config.js 中的配置"
    echo ""
    read -p "是否已完成 Firebase 配置？(y/N): " firebase_ready
    
    if [ "$firebase_ready" != "y" ] && [ "$firebase_ready" != "Y" ]; then
        echo "请完成 Firebase 配置后再次运行部署脚本"
        exit 1
    fi
fi

# 添加所有文件到 Git
echo "📦 准备文件..."
git add .

# 检查是否有变更
if git diff --staged --quiet; then
    echo "ℹ️  没有新的变更需要提交"
else
    # 提交变更
    echo "💾 提交变更..."
    git commit -m "部署生产管理系统 - $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 推送到 GitHub
echo "🚀 推送到 GitHub..."
if git push origin main; then
    echo "✅ 代码推送成功"
else
    echo "❌ 推送失败，请检查网络连接和仓库权限"
    exit 1
fi

# 获取仓库信息
repo_url=$(git remote get-url origin)
if [[ $repo_url == *"github.com"* ]]; then
    # 提取用户名和仓库名
    repo_info=$(echo $repo_url | sed 's/.*github\.com[\/:]//; s/\.git$//')
    username=$(echo $repo_info | cut -d'/' -f1)
    reponame=$(echo $repo_info | cut -d'/' -f2)
    
    pages_url="https://${username}.github.io/${reponame}/"
    
    echo ""
    echo "🎉 部署完成！"
    echo "=================================="
    echo "📱 访问地址: $pages_url"
    echo "⏰ GitHub Pages 需要几分钟时间部署，请稍后访问"
    echo ""
    echo "🔧 后续步骤："
    echo "   1. 在 GitHub 仓库设置中启用 Pages（如未启用）"
    echo "   2. 访问上述地址测试系统功能"
    echo "   3. 多用户可同时访问实现实时协作"
    echo ""
    echo "📞 如遇问题，请检查："
    echo "   - GitHub Pages 是否已启用"
    echo "   - Firebase 配置是否正确"
    echo "   - 浏览器控制台是否有错误信息"
    echo ""
    
    # 询问是否打开浏览器
    read -p "是否现在打开浏览器查看部署结果？(y/N): " open_browser
    if [ "$open_browser" = "y" ] || [ "$open_browser" = "Y" ]; then
        if command -v open > /dev/null; then
            open "$pages_url"
        elif command -v xdg-open > /dev/null; then
            xdg-open "$pages_url"
        else
            echo "请手动打开浏览器访问: $pages_url"
        fi
    fi
else
    echo "✅ 代码已推送，请手动配置部署平台"
fi

echo ""
echo "🌟 感谢使用生产管理系统！"
