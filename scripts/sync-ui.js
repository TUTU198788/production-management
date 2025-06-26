/**
 * 同步状态UI组件
 * 显示实时同步状态和冲突解决界面
 */

class SyncUI {
    constructor(syncCoordinator) {
        this.syncCoordinator = syncCoordinator;
        this.statusIndicator = null;
        this.conflictModal = null;
        this.statusPanel = null;
        
        this.init();
        this.setupEventListeners();
        
        console.log('🎨 同步UI组件已初始化');
    }
    
    /**
     * 初始化UI组件
     */
    init() {
        this.createStatusIndicator();
        this.createStatusPanel();
        this.createConflictModal();
        this.updateStatusDisplay();
    }
    
    /**
     * 创建状态指示器
     */
    createStatusIndicator() {
        // 检查是否已存在
        let existing = document.getElementById('syncStatusIndicator');
        if (existing) {
            this.statusIndicator = existing;
            return;
        }
        
        this.statusIndicator = document.createElement('div');
        this.statusIndicator.id = 'syncStatusIndicator';
        this.statusIndicator.className = 'sync-status-indicator';
        this.statusIndicator.innerHTML = `
            <div class="status-icon">
                <i class="fas fa-sync-alt"></i>
            </div>
            <div class="status-text">
                <span class="status-label">同步状态</span>
                <span class="status-value">初始化中...</span>
            </div>
            <div class="status-details" style="display: none;">
                <div class="detail-item">
                    <span>客户端ID:</span>
                    <span id="clientIdDisplay">-</span>
                </div>
                <div class="detail-item">
                    <span>待处理操作:</span>
                    <span id="pendingOpsDisplay">0</span>
                </div>
                <div class="detail-item">
                    <span>冲突队列:</span>
                    <span id="conflictQueueDisplay">0</span>
                </div>
                <div class="detail-item">
                    <span>最后同步:</span>
                    <span id="lastSyncDisplay">从未</span>
                </div>
            </div>
        `;
        
        // 添加到页面
        const header = document.querySelector('.header-actions');
        if (header) {
            header.appendChild(this.statusIndicator);
        } else {
            document.body.appendChild(this.statusIndicator);
        }
        
        // 点击展开/收起详情
        this.statusIndicator.addEventListener('click', () => {
            const details = this.statusIndicator.querySelector('.status-details');
            const isVisible = details.style.display !== 'none';
            details.style.display = isVisible ? 'none' : 'block';
        });
    }
    
