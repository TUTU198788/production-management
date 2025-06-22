@echo off
chcp 65001 >nul
echo 🌐 启动局域网生产管理系统服务器
echo ========================================
echo.

REM 获取本机IP地址
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    goto :found_ip
)
:found_ip
set "ip=%ip: =%"

echo 📍 本机IP地址: %ip%
echo 🌐 团队访问地址: http://%ip%:8080
echo.
echo 📋 使用说明:
echo   1. 保持此窗口打开
echo   2. 团队成员在浏览器中访问上述地址
echo   3. 支持手机、平板、电脑访问
echo   4. 按 Ctrl+C 停止服务器
echo.
echo 🚀 正在启动服务器...
echo.

REM 尝试不同的Python版本启动服务器
python -m http.server 8080 2>nul || (
    python3 -m http.server 8080 2>nul || (
        echo ❌ 未找到Python，请安装Python后重试
        echo 📥 下载地址: https://www.python.org/downloads/
        echo.
        pause
        exit /b 1
    )
)
