// 发货管理模块 - 专门处理发货相关的业务逻辑
// 从 data-management.js 中提取的发货管理功能

class ShippingManager {
    constructor(dataCore, productionManager) {
        this.dataCore = dataCore;
        this.productionManager = productionManager;
        this.shippingCart = [];
        this.currentShippingRecord = null;
        
        console.log('✅ ShippingManager 初始化完成');
    }
    
    // ==================== 发货操作 ====================
    
    // 创建发货记录
    createShippingRecord(shippingData) {
        try {
            // 验证发货数据
            const errors = this.validateShippingData(shippingData);
            if (errors.length > 0) {
                throw new Error(`发货数据验证失败: ${errors.join(', ')}`);
            }
            
            // 检查库存是否足够
            const availableQuantity = this.getAvailableQuantity(shippingData.productionRecordId);
            if (shippingData.quantity > availableQuantity) {
                throw new Error(`发货数量 ${shippingData.quantity} 超过可发货数量 ${availableQuantity}`);
            }
            
            // 计算重量和米数
            const productionRecord = this.dataCore.getProductionRecord(shippingData.productionRecordId);
            const meters = this.productionManager.calculateMeters(productionRecord.spec, shippingData.quantity);
            const weight = this.productionManager.calculateWeight(productionRecord.spec, shippingData.quantity);
            
            // 创建发货记录
            const shippingRecord = {
                customerName: shippingData.customerName,
                productSpec: productionRecord.spec,
                quantity: shippingData.quantity,
                weight: weight,
                meters: meters,
                shippingDate: shippingData.shippingDate || new Date().toISOString().split('T')[0],
                area: productionRecord.area,
                transportCompany: shippingData.transportCompany || '',
                trackingNumber: shippingData.trackingNumber || '',
                remarks: shippingData.remarks || '',
                productionRecordId: shippingData.productionRecordId
            };
            
            // 添加到发货历史
            const newShippingRecord = this.dataCore.addShippingRecord(shippingRecord);
            
            // 更新生产记录的发货数量
            this.updateProductionShippedQuantity(shippingData.productionRecordId, shippingData.quantity);
            
            console.log(`✅ 发货记录创建成功: ${shippingData.customerName} - ${productionRecord.spec} - ${shippingData.quantity}根`);
            
            return newShippingRecord;
        } catch (error) {
            console.error('❌ 创建发货记录失败:', error);
            throw error;
        }
    }
    
    // 更新生产记录的发货数量
    updateProductionShippedQuantity(productionRecordId, shippedQuantity) {
        const record = this.dataCore.getProductionRecord(productionRecordId);
        if (!record) {
            throw new Error('未找到生产记录');
        }
        
        const newShippedTotal = (record.shipped || 0) + shippedQuantity;
        const updates = {
            shipped: newShippedTotal,
            status: this.productionManager.calculateStatus(record.planned, record.produced, newShippedTotal)
        };
        
        // 添加发货记录到生产记录中
        const shippingRecordEntry = {
            date: new Date().toISOString().split('T')[0],
            quantity: shippedQuantity,
            totalShipped: newShippedTotal,
            timestamp: new Date().toISOString()
        };
        
        updates.shippingRecords = [...(record.shippingRecords || []), shippingRecordEntry];
        
        return this.dataCore.updateProductionRecord(productionRecordId, updates);
    }
    
    // ==================== 批量发货 ====================
    
    // 添加到发货购物车
    addToShippingCart(item) {
        const cartItem = {
            id: Date.now() + Math.random(),
            productionRecordId: item.productionRecordId,
            spec: item.spec,
            area: item.area,
            quantity: item.quantity,
            availableQuantity: item.availableQuantity,
            customerName: item.customerName || '',
            remarks: item.remarks || ''
        };
        
        this.shippingCart.push(cartItem);
        console.log(`✅ 添加到发货购物车: ${item.spec} - ${item.quantity}根`);
        
        return cartItem;
    }
    
    // 从发货购物车移除
    removeFromShippingCart(cartItemId) {
        const index = this.shippingCart.findIndex(item => item.id === cartItemId);
        if (index !== -1) {
            const removedItem = this.shippingCart.splice(index, 1)[0];
            console.log(`✅ 从发货购物车移除: ${removedItem.spec} - ${removedItem.quantity}根`);
            return removedItem;
        }
        return null;
    }
    
    // 清空发货购物车
    clearShippingCart() {
        this.shippingCart = [];
        console.log('✅ 发货购物车已清空');
    }
    
    // 批量发货
    processBatchShipping(customerName, shippingDate, transportCompany, trackingNumber, remarks) {
        try {
            if (this.shippingCart.length === 0) {
                throw new Error('发货购物车为空');
            }
            
            const shippingRecords = [];
            const errors = [];
            
            // 逐个处理购物车中的项目
            for (const cartItem of this.shippingCart) {
                try {
                    const shippingData = {
                        productionRecordId: cartItem.productionRecordId,
                        customerName: customerName,
                        quantity: cartItem.quantity,
                        shippingDate: shippingDate,
                        transportCompany: transportCompany,
                        trackingNumber: trackingNumber,
                        remarks: `${remarks} | ${cartItem.remarks}`.trim()
                    };
                    
                    const shippingRecord = this.createShippingRecord(shippingData);
                    shippingRecords.push(shippingRecord);
                } catch (error) {
                    errors.push(`${cartItem.spec}: ${error.message}`);
                }
            }
            
            // 清空购物车
            this.clearShippingCart();
            
            if (errors.length > 0) {
                console.warn('⚠️ 批量发货部分失败:', errors);
            }
            
            console.log(`✅ 批量发货完成: 成功 ${shippingRecords.length} 项，失败 ${errors.length} 项`);
            
            return {
                success: shippingRecords,
                errors: errors
            };
        } catch (error) {
            console.error('❌ 批量发货失败:', error);
            throw error;
        }
    }
    
