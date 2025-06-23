// 测试供应厂家管理功能的专用脚本
// 在浏览器控制台中运行此脚本来验证供应厂家管理功能

(function() {
    'use strict';
    
    console.log('🧪 开始测试供应厂家管理功能...');
    
    // 检查供应厂家配置状态
    function checkSupplierConfiguration() {
        console.log('📊 检查供应厂家配置状态:');
        
        // 检查localStorage中的供应厂家配置
        const savedSuppliers = localStorage.getItem('customSuppliers');
        let parsedSuppliers = [];
        
        if (savedSuppliers) {
            try {
                parsedSuppliers = JSON.parse(savedSuppliers);
                console.log(`  localStorage中的供应厂家: [${parsedSuppliers.join(', ')}]`);
            } catch (error) {
                console.log(`  ❌ localStorage供应厂家配置解析失败: ${error.message}`);
            }
        } else {
            console.log('  ⚠️ localStorage中没有供应厂家配置');
        }
        
        // 检查DataManager中的供应厂家配置
        if (window.dataManager && window.dataManager.customSuppliers) {
            const managerSuppliers = Array.from(window.dataManager.customSuppliers).sort();
            console.log(`  DataManager中的供应厂家: [${managerSuppliers.join(', ')}]`);
            
            // 比较两者是否一致
            const isConsistent = JSON.stringify(parsedSuppliers.sort()) === JSON.stringify(managerSuppliers);
            console.log(`  配置一致性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
        } else {
            console.log('  ❌ DataManager未加载或没有供应厂家配置');
        }
        
        // 检查供应厂家选择器
        const supplierSelect = document.getElementById('materialSupplier');
        if (supplierSelect) {
            const options = Array.from(supplierSelect.options)
                .filter(option => option.value !== '' && option.value !== '__add_new__')
                .map(option => option.value);
            console.log(`  供应厂家选择器选项: [${options.join(', ')}]`);
            
            // 检查是否有"新增厂家"选项
            const hasAddNewOption = Array.from(supplierSelect.options)
                .some(option => option.value === '__add_new__');
            console.log(`  有新增厂家选项: ${hasAddNewOption ? '✅ 是' : '❌ 否'}`);
        } else {
            console.log('  ❌ 供应厂家选择器未找到');
        }
        
        return {
            localStorage: parsedSuppliers,
            dataManager: window.dataManager ? Array.from(window.dataManager.customSuppliers) : [],
            selectOptions: supplierSelect ? Array.from(supplierSelect.options)
                .filter(option => option.value !== '' && option.value !== '__add_new__')
                .map(option => option.value) : []
        };
    }
    
    // 测试供应厂家清空功能
    function testSupplierClear() {
        console.log('🧪 执行供应厂家清空测试...');
        
        // 检查清空前状态
        console.log('📊 清空前状态:');
        const beforeState = checkSupplierConfiguration();
        
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
                    const afterState = checkSupplierConfiguration();
                    
                    // 验证清空结果 - 应该完全清空
                    
                    // 检查localStorage
                    const localStorageCorrect = afterState.localStorage.length === 0;
                    console.log(`  localStorage完全清空: ${localStorageCorrect ? '✅ 正确' : '❌ 错误'}`);
                    
                    // 检查DataManager
                    const dataManagerCorrect = afterState.dataManager.length === 0;
                    console.log(`  DataManager完全清空: ${dataManagerCorrect ? '✅ 正确' : '❌ 错误'}`);
                    
                    // 检查选择器选项
                    const selectCorrect = afterState.selectOptions.length === 0;
                    console.log(`  选择器选项完全清空: ${selectCorrect ? '✅ 正确' : '❌ 错误'}`);
                    
                    // 总体结果
                    const allCorrect = localStorageCorrect && dataManagerCorrect && selectCorrect;
                    
                    if (allCorrect) {
                        console.log('🎉 供应厂家清空测试通过！所有供应厂家配置都已完全清空。');
                    } else {
                        console.log('❌ 供应厂家清空测试失败！部分供应厂家配置未完全清空。');
                        
                        // 输出详细的错误信息
                        if (!localStorageCorrect) {
                            console.log(`  localStorage期望: []`);
                            console.log(`  localStorage实际: [${afterState.localStorage.join(', ')}]`);
                        }
                        if (!dataManagerCorrect) {
                            console.log(`  DataManager期望: []`);
                            console.log(`  DataManager实际: [${afterState.dataManager.join(', ')}]`);
                        }
                        if (!selectCorrect) {
                            console.log(`  选择器期望: []`);
                            console.log(`  选择器实际: [${afterState.selectOptions.join(', ')}]`);
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
    
    // 测试添加新供应厂家功能
    function testAddNewSupplier() {
        console.log('🧪 测试添加新供应厂家功能...');
        
        if (window.dataManager && typeof window.dataManager.addNewSupplier === 'function') {
            // 备份原始的prompt函数
            const originalPrompt = window.prompt;
            
            // 模拟用户输入
            window.prompt = (message) => {
                if (message.includes('供应厂家名称')) {
                    return '测试厂家';
                }
                return null;
            };
            
            try {
                // 获取供应厂家选择器
                const supplierSelect = document.getElementById('materialSupplier');
                if (supplierSelect) {
                    // 检查添加前状态
                    const beforeCount = window.dataManager.customSuppliers.size;
                    console.log(`  添加前供应厂家数量: ${beforeCount}`);
                    
                    // 执行添加
                    window.dataManager.addNewSupplier(supplierSelect);
                    
                    // 检查添加后状态
                    const afterCount = window.dataManager.customSuppliers.size;
                    console.log(`  添加后供应厂家数量: ${afterCount}`);
                    
                    const hasTestSupplier = window.dataManager.customSuppliers.has('测试厂家');
                    console.log(`  是否包含测试厂家: ${hasTestSupplier ? '✅ 是' : '❌ 否'}`);
                    
                    if (afterCount > beforeCount && hasTestSupplier) {
                        console.log('🎉 添加新供应厂家测试通过！');
                    } else {
                        console.log('❌ 添加新供应厂家测试失败！');
                    }
                } else {
                    console.log('❌ 找不到供应厂家选择器');
                }
                
                // 恢复原始函数
                window.prompt = originalPrompt;
                
            } catch (error) {
                console.error('❌ 添加新供应厂家时发生错误:', error);
                
                // 恢复原始函数
                window.prompt = originalPrompt;
            }
        } else {
            console.error('❌ 找不到 dataManager.addNewSupplier 方法');
        }
    }
    
    // 手动完全清空供应厂家配置的函数
    function manualClearSuppliers() {
        console.log('🔧 手动完全清空供应厂家配置...');
        
        // 清空localStorage
        localStorage.setItem('customSuppliers', JSON.stringify([]));
        console.log('✅ localStorage已完全清空');
        
        // 清空DataManager
        if (window.dataManager) {
            window.dataManager.customSuppliers = new Set();
            window.dataManager.updateSupplierOptions();
            console.log('✅ DataManager已完全清空');
        }
        
        console.log('🎉 手动清空完成！');
        
        // 验证清空结果
        setTimeout(() => {
            checkSupplierConfiguration();
        }, 500);
    }
    
    // 暴露函数到全局
    window.checkSupplierConfiguration = checkSupplierConfiguration;
    window.testSupplierClear = testSupplierClear;
    window.testAddNewSupplier = testAddNewSupplier;
    window.manualClearSuppliers = manualClearSuppliers;
    
    // 自动执行检查
    if (window.dataManager) {
        console.log('✅ DataManager 已加载，可以执行测试');
        console.log('💡 运行 testSupplierClear() 来执行清空测试');
        console.log('💡 运行 testAddNewSupplier() 来测试添加新厂家');
        console.log('💡 运行 checkSupplierConfiguration() 来检查当前状态');
        console.log('💡 运行 manualClearSuppliers() 来手动完全清空供应厂家配置');
        
        // 立即检查当前状态
        checkSupplierConfiguration();
    } else {
        console.log('⚠️ DataManager 未加载，等待加载完成...');
        
        // 等待DataManager加载
        const checkInterval = setInterval(() => {
            if (window.dataManager) {
                clearInterval(checkInterval);
                console.log('✅ DataManager 已加载');
                console.log('💡 运行 testSupplierClear() 来执行清空测试');
                console.log('💡 运行 testAddNewSupplier() 来测试添加新厂家');
                console.log('💡 运行 checkSupplierConfiguration() 来检查当前状态');
                console.log('💡 运行 manualClearSuppliers() 来手动完全清空供应厂家配置');
                
                // 立即检查当前状态
                checkSupplierConfiguration();
            }
        }, 1000);
    }
    
})();
