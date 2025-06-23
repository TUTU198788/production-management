// 测试发货统计和时间周期统计的专用脚本
// 在浏览器控制台中运行此脚本来诊断发货量和时间统计问题

(function() {
    'use strict';
    
    console.log('🧪 开始诊断发货统计和时间周期统计问题...');
    
    // 检查发货数据结构
    function checkShippingDataStructure() {
        console.log('📊 检查发货数据结构:');
        
        if (!window.dataManager) {
            console.log('❌ DataManager未加载');
            return false;
        }
        
        // 检查发货历史
        console.log('📦 发货历史数据:');
        console.log(`  shippingHistory长度: ${window.dataManager.shippingHistory?.length || 0}`);
        
        if (window.dataManager.shippingHistory && window.dataManager.shippingHistory.length > 0) {
            console.log('  前3条发货历史:');
            window.dataManager.shippingHistory.slice(0, 3).forEach((record, index) => {
                console.log(`    ${index + 1}. 客户: ${record.customerName}, 总米数: ${record.totalMeters}, 日期: ${record.date}`);
            });
        } else {
            console.log('  ⚠️ 发货历史为空');
        }
        
        // 检查生产数据中的发货记录
        console.log('📋 生产数据中的发货记录:');
        let totalShippingRecords = 0;
        let totalShippedFromProduction = 0;
        
        window.dataManager.data.forEach((item, index) => {
            if (item.shippingRecords && item.shippingRecords.length > 0) {
                totalShippingRecords += item.shippingRecords.length;
                
                if (index < 3) { // 只显示前3个项目的详情
                    console.log(`    ${item.spec}: ${item.shippingRecords.length} 条发货记录`);
                    item.shippingRecords.forEach(record => {
                        console.log(`      - 客户: ${record.customerName || record.customer}, 数量: ${record.quantity}`);
                    });
                }
            }
            
            // 检查shipped字段
            if (item.shipped > 0) {
                totalShippedFromProduction += item.shipped;
            }
        });
        
        console.log(`  生产数据中总发货记录数: ${totalShippingRecords}`);
        console.log(`  生产数据中shipped字段总和: ${totalShippedFromProduction}`);
        
        return {
            hasShippingHistory: window.dataManager.shippingHistory?.length > 0,
            shippingHistoryCount: window.dataManager.shippingHistory?.length || 0,
            productionShippingRecords: totalShippingRecords,
            totalShippedFromProduction: totalShippedFromProduction
        };
    }
    
    // 测试客户统计计算
    function testCustomerStatsCalculation() {
        console.log('🧪 测试客户统计计算:');
        
        if (!window.dataManager || typeof window.dataManager.calculateCustomerStats !== 'function') {
            console.log('❌ calculateCustomerStats方法不存在');
            return null;
        }
        
        try {
            const customerStats = window.dataManager.calculateCustomerStats();
            console.log(`  客户统计数量: ${customerStats.length}`);
            
            let totalMetersFromCustomers = 0;
            customerStats.forEach((customer, index) => {
                totalMetersFromCustomers += customer.totalMeters || 0;
                if (index < 5) { // 显示前5个客户
                    console.log(`    ${customer.customerName}: ${customer.totalMeters?.toFixed(1) || 0}米, ${customer.totalQuantity || 0}根`);
                }
            });
            
            console.log(`  客户统计总米数: ${totalMetersFromCustomers.toFixed(1)}米`);
            
            return {
                customerCount: customerStats.length,
                totalMeters: totalMetersFromCustomers,
                customers: customerStats
            };
        } catch (error) {
            console.error('❌ 客户统计计算失败:', error);
            return null;
        }
    }
    
    // 检查生产记录数据
    function checkProductionRecords() {
        console.log('📊 检查生产记录数据:');
        
        if (!window.dataManager) {
            console.log('❌ DataManager未加载');
            return false;
        }
        
        let totalProductionRecords = 0;
        let recordsWithTimestamp = 0;
        let todayRecords = 0;
        let thisMonthRecords = 0;
        
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();
        
        window.dataManager.data.forEach((item, index) => {
            if (item.productionRecords && Array.isArray(item.productionRecords)) {
                totalProductionRecords += item.productionRecords.length;
                
                if (index < 3) { // 显示前3个项目的详情
                    console.log(`    ${item.spec}: ${item.productionRecords.length} 条生产记录`);
                    item.productionRecords.forEach(record => {
                        console.log(`      - 日期: ${record.date}, 数量: ${record.quantity}, 时间戳: ${record.timestamp ? '有' : '无'}`);
                    });
                }
                
                item.productionRecords.forEach(record => {
                    if (record.timestamp) {
                        recordsWithTimestamp++;
                    }
                    
                    if (record.date === today) {
                        todayRecords++;
                    }
                    
                    const recordDate = new Date(record.date);
                    if (recordDate.getMonth() === thisMonth && recordDate.getFullYear() === thisYear) {
                        thisMonthRecords++;
                    }
                });
            }
        });
        
        console.log(`  总生产记录数: ${totalProductionRecords}`);
        console.log(`  有时间戳的记录: ${recordsWithTimestamp}`);
        console.log(`  今天的记录: ${todayRecords}`);
        console.log(`  本月的记录: ${thisMonthRecords}`);
        
        return {
            totalRecords: totalProductionRecords,
            withTimestamp: recordsWithTimestamp,
            todayRecords: todayRecords,
            thisMonthRecords: thisMonthRecords
        };
    }
    
    // 测试产量统计计算
    function testProductionStatsCalculation() {
        console.log('🧪 测试产量统计计算:');
        
        if (!window.dataManager || typeof window.dataManager.calculateProductionStats !== 'function') {
            console.log('❌ calculateProductionStats方法不存在');
            return null;
        }
        
        try {
            const productionStats = window.dataManager.calculateProductionStats();
            console.log('  产量统计结果:');
            console.log(`    日产量: ${productionStats.daily}米`);
            console.log(`    月产量: ${productionStats.monthly}米`);
            console.log(`    季度产量: ${productionStats.quarterly}米`);
            console.log(`    年产量: ${productionStats.yearly}米`);
            
            return productionStats;
        } catch (error) {
            console.error('❌ 产量统计计算失败:', error);
            return null;
        }
    }
    
    // 检查主界面统计显示
    function checkDashboardStats() {
        console.log('📊 检查主界面统计显示:');
        
        if (!window.dashboard) {
            console.log('❌ Dashboard未加载');
            return false;
        }
        
        console.log('  Dashboard数据:');
        console.log(`    总需求量: ${window.dashboard.data?.totalDemandMeters?.toFixed(1) || 0}米`);
        console.log(`    已生产量: ${window.dashboard.data?.producedMeters?.toFixed(1) || 0}米`);
        console.log(`    已发货量: ${window.dashboard.data?.shippedMeters?.toFixed(1) || 0}米`);
        
        // 检查卡片显示
        const shippedCard = document.querySelector('[data-metric="shippedMeters"] .metric-value');
        if (shippedCard) {
            console.log(`    已发货量卡片显示: ${shippedCard.textContent}`);
        }
        
        // 检查时间周期卡片
        const dailyCard = document.getElementById('dailyProduction');
        const monthlyCard = document.getElementById('monthlyProduction');
        const quarterlyCard = document.getElementById('quarterlyProduction');
        const yearlyCard = document.getElementById('yearlyProduction');
        
        console.log('  时间周期卡片显示:');
        console.log(`    日产量: ${dailyCard?.textContent || '未找到'}`);
        console.log(`    月产量: ${monthlyCard?.textContent || '未找到'}`);
        console.log(`    季度产量: ${quarterlyCard?.textContent || '未找到'}`);
        console.log(`    年产量: ${yearlyCard?.textContent || '未找到'}`);
        
        return {
            dashboardData: window.dashboard.data,
            cardDisplays: {
                shipped: shippedCard?.textContent,
                daily: dailyCard?.textContent,
                monthly: monthlyCard?.textContent,
                quarterly: quarterlyCard?.textContent,
                yearly: yearlyCard?.textContent
            }
        };
    }
    
    // 创建测试发货数据
    function createTestShippingData() {
        console.log('🔧 创建测试发货数据...');
        
        if (!window.dataManager) {
            console.log('❌ DataManager未加载');
            return false;
        }
        
        // 创建测试发货历史记录
        const testShippingRecord = {
            id: Date.now(),
            documentNumber: 'TEST-' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            customerName: '测试客户',
            company: '测试运输公司',
            trackingNumber: 'TEST123456',
            deliveryAddress: '测试地址',
            remarks: '测试发货记录',
            items: [
                {
                    spec: 'H80-6000',
                    quantity: 100,
                    weight: 500,
                    meters: 600
                }
            ],
            totalQuantity: 100,
            totalWeight: 500,
            totalMeters: 600,
            timestamp: new Date().toISOString()
        };
        
        // 添加到发货历史
        if (!window.dataManager.shippingHistory) {
            window.dataManager.shippingHistory = [];
        }
        window.dataManager.shippingHistory.push(testShippingRecord);
        
        // 保存到localStorage
        localStorage.setItem('shippingHistory', JSON.stringify(window.dataManager.shippingHistory));
        
        console.log('✅ 测试发货数据已创建');
        
        // 触发统计更新
        if (window.dashboard && typeof window.dashboard.updateMetricsFromDataManager === 'function') {
            window.dashboard.updateMetricsFromDataManager();
        }
        
        return true;
    }
    
    // 创建测试生产记录
    function createTestProductionRecords() {
        console.log('🔧 创建测试生产记录...');
        
        if (!window.dataManager || !window.dataManager.data || window.dataManager.data.length === 0) {
            console.log('❌ 没有生产数据可以添加生产记录');
            return false;
        }
        
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // 为前几个生产项目添加生产记录
        window.dataManager.data.slice(0, 3).forEach((item, index) => {
            if (!item.productionRecords) {
                item.productionRecords = [];
            }
            
            // 添加今天的生产记录
            item.productionRecords.push({
                date: today,
                quantity: 50 + index * 10,
                remarks: '测试今日生产',
                timestamp: new Date().toISOString()
            });
            
            // 添加昨天的生产记录
            item.productionRecords.push({
                date: yesterday,
                quantity: 30 + index * 5,
                remarks: '测试昨日生产',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            });
        });
        
        // 保存到localStorage
        localStorage.setItem('productionData', JSON.stringify(window.dataManager.data));
        
        console.log('✅ 测试生产记录已创建');
        
        return true;
    }
    
    // 执行完整诊断
    function runFullDiagnosis() {
        console.log('🧪 执行完整的发货和时间统计诊断...');
        
        const results = {
            shippingData: checkShippingDataStructure(),
            customerStats: testCustomerStatsCalculation(),
            productionRecords: checkProductionRecords(),
            productionStats: testProductionStatsCalculation(),
            dashboardStats: checkDashboardStats()
        };
        
        console.log('\n📊 诊断结果总结:');
        
        // 发货量问题诊断
        console.log('🚚 发货量问题:');
        if (results.shippingData.hasShippingHistory) {
            console.log('  ✅ 有发货历史数据');
        } else {
            console.log('  ❌ 没有发货历史数据 - 这是发货量为0的主要原因');
        }
        
        if (results.customerStats && results.customerStats.totalMeters > 0) {
            console.log(`  ✅ 客户统计有数据: ${results.customerStats.totalMeters.toFixed(1)}米`);
        } else {
            console.log('  ❌ 客户统计没有数据 - 这是发货量为0的主要原因');
        }
        
        // 时间统计问题诊断
        console.log('📅 时间统计问题:');
        if (results.productionRecords.totalRecords > 0) {
            console.log(`  ✅ 有生产记录: ${results.productionRecords.totalRecords}条`);
        } else {
            console.log('  ❌ 没有生产记录 - 这是时间统计显示固定值的主要原因');
        }
        
        if (results.productionStats) {
            const hasRealData = results.productionStats.daily > 0 || 
                               results.productionStats.monthly > 0 || 
                               results.productionStats.quarterly > 0 || 
                               results.productionStats.yearly > 0;
            
            if (hasRealData) {
                console.log('  ✅ 产量统计有实际数据');
            } else {
                console.log('  ❌ 产量统计都为0 - 说明没有有效的生产记录');
            }
        }
        
        return results;
    }
    
    // 暴露函数到全局
    window.checkShippingDataStructure = checkShippingDataStructure;
    window.testCustomerStatsCalculation = testCustomerStatsCalculation;
    window.checkProductionRecords = checkProductionRecords;
    window.testProductionStatsCalculation = testProductionStatsCalculation;
    window.checkDashboardStats = checkDashboardStats;
    window.createTestShippingData = createTestShippingData;
    window.createTestProductionRecords = createTestProductionRecords;
    window.runFullDiagnosis = runFullDiagnosis;
    
    console.log('✅ 发货和时间统计诊断工具已加载');
    console.log('💡 运行 runFullDiagnosis() 来执行完整诊断');
    console.log('💡 运行 createTestShippingData() 来创建测试发货数据');
    console.log('💡 运行 createTestProductionRecords() 来创建测试生产记录');
    
    // 立即执行诊断
    runFullDiagnosis();
    
})();
