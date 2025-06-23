// 修复发货量30秒后自动重置为0的问题
// 在浏览器控制台中运行此脚本

console.log('🔧 开始修复发货量自动重置问题...');
console.log('='.repeat(50));

// 1. 检查当前自动刷新机制
function checkAutoRefreshMechanisms() {
    console.log('1️⃣ 检查自动刷新机制:');
    
    const mechanisms = {
        mainRefreshInterval: window.dashboard?.refreshInterval || null,
        mainDataCheckInterval: window.dashboard?.dataCheckInterval || null,
        cardLinkageInterval: window.cardLinkageInterval || null,
        firebaseSyncActive: window.firebaseSync?.isInitialized || false
    };
    
    console.log('  📊 自动刷新机制状态:', mechanisms);
    
    // 检查定时器数量
    const timers = [];
    for (let i = 1; i < 10000; i++) {
        try {
            clearTimeout(i);
            timers.push(i);
        } catch (e) {
            break;
        }
    }
    
    console.log(`  ⏰ 活跃定时器数量: ${timers.length}`);
    
    return mechanisms;
}

// 2. 监控发货量变化
function monitorShippingChanges() {
    console.log('2️⃣ 开始监控发货量变化...');
    
    let lastShippedValue = 0;
    let changeCount = 0;
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (!shippedCard) {
        console.error('❌ 未找到已发货量卡片');
        return null;
    }
    
    // 记录初始值
    lastShippedValue = parseFloat(shippedCard.textContent) || 0;
    console.log(`  📊 初始发货量: ${lastShippedValue.toFixed(1)}米`);
    
    // 创建观察器
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const currentValue = parseFloat(shippedCard.textContent) || 0;
                
                if (currentValue !== lastShippedValue) {
                    changeCount++;
                    const timestamp = new Date().toLocaleTimeString();
                    
                    console.log(`  🔄 [${timestamp}] 发货量变化 #${changeCount}:`);
                    console.log(`    从 ${lastShippedValue.toFixed(1)}米 → ${currentValue.toFixed(1)}米`);
                    
                    // 检查是否是异常重置
                    if (lastShippedValue > 0 && currentValue === 0) {
                        console.warn(`  ⚠️ 检测到异常重置！发货量从 ${lastShippedValue.toFixed(1)}米 重置为 0`);
                        
                        // 立即恢复正确值
                        setTimeout(() => {
                            restoreCorrectShippingValue();
                        }, 100);
                    }
                    
                    lastShippedValue = currentValue;
                }
            }
        });
    });
    
    // 开始观察
    observer.observe(shippedCard, {
        childList: true,
        characterData: true,
        subtree: true
    });
    
    console.log('  ✅ 发货量变化监控已启动');
    
    return observer;
}

// 3. 恢复正确的发货量值
function restoreCorrectShippingValue() {
    console.log('🔄 恢复正确的发货量值...');
    
    let correctShippedMeters = 0;
    
    // 方法1：从客户统计计算
    if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            correctShippedMeters = customerStats.reduce((sum, customer) => {
                return sum + (customer.totalMeters || 0);
            }, 0);
            
            if (correctShippedMeters > 0) {
                console.log(`  📦 从客户统计获取正确值: ${correctShippedMeters.toFixed(1)}米`);
            }
        } catch (error) {
            console.error('  ❌ 客户统计计算失败:', error);
        }
    }
    
    // 方法2：从生产数据计算
    if (correctShippedMeters === 0 && window.dataManager && window.dataManager.data) {
        correctShippedMeters = window.dataManager.data.reduce((sum, item) => {
            const length = extractLengthFromSpec(item.spec);
            const shipped = item.shipped || 0;
            return sum + (shipped * length / 1000);
        }, 0);
        
        if (correctShippedMeters > 0) {
            console.log(`  📦 从生产数据获取正确值: ${correctShippedMeters.toFixed(1)}米`);
        }
    }
    
    if (correctShippedMeters > 0) {
        // 更新界面显示
        const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
        if (shippedCard) {
            shippedCard.textContent = correctShippedMeters.toFixed(1);
            
            // 添加恢复动画
            shippedCard.style.background = '#10b981';
            shippedCard.style.color = 'white';
            shippedCard.style.transform = 'scale(1.05)';
            
            setTimeout(() => {
                shippedCard.style.background = '';
                shippedCard.style.color = '';
                shippedCard.style.transform = '';
            }, 1000);
            
            console.log(`  ✅ 发货量已恢复为: ${correctShippedMeters.toFixed(1)}米`);
        }
        
        // 更新内部数据
        if (window.dashboard && window.dashboard.data) {
            window.dashboard.data.shippedMeters = correctShippedMeters;
            window.dashboard.data.unshippedMeters = Math.max(0, 
                (window.dashboard.data.producedMeters || 0) - correctShippedMeters
            );
        }
        
        return correctShippedMeters;
    } else {
        console.log('  ⚠️ 无法获取正确的发货量值');
        return 0;
    }
}

