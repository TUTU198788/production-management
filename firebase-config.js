/**
 * Firebase 配置文件
 * 请替换为您自己的 Firebase 项目配置
 */

// Firebase 项目配置
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAtk4_l58OAfAQYh0aGeykavDYfnflbKc",
  authDomain: "zhlscglxt.firebaseapp.com",
  projectId: "zhlscglxt",
  storageBucket: "zhlscglxt.firebasestorage.app",
  messagingSenderId: "364959896544",
  appId: "1:364959896544:web:3ad7266c9832ff25569185"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firebase 同步
document.addEventListener('DOMContentLoaded', async () => {
    // 检查配置是否已设置
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn('⚠️ Firebase 配置未设置，请在 firebase-config.js 中配置您的 Firebase 项目信息');
        
        // 显示配置提示
        showFirebaseConfigModal();
        return;
    }
    
    // 初始化 Firebase 同步
    if (window.firebaseSync) {
        const success = await window.firebaseSync.initialize(firebaseConfig);
        if (success) {
            console.log('✅ Firebase 实时同步已启用');
            
            // 显示成功提示
            if (window.dashboard) {
                window.dashboard.showNotification('云端实时同步已启用', 'success');
            }
        }
    }
});

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
