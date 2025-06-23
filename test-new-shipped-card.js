// 测试新的已发货量卡片
// 在浏览器控制台中运行此脚本

console.log('🧪 测试新的已发货量卡片...');

// 1. 检查卡片是否存在
function checkCardExists() {
    console.log('1️⃣ 检查卡片是否存在:');
    
    const card = document.getElementById('shippedCard');
    const metersDisplay = document.getElementById('shippedMetersDisplay');
    const customersDisplay = document.getElementById('shippedCustomersDisplay');

    console.log(`  📊 卡片元素: ${card ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  📊 发货量显示: ${metersDisplay ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  📊 客户数显示: ${customersDisplay ? '✅ 存在' : '❌ 不存在'}`);
    
    if (metersDisplay) {
        console.log(`  📊 当前发货量显示: "${metersDisplay.textContent}"`);
    }
    
    if (customersDisplay) {
        console.log(`  📊 当前客户数显示: "${customersDisplay.textContent}"`);
    }
    
    return {
        card: !!card,
        metersDisplay: !!metersDisplay,
        customersDisplay: !!customersDisplay
    };
}

// 2. 检查卡片管理器
function checkCardManager() {
    console.log('2️⃣ 检查卡片管理器:');
    
    const hasManager = !!window.shippedCardManager;
    console.log(`  🔧 卡片管理器: ${hasManager ? '✅ 存在' : '❌ 不存在'}`);
    
    if (hasManager) {
        const hasUpdateMethod = typeof window.shippedCardManager.forceUpdate === 'function';
        const hasGetDataMethod = typeof window.shippedCardManager.getShippingData === 'function';
        
        console.log(`  🔧 forceUpdate方法: ${hasUpdateMethod ? '✅ 存在' : '❌ 不存在'}`);
        console.log(`  🔧 getShippingData方法: ${hasGetDataMethod ? '✅ 存在' : '❌ 不存在'}`);
        
        return { hasManager, hasUpdateMethod, hasGetDataMethod };
    }
    
    return { hasManager: false };
}

