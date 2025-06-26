/**
 * 同步协调器
 * 统一管理所有同步逻辑，协调客户端和云端的数据同步
 */

class SyncCoordinator {
    constructor() {
        this.clientId = this.generateClientId();
        this.isConnected = false;
        this.isInitialized = false;
        
        // 核心组件
        this.vectorClock = new VectorClock(this.clientId);
        this.operationQueue = new OperationQueue(this);
        this.operationTransform = new OperationTransform();
        
        // 状态管理
        this.syncState = 'disconnected'; // disconnected, connecting, connected, syncing, error
        this.lastSyncTime = 0;
        this.pendingOperations = new Map();
        this.conflictQueue = [];
        
        // 事件监听器
        this.eventListeners = new Map();
        
        // Firebase相关
        this.db = null;
        this.unsubscribers = [];
        
        console.log('🎯 同步协调器已初始化，客户端ID:', this.clientId);
    }
    
    /**
     * 初始化同步协调器
     * @param {Object} config Firebase配置
     */
    async initialize(config) {
        try {
            this.setSyncState('connecting');
            
            // 检查用户是否禁用了Firebase
            const userDisabledFirebase = localStorage.getItem('disableFirebase') === 'true';
            if (userDisabledFirebase) {
                console.log('📱 用户已禁用Firebase，使用本地模式');
                this.setSyncState('disconnected');
                this.isInitialized = true;
                return true;
            }
            
            // 初始化Firebase
            if (typeof firebase !== 'undefined' && config) {
                await this.initializeFirebase(config);
                this.setSyncState('connected');
                this.isConnected = true;
                
                // 开始实时同步
                this.startRealtimeSync();
                
                console.log('✅ 同步协调器初始化成功');
            } else {
                console.log('📱 Firebase不可用，使用本地模式');
                this.setSyncState('disconnected');
            }
            
            this.isInitialized = true;
            this.emit('initialized', { clientId: this.clientId, connected: this.isConnected });
            
            return true;
            
        } catch (error) {
            console.error('❌ 同步协调器初始化失败:', error);
            this.setSyncState('error');
            this.emit('error', error);
            return false;
        }
    }
    
