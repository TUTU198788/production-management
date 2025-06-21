// 数据检查和恢复脚本
// 在浏览器控制台中运行此脚本来检查和恢复数据

console.log('🔍 开始检查数据状态...');

// 1. 检查localStorage中的数据
function checkLocalStorageData() {
    console.log('\n📊 检查localStorage数据:');
    
    const productionData = localStorage.getItem('productionData');
    const operationLogs = localStorage.getItem('operationLogs');
    const materialPurchases = localStorage.getItem('materialPurchases');
    const customAreas = localStorage.getItem('customAreas');
    
    console.log('生产数据:', productionData ? `${JSON.parse(productionData).length} 条` : '无数据');
    console.log('操作日志:', operationLogs ? `${JSON.parse(operationLogs).length} 条` : '无数据');
    console.log('原材料采购:', materialPurchases ? `${JSON.parse(materialPurchases).length} 条` : '无数据');
    console.log('自定义区域:', customAreas ? `${JSON.parse(customAreas).length} 个` : '无数据');
    
    if (productionData) {
        const data = JSON.parse(productionData);
        console.log('生产数据预览:', data.slice(0, 3));
        return data;
    }
    
    return null;
}

// 2. 检查DataManager实例
function checkDataManager() {
    console.log('\n🔧 检查DataManager实例:');
    
    if (typeof dataManager !== 'undefined') {
        console.log('DataManager实例存在');
        console.log('当前数据长度:', dataManager.data.length);
        console.log('过滤数据长度:', dataManager.filteredData.length);
        console.log('数据预览:', dataManager.data.slice(0, 3));
        return dataManager;
    } else {
        console.log('❌ DataManager实例不存在');
        return null;
    }
}

// 3. 生成示例数据
function generateSampleData() {
    console.log('\n🎯 生成示例数据...');
    
    const sampleData = [
        {
            id: 1,
            spec: 'H100-3200mm',
            area: 'C1',
            planned: 200,
            produced: 176,
            shipped: 0,
            status: 'completed',
            deadline: '2025-07-01',
            remarks: '示例数据 - 已完成生产',
            shippingRecords: []
        },
        {
            id: 2,
            spec: 'H80-4000mm',
            area: 'C2',
            planned: 150,
            produced: 124,
            shipped: 0,
            status: 'completed',
            deadline: '2025-07-01',
            remarks: '示例数据 - 已完成生产',
            shippingRecords: []
        },
        {
            id: 3,
            spec: 'H100-2800mm',
            area: 'E1',
            planned: 100,
            produced: 0,
            shipped: 0,
            status: 'planned',
            deadline: '2025-07-15',
            remarks: '示例数据 - 计划中',
            shippingRecords: []
        },
        {
            id: 4,
            spec: 'H80-3600mm',
            area: 'C3',
            planned: 80,
            produced: 80,
            shipped: 50,
            status: 'shipped',
            deadline: '2025-06-30',
            remarks: '示例数据 - 部分发货',
            shippingRecords: [
                {
                    date: '2025-06-18',
                    customer: '南通际铨',
                    company: '顺丰物流',
                    trackingNumber: 'SF123456789',
                    deliveryAddress: '南通市工业园区',
                    quantity: 50,
                    remarks: '首批发货'
                }
            ]
        },
        {
            id: 5,
            spec: 'H100-4200mm',
            area: 'E3',
            planned: 120,
            produced: 60,
            shipped: 0,
            status: 'producing',
            deadline: '2025-07-20',
            remarks: '示例数据 - 生产中',
            shippingRecords: []
        }
    ];
    
    // 保存到localStorage
    localStorage.setItem('productionData', JSON.stringify(sampleData));
    localStorage.setItem('operationLogs', JSON.stringify([]));
    localStorage.setItem('materialPurchases', JSON.stringify([]));
    
    console.log(`✅ 已生成 ${sampleData.length} 条示例数据`);
    return sampleData;
}

