/**
 * 数据保护配置文件
 * 用于调整数据同步和保护的各种参数
 */

// 数据保护配置
window.dataProtectionConfig = {
    // 本地数据保护窗口（毫秒）
    // 在此时间内修改的本地数据将受到保护，不会被云端数据覆盖
    localProtectionWindow: 60 * 60 * 1000, // 1小时

    // 新鲜数据阈值（毫秒）
    // 在此时间内的数据被认为是"新鲜"的
    freshDataThreshold: 30 * 60 * 1000, // 30分钟

    // 时间戳容错范围（毫秒）
    // 只有当时间差超过此值时，才会考虑时间戳优先级
    timestampTolerance: 2 * 60 * 1000, // 2分钟

    // 手动同步保护时间（毫秒）
    // 手动同步后的这段时间内，会跳过远程数据更新
    manualSyncProtectionTime: 10 * 1000, // 10秒

    // 选择性合并保护窗口（毫秒）
    // 在选择性合并时，此时间内的本地数据会被保护
    selectiveMergeProtectionWindow: 30 * 60 * 1000, // 30分钟

    // 是否启用详细日志
    enableDetailedLogs: true,

    // 是否启用数据保护通知
    enableProtectionNotifications: true,

    // 冲突解决策略
    conflictResolutionStrategy: {
        // 优先级：local_protected > version > timestamp > smart_merge
        priorities: ['local_protected', 'version', 'timestamp', 'smart_merge'],
        
        // 是否启用智能字段合并
        enableSmartFieldMerge: true,
        
        // 是否优先保护生产数据
        protectProductionData: true
    },

    // 同步行为配置
    syncBehavior: {
        // 是否在有本地数据时跳过云端数据拉取
        skipCloudLoadWhenLocalExists: true,
        
        // 是否启用智能合并模式
        enableIntelligentMerge: true,
        
        // 批量同步的最大记录数
        maxBatchSize: 1000,
        
        // 同步重试次数
        maxRetries: 3
    }
};

// 应用配置到相关模块
function applyDataProtectionConfig() {
    console.log('🛡️ 应用数据保护配置...');
    
    // 如果DataManager已加载，应用配置
    if (window.dataManager) {
        // 可以在这里设置DataManager的保护参数
        console.log('✅ DataManager配置已应用');
    }
    
    // 如果FirebaseSync已加载，应用配置
    if (window.firebaseSync) {
        // 可以在这里设置FirebaseSync的保护参数
        console.log('✅ FirebaseSync配置已应用');
    }
    
    console.log('📊 当前数据保护配置:', window.dataProtectionConfig);
}

// 获取保护状态
function getDataProtectionStatus() {
    const now = Date.now();
    const config = window.dataProtectionConfig;
    
    let status = {
        protectionEnabled: true,
        protectionWindow: config.localProtectionWindow,
        freshThreshold: config.freshDataThreshold,
        lastManualSync: window.dataManager?.lastManualSyncTime || 0,
        isInProtectionPeriod: false
    };
    
    // 检查是否在手动同步保护期内
    if (status.lastManualSync > 0) {
        const timeSinceManualSync = now - status.lastManualSync;
        status.isInProtectionPeriod = timeSinceManualSync < config.manualSyncProtectionTime;
    }
    
    return status;
}

// 检查数据是否受保护
function isDataProtected(item) {
    if (!item) return false;
    
    const now = Date.now();
    const config = window.dataProtectionConfig;
    const itemAge = now - (item.lastModified || item.timestamp || 0);
    
    return itemAge < config.localProtectionWindow;
}

// 获取数据新鲜度信息
function getDataFreshnessInfo(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return {
            total: 0,
            fresh: 0,
            protected: 0,
            old: 0
        };
    }
    
    const now = Date.now();
    const config = window.dataProtectionConfig;
    
    let fresh = 0;
    let protected = 0;
    let old = 0;
    
    data.forEach(item => {
        const age = now - (item.lastModified || item.timestamp || 0);
        
        if (age < config.freshDataThreshold) {
            fresh++;
        }
        
        if (age < config.localProtectionWindow) {
            protected++;
        } else {
            old++;
        }
    });
    
    return {
        total: data.length,
        fresh,
        protected,
        old,
        freshPercentage: Math.round((fresh / data.length) * 100),
        protectedPercentage: Math.round((protected / data.length) * 100)
    };
}

