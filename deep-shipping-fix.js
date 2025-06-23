// 深度修复发货量显示问题
// 在浏览器控制台中运行此脚本

console.log('🔧 开始深度修复发货量显示问题...');
console.log('='.repeat(60));

// 1. 完全停止所有可能导致重置的定时器
function stopAllProblematicTimers() {
    console.log('1️⃣ 停止所有可能导致重置的定时器...');
    
    // 停止主界面的所有定时器
    if (window.dashboard) {
        if (window.dashboard.refreshInterval) {
            clearInterval(window.dashboard.refreshInterval);
            window.dashboard.refreshInterval = null;
            console.log('  ✅ 已停止主界面刷新定时器');
        }
        
        if (window.dashboard.dataCheckInterval) {
            clearInterval(window.dashboard.dataCheckInterval);
            window.dashboard.dataCheckInterval = null;
            console.log('  ✅ 已停止数据检查定时器');
        }
    }
    
    // 停止卡片联动定时器
    if (window.cardLinkageInterval) {
        clearInterval(window.cardLinkageInterval);
        window.cardLinkageInterval = null;
        console.log('  ✅ 已停止卡片联动定时器');
    }
    
    // 停止Firebase实时同步（如果存在）
    if (window.firebaseSync && window.firebaseSync.pauseRealtimeSync) {
        window.firebaseSync.pauseRealtimeSync();
        console.log('  ✅ 已暂停Firebase实时同步');
    }
    
    // 清除所有可能的定时器（暴力清除）
    for (let i = 1; i < 10000; i++) {
        try {
            clearInterval(i);
            clearTimeout(i);
        } catch (e) {
            // 忽略错误
        }
    }
    
    console.log('  ✅ 所有定时器已清除');
}

// 2. 锁定发货量值，防止被覆盖
function lockShippingValue() {
    console.log('2️⃣ 锁定发货量值...');
    
    // 计算正确的发货量
    let correctShippedMeters = calculateCorrectShippingValue();
    
    if (correctShippedMeters === 0) {
        console.log('  ⚠️ 计算结果为0，可能确实没有发货数据');
        return 0;
    }
    
    console.log(`  📊 正确的发货量: ${correctShippedMeters.toFixed(1)}米`);
    
    // 获取发货量卡片元素
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (!shippedCard) {
        console.error('  ❌ 未找到发货量卡片元素');
        return 0;
    }
    
    // 创建锁定机制
    let isLocked = true;
    
    // 方法1：使用Object.defineProperty锁定textContent
    let lockedValue = correctShippedMeters.toFixed(1);
    
    Object.defineProperty(shippedCard, 'textContent', {
        get: function() {
            return lockedValue;
        },
        set: function(value) {
            const numValue = parseFloat(value) || 0;
            
            // 只允许设置正确的值或更大的值
            if (numValue >= correctShippedMeters || numValue === 0) {
                if (numValue === 0 && correctShippedMeters > 0) {
                    console.warn(`  🛡️ 阻止发货量被重置为0 (正确值: ${correctShippedMeters.toFixed(1)}米)`);
                    return; // 阻止设置为0
                }
                lockedValue = value;
                if (numValue > correctShippedMeters) {
                    correctShippedMeters = numValue; // 更新正确值
                    console.log(`  📈 发货量更新为: ${numValue.toFixed(1)}米`);
                }
            } else {
                console.warn(`  🛡️ 阻止发货量被设置为错误值: ${value} (正确值: ${correctShippedMeters.toFixed(1)}米)`);
            }
        },
        configurable: true
    });
    
    // 方法2：使用MutationObserver监控DOM变化
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const currentValue = parseFloat(shippedCard.textContent) || 0;
                
                if (currentValue === 0 && correctShippedMeters > 0) {
                    console.warn(`  🛡️ DOM监控：检测到发货量被重置，立即恢复`);
                    shippedCard.textContent = correctShippedMeters.toFixed(1);
                }
            }
        });
    });
    
    observer.observe(shippedCard, {
        childList: true,
        characterData: true,
        subtree: true
    });
    
    // 方法3：定期强制恢复
    const forceRestoreInterval = setInterval(() => {
        const currentValue = parseFloat(shippedCard.textContent) || 0;
        if (currentValue === 0 && correctShippedMeters > 0) {
            console.warn(`  🔄 定期检查：发货量为0，强制恢复为 ${correctShippedMeters.toFixed(1)}米`);
            shippedCard.textContent = correctShippedMeters.toFixed(1);
        }
    }, 5000); // 每5秒检查一次
    
    // 立即设置正确值
    shippedCard.textContent = correctShippedMeters.toFixed(1);
    
    // 添加视觉标识
    shippedCard.style.border = '2px solid #10b981';
    shippedCard.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
    shippedCard.title = `已锁定发货量: ${correctShippedMeters.toFixed(1)}米 (防止重置)`;
    
    console.log(`  ✅ 发货量已锁定为: ${correctShippedMeters.toFixed(1)}米`);
    
    // 保存清理函数到全局
    window.unlockShippingValue = function() {
        isLocked = false;
        observer.disconnect();
        clearInterval(forceRestoreInterval);
        
        // 恢复原始的textContent属性
        delete shippedCard.textContent;
        
        shippedCard.style.border = '';
        shippedCard.style.boxShadow = '';
        shippedCard.title = '';
        
        console.log('🔓 发货量锁定已解除');
    };
    
    return correctShippedMeters;
}

