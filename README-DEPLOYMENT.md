# 梯桁筋与组合肋生产管理系统 - 部署指南

## 🚀 推荐部署方案

### 方案1：Vercel 部署（推荐）

**优点：**
- 免费额度足够小团队使用
- 自动HTTPS
- 全球CDN加速
- 简单易用

**步骤：**
1. 注册 [Vercel](https://vercel.com) 账号
2. 安装 Vercel CLI：`npm i -g vercel`
3. 在项目目录运行：`vercel`
4. 按提示完成部署

**访问：** 部署完成后会得到一个 `https://your-project.vercel.app` 地址

---

### 方案2：Netlify 部署

**优点：**
- 免费额度大
- 支持表单处理
- 简单拖拽部署

**步骤：**
1. 注册 [Netlify](https://netlify.com) 账号
2. 将整个项目文件夹打包成 ZIP
3. 拖拽到 Netlify 部署页面
4. 完成部署

---

### 方案3：GitHub Pages 部署

**优点：**
- 完全免费
- 与GitHub集成

**步骤：**
1. 将代码推送到 GitHub 仓库
2. 在仓库设置中启用 GitHub Pages
3. 选择 main 分支作为源
4. 访问 `https://username.github.io/repository-name`

---

### 方案4：本地网络部署

**适用场景：** 团队在同一局域网内

**步骤：**
1. 在一台电脑上运行：`python3 -m http.server 3000`
2. 查看本机IP：`ipconfig` (Windows) 或 `ifconfig` (Mac/Linux)
3. 团队成员访问：`http://192.168.x.x:3000`

---

## 📊 数据存储方案

### 当前方案：本地存储 + 手动备份
- 数据存储在浏览器 localStorage
- 支持Excel导入导出
- 建议定期导出备份

### 升级方案：简单后端存储
如需要真正的多用户同步，可以考虑：
- Supabase（免费额度大）
- Airtable（类似Excel的在线数据库）
- Google Sheets API

---

## 🔧 部署前准备

1. **禁用Firebase同步**（避免数据清零问题）：
   - 注释掉 `index.html` 中的 Firebase 相关代码
   - 或者在设置中关闭云端同步

2. **测试功能**：
   - 确保所有功能正常工作
   - 导入测试数据验证

3. **备份数据**：
   - 导出现有数据为Excel
   - 保存重要配置

---

## 📱 移动端访问

部署后的系统支持移动端访问：
- 响应式设计，适配手机和平板
- 支持触摸操作
- 可添加到主屏幕作为PWA使用

---

## 🛠️ 故障排除

### 常见问题：
1. **页面无法访问**：检查网络连接和URL
2. **数据丢失**：使用Excel导入功能恢复
3. **功能异常**：清除浏览器缓存后重试

### 技术支持：
- 查看浏览器控制台错误信息
- 确保使用现代浏览器（Chrome、Firefox、Safari）
