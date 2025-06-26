/**
 * 操作转换算法 (Operational Transformation)
 * 智能解决分布式协作中的操作冲突
 */

class OperationTransform {
    constructor() {
        this.transformRules = new Map();
        this.setupTransformRules();
        
        console.log('🔄 操作转换算法已初始化');
    }
    
    /**
     * 设置转换规则
     */
    setupTransformRules() {
        // 生产数据操作转换规则
        this.addTransformRule('add_production', 'add_production', this.transformAddAdd.bind(this));
        this.addTransformRule('add_production', 'update_production', this.transformAddUpdate.bind(this));
        this.addTransformRule('add_production', 'delete_production', this.transformAddDelete.bind(this));
        
        this.addTransformRule('update_production', 'add_production', this.transformUpdateAdd.bind(this));
        this.addTransformRule('update_production', 'update_production', this.transformUpdateUpdate.bind(this));
        this.addTransformRule('update_production', 'delete_production', this.transformUpdateDelete.bind(this));
        
        this.addTransformRule('delete_production', 'add_production', this.transformDeleteAdd.bind(this));
        this.addTransformRule('delete_production', 'update_production', this.transformDeleteUpdate.bind(this));
        this.addTransformRule('delete_production', 'delete_production', this.transformDeleteDelete.bind(this));
        
        // 发货数据操作转换规则
        this.addTransformRule('add_shipping', 'add_shipping', this.transformShippingAddAdd.bind(this));
        this.addTransformRule('add_shipping', 'update_shipping', this.transformShippingAddUpdate.bind(this));
        this.addTransformRule('update_shipping', 'update_shipping', this.transformShippingUpdateUpdate.bind(this));
        
        console.log('📋 转换规则已设置，共', this.transformRules.size, '条规则');
    }
    
    /**
     * 添加转换规则
     */
    addTransformRule(opType1, opType2, transformFunction) {
        const key = `${opType1}:${opType2}`;
        this.transformRules.set(key, transformFunction);
    }
    
    /**
     * 转换两个并发操作
     * @param {Object} op1 操作1
     * @param {Object} op2 操作2
     * @returns {Object} 转换结果
     */
    transform(op1, op2) {
        console.log('🔄 开始转换操作:', op1.type, 'vs', op2.type);
        
        // 检查操作是否并发
        if (!VectorClock.areConcurrent(op1, op2)) {
            console.log('⚠️ 操作不并发，无需转换');
            return {
                op1Prime: op1,
                op2Prime: op2,
                conflict: false
            };
        }
        
        // 查找转换规则
        const key = `${op1.type}:${op2.type}`;
        const transformFunction = this.transformRules.get(key);
        
        if (!transformFunction) {
            console.warn('⚠️ 未找到转换规则:', key);
            return this.handleUnknownTransform(op1, op2);
        }
        
        try {
            const result = transformFunction(op1, op2);
            console.log('✅ 操作转换完成:', result.conflict ? '有冲突' : '无冲突');
            return result;
        } catch (error) {
            console.error('❌ 操作转换失败:', error);
            return this.handleTransformError(op1, op2, error);
        }
    }
    
    /**
     * 处理未知转换
     */
    handleUnknownTransform(op1, op2) {
        // 基于时间戳的简单冲突解决
        const op1Time = op1.timestamp || 0;
        const op2Time = op2.timestamp || 0;
        
        if (op1Time < op2Time) {
            return {
                op1Prime: op1,
                op2Prime: op2,
                conflict: true,
                resolution: 'timestamp_priority',
                winner: 'op1'
            };
        } else {
            return {
                op1Prime: null, // op1被丢弃
                op2Prime: op2,
                conflict: true,
                resolution: 'timestamp_priority',
                winner: 'op2'
            };
        }
    }
    
