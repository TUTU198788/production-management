// 调试发货量计算问题的脚本
// 在浏览器控制台中运行此脚本

console.log('🔍 开始调试发货量计算问题...');
console.log('='.repeat(60));

// 1. 检查数据管理器状态
function checkDataManager() {
    console.log('1️⃣ 检查数据管理器状态:');
    
    if (!window.dataManager) {
        console.error('❌ dataManager不存在');
        return false;
    }
    
    const data = window.dataManager.data || [];
    console.log(`  📊 生产数据: ${data.length} 条记录`);
    
    const shippingHistory = window.dataManager.shippingHistory || [];
    console.log(`  🚚 发货历史: ${shippingHistory.length} 条记录`);
    
    const materialPurchases = window.dataManager.materialPurchases || [];
    console.log(`  🏗️ 原材料采购: ${materialPurchases.length} 条记录`);
    
    return true;
}

// 2. 检查生产数据中的发货记录
function checkProductionShippingRecords() {
    console.log('2️⃣ 检查生产数据中的发货记录:');
    
    if (!window.dataManager || !window.dataManager.data) {
        console.error('❌ 无法访问生产数据');
        return;
    }
    
    const data = window.dataManager.data;
    let totalShippedFromProduction = 0;
    let recordsWithShipping = 0;
    let totalShippingRecords = 0;
    
    console.log('  📋 逐项检查:');
    
    data.forEach((item, index) => {
        const shipped = item.shipped || 0;
        const shippingRecords = item.shippingRecords || [];
        
        if (shipped > 0 || shippingRecords.length > 0) {
            recordsWithShipping++;
            totalShippedFromProduction += shipped;
            totalShippingRecords += shippingRecords.length;
            
            if (index < 5) { // 只显示前5条详情
                console.log(`    ${item.spec} (${item.area}):`);
                console.log(`      - shipped字段: ${shipped}`);
                console.log(`      - shippingRecords: ${shippingRecords.length} 条`);
                
                if (shippingRecords.length > 0) {
                    shippingRecords.forEach(record => {
                        console.log(`        * ${record.customer || record.customerName}: ${record.quantity}根 (${record.date})`);
                    });
                }
            }
        }
    });
    
    console.log(`  📊 统计结果:`);
    console.log(`    有发货记录的项目: ${recordsWithShipping} / ${data.length}`);
    console.log(`    shipped字段总计: ${totalShippedFromProduction} 根`);
    console.log(`    发货记录总数: ${totalShippingRecords} 条`);
    
    return {
        recordsWithShipping,
        totalShippedFromProduction,
        totalShippingRecords
    };
}

// 3. 检查发货历史数据
function checkShippingHistory() {
    console.log('3️⃣ 检查发货历史数据:');
    
    if (!window.dataManager || !window.dataManager.shippingHistory) {
        console.error('❌ 无法访问发货历史');
        return;
    }
    
    const shippingHistory = window.dataManager.shippingHistory;
    let totalMetersFromHistory = 0;
    let totalQuantityFromHistory = 0;
    
    console.log(`  📦 发货历史记录: ${shippingHistory.length} 条`);
    
    if (shippingHistory.length > 0) {
        console.log('  📋 前5条记录详情:');
        
        shippingHistory.slice(0, 5).forEach((record, index) => {
            const meters = record.meters || 0;
            const weight = record.weight || 0;
            
            totalMetersFromHistory += meters;
            
            console.log(`    第${index + 1}条:`);
            console.log(`      客户: ${record.customerName}`);
            console.log(`      日期: ${record.date}`);
            console.log(`      米数: ${meters}米`);
            console.log(`      重量: ${weight}吨`);
            
            if (record.items && record.items.length > 0) {
                console.log(`      明细: ${record.items.length} 个规格`);
                record.items.forEach(item => {
                    totalQuantityFromHistory += item.quantity || 0;
                    console.log(`        - ${item.spec}: ${item.quantity}根`);
                });
            }
        });
        
        console.log(`  📊 发货历史统计:`);
        console.log(`    总米数: ${totalMetersFromHistory.toFixed(1)}米`);
        console.log(`    总根数: ${totalQuantityFromHistory}根`);
    } else {
        console.log('  ⚠️ 发货历史为空');
    }
    
    return {
        totalMetersFromHistory,
        totalQuantityFromHistory
    };
}