    /**
     * 初始化Firebase
     */
    async initializeFirebase(config) {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        
        this.db = firebase.firestore();
        
        // 配置Firestore设置
        this.db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
        });
        
        // 启用离线持久化
        await this.db.enablePersistence({ synchronizeTabs: true });
        
        console.log('🔥 Firebase已初始化');
    }
    
    /**
     * 发送操作到云端
     * @param {Object} operation 操作对象
     */
    async sendOperation(operation) {
        if (!this.isConnected) {
            return { success: false, error: 'Not connected' };
        }
        
        try {
            console.log('☁️ 发送操作到云端:', operation.id);
            
            // 添加到待处理操作
            this.pendingOperations.set(operation.id, operation);
            
            // 发送到Firestore
            const docRef = await this.db.collection('operations').add({
                ...operation,
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // 移除待处理操作
            this.pendingOperations.delete(operation.id);
            
            console.log('✅ 操作已发送到云端:', docRef.id);
            
            return {
                success: true,
                cloudId: docRef.id,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ 发送操作失败:', error);
            this.pendingOperations.delete(operation.id);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 开始实时同步
     */
    startRealtimeSync() {
        if (!this.isConnected) return;
        
        console.log('🔄 开始实时同步');
        
        // 监听操作集合
        const operationsRef = this.db.collection('operations')
            .where('clientId', '!=', this.clientId)
            .orderBy('clientId')
            .orderBy('timestamp');
        
        const unsubscribe = operationsRef.onSnapshot(
            (snapshot) => this.handleRemoteOperations(snapshot),
            (error) => this.handleSyncError(error)
        );
        
        this.unsubscribers.push(unsubscribe);
    }
    
    /**
     * 处理远程操作
     */
    async handleRemoteOperations(snapshot) {
        if (!snapshot || snapshot.empty) return;
        
        console.log('📥 收到远程操作:', snapshot.size, '个');
        
        const remoteOperations = [];
        
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const operation = {
                    id: change.doc.id,
                    ...change.doc.data()
                };
                remoteOperations.push(operation);
            }
        });
        
        // 按向量时钟排序
        remoteOperations.sort((a, b) => {
            const comparison = VectorClock.compare(a.vectorClock, b.vectorClock);
            if (comparison === 'before') return -1;
            if (comparison === 'after') return 1;
            return a.timestamp - b.timestamp;
        });
        
        // 处理每个远程操作
        for (const remoteOp of remoteOperations) {
            await this.processRemoteOperation(remoteOp);
        }
    }
    
    /**
     * 处理单个远程操作
     */
    async processRemoteOperation(remoteOperation) {
        console.log('🔄 处理远程操作:', remoteOperation.id);
        
        // 更新向量时钟
        this.vectorClock.update(remoteOperation.vectorClock);
        
        // 检查是否与本地操作冲突
        const conflicts = this.detectConflicts(remoteOperation);
        
        if (conflicts.length > 0) {
            console.log('⚠️ 检测到冲突:', conflicts.length, '个');
            await this.resolveConflicts(remoteOperation, conflicts);
        } else {
            // 无冲突，直接应用
            this.applyRemoteOperation(remoteOperation);
        }
        
        this.emit('remote_operation_processed', remoteOperation);
    }
    
    /**
     * 检测冲突
     */
    detectConflicts(remoteOperation) {
        const conflicts = [];
        
        // 检查与待处理操作的冲突
        for (const [id, localOp] of this.pendingOperations) {
            if (VectorClock.areConcurrent(localOp, remoteOperation)) {
                conflicts.push({
                    type: 'pending_operation',
                    localOperation: localOp,
                    remoteOperation: remoteOperation
                });
            }
        }
        
        // 检查与最近本地操作的冲突
        const recentLocalOps = this.getRecentLocalOperations();
        for (const localOp of recentLocalOps) {
            if (VectorClock.areConcurrent(localOp, remoteOperation)) {
                conflicts.push({
                    type: 'recent_operation',
                    localOperation: localOp,
                    remoteOperation: remoteOperation
                });
            }
        }
        
        return conflicts;
    }
    
    /**
     * 解决冲突
     */
    async resolveConflicts(remoteOperation, conflicts) {
        console.log('🔧 开始解决冲突');
        
        for (const conflict of conflicts) {
            const transformResult = this.operationTransform.transform(
                conflict.localOperation,
                conflict.remoteOperation
            );
            
            if (transformResult.conflict) {
                // 检查是否需要用户干预
                const semanticConflict = this.operationTransform.detectSemanticConflict(
                    conflict.localOperation,
                    conflict.remoteOperation
                );
                
                if (semanticConflict.requiresUserIntervention) {
                    this.addToConflictQueue({
                        ...conflict,
                        transformResult,
                        semanticConflict,
                        suggestions: this.operationTransform.generateResolutionSuggestions(transformResult)
                    });
                } else {
                    // 自动解决冲突
                    await this.autoResolveConflict(conflict, transformResult);
                }
            } else {
                // 应用转换后的操作
                if (transformResult.op1Prime) {
                    this.applyTransformedOperation(transformResult.op1Prime);
                }
                if (transformResult.op2Prime) {
                    this.applyTransformedOperation(transformResult.op2Prime);
                }
            }
        }
    }
    
    /**
     * 自动解决冲突
     */
    async autoResolveConflict(conflict, transformResult) {
        console.log('🤖 自动解决冲突:', transformResult.resolution);
        
        // 应用转换后的操作
        if (transformResult.op1Prime) {
            this.applyTransformedOperation(transformResult.op1Prime);
        }
        if (transformResult.op2Prime) {
            this.applyTransformedOperation(transformResult.op2Prime);
        }
        
        // 记录冲突解决历史
        this.recordConflictResolution(conflict, transformResult, 'auto');
        
        this.emit('conflict_resolved', {
            conflict,
            resolution: transformResult.resolution,
            method: 'auto'
        });
    }
    
    /**
     * 应用远程操作
     */
    applyRemoteOperation(operation) {
        console.log('✅ 应用远程操作:', operation.id);
        
        // 通过操作队列应用（不立即更新UI，因为是远程操作）
        this.operationQueue.applyOperationLocally(operation);
        
        this.emit('remote_operation_applied', operation);
    }
    
    /**
     * 应用转换后的操作
     */
    applyTransformedOperation(operation) {
        console.log('🔄 应用转换后的操作:', operation.id);
        this.applyRemoteOperation(operation);
    }
    
    /**
     * 添加到冲突队列
     */
    addToConflictQueue(conflict) {
        this.conflictQueue.push(conflict);
        console.log('⚠️ 冲突已添加到队列，待用户解决');
        
        this.emit('conflict_requires_resolution', conflict);
    }
    
    /**
     * 获取最近的本地操作
     */
    getRecentLocalOperations() {
        // 从本地存储或内存中获取最近的操作
        // 这里简化实现，实际应该有更完善的操作历史记录
        return Array.from(this.pendingOperations.values());
    }
    
    /**
     * 记录冲突解决历史
     */
    recordConflictResolution(conflict, resolution, method) {
        const record = {
            timestamp: Date.now(),
            conflict,
            resolution,
            method,
            clientId: this.clientId
        };
        
        // 保存到本地存储
        const history = this.getConflictHistory();
        history.push(record);
        
        // 只保留最近100条记录
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
        
        localStorage.setItem('conflictResolutionHistory', JSON.stringify(history));
    }
    
    /**
     * 获取冲突解决历史
     */
    getConflictHistory() {
        try {
            const saved = localStorage.getItem('conflictResolutionHistory');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('获取冲突历史失败:', error);
            return [];
        }
    }
    
    /**
     * 设置同步状态
     */
    setSyncState(state) {
        const oldState = this.syncState;
        this.syncState = state;
        
        console.log('🔄 同步状态变更:', oldState, '→', state);
        this.emit('sync_state_changed', { oldState, newState: state });
    }
    
    /**
     * 处理同步错误
     */
    handleSyncError(error) {
        console.error('❌ 同步错误:', error);
        this.setSyncState('error');
        this.emit('sync_error', error);
    }
    
    /**
     * 生成客户端ID
     */
    generateClientId() {
        const stored = localStorage.getItem('syncClientId');
        if (stored) return stored;
        
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('syncClientId', clientId);
        return clientId;
    }
    
    /**
     * 事件监听
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    /**
     * 触发事件
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('事件监听器错误:', error);
                }
            });
        }
    }
    
    /**
     * 获取同步状态
     */
    getStatus() {
        return {
            clientId: this.clientId,
            syncState: this.syncState,
            isConnected: this.isConnected,
            isInitialized: this.isInitialized,
            lastSyncTime: this.lastSyncTime,
            pendingOperations: this.pendingOperations.size,
            conflictQueue: this.conflictQueue.length,
            vectorClock: this.vectorClock.toString(),
            operationQueue: this.operationQueue.getStatus()
        };
    }
    
    /**
     * 手动同步数据
     */
    async manualSync() {
        if (!this.isInitialized) {
            throw new Error('同步协调器未初始化');
        }

        console.log('🔄 开始手动同步');
        this.setSyncState('syncing');

        try {
            if (this.isConnected) {
                // 在线同步
                await this.performOnlineSync();
            } else {
                // 离线模式，只整理本地数据
                await this.performOfflineSync();
            }

            this.lastSyncTime = Date.now();
            this.setSyncState('connected');

            console.log('✅ 手动同步完成');
            this.emit('manual_sync_completed', { timestamp: this.lastSyncTime });

        } catch (error) {
            console.error('❌ 手动同步失败:', error);
            this.setSyncState('error');
            this.emit('manual_sync_failed', error);
            throw error;
        }
    }

    /**
     * 执行在线同步
     */
    async performOnlineSync() {
        // 1. 重放离线操作
        await this.operationQueue.replayOfflineOperations();

        // 2. 同步数据集合
        await this.syncDataCollections();

        // 3. 解决待处理冲突
        await this.resolveQueuedConflicts();
    }

    /**
     * 执行离线同步
     */
    async performOfflineSync() {
        // 整理本地数据，确保一致性
        if (window.dataManager) {
            window.dataManager.validateData();
            window.dataManager.saveToLocalStorage();
        }
    }

    /**
     * 同步数据集合
     */
    async syncDataCollections() {
        const collections = ['productionData', 'shippingHistory', 'materialPurchases'];

        for (const collectionName of collections) {
            await this.syncCollection(collectionName);
        }
    }

    /**
     * 同步单个集合
     */
    async syncCollection(collectionName) {
        try {
            console.log(`🔄 同步集合: ${collectionName}`);

            // 获取云端数据
            const snapshot = await this.db.collection(collectionName)
                .orderBy('lastModified', 'desc')
                .limit(1000)
                .get();

            const cloudData = [];
            snapshot.forEach(doc => {
                cloudData.push({ id: doc.id, ...doc.data() });
            });

            // 获取本地数据
            const localData = this.getLocalData(collectionName);

            // 智能合并
            const mergedData = this.intelligentMerge(localData, cloudData);

            // 应用合并结果
            this.applyMergedData(collectionName, mergedData);

            console.log(`✅ 集合同步完成: ${collectionName}, ${mergedData.length} 条记录`);

        } catch (error) {
            console.error(`❌ 同步集合失败: ${collectionName}`, error);
        }
    }

    /**
     * 获取本地数据
     */
    getLocalData(collectionName) {
        if (!window.dataManager) return [];

        switch (collectionName) {
            case 'productionData':
                return window.dataManager.data || [];
            case 'shippingHistory':
                return window.dataManager.shippingHistory || [];
            case 'materialPurchases':
                return window.dataManager.materialPurchases || [];
            default:
                return [];
        }
    }

    /**
     * 智能合并数据
     */
    intelligentMerge(localData, cloudData) {
        const merged = new Map();
        const now = Date.now();
        const protectionWindow = 60 * 60 * 1000; // 1小时保护窗口

        // 添加本地数据（优先级高）
        localData.forEach(item => {
            if (!item || !item.id) return;

            const itemAge = now - (item.lastModified || item.timestamp || 0);
            const isProtected = itemAge < protectionWindow;

            merged.set(String(item.id), {
                ...item,
                source: 'local',
                isProtected,
                priority: isProtected ? 100 : 50
            });
        });

        // 处理云端数据
        cloudData.forEach(item => {
            if (!item || !item.id) return;

            const itemId = String(item.id);
            const existing = merged.get(itemId);

            if (!existing) {
                // 新的云端数据
                merged.set(itemId, {
                    ...item,
                    source: 'cloud',
                    priority: 30
                });
            } else if (!existing.isProtected) {
                // 本地数据未受保护，比较时间戳
                const localTime = existing.lastModified || existing.timestamp || 0;
                const cloudTime = item.lastModified || item.timestamp || 0;

                if (cloudTime > localTime + 30000) { // 云端数据比本地新30秒以上
                    merged.set(itemId, {
                        ...item,
                        source: 'cloud_newer',
                        priority: 60
                    });
                }
            }
        });

        // 清理临时字段并返回
        return Array.from(merged.values()).map(item => {
            const { source, isProtected, priority, ...cleanItem } = item;
            return cleanItem;
        });
    }

    /**
     * 应用合并数据
     */
    applyMergedData(collectionName, mergedData) {
        if (!window.dataManager) return;

        switch (collectionName) {
            case 'productionData':
                window.dataManager.data = mergedData;
                window.dataManager.filteredData = [...mergedData];
                break;
            case 'shippingHistory':
                window.dataManager.shippingHistory = mergedData;
                break;
            case 'materialPurchases':
                window.dataManager.materialPurchases = mergedData;
                break;
        }

        // 更新UI和本地存储
        window.dataManager.renderTable();
        window.dataManager.updateStats();
        window.dataManager.saveToLocalStorage();
    }

    /**
     * 解决队列中的冲突
     */
    async resolveQueuedConflicts() {
        if (this.conflictQueue.length === 0) return;

        console.log('🔧 解决队列中的冲突:', this.conflictQueue.length, '个');

        const conflicts = [...this.conflictQueue];
        this.conflictQueue = [];

        for (const conflict of conflicts) {
            try {
                await this.autoResolveConflict(conflict, conflict.transformResult);
            } catch (error) {
                console.error('解决冲突失败:', error);
                // 重新加入队列
                this.conflictQueue.push(conflict);
            }
        }
    }

    /**
     * 用户解决冲突
     */
    async resolveConflictManually(conflictId, resolution) {
        const conflictIndex = this.conflictQueue.findIndex(c => c.id === conflictId);
        if (conflictIndex === -1) {
            throw new Error('冲突不存在');
        }

        const conflict = this.conflictQueue[conflictIndex];
        this.conflictQueue.splice(conflictIndex, 1);

        console.log('👤 用户手动解决冲突:', conflictId, resolution.type);

        // 应用用户选择的解决方案
        switch (resolution.type) {
            case 'accept_local':
                this.applyTransformedOperation(conflict.localOperation);
                break;
            case 'accept_remote':
                this.applyTransformedOperation(conflict.remoteOperation);
                break;
            case 'accept_merge':
                if (conflict.transformResult.op1Prime) {
                    this.applyTransformedOperation(conflict.transformResult.op1Prime);
                }
                break;
            case 'custom':
                this.applyTransformedOperation(resolution.customOperation);
                break;
        }

        // 记录解决历史
        this.recordConflictResolution(conflict, resolution, 'manual');

        this.emit('conflict_resolved', {
            conflict,
            resolution,
            method: 'manual'
        });
    }

    /**
     * 获取待解决冲突列表
     */
    getPendingConflicts() {
        return this.conflictQueue.map(conflict => ({
            id: conflict.id || `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: conflict.type,
            description: this.getConflictDescription(conflict),
            suggestions: conflict.suggestions || [],
            localOperation: conflict.localOperation,
            remoteOperation: conflict.remoteOperation,
            timestamp: conflict.timestamp || Date.now()
        }));
    }

    /**
     * 获取冲突描述
     */
    getConflictDescription(conflict) {
        const local = conflict.localOperation;
        const remote = conflict.remoteOperation;

        if (local.type === remote.type) {
            switch (local.type) {
                case 'update_production':
                    return `同时更新了生产记录 ${local.targetId}`;
                case 'delete_production':
                    return `同时删除了生产记录 ${local.targetId}`;
                default:
                    return `同时执行了 ${local.type} 操作`;
            }
        } else {
            return `${local.type} 与 ${remote.type} 操作冲突`;
        }
    }

    /**
     * 清理资源
     */
    destroy() {
        console.log('🧹 清理同步协调器资源');

        // 取消所有监听器
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];

        // 清理事件监听器
        this.eventListeners.clear();

        // 重置状态
        this.isConnected = false;
        this.isInitialized = false;
        this.setSyncState('disconnected');
    }
}

// 导出类
window.SyncCoordinator = SyncCoordinator;
