// 生产管理模块 - 专门处理生产相关的业务逻辑
// 从 data-management.js 中提取的生产管理功能

class ProductionManager {
    constructor(dataCore) {
        this.dataCore = dataCore;
        this.specLengthMap = new Map();
        this.initSpecLengthMap();
        
        console.log('✅ ProductionManager 初始化完成');
    }
    
    // 初始化规格长度映射
    initSpecLengthMap() {
        // H100系列
        for (let length = 800; length <= 11800; length += 200) {
            this.specLengthMap.set(`H100-${length}mm`, length);
        }
        
        // H80系列
        for (let length = 800; length <= 11800; length += 200) {
            this.specLengthMap.set(`H80-${length}mm`, length);
        }
        
        // 梯桁筋系列
        for (let length = 2000; length <= 12000; length += 1000) {
            this.specLengthMap.set(`梯桁筋L=${length}`, length);
        }
        
        console.log(`✅ 规格长度映射初始化完成: ${this.specLengthMap.size} 种规格`);
    }
    
    // ==================== 生产计划管理 ====================
    
    // 新增生产计划
    addProductionPlan(planData) {
        try {
            // 验证数据
            const errors = this.validatePlanData(planData);
            if (errors.length > 0) {
                throw new Error(`数据验证失败: ${errors.join(', ')}`);
            }
            
            // 检查是否存在重复计划
            const existingPlan = this.findExistingPlan(planData.spec, planData.area);
            if (existingPlan) {
                // 询问是否合并
                const shouldMerge = confirm(
                    `已存在相同规格和区域的计划：\n` +
                    `${planData.spec} (${planData.area})\n` +
                    `现有计划数量: ${this.dataCore.formatNumber(existingPlan.planned)}根\n` +
                    `新增计划数量: ${this.dataCore.formatNumber(planData.planned)}根\n\n` +
                    `是否合并计划数量？`
                );
                
                if (shouldMerge) {
                    return this.mergePlan(existingPlan.id, planData.planned);
                } else {
                    throw new Error('用户取消了计划添加');
                }
            }
            
            // 创建新计划
            const newPlan = {
                spec: planData.spec,
                area: planData.area,
                planned: planData.planned,
                produced: 0, // 新计划已生产数量为0
                shipped: 0,
                status: 'planned',
                deadline: planData.deadline || '',
                remarks: planData.remarks || '新增生产计划',
                shippingRecords: [],
                productionRecords: []
            };
            
            const result = this.dataCore.addProductionRecord(newPlan);
            console.log(`✅ 新增生产计划: ${planData.spec} (${planData.area}) - ${this.dataCore.formatNumber(planData.planned)}根`);
            
            return result;
        } catch (error) {
            console.error('❌ 新增生产计划失败:', error);
            throw error;
        }
    }
    
    // 查找现有计划
    findExistingPlan(spec, area) {
        return this.dataCore.data.find(item => 
            item.spec === spec && item.area === area
        );
    }
    
    // 合并计划
    mergePlan(existingId, additionalQuantity) {
        const existingPlan = this.dataCore.getProductionRecord(existingId);
        if (!existingPlan) {
            throw new Error('未找到要合并的计划');
        }
        
        const newPlanned = existingPlan.planned + additionalQuantity;
        const updates = {
            planned: newPlanned,
            remarks: `${existingPlan.remarks} | 合并计划 +${this.dataCore.formatNumber(additionalQuantity)}根`
        };
        
        const result = this.dataCore.updateProductionRecord(existingId, updates);
        console.log(`✅ 计划合并成功: ${existingPlan.spec} (${existingPlan.area}) 总计划: ${this.dataCore.formatNumber(newPlanned)}根`);
        
        return result;
    }
    
    // ==================== 生产进度管理 ====================
    
