/**
 * 操作队列系统
 * 实现立即UI响应和后台同步处理
 */

class OperationQueue {
    constructor(syncEngine) {
        this.queue = [];
        this.processing = false;
        this.syncEngine = syncEngine;
        this.localOperations = new Map(); // 本地操作缓存
        this.operationId = 0;
        
        // 离线操作队列
        this.offlineQueue = this.loadOfflineQueue();
        
        // 网络状态监听
        this.setupNetworkListeners();
        
        console.log('📋 操作队列系统已初始化');
    }
    
    /**
     * 添加操作到队列
     * @param {Object} operation 操作对象
     * @param {boolean} immediate 是否立即应用到UI
     */
    addOperation(operation, immediate = true) {
        // 生成操作ID
        const operationId = this.generateOperationId();
        const enrichedOperation = {
            ...operation,
            id: operationId,
            timestamp: Date.now(),
            clientId: this.syncEngine.clientId,
            vectorClock: this.syncEngine.vectorClock.tick(),
            status: 'pending'
        };
        
        console.log('➕ 添加操作到队列:', enrichedOperation.type, operationId);
        
        // 立即应用到本地UI
        if (immediate) {
            this.applyOperationLocally(enrichedOperation);
        }
        
        // 添加到队列
        this.queue.push(enrichedOperation);
        this.localOperations.set(operationId, enrichedOperation);
        
        // 开始处理队列
        this.processQueue();
        
        return operationId;
    }
    
    /**
     * 立即应用操作到本地UI
     */
    applyOperationLocally(operation) {
        try {
            switch (operation.type) {
                case 'add_production':
                    this.applyAddProduction(operation);
                    break;
                case 'update_production':
                    this.applyUpdateProduction(operation);
                    break;
                case 'delete_production':
                    this.applyDeleteProduction(operation);
                    break;
                case 'add_shipping':
                    this.applyAddShipping(operation);
                    break;
                case 'update_shipping':
                    this.applyUpdateShipping(operation);
                    break;
                case 'delete_shipping':
                    this.applyDeleteShipping(operation);
                    break;
                default:
                    console.warn('未知操作类型:', operation.type);
            }
            
            // 更新UI
            this.updateUI();
            
            operation.status = 'applied_locally';
            console.log('✅ 操作已应用到本地UI:', operation.id);
            
        } catch (error) {
            console.error('❌ 本地应用操作失败:', error);
            operation.status = 'failed';
        }
    }
    
    /**
     * 处理队列中的操作
     */
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        
        this.processing = true;
        console.log('🔄 开始处理操作队列，待处理:', this.queue.length);
        
