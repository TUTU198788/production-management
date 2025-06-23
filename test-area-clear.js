// 测试区域清空功能的专用脚本
// 在浏览器控制台中运行此脚本来验证区域清空功能

(function() {
    'use strict';
    
    console.log('🧪 开始测试区域清空功能...');
    
    // 检查区域配置状态
    function checkAreaConfiguration() {
        console.log('📊 检查区域配置状态:');
        
        // 检查localStorage中的区域配置
        const savedAreas = localStorage.getItem('customAreas');
        let parsedAreas = [];
        
        if (savedAreas) {
            try {
                parsedAreas = JSON.parse(savedAreas);
                console.log(`  localStorage中的区域: [${parsedAreas.join(', ')}]`);
            } catch (error) {
                console.log(`  ❌ localStorage区域配置解析失败: ${error.message}`);
            }
        } else {
            console.log('  ⚠️ localStorage中没有区域配置');
        }
        
        // 检查DataManager中的区域配置
        if (window.dataManager && window.dataManager.customAreas) {
            const managerAreas = Array.from(window.dataManager.customAreas).sort();
            console.log(`  DataManager中的区域: [${managerAreas.join(', ')}]`);
            
            // 比较两者是否一致
            const isConsistent = JSON.stringify(parsedAreas.sort()) === JSON.stringify(managerAreas);
            console.log(`  配置一致性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
        } else {
            console.log('  ❌ DataManager未加载或没有区域配置');
        }
        
        // 检查区域筛选下拉框
        const areaFilter = document.getElementById('areaFilter');
        if (areaFilter) {
            const options = Array.from(areaFilter.options)
                .filter(option => option.value !== '')
                .map(option => option.value);
            console.log(`  区域筛选器选项: [${options.join(', ')}]`);
            
            // 检查是否完全清空
            const isCompletelyEmpty = options.length === 0;
            console.log(`  完全清空: ${isCompletelyEmpty ? '✅ 是' : '❌ 否'}`);
        } else {
            console.log('  ❌ 区域筛选器未找到');
        }
        
        // 检查其他区域选择器
        const selectors = [
            { id: 'planAreaInput', name: '计划区域输入' },
            { id: 'areaInput', name: '区域输入' },
            { id: 'importAreaSelect', name: '导入区域选择' }
        ];
        
        selectors.forEach(selector => {
            const element = document.getElementById(selector.id);
            if (element) {
                const options = Array.from(element.options)
                    .filter(option => option.value !== '' && option.value !== '__add_new__')
                    .map(option => option.value);
                console.log(`  ${selector.name}: [${options.join(', ')}]`);
            } else {
                console.log(`  ❌ ${selector.name} 未找到`);
            }
        });
        
        return {
            localStorage: parsedAreas,
            dataManager: window.dataManager ? Array.from(window.dataManager.customAreas) : [],
            filterOptions: areaFilter ? Array.from(areaFilter.options)
                .filter(option => option.value !== '')
                .map(option => option.value) : []
        };
    }
    
    // 测试区域清空功能
    function testAreaClear() {
        console.log('🧪 执行区域清空测试...');
        
        // 检查清空前状态
        console.log('📊 清空前状态:');
        const beforeState = checkAreaConfiguration();
        
        // 模拟清空数据操作
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
                    console.log('📊 清空后状态:');
                    const afterState = checkAreaConfiguration();
                    
                    // 验证清空结果 - 应该完全清空

                    // 检查localStorage
                    const localStorageCorrect = afterState.localStorage.length === 0;
                    console.log(`  localStorage完全清空: ${localStorageCorrect ? '✅ 正确' : '❌ 错误'}`);

                    // 检查DataManager
                    const dataManagerCorrect = afterState.dataManager.length === 0;
                    console.log(`  DataManager完全清空: ${dataManagerCorrect ? '✅ 正确' : '❌ 错误'}`);

                    // 检查筛选器选项
                    const filterCorrect = afterState.filterOptions.length === 0;
                    console.log(`  筛选器选项完全清空: ${filterCorrect ? '✅ 正确' : '❌ 错误'}`);
                    
                    // 总体结果
                    const allCorrect = localStorageCorrect && dataManagerCorrect && filterCorrect;
                    
                    if (allCorrect) {
                        console.log('🎉 区域清空测试通过！所有区域配置都已完全清空。');
                    } else {
                        console.log('❌ 区域清空测试失败！部分区域配置未完全清空。');

                        // 输出详细的错误信息
                        if (!localStorageCorrect) {
                            console.log(`  localStorage期望: []`);
                            console.log(`  localStorage实际: [${afterState.localStorage.join(', ')}]`);
                        }
                        if (!dataManagerCorrect) {
                            console.log(`  DataManager期望: []`);
                            console.log(`  DataManager实际: [${afterState.dataManager.join(', ')}]`);
                        }
                        if (!filterCorrect) {
                            console.log(`  筛选器期望: []`);
                            console.log(`  筛选器实际: [${afterState.filterOptions.join(', ')}]`);
                        }
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
    
    // 手动完全清空区域配置的函数
    function manualClearAreas() {
        console.log('🔧 手动完全清空区域配置...');

        // 清空localStorage
        localStorage.setItem('customAreas', JSON.stringify([]));
        console.log('✅ localStorage已完全清空');

        // 清空DataManager
        if (window.dataManager) {
            window.dataManager.customAreas = new Set();
            window.dataManager.updateAreaOptions();
            console.log('✅ DataManager已完全清空');
        }

        console.log('🎉 手动清空完成！');

        // 验证清空结果
        setTimeout(() => {
            checkAreaConfiguration();
        }, 500);
    }
    
    // 暴露函数到全局
    window.checkAreaConfiguration = checkAreaConfiguration;
    window.testAreaClear = testAreaClear;
    window.manualClearAreas = manualClearAreas;
    
    // 自动执行检查
    if (window.dataManager) {
        console.log('✅ DataManager 已加载，可以执行测试');
        console.log('💡 运行 testAreaClear() 来执行完整测试');
        console.log('💡 运行 checkAreaConfiguration() 来检查当前状态');
        console.log('💡 运行 manualClearAreas() 来手动完全清空区域配置');
        
        // 立即检查当前状态
        checkAreaConfiguration();
    } else {
        console.log('⚠️ DataManager 未加载，等待加载完成...');
        
        // 等待DataManager加载
        const checkInterval = setInterval(() => {
            if (window.dataManager) {
                clearInterval(checkInterval);
                console.log('✅ DataManager 已加载');
                console.log('💡 运行 testAreaClear() 来执行完整测试');
                console.log('💡 运行 checkAreaConfiguration() 来检查当前状态');
                console.log('💡 运行 manualClearAreas() 来手动完全清空区域配置');
                
                // 立即检查当前状态
                checkAreaConfiguration();
            }
        }, 1000);
    }
    
})();
