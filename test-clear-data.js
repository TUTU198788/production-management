// 测试清空数据功能的完整性
// 在浏览器控制台中运行此脚本来验证清空功能

(function() {
    'use strict';
    
    console.log('🧪 开始测试清空数据功能...');
    
    // 检查清空前的数据状态
    function checkDataBeforeClear() {
        console.log('📊 清空前数据状态检查:');
        
        const keys = [
            'productionData',
            'operationLogs', 
            'shippingHistory',
            'materialPurchases',
            'customerShippingData',
            'customAreas',
            'addedCustomers',
            'shippingPlans'
        ];
        
        keys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    const length = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
                    console.log(`  ${key}: ${length} 项`);
                } catch (error) {
                    console.log(`  ${key}: ${data.length} 字符`);
                }
            } else {
                console.log(`  ${key}: 无数据`);
            }
        });
        
        // 检查界面显示
        console.log('🎨 界面显示状态:');
        const containers = [
            { id: 'areaCardsContainer', name: '区域统计' },
            { id: 'customerStatsContainer', name: '客户统计' },
            { id: 'unproducedContainer', name: '未生产规格' }
        ];
        
        containers.forEach(container => {
            const element = document.getElementById(container.id);
            if (element) {
                const hasCards = element.children.length > 0 && 
                    !element.innerHTML.includes('暂无') && 
                    !element.innerHTML.includes('no-data');
                console.log(`  ${container.name}: ${hasCards ? '有数据显示' : '无数据显示'}`);
            } else {
                console.log(`  ${container.name}: 容器未找到`);
            }
        });
    }
    
    // 检查清空后的数据状态
    function checkDataAfterClear() {
        console.log('📊 清空后数据状态检查:');
        
        const keys = [
            'productionData',
            'operationLogs',
            'shippingHistory', 
            'materialPurchases',
            'customerShippingData',
            'customAreas',
            'addedCustomers',
            'shippingPlans'
        ];
        
        let allCleared = true;
        
        keys.forEach(key => {
            const data = localStorage.getItem(key);
            if (data && key !== 'customAreas') {
                try {
                    const parsed = JSON.parse(data);
                    const length = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
                    if (length > 0) {
                        console.log(`  ❌ ${key}: 仍有 ${length} 项数据`);
                        allCleared = false;
                    } else {
                        console.log(`  ✅ ${key}: 已清空`);
                    }
                } catch (error) {
                    if (data.length > 0) {
                        console.log(`  ❌ ${key}: 仍有 ${data.length} 字符`);
                        allCleared = false;
                    } else {
                        console.log(`  ✅ ${key}: 已清空`);
                    }
                }
            } else if (key === 'customAreas') {
                // customAreas应该重置为默认值
                try {
                    const parsed = JSON.parse(data || '[]');
                    const defaultAreas = ['C1', 'C2', 'C3', 'E1', 'E3', 'D6', 'A14'];
                    const isDefault = parsed.length === defaultAreas.length && 
                        defaultAreas.every(area => parsed.includes(area));
                    console.log(`  ${isDefault ? '✅' : '❌'} ${key}: ${isDefault ? '已重置为默认值' : '未正确重置'}`);
                    if (!isDefault) allCleared = false;
                } catch (error) {
                    console.log(`  ❌ ${key}: 解析失败`);
                    allCleared = false;
                }
            } else {
                console.log(`  ✅ ${key}: 已清空`);
            }
        });
        
        // 检查界面显示
        console.log('🎨 界面显示状态:');
        const containers = [
            { id: 'areaCardsContainer', name: '区域统计' },
            { id: 'customerStatsContainer', name: '客户统计' },
            { id: 'unproducedContainer', name: '未生产规格' }
        ];
        
        containers.forEach(container => {
            const element = document.getElementById(container.id);
            if (element) {
                const hasNoDataMessage = element.innerHTML.includes('暂无') || 
                    element.innerHTML.includes('no-data') ||
                    element.innerHTML.includes('暂无发货数据');
                console.log(`  ${hasNoDataMessage ? '✅' : '❌'} ${container.name}: ${hasNoDataMessage ? '显示无数据状态' : '仍有数据显示'}`);
                if (!hasNoDataMessage) allCleared = false;
            } else {
                console.log(`  ❌ ${container.name}: 容器未找到`);
                allCleared = false;
            }
        });
        
        // 检查仪表板卡片
        console.log('📈 仪表板卡片状态:');
        const cards = [
            { selector: '.metric-card.total .metric-value', name: '总需求量' },
            { selector: '.metric-card.produced .metric-value', name: '已生产量' },
            { selector: '.metric-card.shipped .metric-value', name: '已发货量' },
            { selector: '.metric-card.material .metric-value', name: '原材料采购' }
        ];
        
        cards.forEach(card => {
            const element = document.querySelector(card.selector);
            if (element) {
                const value = parseFloat(element.textContent.replace(/,/g, '')) || 0;
                console.log(`  ${value === 0 ? '✅' : '❌'} ${card.name}: ${value}`);
                if (value !== 0) allCleared = false;
            } else {
                console.log(`  ❌ ${card.name}: 元素未找到`);
                allCleared = false;
            }
        });
        
        return allCleared;
    }
    
    // 执行清空数据测试
    function testClearData() {
        console.log('🧪 执行清空数据测试...');
        
        // 检查清空前状态
        checkDataBeforeClear();
        
        // 模拟点击清空数据按钮
        if (window.dataManager && typeof window.dataManager.clearAllData === 'function') {
            console.log('🗑️ 调用清空数据方法...');
            
            // 备份原始的confirm和prompt函数
            const originalConfirm = window.confirm;
            const originalPrompt = window.prompt;
            
            // 模拟用户确认
            window.confirm = () => true;
            window.prompt = (message) => {
                if (message.includes('确认清空')) {
                    return '确认清空';
                }
                return null;
            };
            
            try {
                // 执行清空
                window.dataManager.clearAllData();
                
                // 等待清空完成后检查
                setTimeout(() => {
                    const success = checkDataAfterClear();
                    
                    if (success) {
                        console.log('🎉 清空数据测试通过！所有数据和界面都已正确清空。');
                    } else {
                        console.log('❌ 清空数据测试失败！仍有数据或界面未正确清空。');
                    }
                    
                    // 恢复原始函数
                    window.confirm = originalConfirm;
                    window.prompt = originalPrompt;
                }, 1000);
                
            } catch (error) {
                console.error('❌ 清空数据时发生错误:', error);
                
                // 恢复原始函数
                window.confirm = originalConfirm;
                window.prompt = originalPrompt;
            }
        } else {
            console.error('❌ 找不到 dataManager.clearAllData 方法');
        }
    }
    
    // 手动检查函数
    window.checkClearDataStatus = function() {
        console.log('🔍 手动检查清空状态...');
        return checkDataAfterClear();
    };
    
    // 自动执行测试
    if (window.dataManager) {
        console.log('✅ DataManager 已加载，可以执行测试');
        console.log('💡 运行 testClearData() 来执行完整测试');
        console.log('💡 运行 checkClearDataStatus() 来检查当前状态');
        
        // 暴露测试函数到全局
        window.testClearData = testClearData;
    } else {
        console.log('⚠️ DataManager 未加载，等待加载完成...');
        
        // 等待DataManager加载
        const checkInterval = setInterval(() => {
            if (window.dataManager) {
                clearInterval(checkInterval);
                console.log('✅ DataManager 已加载');
                window.testClearData = testClearData;
                console.log('💡 运行 testClearData() 来执行完整测试');
            }
        }, 1000);
    }
    
})();
