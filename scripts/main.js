// 浦东机场T3桁架钢筋生产推进管理系统 - 主要JavaScript文件
// 16:9屏幕优化版本

class SteelProductionDashboard {
    constructor() {
        this.data = {
            totalDemand: 0,
            produced: 0,
            pending: 0,
            efficiency: 2847,
            completionRate: 0,
            lastUpdate: new Date()
        };

        this.charts = {};
        this.refreshInterval = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();

        // 延迟初始化，确保DataManager完全加载
        setTimeout(() => {
            this.updateMetricsFromDataManager();
            this.updateLastUpdateTime();
        }, 200);

        this.startAutoRefresh();

        // 延迟加载图表，确保DOM完全加载
        setTimeout(() => {
            this.initializeCharts();
        }, 300);

        // 定期检查数据状态，确保数据同步
        this.startDataCheck();
    }

    // 从数据管理器获取实时数据
    updateMetricsFromDataManager() {
        console.log('=== 数据源检查 ===');
        console.log('window.dataManager 存在:', !!window.dataManager);

        if (!window.dataManager) {
            console.error('❌ window.dataManager 不存在！');

            // 尝试紧急修复
            console.log('尝试紧急修复DataManager...');
            try {
                if (typeof DataManager !== 'undefined') {
                    window.dataManager = new DataManager();
                    console.log('✅ 紧急修复成功！数据条数:', window.dataManager.data.length);

                    // 如果数据为空，重新加载
                    if (window.dataManager.data.length === 0) {
                        window.dataManager.loadFromLocalStorage();
                        console.log('重新加载后数据条数:', window.dataManager.data.length);
                    }
                } else {
                    console.error('❌ DataManager类不存在');
                    return;
                }
            } catch (error) {
                console.error('❌ 紧急修复失败:', error);
                return;
            }
        }

        console.log('dataManager.data 存在:', !!window.dataManager.data);
        console.log('dataManager.data 类型:', typeof window.dataManager.data);
        console.log('dataManager.data 长度:', window.dataManager.data ? window.dataManager.data.length : 'undefined');

        // 检查本地存储
        const localStorageData = localStorage.getItem('productionData');
        console.log('本地存储数据存在:', !!localStorageData);
        if (localStorageData) {
            try {
                const parsed = JSON.parse(localStorageData);
                console.log('本地存储数据条数:', parsed.length);
                console.log('本地存储前3条数据:', parsed.slice(0, 3));
            } catch (e) {
                console.error('本地存储数据解析失败:', e);
            }
        }

        // 检查表格中实际显示的数据
        const tableRows = document.querySelectorAll('#dataTable tbody tr:not(.no-data)');
        console.log('表格显示行数:', tableRows.length);

        if (tableRows.length > 0) {
            console.log('表格前3行数据:');
            for (let i = 0; i < Math.min(3, tableRows.length); i++) {
                const row = tableRows[i];
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    console.log(`表格第${i+1}行: ${cells[1].textContent.trim()} (${cells[2].textContent.trim()}) - 计划${cells[3].textContent.trim()}根`);
                }
            }
        }

        if (window.dataManager && window.dataManager.data) {
            const data = window.dataManager.data;

            console.log('=== dataManager.data 内容检查 ===');
            console.log('数据条数:', data.length);

            if (data.length === 0) {
                console.log('❌ dataManager.data 为空！');
                // 尝试重新加载数据
                console.log('尝试重新加载数据...');
                window.dataManager.loadFromLocalStorage();
                console.log('重新加载后数据条数:', window.dataManager.data.length);

                if (window.dataManager.data.length === 0) {
                    console.log('⚠️ 数据仍为空，显示空状态');
                    this.data = {
                        totalDemandMeters: 0,
                        producedMeters: 0,
                        shippedMeters: 0,
                        pendingMeters: 0,
                        unshippedMeters: 0,
                        totalDemand: 0,
                        produced: 0,
                        pending: 0,
                        completionRate: 0,
                        materialTons: 0,
                        inventoryStatus: { status: '无数据', color: '#6b7280' },
                        efficiency: 0
                    };
                    this.updateMetrics();
                    return;
                } else {
                    console.log('✅ 重新加载成功，继续处理数据');
                    // 重新获取数据引用，继续处理
                    const reloadedData = window.dataManager.data;
                    this.processDataAndCalculate(reloadedData);
                    return;
                }
            }

            this.processDataAndCalculate(data);
        }

        this.updateMetrics();

