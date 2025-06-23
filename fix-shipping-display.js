// 修复发货量显示问题的脚本
// 在浏览器控制台中运行此脚本

console.log('🔧 开始修复发货量显示问题...');
console.log('='.repeat(50));

// 1. 检查当前状态
function checkCurrentState() {
    console.log('1️⃣ 检查当前状态:');
    
    // 检查已发货量卡片显示
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const currentDisplay = shippedCard ? shippedCard.textContent : '未找到';
    console.log(`  📊 当前显示: ${currentDisplay}`);
    
    // 检查数据管理器
    const hasDataManager = !!window.dataManager;
    const dataLength = window.dataManager?.data?.length || 0;
    console.log(`  📋 DataManager: ${hasDataManager ? '存在' : '不存在'}, 数据: ${dataLength} 条`);
    
    // 检查DataCore
    const hasDataCore = !!window.dataCore;
    const coreDataLength = window.dataCore?.data?.length || 0;
    console.log(`  🏗️ DataCore: ${hasDataCore ? '存在' : '不存在'}, 数据: ${coreDataLength} 条`);
    
    // 检查Dashboard
    const hasDashboard = !!window.dashboard;
    const dashboardShipped = window.dashboard?.data?.shippedMeters || 0;
    console.log(`  📈 Dashboard: ${hasDashboard ? '存在' : '不存在'}, 发货量: ${dashboardShipped.toFixed(1)}米`);
    
    return {
        currentDisplay,
        hasDataManager,
        dataLength,
        hasDataCore,
        coreDataLength,
        hasDashboard,
        dashboardShipped
    };
}