    // 更新生产进度
    updateProductionProgress(recordId, producedQuantity, productionDate, remarks) {
        try {
            const record = this.dataCore.getProductionRecord(recordId);
            if (!record) {
                throw new Error('未找到生产记录');
            }
            
            // 验证生产数量
            if (producedQuantity < 0) {
                throw new Error('生产数量不能为负数');
            }
            
            if (producedQuantity > record.planned) {
                const confirmed = confirm(
                    `生产数量 ${this.dataCore.formatNumber(producedQuantity)} 根超过计划数量 ${this.dataCore.formatNumber(record.planned)} 根。\n` +
                    `是否继续？这将自动调整计划数量。`
                );
                
                if (!confirmed) {
                    throw new Error('用户取消了生产进度更新');
                }
            }
            
            // 添加生产记录
            const productionRecord = {
                date: productionDate || new Date().toISOString().split('T')[0],
                quantity: producedQuantity - (record.produced || 0), // 本次生产数量
                totalQuantity: producedQuantity, // 累计生产数量
                remarks: remarks || '',
                timestamp: new Date().toISOString()
            };
            
            // 更新记录
            const updates = {
                produced: producedQuantity,
                planned: Math.max(record.planned, producedQuantity), // 如果超产，自动调整计划
                status: this.calculateStatus(Math.max(record.planned, producedQuantity), producedQuantity, record.shipped || 0),
                productionRecords: [...(record.productionRecords || []), productionRecord]
            };
            
            const result = this.dataCore.updateProductionRecord(recordId, updates);
            console.log(`✅ 生产进度更新: ${record.spec} (${record.area}) 已生产: ${this.dataCore.formatNumber(producedQuantity)}根`);
            
            return result;
        } catch (error) {
            console.error('❌ 更新生产进度失败:', error);
            throw error;
        }
    }
    
