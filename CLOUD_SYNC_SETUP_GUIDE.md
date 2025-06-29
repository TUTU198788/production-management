# 🌐 云端同步配置指南

## 🎯 永久免费多用户协作方案

您的系统现在支持**永久免费**的云端同步功能，让多个同事可以实时共享生产数据！

## 📋 配置步骤

### 第一步：创建GitHub账号（如果没有）
1. 访问 [GitHub.com](https://github.com)
2. 点击"Sign up"注册账号
3. 验证邮箱完成注册

### 第二步：创建数据存储仓库
1. 登录GitHub后，点击右上角"+"号
2. 选择"New repository"
3. 仓库名建议：`production-data`
4. 设置为**Public**（公开仓库，永久免费）
5. 勾选"Add a README file"
6. 点击"Create repository"

### 第三步：获取访问令牌（可选，用于写入数据）
1. 点击GitHub右上角头像 → Settings
2. 左侧菜单最下方点击"Developer settings"
3. 点击"Personal access tokens" → "Tokens (classic)"
4. 点击"Generate new token" → "Generate new token (classic)"
5. 填写说明：`生产管理系统数据同步`
6. 选择权限：勾选**repo**（完整仓库访问权限）
7. 点击"Generate token"
8. **重要**：复制生成的token（以ghp_开头），保存好，只显示一次！

### 第四步：在系统中配置
1. 打开生产管理系统
2. 点击右上角"云端同步"按钮
3. 填写配置信息：
   - **GitHub用户名**：您的GitHub用户名
   - **数据仓库名**：刚创建的仓库名（如：production-data）
   - **GitHub Token**：刚获取的访问令牌（可选）
4. 点击"测试连接"确认配置正确
5. 点击"保存配置"

## 🚀 使用方法

### 自动同步
- 配置完成后，系统每30秒自动同步一次
- 任何数据变更都会自动上传到云端
- 多个用户的数据会自动合并

### 手动同步
- 点击"立即同步"按钮手动触发同步
- 适用于重要数据变更后立即同步

### 同步状态
- 🟢 **已连接**：正常同步中
- 🟡 **离线**：网络断开，数据保存在本地
- 🔴 **未配置**：需要配置GitHub信息

## 👥 多用户协作

### 数据共享
1. **第一个用户**配置好云端同步
2. **其他用户**使用相同的GitHub用户名和仓库名配置
3. 所有用户的数据会自动同步和合并

### 冲突处理
- 系统自动合并不同用户的数据
- 相同记录以最新修改时间为准
- 不会丢失任何数据

### 权限说明
- **有Token**：可以读取和写入数据
- **无Token**：只能读取数据，无法上传修改

## 💡 最佳实践

### 团队协作建议
1. **指定管理员**：一人负责配置和管理GitHub仓库
2. **统一配置**：所有人使用相同的仓库信息
3. **定期备份**：定期导出数据作为备份

### 安全建议
1. **Token保密**：不要分享GitHub Token
2. **仓库权限**：可以设置仓库为私有（需要付费）
3. **定期检查**：定期检查同步状态

## 🔧 故障排除

### 常见问题

**Q: 提示"仓库不存在"**
A: 检查GitHub用户名和仓库名是否正确，或者仓库是否为私有

**Q: 同步失败**
A: 检查网络连接，确认GitHub Token权限正确

**Q: 数据不一致**
A: 点击"立即同步"手动同步，或刷新页面重新加载

**Q: Token过期**
A: 重新生成GitHub Token并更新配置

### 技术支持
如遇到问题，可以：
1. 检查浏览器控制台错误信息
2. 确认GitHub服务状态
3. 重新配置云端同步

## 📊 数据安全

### 数据存储
- 数据以JSON格式存储在GitHub仓库
- 支持版本历史，可以查看数据变更记录
- GitHub提供99.9%的可用性保证

### 隐私保护
- 公开仓库：任何人都可以查看数据
- 私有仓库：只有授权用户可以访问（需要付费）
- 建议敏感数据使用私有仓库

## 🎉 完成配置

配置完成后，您的系统将支持：
- ✅ 多用户实时协作
- ✅ 数据自动同步
- ✅ 永久免费使用
- ✅ 数据安全备份
- ✅ 版本历史记录

现在您可以邀请同事使用相同的配置信息，开始协作管理生产数据了！

---

**提示**：如果您不需要多用户协作，也可以不配置云端同步，系统会继续使用本地存储模式。
