/**
 * 系统诊断脚本
 * 用于检查系统各组件的状态和潜在问题
 */

class SystemDiagnostic {
    constructor() {
        this.results = [];
        this.errors = [];
        this.warnings = [];
    }

    // 运行完整诊断
    async runFullDiagnostic() {
        console.log('🔍 开始系统诊断...');
        
        this.checkBasicComponents();
        this.checkDataManager();
        this.checkFirebaseSync();
        this.checkLocalStorage();
        await this.checkDataIntegrity();
        
        this.generateReport();
    }

    // 检查基础组件
    checkBasicComponents() {
        console.log('📦 检查基础组件...');
        
        const components = [
            { name: 'jQuery', obj: window.$ },
            { name: 'Firebase SDK', obj: window.firebase },
            { name: 'DataManager', obj: window.dataManager },
            { name: 'FirebaseSync', obj: window.firebaseSync }
        ];

        components.forEach(comp => {
            if (comp.obj) {
                this.results.push(`✅ ${comp.name} 已加载`);
            } else {
                this.errors.push(`❌ ${comp.name} 未加载`);
            }
        });
    }

    // 检查数据管理器
    checkDataManager() {
        console.log('🗃️ 检查数据管理器...');
        
        if (!window.dataManager) {
            this.errors.push('❌ DataManager未初始化');
            return;
        }

        const dm = window.dataManager;
        
        // 检查数据结构
        if (Array.isArray(dm.data)) {
            this.results.push(`✅ 生产数据: ${dm.data.length} 条记录`);
        } else {
            this.errors.push('❌ 生产数据结构异常');
        }

        if (Array.isArray(dm.shippingHistory)) {
            this.results.push(`✅ 发货历史: ${dm.shippingHistory.length} 条记录`);
        } else {
            this.errors.push('❌ 发货历史结构异常');
        }

        // 检查关键方法
        const methods = ['mergeDataWithRemote', 'hasDataChanged', 'renderTable'];
        methods.forEach(method => {
            if (typeof dm[method] === 'function') {
                this.results.push(`✅ 方法 ${method} 可用`);
            } else {
                this.errors.push(`❌ 方法 ${method} 不可用`);
            }
        });
    }

    // 检查Firebase同步
    checkFirebaseSync() {
        console.log('🔄 检查Firebase同步...');
        
        if (!window.firebaseSync) {
            this.errors.push('❌ FirebaseSync未初始化');
            return;
        }

        const fs = window.firebaseSync;
        const status = fs.getConnectionStatus();
        
        if (status.initialized) {
            this.results.push('✅ Firebase已初始化');
        } else {
            this.warnings.push('⚠️ Firebase未初始化');
        }

        if (status.hasUser) {
            this.results.push('✅ 用户已认证');
        } else {
            this.warnings.push('⚠️ 用户未认证');
        }

        if (status.hasDatabase) {
            this.results.push('✅ 数据库连接正常');
        } else {
            this.warnings.push('⚠️ 数据库未连接');
        }
    }

    // 检查本地存储
    checkLocalStorage() {
        console.log('💾 检查本地存储...');
        
        try {
            const keys = ['productionData', 'shippingHistory', 'materialPurchases'];
            
            keys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed)) {
                            this.results.push(`✅ ${key}: ${parsed.length} 条记录`);
                        } else {
                            this.warnings.push(`⚠️ ${key}: 数据格式异常`);
                        }
                    } catch (e) {
                        this.errors.push(`❌ ${key}: JSON解析失败`);
                    }
                } else {
                    this.warnings.push(`⚠️ ${key}: 无数据`);
                }
            });
        } catch (error) {
            this.errors.push(`❌ 本地存储访问失败: ${error.message}`);
        }
    }

    // 检查数据完整性
    async checkDataIntegrity() {
        console.log('🔍 检查数据完整性...');
        
        if (!window.dataManager || !Array.isArray(window.dataManager.data)) {
            this.errors.push('❌ 无法检查数据完整性：数据管理器异常');
            return;
        }

        const data = window.dataManager.data;
        let validRecords = 0;
        let invalidRecords = 0;

        data.forEach((item, index) => {
            try {
                // 检查必要字段
                if (!item.id) {
                    this.warnings.push(`⚠️ 记录 ${index}: 缺少ID`);
                    invalidRecords++;
                    return;
                }

                if (!item.spec) {
                    this.warnings.push(`⚠️ 记录 ${index}: 缺少规格`);
                    invalidRecords++;
                    return;
                }

                // 检查数值字段
                const numFields = ['planned', 'produced', 'shipped'];
                numFields.forEach(field => {
                    if (item[field] !== undefined && isNaN(Number(item[field]))) {
                        this.warnings.push(`⚠️ 记录 ${index}: ${field} 不是有效数值`);
                    }
                });

                validRecords++;
            } catch (error) {
                this.errors.push(`❌ 记录 ${index}: 检查失败 - ${error.message}`);
                invalidRecords++;
            }
        });

        this.results.push(`✅ 有效记录: ${validRecords} 条`);
        if (invalidRecords > 0) {
            this.warnings.push(`⚠️ 异常记录: ${invalidRecords} 条`);
        }
    }

    // 生成诊断报告
    generateReport() {
        console.log('\n📋 系统诊断报告');
        console.log('='.repeat(50));
        
        if (this.results.length > 0) {
            console.log('\n✅ 正常状态:');
            this.results.forEach(result => console.log(`  ${result}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️ 警告信息:');
            this.warnings.forEach(warning => console.log(`  ${warning}`));
        }

        if (this.errors.length > 0) {
            console.log('\n❌ 错误信息:');
            this.errors.forEach(error => console.log(`  ${error}`));
        }

        // 总结
        const totalIssues = this.warnings.length + this.errors.length;
        if (totalIssues === 0) {
            console.log('\n🎉 系统状态良好，无发现问题！');
        } else {
            console.log(`\n📊 发现 ${totalIssues} 个问题需要关注`);
        }

        console.log('='.repeat(50));
    }

    // 修复常见问题
    async fixCommonIssues() {
        console.log('🔧 尝试修复常见问题...');
        
        // 修复数据结构问题
        if (window.dataManager) {
            if (!Array.isArray(window.dataManager.data)) {
                window.dataManager.data = [];
                console.log('✅ 修复生产数据结构');
            }
            
            if (!Array.isArray(window.dataManager.shippingHistory)) {
                window.dataManager.shippingHistory = [];
                console.log('✅ 修复发货历史结构');
            }
        }

        // 清理无效的本地存储数据
        try {
            const keys = ['productionData', 'shippingHistory', 'materialPurchases'];
            keys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        JSON.parse(data);
                    } catch (e) {
                        localStorage.removeItem(key);
                        console.log(`✅ 清理无效的 ${key} 数据`);
                    }
                }
            });
        } catch (error) {
            console.error('❌ 清理本地存储失败:', error);
        }

        console.log('🔧 修复完成');
    }
}

// 创建全局诊断实例
window.systemDiagnostic = new SystemDiagnostic();

// 自动运行诊断（延迟执行，确保所有组件加载完成）
setTimeout(() => {
    if (window.systemDiagnostic) {
        window.systemDiagnostic.runFullDiagnostic();
    }
}, 3000);

console.log('🔍 系统诊断脚本已加载');
console.log('💡 使用 systemDiagnostic.runFullDiagnostic() 手动运行诊断');
console.log('🔧 使用 systemDiagnostic.fixCommonIssues() 修复常见问题');