    // 智能分配生产数量
    smartAllocateProduction(spec, totalQuantity, productionDate, remarks) {
        try {
            // 查找所有匹配规格的计划
            const matchingPlans = this.dataCore.data.filter(item => 
                item.spec === spec && (item.produced || 0) < (item.planned || 0)
            );
            
            if (matchingPlans.length === 0) {
                console.log(`⚠️ 未找到规格 ${spec} 的未完成计划，将创建新记录`);
                return null;
            }
            
            // 按紧急程度排序（交付日期越近越紧急）
            matchingPlans.sort((a, b) => {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
            
            let remainingQuantity = totalQuantity;
            const allocations = [];
            
            // 智能分配
            for (const plan of matchingPlans) {
                if (remainingQuantity <= 0) break;
                
                const needed = (plan.planned || 0) - (plan.produced || 0);
                const allocated = Math.min(needed, remainingQuantity);
                
                if (allocated > 0) {
                    allocations.push({
                        id: plan.id,
                        spec: plan.spec,
                        area: plan.area,
                        quantity: allocated,
                        newTotal: (plan.produced || 0) + allocated
                    });
                    
                    remainingQuantity -= allocated;
                }
            }
            
            // 执行分配
            for (const allocation of allocations) {
                this.updateProductionProgress(
                    allocation.id, 
                    allocation.newTotal, 
                    productionDate, 
                    remarks
                );
            }
            
            console.log(`✅ 智能分配完成: ${spec} 总计 ${this.dataCore.formatNumber(totalQuantity)}根 分配到 ${allocations.length} 个计划`);
            
            return allocations;
        } catch (error) {
            console.error('❌ 智能分配失败:', error);
            throw error;
        }
    }
    
    // ==================== 状态计算 ====================
    
    calculateStatus(planned, produced, shipped) {
        if (shipped >= produced && produced >= planned) {
            return 'shipped';
        } else if (produced >= planned) {
            return 'completed';
        } else if (produced > 0) {
            return 'producing';
        } else {
            return 'planned';
        }
    }
    
    // ==================== 数据验证 ====================
    
    validatePlanData(planData) {
        const errors = [];
        
        if (!planData.spec) {
            errors.push('规格型号不能为空');
        }
        
        if (!planData.area) {
            errors.push('工地区域不能为空');
        }
        
        if (!planData.planned || planData.planned <= 0) {
            errors.push('计划数量必须大于0');
        }
        
        if (planData.planned > 1000000) {
            errors.push('计划数量不能超过100万根');
        }
        
        // 验证规格格式
        if (planData.spec && !this.isValidSpec(planData.spec)) {
            errors.push('规格格式不正确，应为 H100-2000mm 或 梯桁筋L=6000 格式');
        }
        
        return errors;
    }
    
    isValidSpec(spec) {
        // 检查是否为标准格式
        const patterns = [
            /^H(100|80)-\d{3,5}mm$/,  // H100-2000mm 格式
            /^梯桁筋L=\d{4,5}$/        // 梯桁筋L=6000 格式
        ];
        
        return patterns.some(pattern => pattern.test(spec));
    }
    
    // ==================== 统计分析 ====================
    
    // 获取生产效率分析
    getProductionEfficiencyAnalysis() {
        const analysis = {
            totalPlans: this.dataCore.data.length,
            completedPlans: 0,
            inProgressPlans: 0,
            pendingPlans: 0,
            overduePlans: 0,
            averageCompletion: 0
        };
        
        const today = new Date();
        let totalCompletionRate = 0;
        
        this.dataCore.data.forEach(item => {
            const completionRate = item.planned > 0 ? (item.produced / item.planned) : 0;
            totalCompletionRate += completionRate;
            
            if (completionRate >= 1) {
                analysis.completedPlans++;
            } else if (completionRate > 0) {
                analysis.inProgressPlans++;
            } else {
                analysis.pendingPlans++;
            }
            
            // 检查是否逾期
            if (item.deadline && new Date(item.deadline) < today && completionRate < 1) {
                analysis.overduePlans++;
            }
        });
        
        analysis.averageCompletion = analysis.totalPlans > 0 ? 
            (totalCompletionRate / analysis.totalPlans * 100) : 0;
        
        return analysis;
    }
    
    // 获取区域生产统计
    getAreaProductionStats() {
        const areaStats = new Map();
        
        this.dataCore.data.forEach(item => {
            if (!areaStats.has(item.area)) {
                areaStats.set(item.area, {
                    area: item.area,
                    totalPlanned: 0,
                    totalProduced: 0,
                    totalShipped: 0,
                    completionRate: 0,
                    recordCount: 0
                });
            }
            
            const stats = areaStats.get(item.area);
            stats.totalPlanned += item.planned || 0;
            stats.totalProduced += item.produced || 0;
            stats.totalShipped += item.shipped || 0;
            stats.recordCount++;
        });
        
        // 计算完成率
        areaStats.forEach(stats => {
            stats.completionRate = stats.totalPlanned > 0 ? 
                (stats.totalProduced / stats.totalPlanned * 100) : 0;
        });
        
        return Array.from(areaStats.values());
    }
    
    // ==================== 工具方法 ====================
    
    // 提取规格中的长度信息
    extractLengthFromSpec(spec) {
        if (this.specLengthMap.has(spec)) {
            return this.specLengthMap.get(spec);
        }
        
        // 尝试从规格字符串中提取长度
        const matches = spec.match(/(\d+)(?:mm|m)?/);
        if (matches) {
            const length = parseInt(matches[1]);
            // 如果是米单位，转换为毫米
            return spec.includes('m') && !spec.includes('mm') ? length * 1000 : length;
        }
        
        return 6000; // 默认长度
    }
    
    // 计算重量（根据长度和规格）
    calculateWeight(spec, quantity) {
        const length = this.extractLengthFromSpec(spec);
        const isH100 = spec.includes('H100');
        const weightPerMeter = isH100 ? 3.0 : 2.4; // H100: 3kg/m, H80: 2.4kg/m
        
        return (length / 1000) * weightPerMeter * quantity;
    }
    
    // 计算米数
    calculateMeters(spec, quantity) {
        const length = this.extractLengthFromSpec(spec);
        return (length / 1000) * quantity;
    }
}

// 导出模块
if (typeof window !== 'undefined') {
    window.ProductionManager = ProductionManager;
}