    /**
     * 处理转换错误
     */
    handleTransformError(op1, op2, error) {
        console.error('转换错误详情:', error);
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: true,
            error: error.message,
            resolution: 'error_fallback'
        };
    }
    
    // ========== 生产数据转换规则 ==========
    
    /**
     * 两个添加操作的转换
     */
    transformAddAdd(op1, op2) {
        // 两个添加操作通常不冲突，都可以执行
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 添加操作 vs 更新操作
     */
    transformAddUpdate(op1, op2) {
        // 如果更新的目标不存在（因为是新添加的），更新操作无效
        if (op1.data.id === op2.targetId) {
            return {
                op1Prime: op1,
                op2Prime: null, // 更新操作被取消
                conflict: true,
                resolution: 'add_wins_over_update'
            };
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 添加操作 vs 删除操作
     */
    transformAddDelete(op1, op2) {
        // 如果删除的是刚添加的项目
        if (op1.data.id === op2.targetId) {
            return {
                op1Prime: null, // 添加操作被取消
                op2Prime: op2,
                conflict: true,
                resolution: 'delete_wins_over_add'
            };
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 更新操作 vs 添加操作
     */
    transformUpdateAdd(op1, op2) {
        return this.transformAddUpdate(op2, op1);
    }
    
    /**
     * 两个更新操作的转换
     */
    transformUpdateUpdate(op1, op2) {
        // 如果更新同一个对象
        if (op1.targetId === op2.targetId) {
            return this.mergeUpdates(op1, op2);
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 更新操作 vs 删除操作
     */
    transformUpdateDelete(op1, op2) {
        // 如果更新的对象被删除了
        if (op1.targetId === op2.targetId) {
            return {
                op1Prime: null, // 更新操作被取消
                op2Prime: op2,
                conflict: true,
                resolution: 'delete_wins_over_update'
            };
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 删除操作 vs 添加操作
     */
    transformDeleteAdd(op1, op2) {
        return this.transformAddDelete(op2, op1);
    }
    
    /**
     * 删除操作 vs 更新操作
     */
    transformDeleteUpdate(op1, op2) {
        return this.transformUpdateDelete(op2, op1);
    }
    
    /**
     * 两个删除操作的转换
     */
    transformDeleteDelete(op1, op2) {
        // 如果删除同一个对象
        if (op1.targetId === op2.targetId) {
            return {
                op1Prime: op1,
                op2Prime: null, // 第二个删除操作无效
                conflict: true,
                resolution: 'first_delete_wins'
            };
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 合并两个更新操作
     */
    mergeUpdates(op1, op2) {
        const changes1 = op1.changes || {};
        const changes2 = op2.changes || {};
        
        // 检查字段冲突
        const conflictFields = [];
        const mergedChanges = { ...changes1 };
        
        for (const [field, value2] of Object.entries(changes2)) {
            if (field in changes1 && changes1[field] !== value2) {
                conflictFields.push({
                    field,
                    value1: changes1[field],
                    value2: value2
                });
            }
            mergedChanges[field] = value2; // op2优先
        }
        
        if (conflictFields.length > 0) {
            return {
                op1Prime: {
                    ...op1,
                    changes: mergedChanges
                },
                op2Prime: null,
                conflict: true,
                conflictFields,
                resolution: 'field_merge_with_op2_priority'
            };
        }
        
        return {
            op1Prime: {
                ...op1,
                changes: mergedChanges
            },
            op2Prime: null,
            conflict: false
        };
    }
    
    // ========== 发货数据转换规则 ==========
    
    transformShippingAddAdd(op1, op2) {
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    transformShippingAddUpdate(op1, op2) {
        if (op1.data.id === op2.targetId) {
            return {
                op1Prime: op1,
                op2Prime: null,
                conflict: true,
                resolution: 'add_wins_over_update'
            };
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    transformShippingUpdateUpdate(op1, op2) {
        if (op1.targetId === op2.targetId) {
            return this.mergeUpdates(op1, op2);
        }
        
        return {
            op1Prime: op1,
            op2Prime: op2,
            conflict: false
        };
    }
    
    /**
     * 检测语义冲突
     * @param {Object} op1 操作1
     * @param {Object} op2 操作2
     * @returns {Object} 冲突检测结果
     */
    detectSemanticConflict(op1, op2) {
        const conflicts = [];
        
        // 检查业务逻辑冲突
        if (this.isBusinessLogicConflict(op1, op2)) {
            conflicts.push({
                type: 'business_logic',
                description: '操作违反业务逻辑规则',
                severity: 'high'
            });
        }
        
        // 检查数据一致性冲突
        if (this.isDataConsistencyConflict(op1, op2)) {
            conflicts.push({
                type: 'data_consistency',
                description: '操作可能导致数据不一致',
                severity: 'medium'
            });
        }
        
        return {
            hasConflict: conflicts.length > 0,
            conflicts,
            requiresUserIntervention: conflicts.some(c => c.severity === 'high')
        };
    }
    
    /**
     * 检查业务逻辑冲突
     */
    isBusinessLogicConflict(op1, op2) {
        // 例如：不能同时发货和删除同一个生产记录
        if (op1.type === 'add_shipping' && op2.type === 'delete_production') {
            return op1.data.productionId === op2.targetId;
        }
        
        return false;
    }
    
    /**
     * 检查数据一致性冲突
     */
    isDataConsistencyConflict(op1, op2) {
        // 例如：发货数量不能超过生产数量
        if (op1.type === 'add_shipping' && op2.type === 'update_production') {
            // 这里需要更复杂的逻辑来检查数量关系
            return false;
        }
        
        return false;
    }
    
    /**
     * 生成冲突解决建议
     * @param {Object} transformResult 转换结果
     * @returns {Array} 解决建议列表
     */
    generateResolutionSuggestions(transformResult) {
        const suggestions = [];
        
        if (transformResult.conflict) {
            switch (transformResult.resolution) {
                case 'field_merge_with_op2_priority':
                    suggestions.push({
                        type: 'accept_merge',
                        description: '接受自动合并结果',
                        action: 'apply_merged_operation'
                    });
                    suggestions.push({
                        type: 'manual_review',
                        description: '手动检查冲突字段',
                        action: 'show_conflict_dialog'
                    });
                    break;
                    
                case 'delete_wins_over_update':
                    suggestions.push({
                        type: 'confirm_delete',
                        description: '确认删除操作',
                        action: 'apply_delete_operation'
                    });
                    suggestions.push({
                        type: 'restore_and_update',
                        description: '恢复数据并应用更新',
                        action: 'restore_then_update'
                    });
                    break;
            }
        }
        
        return suggestions;
    }
}

// 导出类
window.OperationTransform = OperationTransform;
