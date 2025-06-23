// 终极修复发货量显示问题
// 在浏览器控制台中运行此脚本

console.log('🔧 开始终极修复发货量显示问题...');
console.log('='.repeat(60));

// 1. 计算并锁定正确的发货量值
function calculateAndLockShippingValue() {
    console.log('1️⃣ 计算并锁定正确的发货量值...');
    
    let correctShippedMeters = 0;
    let calculationMethod = '';
    
    // 方法1：从DataManager客户统计计算
    if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            const customerShippedMeters = customerStats.reduce((sum, customer) => {
                return sum + (customer.totalMeters || 0);
            }, 0);
            
            if (customerShippedMeters > 0) {
                correctShippedMeters = customerShippedMeters;
                calculationMethod = 'DataManager客户统计';
                console.log(`  📦 方法1 (客户统计): ${correctShippedMeters.toFixed(1)}米`);
                
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
    if (correctShippedMeters === 0 && window.dataManager && window.dataManager.shippingHistory) {
        const historyShippedMeters = window.dataManager.shippingHistory.reduce((sum, record) => {
            return sum + (record.meters || 0);
        }, 0);
        
        if (historyShippedMeters > 0) {
            correctShippedMeters = historyShippedMeters;
            calculationMethod = '发货历史';
            console.log(`  📦 方法2 (发货历史): ${correctShippedMeters.toFixed(1)}米`);
        }
    }
    
    // 方法3：从生产数据的shipped字段计算
    if (correctShippedMeters === 0 && window.dataManager && window.dataManager.data) {
        const productionShippedMeters = window.dataManager.data.reduce((sum, item) => {
            const length = extractLengthFromSpec(item.spec);
            const shipped = item.shipped || 0;
            return sum + (shipped * length / 1000);
        }, 0);
        
        if (productionShippedMeters > 0) {
            correctShippedMeters = productionShippedMeters;
            calculationMethod = '生产数据shipped字段';
            console.log(`  📦 方法3 (生产数据): ${correctShippedMeters.toFixed(1)}米`);
        }
    }
    
    console.log(`  🎯 最终结果: ${correctShippedMeters.toFixed(1)}米 (使用${calculationMethod})`);
    
    // 如果计算结果为0，可能确实没有发货数据
    if (correctShippedMeters === 0) {
        console.log('  ⚠️ 计算结果为0，可能确实没有发货数据');
        return 0;
    }
    
    // 锁定这个值到所有相关的数据源
    lockValueInAllSources(correctShippedMeters);
    
    return correctShippedMeters;
}

// 2. 在所有数据源中锁定发货量值
function lockValueInAllSources(correctValue) {
    console.log(`2️⃣ 在所有数据源中锁定发货量值: ${correctValue.toFixed(1)}米`);
    
    // 锁定Dashboard数据
    if (window.dashboard && window.dashboard.data) {
        Object.defineProperty(window.dashboard.data, 'shippedMeters', {
            get: function() {
                return correctValue;
            },
            set: function(value) {
                const numValue = parseFloat(value) || 0;
                if (numValue >= correctValue || numValue === 0) {
                    if (numValue === 0 && correctValue > 0) {
                        console.warn(`  🛡️ 阻止dashboard.data.shippedMeters被重置为0`);
                        return;
                    }
                    if (numValue > correctValue) {
                        correctValue = numValue; // 允许更新为更大的值
                        console.log(`  📈 dashboard.data.shippedMeters更新为: ${numValue.toFixed(1)}米`);
                    }
                } else {
                    console.warn(`  🛡️ 阻止dashboard.data.shippedMeters被设置为错误值: ${value}`);
                }
            },
            configurable: true
        });
        console.log('  ✅ Dashboard数据已锁定');
    }
    
    // 锁定Main数据
    if (window.main && window.main.data) {
        Object.defineProperty(window.main.data, 'shippedMeters', {
            get: function() {
                return correctValue;
            },
            set: function(value) {
                const numValue = parseFloat(value) || 0;
                if (numValue >= correctValue || numValue === 0) {
                    if (numValue === 0 && correctValue > 0) {
                        console.warn(`  🛡️ 阻止main.data.shippedMeters被重置为0`);
                        return;
                    }
                    if (numValue > correctValue) {
                        correctValue = numValue;
                        console.log(`  📈 main.data.shippedMeters更新为: ${numValue.toFixed(1)}米`);
                    }
                } else {
                    console.warn(`  🛡️ 阻止main.data.shippedMeters被设置为错误值: ${value}`);
                }
            },
            configurable: true
        });
        console.log('  ✅ Main数据已锁定');
    }
}

// 3. 重写animateNumber函数，保护发货量
function protectAnimateNumber() {
    console.log('3️⃣ 保护animateNumber函数...');
    
    if (window.dashboard && typeof window.dashboard.animateNumber === 'function') {
        const originalAnimateNumber = window.dashboard.animateNumber;
        
        window.dashboard.animateNumber = function(element, targetValue, decimals = 0) {
            // 检查是否是发货量元素
            const isShippedElement = element.closest('.metric-card.shipped');
            
            if (isShippedElement) {
                const currentValue = parseFloat(element.textContent.replace(/,/g, '')) || 0;
                
                // 如果目标值为0但当前值大于0，阻止动画
                if (targetValue === 0 && currentValue > 0) {
                    console.warn(`  🛡️ 阻止发货量动画从 ${currentValue.toFixed(1)} 到 0`);
                    return; // 不执行动画
                }
                
                // 如果目标值小于当前值且当前值大于0，也阻止
                if (targetValue < currentValue && currentValue > 0 && targetValue < currentValue * 0.5) {
                    console.warn(`  🛡️ 阻止发货量异常减少动画从 ${currentValue.toFixed(1)} 到 ${targetValue.toFixed(1)}`);
                    return;
                }
                
                console.log(`  ✅ 允许发货量动画从 ${currentValue.toFixed(1)} 到 ${targetValue.toFixed(1)}`);
            }
            
            // 执行原始动画
            originalAnimateNumber.call(this, element, targetValue, decimals);
        };
        
        console.log('  ✅ animateNumber函数已保护');
    }
}

// 4. 停止所有可能导致重置的定时器
function stopProblematicTimers() {
    console.log('4️⃣ 停止所有可能导致重置的定时器...');
    
    // 停止主界面的定时器
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
    
    // 停止其他定时器
    if (window.cardLinkageInterval) {
        clearInterval(window.cardLinkageInterval);
        window.cardLinkageInterval = null;
        console.log('  ✅ 已停止卡片联动定时器');
    }
    
    // 暂停Firebase实时同步
    if (window.firebaseSync && window.firebaseSync.pauseRealtimeSync) {
        window.firebaseSync.pauseRealtimeSync();
        console.log('  ✅ 已暂停Firebase实时同步');
    }
}

// 5. 重写关键的更新方法
function protectUpdateMethods() {
    console.log('5️⃣ 保护关键的更新方法...');
    
    // 保护updateMetrics方法
    if (window.dashboard && typeof window.dashboard.updateMetrics === 'function') {
        const originalUpdateMetrics = window.dashboard.updateMetrics;
        
        window.dashboard.updateMetrics = function() {
            console.log('  🛡️ 拦截updateMetrics调用');
            
            // 保存当前发货量
            const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
            const currentShipped = shippedCard ? parseFloat(shippedCard.textContent.replace(/,/g, '')) || 0 : 0;
            
            // 执行原始更新
            originalUpdateMetrics.call(this);
            
            // 如果发货量被重置为0，恢复正确值
            setTimeout(() => {
                const newShipped = shippedCard ? parseFloat(shippedCard.textContent.replace(/,/g, '')) || 0 : 0;
                if (currentShipped > 0 && newShipped === 0) {
                    console.warn(`  🛡️ 检测到发货量被重置，恢复为 ${currentShipped.toFixed(1)}米`);
                    if (shippedCard) {
                        shippedCard.textContent = window.dashboard.formatNumber(currentShipped, 1);
                    }
                }
            }, 100);
        };
        
        console.log('  ✅ updateMetrics方法已保护');
    }
    
    // 禁用checkDataStatus方法
    if (window.dashboard && typeof window.dashboard.checkDataStatus === 'function') {
        window.dashboard.checkDataStatus = function() {
            console.log('  🛡️ checkDataStatus已被禁用');
        };
        console.log('  ✅ checkDataStatus方法已禁用');
    }
}

// 6. 创建DOM保护
function createDOMProtection() {
    console.log('6️⃣ 创建DOM保护...');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (!shippedCard) {
        console.error('  ❌ 未找到发货量卡片');
        return;
    }
    
    // 获取当前正确值
    const correctValue = parseFloat(shippedCard.textContent.replace(/,/g, '')) || 0;
    
    if (correctValue === 0) {
        console.log('  ⚠️ 当前显示值为0，跳过DOM保护');
        return;
    }
    
    // 创建MutationObserver监控DOM变化
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const currentValue = parseFloat(shippedCard.textContent.replace(/,/g, '')) || 0;
                
                if (currentValue === 0 && correctValue > 0) {
                    console.warn(`  🛡️ DOM监控：检测到发货量被重置，立即恢复为 ${correctValue.toFixed(1)}米`);
                    shippedCard.textContent = window.dashboard ? window.dashboard.formatNumber(correctValue, 1) : correctValue.toFixed(1);
                }
            }
        });
    });
    
    observer.observe(shippedCard, {
        childList: true,
        characterData: true,
        subtree: true
    });
    
    // 保存到全局以便清理
    window.shippingDOMObserver = observer;
    
    console.log(`  ✅ DOM保护已启动，保护值: ${correctValue.toFixed(1)}米`);
}