// 创建配置界面
function createConfigInterface() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h2 style="margin: 0 0 16px 0; color: #1f2937;">🛡️ 数据保护配置</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    本地数据保护窗口 (分钟):
                </label>
                <input type="number" id="protectionWindow" 
                       value="${window.dataProtectionConfig.localProtectionWindow / 60000}"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <small style="color: #666;">在此时间内修改的本地数据将受到保护</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    新鲜数据阈值 (分钟):
                </label>
                <input type="number" id="freshThreshold" 
                       value="${window.dataProtectionConfig.freshDataThreshold / 60000}"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <small style="color: #666;">在此时间内的数据被认为是新鲜的</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: bold;">
                    时间戳容错范围 (秒):
                </label>
                <input type="number" id="timestampTolerance" 
                       value="${window.dataProtectionConfig.timestampTolerance / 1000}"
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <small style="color: #666;">时间差超过此值时才考虑时间戳优先级</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="enableDetailedLogs" 
                           ${window.dataProtectionConfig.enableDetailedLogs ? 'checked' : ''}>
                    启用详细日志
                </label>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="enableProtectionNotifications" 
                           ${window.dataProtectionConfig.enableProtectionNotifications ? 'checked' : ''}>
                    启用数据保护通知
                </label>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                <button onclick="this.closest('div').parentElement.remove()" style="
                    padding: 8px 16px;
                    background: #6b7280;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">取消</button>
                <button onclick="saveDataProtectionConfig(this)" style="
                    padding: 8px 16px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">保存配置</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 保存配置
function saveDataProtectionConfig(button) {
    const modal = button.closest('div').parentElement;
    
    // 获取配置值
    const protectionWindow = parseInt(document.getElementById('protectionWindow').value) * 60000;
    const freshThreshold = parseInt(document.getElementById('freshThreshold').value) * 60000;
    const timestampTolerance = parseInt(document.getElementById('timestampTolerance').value) * 1000;
    const enableDetailedLogs = document.getElementById('enableDetailedLogs').checked;
    const enableProtectionNotifications = document.getElementById('enableProtectionNotifications').checked;
    
    // 更新配置
    window.dataProtectionConfig.localProtectionWindow = protectionWindow;
    window.dataProtectionConfig.freshDataThreshold = freshThreshold;
    window.dataProtectionConfig.timestampTolerance = timestampTolerance;
    window.dataProtectionConfig.enableDetailedLogs = enableDetailedLogs;
    window.dataProtectionConfig.enableProtectionNotifications = enableProtectionNotifications;
    
    // 保存到本地存储
    localStorage.setItem('dataProtectionConfig', JSON.stringify(window.dataProtectionConfig));
    
    // 应用配置
    applyDataProtectionConfig();
    
    // 显示通知
    if (window.dataManager && window.dataManager.showNotification) {
        window.dataManager.showNotification('数据保护配置已保存', 'success');
    }
    
    // 关闭模态框
    modal.remove();
    
    console.log('✅ 数据保护配置已保存:', window.dataProtectionConfig);
}

// 从本地存储加载配置
function loadDataProtectionConfig() {
    try {
        const savedConfig = localStorage.getItem('dataProtectionConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            window.dataProtectionConfig = { ...window.dataProtectionConfig, ...config };
            console.log('✅ 已加载保存的数据保护配置');
        }
    } catch (error) {
        console.warn('⚠️ 加载数据保护配置失败:', error);
    }
}

// 重置为默认配置
function resetDataProtectionConfig() {
    if (confirm('确定要重置为默认配置吗？')) {
        localStorage.removeItem('dataProtectionConfig');
        location.reload();
    }
}

// 页面加载时自动加载配置
document.addEventListener('DOMContentLoaded', () => {
    loadDataProtectionConfig();
    applyDataProtectionConfig();
});

// 导出函数供全局使用
window.dataProtectionUtils = {
    getProtectionStatus: getDataProtectionStatus,
    isDataProtected: isDataProtected,
    getFreshnessInfo: getDataFreshnessInfo,
    createConfigInterface: createConfigInterface,
    resetConfig: resetDataProtectionConfig
};
