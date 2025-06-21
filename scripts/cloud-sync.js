// 云端数据同步管理器 - 永久免费多用户协作方案
// 基于GitHub API实现数据同步，完全免费且永久可用

class CloudSyncManager {
    constructor() {
        // GitHub配置 - 用户需要配置自己的仓库信息
        this.config = {
            owner: 'YOUR_GITHUB_USERNAME',  // 替换为您的GitHub用户名
            repo: 'production-data',        // 数据存储仓库名
            branch: 'main',
            dataFile: 'production-data.json',
            token: null // GitHub Personal Access Token (可选，用于写入)
        };
        
        this.isOnline = navigator.onLine;
        this.syncInterval = 30000; // 30秒同步一次
        this.lastSyncTime = 0;
        this.syncTimer = null;
        
        // 监听网络状态
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.startAutoSync();
            this.showNotification('网络已连接，开始同步数据', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.stopAutoSync();
            this.showNotification('网络已断开，数据将保存在本地', 'warning');
        });
        
        console.log('CloudSyncManager 初始化完成');
    }
    
    // 初始化云端同步
    async init() {
        if (!this.isConfigured()) {
            console.log('云端同步未配置，使用本地存储模式');
            return false;
        }
        
        try {
            // 首次启动时从云端拉取数据
            await this.pullFromCloud();
            this.startAutoSync();
            return true;
        } catch (error) {
            console.error('云端同步初始化失败:', error);
            this.showNotification('云端同步初始化失败，使用本地模式', 'warning');
            return false;
        }
    }
    
    // 检查是否已配置
    isConfigured() {
        return this.config.owner !== 'YOUR_GITHUB_USERNAME' && 
               this.config.repo && 
               this.config.owner;
    }
    
    // 从云端拉取数据
    async pullFromCloud() {
        if (!this.isOnline || !this.isConfigured()) {
            return null;
        }
        
        try {
            const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.dataFile}`;
            const response = await fetch(url);
            
            if (response.status === 404) {
                console.log('云端数据文件不存在，将创建新文件');
                return null;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const fileData = await response.json();
            const content = JSON.parse(atob(fileData.content));
            
            console.log('从云端拉取数据成功:', content.data?.length || 0, '条记录');
            this.lastSyncTime = Date.now();
            
            return content;
        } catch (error) {
            console.error('从云端拉取数据失败:', error);
            throw error;
        }
    }
    
    // 推送数据到云端
    async pushToCloud(data) {
        if (!this.isOnline || !this.isConfigured() || !this.config.token) {
            console.log('无法推送到云端：', {
                online: this.isOnline,
                configured: this.isConfigured(),
                hasToken: !!this.config.token
            });
            return false;
        }
        
        try {
            const cloudData = {
                data: data,
                lastUpdate: new Date().toISOString(),
                version: Date.now(),
                source: 'production-management-system'
            };
            
            const content = btoa(JSON.stringify(cloudData, null, 2));
            
            // 获取当前文件的SHA（如果存在）
            let sha = null;
            try {
                const currentFile = await this.pullFromCloud();
                if (currentFile) {
                    const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.dataFile}`;
                    const response = await fetch(url);
                    const fileInfo = await response.json();
                    sha = fileInfo.sha;
                }
            } catch (e) {
                // 文件不存在，sha保持null
            }
            
            // 推送数据
            const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.dataFile}`;
            const payload = {
                message: `更新生产数据 - ${new Date().toLocaleString('zh-CN')}`,
                content: content,
                branch: this.config.branch
            };
            
            if (sha) {
                payload.sha = sha;
            }
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${this.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            console.log('数据推送到云端成功');
            this.lastSyncTime = Date.now();
            return true;
        } catch (error) {
            console.error('推送数据到云端失败:', error);
            return false;
        }
    }
    
    // 同步数据（双向）
    async syncData(localData) {
        if (!this.isOnline || !this.isConfigured()) {
            return localData;
        }
        
        try {
            // 1. 从云端拉取最新数据
            const cloudData = await this.pullFromCloud();
            
            if (!cloudData || !cloudData.data) {
                // 云端没有数据，推送本地数据
                if (localData && localData.length > 0) {
                    await this.pushToCloud(localData);
                }
                return localData;
            }
            
            // 2. 合并本地和云端数据
            const mergedData = this.mergeData(localData, cloudData.data);
            
            // 3. 如果有变化，推送合并后的数据
            if (this.hasDataChanged(localData, mergedData)) {
                await this.pushToCloud(mergedData);
            }
            
            return mergedData;
        } catch (error) {
            console.error('数据同步失败:', error);
            this.showNotification('数据同步失败，使用本地数据', 'error');
            return localData;
        }
    }
    
    // 合并本地和云端数据
    mergeData(localData, cloudData) {
        if (!localData || localData.length === 0) {
            return cloudData || [];
        }
        
        if (!cloudData || cloudData.length === 0) {
            return localData;
        }
        
        // 创建ID映射
        const merged = new Map();
        
        // 先添加云端数据
        cloudData.forEach(item => {
            merged.set(item.id, { ...item, source: 'cloud' });
        });
        
        // 再添加本地数据，本地数据优先级更高
        localData.forEach(item => {
            const existing = merged.get(item.id);
            if (!existing || new Date(item.lastModified || 0) > new Date(existing.lastModified || 0)) {
                merged.set(item.id, { ...item, source: 'local' });
            }
        });
        
        const result = Array.from(merged.values());
        console.log(`数据合并完成: 本地${localData.length}条, 云端${cloudData.length}条, 合并后${result.length}条`);
        
        return result;
    }
    
    // 检查数据是否有变化
    hasDataChanged(oldData, newData) {
        if (!oldData && !newData) return false;
        if (!oldData || !newData) return true;
        if (oldData.length !== newData.length) return true;
        
        // 简单的内容比较
        const oldStr = JSON.stringify(oldData.sort((a, b) => a.id - b.id));
        const newStr = JSON.stringify(newData.sort((a, b) => a.id - b.id));
        
        return oldStr !== newStr;
    }
    
    // 开始自动同步
    startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        this.syncTimer = setInterval(async () => {
            if (window.dataManager && this.isOnline) {
                const localData = window.dataManager.data;
                const syncedData = await this.syncData(localData);
                
                if (this.hasDataChanged(localData, syncedData)) {
                    window.dataManager.data = syncedData;
                    window.dataManager.filteredData = [...syncedData];
                    window.dataManager.saveToLocalStorage();
                    window.dataManager.renderTable();
                    window.dataManager.updateStats();
                    
                    this.showNotification('数据已同步', 'success');
                }
            }
        }, this.syncInterval);
        
        console.log('自动同步已启动，间隔:', this.syncInterval / 1000, '秒');
    }
    
    // 停止自动同步
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        console.log('自动同步已停止');
    }
    
    // 手动同步
    async manualSync() {
        if (!window.dataManager) {
            this.showNotification('数据管理器未初始化', 'error');
            return;
        }
        
        this.showNotification('正在同步数据...', 'info');
        
        try {
            const localData = window.dataManager.data;
            const syncedData = await this.syncData(localData);
            
            if (this.hasDataChanged(localData, syncedData)) {
                window.dataManager.data = syncedData;
                window.dataManager.filteredData = [...syncedData];
                window.dataManager.saveToLocalStorage();
                window.dataManager.renderTable();
                window.dataManager.updateStats();
                
                this.showNotification('数据同步成功', 'success');
            } else {
                this.showNotification('数据已是最新', 'info');
            }
        } catch (error) {
            console.error('手动同步失败:', error);
            this.showNotification('同步失败: ' + error.message, 'error');
        }
    }
    
    // 配置GitHub信息
    configure(owner, repo, token = null) {
        this.config.owner = owner;
        this.config.repo = repo;
        this.config.token = token;
        
        // 保存配置到本地存储
        localStorage.setItem('cloudSyncConfig', JSON.stringify({
            owner,
            repo,
            hasToken: !!token
        }));
        
        console.log('云端同步配置已更新:', { owner, repo, hasToken: !!token });
    }
    
    // 加载保存的配置
    loadConfig() {
        try {
            const saved = localStorage.getItem('cloudSyncConfig');
            if (saved) {
                const config = JSON.parse(saved);
                this.config.owner = config.owner;
                this.config.repo = config.repo;
                // token不保存在本地存储中，需要用户每次输入
            }
        } catch (error) {
            console.error('加载云端同步配置失败:', error);
        }
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        if (window.dataManager && window.dataManager.showNotification) {
            window.dataManager.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 获取同步状态
    getSyncStatus() {
        return {
            configured: this.isConfigured(),
            online: this.isOnline,
            lastSync: this.lastSyncTime,
            autoSync: !!this.syncTimer,
            hasToken: !!this.config.token
        };
    }
}

// 全局实例
window.cloudSync = new CloudSyncManager();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 加载保存的配置
    window.cloudSync.loadConfig();
    
    // 延迟初始化，等待dataManager准备就绪
    setTimeout(() => {
        window.cloudSync.init();
    }, 1000);
});