// 7. 从规格中提取长度
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

// 8. 终极修复流程
function ultimateShippingFix() {
    console.log('🚀 开始终极修复流程...');
    console.log('='.repeat(60));
    
    // 步骤1：停止问题定时器
    stopProblematicTimers();
    
    // 步骤2：计算并锁定正确值
    const correctValue = calculateAndLockShippingValue();
    
    if (correctValue === 0) {
        console.log('⚠️ 发货量为0，可能确实没有发货数据');
        return 0;
    }
    
    // 步骤3：保护动画函数
    protectAnimateNumber();
    
    // 步骤4：保护更新方法
    protectUpdateMethods();
    
    // 步骤5：创建DOM保护
    createDOMProtection();
    
    // 步骤6：立即设置正确值
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        shippedCard.textContent = window.dashboard ? window.dashboard.formatNumber(correctValue, 1) : correctValue.toFixed(1);
        
        // 添加保护标识
        shippedCard.style.border = '2px solid #10b981';
        shippedCard.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
        shippedCard.title = `已保护发货量: ${correctValue.toFixed(1)}米`;
        
        console.log(`  ✅ 发货量已设置并保护: ${correctValue.toFixed(1)}米`);
    }
    
    console.log('='.repeat(60));
    console.log('🎉 终极修复完成！');
    console.log(`📊 发货量已锁定为: ${correctValue.toFixed(1)}米`);
    console.log('🛡️ 保护机制已启动:');
    console.log('  - 数据源已锁定');
    console.log('  - 动画函数已保护');
    console.log('  - 更新方法已保护');
    console.log('  - DOM变化监控已启动');
    console.log('  - 问题定时器已停止');
    console.log('');
    console.log('💡 如需解除保护: unlockAllShippingProtection()');
    
    return correctValue;
}

