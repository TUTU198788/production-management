/**
 * Firebase 实时数据同步管理器
 * 支持多用户实时协作和数据同步
 */

class FirebaseSyncManager {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.isInitialized = false;
        this.listeners = new Map();
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        
        // 用户配置
        this.userConfig = {
            name: localStorage.getItem('userName') || '用户' + Math.floor(Math.random() * 1000),
            color: localStorage.getItem('userColor') || this.generateUserColor(),
            id: localStorage.getItem('userId') || this.generateUserId()
        };
        
        // 保存用户配置
        localStorage.setItem('userName', this.userConfig.name);
        localStorage.setItem('userColor', this.userConfig.color);
        localStorage.setItem('userId', this.userConfig.id);
        
        console.log('FirebaseSyncManager 初始化完成', this.userConfig);
        
        // 监听网络状态
        this.setupNetworkListeners();
    }
    
    // 初始化 Firebase
    async initialize(config) {
        try {
            console.log('开始初始化Firebase，配置:', config);

            // 等待Firebase SDK加载
            let retries = 0;
            while (!window.firebaseDB && retries < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }

            if (!window.firebaseDB) {
                throw new Error('Firebase SDK 未加载，请确保已引入 Firebase 脚本');
            }

            console.log('Firebase SDK v10已加载');

            // 使用全局Firebase实例
            this.db = window.firebaseDB;
            this.auth = window.firebaseAuth;
            console.log('Firebase服务获取成功');

            // 测试Firebase连接
            console.log('正在测试Firebase连接...');
            await this.testFirebaseConnection();

            // 启用离线持久化 (使用全局Firebase函数)
            try {
                if (window.enablePersistentCacheIndexAutoCreation) {
                    await window.enablePersistentCacheIndexAutoCreation(this.db);
                    console.log('Firebase离线持久化已启用');
                }
            } catch (err) {
                console.warn('Firebase 离线持久化启用失败:', err);
                // 持久化失败不影响基本功能
            }

            // 尝试匿名登录，如果失败则使用本地模式
            console.log('正在进行匿名登录...');
            try {
                if (window.signInAnonymously) {
                    await window.signInAnonymously(this.auth);
                    this.currentUser = this.auth.currentUser;
                    console.log('匿名登录成功，用户ID:', this.currentUser.uid);

                    this.isInitialized = true;
                    console.log('✅ Firebase 初始化完全成功（云端模式）');

                    // 开始监听数据变化
                    this.startRealtimeSync();

                    // 初始化完成后，执行数据同步
                    setTimeout(async () => {
                        console.log('🚀 开始执行初始数据同步...');
                        await this.performInitialSync();
                    }, 2000); // 延长到2秒，确保DataManager已加载

                    this.showNotification('云端同步已启用，支持多用户协作', 'success');
                } else {
                    throw new Error('signInAnonymously 函数未找到');
                }
            } catch (authError) {
                console.warn('匿名登录失败，切换到本地优先模式:', authError);

                // 设置本地模式
                this.isInitialized = false; // 标记为未完全初始化
                this.currentUser = { uid: 'local_user_' + Date.now() };
                console.log('✅ Firebase 初始化完成（本地优先模式）');

                this.showNotification('使用本地存储模式，数据仅保存在本地', 'warning');

                // 如果是管理员限制错误，提供解决方案
                if (authError.code === 'auth/admin-restricted-operation') {
                    this.showNotification('检测到Firebase管理员限制，请启用匿名登录以使用云端同步', 'error');
                    this.showAuthSolution();
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Firebase 初始化失败:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            this.showNotification('云端同步初始化失败，将使用本地存储', 'warning');
            return false;
        }
    }

    // 显示认证解决方案
    showAuthSolution() {
        const solutionDiv = document.createElement('div');
        solutionDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            max-width: 300px;
            z-index: 10001;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        solutionDiv.innerHTML = `
            <div style="color: #92400e; font-weight: bold; margin-bottom: 8px;">
                🔧 启用云端同步
            </div>
            <div style="color: #92400e; font-size: 13px; margin-bottom: 10px;">
                需要在Firebase控制台启用匿名登录
            </div>
            <button onclick="window.open('https://console.firebase.google.com/project/zhlscglxt/authentication/providers', '_blank')"
                    style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                打开设置
            </button>
            <button onclick="this.parentElement.remove()"
                    style="background: #6b7280; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 5px;">
                关闭
            </button>
        `;
        document.body.appendChild(solutionDiv);

        // 10秒后自动关闭
        setTimeout(() => {
            if (solutionDiv.parentElement) {
                solutionDiv.remove();
            }
        }, 10000);
    }

    // 测试Firebase连接
    async testFirebaseConnection() {
        try {
            console.log('🧪 开始测试Firebase连接...');

            // 测试写入
            if (window.collection && window.doc && window.setDoc && window.getDoc) {
                const testData = {
                    message: 'Firebase连接测试',
                    timestamp: Date.now(),
                    user: this.userConfig.name,
                    testId: Math.random().toString(36).substr(2, 9)
                };

                const testDocRef = window.doc(window.collection(this.db, 'connectionTest'), 'test_' + Date.now());

                // 测试写入
                console.log('测试写入数据...');
                await window.setDoc(testDocRef, testData);
                console.log('✅ 写入测试成功');

                // 测试读取
                console.log('测试读取数据...');
                const docSnap = await window.getDoc(testDocRef);
                if (docSnap.exists()) {
                    console.log('✅ 读取测试成功，数据:', docSnap.data());
                } else {
                    console.warn('⚠️ 文档不存在');
                }

                console.log('✅ Firebase连接测试完全成功');
                return true;
            } else {
                console.warn('⚠️ Firebase函数未完全加载，跳过连接测试');
                return false;
            }
        } catch (error) {
            console.error('❌ Firebase连接测试失败:', error);
            return false;
        }
    }
    
    // 生成用户ID
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 生成用户颜色
    generateUserColor() {
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // 设置网络监听
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showNotification('网络已连接，开始同步数据', 'success');
            if (this.isInitialized) {
                this.processSyncQueue();
            }
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showNotification('网络已断开，数据将保存在本地', 'warning');
        });
    }
    
    // 开始实时同步
    startRealtimeSync() {
        if (!this.isInitialized) return;

        // 监听生产数据变化
        this.listenToCollection('productionData', (data) => {
            if (window.dataManager) {
                window.dataManager.handleRemoteDataUpdate(data);
            }
        });

        // 监听发货历史变化
        this.listenToCollection('shippingHistory', (data) => {
            if (window.dataManager) {
                window.dataManager.handleRemoteShippingUpdate(data);
            }
        });

        // 监听原材料采购变化
        this.listenToCollection('materialPurchases', (data) => {
            if (window.dataManager) {
                window.dataManager.handleRemoteMaterialUpdate(data);
            }
        });

        // 监听在线用户
        this.listenToOnlineUsers();
    }

    // 暂停实时同步
    pauseRealtimeSync() {
        console.log('⏸️ 暂停实时同步监听器');
        this.realtimeSyncPaused = true;
    }

    // 恢复实时同步
    resumeRealtimeSync() {
        console.log('▶️ 恢复实时同步监听器');
        this.realtimeSyncPaused = false;
    }
    
    // 监听集合变化
    async listenToCollection(collectionName, callback) {
        if (!this.isInitialized) return;

        try {
            // 使用全局Firebase函数
            if (!window.collection || !window.query || !window.orderBy || !window.limit || !window.onSnapshot) {
                console.error('Firebase Firestore 函数未加载');
                return;
            }

            // 创建查询，处理可能的错误
            let q;
            try {
                q = window.query(
                    window.collection(this.db, collectionName),
                    window.limit(1000)
                );
            } catch (queryError) {
                console.warn(`创建 ${collectionName} 查询失败:`, queryError);
                return;
            }

            const unsubscribe = window.onSnapshot(q, (snapshot) => {
                // 检查实时同步是否被暂停
                if (this.realtimeSyncPaused) {
                    console.log(`⏸️ 实时同步已暂停，跳过 ${collectionName} 更新`);
                    return;
                }

                // 检查是否正在手动同步，如果是则跳过处理
                if (window.dataManager && window.dataManager.isManualSyncing) {
                    console.log(`⏸️ 手动同步进行中，跳过 ${collectionName} 实时更新`);
                    return;
                }

                // 检查是否刚完成手动同步（10秒内）
                const timeSinceManualSync = Date.now() - (window.dataManager?.lastManualSyncTime || 0);
                if (timeSinceManualSync < 10000) {
                    console.log(`⏸️ 刚完成手动同步，跳过 ${collectionName} 实时更新`);
                    return;
                }

                const data = [];
                snapshot.forEach(doc => {
                    data.push({ id: doc.id, ...doc.data() });
                });

                console.log(`🔄 ${collectionName} 实时更新:`, data.length, '条记录');
                callback(data);
            }, (error) => {
                console.error(`监听 ${collectionName} 失败:`, error);
            });

            this.listeners.set(collectionName, unsubscribe);
        } catch (error) {
            console.error(`设置 ${collectionName} 监听失败:`, error);
        }
    }
    
    // 执行初始数据同步
    async performInitialSync() {
        if (!this.isInitialized) {
            console.warn('Firebase未初始化，跳过初始同步');
            return;
        }

        console.log('🔄 开始执行初始数据同步...');

        try {
            // 等待DataManager加载完成
            let retries = 0;
            while (!window.dataManager && retries < 50) {
                console.log(`等待DataManager加载... (${retries + 1}/50)`);
                await new Promise(resolve => setTimeout(resolve, 200));
                retries++;
            }

            if (!window.dataManager) {
                console.error('❌ DataManager未加载，跳过初始同步');
                return;
            }

            console.log('✅ DataManager已加载，开始数据同步');
            console.log('当前本地数据状态:', {
                productionData: window.dataManager.data?.length || 0,
                shippingHistory: window.dataManager.shippingHistory?.length || 0,
                materialPurchases: window.dataManager.materialPurchases?.length || 0
            });

            // 智能分析本地数据状态
            const localDataInfo = this.analyzeLocalData();
            console.log('📊 本地数据分析:', localDataInfo);

            if (localDataInfo.hasData) {
                if (localDataInfo.isRecent) {
                    // 本地数据较新，优先保护本地数据
                    console.log('🛡️ 本地数据较新，优先保护本地数据');

                    // 先上传本地数据到云端
                    await this.uploadLocalDataToCloud();

                    // 然后智能合并云端数据（不覆盖本地新数据）
                    await this.smartMergeFromCloud();
                } else {
                    // 本地数据较旧，但仍要保护重要修改
                    console.log('📥 本地数据较旧，智能合并云端数据');

                    // 先智能合并云端数据
                    await this.smartMergeFromCloud();

                    // 然后上传合并后的数据
                    await this.uploadLocalDataToCloud();
                }
            } else {
                // 本地无数据，直接从云端加载
                console.log('📥 本地无数据，从云端加载');
                await this.loadDataFromCloud();
            }

            console.log('✅ 智能数据同步完成');

            // 显示同步完成通知
            this.showNotification('数据同步完成，本地数据已受到保护', 'success');

        } catch (error) {
            console.error('❌ 数据同步失败:', error);
            this.showNotification('数据同步失败，本地数据已保留: ' + error.message, 'warning');
        }
    }

    // 分析本地数据的新鲜度和重要性
    analyzeLocalData() {
        const now = Date.now();
        const recentThreshold = 24 * 60 * 60 * 1000; // 24小时

        let hasData = false;
        let latestModified = 0;
        let totalRecords = 0;
        let recentModifications = 0;

        // 检查生产数据
        if (window.dataManager.data && window.dataManager.data.length > 0) {
            hasData = true;
            totalRecords += window.dataManager.data.length;
            window.dataManager.data.forEach(item => {
                const modified = item.lastModified || item.timestamp || 0;
                latestModified = Math.max(latestModified, modified);
                if ((now - modified) < recentThreshold) {
                    recentModifications++;
                }
            });
        }

        // 检查发货历史
        if (window.dataManager.shippingHistory && window.dataManager.shippingHistory.length > 0) {
            hasData = true;
            totalRecords += window.dataManager.shippingHistory.length;
            window.dataManager.shippingHistory.forEach(item => {
                const modified = item.lastModified || item.timestamp || 0;
                latestModified = Math.max(latestModified, modified);
                if ((now - modified) < recentThreshold) {
                    recentModifications++;
                }
            });
        }

        // 检查原材料数据
        if (window.dataManager.materialPurchases && window.dataManager.materialPurchases.length > 0) {
            hasData = true;
            totalRecords += window.dataManager.materialPurchases.length;
            window.dataManager.materialPurchases.forEach(item => {
                const modified = item.lastModified || item.timestamp || 0;
                latestModified = Math.max(latestModified, modified);
                if ((now - modified) < recentThreshold) {
                    recentModifications++;
                }
            });
        }

        const isRecent = (now - latestModified) < recentThreshold || recentModifications > 0;

        return {
            hasData,
            isRecent,
            totalRecords,
            recentModifications,
            latestModified,
            ageInHours: Math.round((now - latestModified) / (60 * 60 * 1000))
        };
    }

    // 智能合并云端数据（保护本地数据）
    async smartMergeFromCloud() {
        if (!this.isInitialized) return;

        console.log('🧠 开始智能合并云端数据...');

        try {
            // 备份当前本地数据
            const localBackup = {
                productionData: [...(window.dataManager.data || [])],
                shippingHistory: [...(window.dataManager.shippingHistory || [])],
                materialPurchases: [...(window.dataManager.materialPurchases || [])]
            };

            // 暂停实时同步，避免冲突
            this.pauseRealtimeSync();

            // 智能加载各个集合
            await this.smartLoadCollection('productionData', localBackup.productionData);
            await this.smartLoadCollection('shippingHistory', localBackup.shippingHistory);
            await this.smartLoadCollection('materialPurchases', localBackup.materialPurchases);

            // 恢复实时同步
            setTimeout(() => {
                this.resumeRealtimeSync();
            }, 2000);

            console.log('✅ 智能合并完成');

        } catch (error) {
            console.error('❌ 智能合并失败:', error);
            // 恢复实时同步
            this.resumeRealtimeSync();
        }
    }

    // 智能加载单个集合（保护本地数据）
    async smartLoadCollection(collectionName, localData) {
        if (!this.isInitialized) return;

        try {
            console.log(`🧠 智能加载 ${collectionName}...`);

            // 从云端获取数据
            const q = window.query(
                window.collection(this.db, collectionName),
                window.limit(1000)
            );

            const snapshot = await window.getDocs(q);
            const cloudData = [];
            snapshot.forEach(doc => {
                cloudData.push({ id: doc.id, ...doc.data() });
            });

            console.log(`云端 ${collectionName}: ${cloudData.length} 条，本地: ${localData.length} 条`);

            if (cloudData.length === 0) {
                console.log(`云端 ${collectionName} 为空，保持本地数据`);
                return;
            }

            if (localData.length === 0) {
                console.log(`本地 ${collectionName} 为空，使用云端数据`);
                this.applyCloudDataToLocal(collectionName, cloudData);
                return;
            }

            // 智能合并数据
            const mergedData = this.intelligentMerge(localData, cloudData);
            console.log(`${collectionName} 合并结果: ${mergedData.length} 条记录`);

            // 应用合并结果
            this.applyMergedDataToLocal(collectionName, mergedData);

        } catch (error) {
            console.error(`智能加载 ${collectionName} 失败:`, error);
        }
    }

    // 智能合并算法（优先保护本地数据）
    intelligentMerge(localData, cloudData) {
        const merged = new Map();
        const now = Date.now();
        const protectionWindow = 60 * 60 * 1000; // 1小时保护窗口

        // 先添加本地数据（优先级最高）
        localData.forEach(item => {
            if (!item || !item.id) return;

            const itemAge = now - (item.lastModified || item.timestamp || 0);
            const isProtected = itemAge < protectionWindow; // 1小时内的修改受保护

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
                // 新的云端数据，直接添加
                merged.set(itemId, {
                    ...item,
                    source: 'cloud',
                    priority: 30
                });
            } else if (!existing.isProtected) {
                // 本地数据未受保护，可以考虑云端数据
                const localTime = existing.lastModified || existing.timestamp || 0;
                const cloudTime = item.lastModified || item.timestamp || 0;

                if (cloudTime > localTime + 30000) { // 云端数据比本地新30秒以上
                    console.log(`使用较新的云端数据: ${itemId}`);
                    merged.set(itemId, {
                        ...item,
                        source: 'cloud_newer',
                        priority: 60
                    });
                }
            }
            // 如果本地数据受保护，忽略云端数据
        });

        return Array.from(merged.values()).map(item => {
            // 清理临时字段
            const { source, isProtected, priority, ...cleanItem } = item;
            return cleanItem;
        });
    }

    // 应用云端数据到本地
    applyCloudDataToLocal(collectionName, data) {
        if (!window.dataManager) return;

        if (collectionName === 'productionData') {
            window.dataManager.data = [...data];
            window.dataManager.filteredData = [...data];
            localStorage.setItem('productionData', JSON.stringify(data));
        } else if (collectionName === 'shippingHistory') {
            window.dataManager.shippingHistory = [...data];
            localStorage.setItem('shippingHistory', JSON.stringify(data));
        } else if (collectionName === 'materialPurchases') {
            window.dataManager.materialPurchases = [...data];
            localStorage.setItem('materialPurchases', JSON.stringify(data));
        }

        // 刷新界面
        this.refreshUI();
    }

    // 应用合并数据到本地
    applyMergedDataToLocal(collectionName, mergedData) {
        this.applyCloudDataToLocal(collectionName, mergedData);
    }

    // 刷新用户界面
    refreshUI() {
        setTimeout(() => {
            if (window.dataManager) {
                window.dataManager.renderTable();
                window.dataManager.updateStats();
                window.dataManager.renderAreaStats();
                window.dataManager.renderUnproducedStats();
                window.dataManager.renderCustomerStats();
                window.dataManager.forceUpdateDashboard();
            }
        }, 100);
    }

    // 从云端加载数据
    async loadDataFromCloud() {
        if (!this.isInitialized) return;

        console.log('📥 从云端加载数据...');

        try {
            // 加载生产数据
            await this.loadCollectionFromCloud('productionData');

            // 加载发货历史
            await this.loadCollectionFromCloud('shippingHistory');

            // 加载原材料采购
            await this.loadCollectionFromCloud('materialPurchases');

        } catch (error) {
            console.error('从云端加载数据失败:', error);
        }
    }

    // 从云端加载指定集合的数据
    async loadCollectionFromCloud(collectionName) {
        if (!this.isInitialized) return;

        try {
            if (!window.collection || !window.query || !window.getDocs || !window.orderBy || !window.limit) {
                console.error('Firebase Firestore 函数未完全加载');
                return;
            }

            console.log(`正在从云端加载 ${collectionName}...`);

            // 创建查询，但要处理可能没有timestamp字段的情况
            let q;
            try {
                q = window.query(
                    window.collection(this.db, collectionName),
                    window.limit(1000)
                );
            } catch (queryError) {
                console.warn(`创建查询失败，使用简单查询:`, queryError);
                q = window.collection(this.db, collectionName);
            }

            const snapshot = await window.getDocs(q);
            const data = [];
            snapshot.forEach(doc => {
                data.push({ id: doc.id, ...doc.data() });
            });

            console.log(`从云端加载 ${collectionName}:`, data.length, '条记录');

            // 通知DataManager处理远程数据
            if (window.dataManager) {
                // 检查本地是否有数据
                const hasLocalData = (collectionName === 'productionData' && window.dataManager.data.length > 0) ||
                                   (collectionName === 'shippingHistory' && window.dataManager.shippingHistory.length > 0) ||
                                   (collectionName === 'materialPurchases' && window.dataManager.materialPurchases.length > 0);

                // 如果云端有数据，或者本地没有数据，才处理远程数据
                if (data.length > 0 || !hasLocalData) {
                    console.log(`处理远程 ${collectionName} 数据: ${data.length} 条记录，本地有数据: ${hasLocalData}`);

                    if (collectionName === 'productionData') {
                        window.dataManager.handleRemoteDataUpdate(data);
                    } else if (collectionName === 'shippingHistory') {
                        window.dataManager.handleRemoteShippingUpdate(data);
                    } else if (collectionName === 'materialPurchases') {
                        window.dataManager.handleRemoteMaterialUpdate(data);
                    }
                } else {
                    console.log(`跳过空的远程 ${collectionName} 数据，保护本地数据`);
                }

                // 强制刷新主界面统计数据（增强版本）
                setTimeout(() => {
                    if (window.dashboard) {
                        console.log('🔄 Firebase同步完成，强制刷新主界面');

                        // 多层次更新确保数据正确显示
                        window.dashboard.updateMetricsFromDataManager();

                        // 延迟更新图表
                        setTimeout(() => {
                            window.dashboard.updateCharts();
                        }, 100);

                        // 最后验证更新结果
                        setTimeout(() => {
                            const metrics = window.dashboard.data?.totalDemandMeters || 0;
                            const dataLength = window.dataManager?.data?.length || 0;

                            if (dataLength > 0 && metrics === 0) {
                                console.log('⚠️ Firebase同步后主界面仍显示0，执行修复...');
                                window.dashboard.deepDataSync();
                            } else {
                                console.log('✅ Firebase同步后主界面更新正常');
                            }
                        }, 500);
                    }
                }, 200);
            }

        } catch (error) {
            console.error(`从云端加载 ${collectionName} 失败:`, error);
        }
    }

    // 将本地数据上传到云端
    async uploadLocalDataToCloud() {
        if (!this.isInitialized || !window.dataManager) return;

        console.log('📤 上传本地数据到云端...');

        try {
            // === 新增：上传前先拉取云端数据并合并 ===
            const collections = [
                { name: 'productionData', local: window.dataManager.data },
                { name: 'shippingHistory', local: window.dataManager.shippingHistory },
                { name: 'materialPurchases', local: window.dataManager.materialPurchases }
            ];
            for (const col of collections) {
                if (col.local && col.local.length > 0) {
                    // 拉取云端数据
                    const q = window.query(
                        window.collection(this.db, col.name),
                        window.limit(1000)
                    );
                    const snapshot = await window.getDocs(q);
                    const cloudData = [];
                    snapshot.forEach(doc => {
                        cloudData.push({ id: doc.id, ...doc.data() });
                    });
                    // 合并本地和云端
                    const merged = this.intelligentMerge(col.local, cloudData);
                    // 上传合并结果
                    await this.syncToCloud(col.name, merged);
                }
            }
            console.log('✅ 本地数据上传并合并完成');
        } catch (error) {
            console.error('❌ 上传本地数据失败:', error);
        }
    }

    // 监听在线用户
    async listenToOnlineUsers() {
        if (!this.isInitialized) return;

        // 更新自己的在线状态
        this.updateUserPresence();

        try {
            // 使用全局Firebase函数
            if (!window.collection || !window.query || !window.where || !window.onSnapshot) {
                console.error('Firebase Firestore 函数未加载');
                return;
            }

            const q = window.query(
                window.collection(this.db, 'onlineUsers'),
                window.where('lastSeen', '>', Date.now() - 60000) // 1分钟内活跃
            );

            const unsubscribe = window.onSnapshot(q, (snapshot) => {
                const onlineUsers = [];
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    if (userData.userId !== this.userConfig.id) {
                        onlineUsers.push(userData);
                    }
                });
                this.showOnlineUsers(onlineUsers);
            });

            this.listeners.set('onlineUsers', unsubscribe);
        } catch (error) {
            console.error('设置在线用户监听失败:', error);
        }

        // 定期更新在线状态
        setInterval(() => {
            this.updateUserPresence();
        }, 30000); // 30秒更新一次
    }
    
    // 更新用户在线状态
    async updateUserPresence() {
        if (!this.isInitialized) return;

        try {
            // 使用全局Firebase函数
            if (!window.collection || !window.doc || !window.setDoc || !window.serverTimestamp) {
                console.error('Firebase Firestore 函数未加载');
                return;
            }

            await window.setDoc(window.doc(window.collection(this.db, 'onlineUsers'), this.userConfig.id), {
                userId: this.userConfig.id,
                name: this.userConfig.name,
                color: this.userConfig.color,
                lastSeen: Date.now(),
                timestamp: window.serverTimestamp()
            });
        } catch (error) {
            console.error('更新用户在线状态失败:', error);
        }
    }
    
    // 同步数据到云端
    async syncToCloud(collectionName, data, operation = 'update') {
        if (!this.isInitialized) {
            // 添加到同步队列
            this.syncQueue.push({ collectionName, data, operation });
            return false;
        }

        try {
            // 使用全局Firebase函数
            if (!window.collection || !window.doc || !window.writeBatch || !window.serverTimestamp) {
                console.error('Firebase Firestore 函数未加载');
                return false;
            }

            console.log(`开始同步 ${collectionName} 到云端，数据量:`, Array.isArray(data) ? data.length : 1);

            const batch = window.writeBatch(this.db);

            // 安全地获取服务器时间戳
            let timestamp;
            try {
                timestamp = window.serverTimestamp ? window.serverTimestamp() : Date.now();
            } catch (timestampError) {
                console.warn('获取服务器时间戳失败，使用本地时间:', timestampError);
                timestamp = Date.now();
            }

            if (operation === 'update' && Array.isArray(data)) {
                // 批量更新
                if (data.length === 0) {
                    console.log(`${collectionName} 数据为空，跳过同步`);
                    return true;
                }

                data.forEach((item, index) => {
                    try {
                        // 确保item是对象
                        if (!item || typeof item !== 'object') {
                            console.warn(`跳过无效数据项 ${index}:`, item);
                            return;
                        }

                        // 确保ID是字符串
                        const docId = String(item.id || this.generateDocId());
                        const docRef = window.doc(window.collection(this.db, collectionName), docId);

                        // 创建文档数据，确保所有字段都是有效的
                        const docData = {
                            ...item,
                            // 保持原有的时间戳和版本信息，不要覆盖
                            timestamp: item.timestamp || timestamp,
                            lastModified: item.lastModified || Date.now(),
                            version: (item.version || 1) + 1, // 递增版本号
                            lastModifiedBy: this.userConfig.id,
                            lastModifiedByName: this.userConfig.name,
                            syncedAt: Date.now()
                        };

                        // 清理可能导致问题的字段
                        Object.keys(docData).forEach(key => {
                            if (docData[key] === undefined) {
                                delete docData[key];
                            }
                        });

                        batch.set(docRef, docData, { merge: true });

                        if (index < 3) { // 只打印前3条的详细信息
                            console.log(`准备同步文档 ${docId}:`, docData);
                        }
                    } catch (itemError) {
                        console.error(`处理第 ${index} 条数据时出错:`, itemError, item);
                    }
                });
            } else if (operation === 'delete') {
                // 删除操作
                const docRef = window.doc(window.collection(this.db, collectionName), data.id);
                batch.delete(docRef);
            }

            console.log(`提交 ${collectionName} 批量写入...`);
            await batch.commit();
            console.log(`✅ ${collectionName} 同步到云端成功，共 ${Array.isArray(data) ? data.length : 1} 条记录`);
            return true;
        } catch (error) {
            console.error(`${collectionName} 同步到云端失败:`, error);
            // 添加到同步队列稍后重试
            this.syncQueue.push({ collectionName, data, operation });
            return false;
        }
    }
    
    // 处理同步队列
    async processSyncQueue() {
        if (!this.isOnline || !this.isInitialized || this.syncQueue.length === 0) {
            return;
        }
        
        console.log(`处理同步队列，共 ${this.syncQueue.length} 项`);
        
        const queue = [...this.syncQueue];
        this.syncQueue = [];
        
        for (const item of queue) {
            const success = await this.syncToCloud(item.collectionName, item.data, item.operation);
            if (!success) {
                // 如果失败，重新加入队列
                this.syncQueue.push(item);
            }
        }
    }
    
    // 生成文档ID
    generateDocId() {
        return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 显示在线用户
    showOnlineUsers(users) {
        // 在页面上显示在线用户列表
        let userListElement = document.getElementById('onlineUsersList');
        if (!userListElement) {
            // 创建在线用户显示区域
            userListElement = document.createElement('div');
            userListElement.id = 'onlineUsersList';
            userListElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                max-width: 200px;
            `;
            document.body.appendChild(userListElement);
        }
        
        if (users.length === 0) {
            userListElement.innerHTML = `
                <div style="font-size: 12px; color: #6b7280;">
                    <i class="fas fa-user"></i> 只有您在线
                </div>
            `;
        } else {
            const userItems = users.map(user => `
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${user.color};"></div>
                    <span style="font-size: 12px; color: #374151;">${user.name}</span>
                </div>
            `).join('');
            
            userListElement.innerHTML = `
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                    <i class="fas fa-users"></i> 在线用户 (${users.length + 1})
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.userConfig.color};"></div>
                    <span style="font-size: 12px; color: #374151; font-weight: 500;">${this.userConfig.name} (您)</span>
                </div>
                ${userItems}
            `;
        }
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // 清理监听器
    cleanup() {
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
    }
    
    // 检查是否已配置
    isConfigured() {
        return this.isInitialized;
    }

    // 检查是否已连接
    isConnected() {
        return this.isInitialized && this.currentUser && this.db;
    }

    // 获取连接状态
    getConnectionStatus() {
        return {
            initialized: this.isInitialized,
            hasUser: !!this.currentUser,
            hasDatabase: !!this.db,
            isOnline: this.isOnline,
            userConfig: this.userConfig
        };
    }

    // 断开连接
    disconnect() {
        this.isInitialized = false;
        this.userConfig = null;
        this.cleanup();
        console.log('Firebase连接已断开');
    }

    // 清空集合
    async clearCollection(collectionName) {
        if (!this.isInitialized) {
            throw new Error('Firebase未初始化');
        }

        try {
            console.log(`🗑️ 开始清空集合: ${collectionName}`);

            // 获取集合中的所有文档
            const collectionRef = window.collection(this.db, collectionName);
            const snapshot = await window.getDocs(collectionRef);

            if (snapshot.empty) {
                console.log(`集合 ${collectionName} 已经为空`);
                return;
            }

            // 批量删除文档
            const batch = window.writeBatch(this.db);
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log(`✅ 集合 ${collectionName} 已清空，删除了 ${snapshot.docs.length} 个文档`);

        } catch (error) {
            console.error(`❌ 清空集合 ${collectionName} 失败:`, error);
            throw error;
        }
    }
}

// 全局实例
window.firebaseSync = new FirebaseSyncManager();

// 版本标识
console.log('🔄 Firebase同步管理器已加载 - 版本: 2024-12-21-v4 (激进修复：本地数据优先)');