// 2. 计算正确的发货量
function calculateCorrectShippedMeters() {
    console.log('2️⃣ 计算正确的发货量:');
    
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
                
                // 显示客户详情
                customerStats.forEach(customer => {
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
    return { shippedMeters, calculationMethod };
}

// 3. 从规格型号中提取长度
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

// 4. 更新所有相关的数据和显示
function updateAllShippingData(shippedMeters) {
    console.log('3️⃣ 更新所有相关的数据和显示:');
    
    // 更新Dashboard数据
    if (window.dashboard && window.dashboard.data) {
        const oldValue = window.dashboard.data.shippedMeters || 0;
        window.dashboard.data.shippedMeters = shippedMeters;
        
        // 重新计算未发货量
        const producedMeters = window.dashboard.data.producedMeters || 0;
        window.dashboard.data.unshippedMeters = Math.max(0, producedMeters - shippedMeters);
        
        console.log(`  📈 Dashboard更新: ${oldValue.toFixed(1)} → ${shippedMeters.toFixed(1)}米`);
    }
    
    // 更新Main数据
    if (window.main && window.main.data) {
        const oldValue = window.main.data.shippedMeters || 0;
        window.main.data.shippedMeters = shippedMeters;
        
        // 重新计算未发货量
        const producedMeters = window.main.data.producedMeters || 0;
        window.main.data.unshippedMeters = Math.max(0, producedMeters - shippedMeters);
        
        console.log(`  📊 Main更新: ${oldValue.toFixed(1)} → ${shippedMeters.toFixed(1)}米`);
    }
    
    // 更新界面显示
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        const oldDisplay = shippedCard.textContent;
        shippedCard.textContent = shippedMeters.toFixed(1);
        
        // 添加更新动画
        shippedCard.style.transform = 'scale(1.1)';
        shippedCard.style.color = '#10b981';
        setTimeout(() => {
            shippedCard.style.transform = 'scale(1)';
            shippedCard.style.color = '';
        }, 500);
        
        console.log(`  🎨 界面更新: "${oldDisplay}" → "${shippedMeters.toFixed(1)}"`);
    }
    
    // 更新未发货量显示
    const unshippedCard = document.querySelector('.metric-card.unshipped .metric-value');
    if (unshippedCard && window.main && window.main.data) {
        const oldDisplay = unshippedCard.textContent;
        unshippedCard.textContent = window.main.data.unshippedMeters.toFixed(1);
        
        // 添加更新动画
        unshippedCard.style.transform = 'scale(1.1)';
        unshippedCard.style.color = '#3b82f6';
        setTimeout(() => {
            unshippedCard.style.transform = 'scale(1)';
            unshippedCard.style.color = '';
        }, 500);
        
        console.log(`  🎨 未发货量更新: "${oldDisplay}" → "${window.main.data.unshippedMeters.toFixed(1)}"`);
    }
}

// 5. 强制刷新统计
function forceRefreshStats() {
    console.log('4️⃣ 强制刷新统计:');
    
    // 刷新Dashboard
    if (window.dashboard && typeof window.dashboard.updateMetricsFromDataManager === 'function') {
        try {
            window.dashboard.updateMetricsFromDataManager();
            console.log('  ✅ Dashboard统计已刷新');
        } catch (error) {
            console.error('  ❌ Dashboard刷新失败:', error);
        }
    }
    
    // 刷新Main
    if (window.main && typeof window.main.updateMetricsFromDataManager === 'function') {
        try {
            window.main.updateMetricsFromDataManager();
            console.log('  ✅ Main统计已刷新');
        } catch (error) {
            console.error('  ❌ Main刷新失败:', error);
        }
    }
    
    // 刷新图表
    if (window.dashboard && typeof window.dashboard.updateCharts === 'function') {
        try {
            window.dashboard.updateCharts();
            console.log('  ✅ 图表已刷新');
        } catch (error) {
            console.error('  ❌ 图表刷新失败:', error);
        }
    }
}

// 6. 完整修复流程
function fixShippingDisplay() {
    console.log('🚀 开始完整修复流程...');
    console.log('='.repeat(50));
    
    // 检查当前状态
    const currentState = checkCurrentState();
    
    if (!currentState.hasDataManager) {
        console.error('❌ DataManager不存在，无法修复');
        return false;
    }
    
    if (currentState.dataLength === 0) {
        console.error('❌ 没有生产数据，无法计算发货量');
        return false;
    }
    
    // 计算正确的发货量
    const { shippedMeters, calculationMethod } = calculateCorrectShippedMeters();
    
    if (shippedMeters === 0) {
        console.log('⚠️ 计算结果为0，可能确实没有发货数据');
        
        // 仍然更新显示为0
        updateAllShippingData(0);
        console.log('✅ 已将发货量显示更新为0');
        return true;
    }
    
    // 更新数据和显示
    updateAllShippingData(shippedMeters);
    
    // 强制刷新统计
    setTimeout(() => {
        forceRefreshStats();
    }, 500);
    
    console.log('='.repeat(50));
    console.log(`🎉 修复完成！`);
    console.log(`📊 发货量: ${shippedMeters.toFixed(1)}米 (${calculationMethod})`);
    console.log(`🎯 建议: 如果数据仍不正确，请检查发货记录的完整性`);
    
    return true;
}

// 7. 验证修复结果
function verifyFix() {
    console.log('5️⃣ 验证修复结果:');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const currentDisplay = shippedCard ? shippedCard.textContent : '未找到';
    
    const dashboardShipped = window.dashboard?.data?.shippedMeters || 0;
    const mainShipped = window.main?.data?.shippedMeters || 0;
    
    console.log(`  📊 界面显示: ${currentDisplay}`);
    console.log(`  📈 Dashboard数据: ${dashboardShipped.toFixed(1)}米`);
    console.log(`  📊 Main数据: ${mainShipped.toFixed(1)}米`);
    
    const isConsistent = Math.abs(dashboardShipped - mainShipped) < 0.1;
    console.log(`  🎯 数据一致性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
    
    return isConsistent;
}

// 导出函数到全局
window.shippingFix = {
    checkCurrentState,
    calculateCorrectShippedMeters,
    updateAllShippingData,
    forceRefreshStats,
    fixShippingDisplay,
    verifyFix
};

// 自动执行修复
console.log('🎯 自动执行修复...');
const success = fixShippingDisplay();

if (success) {
    setTimeout(() => {
        verifyFix();
    }, 1000);
}

console.log('');
console.log('💡 使用方法:');
console.log('shippingFix.fixShippingDisplay() - 重新执行修复');
console.log('shippingFix.verifyFix() - 验证修复结果');
console.log('shippingFix.calculateCorrectShippedMeters() - 重新计算发货量');