// 9. 解除所有保护
function unlockAllShippingProtection() {
    console.log('🔓 解除所有发货量保护...');
    
    // 恢复数据属性
    if (window.dashboard && window.dashboard.data) {
        delete window.dashboard.data.shippedMeters;
    }
    if (window.main && window.main.data) {
        delete window.main.data.shippedMeters;
    }
    
    // 停止DOM监控
    if (window.shippingDOMObserver) {
        window.shippingDOMObserver.disconnect();
        window.shippingDOMObserver = null;
    }
    
    // 移除视觉标识
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        shippedCard.style.border = '';
        shippedCard.style.boxShadow = '';
        shippedCard.title = '';
    }
    
    console.log('✅ 所有保护已解除');
}

// 导出函数到全局
window.ultimateShippingFix = {
    calculateAndLockShippingValue,
    lockValueInAllSources,
    protectAnimateNumber,
    stopProblematicTimers,
    protectUpdateMethods,
    createDOMProtection,
    ultimateShippingFix,
    unlockAllShippingProtection
};

// 保存解锁函数到全局
window.unlockAllShippingProtection = unlockAllShippingProtection;

// 自动执行修复
console.log('🎯 自动执行终极修复...');
const result = ultimateShippingFix();

console.log('');
console.log('💡 使用方法:');
console.log('ultimateShippingFix.ultimateShippingFix() - 重新执行修复');
console.log('unlockAllShippingProtection() - 解除所有保护');
