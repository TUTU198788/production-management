// 测试工地区域联动功能
// 在浏览器控制台中运行此脚本

console.log('🧪 测试工地区域联动功能...');

// 1. 检查所有区域选择器是否存在
function checkAreaSelectors() {
    const selectors = [
        'planAreaInput',    // 新增生产计划
        'areaInput',        // 单个生产数据
        'batchArea',        // 批量添加模式
        'areaFilter',       // 筛选器
        'importAreaSelect'  // Excel导入
    ];
    
    console.log('📋 检查区域选择器...');
    
    const results = {};
    selectors.forEach(id => {
        const element = document.getElementById(id);
        results[id] = {
            exists: !!element,
            optionCount: element ? element.options.length : 0,
            hasAddNew: element ? Array.from(element.options).some(opt => opt.value === '__add_new__') : false
        };
        
        console.log(`  ${id}: ${results[id].exists ? '✅' : '❌'} 存在, ${results[id].optionCount} 个选项, 新增功能: ${results[id].hasAddNew ? '✅' : '❌'}`);
    });
    
    return results;
}

// 2. 检查区域数据一致性
function checkAreaConsistency() {
    console.log('🔍 检查区域数据一致性...');
    
    if (!window.dataManager) {
        console.log('❌ DataManager 未初始化');
        return false;
    }
    
    // 从实际数据中获取区域
    const dataAreas = new Set();
    if (window.dataManager.data) {
        window.dataManager.data.forEach(item => {
            if (item.area) {
                dataAreas.add(item.area);
            }
        });
    }
    
    // 从配置中获取区域
    const configAreas = window.dataManager.customAreas || new Set();
    
    console.log('  实际数据中的区域:', Array.from(dataAreas).sort().join(', '));
    console.log('  配置中的区域:', Array.from(configAreas).sort().join(', '));
    
    // 检查是否一致
    const allAreas = new Set([...dataAreas, ...configAreas]);
    const isConsistent = dataAreas.size === configAreas.size && 
                        Array.from(dataAreas).every(area => configAreas.has(area));
    
    console.log(`  数据一致性: ${isConsistent ? '✅' : '❌'}`);
    console.log(`  总区域数: ${allAreas.size}`);
    
    return { dataAreas, configAreas, allAreas, isConsistent };
}

// 3. 测试新增区域功能
function testAddNewArea() {
    console.log('🆕 测试新增区域功能...');
    
    const testAreaName = 'TEST' + Date.now().toString().slice(-4);
    console.log(`  测试区域名称: ${testAreaName}`);
    
    // 模拟添加新区域
    if (window.dataManager && typeof window.dataManager.addNewArea === 'function') {
        // 创建一个模拟的选择器元素
        const mockSelect = document.createElement('select');
        mockSelect.innerHTML = '<option value="">请选择工地区域</option>';
        
        // 模拟用户输入
        const originalPrompt = window.prompt;
        window.prompt = () => testAreaName;
        
        try {
            window.dataManager.addNewArea(mockSelect);
            
            // 检查是否添加成功
            const hasNewArea = window.dataManager.customAreas.has(testAreaName);
            console.log(`  新增区域结果: ${hasNewArea ? '✅' : '❌'}`);
            
            if (hasNewArea) {
                // 清理测试数据
                window.dataManager.customAreas.delete(testAreaName);
                localStorage.setItem('customAreas', JSON.stringify([...window.dataManager.customAreas]));
                console.log(`  测试数据已清理`);
            }
            
            return hasNewArea;
        } catch (error) {
            console.log(`  ❌ 测试失败: ${error.message}`);
            return false;
        } finally {
            window.prompt = originalPrompt;
        }
    } else {
        console.log('  ❌ addNewArea 方法不存在');
        return false;
    }
}

// 4. 测试区域选择器更新
function testAreaOptionsUpdate() {
    console.log('🔄 测试区域选择器更新...');
    
    if (!window.dataManager || typeof window.dataManager.updateAreaOptions !== 'function') {
        console.log('  ❌ updateAreaOptions 方法不存在');
        return false;
    }
    
    // 记录更新前的状态
    const beforeUpdate = checkAreaSelectors();
    
    // 执行更新
    try {
        window.dataManager.updateAreaOptions();
        console.log('  ✅ updateAreaOptions 执行成功');
        
        // 记录更新后的状态
        const afterUpdate = checkAreaSelectors();
        
        // 比较结果
        let allUpdated = true;
        Object.keys(beforeUpdate).forEach(id => {
            if (beforeUpdate[id].exists && afterUpdate[id].exists) {
                const optionsChanged = beforeUpdate[id].optionCount !== afterUpdate[id].optionCount;
                console.log(`    ${id}: 选项数量 ${beforeUpdate[id].optionCount} → ${afterUpdate[id].optionCount} ${optionsChanged ? '✅' : '⚪'}`);
            }
        });
        
        return true;
    } catch (error) {
        console.log(`  ❌ 更新失败: ${error.message}`);
        return false;
    }
}

