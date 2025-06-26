/**
 * 新的同步系统初始化
 * 整合所有同步组件，提供统一的接口
 */

class SyncSystem {
    constructor() {
        this.coordinator = null;
        this.ui = null;
        this.isInitialized = false;
        
        console.log('🚀 同步系统开始初始化...');
    }
    
    /**
     * 初始化同步系统
     */
    async initialize() {
        try {
            // 检查依赖
            if (!this.checkDependencies()) {
                throw new Error('同步系统依赖未加载完成');
            }

            // 迁移现有数据
            await this.migrateExistingData();

            // 创建同步协调器
            this.coordinator = new SyncCoordinator();
            
            // 初始化协调器
            const firebaseConfig = this.getFirebaseConfig();
            const success = await this.coordinator.initialize(firebaseConfig);
            
            if (success) {
                // 创建UI组件
                this.ui = new SyncUI(this.coordinator);
                
                // 集成到现有系统
                this.integrateWithDataManager();
                
                this.isInitialized = true;
                console.log('✅ 新同步系统初始化成功');
                
                // 显示初始化成功通知
                this.showNotification('新同步系统已启用，支持智能冲突解决', 'success');
                
                return true;
            } else {
                throw new Error('同步协调器初始化失败');
            }
            
        } catch (error) {
            console.error('❌ 同步系统初始化失败:', error);
            this.showNotification('同步系统初始化失败，使用本地模式', 'warning');
            return false;
        }
    }
    
