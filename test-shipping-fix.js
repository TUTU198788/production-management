// 测试已发货量修复效果
// 在浏览器控制台中运行此脚本

console.log('🧪 测试已发货量修复效果...');

// 1. 检查当前显示
function checkCurrentDisplay() {
    const shippedCard = document.querySelector('.metric-card.shipped .metric-value');
    const currentValue = shippedCard ? shippedCard.textContent : '未找到';
    
    console.log(`📊 当前已发货量显示: "${currentValue}"`);
    
    return parseFloat(currentValue) || 0;
}

// 2. 检查数据源
function checkDataSources() {
    console.log('📋 检查数据源:');
    
    // 检查发货历史
    const shippingHistory = window.dataManager?.shippingHistory || [];
    console.log(`  📦 发货历史: ${shippingHistory.length} 条记录`);
    
    if (shippingHistory.length > 0) {
        const totalFromHistory = shippingHistory.reduce((sum, record) => {
            return sum + (record.totalMeters || 0);
        }, 0);
        console.log(`  📦 发货历史总计: ${totalFromHistory.toFixed(1)}米`);
        
        // 显示前3条记录
        console.log(`  📦 发货历史详情:`);
        shippingHistory.slice(0, 3).forEach((record, index) => {
            console.log(`    ${index + 1}. ${record.customerName}: ${(record.totalMeters || 0).toFixed(1)}米 (${record.date})`);
        });
    }
    
    // 检查客户统计
    if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            const totalFromCustomers = customerStats.reduce((sum, customer) => {
                return sum + (customer.totalMeters || 0);
            }, 0);
            console.log(`  👥 客户统计: ${customerStats.length} 个客户, 总计: ${totalFromCustomers.toFixed(1)}米`);
            
            // 显示有发货的客户
            const customersWithShipping = customerStats.filter(c => c.totalMeters > 0);
            if (customersWithShipping.length > 0) {
                console.log(`  👥 有发货记录的客户:`);
                customersWithShipping.slice(0, 3).forEach((customer, index) => {
                    console.log(`    ${index + 1}. ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                });
            }
        } catch (error) {
            console.error('  ❌ 客户统计计算失败:', error);
        }
    }
    
    // 检查生产数据中的shipped字段
    if (window.dataManager?.data) {
        const itemsWithShipped = window.dataManager.data.filter(item => (item.shipped || 0) > 0);
        console.log(`  🏭 生产数据: ${itemsWithShipped.length} 个项目有shipped字段`);
        
        if (itemsWithShipped.length > 0) {
            let totalFromShipped = 0;
            itemsWithShipped.slice(0, 3).forEach(item => {
                const shipped = item.shipped || 0;
                const length = extractLengthFromSpec(item.spec);
                const meters = shipped * length / 1000;
                totalFromShipped += meters;
                console.log(`    - ${item.spec}: ${shipped}根 × ${length}mm = ${meters.toFixed(1)}米`);
            });
            console.log(`  🏭 生产数据shipped字段总计: ${totalFromShipped.toFixed(1)}米`);
        }
    }
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

// 4. 强制刷新发货量
function forceRefreshShipping() {
    console.log('🔄 强制刷新发货量...');
    
    if (window.dashboard && typeof window.dashboard.updateMetricsFromDataManager === 'function') {
        window.dashboard.updateMetricsFromDataManager();
        console.log('  ✅ Dashboard已刷新');
    } else {
        console.log('  ❌ Dashboard刷新方法不存在');
    }
    
    // 等待刷新完成后检查结果
    setTimeout(() => {
        const newValue = checkCurrentDisplay();
        console.log(`  📊 刷新后显示: ${newValue.toFixed(1)}米`);
    }, 1000);
}

// 5. 测试客户发货明细模态框
function testShippingDetailsModal() {
    console.log('🔍 测试客户发货明细模态框...');
    
    // 查找已发货量卡片
    const shippedCard = document.querySelector('.metric-card.shipped');
    if (shippedCard) {
        console.log('  📊 找到已发货量卡片，模拟点击...');
        
        // 模拟点击事件
        shippedCard.click();
        
        // 检查模态框是否出现
        setTimeout(() => {
            const modal = document.getElementById('shippingDetailsModal');
            if (modal && modal.classList.contains('active')) {
                console.log('  ✅ 发货明细模态框已打开');
                
                // 检查模态框中的数据
                const summaryItems = modal.querySelectorAll('.summary-item .value');
                if (summaryItems.length > 0) {
                    console.log('  📊 模态框中的统计数据:');
                    summaryItems.forEach((item, index) => {
                        console.log(`    ${index + 1}. ${item.textContent}`);
                    });
                }
                
                // 自动关闭模态框
                setTimeout(() => {
                    const closeBtn = modal.querySelector('.modal-close');
                    if (closeBtn) {
                        closeBtn.click();
                        console.log('  🔒 模态框已关闭');
                    }
                }, 2000);
            } else {
                console.log('  ❌ 发货明细模态框未打开');
            }
        }, 500);
    } else {
        console.log('  ❌ 未找到已发货量卡片');
    }
}

// 6. 完整测试流程
function runCompleteTest() {
    console.log('🚀 开始完整测试...');
    console.log('='.repeat(50));
    
    // 检查初始状态
    const initialValue = checkCurrentDisplay();
    
    // 检查数据源
    checkDataSources();
    
    console.log('');
    console.log('📊 测试结果分析:');
    
    if (initialValue > 0) {
        console.log(`✅ 已发货量显示正常: ${initialValue.toFixed(1)}米`);
        
        // 测试模态框
        setTimeout(() => {
            testShippingDetailsModal();
        }, 1000);
    } else {
        console.log(`❌ 已发货量显示为0，尝试修复...`);
        
        // 尝试刷新
        forceRefreshShipping();
        
        // 如果还是0，建议运行修复脚本
        setTimeout(() => {
            const afterRefresh = checkCurrentDisplay();
            if (afterRefresh === 0) {
                console.log('');
                console.log('💡 建议运行修复脚本:');
                console.log('// 复制 fix-shipped-meters-display.js 的内容到控制台');
                console.log('');
            }
        }, 2000);
    }
    
    console.log('');
    console.log('✅ 测试完成');
}

// 执行测试
runCompleteTest();
