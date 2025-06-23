// 数据核心模块 - 基础数据操作和存储
// 从 data-management.js 中提取的核心数据功能

class DataCore {
    constructor() {
        this.data = [];
        this.shippingHistory = [];
        this.materialPurchases = [];
        this.operationLogs = [];
        this.customAreas = new Set(['C1', 'C2', 'C3', 'E1', 'E3', 'D6', 'A14']);
        this.customSuppliers = new Set(['鸿穗', '昊达鑫', '河北晟科']);
        
        // 初始化
        this.init();
    }
    
    init() {
        this.loadFromLocalStorage();
        console.log('✅ DataCore 初始化完成');
    }
    
    // ==================== 数据存储和加载 ====================
    
    saveToLocalStorage() {
        try {
            localStorage.setItem('productionData', JSON.stringify(this.data));
            localStorage.setItem('shippingHistory', JSON.stringify(this.shippingHistory));
            localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));
            localStorage.setItem('operationLogs', JSON.stringify(this.operationLogs));
            localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));
            
            console.log('✅ 数据已保存到本地存储');
            return true;
        } catch (error) {
            console.error('❌ 保存数据失败:', error);
            return false;
        }
    }
    
    loadFromLocalStorage() {
        try {
            // 加载生产数据
            const savedData = localStorage.getItem('productionData');
            if (savedData) {
                this.data = JSON.parse(savedData);
                console.log(`✅ 加载生产数据: ${this.data.length} 条记录`);
            }
            
            // 加载发货历史
            const savedShipping = localStorage.getItem('shippingHistory');
            if (savedShipping) {
                this.shippingHistory = JSON.parse(savedShipping);
                console.log(`✅ 加载发货历史: ${this.shippingHistory.length} 条记录`);
            }
            
            // 加载原材料采购
            const savedMaterial = localStorage.getItem('materialPurchases');
            if (savedMaterial) {
                this.materialPurchases = JSON.parse(savedMaterial);
                console.log(`✅ 加载原材料数据: ${this.materialPurchases.length} 条记录`);
            }
            
            // 加载操作日志
            const savedLogs = localStorage.getItem('operationLogs');
            if (savedLogs) {
                this.operationLogs = JSON.parse(savedLogs);
                console.log(`✅ 加载操作日志: ${this.operationLogs.length} 条记录`);
            }
            
            // 加载自定义区域
            const savedAreas = localStorage.getItem('customAreas');
            if (savedAreas) {
                this.customAreas = new Set(JSON.parse(savedAreas));
                console.log(`✅ 加载自定义区域: ${this.customAreas.size} 个区域`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ 加载数据失败:', error);
            return false;
        }
    }
    
    // ==================== 基础数据操作 ====================
    
    // 添加生产记录
    addProductionRecord(record) {
        if (!record || !record.spec || !record.area) {
            throw new Error('生产记录必须包含规格和区域信息');
        }
        
        // 生成ID
        const newId = this.data.length > 0 ? Math.max(...this.data.map(d => d.id || 0)) + 1 : 1;
        
        const newRecord = {
            id: newId,
            spec: record.spec,
            area: record.area,
            planned: record.planned || 0,
            produced: record.produced || 0,
            shipped: record.shipped || 0,
            status: record.status || 'planned',
            deadline: record.deadline || '',
            remarks: record.remarks || '',
            shippingRecords: record.shippingRecords || [],
            productionRecords: record.productionRecords || [],
            timestamp: new Date().toISOString(),
            lastModified: Date.now()
        };
        
        this.data.push(newRecord);
        this.addLog('create', '新增生产记录', `新增 ${record.spec} (${record.area})`, { newRecord });
        this.saveToLocalStorage();
        
        return newRecord;
    }
    
    // 更新生产记录
    updateProductionRecord(id, updates) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) {
            throw new Error(`未找到ID为 ${id} 的记录`);
        }
        
        const oldRecord = { ...this.data[index] };
        this.data[index] = {
            ...this.data[index],
            ...updates,
            lastModified: Date.now()
        };
        
        this.addLog('update', '更新生产记录', 
            `更新 ${this.data[index].spec} (${this.data[index].area})`, 
            { oldRecord, newRecord: this.data[index] });
        
        this.saveToLocalStorage();
        return this.data[index];
    }
    
    // 删除生产记录
    deleteProductionRecord(id) {
        const index = this.data.findIndex(item => item.id === id);
        if (index === -1) {
            throw new Error(`未找到ID为 ${id} 的记录`);
        }
        
        const deletedRecord = this.data.splice(index, 1)[0];
        this.addLog('delete', '删除生产记录', 
            `删除 ${deletedRecord.spec} (${deletedRecord.area})`, 
            { deletedRecord });
        
        this.saveToLocalStorage();
        return deletedRecord;
    }
    
    // 获取生产记录
    getProductionRecord(id) {
        return this.data.find(item => item.id === id);
    }
    
    // 获取所有生产记录
    getAllProductionRecords() {
        return [...this.data];
    }
    
    // ==================== 发货记录操作 ====================
    
    // 添加发货记录
    addShippingRecord(record) {
        if (!record || !record.customerName || !record.productSpec) {
            throw new Error('发货记录必须包含客户名称和产品规格');
        }
        
        const newId = this.shippingHistory.length > 0 ? 
            Math.max(...this.shippingHistory.map(s => s.id || 0)) + 1 : 1;
        
        const newRecord = {
            id: newId,
            customerName: record.customerName,
            productSpec: record.productSpec,
            quantity: record.quantity || 0,
            weight: record.weight || 0,
            meters: record.meters || 0,
            shippingDate: record.shippingDate || new Date().toISOString().split('T')[0],
            area: record.area || '',
            transportCompany: record.transportCompany || '',
            trackingNumber: record.trackingNumber || '',
            remarks: record.remarks || '',
            timestamp: new Date().toISOString(),
            lastModified: Date.now()
        };
        
        this.shippingHistory.push(newRecord);
        this.addLog('create', '新增发货记录', 
            `发货给 ${record.customerName}: ${record.productSpec}`, 
            { newRecord });
        
        this.saveToLocalStorage();
        return newRecord;
    }
    
    // ==================== 原材料采购操作 ====================
    
    // 添加原材料采购记录
    addMaterialPurchase(record) {
        if (!record || !record.materialType || !record.quantity) {
            throw new Error('原材料记录必须包含材料类型和数量');
        }
        
        const newId = this.materialPurchases.length > 0 ? 
            Math.max(...this.materialPurchases.map(m => m.id || 0)) + 1 : 1;
        
        const newRecord = {
            id: newId,
            materialType: record.materialType,
            quantity: record.quantity,
            unit: record.unit || '吨',
            unitPrice: record.unitPrice || 0,
            totalPrice: record.totalPrice || (record.quantity * (record.unitPrice || 0)),
            supplier: record.supplier || '',
            purchaseDate: record.purchaseDate || new Date().toISOString().split('T')[0],
            remarks: record.remarks || '',
            timestamp: new Date().toISOString(),
            lastModified: Date.now()
        };
        
        this.materialPurchases.push(newRecord);
        this.addLog('create', '新增原材料采购', 
            `采购 ${record.materialType}: ${record.quantity}${record.unit || '吨'}`, 
            { newRecord });
        
        this.saveToLocalStorage();
        return newRecord;
    }
    
    // ==================== 操作日志 ====================
    
    addLog(action, description, details, data = {}) {
        const logEntry = {
            id: this.operationLogs.length + 1,
            action,
            description,
            details,
            data,
            timestamp: new Date().toISOString(),
            user: 'system' // 可以扩展为实际用户
        };
        
        this.operationLogs.push(logEntry);
        
        // 保持日志数量在合理范围内
        if (this.operationLogs.length > 1000) {
            this.operationLogs = this.operationLogs.slice(-500);
        }
        
        console.log(`📝 [${action}] ${description}: ${details}`);
    }
    
    // 获取操作日志
    getOperationLogs(limit = 50) {
        return this.operationLogs.slice(-limit).reverse();
    }
    
    // ==================== 数据统计 ====================
    
    // 计算生产统计
    getProductionStats() {
        const stats = {
            totalPlanned: 0,
            totalProduced: 0,
            totalShipped: 0,
            totalPending: 0,
            completionRate: 0,
            shippingRate: 0
        };
        
        this.data.forEach(item => {
            stats.totalPlanned += item.planned || 0;
            stats.totalProduced += item.produced || 0;
            stats.totalShipped += item.shipped || 0;
        });
        
        stats.totalPending = stats.totalPlanned - stats.totalProduced;
        stats.completionRate = stats.totalPlanned > 0 ? 
            (stats.totalProduced / stats.totalPlanned * 100) : 0;
        stats.shippingRate = stats.totalProduced > 0 ? 
            (stats.totalShipped / stats.totalProduced * 100) : 0;
        
        return stats;
    }
    
    // 计算发货统计 - 增强版本，支持多种数据源
    getShippingStats() {
        console.log('📊 DataCore 计算发货统计...');

        let totalMeters = 0;
        let totalWeight = 0;
        let totalShipments = 0;
        const customerSet = new Set();

        // 方法1：从发货历史计算
        if (this.shippingHistory && this.shippingHistory.length > 0) {
            console.log(`📦 从发货历史计算: ${this.shippingHistory.length} 条记录`);

            this.shippingHistory.forEach(record => {
                totalMeters += record.meters || 0;
                totalWeight += record.weight || 0;
                totalShipments++;
                if (record.customerName) {
                    customerSet.add(record.customerName);
                }
            });

            console.log(`📦 发货历史统计: ${totalMeters.toFixed(1)}米, ${totalWeight.toFixed(1)}吨`);
        } else {
            console.log('📦 发货历史为空，从生产数据计算...');

            // 方法2：从生产数据的发货记录计算
            this.data.forEach(item => {
                // 从shipped字段计算
                const shipped = item.shipped || 0;
                if (shipped > 0) {
                    const length = this.extractLengthFromSpec(item.spec);
                    totalMeters += (shipped * length / 1000);
                }

                // 从shippingRecords计算
                if (item.shippingRecords && item.shippingRecords.length > 0) {
                    item.shippingRecords.forEach(record => {
                        const length = this.extractLengthFromSpec(item.spec);
                        const quantity = record.quantity || 0;
                        totalMeters += (quantity * length / 1000);
                        totalShipments++;

                        const customerName = record.customerName || record.customer;
                        if (customerName) {
                            customerSet.add(customerName);
                        }
                    });
                }
            });

            console.log(`📦 生产数据统计: ${totalMeters.toFixed(1)}米`);
        }

        const stats = {
            totalCustomers: customerSet.size,
            totalShipments: totalShipments,
            totalMeters: totalMeters,
            totalWeight: totalWeight
        };

        console.log('📊 DataCore 发货统计结果:', stats);
        return stats;
    }

    // 从规格型号中提取长度（mm）
    extractLengthFromSpec(spec) {
        if (!spec) return 6000; // 默认长度

        // 多种长度格式的匹配模式
        const patterns = [
            /L=(\d+)/,           // L=6000
            /长度[：:]\s*(\d+)/,   // 长度：6000 或 长度:6000
            /(\d+)mm/i,          // 6000mm 或 6000MM
            /(\d+)MM/,           // 6000MM
            /L(\d+)/,            // L6000
            /-(\d+)$/,           // 规格-6000
            /×(\d+)/,            // 规格×6000
            /\*(\d+)/,           // 规格*6000
            /(\d{4,})/           // 直接的4位以上数字（如6000）
        ];

        for (let pattern of patterns) {
            const match = spec.match(pattern);
            if (match) {
                const length = parseInt(match[1]);
                // 验证长度是否在合理范围内（1米到20米）
                if (length >= 1000 && length <= 20000) {
                    return length;
                }
            }
        }

        return 6000; // 默认长度
    }
    
    // ==================== 数据验证 ====================
    
    validateProductionRecord(record) {
        const errors = [];
        
        if (!record.spec) errors.push('规格型号不能为空');
        if (!record.area) errors.push('工地区域不能为空');
        if (record.planned < 0) errors.push('计划数量不能为负数');
        if (record.produced < 0) errors.push('已生产数量不能为负数');
        if (record.produced > record.planned) errors.push('已生产数量不能超过计划数量');
        
        return errors;
    }
    
    // ==================== 工具方法 ====================
    
    formatNumber(num) {
        return new Intl.NumberFormat('zh-CN').format(num);
    }
    
    // 清空所有数据
    clearAllData() {
        console.log('🗑️ DataCore 开始清空所有数据...');

        // 清空所有数据数组
        this.data = [];
        this.shippingHistory = [];
        this.materialPurchases = [];
        this.operationLogs = [];

        // 完全清空自定义区域和供应厂家
        this.customAreas = new Set();
        this.customSuppliers = new Set();

        // 清空所有相关的本地存储
        const keysToRemove = [
            'productionData',
            'shippingHistory',
            'materialPurchases',
            'operationLogs',
            'customerShippingData',
            'customAreas',
            'customSuppliers',
            'addedCustomers',
            'shippingPlans'
        ];

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`✅ DataCore 已清空 ${key}`);
        });

        // 完全清空区域配置和供应厂家配置
        localStorage.setItem('customAreas', JSON.stringify([]));
        localStorage.setItem('customSuppliers', JSON.stringify([]));

        // 记录清空操作
        this.addLog('system', '清空所有数据', 'DataCore 系统数据已全部清空');

        // 保存清空后的状态
        this.saveToLocalStorage();

        console.log('✅ DataCore 所有数据已清空');
    }
}

// 导出模块
if (typeof window !== 'undefined') {
    window.DataCore = DataCore;
}