// 3. 检查数据源
function checkDataSources() {
    console.log('3️⃣ 检查数据源:');
    
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
                
                if (customerCount > 0) {
                    console.log(`  📋 前3个客户:`);
                    customerStats.filter(c => c.totalMeters > 0).slice(0, 3).forEach((customer, index) => {
                        console.log(`    ${index + 1}. ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                    });
                }
                
                return { hasDataManager, totalMeters, customerCount };
            } catch (error) {
                console.error(`  ❌ 客户统计计算失败:`, error);
            }
        }
    }
    
    return { hasDataManager };
}

// 4. 测试卡片更新
function testCardUpdate() {
    console.log('4️⃣ 测试卡片更新:');
    
    if (!window.shippedCardManager) {
        console.log('  ❌ 卡片管理器不存在，无法测试');
        return false;
    }
    
    const metersDisplay = document.getElementById('shippedMetersDisplay');
    const customersDisplay = document.getElementById('shippedCustomersDisplay');
    
    const beforeMeters = metersDisplay ? metersDisplay.textContent : '未找到';
    const beforeCustomers = customersDisplay ? customersDisplay.textContent : '未找到';
    
    console.log(`  📊 更新前: 发货量="${beforeMeters}", 客户数="${beforeCustomers}"`);
    
    try {
        // 执行更新
        const result = window.shippedCardManager.forceUpdate();
        console.log(`  ✅ 更新方法执行成功`);
        console.log(`  📊 返回数据:`, result);
        
        // 检查更新后的状态
        setTimeout(() => {
            const afterMeters = metersDisplay ? metersDisplay.textContent : '未找到';
            const afterCustomers = customersDisplay ? customersDisplay.textContent : '未找到';
            
            console.log(`  📊 更新后: 发货量="${afterMeters}", 客户数="${afterCustomers}"`);
            
            const metersChanged = beforeMeters !== afterMeters;
            const customersChanged = beforeCustomers !== afterCustomers;
            
            console.log(`  🔄 发货量变化: ${metersChanged ? '✅' : '⚪'}`);
            console.log(`  🔄 客户数变化: ${customersChanged ? '✅' : '⚪'}`);
            
        }, 1500); // 等待动画完成
        
        return true;
    } catch (error) {
        console.error(`  ❌ 更新失败:`, error);
        return false;
    }
}

// 5. 测试点击事件
function testClickEvents() {
    console.log('5️⃣ 测试点击事件:');

    const card = document.getElementById('shippedCard');

    if (!card) {
        console.log('  ❌ 卡片不存在，无法测试点击');
        return false;
    }

    console.log('  🖱️ 测试卡片点击...');

    try {
        // 模拟卡片点击
        card.click();

        // 检查是否有模态框出现
        setTimeout(() => {
            const modal = document.getElementById('simpleShippingModal') ||
                         document.getElementById('shippingDetailsModal');

            if (modal) {
                console.log('  ✅ 点击卡片成功打开模态框');

                // 自动关闭模态框
                setTimeout(() => {
                    const closeBtn = modal.querySelector('.modal-close') ||
                                   modal.querySelector('[class*="close"]');
                    if (closeBtn) {
                        closeBtn.click();
                        console.log('  🔒 模态框已自动关闭');
                    }
                }, 2000);
            } else {
                console.log('  ❌ 点击卡片未打开模态框');
            }
        }, 500);

        return true;
    } catch (error) {
        console.error(`  ❌ 点击测试失败:`, error);
        return false;
    }
}

// 6. 测试样式
function testStyles() {
    console.log('6️⃣ 测试样式:');
    
    const card = document.getElementById('shippedCard');
    if (!card) {
        console.log('  ❌ 卡片不存在，无法测试样式');
        return false;
    }
    
    const computedStyle = window.getComputedStyle(card);
    const background = computedStyle.background || computedStyle.backgroundColor;
    const cursor = computedStyle.cursor;
    const borderRadius = computedStyle.borderRadius;
    
    console.log(`  🎨 背景样式: ${background.includes('gradient') || background.includes('rgb') ? '✅ 有样式' : '❌ 无样式'}`);
    console.log(`  🎨 鼠标样式: ${cursor === 'pointer' ? '✅ pointer' : `⚪ ${cursor}`}`);
    console.log(`  🎨 圆角样式: ${borderRadius ? `✅ ${borderRadius}` : '❌ 无圆角'}`);
    
    // 测试悬停效果
    console.log('  🎨 测试悬停效果...');
    card.dispatchEvent(new MouseEvent('mouseenter'));
    
    setTimeout(() => {
        card.dispatchEvent(new MouseEvent('mouseleave'));
        console.log('  🎨 悬停效果测试完成');
    }, 1000);
    
    return true;
}

// 7. 完整测试流程
function runCompleteTest() {
    console.log('🚀 开始完整测试新的已发货量卡片...');
    console.log('='.repeat(60));
    
    // 检查基础结构
    const cardStructure = checkCardExists();
    
    if (!cardStructure.card) {
        console.log('❌ 卡片不存在，测试终止');
        return;
    }
    
    console.log('');
    
    // 检查管理器
    const managerStatus = checkCardManager();
    
    console.log('');
    
    // 检查数据源
    const dataStatus = checkDataSources();
    
    console.log('');
    
    // 测试更新功能
    const updateSuccess = testCardUpdate();
    
    console.log('');
    
    // 测试样式
    testStyles();
    
    console.log('');
    
    // 等待更新完成后测试点击
    setTimeout(() => {
        testClickEvents();
        
        // 最终总结
        setTimeout(() => {
            console.log('');
            console.log('📊 测试结果总结:');
            console.log('==================');
            console.log(`✅ 卡片结构: ${cardStructure.card ? '正常' : '异常'}`);
            console.log(`✅ 卡片管理器: ${managerStatus.hasManager ? '正常' : '异常'}`);
            console.log(`✅ 数据源: ${dataStatus.hasDataManager ? '正常' : '异常'}`);
            console.log(`✅ 更新功能: ${updateSuccess ? '正常' : '异常'}`);
            console.log(`✅ 点击事件: 测试中...`);
            console.log(`✅ 样式效果: 正常`);
            console.log('');
            console.log('🎉 新的已发货量卡片测试完成！');
            
            if (dataStatus.totalMeters > 0) {
                console.log(`💡 发现发货数据: ${dataStatus.totalMeters.toFixed(1)}米, ${dataStatus.customerCount}个客户`);
                console.log('💡 如果卡片显示为0，请检查卡片管理器的数据获取逻辑');
            } else {
                console.log('💡 当前没有发货数据，卡片显示0是正常的');
            }
        }, 8000);
    }, 2000);
}

// 执行测试
runCompleteTest();
