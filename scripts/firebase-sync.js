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
            // 尝试读取一个简单的文档来测试连接
            if (window.collection && window.doc && window.getDoc) {
                const testDocRef = window.doc(window.collection(this.db, 'test'), 'connection');
                await window.getDoc(testDocRef);
                console.log('✅ Firebase连接测试成功');
            } else {
                console.warn('⚠️ Firebase函数未完全加载，跳过连接测试');
            }
        } catch (error) {
            console.warn('⚠️ Firebase连接测试失败:', error);
            // 连接测试失败不阻止初始化，可能是权限问题
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
    
    // 监听集合变化
    async listenToCollection(collectionName, callback) {
        if (!this.isInitialized) return;

        try {
            // 使用全局Firebase函数
            if (!window.collection || !window.query || !window.orderBy || !window.limit || !window.onSnapshot) {
                console.error('Firebase Firestore 函数未加载');
                return;
            }

            const q = window.query(
                window.collection(this.db, collectionName),
                window.orderBy('timestamp', 'desc'),
                window.limit(1000)
            );

            const unsubscribe = window.onSnapshot(q, (snapshot) => {
                const data = [];
                snapshot.forEach(doc => {
                    data.push({ id: doc.id, ...doc.data() });
                });
                callback(data);
            }, (error) => {
                console.error(`监听 ${collectionName} 失败:`, error);
            });

            this.listeners.set(collectionName, unsubscribe);
        } catch (error) {
            console.error(`设置 ${collectionName} 监听失败:`, error);
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

            const batch = window.writeBatch(this.db);
            const timestamp = window.serverTimestamp();

            if (operation === 'update' && Array.isArray(data)) {
                // 批量更新
                data.forEach(item => {
                    const docRef = window.doc(window.collection(this.db, collectionName), item.id || this.generateDocId());
                    batch.set(docRef, {
                        ...item,
                        timestamp,
                        lastModifiedBy: this.userConfig.id,
                        lastModifiedByName: this.userConfig.name
                    }, { merge: true });
                });
            } else if (operation === 'delete') {
                // 删除操作
                const docRef = window.doc(window.collection(this.db, collectionName), data.id);
                batch.delete(docRef);
            }

            await batch.commit();
            console.log(`${collectionName} 同步到云端成功`);
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
}

// 全局实例
window.firebaseSync = new FirebaseSyncManager();