    // ==================== 发货查询和统计 ====================
    
    // 获取可发货数量
    getAvailableQuantity(productionRecordId) {
        const record = this.dataCore.getProductionRecord(productionRecordId);
        if (!record) return 0;
        
        return Math.max(0, (record.produced || 0) - (record.shipped || 0));
    }
    
    // 获取客户发货统计
    getCustomerShippingStats() {
        const customerStats = new Map();
        
        this.dataCore.shippingHistory.forEach(shipping => {
            if (!customerStats.has(shipping.customerName)) {
                customerStats.set(shipping.customerName, {
                    customerName: shipping.customerName,
                    totalQuantity: 0,
                    totalWeight: 0,
                    totalMeters: 0,
                    shipmentCount: 0,
                    lastShippingDate: null,
                    specs: new Set()
                });
            }
            
            const stats = customerStats.get(shipping.customerName);
            stats.totalQuantity += shipping.quantity || 0;
            stats.totalWeight += shipping.weight || 0;
            stats.totalMeters += shipping.meters || 0;
            stats.shipmentCount++;
            stats.specs.add(shipping.productSpec);
            
            if (!stats.lastShippingDate || shipping.shippingDate > stats.lastShippingDate) {
                stats.lastShippingDate = shipping.shippingDate;
            }
        });
        
        // 转换Set为Array
        customerStats.forEach(stats => {
            stats.specs = Array.from(stats.specs);
        });
        
        return Array.from(customerStats.values());
    }
    
    // 获取发货历史（按日期范围）
    getShippingHistory(startDate, endDate, customerName = null) {
        let history = [...this.dataCore.shippingHistory];
        
        // 按日期过滤
        if (startDate) {
            history = history.filter(shipping => shipping.shippingDate >= startDate);
        }
        
        if (endDate) {
            history = history.filter(shipping => shipping.shippingDate <= endDate);
        }
        
        // 按客户过滤
        if (customerName) {
            history = history.filter(shipping => 
                shipping.customerName.toLowerCase().includes(customerName.toLowerCase())
            );
        }
        
        // 按日期倒序排列
        history.sort((a, b) => new Date(b.shippingDate) - new Date(a.shippingDate));
        
        return history;
    }
    
    // 计算总发货量（米）
    getTotalShippedMeters() {
        return this.dataCore.shippingHistory.reduce((total, shipping) => {
            return total + (shipping.meters || 0);
        }, 0);
    }
    
    // ==================== 发货计划管理 ====================
    
    // 创建发货计划
    createShippingPlan(planData) {
        const plan = {
            id: Date.now(),
            customerName: planData.customerName,
            plannedDate: planData.plannedDate,
            items: planData.items || [],
            status: 'planned',
            remarks: planData.remarks || '',
            createdAt: new Date().toISOString()
        };
        
        // 这里可以扩展为保存到数据库
        console.log(`✅ 发货计划创建: ${planData.customerName} - ${planData.plannedDate}`);
        
        return plan;
    }
    
    // ==================== 数据验证 ====================
    
    validateShippingData(shippingData) {
        const errors = [];
        
        if (!shippingData.customerName) {
            errors.push('客户名称不能为空');
        }
        
        if (!shippingData.productionRecordId) {
            errors.push('必须指定生产记录');
        }
        
        if (!shippingData.quantity || shippingData.quantity <= 0) {
            errors.push('发货数量必须大于0');
        }
        
        if (shippingData.shippingDate) {
            const shippingDate = new Date(shippingData.shippingDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (shippingDate > today) {
                // 允许未来日期，但给出警告
                console.warn('⚠️ 发货日期为未来日期');
            }
        }
        
        return errors;
    }
    
    // ==================== 导出功能 ====================
    
    // 导出发货数据
    exportShippingData(format = 'json') {
        const data = {
            exportDate: new Date().toISOString(),
            totalRecords: this.dataCore.shippingHistory.length,
            shippingHistory: this.dataCore.shippingHistory,
            customerStats: this.getCustomerShippingStats(),
            summary: {
                totalCustomers: new Set(this.dataCore.shippingHistory.map(s => s.customerName)).size,
                totalShipments: this.dataCore.shippingHistory.length,
                totalMeters: this.getTotalShippedMeters(),
                totalWeight: this.dataCore.shippingHistory.reduce((sum, s) => sum + (s.weight || 0), 0)
            }
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        // 可以扩展其他格式
        return data;
    }
    
    // ==================== 工具方法 ====================
    
    // 生成发货单号
    generateShippingNumber() {
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = date.getTime().toString().slice(-6);
        return `SH${dateStr}${timeStr}`;
    }
    
    // 格式化发货信息
    formatShippingInfo(shipping) {
        return {
            发货单号: shipping.trackingNumber || this.generateShippingNumber(),
            客户名称: shipping.customerName,
            产品规格: shipping.productSpec,
            发货数量: `${this.dataCore.formatNumber(shipping.quantity)}根`,
            重量: `${shipping.weight?.toFixed(2) || 0}吨`,
            长度: `${shipping.meters?.toFixed(1) || 0}米`,
            发货日期: shipping.shippingDate,
            运输公司: shipping.transportCompany || '待定',
            备注: shipping.remarks || ''
        };
    }
}

// 导出模块
if (typeof window !== 'undefined') {
    window.ShippingManager = ShippingManager;
}