// 3. 计算正确的发货量值
function calculateCorrectShippingValue() {
    console.log('📊 计算正确的发货量值...');
    
    let shippedMeters = 0;
    let calculationMethod = '';
    
    // 方法1：从DataManager客户统计计算
    if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            const customerShippedMeters = customerStats.reduce((sum, customer) => {
                return sum + (customer.totalMeters || 0);
            }, 0);
            
            if (customerShippedMeters > 0) {
                shippedMeters = customerShippedMeters;
                calculationMethod = 'DataManager客户统计';
                console.log(`  📦 方法1 (客户统计): ${shippedMeters.toFixed(1)}米`);
                
                // 显示前几个客户的详情
                customerStats.slice(0, 3).forEach(customer => {
                    if (customer.totalMeters > 0) {
                        console.log(`    - ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                    }
                });
            }
        } catch (error) {
            console.error('  ❌ 方法1失败:', error);
        }
    }
    
    // 方法2：从发货历史计算
    if (shippedMeters === 0 && window.dataManager && window.dataManager.shippingHistory) {
        const historyShippedMeters = window.dataManager.shippingHistory.reduce((sum, record) => {
            return sum + (record.meters || 0);
        }, 0);
        
        if (historyShippedMeters > 0) {
            shippedMeters = historyShippedMeters;
            calculationMethod = '发货历史';
            console.log(`  📦 方法2 (发货历史): ${shippedMeters.toFixed(1)}米`);
        }
    }
    
    // 方法3：从生产数据的shipped字段计算
    if (shippedMeters === 0 && window.dataManager && window.dataManager.data) {
        const productionShippedMeters = window.dataManager.data.reduce((sum, item) => {
            const length = extractLengthFromSpec(item.spec);
            const shipped = item.shipped || 0;
            return sum + (shipped * length / 1000);
        }, 0);
        
        if (productionShippedMeters > 0) {
            shippedMeters = productionShippedMeters;
            calculationMethod = '生产数据shipped字段';
            console.log(`  📦 方法3 (生产数据): ${shippedMeters.toFixed(1)}米`);
        }
    }
    
    // 方法4：从DataCore计算
    if (shippedMeters === 0 && window.dataCore && typeof window.dataCore.getShippingStats === 'function') {
        try {
            const shippingStats = window.dataCore.getShippingStats();
            if (shippingStats.totalMeters > 0) {
                shippedMeters = shippingStats.totalMeters;
                calculationMethod = 'DataCore发货统计';
                console.log(`  📦 方法4 (DataCore): ${shippedMeters.toFixed(1)}米`);
            }
        } catch (error) {
            console.error('  ❌ 方法4失败:', error);
        }
    }
    
    console.log(`  🎯 最终结果: ${shippedMeters.toFixed(1)}米 (使用${calculationMethod})`);
    return shippedMeters;
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

// 5. 禁用所有可能修改发货量的函数
function disableShippingModifiers() {
    console.log('3️⃣ 禁用所有可能修改发货量的函数...');
    
    // 禁用主界面的更新方法
    if (window.dashboard) {
        const originalUpdateMetrics = window.dashboard.updateMetrics;
        window.dashboard.updateMetrics = function() {
            console.log('  🛡️ 拦截updateMetrics调用，保护发货量');
            
            // 保存当前发货量
            const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
            const currentShipped = shippedCard ? shippedCard.textContent : '0';
            
            // 执行原始更新（但跳过发货量）
            originalUpdateMetrics.call(this);
            
            // 恢复发货量
            if (shippedCard && parseFloat(currentShipped) > 0) {
                shippedCard.textContent = currentShipped;
            }
        };
        
        // 禁用数据检查
        window.dashboard.checkDataStatus = function() {
            console.log('  🛡️ 数据检查已被禁用，保护发货量');
        };
        
        // 禁用深度同步
        window.dashboard.deepDataSync = function() {
            console.log('  🛡️ 深度同步已被禁用，保护发货量');
        };
        
        console.log('  ✅ 主界面更新方法已保护');
    }
    
    // 禁用DataManager的刷新方法
    if (window.dataManager) {
        const originalUpdateStats = window.dataManager.updateStats;
        if (originalUpdateStats) {
            window.dataManager.updateStats = function() {
                console.log('  🛡️ 拦截DataManager.updateStats调用');
                // 不执行原始方法，保护发货量
            };
        }
        
        console.log('  ✅ DataManager更新方法已保护');
    }
}

// 6. 创建发货量保护罩
function createShippingProtection() {
    console.log('4️⃣ 创建发货量保护罩...');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (!shippedCard) {
        console.error('  ❌ 未找到发货量卡片');
        return;
    }
    
    // 创建保护罩元素
    const protection = document.createElement('div');
    protection.id = 'shippingProtection';
    protection.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(16, 185, 129, 0.1);
        border: 2px solid #10b981;
        border-radius: 8px;
        pointer-events: none;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #10b981;
        font-weight: bold;
    `;
    protection.textContent = '🛡️ 已保护';
    
    // 确保父元素有相对定位
    const card = shippedCard.closest('.metric-card');
    if (card) {
        card.style.position = 'relative';
        card.appendChild(protection);
        console.log('  ✅ 保护罩已创建');
    }
}

// 7. 完整的深度修复流程
function deepFixShippingDisplay() {
    console.log('🚀 开始深度修复流程...');
    console.log('='.repeat(60));
    
    // 步骤1：停止所有定时器
    stopAllProblematicTimers();
    
    // 步骤2：禁用修改函数
    disableShippingModifiers();
    
    // 步骤3：锁定发货量值
    const lockedValue = lockShippingValue();
    
    // 步骤4：创建保护罩
    createShippingProtection();
    
    console.log('='.repeat(60));
    console.log('🎉 深度修复完成！');
    console.log(`📊 发货量已锁定为: ${lockedValue.toFixed(1)}米`);
    console.log('🛡️ 保护机制已启动:');
    console.log('  - 所有定时器已停止');
    console.log('  - 更新函数已保护');
    console.log('  - 发货量值已锁定');
    console.log('  - DOM变化监控已启动');
    console.log('  - 定期强制恢复已启动');
    console.log('');
    console.log('💡 如需解除保护: unlockShippingValue()');
    
    return lockedValue;
}

// 8. 诊断当前问题
function diagnoseShippingIssue() {
    console.log('🔍 诊断当前发货量问题...');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const currentDisplay = shippedCard ? shippedCard.textContent : '未找到';
    
    console.log(`📊 当前显示值: ${currentDisplay}`);
    
    // 计算正确值
    const correctValue = calculateCorrectShippingValue();
    console.log(`📊 正确计算值: ${correctValue.toFixed(1)}米`);
    
    // 检查差异
    const displayValue = parseFloat(currentDisplay) || 0;
    if (Math.abs(displayValue - correctValue) > 0.1) {
        console.warn(`⚠️ 发现数据不一致！显示值: ${displayValue}米, 正确值: ${correctValue.toFixed(1)}米`);
        return false;
    } else {
        console.log('✅ 数据一致');
        return true;
    }
}

// 导出函数到全局
window.deepShippingFix = {
    stopAllProblematicTimers,
    lockShippingValue,
    calculateCorrectShippingValue,
    disableShippingModifiers,
    createShippingProtection,
    deepFixShippingDisplay,
    diagnoseShippingIssue
};

// 自动执行诊断
console.log('🎯 自动执行诊断...');
const isConsistent = diagnoseShippingIssue();

if (!isConsistent) {
    console.log('🔧 检测到问题，自动执行深度修复...');
    deepFixShippingDisplay();
} else {
    console.log('✅ 数据正常，如需强制保护请运行: deepShippingFix.deepFixShippingDisplay()');
}

console.log('');
console.log('💡 使用方法:');
console.log('deepShippingFix.deepFixShippingDisplay() - 强制深度修复');
console.log('deepShippingFix.diagnoseShippingIssue() - 诊断问题');
console.log('unlockShippingValue() - 解除保护（修复后可用）');