// 4. 检查客户统计计算
function checkCustomerStats() {
    console.log('4️⃣ 检查客户统计计算:');
    
    if (!window.dataManager || typeof window.dataManager.calculateCustomerStats !== 'function') {
        console.error('❌ calculateCustomerStats方法不存在');
        return;
    }
    
    try {
        const customerStats = window.dataManager.calculateCustomerStats();
        console.log(`  👥 客户统计: ${customerStats.length} 个客户`);
        
        let totalMetersFromCustomers = 0;
        let totalQuantityFromCustomers = 0;
        
        console.log('  📋 客户发货详情:');
        customerStats.forEach((customer, index) => {
            totalMetersFromCustomers += customer.totalMeters || 0;
            totalQuantityFromCustomers += customer.totalQuantity || 0;
            
            if (index < 5 && customer.totalMeters > 0) { // 只显示前5个有发货的客户
                console.log(`    ${customer.customerName}:`);
                console.log(`      发货量: ${customer.totalMeters.toFixed(1)}米 (${customer.totalQuantity}根)`);
                console.log(`      订单数: ${customer.orderCount}`);
                console.log(`      规格数: ${customer.specsCount}`);
            }
        });
        
        console.log(`  📊 客户统计总计:`);
        console.log(`    总米数: ${totalMetersFromCustomers.toFixed(1)}米`);
        console.log(`    总根数: ${totalQuantityFromCustomers}根`);
        
        return {
            customerStats,
            totalMetersFromCustomers,
            totalQuantityFromCustomers
        };
    } catch (error) {
        console.error('❌ 客户统计计算失败:', error);
        return null;
    }
}

// 5. 检查主界面显示
function checkDashboardDisplay() {
    console.log('5️⃣ 检查主界面显示:');
    
    // 检查已发货量卡片
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    if (shippedCard) {
        console.log(`  📊 已发货量卡片显示: "${shippedCard.textContent}"`);
    } else {
        console.log('  ❌ 未找到已发货量卡片');
    }
    
    // 检查dashboard数据
    if (window.dashboard && window.dashboard.data) {
        console.log(`  📈 Dashboard数据:`);
        console.log(`    总需求量: ${window.dashboard.data.totalDemandMeters?.toFixed(1) || 0}米`);
        console.log(`    已生产量: ${window.dashboard.data.producedMeters?.toFixed(1) || 0}米`);
        console.log(`    已发货量: ${window.dashboard.data.shippedMeters?.toFixed(1) || 0}米`);
        console.log(`    未发货量: ${window.dashboard.data.unshippedMeters?.toFixed(1) || 0}米`);
    } else {
        console.log('  ❌ Dashboard数据不存在');
    }
    
    // 检查main.js数据
    if (window.main && window.main.data) {
        console.log(`  📈 Main数据:`);
        console.log(`    总需求量: ${window.main.data.totalDemandMeters?.toFixed(1) || 0}米`);
        console.log(`    已生产量: ${window.main.data.producedMeters?.toFixed(1) || 0}米`);
        console.log(`    已发货量: ${window.main.data.shippedMeters?.toFixed(1) || 0}米`);
        console.log(`    未发货量: ${window.main.data.unshippedMeters?.toFixed(1) || 0}米`);
    } else {
        console.log('  ❌ Main数据不存在');
    }
}

// 6. 手动重新计算发货量
function recalculateShippingMeters() {
    console.log('6️⃣ 手动重新计算发货量:');
    
    if (!window.dataManager) {
        console.error('❌ dataManager不存在');
        return 0;
    }
    
    // 方法1：从客户统计计算
    let shippedMeters1 = 0;
    try {
        const customerStats = window.dataManager.calculateCustomerStats();
        shippedMeters1 = customerStats.reduce((sum, customer) => {
            return sum + (customer.totalMeters || 0);
        }, 0);
        console.log(`  📊 方法1 (客户统计): ${shippedMeters1.toFixed(1)}米`);
    } catch (error) {
        console.error('  ❌ 方法1失败:', error);
    }
    
    // 方法2：从发货历史计算
    let shippedMeters2 = 0;
    if (window.dataManager.shippingHistory) {
        shippedMeters2 = window.dataManager.shippingHistory.reduce((sum, record) => {
            return sum + (record.meters || 0);
        }, 0);
        console.log(`  📦 方法2 (发货历史): ${shippedMeters2.toFixed(1)}米`);
    }
    
    // 方法3：从生产数据的shipped字段计算
    let shippedMeters3 = 0;
    if (window.dataManager.data) {
        shippedMeters3 = window.dataManager.data.reduce((sum, item) => {
            const length = window.main ? window.main.extractLengthFromSpec(item.spec) : 6000;
            const shipped = item.shipped || 0;
            return sum + (shipped * length / 1000);
        }, 0);
        console.log(`  📋 方法3 (生产数据shipped): ${shippedMeters3.toFixed(1)}米`);
    }
    
    console.log(`  🎯 推荐使用: ${Math.max(shippedMeters1, shippedMeters2, shippedMeters3).toFixed(1)}米`);
    
    return Math.max(shippedMeters1, shippedMeters2, shippedMeters3);
}