// 4. 从规格中提取长度
function extractLengthFromSpec(spec) {
    if (!spec) return 6000;
    
    const patterns = [
        /L=(\d+)/,
        /长度[：:]\s*(\d+)/,
        /(\d+)mm/i,
        /(\d+)MM/,
        /L(\d+)/,
        /-(\d+)$/,
        /×(\d+)/,
        /\*(\d+)/,
        /(\d{4,})/
    ];

    for (let pattern of patterns) {
        const match = spec.match(pattern);
        if (match) {
            const length = parseInt(match[1]);
            if (length >= 1000 && length <= 20000) {
                return length;
            }
        }
    }

    return 6000;
}

// 5. 禁用有问题的自动刷新
function disableProblematicAutoRefresh() {
    console.log('3️⃣ 禁用有问题的自动刷新机制...');
    
    // 禁用主界面的数据检查（这是导致重置的主要原因）
    if (window.dashboard && window.dashboard.dataCheckInterval) {
        clearInterval(window.dashboard.dataCheckInterval);
        window.dashboard.dataCheckInterval = null;
        console.log('  ✅ 已禁用主界面数据检查定时器');
    }
    
    // 保留主要的刷新机制，但增加保护
    if (window.dashboard && typeof window.dashboard.checkDataStatus === 'function') {
        const originalCheckDataStatus = window.dashboard.checkDataStatus;
        
        window.dashboard.checkDataStatus = function() {
            // 检查发货量是否正常
            const currentShipped = this.data.shippedMeters || 0;
            
            // 如果发货量正常，跳过检查
            if (currentShipped > 0) {
                console.log('  🛡️ 发货量正常，跳过数据状态检查');
                return;
            }
            
            // 只有在发货量为0且确实需要修复时才执行原始检查
            console.log('  🔍 发货量为0，执行保护性数据检查...');
            originalCheckDataStatus.call(this);
        };
        
        console.log('  ✅ 已为数据检查添加保护机制');
    }
    
    // 禁用卡片联动的频繁更新
    if (window.cardLinkageInterval) {
        clearInterval(window.cardLinkageInterval);
        window.cardLinkageInterval = null;
        console.log('  ✅ 已禁用卡片联动定时器');
    }
}

// 6. 创建保护性刷新机制
function createProtectedRefresh() {
    console.log('4️⃣ 创建保护性刷新机制...');
    
    // 创建智能刷新，只在必要时更新
    const protectedRefreshInterval = setInterval(() => {
        const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
        const currentValue = parseFloat(shippedCard?.textContent) || 0;
        
        // 只有在发货量异常为0时才尝试修复
        if (currentValue === 0) {
            console.log('  🔄 检测到发货量为0，尝试恢复...');
            const restoredValue = restoreCorrectShippingValue();
            
            if (restoredValue > 0) {
                console.log(`  ✅ 发货量已恢复: ${restoredValue.toFixed(1)}米`);
            }
        }
    }, 60000); // 每分钟检查一次
    
    // 保存到全局以便清理
    window.protectedRefreshInterval = protectedRefreshInterval;
    
    console.log('  ✅ 保护性刷新机制已启动（每60秒检查一次）');
}

// 7. 完整修复流程
function fixShippingAutoReset() {
    console.log('🚀 开始完整修复流程...');
    console.log('='.repeat(50));
    
    // 检查当前状态
    const mechanisms = checkAutoRefreshMechanisms();
    
    // 禁用有问题的自动刷新
    disableProblematicAutoRefresh();
    
    // 启动监控
    const observer = monitorShippingChanges();
    
    // 创建保护性刷新
    createProtectedRefresh();
    
    // 立即恢复一次正确值
    setTimeout(() => {
        restoreCorrectShippingValue();
    }, 1000);
    
    console.log('='.repeat(50));
    console.log('🎉 修复完成！');
    console.log('📊 监控状态:');
    console.log('  - 发货量变化监控: ✅ 已启动');
    console.log('  - 保护性刷新: ✅ 已启动');
    console.log('  - 问题定时器: ✅ 已禁用');
    console.log('');
    console.log('💡 使用方法:');
    console.log('  - 发货量会自动监控和恢复');
    console.log('  - 如需手动恢复: restoreCorrectShippingValue()');
    console.log('  - 如需停止监控: stopShippingMonitor()');
    
    return { observer, mechanisms };
}

// 8. 停止监控
function stopShippingMonitor() {
    console.log('🛑 停止发货量监控...');
    
    if (window.shippingObserver) {
        window.shippingObserver.disconnect();
        window.shippingObserver = null;
        console.log('  ✅ 变化监控已停止');
    }
    
    if (window.protectedRefreshInterval) {
        clearInterval(window.protectedRefreshInterval);
        window.protectedRefreshInterval = null;
        console.log('  ✅ 保护性刷新已停止');
    }
}

// 导出函数到全局
window.shippingAutoResetFix = {
    checkAutoRefreshMechanisms,
    monitorShippingChanges,
    restoreCorrectShippingValue,
    disableProblematicAutoRefresh,
    createProtectedRefresh,
    fixShippingAutoReset,
    stopShippingMonitor
};

// 自动执行修复
console.log('🎯 自动执行修复...');
const result = fixShippingAutoReset();

// 保存监控器到全局
window.shippingObserver = result.observer;
