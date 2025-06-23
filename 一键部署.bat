@echo off
chcp 65001 >nul
title 生产管理系统 - 一键部署工具

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    梯桁筋与组合肋生产管理系统                    ║
echo ║                        一键部署工具                          ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

echo 🎯 选择部署方式：
echo.
echo   1. 启动HTTP服务器（推荐）
echo   2. 生成NAS部署包
echo   3. 查看部署指南
echo   4. 测试系统功能
echo   5. 退出
echo.

set /p choice="请输入选项 (1-5): "

if "%choice%"=="1" goto :start_server
if "%choice%"=="2" goto :create_nas_package
if "%choice%"=="3" goto :show_guide
if "%choice%"=="4" goto :test_system
if "%choice%"=="5" goto :exit
goto :invalid_choice

:start_server
echo.
echo 🚀 启动HTTP服务器...
echo ==================
echo.

REM 获取本机IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    goto :found_ip
)
:found_ip
set "ip=%ip: =%"

echo 📍 服务器信息:
echo   - 本机IP: %ip%
echo   - 端口: 8080
echo   - 访问地址: http://%ip%:8080
echo.
echo 📋 团队使用说明:
echo   1. 确保所有设备连接同一WiFi/局域网
echo   2. 在浏览器中访问: http://%ip%:8080
echo   3. 支持电脑、手机、平板访问
echo   4. 保持此窗口打开，关闭即停止服务
echo.
echo 🌐 正在启动服务器，请稍候...
echo.

python -m http.server 8080 2>nul || (
    python3 -m http.server 8080 2>nul || (
        echo ❌ 启动失败：未找到Python
        echo.
        echo 📥 解决方案：
        echo   1. 下载安装Python: https://www.python.org/downloads/
        echo   2. 安装时勾选"Add Python to PATH"
        echo   3. 重启电脑后重试
        echo.
        pause
        goto :menu
    )
)
goto :menu

:create_nas_package
echo.
echo 📦 生成NAS部署包...
echo ==================
echo.

if exist "生产管理系统-NAS部署包.zip" del "生产管理系统-NAS部署包.zip"

REM 检查是否有7zip
if exist "C:\Program Files\7-Zip\7z.exe" (
    "C:\Program Files\7-Zip\7z.exe" a -tzip "生产管理系统-NAS部署包.zip" * -x!*.bat -x!*.zip -x!.git -x!node_modules
    echo ✅ NAS部署包已生成: 生产管理系统-NAS部署包.zip
) else (
    echo ❌ 未找到7-Zip，请手动创建ZIP文件
    echo.
    echo 📋 手动打包步骤：
    echo   1. 选择所有文件和文件夹
    echo   2. 排除: *.bat, *.zip, .git, node_modules
    echo   3. 压缩为ZIP格式
    echo   4. 上传到NAS的Web目录
)

echo.
echo 📋 NAS部署步骤：
echo   1. 将ZIP文件解压到NAS的Web目录
echo   2. 群晖NAS: /volume1/web/
echo   3. 威联通NAS: /share/Web/
echo   4. 访问: http://NAS-IP/文件夹名/
echo.
pause
goto :menu

:show_guide
echo.
echo 📖 部署指南
echo ==========
echo.
echo 🌐 方案1: HTTP服务器部署
echo   - 运行此工具选择选项1
echo   - 或双击 start-server.bat
echo   - 团队通过显示的IP地址访问
echo.
echo 🏠 方案2: NAS部署
echo   - 群晖: 启用Web Station，文件放入/volume1/web/
echo   - 威联通: 启用Web服务器，文件放入/share/Web/
echo   - 访问: http://NAS-IP/项目文件夹/
echo.
echo 📱 使用说明:
echo   - 支持电脑、手机、平板访问
echo   - 数据存储在各自浏览器中
echo   - 通过Excel导入导出共享数据
echo   - 建议定期备份数据
echo.
echo 🔧 故障排除:
echo   - 无法访问: 检查防火墙和网络
echo   - 页面异常: 清除浏览器缓存
echo   - 数据丢失: 使用Excel导入恢复
echo.
pause
goto :menu

:test_system
echo.
echo 🧪 测试系统功能...
echo ==================
echo.

REM 检查关键文件
set "missing_files="

if not exist "index.html" set "missing_files=%missing_files% index.html"
if not exist "styles\main.css" set "missing_files=%missing_files% styles\main.css"
if not exist "scripts\data-management.js" set "missing_files=%missing_files% scripts\data-management.js"

if "%missing_files%"=="" (
    echo ✅ 核心文件检查通过
) else (
    echo ❌ 缺少文件:%missing_files%
)

REM 检查Python
python --version >nul 2>&1 && (
    echo ✅ Python环境正常
) || (
    python3 --version >nul 2>&1 && (
        echo ✅ Python3环境正常
    ) || (
        echo ❌ Python环境未安装
    )
)

REM 检查网络
ping -n 1 127.0.0.1 >nul 2>&1 && (
    echo ✅ 本地网络正常
) || (
    echo ❌ 本地网络异常
)

echo.
echo 📊 系统信息:
echo   - 操作系统: %OS%
echo   - 当前目录: %CD%
echo   - 文件数量: 
dir /b | find /c /v "" 2>nul

echo.
pause
goto :menu

:invalid_choice
echo.
echo ❌ 无效选项，请重新选择
echo.
pause

:menu
cls
goto :start

:exit
echo.
echo 👋 感谢使用生产管理系统部署工具！
echo.
pause
exit
