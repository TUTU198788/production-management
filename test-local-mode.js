// 测试本地模式功能的专用脚本
// 在浏览器控制台中运行此脚本来验证本地模式是否正常工作

(function() {
    'use strict';
    
    console.log('🧪 开始测试本地模式功能...');
    
    // 检查本地模式状态
    function checkLocalModeStatus() {
        console.log('📊 检查本地模式状态:');
        
        // 检查localStorage中的禁用标志
        const isDisabled = localStorage.getItem('disableFirebase') === 'true';
        console.log(`  Firebase禁用状态: ${isDisabled ? '✅ 已禁用' : '❌ 未禁用'}`);
        
        // 检查Firebase初始化状态
        if (window.firebaseSync) {
            console.log(`  Firebase初始化状态: ${window.firebaseSync.isInitialized ? '已初始化' : '未初始化'}`);
            console.log(`  Firebase连接状态: ${window.firebaseSync.isConnected() ? '已连接' : '未连接'}`);
        } else {
            console.log('  ❌ FirebaseSync未加载');
        }
        
        // 检查连接状态显示
        const statusElement = document.querySelector('.connection-status');
        if (statusElement) {
            console.log(`  界面显示状态: ${statusElement.textContent}`);
            console.log(`  状态样式: ${statusElement.className}`);
        } else {
            console.log('  ❌ 连接状态元素未找到');
        }
        
        return {
            isFirebaseDisabled: isDisabled,
            isFirebaseInitialized: window.firebaseSync?.isInitialized || false,
            isFirebaseConnected: window.firebaseSync?.isConnected() || false,
            statusText: statusElement?.textContent || 'unknown'
        };
    }
    
    // 测试数据操作是否触发同步
    function testDataOperationSync() {
        console.log('🧪 测试数据操作是否触发同步...');
        
        if (!window.dataManager) {
            console.log('❌ DataManager未加载');
            return false;
        }
        
        // 备份原始数据
        const originalData = [...window.dataManager.data];
        const originalLength = originalData.length;
        
        // 监听控制台输出
        const originalLog = console.log;
        const logs = [];
        console.log = function(...args) {
            logs.push(args.join(' '));
            originalLog.apply(console, args);
        };
        
        try {
            // 创建测试数据
            const testData = {
                id: 'local_mode_test_' + Date.now(),
                spec: 'H80-6000',
                area: '本地模式测试',
                planned: 100,
                produced: 0,
                status: 'planned',
                deadline: '',
                remarks: '本地模式测试数据',
                timestamp: Date.now(),
                lastModified: Date.now()
            };
            
            console.log('📝 添加测试数据...');
            
            // 添加测试数据
            window.dataManager.data.push(testData);
            
            // 触发保存
            window.dataManager.saveToLocalStorage();
            
            // 等待一段时间检查日志
            setTimeout(() => {
                // 恢复console.log
                console.log = originalLog;
                
                // 检查是否有同步相关的日志
                const syncLogs = logs.filter(log => 
                    log.includes('同步') || 
                    log.includes('sync') || 
                    log.includes('Firebase') ||
                    log.includes('云端')
                );
                
                console.log('📊 同步相关日志:');
                if (syncLogs.length === 0) {
                    console.log('  ✅ 没有触发任何同步操作');
                } else {
                    console.log('  ❌ 检测到同步操作:');
                    syncLogs.forEach(log => console.log(`    - ${log}`));
                }
                
                // 清理测试数据
                window.dataManager.data = originalData;
                window.dataManager.saveToLocalStorage();
                
                console.log('🧹 测试数据已清理');
                
                return syncLogs.length === 0;
            }, 2000);
            
        } catch (error) {
            // 恢复console.log
            console.log = originalLog;
            
            console.error('❌ 测试数据操作失败:', error);
            
            // 恢复原始数据
            window.dataManager.data = originalData;
            window.dataManager.saveToLocalStorage();
            
            return false;
        }
    }
    
    // 测试手动同步按钮
    function testManualSyncButton() {
        console.log('🧪 测试手动同步按钮...');
        
        if (!window.dataManager) {
            console.log('❌ DataManager未加载');
            return false;
        }
        
        // 监听通知
        const originalShowNotification = window.dataManager.showNotification;
        let lastNotification = null;
        
        window.dataManager.showNotification = function(message, type) {
            lastNotification = { message, type };
            console.log(`📢 通知: ${message} (${type})`);
            if (originalShowNotification) {
                originalShowNotification.call(this, message, type);
            }
        };
        
        try {
            // 尝试执行手动同步
            console.log('🔄 尝试执行手动同步...');
            window.dataManager.performManualSync();
            
            // 检查通知
            setTimeout(() => {
                // 恢复原始方法
                window.dataManager.showNotification = originalShowNotification;
                
                if (lastNotification) {
                    if (lastNotification.message.includes('本地模式') || 
                        lastNotification.message.includes('禁用')) {
                        console.log('✅ 手动同步正确阻止了云端操作');
                        return true;
                    } else {
                        console.log('❌ 手动同步没有正确阻止云端操作');
                        return false;
                    }
                } else {
                    console.log('⚠️ 没有收到任何通知');
                    return false;
                }
            }, 1000);
            
        } catch (error) {
            // 恢复原始方法
            window.dataManager.showNotification = originalShowNotification;
            
            console.error('❌ 测试手动同步失败:', error);
            return false;
        }
    }
    
    // 启用本地模式
    function enableLocalMode() {
        console.log('🔧 启用本地模式...');
        
        localStorage.setItem('disableFirebase', 'true');
        
        // 断开Firebase连接
        if (window.firebaseSync && window.firebaseSync.disconnect) {
            window.firebaseSync.disconnect();
        }
        
        // 更新状态显示
        const statusElement = document.querySelector('.connection-status');
        if (statusElement) {
            statusElement.textContent = '本地模式';
            statusElement.className = 'connection-status warning';
        }
        
        console.log('✅ 本地模式已启用');
        
        // 验证状态
        setTimeout(() => {
            checkLocalModeStatus();
        }, 500);
    }
    
    // 禁用本地模式
    function disableLocalMode() {
        console.log('🔧 禁用本地模式...');
        
        localStorage.removeItem('disableFirebase');
        
        console.log('✅ 本地模式已禁用，需要刷新页面以重新连接Firebase');
        
        const shouldReload = confirm('本地模式已禁用，是否立即刷新页面以重新连接Firebase？');
        if (shouldReload) {
            location.reload();
        }
    }
    
    // 执行完整的本地模式测试
    function runFullLocalModeTest() {
        console.log('🧪 执行完整的本地模式测试...');
        
        const status = checkLocalModeStatus();
        
        if (!status.isFirebaseDisabled) {
            console.log('⚠️ Firebase未禁用，先启用本地模式...');
            enableLocalMode();
            
            setTimeout(() => {
                runFullLocalModeTest();
            }, 2000);
            return;
        }
        
        console.log('📊 测试结果:');
        
        // 测试1: Firebase状态
        const test1 = !status.isFirebaseInitialized && !status.isFirebaseConnected;
        console.log(`1. Firebase未初始化且未连接: ${test1 ? '✅ 通过' : '❌ 失败'}`);
        
        // 测试2: 状态显示
        const test2 = status.statusText === '本地模式';
        console.log(`2. 状态显示正确: ${test2 ? '✅ 通过' : '❌ 失败'} (${status.statusText})`);
        
        // 测试3: 数据操作不触发同步
        console.log('3. 数据操作不触发同步: 测试中...');
        testDataOperationSync();
        
        // 测试4: 手动同步被阻止
        console.log('4. 手动同步被阻止: 测试中...');
        testManualSyncButton();
        
        // 总结
        const passedTests = [test1, test2].filter(Boolean).length;
        const totalTests = 4; // 包括异步测试
        
        console.log(`\n🎯 测试总结: ${passedTests}/2 个同步测试通过，2个异步测试进行中`);
        
        if (test1 && test2) {
            console.log('🎉 本地模式基本功能测试通过！');
        } else {
            console.log('❌ 本地模式测试失败，需要检查配置');
        }
    }
    
    // 暴露函数到全局
    window.checkLocalModeStatus = checkLocalModeStatus;
    window.testDataOperationSync = testDataOperationSync;
    window.testManualSyncButton = testManualSyncButton;
    window.enableLocalMode = enableLocalMode;
    window.disableLocalMode = disableLocalMode;
    window.runFullLocalModeTest = runFullLocalModeTest;
    
    // 自动执行检查
    console.log('✅ 本地模式测试工具已加载');
    console.log('💡 运行 runFullLocalModeTest() 来执行完整测试');
    console.log('💡 运行 enableLocalMode() 来启用本地模式');
    console.log('💡 运行 disableLocalMode() 来禁用本地模式');
    console.log('💡 运行 checkLocalModeStatus() 来检查当前状态');
    
    // 立即检查当前状态
    checkLocalModeStatus();
    
})();