        try {
            while (this.queue.length > 0) {
                const operation = this.queue.shift();
                
                if (navigator.onLine && this.syncEngine.isConnected) {
                    // 在线模式：发送到云端
                    await this.sendToCloud(operation);
                } else {
                    // 离线模式：存储到离线队列
                    this.addToOfflineQueue(operation);
                }
            }
        } catch (error) {
            console.error('❌ 处理队列时出错:', error);
        } finally {
            this.processing = false;
        }
    }
    
    /**
     * 发送操作到云端
     */
    async sendToCloud(operation) {
        try {
            console.log('☁️ 发送操作到云端:', operation.id);
            
            // 通过同步引擎发送
            const result = await this.syncEngine.sendOperation(operation);
            
            if (result.success) {
                operation.status = 'synced';
                operation.cloudTimestamp = result.timestamp;
                console.log('✅ 操作已同步到云端:', operation.id);
                
                // 处理可能的冲突解决
                if (result.transformed) {
                    this.handleTransformedOperation(operation, result.transformedOperation);
                }
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ 发送操作到云端失败:', error);
            operation.status = 'failed';
            
            // 添加到离线队列重试
            this.addToOfflineQueue(operation);
        }
    }
    
    /**
     * 添加到离线队列
     */
    addToOfflineQueue(operation) {
        operation.status = 'offline';
        this.offlineQueue.push(operation);
        this.saveOfflineQueue();
        
        console.log('📱 操作已添加到离线队列:', operation.id);
    }
    
    /**
     * 处理转换后的操作
     */
    handleTransformedOperation(originalOperation, transformedOperation) {
        console.log('🔄 处理转换后的操作:', originalOperation.id);
        
        // 撤销原始操作的本地效果
        this.undoLocalOperation(originalOperation);
        
        // 应用转换后的操作
        this.applyOperationLocally(transformedOperation);
        
        // 更新本地操作记录
        this.localOperations.set(originalOperation.id, transformedOperation);
    }
    
    /**
     * 撤销本地操作
     */
    undoLocalOperation(operation) {
        try {
            switch (operation.type) {
                case 'add_production':
                    this.undoAddProduction(operation);
                    break;
                case 'update_production':
                    this.undoUpdateProduction(operation);
                    break;
                case 'delete_production':
                    this.undoDeleteProduction(operation);
                    break;
                // ... 其他操作类型
            }
            
            console.log('↩️ 已撤销本地操作:', operation.id);
            
        } catch (error) {
            console.error('❌ 撤销本地操作失败:', error);
        }
    }
    
    /**
     * 网络恢复时重放离线操作
     */
    async replayOfflineOperations() {
        if (this.offlineQueue.length === 0) {
            return;
        }
        
        console.log('🔄 重放离线操作:', this.offlineQueue.length, '个');
        
        const operations = [...this.offlineQueue];
        this.offlineQueue = [];
        this.saveOfflineQueue();
        
        // 按时间戳排序
        operations.sort((a, b) => a.timestamp - b.timestamp);
        
        // 重新添加到队列
        for (const operation of operations) {
            operation.status = 'pending';
            this.queue.push(operation);
        }
        
        // 处理队列
        await this.processQueue();
    }
    
    /**
     * 生成操作ID
     */
    generateOperationId() {
        return `${this.syncEngine.clientId}_${Date.now()}_${++this.operationId}`;
    }
    
    /**
     * 设置网络监听器
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('🌐 网络已连接，重放离线操作');
            this.replayOfflineOperations();
        });
        
        window.addEventListener('offline', () => {
            console.log('📱 网络已断开，切换到离线模式');
        });
    }
    
    /**
     * 保存离线队列
     */
    saveOfflineQueue() {
        try {
            localStorage.setItem('offlineOperationQueue', JSON.stringify(this.offlineQueue));
        } catch (error) {
            console.error('保存离线队列失败:', error);
        }
    }
    
    /**
     * 加载离线队列
     */
    loadOfflineQueue() {
        try {
            const saved = localStorage.getItem('offlineOperationQueue');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('加载离线队列失败:', error);
            return [];
        }
    }
    
    /**
     * 获取队列状态
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            offlineQueueLength: this.offlineQueue.length,
            processing: this.processing,
            localOperations: this.localOperations.size,
            isOnline: navigator.onLine,
            isConnected: this.syncEngine.isConnected
        };
    }
    
    // ========== 具体操作实现 ==========
    
    applyAddProduction(operation) {
        if (window.dataManager) {
            window.dataManager.data.push(operation.data);
            window.dataManager.filteredData = [...window.dataManager.data];
        }
    }
    
    applyUpdateProduction(operation) {
        if (window.dataManager) {
            const index = window.dataManager.data.findIndex(item => item.id === operation.targetId);
            if (index !== -1) {
                Object.assign(window.dataManager.data[index], operation.changes);
                window.dataManager.filteredData = [...window.dataManager.data];
            }
        }
    }
    
    applyDeleteProduction(operation) {
        if (window.dataManager) {
            window.dataManager.data = window.dataManager.data.filter(item => item.id !== operation.targetId);
            window.dataManager.filteredData = [...window.dataManager.data];
        }
    }
    
    applyAddShipping(operation) {
        if (window.dataManager) {
            window.dataManager.shippingHistory.push(operation.data);
        }
    }
    
    applyUpdateShipping(operation) {
        if (window.dataManager) {
            const index = window.dataManager.shippingHistory.findIndex(item => item.id === operation.targetId);
            if (index !== -1) {
                Object.assign(window.dataManager.shippingHistory[index], operation.changes);
            }
        }
    }
    
    applyDeleteShipping(operation) {
        if (window.dataManager) {
            window.dataManager.shippingHistory = window.dataManager.shippingHistory.filter(item => item.id !== operation.targetId);
        }
    }
    
    undoAddProduction(operation) {
        if (window.dataManager) {
            window.dataManager.data = window.dataManager.data.filter(item => item.id !== operation.data.id);
            window.dataManager.filteredData = [...window.dataManager.data];
        }
    }
    
    undoUpdateProduction(operation) {
        if (window.dataManager && operation.previousData) {
            const index = window.dataManager.data.findIndex(item => item.id === operation.targetId);
            if (index !== -1) {
                window.dataManager.data[index] = operation.previousData;
                window.dataManager.filteredData = [...window.dataManager.data];
            }
        }
    }
    
    undoDeleteProduction(operation) {
        if (window.dataManager && operation.deletedData) {
            window.dataManager.data.push(operation.deletedData);
            window.dataManager.filteredData = [...window.dataManager.data];
        }
    }
    
    updateUI() {
        if (window.dataManager) {
            window.dataManager.renderTable();
            window.dataManager.updateStats();
            window.dataManager.saveToLocalStorage();
        }
    }
}

// 导出类
window.OperationQueue = OperationQueue;
