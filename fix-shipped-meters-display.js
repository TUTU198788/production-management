// 修复已发货量显示问题
// 在浏览器控制台中运行此脚本

console.log('🚀 开始修复已发货量显示问题...');

// 1. 检查当前状态
function checkCurrentShippingState() {
    console.log('1️⃣ 检查当前发货状态:');
    
    // 检查主界面显示
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const currentDisplay = shippedCard ? shippedCard.textContent : '未找到';
    console.log(`  📊 主界面显示: "${currentDisplay}"`);
    
    // 检查DataManager
    const hasDataManager = !!window.dataManager;
    const dataLength = window.dataManager?.data?.length || 0;
    console.log(`  📋 DataManager: ${hasDataManager ? '存在' : '不存在'}, 数据量: ${dataLength}`);
    
    // 检查发货历史
    const shippingHistory = window.dataManager?.shippingHistory || [];
    console.log(`  📦 发货历史: ${shippingHistory.length} 条记录`);
    
    // 检查Dashboard
    const hasDashboard = !!window.dashboard;
    const dashboardShipped = window.dashboard?.data?.shippedMeters || 0;
    console.log(`  📈 Dashboard: ${hasDashboard ? '存在' : '不存在'}, 发货量: ${dashboardShipped.toFixed(1)}米`);
    
    return {
        currentDisplay,
        hasDataManager,
        dataLength,
        shippingHistoryLength: shippingHistory.length,
        hasDashboard,
        dashboardShipped
    };
}

