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

            // 启用离线持久化 (v10语法)
            try {
                const { enablePersistentCacheIndexAutoCreation } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                await enablePersistentCacheIndexAutoCreation(this.db);
                console.log('Firebase离线持久化已启用');
            } catch (err) {
                console.warn('Firebase 离线持久化启用失败:', err);
                // 持久化失败不影响基本功能
            }

            // 匿名登录 (v10语法)
            console.log('正在进行匿名登录...');
            const { signInAnonymously } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            await signInAnonymously(this.auth);
            this.currentUser = this.auth.currentUser;
            console.log('匿名登录成功，用户ID:', this.currentUser.uid);

            this.isInitialized = true;
            console.log('✅ Firebase 初始化完全成功');

            // 开始监听数据变化
            this.startRealtimeSync();

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
            const { collection, query, orderBy, limit, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const q = query(
                collection(this.db, collectionName),
                orderBy('timestamp', 'desc'),
                limit(1000)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
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
            const { collection, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const q = query(
                collection(this.db, 'onlineUsers'),
                where('lastSeen', '>', Date.now() - 60000) // 1分钟内活跃
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
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
            const { collection, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            await setDoc(doc(collection(this.db, 'onlineUsers'), this.userConfig.id), {
                userId: this.userConfig.id,
                name: this.userConfig.name,
                color: this.userConfig.color,
                lastSeen: Date.now(),
                timestamp: serverTimestamp()
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
            const { collection, doc, writeBatch, setDoc, deleteDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const batch = writeBatch(this.db);
            const timestamp = serverTimestamp();

            if (operation === 'update' && Array.isArray(data)) {
                // 批量更新
                data.forEach(item => {
                    const docRef = doc(collection(this.db, collectionName), item.id || this.generateDocId());
                    batch.set(docRef, {
                        ...item,
                        timestamp,
                        lastModifiedBy: this.userConfig.id,
                        lastModifiedByName: this.userConfig.name
                    }, { merge: true });
                });
            } else if (operation === 'delete') {
                // 删除操作
                const docRef = doc(collection(this.db, collectionName), data.id);
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
