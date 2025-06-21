/**
 * Firebase 配置文件
 * 请替换为您自己的 Firebase 项目配置
 */

// Firebase 项目配置 - 如果连接失败，系统会自动使用本地存储
const firebaseConfig = {
    apiKey: "AIzaSyDAtk4_l580AfAQYh0aGeykavDYfnflbKc",
    authDomain: "zhlscglxt.firebaseapp.com",
    projectId: "zhlscglxt",
    storageBucket: "zhlscglxt.firebasestorage.app",
    messagingSenderId: "36495989654",
    appId: "1:36495989654:web:3ad7266c9832ff25569185"
};

// 系统配置选项
const systemConfig = {
    // 设置为 true 禁用Firebase，只使用本地存储
    // 设置为 false 尝试连接Firebase
    disableFirebase: false,

    // Firebase连接超时时间（毫秒）
    firebaseTimeout: 8000,

    // 是否显示详细的连接日志
    enableDebugLogs: true
};

// 初始化 Firebase 同步
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 开始初始化Firebase...');

    // 检查用户是否禁用了Firebase
    const userDisabledFirebase = localStorage.getItem('disableFirebase') === 'true';
    if (systemConfig.disableFirebase || userDisabledFirebase) {
        console.log('📱 Firebase已禁用，使用本地存储模式');
        showNotification('系统使用本地存储模式，数据保存在浏览器中', 'info');
        return;
    }

    // 检查配置是否已设置
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn('⚠️ Firebase 配置未设置，请在 firebase-config.js 中配置您的 Firebase 项目信息');
        showFirebaseConfigModal();
        return;
    }

    // 等待一段时间确保所有脚本加载完成
    setTimeout(async () => {
        try {
            // 检查网络连接
            if (!navigator.onLine) {
                console.log('🔌 网络未连接，使用本地存储模式');
                showNotification('网络未连接，使用本地存储模式', 'warning');
                return;
            }

            // 检查Firebase SDK是否加载
            if (typeof firebase === 'undefined') {
                console.error('❌ Firebase SDK未加载，将使用本地存储模式');
                showNotification('Firebase SDK加载失败，使用本地存储模式', 'warning');
                return;
            }

            console.log('📦 Firebase SDK已加载，版本:', firebase.SDK_VERSION || 'unknown');

            // 初始化 Firebase 同步
            if (window.firebaseSync) {
                console.log('🔄 正在初始化Firebase同步...');

                // 设置超时，如果指定时间内无法连接就放弃
                const initPromise = window.firebaseSync.initialize(firebaseConfig);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Firebase连接超时')), systemConfig.firebaseTimeout);
                });

                const success = await Promise.race([initPromise, timeoutPromise]);

                if (success) {
                    console.log('✅ Firebase 实时同步已启用');
                    showNotification('云端实时同步已启用，支持多用户协作', 'success');
                } else {
                    console.log('❌ Firebase 初始化失败，使用本地存储');
                    showNotification('云端同步不可用，使用本地存储模式', 'warning');
                }
            } else {
                console.error('❌ FirebaseSync实例未找到');
                showNotification('Firebase同步模块未加载，使用本地存储', 'warning');
            }
        } catch (error) {
            console.error('❌ Firebase初始化过程中发生错误:', error);

            // 根据错误类型给出不同的提示
            let message = '云端同步不可用，使用本地存储模式';
            if (error.message.includes('timeout') || error.message.includes('超时')) {
                message = '网络连接超时，使用本地存储模式';
            } else if (error.message.includes('permission') || error.message.includes('权限')) {
                message = 'Firebase权限配置问题，使用本地存储模式';
            } else if (error.message.includes('network') || error.message.includes('网络')) {
                message = '网络连接问题，使用本地存储模式';
            }

            showNotification(message, 'warning');
        }
    }, 1000); // 减少延迟到1秒
});

// 通用通知函数
function showNotification(message, type = 'info') {
    if (window.dataManager && window.dataManager.showNotification) {
        window.dataManager.showNotification(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// 显示 Firebase 配置模态框
function showFirebaseConfigModal() {
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
            <h2 style="margin: 0 0 16px 0; color: #1f2937;">🚀 启用云端实时同步</h2>
            
            <div style="margin-bottom: 20px; padding: 16px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                    <strong>注意：</strong>要启用多用户实时协作功能，您需要配置 Firebase 项目。
                </p>
            </div>
            
            <h3 style="color: #374151; margin: 20px 0 12px 0;">📋 配置步骤：</h3>
            
            <ol style="color: #4b5563; line-height: 1.6; padding-left: 20px;">
                <li>访问 <a href="https://console.firebase.google.com/" target="_blank" style="color: #3b82f6;">Firebase 控制台</a></li>
                <li>创建新项目或选择现有项目</li>
                <li>在项目设置中找到"您的应用"部分</li>
                <li>选择"Web 应用"并获取配置信息</li>
                <li>在 Firestore Database 中启用数据库</li>
                <li>将配置信息填入 <code>firebase-config.js</code> 文件</li>
            </ol>
            
            <h3 style="color: #374151; margin: 20px 0 12px 0;">🔧 配置示例：</h3>
            
            <pre style="
                background: #f3f4f6;
                padding: 16px;
                border-radius: 8px;
                overflow-x: auto;
                font-size: 14px;
                color: #374151;
            ">const firebaseConfig = {
    apiKey: "AIzaSyC...",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};</pre>
            
            <h3 style="color: #374151; margin: 20px 0 12px 0;">✨ 功能特性：</h3>
            
            <ul style="color: #4b5563; line-height: 1.6; padding-left: 20px;">
                <li>🔄 <strong>实时数据同步</strong> - 多用户操作立即同步</li>
                <li>👥 <strong>在线用户显示</strong> - 查看当前在线的协作者</li>
                <li>📱 <strong>离线支持</strong> - 网络断开时数据保存在本地</li>
                <li>🔒 <strong>数据安全</strong> - Firebase 企业级安全保障</li>
                <li>💾 <strong>自动备份</strong> - 数据永久保存在云端</li>
                <li>🆓 <strong>免费使用</strong> - Firebase 免费额度足够使用</li>
            </ul>
            
            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="
                    padding: 8px 16px;
                    background: #6b7280;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">稍后配置</button>
                <button onclick="window.open('https://console.firebase.google.com/', '_blank')" style="
                    padding: 8px 16px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                ">打开 Firebase 控制台</button>
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

// 导出配置供其他模块使用
window.firebaseConfig = firebaseConfig;