    /**
     * 创建状态面板
     */
    createStatusPanel() {
        this.statusPanel = document.createElement('div');
        this.statusPanel.id = 'syncStatusPanel';
        this.statusPanel.className = 'sync-status-panel';
        this.statusPanel.style.display = 'none';
        this.statusPanel.innerHTML = `
            <div class="panel-header">
                <h3>同步状态详情</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="panel-content">
                <div class="status-section">
                    <h4>连接状态</h4>
                    <div class="status-grid">
                        <div class="status-item">
                            <span class="label">网络状态:</span>
                            <span class="value" id="networkStatus">检查中...</span>
                        </div>
                        <div class="status-item">
                            <span class="label">云端连接:</span>
                            <span class="value" id="cloudConnection">检查中...</span>
                        </div>
                        <div class="status-item">
                            <span class="label">同步模式:</span>
                            <span class="value" id="syncMode">检查中...</span>
                        </div>
                    </div>
                </div>
                
                <div class="status-section">
                    <h4>操作队列</h4>
                    <div class="queue-info">
                        <div class="queue-item">
                            <span class="label">待发送操作:</span>
                            <span class="value" id="queueLength">0</span>
                        </div>
                        <div class="queue-item">
                            <span class="label">离线操作:</span>
                            <span class="value" id="offlineQueueLength">0</span>
                        </div>
                        <div class="queue-item">
                            <span class="label">处理中:</span>
                            <span class="value" id="processingStatus">否</span>
                        </div>
                    </div>
                </div>
                
                <div class="status-section">
                    <h4>冲突管理</h4>
                    <div class="conflict-info">
                        <div class="conflict-item">
                            <span class="label">待解决冲突:</span>
                            <span class="value" id="conflictCount">0</span>
                        </div>
                        <button class="btn btn-primary" id="viewConflictsBtn" onclick="syncUI.showConflictModal()">
                            查看冲突
                        </button>
                    </div>
                </div>
                
                <div class="status-section">
                    <h4>操作</h4>
                    <div class="action-buttons">
                        <button class="btn btn-success" onclick="syncUI.manualSync()">
                            <i class="fas fa-sync-alt"></i> 手动同步
                        </button>
                        <button class="btn btn-info" onclick="syncUI.showSyncHistory()">
                            <i class="fas fa-history"></i> 同步历史
                        </button>
                        <button class="btn btn-warning" onclick="syncUI.clearOfflineQueue()">
                            <i class="fas fa-trash"></i> 清空离线队列
                        </button>
                        <button class="btn btn-info" onclick="syncUI.exportDiagnostics()">
                            <i class="fas fa-download"></i> 导出诊断
                        </button>
                        <button class="btn btn-danger" onclick="syncUI.showAdvancedOptions()">
                            <i class="fas fa-cog"></i> 高级选项
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.statusPanel);
    }
    
    /**
     * 创建冲突解决模态框
     */
    createConflictModal() {
        this.conflictModal = document.createElement('div');
        this.conflictModal.id = 'conflictResolutionModal';
        this.conflictModal.className = 'modal conflict-modal';
        this.conflictModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>解决数据冲突</h3>
                    <button class="close-btn" onclick="syncUI.hideConflictModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="conflict-list" id="conflictList">
                        <!-- 冲突列表将在这里动态生成 -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="syncUI.hideConflictModal()">
                        稍后处理
                    </button>
                    <button class="btn btn-primary" onclick="syncUI.autoResolveAllConflicts()">
                        自动解决全部
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.conflictModal);
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听同步协调器事件
        this.syncCoordinator.on('sync_state_changed', (data) => {
            this.updateStatusDisplay();
        });
        
        this.syncCoordinator.on('conflict_requires_resolution', (conflict) => {
            this.showConflictNotification(conflict);
        });
        
        this.syncCoordinator.on('conflict_resolved', (data) => {
            this.updateConflictDisplay();
            this.showNotification('冲突已解决', 'success');
        });
        
        this.syncCoordinator.on('manual_sync_completed', () => {
            this.showNotification('手动同步完成', 'success');
            this.updateStatusDisplay();
        });
        
        this.syncCoordinator.on('manual_sync_failed', (error) => {
            this.showNotification('手动同步失败: ' + error.message, 'error');
        });
        
        // 网络状态监听
        window.addEventListener('online', () => {
            this.updateStatusDisplay();
            this.showNotification('网络已连接', 'info');
        });
        
        window.addEventListener('offline', () => {
            this.updateStatusDisplay();
            this.showNotification('网络已断开，切换到离线模式', 'warning');
        });
        
        // 定期更新状态
        setInterval(() => {
            this.updateStatusDisplay();
        }, 5000);
    }
    
    /**
     * 更新状态显示
     */
    updateStatusDisplay() {
        if (!this.statusIndicator) return;
        
        const status = this.syncCoordinator.getStatus();
        const icon = this.statusIndicator.querySelector('.status-icon i');
        const statusValue = this.statusIndicator.querySelector('.status-value');
        
        // 更新图标和文本
        switch (status.syncState) {
            case 'connected':
                icon.className = 'fas fa-check-circle';
                icon.style.color = '#10b981';
                statusValue.textContent = '已连接';
                break;
            case 'connecting':
                icon.className = 'fas fa-sync-alt fa-spin';
                icon.style.color = '#3b82f6';
                statusValue.textContent = '连接中...';
                break;
            case 'syncing':
                icon.className = 'fas fa-sync-alt fa-spin';
                icon.style.color = '#f59e0b';
                statusValue.textContent = '同步中...';
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-triangle';
                icon.style.color = '#ef4444';
                statusValue.textContent = '错误';
                break;
            default:
                icon.className = 'fas fa-circle';
                icon.style.color = '#6b7280';
                statusValue.textContent = '离线';
        }
        
        // 更新详细信息
        const clientIdDisplay = document.getElementById('clientIdDisplay');
        const pendingOpsDisplay = document.getElementById('pendingOpsDisplay');
        const conflictQueueDisplay = document.getElementById('conflictQueueDisplay');
        const lastSyncDisplay = document.getElementById('lastSyncDisplay');
        
        if (clientIdDisplay) clientIdDisplay.textContent = status.clientId.substr(-8);
        if (pendingOpsDisplay) pendingOpsDisplay.textContent = status.pendingOperations;
        if (conflictQueueDisplay) conflictQueueDisplay.textContent = status.conflictQueue;
        if (lastSyncDisplay) {
            lastSyncDisplay.textContent = status.lastSyncTime 
                ? new Date(status.lastSyncTime).toLocaleTimeString()
                : '从未';
        }
        
        // 更新状态面板
        this.updateStatusPanel(status);
    }
    
    /**
     * 更新状态面板
     */
    updateStatusPanel(status) {
        const networkStatus = document.getElementById('networkStatus');
        const cloudConnection = document.getElementById('cloudConnection');
        const syncMode = document.getElementById('syncMode');
        const queueLength = document.getElementById('queueLength');
        const offlineQueueLength = document.getElementById('offlineQueueLength');
        const processingStatus = document.getElementById('processingStatus');
        const conflictCount = document.getElementById('conflictCount');
        
        if (networkStatus) {
            networkStatus.textContent = navigator.onLine ? '在线' : '离线';
            networkStatus.className = navigator.onLine ? 'value online' : 'value offline';
        }
        
        if (cloudConnection) {
            cloudConnection.textContent = status.isConnected ? '已连接' : '未连接';
            cloudConnection.className = status.isConnected ? 'value connected' : 'value disconnected';
        }
        
        if (syncMode) {
            syncMode.textContent = status.isConnected ? '云端同步' : '本地模式';
        }
        
        if (queueLength) queueLength.textContent = status.operationQueue?.queueLength || 0;
        if (offlineQueueLength) offlineQueueLength.textContent = status.operationQueue?.offlineQueueLength || 0;
        if (processingStatus) processingStatus.textContent = status.operationQueue?.processing ? '是' : '否';
        if (conflictCount) conflictCount.textContent = status.conflictQueue;
    }
    
    /**
     * 显示冲突通知
     */
    showConflictNotification(conflict) {
        const notification = document.createElement('div');
        notification.className = 'conflict-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="notification-text">
                    <strong>检测到数据冲突</strong>
                    <p>${this.syncCoordinator.getConflictDescription(conflict)}</p>
                </div>
                <div class="notification-actions">
                    <button class="btn btn-sm btn-primary" onclick="syncUI.showConflictModal(); this.parentElement.parentElement.parentElement.remove();">
                        解决
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove();">
                        忽略
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
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
    
    // ========== 用户操作方法 ==========
    
    /**
     * 显示状态面板
     */
    showStatusPanel() {
        this.statusPanel.style.display = 'block';
        this.updateStatusDisplay();
    }
    
    /**
     * 显示冲突模态框
     */
    showConflictModal() {
        this.updateConflictDisplay();
        this.conflictModal.style.display = 'block';
    }
    
    /**
     * 隐藏冲突模态框
     */
    hideConflictModal() {
        this.conflictModal.style.display = 'none';
    }
    
    /**
     * 更新冲突显示
     */
    updateConflictDisplay() {
        const conflictList = document.getElementById('conflictList');
        if (!conflictList) return;
        
        const conflicts = this.syncCoordinator.getPendingConflicts();
        
        if (conflicts.length === 0) {
            conflictList.innerHTML = '<p class="no-conflicts">暂无待解决的冲突</p>';
            return;
        }
        
        conflictList.innerHTML = conflicts.map(conflict => `
            <div class="conflict-item" data-conflict-id="${conflict.id}">
                <div class="conflict-header">
                    <h4>${conflict.description}</h4>
                    <span class="conflict-time">${new Date(conflict.timestamp).toLocaleString()}</span>
                </div>
                <div class="conflict-details">
                    <div class="operation-comparison">
                        <div class="operation local">
                            <h5>本地操作</h5>
                            <pre>${JSON.stringify(conflict.localOperation, null, 2)}</pre>
                        </div>
                        <div class="operation remote">
                            <h5>远程操作</h5>
                            <pre>${JSON.stringify(conflict.remoteOperation, null, 2)}</pre>
                        </div>
                    </div>
                </div>
                <div class="conflict-actions">
                    <button class="btn btn-sm btn-success" onclick="syncUI.resolveConflict('${conflict.id}', 'accept_local')">
                        使用本地
                    </button>
                    <button class="btn btn-sm btn-info" onclick="syncUI.resolveConflict('${conflict.id}', 'accept_remote')">
                        使用远程
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="syncUI.resolveConflict('${conflict.id}', 'accept_merge')">
                        自动合并
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 手动同步
     */
    async manualSync() {
        try {
            await this.syncCoordinator.manualSync();
        } catch (error) {
            console.error('手动同步失败:', error);
        }
    }
    
    /**
     * 解决冲突
     */
    async resolveConflict(conflictId, resolutionType) {
        try {
            await this.syncCoordinator.resolveConflictManually(conflictId, {
                type: resolutionType
            });
            this.updateConflictDisplay();
        } catch (error) {
            this.showNotification('解决冲突失败: ' + error.message, 'error');
        }
    }
    
    /**
     * 自动解决所有冲突
     */
    async autoResolveAllConflicts() {
        const conflicts = this.syncCoordinator.getPendingConflicts();
        
        for (const conflict of conflicts) {
            try {
                await this.syncCoordinator.resolveConflictManually(conflict.id, {
                    type: 'accept_merge'
                });
            } catch (error) {
                console.error('自动解决冲突失败:', error);
            }
        }
        
        this.updateConflictDisplay();
        this.showNotification('已尝试自动解决所有冲突', 'info');
    }
    
    /**
     * 显示同步历史
     */
    showSyncHistory() {
        const history = this.syncCoordinator.getConflictHistory();
        // 这里可以实现一个历史记录模态框
        console.log('同步历史:', history);
        this.showNotification('同步历史已输出到控制台', 'info');
    }
    
    /**
     * 清空离线队列
     */
    clearOfflineQueue() {
        if (confirm('确定要清空离线操作队列吗？这将丢失所有未同步的离线操作。')) {
            localStorage.removeItem('offlineOperationQueue');
            this.showNotification('离线队列已清空', 'success');
            this.updateStatusDisplay();
        }
    }

    /**
     * 导出诊断信息
     */
    exportDiagnostics() {
        if (window.syncSystem) {
            window.syncSystem.exportDiagnostics();
        } else {
            this.showNotification('同步系统未初始化', 'error');
        }
    }

    /**
     * 显示高级选项
     */
    showAdvancedOptions() {
        const modal = document.createElement('div');
        modal.className = 'modal advanced-options-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>高级选项</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="option-section">
                        <h4>数据管理</h4>
                        <div class="option-buttons">
                            <button class="btn btn-info" onclick="syncUI.showDataInfo()">
                                <i class="fas fa-info-circle"></i> 数据信息
                            </button>
                            <button class="btn btn-warning" onclick="syncUI.restoreBackup()">
                                <i class="fas fa-undo"></i> 恢复备份
                            </button>
                            <button class="btn btn-danger" onclick="syncUI.cleanupSystem()">
                                <i class="fas fa-broom"></i> 清理系统
                            </button>
                        </div>
                    </div>

                    <div class="option-section">
                        <h4>同步模式</h4>
                        <div class="option-buttons">
                            <button class="btn btn-primary" onclick="syncUI.toggleSyncMode()">
                                <i class="fas fa-exchange-alt"></i> 切换同步模式
                            </button>
                            <button class="btn btn-secondary" onclick="syncUI.resetSyncSystem()">
                                <i class="fas fa-refresh"></i> 重置同步系统
                            </button>
                        </div>
                    </div>

                    <div class="option-section">
                        <h4>调试工具</h4>
                        <div class="option-buttons">
                            <button class="btn btn-info" onclick="syncUI.showDebugConsole()">
                                <i class="fas fa-terminal"></i> 调试控制台
                            </button>
                            <button class="btn btn-warning" onclick="syncUI.simulateConflict()">
                                <i class="fas fa-exclamation-triangle"></i> 模拟冲突
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        关闭
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        document.body.appendChild(modal);
    }

    /**
     * 显示数据信息
     */
    showDataInfo() {
        if (!window.syncSystem) {
            this.showNotification('同步系统未初始化', 'error');
            return;
        }

        const diagnostics = window.syncSystem.getDiagnostics();
        const info = `
数据统计:
- 生产数据: ${diagnostics.data.productionData.length || 0} 条
- 发货历史: ${diagnostics.data.shippingHistory.length || 0} 条
- 原材料采购: ${diagnostics.data.materialPurchases.length || 0} 条

系统状态:
- 迁移版本: ${diagnostics.migration.version || '未知'}
- 客户端ID: ${diagnostics.sync.clientId || '未知'}
- 连接状态: ${diagnostics.sync.isConnected ? '已连接' : '未连接'}
- 待处理操作: ${diagnostics.sync.pendingOperations || 0}
- 冲突队列: ${diagnostics.sync.conflictQueue || 0}
        `;

        alert(info);
    }

    /**
     * 恢复备份
     */
    restoreBackup() {
        if (window.syncSystem) {
            try {
                window.syncSystem.restoreDataBackup();
            } catch (error) {
                this.showNotification('恢复备份失败: ' + error.message, 'error');
            }
        } else {
            this.showNotification('同步系统未初始化', 'error');
        }
    }

    /**
     * 清理系统
     */
    cleanupSystem() {
        if (window.syncSystem) {
            window.syncSystem.cleanupSystem();
        } else {
            this.showNotification('同步系统未初始化', 'error');
        }
    }

    /**
     * 切换同步模式
     */
    toggleSyncMode() {
        if (window.syncSystem) {
            window.syncSystem.toggleSyncMode();
        } else {
            this.showNotification('同步系统未初始化', 'error');
        }
    }

    /**
     * 重置同步系统
     */
    resetSyncSystem() {
        if (confirm('确定要重置同步系统吗？这将重新初始化所有同步组件。')) {
            if (window.syncSystem) {
                window.syncSystem.destroy();
                setTimeout(() => {
                    window.initializeSyncSystem();
                }, 1000);
                this.showNotification('同步系统正在重置...', 'info');
            }
        }
    }

    /**
     * 显示调试控制台
     */
    showDebugConsole() {
        const diagnostics = window.syncSystem ? window.syncSystem.getDiagnostics() : null;
        console.group('🔧 同步系统调试信息');
        console.log('诊断数据:', diagnostics);
        console.log('同步协调器:', this.syncCoordinator);
        console.log('本地存储:', {
            productionData: localStorage.getItem('productionData'),
            shippingHistory: localStorage.getItem('shippingHistory'),
            offlineQueue: localStorage.getItem('offlineOperationQueue')
        });
        console.groupEnd();

        this.showNotification('调试信息已输出到控制台', 'info');
    }

    /**
     * 模拟冲突
     */
    simulateConflict() {
        if (!this.syncCoordinator) {
            this.showNotification('同步协调器未初始化', 'error');
            return;
        }

        // 创建模拟冲突
        const mockConflict = {
            id: `mock_conflict_${Date.now()}`,
            type: 'mock',
            description: '这是一个模拟冲突，用于测试冲突解决界面',
            localOperation: {
                type: 'update_production',
                targetId: 'test_id',
                changes: { quantity: 100 },
                timestamp: Date.now() - 1000
            },
            remoteOperation: {
                type: 'update_production',
                targetId: 'test_id',
                changes: { quantity: 150 },
                timestamp: Date.now()
            },
            suggestions: [
                { type: 'accept_local', description: '使用本地值 (100)' },
                { type: 'accept_remote', description: '使用远程值 (150)' },
                { type: 'accept_merge', description: '自动合并' }
            ],
            timestamp: Date.now()
        };

        this.syncCoordinator.conflictQueue.push(mockConflict);
        this.showConflictNotification(mockConflict);
        this.updateConflictDisplay();

        this.showNotification('已创建模拟冲突', 'info');
    }
}

// 导出类
window.SyncUI = SyncUI;

// 导出类
window.SyncUI = SyncUI;