// 4. 重新加载DataManager数据
function reloadDataManager() {
    console.log('\n🔄 重新加载DataManager数据...');
    
    if (typeof dataManager !== 'undefined') {
        // 重新从localStorage加载数据
        dataManager.loadFromLocalStorage();
        
        // 重新渲染界面
        dataManager.renderTable();
        dataManager.updateStats();
        dataManager.renderAreaStats();
        dataManager.renderUnproducedStats();
        
        console.log(`✅ 数据重新加载完成，当前有 ${dataManager.data.length} 条数据`);
        return true;
    } else {
        console.log('❌ DataManager实例不存在，无法重新加载');
        return false;
    }
}

// 5. 完整的数据恢复流程
function recoverData() {
    console.log('\n🚀 开始数据恢复流程...');
    
    // 检查现有数据
    const localData = checkLocalStorageData();
    const manager = checkDataManager();
    
    if (localData && localData.length > 0) {
        console.log('✅ 发现localStorage中有数据，尝试重新加载...');
        if (reloadDataManager()) {
            console.log('🎉 数据恢复成功！');
            return true;
        }
    }
    
    console.log('⚠️ 没有找到现有数据，生成示例数据...');
    generateSampleData();
    
    if (reloadDataManager()) {
        console.log('🎉 示例数据加载成功！');
        return true;
    }
    
    console.log('❌ 数据恢复失败，请手动刷新页面');
    return false;
}

// 6. 清空所有数据
function clearAllData() {
    console.log('\n🗑️ 清空所有数据...');
    
    localStorage.removeItem('productionData');
    localStorage.removeItem('operationLogs');
    localStorage.removeItem('materialPurchases');
    localStorage.removeItem('customAreas');
    
    if (typeof dataManager !== 'undefined') {
        dataManager.data = [];
        dataManager.filteredData = [];
        dataManager.operationLogs = [];
        dataManager.materialPurchases = [];
        dataManager.renderTable();
        dataManager.updateStats();
    }
    
    console.log('✅ 所有数据已清空');
}

// 7. 导出当前数据
function exportCurrentData() {
    console.log('\n📤 导出当前数据...');
    
    if (typeof dataManager !== 'undefined' && dataManager.data.length > 0) {
        const exportData = {
            exportTime: new Date().toISOString(),
            data: dataManager.data,
            operationLogs: dataManager.operationLogs || [],
            materialPurchases: dataManager.materialPurchases || []
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production-data-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ 数据导出完成');
        return true;
    } else {
        console.log('❌ 没有数据可导出');
        return false;
    }
}

// 执行检查
console.log('='.repeat(50));
console.log('🔍 数据检查和恢复工具');
console.log('='.repeat(50));

checkLocalStorageData();
checkDataManager();

console.log('\n📋 可用命令:');
console.log('• recoverData() - 自动恢复数据');
console.log('• generateSampleData() - 生成示例数据');
console.log('• reloadDataManager() - 重新加载数据');
console.log('• clearAllData() - 清空所有数据');
console.log('• exportCurrentData() - 导出当前数据');
console.log('• checkLocalStorageData() - 检查localStorage');
console.log('• checkDataManager() - 检查DataManager实例');

console.log('\n💡 建议操作:');
console.log('1. 如果有数据但界面显示为空，运行: reloadDataManager()');
console.log('2. 如果完全没有数据，运行: recoverData()');
console.log('3. 如果需要重新开始，运行: clearAllData() 然后 generateSampleData()');

// 自动尝试恢复
console.log('\n🤖 自动检查是否需要恢复数据...');
setTimeout(() => {
    const manager = checkDataManager();
    if (!manager || manager.data.length === 0) {
        console.log('⚠️ 检测到数据丢失，是否自动恢复？');
        console.log('运行 recoverData() 来恢复数据');
    } else {
        console.log('✅ 数据状态正常');
    }
}, 1000);
