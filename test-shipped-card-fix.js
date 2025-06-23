// 测试已发货量卡片修复效果
// 在浏览器控制台中运行此脚本

console.log('🧪 测试已发货量卡片修复效果...');

// 1. 检查卡片结构
function checkCardStructure() {
    console.log('1️⃣ 检查卡片结构:');
    
    const shippedCard = document.querySelector('.metric-card.shipped');
    console.log(`  📊 已发货量卡片: ${shippedCard ? '✅ 存在' : '❌ 不存在'}`);
    
    if (shippedCard) {
        const valueElement = document.getElementById('shippedMetersValue');
        const countElement = document.getElementById('shippedCustomerCount');
        
        console.log(`  📊 发货量数值元素: ${valueElement ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`  📊 客户数量元素: ${countElement ? '✅ 存在' : '❌ 不存在'}`);
        
        if (valueElement) {
            console.log(`  📊 当前发货量显示: "${valueElement.textContent}"`);
        }
        
        if (countElement) {
            console.log(`  📊 当前客户数量显示: "${countElement.textContent}"`);
        }
        
        // 检查点击事件
        const hasClickEvent = shippedCard.onclick || shippedCard.style.cursor === 'pointer';
        console.log(`  🖱️ 点击事件: ${hasClickEvent ? '✅ 已设置' : '❌ 未设置'}`);
        
        return {
            cardExists: true,
            valueElement: !!valueElement,
            countElement: !!countElement,
            hasClickEvent
        };
    }
    
    return { cardExists: false };
}

// 2. 检查数据源
function checkDataSources() {
    console.log('2️⃣ 检查数据源:');
    
    // 检查Dashboard
    const hasDashboard = !!window.dashboard;
    console.log(`  📈 Dashboard: ${hasDashboard ? '✅ 存在' : '❌ 不存在'}`);
    
    if (hasDashboard) {
        const hasUpdateMethod = typeof window.dashboard.updateShippedMetersCard === 'function';
        console.log(`  📈 updateShippedMetersCard方法: ${hasUpdateMethod ? '✅ 存在' : '❌ 不存在'}`);
        
        const hasModalMethod = typeof window.dashboard.openShippingDetailsModal === 'function';
        console.log(`  📈 openShippingDetailsModal方法: ${hasModalMethod ? '✅ 存在' : '❌ 不存在'}`);
    }
    
    // 检查DataManager
    const hasDataManager = !!window.dataManager;
    console.log(`  📋 DataManager: ${hasDataManager ? '✅ 存在' : '❌ 不存在'}`);
    
    if (hasDataManager) {
        const hasCustomerStats = typeof window.dataManager.calculateCustomerStats === 'function';
        console.log(`  📋 calculateCustomerStats方法: ${hasCustomerStats ? '✅ 存在' : '❌ 不存在'}`);
        
        if (hasCustomerStats) {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                const totalMeters = customerStats.reduce((sum, c) => sum + (c.totalMeters || 0), 0);
                const customerCount = customerStats.filter(c => c.totalMeters > 0).length;
                
                console.log(`  📋 客户统计结果: ${totalMeters.toFixed(1)}米, ${customerCount}个客户`);
                
                return {
                    hasDashboard,
                    hasDataManager,
                    totalMeters,
                    customerCount,
                    customerStats: customerStats.slice(0, 3) // 前3个客户
                };
            } catch (error) {
                console.error(`  ❌ 客户统计计算失败:`, error);
            }
        }
    }
    
    // 检查全局函数
    const hasGlobalFunction = typeof showShippingDetails === 'function';
    console.log(`  🌐 showShippingDetails全局函数: ${hasGlobalFunction ? '✅ 存在' : '❌ 不存在'}`);
    
    return { hasDashboard, hasDataManager };
}

// 3. 测试卡片更新
function testCardUpdate() {
    console.log('3️⃣ 测试卡片更新:');
    
    if (!window.dashboard || typeof window.dashboard.updateShippedMetersCard !== 'function') {
        console.log('  ❌ 无法测试，Dashboard或方法不存在');
        return false;
    }
    
    // 记录更新前的状态
    const valueElement = document.getElementById('shippedMetersValue');
    const countElement = document.getElementById('shippedCustomerCount');
    
    const beforeValue = valueElement ? valueElement.textContent : '未找到';
    const beforeCount = countElement ? countElement.textContent : '未找到';
    
    console.log(`  📊 更新前: 发货量="${beforeValue}", 客户数="${beforeCount}"`);
    
    // 执行更新
    try {
        const result = window.dashboard.updateShippedMetersCard();
        console.log(`  ✅ 更新方法执行成功，返回值: ${result.toFixed(1)}米`);
        
        // 检查更新后的状态
        setTimeout(() => {
            const afterValue = valueElement ? valueElement.textContent : '未找到';
            const afterCount = countElement ? countElement.textContent : '未找到';
            
            console.log(`  📊 更新后: 发货量="${afterValue}", 客户数="${afterCount}"`);
            
            const valueChanged = beforeValue !== afterValue;
            const countChanged = beforeCount !== afterCount;
            
            console.log(`  🔄 发货量变化: ${valueChanged ? '✅' : '⚪'}`);
            console.log(`  🔄 客户数变化: ${countChanged ? '✅' : '⚪'}`);
            
        }, 1500); // 等待动画完成
        
        return true;
    } catch (error) {
        console.error(`  ❌ 更新失败:`, error);
        return false;
    }
}

// 4. 测试点击事件
function testClickEvent() {
    console.log('4️⃣ 测试点击事件:');
    
    const shippedCard = document.querySelector('.metric-card.shipped');
    if (!shippedCard) {
        console.log('  ❌ 卡片不存在，无法测试点击');
        return false;
    }
    
    console.log('  🖱️ 模拟点击已发货量卡片...');
    
    try {
        // 模拟点击
        shippedCard.click();
        
        // 检查模态框是否出现
        setTimeout(() => {
            const modal = document.getElementById('shippingDetailsModal');
            if (modal && modal.classList.contains('active')) {
                console.log('  ✅ 发货明细模态框已打开');
                
                // 检查模态框内容
                const summaryItems = modal.querySelectorAll('.summary-item .value');
                if (summaryItems.length > 0) {
                    console.log('  📊 模态框统计数据:');
                    summaryItems.forEach((item, index) => {
                        console.log(`    ${index + 1}. ${item.textContent}`);
                    });
                }
                
                // 自动关闭模态框
                setTimeout(() => {
                    const closeBtn = modal.querySelector('.modal-close');
                    if (closeBtn) {
                        closeBtn.click();
                        console.log('  🔒 模态框已自动关闭');
                    }
                }, 2000);
                
                return true;
            } else {
                console.log('  ❌ 发货明细模态框未打开');
                return false;
            }
        }, 500);
        
    } catch (error) {
        console.error(`  ❌ 点击测试失败:`, error);
        return false;
    }
}

// 5. 测试全局函数
function testGlobalFunction() {
    console.log('5️⃣ 测试全局函数:');
    
    if (typeof showShippingDetails !== 'function') {
        console.log('  ❌ showShippingDetails函数不存在');
        return false;
    }
    
    console.log('  🌐 调用全局函数 showShippingDetails()...');
    
    try {
        showShippingDetails();
        console.log('  ✅ 全局函数调用成功');
        
        // 检查是否打开了模态框
        setTimeout(() => {
            const modal = document.getElementById('shippingDetailsModal');
            if (modal && modal.classList.contains('active')) {
                console.log('  ✅ 通过全局函数成功打开模态框');
                
                // 自动关闭
                setTimeout(() => {
                    const closeBtn = modal.querySelector('.modal-close');
                    if (closeBtn) {
                        closeBtn.click();
                        console.log('  🔒 模态框已自动关闭');
                    }
                }, 1500);
            } else {
                console.log('  ❌ 全局函数未能打开模态框');
            }
        }, 500);
        
        return true;
    } catch (error) {
        console.error(`  ❌ 全局函数调用失败:`, error);
        return false;
    }
}

// 6. 完整测试流程
function runCompleteTest() {
    console.log('🚀 开始完整测试...');
    console.log('='.repeat(50));
    
    // 检查基础结构
    const cardStructure = checkCardStructure();
    
    if (!cardStructure.cardExists) {
        console.log('❌ 卡片不存在，测试终止');
        return;
    }
    
    // 检查数据源
    const dataSources = checkDataSources();
    
    console.log('');
    
    // 测试更新功能
    const updateSuccess = testCardUpdate();
    
    console.log('');
    
    // 等待更新完成后测试点击
    setTimeout(() => {
        testClickEvent();
        
        console.log('');
        
        // 测试全局函数
        setTimeout(() => {
            testGlobalFunction();
            
            // 最终总结
            setTimeout(() => {
                console.log('');
                console.log('📊 测试结果总结:');
                console.log('================');
                console.log(`✅ 卡片结构: ${cardStructure.cardExists ? '正常' : '异常'}`);
                console.log(`✅ 数据源: ${dataSources.hasDashboard && dataSources.hasDataManager ? '正常' : '异常'}`);
                console.log(`✅ 更新功能: ${updateSuccess ? '正常' : '异常'}`);
                console.log(`✅ 点击事件: 测试中...`);
                console.log(`✅ 全局函数: 测试中...`);
                console.log('');
                console.log('🎉 已发货量卡片修复测试完成！');
            }, 4000);
        }, 2000);
    }, 2000);
}

// 执行测试
runCompleteTest();