// 5. 测试批量添加模式的区域选择器
function testBatchAreaSelector() {
    console.log('📦 测试批量添加模式区域选择器...');
    
    const batchAreaSelect = document.getElementById('batchArea');
    if (!batchAreaSelect) {
        console.log('  ❌ 批量添加区域选择器不存在');
        return false;
    }
    
    console.log(`  ✅ 批量添加区域选择器存在`);
    console.log(`  选项数量: ${batchAreaSelect.options.length}`);
    console.log(`  默认选项: "${batchAreaSelect.options[0].textContent}"`);
    
    // 检查是否有新增区域选项
    const hasAddNew = Array.from(batchAreaSelect.options).some(opt => opt.value === '__add_new__');
    console.log(`  新增区域选项: ${hasAddNew ? '✅' : '❌'}`);
    
    // 检查事件监听器（通过模拟事件）
    let eventListenerWorks = false;
    try {
        const originalAddNewArea = window.dataManager ? window.dataManager.addNewArea : null;
        if (originalAddNewArea) {
            let called = false;
            window.dataManager.addNewArea = () => { called = true; };
            
            // 模拟选择新增区域
            batchAreaSelect.value = '__add_new__';
            batchAreaSelect.dispatchEvent(new Event('change'));
            
            eventListenerWorks = called;
            window.dataManager.addNewArea = originalAddNewArea;
        }
    } catch (error) {
        console.log(`  事件监听器测试失败: ${error.message}`);
    }
    
    console.log(`  事件监听器: ${eventListenerWorks ? '✅' : '❌'}`);
    
    return batchAreaSelect.options.length > 1 && hasAddNew;
}

// 6. 执行完整测试
function runCompleteTest() {
    console.log('🚀 开始完整的工地区域联动测试...');
    console.log('');
    
    const results = {
        selectors: checkAreaSelectors(),
        consistency: checkAreaConsistency(),
        addNew: testAddNewArea(),
        update: testAreaOptionsUpdate(),
        batchArea: testBatchAreaSelector()
    };
    
    console.log('');
    console.log('📊 测试结果汇总:');
    console.log('================');
    
    // 选择器检查结果
    const selectorCount = Object.keys(results.selectors).length;
    const existingSelectors = Object.values(results.selectors).filter(r => r.exists).length;
    const selectorsWithAddNew = Object.values(results.selectors).filter(r => r.hasAddNew).length;
    
    console.log(`✅ 区域选择器: ${existingSelectors}/${selectorCount} 个存在`);
    console.log(`✅ 新增功能: ${selectorsWithAddNew}/${existingSelectors} 个支持`);
    console.log(`✅ 数据一致性: ${results.consistency.isConsistent ? '通过' : '需要修复'}`);
    console.log(`✅ 新增区域功能: ${results.addNew ? '正常' : '异常'}`);
    console.log(`✅ 选择器更新: ${results.update ? '正常' : '异常'}`);
    console.log(`✅ 批量添加模式: ${results.batchArea ? '正常' : '异常'}`);
    
    console.log('');
    
    // 总体评估
    const allPassed = results.consistency.isConsistent && 
                     results.addNew && 
                     results.update && 
                     results.batchArea &&
                     existingSelectors >= 4;
    
    if (allPassed) {
        console.log('🎉 所有测试通过！工地区域联动功能正常工作。');
    } else {
        console.log('⚠️ 部分测试未通过，需要检查相关功能。');
        
        // 提供修复建议
        console.log('');
        console.log('🔧 修复建议:');
        if (!results.consistency.isConsistent) {
            console.log('  - 运行 dataManager.syncAreaConfiguration() 同步区域配置');
        }
        if (!results.batchArea) {
            console.log('  - 检查批量添加模式的区域选择器和事件监听器');
        }
        if (!results.update) {
            console.log('  - 检查 updateAreaOptions 方法的实现');
        }
    }
    
    return results;
}

// 执行测试
const testResults = runCompleteTest();

// 如果需要修复，提供快速修复命令
if (!testResults.consistency.isConsistent && window.dataManager) {
    console.log('');
    console.log('💡 快速修复命令:');
    console.log('dataManager.syncAreaConfiguration()');
    console.log('dataManager.updateAreaOptions()');
}