// 2. 计算正确的发货量
function calculateCorrectShippedMeters() {
    console.log('2️⃣ 计算正确的发货量:');
    
    let shippedMeters = 0;
    let calculationMethod = '';
    
    // 方法1：从发货历史计算
    if (window.dataManager?.shippingHistory && window.dataManager.shippingHistory.length > 0) {
        console.log('  📦 方法1: 从发货历史计算');
        
        shippedMeters = window.dataManager.shippingHistory.reduce((sum, record) => {
            const recordMeters = record.totalMeters || 0;
            if (recordMeters > 0) {
                console.log(`    - ${record.customerName}: ${recordMeters.toFixed(1)}米 (${record.date})`);
            }
            return sum + recordMeters;
        }, 0);
        
        if (shippedMeters > 0) {
            calculationMethod = '发货历史';
            console.log(`  ✅ 发货历史计算结果: ${shippedMeters.toFixed(1)}米`);
        }
    }
    
    // 方法2：从客户统计计算
    if (shippedMeters === 0 && window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        console.log('  👥 方法2: 从客户统计计算');
        
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            const customerShippedMeters = customerStats.reduce((sum, customer) => {
                return sum + (customer.totalMeters || 0);
            }, 0);
            
            if (customerShippedMeters > 0) {
                shippedMeters = customerShippedMeters;
                calculationMethod = '客户统计';
                console.log(`  ✅ 客户统计计算结果: ${shippedMeters.toFixed(1)}米`);
                
                // 显示客户详情
                customerStats.forEach(customer => {
                    if (customer.totalMeters > 0) {
                        console.log(`    - ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                    }
                });
            }
        } catch (error) {
            console.error('  ❌ 客户统计计算失败:', error);
        }
    }
    
    // 方法3：从生产数据的shipped字段计算
    if (shippedMeters === 0 && window.dataManager?.data) {
        console.log('  🏭 方法3: 从生产数据shipped字段计算');
        
        shippedMeters = window.dataManager.data.reduce((sum, item) => {
            const shipped = item.shipped || 0;
            if (shipped > 0) {
                const length = extractLengthFromSpec(item.spec);
                const meters = shipped * length / 1000;
                console.log(`    - ${item.spec}: ${shipped}根 × ${length}mm = ${meters.toFixed(1)}米`);
                return sum + meters;
            }
            return sum;
        }, 0);
        
        if (shippedMeters > 0) {
            calculationMethod = '生产数据shipped字段';
            console.log(`  ✅ 生产数据计算结果: ${shippedMeters.toFixed(1)}米`);
        }
    }
    
    console.log(`  📊 最终计算结果: ${shippedMeters.toFixed(1)}米 (来源: ${calculationMethod || '无数据'})`);
    
    return { shippedMeters, calculationMethod };
}

// 3. 辅助函数：提取规格长度
function extractLengthFromSpec(spec) {
    if (!spec) return 6000;
    
    const patterns = [
        /L=(\d+)/,           // L=6000
        /长度[：:]\s*(\d+)/,   // 长度：6000
        /(\d+)mm/i,          // 6000mm
        /(\d+)MM/,           // 6000MM
        /L(\d+)/,            // L6000
        /-(\d+)$/,           // 规格-6000
        /×(\d+)/,            // 规格×6000
        /\*(\d+)/,           // 规格*6000
        /(\d{4,})/           // 直接的4位以上数字
    ];
    
    for (const pattern of patterns) {
        const match = spec.match(pattern);
        if (match) {
            const length = parseInt(match[1]);
            if (length >= 1000 && length <= 20000) {
                return length;
            }
        }
    }
    
    return 6000; // 默认长度
}

// 4. 更新所有相关的发货数据
function updateAllShippingData(shippedMeters) {
    console.log('3️⃣ 更新所有发货数据:');
    
    // 更新Dashboard数据
    if (window.dashboard) {
        window.dashboard.data.shippedMeters = shippedMeters;
        window.dashboard.data.unshippedMeters = Math.max(0, 
            (window.dashboard.data.producedMeters || 0) - shippedMeters
        );
        console.log(`  📈 Dashboard数据已更新: ${shippedMeters.toFixed(1)}米`);
    }
    
    // 更新主界面显示
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        // 使用动画更新数字
        if (window.dashboard && typeof window.dashboard.animateNumber === 'function') {
            window.dashboard.animateNumber(shippedCard, shippedMeters, 1);
        } else {
            shippedCard.textContent = shippedMeters.toFixed(1);
        }
        console.log(`  🎨 主界面显示已更新: ${shippedMeters.toFixed(1)}米`);
    }
    
    // 更新未发货量
    const unshippedCard = document.querySelector('.metric-card.unshipped .metric-value');
    if (unshippedCard && window.dashboard) {
        const unshippedMeters = window.dashboard.data.unshippedMeters || 0;
        if (window.dashboard && typeof window.dashboard.animateNumber === 'function') {
            window.dashboard.animateNumber(unshippedCard, unshippedMeters, 1);
        } else {
            unshippedCard.textContent = unshippedMeters.toFixed(1);
        }
        console.log(`  📦 未发货量已更新: ${unshippedMeters.toFixed(1)}米`);
    }
}

// 5. 强制刷新统计
function forceRefreshStats() {
    console.log('4️⃣ 强制刷新统计:');
    
    // 刷新Dashboard统计
    if (window.dashboard && typeof window.dashboard.updateMetricsFromDataManager === 'function') {
        window.dashboard.updateMetricsFromDataManager();
        console.log('  📈 Dashboard统计已刷新');
    }
    
    // 刷新DataManager统计
    if (window.dataManager && typeof window.dataManager.updateStats === 'function') {
        window.dataManager.updateStats();
        console.log('  📋 DataManager统计已刷新');
    }
    
    // 刷新客户统计
    if (window.dataManager && typeof window.dataManager.renderCustomerStats === 'function') {
        window.dataManager.renderCustomerStats();
        console.log('  👥 客户统计已刷新');
    }
}

// 6. 验证修复结果
function verifyFix() {
    console.log('5️⃣ 验证修复结果:');
    
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const newDisplay = shippedCard ? shippedCard.textContent : '未找到';
    const dashboardShipped = window.dashboard?.data?.shippedMeters || 0;
    
    console.log(`  📊 主界面显示: "${newDisplay}"`);
    console.log(`  📈 Dashboard数据: ${dashboardShipped.toFixed(1)}米`);
    
    const isFixed = parseFloat(newDisplay) > 0 && dashboardShipped > 0;
    
    if (isFixed) {
        console.log('  ✅ 修复成功！');
        return true;
    } else {
        console.log('  ❌ 修复失败');
        return false;
    }
}

// 7. 完整修复流程
function fixShippedMetersDisplay() {
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
        
        // 验证修复结果
        setTimeout(() => {
            const success = verifyFix();
            
            if (success) {
                console.log('');
                console.log('🎉 已发货量修复完成！');
                console.log(`📦 发货量: ${shippedMeters.toFixed(1)}米`);
                console.log(`📊 数据来源: ${calculationMethod}`);
                console.log('');
                alert(`已发货量修复成功！\n\n发货量: ${shippedMeters.toFixed(1)}米\n数据来源: ${calculationMethod}`);
            } else {
                console.log('');
                console.log('❌ 修复失败，请检查数据');
                console.log('');
                alert('修复失败，请检查控制台日志');
            }
        }, 1000);
    }, 500);
    
    return true;
}

// 执行修复
fixShippedMetersDisplay();