// 7. 修复发货量显示
function fixShippingDisplay() {
    console.log('7️⃣ 尝试修复发货量显示:');
    
    const correctShippedMeters = recalculateShippingMeters();
    
    if (correctShippedMeters > 0) {
        // 更新dashboard数据
        if (window.dashboard && window.dashboard.data) {
            window.dashboard.data.shippedMeters = correctShippedMeters;
            console.log(`  ✅ 已更新dashboard.data.shippedMeters = ${correctShippedMeters.toFixed(1)}米`);
        }
        
        // 更新main数据
        if (window.main && window.main.data) {
            window.main.data.shippedMeters = correctShippedMeters;
            window.main.data.unshippedMeters = Math.max(0, (window.main.data.producedMeters || 0) - correctShippedMeters);
            console.log(`  ✅ 已更新main.data.shippedMeters = ${correctShippedMeters.toFixed(1)}米`);
        }
        
        // 更新界面显示
        const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
        if (shippedCard) {
            shippedCard.textContent = correctShippedMeters.toFixed(1);
            console.log(`  ✅ 已更新界面显示`);
        }
        
        // 更新未发货量
        const unshippedCard = document.querySelector('.metric-card.unshipped .metric-value');
        if (unshippedCard && window.main && window.main.data) {
            unshippedCard.textContent = window.main.data.unshippedMeters.toFixed(1);
            console.log(`  ✅ 已更新未发货量显示`);
        }
        
        console.log(`  🎉 修复完成！已发货量: ${correctShippedMeters.toFixed(1)}米`);
    } else {
        console.log(`  ⚠️ 计算结果为0，可能确实没有发货数据`);
    }
}

// 8. 完整诊断流程
function fullDiagnosis() {
    console.log('🚀 开始完整诊断流程...');
    console.log('='.repeat(60));
    
    if (!checkDataManager()) {
        return;
    }
    
    const productionStats = checkProductionShippingRecords();
    const historyStats = checkShippingHistory();
    const customerStats = checkCustomerStats();
    
    checkDashboardDisplay();
    
    console.log('='.repeat(60));
    console.log('📊 诊断总结:');
    
    if (productionStats) {
        console.log(`  生产数据中有发货记录的项目: ${productionStats.recordsWithShipping}`);
        console.log(`  生产数据shipped字段总计: ${productionStats.totalShippedFromProduction}根`);
    }
    
    if (historyStats) {
        console.log(`  发货历史总米数: ${historyStats.totalMetersFromHistory.toFixed(1)}米`);
        console.log(`  发货历史总根数: ${historyStats.totalQuantityFromHistory}根`);
    }
    
    if (customerStats) {
        console.log(`  客户统计总米数: ${customerStats.totalMetersFromCustomers.toFixed(1)}米`);
        console.log(`  客户统计总根数: ${customerStats.totalQuantityFromCustomers}根`);
    }
    
    console.log('='.repeat(60));
    console.log('💡 使用方法:');
    console.log('  fixShippingDisplay() - 尝试修复发货量显示');
    console.log('  recalculateShippingMeters() - 重新计算发货量');
}

// 导出函数到全局
window.shippingDebug = {
    checkDataManager,
    checkProductionShippingRecords,
    checkShippingHistory,
    checkCustomerStats,
    checkDashboardDisplay,
    recalculateShippingMeters,
    fixShippingDisplay,
    fullDiagnosis
};

// 自动运行完整诊断
fullDiagnosis();