    /**
     * 检查依赖
     */
    checkDependencies() {
        const required = [
            'VectorClock',
            'OperationQueue', 
            'OperationTransform',
            'SyncCoordinator',
            'SyncUI'
        ];
        
        for (const dep of required) {
            if (typeof window[dep] === 'undefined') {
                console.error(`❌ 缺少依赖: ${dep}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 迁移现有数据
     */
    async migrateExistingData() {
        console.log('🔄 开始迁移现有数据...');

        try {
            // 检查是否需要迁移
            const migrationVersion = localStorage.getItem('syncSystemMigrationVersion');
            const currentVersion = '1.0.0';

            if (migrationVersion === currentVersion) {
                console.log('✅ 数据已是最新版本，无需迁移');
                return;
            }

            // 备份现有数据
            this.backupExistingData();

            // 验证数据完整性
            this.validateExistingData();

            // 标记迁移完成
            localStorage.setItem('syncSystemMigrationVersion', currentVersion);
            localStorage.setItem('syncSystemMigrationTime', Date.now().toString());

            console.log('✅ 数据迁移完成');

        } catch (error) {
            console.error('❌ 数据迁移失败:', error);
            throw error;
        }
    }

    /**
     * 备份现有数据
     */
    backupExistingData() {
        try {
            const backup = {
                timestamp: Date.now(),
                version: '1.0.0',
                data: {}
            };

            // 备份主要数据
            const keys = [
                'productionData',
                'shippingHistory',
                'materialPurchases',
                'productionPlans',
                'areas'
            ];

            keys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    backup.data[key] = data;
                }
            });

            // 保存备份
            localStorage.setItem('syncSystemDataBackup', JSON.stringify(backup));
            console.log('💾 数据备份完成');

        } catch (error) {
            console.error('❌ 数据备份失败:', error);
            throw error;
        }
    }

    /**
     * 验证现有数据
     */
    validateExistingData() {
        try {
            console.log('🔍 验证数据完整性...');

            // 验证生产数据
            const productionData = localStorage.getItem('productionData');
            if (productionData) {
                const data = JSON.parse(productionData);
                if (Array.isArray(data)) {
                    data.forEach((item, index) => {
                        if (!item.id) {
                            console.warn(`生产数据项 ${index} 缺少ID，自动生成`);
                            item.id = `prod_${Date.now()}_${index}`;
                        }
                        if (!item.timestamp) {
                            item.timestamp = Date.now();
                        }
                        if (!item.lastModified) {
                            item.lastModified = item.timestamp;
                        }
                    });
                    localStorage.setItem('productionData', JSON.stringify(data));
                }
            }

            // 验证发货数据
            const shippingHistory = localStorage.getItem('shippingHistory');
            if (shippingHistory) {
                const data = JSON.parse(shippingHistory);
                if (Array.isArray(data)) {
                    data.forEach((item, index) => {
                        if (!item.id) {
                            item.id = `ship_${Date.now()}_${index}`;
                        }
                        if (!item.timestamp) {
                            item.timestamp = Date.now();
                        }
                        if (!item.lastModified) {
                            item.lastModified = item.timestamp;
                        }
                    });
                    localStorage.setItem('shippingHistory', JSON.stringify(data));
                }
            }

            console.log('✅ 数据验证完成');

        } catch (error) {
            console.error('❌ 数据验证失败:', error);
            throw error;
        }
    }

    /**
     * 恢复数据备份
     */
    restoreDataBackup() {
        try {
            const backupData = localStorage.getItem('syncSystemDataBackup');
            if (!backupData) {
                throw new Error('没有找到数据备份');
            }

            const backup = JSON.parse(backupData);

            // 恢复数据
            Object.entries(backup.data).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });

            console.log('✅ 数据备份已恢复');

            // 重新加载页面
            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (error) {
            console.error('❌ 恢复数据备份失败:', error);
            throw error;
        }
    }

    /**
     * 获取Firebase配置
     */
    getFirebaseConfig() {
        // 检查用户是否禁用了Firebase
        const userDisabledFirebase = localStorage.getItem('disableFirebase') === 'true';
        if (userDisabledFirebase) {
            return null;
        }
        
        // 使用现有的Firebase配置
        if (typeof firebaseConfig !== 'undefined') {
            return firebaseConfig;
        }
        
        return null;
    }
    
    /**
     * 集成到现有数据管理器
     */
    integrateWithDataManager() {
        if (!window.dataManager) {
            console.warn('⚠️ 数据管理器未找到，无法集成');
            return;
        }
        
        console.log('🔗 集成到现有数据管理器');
        
        // 保存原始方法
        const originalMethods = {
            addProduction: window.dataManager.addProduction?.bind(window.dataManager),
            updateProduction: window.dataManager.updateProduction?.bind(window.dataManager),
            deleteProduction: window.dataManager.deleteProduction?.bind(window.dataManager),
            addShipping: window.dataManager.addShipping?.bind(window.dataManager),
            updateShipping: window.dataManager.updateShipping?.bind(window.dataManager),
            deleteShipping: window.dataManager.deleteShipping?.bind(window.dataManager)
        };
        
        // 包装方法以使用新的同步系统
        if (originalMethods.addProduction) {
            window.dataManager.addProduction = (data) => {
                const operationId = this.coordinator.operationQueue.addOperation({
                    type: 'add_production',
                    data: data,
                    targetId: data.id
                });
                
                console.log('📝 生产数据添加操作已加入队列:', operationId);
                return operationId;
            };
        }
        
        if (originalMethods.updateProduction) {
            window.dataManager.updateProduction = (id, changes, previousData) => {
                const operationId = this.coordinator.operationQueue.addOperation({
                    type: 'update_production',
                    targetId: id,
                    changes: changes,
                    previousData: previousData
                });
                
                console.log('📝 生产数据更新操作已加入队列:', operationId);
                return operationId;
            };
        }
        
        if (originalMethods.deleteProduction) {
            window.dataManager.deleteProduction = (id, deletedData) => {
                const operationId = this.coordinator.operationQueue.addOperation({
                    type: 'delete_production',
                    targetId: id,
                    deletedData: deletedData
                });
                
                console.log('📝 生产数据删除操作已加入队列:', operationId);
                return operationId;
            };
        }
        
        // 发货操作类似处理
        if (originalMethods.addShipping) {
            window.dataManager.addShipping = (data) => {
                const operationId = this.coordinator.operationQueue.addOperation({
                    type: 'add_shipping',
                    data: data,
                    targetId: data.id
                });
                
                console.log('📦 发货数据添加操作已加入队列:', operationId);
                return operationId;
            };
        }
        
        // 添加同步相关方法
        window.dataManager.getSyncStatus = () => {
            return this.coordinator ? this.coordinator.getStatus() : null;
        };
        
        window.dataManager.manualSync = async () => {
            if (this.coordinator) {
                return await this.coordinator.manualSync();
            }
        };
        
        window.dataManager.showSyncPanel = () => {
            if (this.ui) {
                this.ui.showStatusPanel();
            }
        };
        
        window.dataManager.showConflicts = () => {
            if (this.ui) {
                this.ui.showConflictModal();
            }
        };
        
        // 保存原始方法的引用，以便需要时可以回退
        window.dataManager._originalMethods = originalMethods;
        window.dataManager._syncSystem = this;
    }
    
    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        if (window.dataManager && window.dataManager.showNotification) {
            window.dataManager.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * 获取同步状态
     */
    getStatus() {
        if (!this.isInitialized || !this.coordinator) {
            return {
                initialized: false,
                error: 'System not initialized'
            };
        }
        
        return {
            initialized: true,
            ...this.coordinator.getStatus()
        };
    }
    
    /**
     * 手动同步
     */
    async manualSync() {
        if (!this.isInitialized || !this.coordinator) {
            throw new Error('同步系统未初始化');
        }
        
        return await this.coordinator.manualSync();
    }
    
    /**
     * 显示同步面板
     */
    showSyncPanel() {
        if (this.ui) {
            this.ui.showStatusPanel();
        }
    }
    
    /**
     * 显示冲突解决界面
     */
    showConflictModal() {
        if (this.ui) {
            this.ui.showConflictModal();
        }
    }
    
    /**
     * 销毁同步系统
     */
    destroy() {
        console.log('🧹 销毁同步系统');
        
        if (this.coordinator) {
            this.coordinator.destroy();
            this.coordinator = null;
        }
        
        if (this.ui) {
            // UI组件的清理
            this.ui = null;
        }
        
        // 恢复原始方法
        if (window.dataManager && window.dataManager._originalMethods) {
            Object.assign(window.dataManager, window.dataManager._originalMethods);
            delete window.dataManager._originalMethods;
            delete window.dataManager._syncSystem;
        }
        
        this.isInitialized = false;
    }
    
    /**
     * 获取系统诊断信息
     */
    getDiagnostics() {
        const diagnostics = {
            timestamp: Date.now(),
            system: {
                initialized: this.isInitialized,
                userAgent: navigator.userAgent,
                online: navigator.onLine,
                localStorage: this.checkLocalStorageAvailable(),
                firebase: typeof firebase !== 'undefined'
            },
            sync: this.getStatus(),
            data: {
                productionData: this.getDataInfo('productionData'),
                shippingHistory: this.getDataInfo('shippingHistory'),
                materialPurchases: this.getDataInfo('materialPurchases')
            },
            migration: {
                version: localStorage.getItem('syncSystemMigrationVersion'),
                time: localStorage.getItem('syncSystemMigrationTime'),
                hasBackup: !!localStorage.getItem('syncSystemDataBackup')
            },
            performance: this.getPerformanceInfo()
        };

        return diagnostics;
    }

    /**
     * 检查本地存储可用性
     */
    checkLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 获取数据信息
     */
    getDataInfo(key) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return { exists: false };

            const parsed = JSON.parse(data);
            return {
                exists: true,
                type: Array.isArray(parsed) ? 'array' : typeof parsed,
                length: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
                size: data.length,
                lastModified: this.getLastModifiedTime(parsed)
            };
        } catch (error) {
            return { exists: true, error: error.message };
        }
    }

    /**
     * 获取最后修改时间
     */
    getLastModifiedTime(data) {
        if (Array.isArray(data)) {
            const times = data
                .map(item => item.lastModified || item.timestamp || 0)
                .filter(time => time > 0);
            return times.length > 0 ? Math.max(...times) : 0;
        }
        return data.lastModified || data.timestamp || 0;
    }

    /**
     * 获取性能信息
     */
    getPerformanceInfo() {
        if (typeof performance === 'undefined') {
            return { available: false };
        }

        return {
            available: true,
            navigation: performance.navigation ? {
                type: performance.navigation.type,
                redirectCount: performance.navigation.redirectCount
            } : null,
            timing: performance.timing ? {
                loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
                domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
            } : null,
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }

    /**
     * 导出诊断报告
     */
    exportDiagnostics() {
        const diagnostics = this.getDiagnostics();
        const blob = new Blob([JSON.stringify(diagnostics, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sync-diagnostics-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('诊断报告已导出', 'success');
    }

    /**
     * 清理系统数据
     */
    cleanupSystem() {
        if (!confirm('确定要清理所有同步系统数据吗？这将删除所有本地缓存和配置。')) {
            return;
        }

        try {
            // 清理同步相关的本地存储
            const keysToRemove = [
                'syncClientId',
                'offlineOperationQueue',
                'conflictResolutionHistory',
                'syncSystemMigrationVersion',
                'syncSystemMigrationTime',
                'syncSystemDataBackup'
            ];

            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });

            this.showNotification('系统数据已清理，页面将重新加载', 'success');

            setTimeout(() => {
                location.reload();
            }, 2000);

        } catch (error) {
            console.error('清理系统数据失败:', error);
            this.showNotification('清理失败: ' + error.message, 'error');
        }
    }

    /**
     * 切换同步模式
     */
    toggleSyncMode() {
        const isDisabled = localStorage.getItem('disableFirebase') === 'true';
        
        if (isDisabled) {
            // 启用云端同步
            localStorage.removeItem('disableFirebase');
            this.showNotification('正在启用云端同步...', 'info');
            
            // 重新初始化
            setTimeout(() => {
                location.reload();
            }, 1000);
        } else {
            // 禁用云端同步
            localStorage.setItem('disableFirebase', 'true');
            this.showNotification('已切换为本地模式', 'info');
            
            // 重新初始化
            setTimeout(() => {
                location.reload();
            }, 1000);
        }
    }
}

// 全局初始化函数
async function initializeSyncSystem() {
    // 等待页面加载完成
    if (document.readyState !== 'complete') {
        return new Promise(resolve => {
            window.addEventListener('load', async () => {
                resolve(await initializeSyncSystem());
            });
        });
    }
    
    // 等待一段时间确保所有脚本加载完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        window.syncSystem = new SyncSystem();
        const success = await window.syncSystem.initialize();
        
        if (success) {
            console.log('🎉 新同步系统启动成功');
            
            // 添加全局快捷键
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                    e.preventDefault();
                    window.syncSystem.showSyncPanel();
                }
            });
            
            return window.syncSystem;
        } else {
            console.log('⚠️ 同步系统启动失败，使用本地模式');
            return null;
        }
        
    } catch (error) {
        console.error('❌ 同步系统启动异常:', error);
        return null;
    }
}

// 导出
window.SyncSystem = SyncSystem;
window.initializeSyncSystem = initializeSyncSystem;

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他脚本先加载
    setTimeout(initializeSyncSystem, 2000);
});
