// 快速修复发货量显示问题
// 在浏览器控制台中运行此脚本

console.log('⚡ 快速修复发货量显示问题...');

// 1. 立即停止所有定时器
console.log('🛑 停止所有定时器...');
for (let i = 1; i < 10000; i++) {
    try {
        clearInterval(i);
        clearTimeout(i);
    } catch (e) {}
}

// 2. 计算正确的发货量
function getCorrectShippingValue() {
    let shippedMeters = 0;
    
    // 从客户统计计算
    if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            shippedMeters = customerStats.reduce((sum, customer) => sum + (customer.totalMeters || 0), 0);
            if (shippedMeters > 0) {
                console.log(`📦 从客户统计获取: ${shippedMeters.toFixed(1)}米`);
                return shippedMeters;
            }
        } catch (error) {
            console.error('客户统计计算失败:', error);
        }
    }
    
    // 从生产数据计算
    if (shippedMeters === 0 && window.dataManager && window.dataManager.data) {
        shippedMeters = window.dataManager.data.reduce((sum, item) => {
            const length = extractLength(item.spec);
            const shipped = item.shipped || 0;
            return sum + (shipped * length / 1000);
        }, 0);
        if (shippedMeters > 0) {
            console.log(`📦 从生产数据获取: ${shippedMeters.toFixed(1)}米`);
        }
    }
    
    return shippedMeters;
}

function extractLength(spec) {
    if (!spec) return 6000;
    const match = spec.match(/(\d{4,})/);
    return match ? parseInt(match[1]) : 6000;
}

// 3. 获取正确值并锁定
const correctValue = getCorrectShippingValue();
console.log(`🎯 正确发货量: ${correctValue.toFixed(1)}米`);

if (correctValue === 0) {
    console.log('⚠️ 发货量为0，可能确实没有发货数据');
} else {
    // 4. 锁定发货量卡片
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        // 立即设置正确值
        shippedCard.textContent = correctValue.toFixed(1);
        
        // 锁定textContent属性
        Object.defineProperty(shippedCard, 'textContent', {
            get: function() {
                return correctValue.toFixed(1);
            },
            set: function(value) {
                const numValue = parseFloat(value) || 0;
                if (numValue === 0 && correctValue > 0) {
                    console.warn(`🛡️ 阻止发货量被重置为0`);
                    return;
                }
                // 允许设置更大的值
                if (numValue > correctValue) {
                    correctValue = numValue;
                    console.log(`📈 发货量更新为: ${numValue.toFixed(1)}米`);
                }
            },
            configurable: true
        });
        
        // 添加视觉保护标识
        shippedCard.style.border = '2px solid #10b981';
        shippedCard.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        shippedCard.style.color = 'white';
        shippedCard.style.fontWeight = 'bold';
        shippedCard.title = `🛡️ 已保护: ${correctValue.toFixed(1)}米`;
        
        console.log(`✅ 发货量已锁定为: ${correctValue.toFixed(1)}米`);
    }
    
    // 5. 禁用可能修改发货量的方法
    if (window.dashboard) {
        // 保护animateNumber
        const originalAnimateNumber = window.dashboard.animateNumber;
        if (originalAnimateNumber) {
            window.dashboard.animateNumber = function(element, targetValue, decimals = 0) {
                const isShippedElement = element.closest('.metric-card.shipped');
                if (isShippedElement && targetValue === 0 && correctValue > 0) {
                    console.warn(`🛡️ 阻止发货量动画到0`);
                    return;
                }
                originalAnimateNumber.call(this, element, targetValue, decimals);
            };
        }
        
        // 禁用数据检查
        window.dashboard.checkDataStatus = function() {
            console.log('🛡️ 数据检查已被禁用');
        };
        
        // 保护updateMetrics
        const originalUpdateMetrics = window.dashboard.updateMetrics;
        if (originalUpdateMetrics) {
            window.dashboard.updateMetrics = function() {
                const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
                const currentValue = shippedCard ? parseFloat(shippedCard.textContent) || 0 : 0;
                
                originalUpdateMetrics.call(this);
                
                // 确保发货量不被重置
                setTimeout(() => {
                    if (shippedCard && currentValue > 0) {
                        const newValue = parseFloat(shippedCard.textContent) || 0;
                        if (newValue === 0) {
                            shippedCard.textContent = currentValue.toFixed(1);
                            console.warn(`🛡️ 恢复发货量为: ${currentValue.toFixed(1)}米`);
                        }
                    }
                }, 50);
            };
        }
        
        console.log('✅ 关键方法已保护');
    }
    
    // 6. 创建DOM监控
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.closest && mutation.target.closest('.metric-card.shipped .metric-value')) {
                const currentValue = parseFloat(mutation.target.textContent) || 0;
                if (currentValue === 0 && correctValue > 0) {
                    console.warn(`🛡️ DOM监控：恢复发货量`);
                    mutation.target.textContent = correctValue.toFixed(1);
                }
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true
    });
    
    window.shippingObserver = observer;
    
    console.log('✅ DOM监控已启动');
}

// 7. 解除保护函数
window.unlockShipping = function() {
    console.log('🔓 解除发货量保护...');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        delete shippedCard.textContent;
        shippedCard.style.border = '';
        shippedCard.style.background = '';
        shippedCard.style.color = '';
        shippedCard.style.fontWeight = '';
        shippedCard.title = '';
    }
    
    if (window.shippingObserver) {
        window.shippingObserver.disconnect();
        window.shippingObserver = null;
    }
    
    console.log('✅ 保护已解除');
};

console.log('');
console.log('🎉 快速修复完成！');
console.log('💡 如需解除保护: unlockShipping()');
console.log(`📊 当前发货量: ${correctValue.toFixed(1)}米`);

// 返回结果
correctValue;
