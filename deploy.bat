@echo off
chcp 65001 >nul
echo 🚀 梯桁筋与组合肋生产管理系统 - 快速部署脚本
echo ==================================================
echo.

echo 请选择部署方案：
echo 1. 本地网络部署（推荐）
echo 2. 生成部署包
echo 3. 查看部署指南

set /p choice="请输入选项 (1-3): "

if "%choice%"=="1" (
    echo.
    echo 🔄 启动本地网络服务器...
    
    REM 获取本机IP
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        set "ip=%%a"
        goto :found_ip
    )
    :found_ip
    set "ip=%ip: =%"
    
    echo 本地IP地址: %ip%
    echo 团队成员可通过以下地址访问：
    echo http://%ip%:3000
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    
    REM 尝试启动Python服务器
    python -m http.server 3000 2>nul || (
        python3 -m http.server 3000 2>nul || (
            echo ❌ 未找到 Python，请安装 Python
            echo 下载地址: https://www.python.org/downloads/
            pause
            exit /b 1
        )
    )
) else if "%choice%"=="2" (
    echo.
    echo 🔄 生成部署包...
    
    REM 创建部署包（需要7zip或WinRAR）
    if exist "C:\Program Files\7-Zip\7z.exe" (
        "C:\Program Files\7-Zip\7z.exe" a -tzip production-system-deploy.zip * -x!.git -x!node_modules -x!*.bat -x!*.sh
        echo ✅ 部署包已创建: production-system-deploy.zip
    ) else (
        echo ❌ 未找到7-Zip，请手动创建ZIP文件
        echo 包含所有文件，排除 .git 和 node_modules 文件夹
    )
    
    echo 可以将此文件上传到任何静态网站托管服务
) else if "%choice%"=="3" (
    echo.
    echo 📖 部署指南
    echo ============
    echo.
    echo 🌐 在线部署（推荐）：
    echo 1. Vercel: https://vercel.com
    echo    - 注册账号，导入项目，自动部署
    echo.
    echo 2. Netlify: https://netlify.com
    echo    - 拖拽项目文件夹到网站进行部署
    echo.
    echo 3. GitHub Pages:
    echo    - 上传到GitHub仓库，启用Pages功能
    echo.
    echo 🏠 本地部署：
    echo 1. 运行此脚本选择选项1
    echo 2. 或手动运行: python -m http.server 3000
    echo.
    echo 📱 移动端访问：
    echo - 系统支持手机和平板访问
    echo - 可添加到主屏幕使用
) else (
    echo ❌ 无效选项
    exit /b 1
)

echo.
echo 🎉 部署脚本执行完成！
pause