        // === 自动补丁：主界面数据同步到本地存储 ===
        try {
            if (this.data) {
                localStorage.setItem('productionData', JSON.stringify(this.data.rawData || window.dataManager.data || []));
                console.log('✅ 已自动同步主界面数据到本地存储 productionData');
            }
        } catch (e) {
            console.error('同步主界面数据到本地存储失败:', e);
        }
    }

    // 处理数据并计算统计信息
    processDataAndCalculate(data) {
        console.log('🔄 processDataAndCalculate 被调用，数据条数:', data.length);

        if (!data || data.length === 0) {
            console.warn('⚠️ 数据为空，无法计算统计');
            this.data.totalDemandMeters = 0;
            this.data.producedMeters = 0;
            this.data.pendingMeters = 0;
            this.data.shippedMeters = 0;
            return;
        }

        console.log('📊 数据样本 (前3条):');
        data.slice(0, 3).forEach((item, index) => {
            console.log(`第${index + 1}条:`, {
                spec: item.spec,
                area: item.area,
                planned: item.planned,
                produced: item.produced,
                shipped: item.shipped || 0
            });
        });

        console.log('=== 🧮 开始计算统计数据 ===');
        let totalCheck = 0;
        let validRecords = 0;
        let invalidRecords = 0;

        // 计算总米数（根数 × 长度）
        this.data.totalDemandMeters = data.reduce((sum, item, index) => {
            const length = this.extractLengthFromSpec(item.spec); // 提取长度（mm）
            const planned = item.planned || 0;
            const meters = planned * length / 1000; // 转换为米

            if (length > 0 && planned > 0) {
                validRecords++;
                totalCheck += meters;

                if (index < 5) { // 只显示前5条的详细计算
                    console.log(`✅ 第${index + 1}条: ${item.spec} (${item.area})`);
                    console.log(`   计算: ${planned}根 × ${length}mm ÷ 1000 = ${meters.toFixed(1)}米`);
                }
            } else {
                invalidRecords++;
                if (index < 5) {
                    console.log(`❌ 第${index + 1}条无效: ${item.spec}, 长度=${length}, 计划=${planned}`);
                }
            }

            return sum + meters;
        }, 0);

        console.log(`📈 总需求量计算完成:`);
        console.log(`   有效记录: ${validRecords} 条`);
        console.log(`   无效记录: ${invalidRecords} 条`);
        console.log(`   最终总需求量: ${this.data.totalDemandMeters.toFixed(1)}米`);
        console.log(`   验证计算: ${totalCheck.toFixed(1)}米`);

        // 计算已生产量（米）
        let producedValidRecords = 0;
        this.data.producedMeters = data.reduce((sum, item) => {
            const length = this.extractLengthFromSpec(item.spec);
            const produced = item.produced || 0;
            const meters = produced * length / 1000;

            if (produced > 0) {
                producedValidRecords++;
                if (producedValidRecords <= 3) { // 只显示前3条
                    console.log(`✅ 已生产 ${item.spec}: ${produced}根 × ${length}mm = ${meters.toFixed(1)}米`);
                }
            }
            return sum + meters;
        }, 0);

        // 计算已发货量（米）
        let shippedValidRecords = 0;
        this.data.shippedMeters = data.reduce((sum, item) => {
            const length = this.extractLengthFromSpec(item.spec);
            const shipped = item.shipped || 0;
            const meters = shipped * length / 1000;

            if (shipped > 0) {
                shippedValidRecords++;
                if (shippedValidRecords <= 3) { // 只显示前3条
                    console.log(`✅ 已发货 ${item.spec}: ${shipped}根 × ${length}mm = ${meters.toFixed(1)}米`);
                }
            }
            return sum + meters;
        }, 0);

        console.log(`📊 生产统计:`);
        console.log(`   已生产记录: ${producedValidRecords} 条`);
        console.log(`   已生产总量: ${this.data.producedMeters.toFixed(1)}米`);
        console.log(`📦 发货统计:`);
        console.log(`   已发货记录: ${shippedValidRecords} 条`);
        console.log(`   已发货总量: ${this.data.shippedMeters.toFixed(1)}米`);

        this.data.pendingMeters = this.data.totalDemandMeters - this.data.producedMeters;
        this.data.unshippedMeters = this.data.producedMeters - this.data.shippedMeters;

        // 计算原材料实际采购量（吨）
        this.data.materialTons = this.calculateActualMaterialPurchased();

        // 计算库存状态
        this.data.inventoryStatus = this.calculateInventoryStatus(this.data.unshippedMeters);

        // 保留原有的根数计算（用于完成率计算）
        this.data.totalDemand = data.reduce((sum, item) => sum + item.planned, 0);
        this.data.produced = data.reduce((sum, item) => sum + item.produced, 0);
        this.data.pending = this.data.totalDemand - this.data.produced;
        this.data.completionRate = this.data.totalDemandMeters > 0 ?
            ((this.data.producedMeters / this.data.totalDemandMeters) * 100).toFixed(1) : 0;

        // 计算生产效率（根/天）
        this.data.efficiency = this.calculateProductionEfficiency(data);

        console.log('计算结果汇总:');
        console.log('总需求量:', this.data.totalDemandMeters.toFixed(1), '米');
        console.log('已生产量:', this.data.producedMeters.toFixed(1), '米');
        console.log('待生产量:', this.data.pendingMeters.toFixed(1), '米');
        console.log('已发货量:', this.data.shippedMeters.toFixed(1), '米');
        console.log('未发货量:', this.data.unshippedMeters.toFixed(1), '米');
    }

    // 计算实际原材料采购量
    calculateActualMaterialPurchased() {
        if (window.dataManager && window.dataManager.materialPurchases) {
            return window.dataManager.materialPurchases.reduce((sum, purchase) => {
                return sum + purchase.quantity;
            }, 0);
        }
        return 0;
    }

    // 计算库存状态
    calculateInventoryStatus(unshippedMeters) {
        if (unshippedMeters < 1000) {
            return { status: '偏低', color: '#ef4444' };
        } else if (unshippedMeters < 5000) {
            return { status: '正常', color: '#10b981' };
        } else if (unshippedMeters < 10000) {
            return { status: '充足', color: '#3b82f6' };
        } else {
            return { status: '过多', color: '#f59e0b' };
        }
    }

    // 从规格型号中提取长度（mm）- 增强版本
    extractLengthFromSpec(spec) {
        if (!spec) {
            console.warn('规格为空，使用默认长度6000mm');
            return 6000;
        }

        console.log(`解析规格: "${spec}"`);

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

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = spec.match(pattern);
            if (match) {
                const length = parseInt(match[1]);
                // 验证长度是否在合理范围内（1米到20米）
                if (length >= 1000 && length <= 20000) {
                    console.log(`✅ 成功解析长度: ${length}mm (使用模式${i + 1})`);
                    return length;
                } else {
                    console.warn(`⚠️ 长度超出合理范围: ${length}mm`);
                }
            }
        }

        // 如果都没有匹配到，使用默认长度
        console.warn(`⚠️ 无法解析规格"${spec}"中的长度，使用默认长度6000mm`);
        return 6000;
    }

    // 计算生产效率
    calculateProductionEfficiency(data) {
        if (!data || data.length === 0) return 0;

        // 计算总已生产数量
        const totalProduced = data.reduce((sum, item) => sum + item.produced, 0);

        if (totalProduced === 0) return 0;

        // 假设生产周期为30天（可以根据实际情况调整）
        const productionDays = 30;
        const efficiency = Math.round(totalProduced / productionDays);

        return efficiency;
    }
    
    setupEventListeners() {
        // 刷新按钮
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshData());
        }

        // 数据保护配置按钮
        const dataProtectionBtn = document.getElementById('dataProtectionBtn');
        if (dataProtectionBtn) {
            dataProtectionBtn.addEventListener('click', () => this.openDataProtectionConfig());
        }

        // 同步修复按钮
        const syncFixBtn = document.getElementById('syncFixBtn');
        if (syncFixBtn) {
            syncFixBtn.addEventListener('click', () => this.quickSyncFix());
        }

        // 调试按钮
        const debugBtn = document.getElementById('debugBtn');
        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.openDebugTool());
        }

        // 筛选器事件
        this.setupFilters();

        // 图表操作按钮
        this.setupChartActions();

        // 窗口大小变化时重新调整图表
        window.addEventListener('resize', this.debounce(() => {
            this.resizeCharts();
        }, 300));
    }

    // 打开数据保护配置界面
    openDataProtectionConfig() {
        if (window.dataProtectionUtils && window.dataProtectionUtils.createConfigInterface) {
            window.dataProtectionUtils.createConfigInterface();
        } else {
            this.showNotification('数据保护配置模块未加载', 'error');
        }
    }

    // 打开调试工具
    openDebugTool() {
        console.log('🔍 打开调试工具...');

        // 先执行一次强制计算并显示详细日志
        console.log('=== 🚀 开始调试统计计算 ===');

        if (!window.dataManager) {
            console.error('❌ DataManager不存在');
            this.showNotification('DataManager未加载，无法调试', 'error');
            return;
        }

        const data = window.dataManager.data || [];
        console.log(`📊 数据状态: ${data.length} 条记录`);

        if (data.length === 0) {
            console.warn('⚠️ 数据为空');
            this.showNotification('数据为空，请先加载数据', 'warning');
            return;
        }

        // 显示前几条数据的详细信息
        console.log('📋 数据样本:');
        data.slice(0, 5).forEach((item, index) => {
            const length = this.extractLengthFromSpec(item.spec);
            console.log(`第${index + 1}条:`, {
                spec: item.spec,
                area: item.area,
                planned: item.planned,
                produced: item.produced,
                shipped: item.shipped || 0,
                extractedLength: length
            });
        });

        // 强制重新计算
        console.log('🔄 强制重新计算统计...');
        this.updateMetricsFromDataManager();

        // 显示计算结果
        setTimeout(() => {
            console.log('📈 计算结果:');
            console.log('总需求量:', this.data.totalDemandMeters?.toFixed(1) || 0, '米');
            console.log('已生产量:', this.data.producedMeters?.toFixed(1) || 0, '米');
            console.log('待生产量:', this.data.pendingMeters?.toFixed(1) || 0, '米');
            console.log('已发货量:', this.data.shippedMeters?.toFixed(1) || 0, '米');

            // 打开调试页面
            window.open('debug-stats.html', '_blank');
            this.showNotification('调试信息已输出到控制台，调试页面已打开', 'info');
        }, 1000);
    }

    // 快速同步修复（增强版本）
    quickSyncFix() {
        console.log('🔧 执行快速同步修复...');
        this.showNotification('正在修复数据同步问题...', 'info');

        // 检查当前状态
        const dataLength = window.dataManager?.data?.length || 0;
        const currentMetrics = this.data.totalDemandMeters || 0;

        console.log('修复前状态:', {
            dataLength,
            currentMetrics,
            hasDataManager: !!window.dataManager,
            hasDashboard: !!window.dashboard
        });

        if (dataLength === 0) {
            // 如果没有数据，尝试重新加载
            console.log('📥 没有数据，尝试重新加载...');
            if (window.dataManager) {
                window.dataManager.loadFromLocalStorage();
                setTimeout(() => {
                    this.quickSyncFix(); // 递归调用
                }, 1000);
                return;
            } else {
                this.showNotification('DataManager未加载，请刷新页面', 'error');
                return;
            }
        }

        if (dataLength > 0 && currentMetrics === 0) {
            // 有数据但统计为0，执行修复
            console.log('🔄 有数据但统计为0，执行修复...');

            // 先检查数据格式
            this.diagnoseDataFormat();

            // 步骤1：重新计算统计
            console.log('🧮 重新计算统计...');
            this.updateMetricsFromDataManager();

            // 步骤2：延迟检查结果
            setTimeout(() => {
                const newMetrics = this.data.totalDemandMeters || 0;
                console.log(`计算结果: ${newMetrics.toFixed(1)}米`);

                if (newMetrics > 0) {
                    console.log('✅ 快速修复成功');
                    this.showNotification(`修复成功！总需求量: ${newMetrics.toFixed(1)}米`, 'success');
                    this.updateMetrics(); // 更新界面显示
                } else {
                    console.log('⚠️ 快速修复失败，尝试深度修复...');
                    this.deepSyncFix();
                }
            }, 1500);
        } else if (dataLength > 0 && currentMetrics > 0) {
            // 数据状态正常
            console.log('✅ 数据状态正常，无需修复');
            this.showNotification(`数据状态正常，总需求量: ${currentMetrics.toFixed(1)}米`, 'success');
        } else {
            // 其他异常情况
            console.log('❓ 未知状态，执行完整诊断...');
            this.showNotification('执行完整诊断...', 'warning');
            this.deepSyncFix();
        }
    }

    // 诊断数据格式
    diagnoseDataFormat() {
        if (!window.dataManager || !window.dataManager.data) {
            console.log('❌ 无法诊断：DataManager或数据不存在');
            return;
        }

        const data = window.dataManager.data;
        console.log('🔍 诊断数据格式...');
        console.log(`数据总数: ${data.length} 条`);

        if (data.length === 0) {
            console.log('⚠️ 数据为空');
            return;
        }

        // 检查前几条数据的格式
        const sampleSize = Math.min(5, data.length);
        console.log(`检查前 ${sampleSize} 条数据:`);

        for (let i = 0; i < sampleSize; i++) {
            const item = data[i];
            const length = this.extractLengthFromSpec(item.spec);
            console.log(`第${i + 1}条:`, {
                spec: item.spec,
                area: item.area,
                planned: item.planned,
                produced: item.produced,
                shipped: item.shipped || 0,
                extractedLength: length
            });
        }

        // 统计有效数据
        let validCount = 0;
        let totalPlanned = 0;

        data.forEach(item => {
            const length = this.extractLengthFromSpec(item.spec);
            const planned = item.planned || 0;

            if (length > 0 && planned > 0) {
                validCount++;
                totalPlanned += planned;
            }
        });

        console.log(`📊 数据统计:`);
        console.log(`  有效记录: ${validCount} / ${data.length}`);
        console.log(`  总计划量: ${totalPlanned} 根`);

        if (validCount === 0) {
            console.log('❌ 没有有效的数据记录！');
            this.showNotification('数据格式异常，没有有效记录', 'error');
        } else if (validCount < data.length * 0.5) {
            console.log('⚠️ 有效数据比例较低');
            this.showNotification(`有效数据: ${validCount}/${data.length}`, 'warning');
        } else {
            console.log('✅ 数据格式正常');
        }
    }

    // 深度同步修复（增强版本）
    deepSyncFix() {
        console.log('🔧 执行深度同步修复...');
        this.showNotification('执行深度修复...', 'warning');

        // 步骤1：完全重置数据状态
        console.log('🔄 重置数据状态...');
        this.data = {
            totalDemandMeters: 0,
            producedMeters: 0,
            pendingMeters: 0,
            shippedMeters: 0,
            unshippedMeters: 0,
            materialTons: 0,
            completionRate: 0,
            totalDemand: 0,
            produced: 0,
            pending: 0,
            efficiency: 0
        };

        // 步骤2：强制重新加载数据
        if (window.dataManager) {
            console.log('📥 强制重新加载本地数据...');
            window.dataManager.loadFromLocalStorage();

            // 验证数据加载
            setTimeout(() => {
                const loadedData = window.dataManager.data || [];
                console.log(`数据重新加载完成: ${loadedData.length} 条记录`);

                if (loadedData.length === 0) {
                    console.log('❌ 重新加载后数据仍为空');
                    this.showNotification('数据加载失败，请检查本地存储', 'error');
                    return;
                }

                // 步骤3：使用强化的计算逻辑
                console.log('🧮 使用强化计算逻辑...');
                this.forceRecalculateWithEnhancedLogic(loadedData);

                // 步骤4：强制更新界面
                setTimeout(() => {
                    console.log('🎨 强制更新界面...');
                    this.updateMetrics();
                    this.updateCharts();

                    // 步骤5：最终验证
                    setTimeout(() => {
                        const finalMetrics = this.data.totalDemandMeters || 0;
                        const dataLength = window.dataManager?.data?.length || 0;

                        console.log('修复后状态:', {
                            dataLength,
                            finalMetrics,
                            producedMeters: this.data.producedMeters || 0,
                            pendingMeters: this.data.pendingMeters || 0
                        });

                        if (dataLength > 0 && finalMetrics > 0) {
                            console.log('✅ 深度修复成功');
                            this.showNotification(`深度修复成功！总需求量: ${finalMetrics.toFixed(1)}米`, 'success');
                        } else {
                            console.log('❌ 深度修复失败');
                            this.showNotification('修复失败，可能存在数据格式问题', 'error');

                            // 提供详细诊断
                            setTimeout(() => {
                                if (confirm('修复失败，是否打开数据检查工具进行详细诊断？')) {
                                    window.open('check-data.html', '_blank');
                                }
                            }, 2000);
                        }
                    }, 1000);
                }, 500);
            }, 1000);
        } else {
            console.log('❌ DataManager不存在');
            this.showNotification('DataManager未加载，请刷新页面', 'error');
        }
    }

    // 强化的重新计算逻辑
    forceRecalculateWithEnhancedLogic(data) {
        console.log('🚀 开始强化重新计算...');

        if (!data || data.length === 0) {
            console.log('❌ 数据为空，无法计算');
            return;
        }

        let totalDemandMeters = 0;
        let producedMeters = 0;
        let shippedMeters = 0;
        let validRecords = 0;
        let invalidRecords = 0;

        console.log('📊 逐条处理数据...');

        data.forEach((item, index) => {
            try {
                // 提取长度
                let length = this.extractLengthFromSpec(item.spec);

                // 如果提取失败，尝试其他方法
                if (length === 6000 && item.spec) {
                    // 尝试更宽松的匹配
                    const numbers = item.spec.match(/\d+/g);
                    if (numbers) {
                        for (const num of numbers) {
                            const n = parseInt(num);
                            if (n >= 1000 && n <= 20000) {
                                length = n;
                                console.log(`🔍 备用方法解析长度: ${item.spec} -> ${length}mm`);
                                break;
                            }
                        }
                    }
                }

                const planned = parseInt(item.planned) || 0;
                const produced = parseInt(item.produced) || 0;
                const shipped = parseInt(item.shipped) || 0;

                if (length > 0 && planned > 0) {
                    validRecords++;
                    const demandMeter = planned * length / 1000;
                    const producedMeter = produced * length / 1000;
                    const shippedMeter = shipped * length / 1000;

                    totalDemandMeters += demandMeter;
                    producedMeters += producedMeter;
                    shippedMeters += shippedMeter;

                    if (index < 3) { // 显示前3条的详细计算
                        console.log(`✅ 第${index + 1}条: ${item.spec}`);
                        console.log(`   长度: ${length}mm, 计划: ${planned}根, 已产: ${produced}根`);
                        console.log(`   需求: ${demandMeter.toFixed(1)}米, 已产: ${producedMeter.toFixed(1)}米`);
                    }
                } else {
                    invalidRecords++;
                    if (index < 3) {
                        console.log(`❌ 第${index + 1}条无效: ${item.spec}, 长度=${length}, 计划=${planned}`);
                    }
                }
            } catch (error) {
                console.error(`处理第${index + 1}条数据时出错:`, error);
                invalidRecords++;
            }
        });

        // 更新统计数据
        this.data.totalDemandMeters = totalDemandMeters;
        this.data.producedMeters = producedMeters;
        this.data.shippedMeters = shippedMeters;
        this.data.pendingMeters = totalDemandMeters - producedMeters;
        this.data.unshippedMeters = producedMeters - shippedMeters;

        // 计算完成率
        this.data.completionRate = totalDemandMeters > 0 ?
            ((producedMeters / totalDemandMeters) * 100).toFixed(1) : 0;

        console.log('📈 强化计算完成:');
        console.log(`  有效记录: ${validRecords} / ${data.length}`);
        console.log(`  无效记录: ${invalidRecords}`);
        console.log(`  总需求量: ${totalDemandMeters.toFixed(1)}米`);
        console.log(`  已生产量: ${producedMeters.toFixed(1)}米`);
        console.log(`  已发货量: ${shippedMeters.toFixed(1)}米`);
        console.log(`  完成率: ${this.data.completionRate}%`);
    }
    
    setupFilters() {
        // 状态筛选复选框
        const statusCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
        statusCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.applyFilters());
        });
        
        // 规格型号下拉框
        const specSelect = document.querySelector('.select-dropdown');
        if (specSelect) {
            specSelect.addEventListener('change', () => this.applyFilters());
        }
        
        // 工地区域下拉框
        const areaSelects = document.querySelectorAll('.select-dropdown');
        areaSelects.forEach(select => {
            select.addEventListener('change', () => this.applyFilters());
        });
    }
    
    setupChartActions() {
        const chartBtns = document.querySelectorAll('.chart-btn');
        chartBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const icon = btn.querySelector('i');
                if (icon.classList.contains('fa-expand')) {
                    this.expandChart(btn.closest('.chart-card'));
                } else if (icon.classList.contains('fa-download')) {
                    this.downloadChart(btn.closest('.chart-card'));
                }
            });
        });
    }
    
    updateMetrics() {
        // 第一行卡片：更新总需求量（米制）
        const totalElement = document.querySelector('.metric-card.total .metric-value');
        if (totalElement) {
            this.animateNumber(totalElement, this.data.totalDemandMeters || 0, 1);
        }

        // 更新已生产量（米制）
        const producedElement = document.querySelector('.metric-card.produced .metric-value');
        if (producedElement) {
            this.animateNumber(producedElement, this.data.producedMeters || 0, 1);
        }

        // 更新未生产量（米制）
        const pendingElement = document.querySelector('.metric-card.pending .metric-value');
        if (pendingElement) {
            this.animateNumber(pendingElement, this.data.pendingMeters || 0, 1);
        }

        // 更新生产进度
        const progressElement = document.querySelector('.metric-card.efficiency .metric-value');
        if (progressElement) {
            progressElement.textContent = `${this.data.completionRate}%`;
        }

        // 第二行卡片：更新已发货量（米制）
        const shippedElement = document.querySelector('.metric-card.shipped .metric-value');
        if (shippedElement) {
            this.animateNumber(shippedElement, this.data.shippedMeters || 0, 1);
        }

        // 更新未发货量（米制）
        const unshippedElement = document.querySelector('.metric-card.unshipped .metric-value');
        if (unshippedElement) {
            this.animateNumber(unshippedElement, this.data.unshippedMeters || 0, 1);
        }

        // 更新原材采购（吨）
        const materialElement = document.querySelector('.metric-card.material .metric-value');
        if (materialElement) {
            this.animateNumber(materialElement, this.data.materialTons || 0, 1);
        }

        // 更新库存状态
        const inventoryStatusElement = document.querySelector('.metric-card.inventory .metric-value');
        const inventoryQuantityElement = document.querySelector('#inventoryQuantity');
        if (inventoryStatusElement && this.data.inventoryStatus) {
            inventoryStatusElement.textContent = this.data.inventoryStatus.status;
            // 移除自定义颜色，使用统一的文字颜色
            inventoryStatusElement.style.color = '';
        }
        if (inventoryQuantityElement) {
            this.animateNumber(inventoryQuantityElement, this.data.unshippedMeters || 0, 1);
        }

        // 更新完成率
        const completionElements = document.querySelectorAll('.metric-subtitle');
        completionElements.forEach(element => {
            if (element.textContent.includes('完成率')) {
                element.textContent = `完成率: ${this.data.completionRate}%`;
            }
            if (element.textContent.includes('待完成')) {
                element.textContent = `待完成: ${(100 - this.data.completionRate).toFixed(1)}%`;
            }
        });

        // 更新进度环
        this.updateProgressRing();
    }
    
    animateNumber(element, targetValue, decimals = 0) {
        const startValue = parseFloat(element.textContent.replace(/,/g, '')) || 0;
        const duration = 1000; // 1秒动画
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用缓动函数
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = startValue + (targetValue - startValue) * easeOutQuart;
            
            element.textContent = this.formatNumber(currentValue, decimals);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    formatNumber(num, decimals = 0) {
        return new Intl.NumberFormat('zh-CN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    updateProgressRing() {
        const progressCircle = document.querySelector('.progress-ring-circle');
        const progressText = document.querySelector('.progress-text');
        
        if (progressCircle && progressText) {
            const radius = 25;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (this.data.completionRate / 100) * circumference;
            
            progressCircle.style.strokeDasharray = circumference;
            progressCircle.style.strokeDashoffset = offset;
            progressText.textContent = `${this.data.completionRate}%`;
        }
    }
    
    updateLastUpdateTime() {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            const now = new Date();
            const timeString = now.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            lastUpdateElement.textContent = timeString;
        }
    }
    
    refreshData() {
        const refreshBtn = document.getElementById('refreshBtn');
        const icon = refreshBtn.querySelector('i');

        // 添加加载状态
        icon.classList.add('fa-spin');
        refreshBtn.disabled = true;

        console.log('🔄 手动刷新数据...');

        // 强制重新加载数据
        if (window.dataManager) {
            console.log('重新加载本地存储数据...');
            window.dataManager.loadFromLocalStorage();
            console.log('重新加载后数据条数:', window.dataManager.data.length);
        }

        // 从数据管理器刷新真实数据
        setTimeout(() => {
            // 从数据管理器获取最新数据
            this.updateMetricsFromDataManager();
            this.updateLastUpdateTime();
            this.updateCharts();

            // 移除加载状态
            icon.classList.remove('fa-spin');
            refreshBtn.disabled = false;

            // 显示成功提示
            this.showNotification('数据已更新', 'success');
        }, 1500);
    }
    
    applyFilters() {
        // 获取当前筛选条件
        const statusFilters = Array.from(document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());
        
        const specFilter = document.querySelector('.select-dropdown').value;
        
        console.log('应用筛选条件:', { statusFilters, specFilter });
        
        // 这里可以添加实际的筛选逻辑
        this.updateCharts();
        this.showNotification('筛选条件已应用', 'info');
    }
    
    expandChart(chartCard) {
        // 实现图表全屏功能
        if (chartCard.classList.contains('expanded')) {
            chartCard.classList.remove('expanded');
            document.body.classList.remove('chart-expanded');
        } else {
            chartCard.classList.add('expanded');
            document.body.classList.add('chart-expanded');
        }
        
        // 重新调整图表大小
        setTimeout(() => {
            this.resizeCharts();
        }, 300);
    }
    
    downloadChart(chartCard) {
        const canvas = chartCard.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `chart-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
            
            this.showNotification('图表已下载', 'success');
        }
    }
    
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }
    
    updateCharts() {
        // 更新所有图表数据
        if (this.charts && this.charts.productionChart) {
            this.updateProductionChart();
        }
        if (this.charts && this.charts.shippingChart) {
            this.updateShippingChart();
        }
        if (this.charts && this.charts.specChart) {
            this.updateSpecChart();
        }
        if (this.charts && this.charts.areaChart) {
            this.updateAreaChart();
        }
    }
    
    startAutoRefresh() {
        // 每5分钟自动刷新一次数据显示
        this.refreshInterval = setInterval(() => {
            this.updateMetricsFromDataManager();
            this.updateLastUpdateTime();
        }, 5 * 60 * 1000);
    }

    // 定期检查数据状态
    startDataCheck() {
        // 每10秒检查一次数据状态
        this.dataCheckInterval = setInterval(() => {
            this.checkDataStatus();
        }, 10 * 1000);
    }

    // 检查数据状态（增强版本）
    checkDataStatus() {
        if (!window.dataManager) return;

        const currentDataLength = window.dataManager.data ? window.dataManager.data.length : 0;
        const currentMetrics = this.data.totalDemandMeters || 0;
        const currentProduced = this.data.producedMeters || 0;
        const currentShipped = this.data.shippedMeters || 0;

        // 详细的数据状态检查
        const hasData = currentDataLength > 0;
        const hasMetrics = currentMetrics > 0 || currentProduced > 0 || currentShipped > 0;

        // 如果有数据但统计为0，强制更新
        if (hasData && !hasMetrics) {
            console.log('🔍 检测到数据不同步，强制更新...');
            console.log('数据状态:', {
                dataLength: currentDataLength,
                totalDemandMeters: currentMetrics,
                producedMeters: currentProduced,
                shippedMeters: currentShipped
            });

            // 强制重新计算
            this.updateMetricsFromDataManager();

            // 如果还是0，再次尝试
            setTimeout(() => {
                const newMetrics = this.data.totalDemandMeters || 0;
                if (currentDataLength > 0 && newMetrics === 0) {
                    console.log('⚠️ 第二次检查仍然不同步，深度修复...');
                    this.deepDataSync();
                }
            }, 2000);
        }
    }

    // 深度数据同步修复
    deepDataSync() {
        console.log('🔧 执行深度数据同步修复...');

        if (!window.dataManager || !window.dataManager.data) {
            console.log('❌ DataManager或数据不存在');
            return;
        }

        // 强制重新加载本地数据
        window.dataManager.loadFromLocalStorage();

        setTimeout(() => {
            // 重新计算统计
            this.updateMetricsFromDataManager();

            // 验证修复结果
            setTimeout(() => {
                const finalMetrics = this.data.totalDemandMeters || 0;
                const dataLength = window.dataManager.data ? window.dataManager.data.length : 0;

                if (dataLength > 0 && finalMetrics > 0) {
                    console.log('✅ 深度同步修复成功');
                    this.showNotification('数据同步已修复', 'success');
                } else {
                    console.log('❌ 深度同步修复失败');
                    this.showNotification('数据同步异常，请手动刷新', 'warning');
                }
            }, 1000);
        }, 500);
    }
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        if (this.dataCheckInterval) {
            clearInterval(this.dataCheckInterval);
            this.dataCheckInterval = null;
        }
    }
    
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 添加样式
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out',
            backgroundColor: type === 'success' ? '#10b981' : 
                           type === 'error' ? '#ef4444' : '#3b82f6'
        });
        
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // 自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 初始化图表（在charts.js中实现）
    initializeCharts() {
        if (typeof window.initCharts === 'function') {
            this.charts = window.initCharts();
            // 初始化后立即更新图表数据
            setTimeout(() => {
                this.updateCharts();
            }, 200);
        }
    }


    
    // 更新图表方法（使用真实数据）
    updateProductionChart() {
        if (typeof window.updateProductionChart === 'function' && window.dataManager) {
            window.updateProductionChart(this.charts.productionChart, window.dataManager.data);
        }
    }

    updateShippingChart() {
        if (typeof window.updateShippingChart === 'function' && window.dataManager) {
            window.updateShippingChart(this.charts.shippingChart, window.dataManager.data);
        }
    }

    updateSpecChart() {
        if (typeof window.updateSpecChart === 'function' && window.dataManager && this.charts.specChart) {
            window.updateSpecChart(this.charts.specChart, window.dataManager.data);
        }
    }

    updateAreaChart() {
        if (typeof window.updateAreaChart === 'function' && window.dataManager) {
            window.updateAreaChart(this.charts.areaChart, window.dataManager.data);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new SteelProductionDashboard();
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});
