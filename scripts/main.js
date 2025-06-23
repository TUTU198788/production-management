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
        console.log('window.dataCore 存在:', !!window.dataCore);

        // 优先使用新的模块化架构
        if (window.dataCore && window.productionManager && window.shippingManager) {
            console.log('✅ 使用新的模块化架构更新数据');
            this.updateMetricsFromModules();
            return;
        }

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

        // 计算已发货量（米）- 使用多种数据源确保准确性
        let calculatedShippedMeters = 0;
        let shippedValidRecords = 0;

        // 方法1：优先从发货历史直接计算
        if (window.dataManager && window.dataManager.shippingHistory && window.dataManager.shippingHistory.length > 0) {
            console.log(`📦 方法1: 从发货历史直接计算 (${window.dataManager.shippingHistory.length} 条记录)`);

            calculatedShippedMeters = window.dataManager.shippingHistory.reduce((sum, record) => {
                const recordMeters = record.totalMeters || 0;
                return sum + recordMeters;
            }, 0);

            if (calculatedShippedMeters > 0) {
                console.log(`📦 从发货历史计算发货量: ${calculatedShippedMeters.toFixed(1)}米`);

                // 显示前几条发货记录
                window.dataManager.shippingHistory.slice(0, 3).forEach(record => {
                    if (record.totalMeters > 0) {
                        console.log(`  ${record.customerName}: ${record.totalMeters.toFixed(1)}米 (${record.date})`);
                    }
                });
            }
        }

        // 方法2：使用客户发货统计
        if (calculatedShippedMeters === 0 && window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            console.log(`📦 方法2: 使用客户发货统计`);
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                const customerShippedMeters = customerStats.reduce((sum, customer) => {
                    return sum + (customer.totalMeters || 0);
                }, 0);

                if (customerShippedMeters > 0) {
                    calculatedShippedMeters = customerShippedMeters;
                    console.log(`📦 客户发货统计详情:`);
                    customerStats.forEach(customer => {
                        if (customer.totalMeters > 0) {
                            console.log(`  ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                        }
                    });
                    console.log(`📦 从客户统计计算发货量: ${calculatedShippedMeters.toFixed(1)}米`);
                } else {
                    console.log(`⚠️ 客户统计返回0米，检查发货历史数据...`);

                    // 检查发货历史数据
                    if (window.dataManager.shippingHistory) {
                        console.log(`📋 发货历史记录数: ${window.dataManager.shippingHistory.length}`);
                        if (window.dataManager.shippingHistory.length > 0) {
                            console.log(`📋 发货历史示例:`, window.dataManager.shippingHistory[0]);
                        }
                    } else {
                        console.log(`❌ 发货历史数据不存在`);
                    }

                    // 检查生产数据中的发货记录
                    if (window.dataManager.data) {
                        const itemsWithShipping = window.dataManager.data.filter(item =>
                            item.shippingRecords && item.shippingRecords.length > 0
                        );
                        console.log(`📋 生产数据中有发货记录的项目数: ${itemsWithShipping.length}`);
                        if (itemsWithShipping.length > 0) {
                            console.log(`📋 发货记录示例:`, itemsWithShipping[0].shippingRecords[0]);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ 客户统计计算失败:', error);
            }
        }

        // 方法3：如果前两种方法都没有数据，使用生产数据中的shipped字段
        if (calculatedShippedMeters === 0) {
            console.log(`📦 方法3: 使用生产数据中的shipped字段计算发货量`);
            calculatedShippedMeters = data.reduce((sum, item) => {
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
            console.log(`📦 从生产数据计算发货量: ${calculatedShippedMeters.toFixed(1)}米`);
        }



        this.data.shippedMeters = calculatedShippedMeters;

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
        // 刷新按钮 - 防止页面刷新
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (event) => {
                // 明确阻止任何默认行为和事件冒泡
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                console.log('🔄 刷新按钮被点击，阻止页面刷新');

                // 调用数据刷新方法
                this.refreshData();
            });

            // 额外保护：阻止右键菜单可能的刷新操作
            refreshBtn.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });

            console.log('✅ 刷新按钮事件监听器已设置（防页面刷新）');
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

        // 设置卡片点击事件
        this.setupCardClickEvents();

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

        // 优先从客户发货统计获取发货量
        let finalShippedMeters = shippedMeters;
        if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                const customerShippedMeters = customerStats.reduce((sum, customer) => {
                    return sum + (customer.totalMeters || 0);
                }, 0);
                if (customerShippedMeters > 0) {
                    finalShippedMeters = customerShippedMeters;
                    console.log(`📦 强化计算使用客户统计发货量: ${finalShippedMeters.toFixed(1)}米`);
                }
            } catch (error) {
                console.warn('⚠️ 强化计算中客户统计失败，使用原计算结果:', error);
            }
        }

        this.data.shippedMeters = finalShippedMeters;
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

        // 第二行卡片：更新已发货量（米制）- 使用新的卡片管理器
        if (window.shippedCardManager && typeof window.shippedCardManager.forceUpdate === 'function') {
            window.shippedCardManager.forceUpdate();
        } else {
            // 兼容旧的更新方式
            const shippedElement = document.querySelector('.metric-card.shipped .metric-value');
            if (shippedElement) {
                this.animateNumber(shippedElement, this.data.shippedMeters || 0, 1);
            }
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
        console.log('🔄 开始手动刷新数据（不刷新页面）...');

        const refreshBtn = document.getElementById('refreshBtn');
        if (!refreshBtn) {
            console.error('❌ 未找到刷新按钮');
            return;
        }

        const icon = refreshBtn.querySelector('i');
        if (!icon) {
            console.error('❌ 未找到刷新按钮图标');
            return;
        }

        // 防止页面刷新 - 确保没有任何可能触发页面刷新的代码
        console.log('🛡️ 防止页面刷新保护已激活');

        // 添加加载状态
        icon.classList.add('fa-spin');
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';

        console.log('🔄 手动刷新数据（仅更新数据，不刷新页面）...');

        // 强制重新加载数据
        if (window.dataManager) {
            console.log('📊 重新加载本地存储数据...');
            try {
                window.dataManager.loadFromLocalStorage();
                console.log('✅ 重新加载后数据条数:', window.dataManager.data?.length || 0);
            } catch (error) {
                console.error('❌ 重新加载数据失败:', error);
            }
        } else {
            console.warn('⚠️ dataManager 不存在');
        }

        // 从数据管理器刷新真实数据
        setTimeout(() => {
            try {
                console.log('📈 更新界面数据...');

                // 从数据管理器获取最新数据
                this.updateMetricsFromDataManager();
                this.updateLastUpdateTime();
                this.updateCharts();

                console.log('✅ 数据刷新完成（页面未刷新）');
            } catch (error) {
                console.error('❌ 更新界面数据失败:', error);
            } finally {
                // 移除加载状态
                icon.classList.remove('fa-spin');
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = '1';

                // 显示成功提示
                this.showNotification('数据已更新（页面未刷新）', 'success');

                console.log('🎉 刷新数据操作完成，页面保持不变');
            }
        }, 1000); // 减少延迟时间
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

    // 检查数据状态（增强版本）- 修复发货量重置问题
    checkDataStatus() {
        if (!window.dataManager) return;

        const currentDataLength = window.dataManager.data ? window.dataManager.data.length : 0;
        const currentMetrics = this.data.totalDemandMeters || 0;
        const currentProduced = this.data.producedMeters || 0;
        const currentShipped = this.data.shippedMeters || 0;

        // 详细的数据状态检查
        const hasData = currentDataLength > 0;
        const hasMetrics = currentMetrics > 0 || currentProduced > 0;

        // 修复：不要因为发货量为0就强制更新，发货量可能确实为0
        // 只有当总需求量和已生产量都为0但有数据时才强制更新
        if (hasData && currentMetrics === 0 && currentProduced === 0) {
            console.log('🔍 检测到生产数据不同步，强制更新...');
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
                const newProduced = this.data.producedMeters || 0;
                if (currentDataLength > 0 && newMetrics === 0 && newProduced === 0) {
                    console.log('⚠️ 第二次检查仍然不同步，深度修复...');
                    this.deepDataSync();
                }
            }, 2000);
        }

        // 单独检查发货量异常情况（发货量大于已生产量）
        if (currentShipped > currentProduced && currentProduced > 0) {
            console.log('⚠️ 检测到发货量异常（大于已生产量），重新计算发货量...');
            this.recalculateShippingOnly();
        }
    }

    // 仅重新计算发货量，不影响其他数据
    recalculateShippingOnly() {
        console.log('🔄 仅重新计算发货量...');

        let shippedMeters = 0;

        // 方法1：从客户统计计算
        if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                shippedMeters = customerStats.reduce((sum, customer) => {
                    return sum + (customer.totalMeters || 0);
                }, 0);

                if (shippedMeters > 0) {
                    console.log(`📦 从客户统计重新计算发货量: ${shippedMeters.toFixed(1)}米`);
                }
            } catch (error) {
                console.error('❌ 客户统计计算失败:', error);
            }
        }

        // 方法2：如果客户统计为0，从生产数据计算
        if (shippedMeters === 0 && window.dataManager && window.dataManager.data) {
            shippedMeters = window.dataManager.data.reduce((sum, item) => {
                const length = this.extractLengthFromSpec(item.spec);
                const shipped = item.shipped || 0;
                return sum + (shipped * length / 1000);
            }, 0);
            console.log(`📦 从生产数据重新计算发货量: ${shippedMeters.toFixed(1)}米`);
        }

        // 更新发货量和未发货量
        this.data.shippedMeters = shippedMeters;
        this.data.unshippedMeters = Math.max(0, this.data.producedMeters - shippedMeters);

        // 仅更新发货相关的界面元素
        const shippedElement = document.querySelector('.metric-card.shipped .metric-value');
        if (shippedElement) {
            this.animateNumber(shippedElement, shippedMeters, 1);
        }

        const unshippedElement = document.querySelector('.metric-card.unshipped .metric-value');
        if (unshippedElement) {
            this.animateNumber(unshippedElement, this.data.unshippedMeters, 1);
        }

        console.log(`✅ 发货量重新计算完成: ${shippedMeters.toFixed(1)}米`);
    }

    // 设置卡片点击事件
    setupCardClickEvents() {
        console.log('🖱️ 设置卡片点击事件...');

        // 已发货量卡片点击事件
        const shippedCard = document.querySelector('.metric-card.shipped');
        if (shippedCard) {
            shippedCard.style.cursor = 'pointer';
            shippedCard.title = '点击查看客户发货明细';

            shippedCard.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🖱️ 已发货量卡片被点击');
                this.openShippingDetailsModal();
            });

            console.log('✅ 已发货量卡片点击事件已绑定');
        } else {
            console.error('❌ 未找到已发货量卡片');
        }
    }

    // 专门更新已发货量卡片
    updateShippedMetersCard() {
        console.log('🚚 更新已发货量卡片...');

        let shippedMeters = 0;
        let customerCount = 0;
        let dataSource = '';

        // 方法1：从客户统计获取
        if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                const customersWithShipping = customerStats.filter(c => c.totalMeters > 0);

                shippedMeters = customerStats.reduce((sum, customer) => {
                    return sum + (customer.totalMeters || 0);
                }, 0);

                customerCount = customersWithShipping.length;
                dataSource = '客户统计';

                console.log(`📦 从客户统计获取: ${shippedMeters.toFixed(1)}米, ${customerCount}个客户`);

                if (shippedMeters > 0) {
                    console.log('📦 客户发货详情:');
                    customersWithShipping.slice(0, 3).forEach(customer => {
                        console.log(`  - ${customer.customerName}: ${customer.totalMeters.toFixed(1)}米`);
                    });
                }
            } catch (error) {
                console.error('❌ 客户统计计算失败:', error);
            }
        }

        // 方法2：从发货历史获取
        if (shippedMeters === 0 && window.dataManager?.shippingHistory) {
            const shippingHistory = window.dataManager.shippingHistory;
            if (shippingHistory.length > 0) {
                shippedMeters = shippingHistory.reduce((sum, record) => {
                    return sum + (record.totalMeters || 0);
                }, 0);

                const uniqueCustomers = new Set(shippingHistory.map(r => r.customerName));
                customerCount = uniqueCustomers.size;
                dataSource = '发货历史';

                console.log(`📦 从发货历史获取: ${shippedMeters.toFixed(1)}米, ${customerCount}个客户`);
            }
        }

        // 更新卡片显示
        const shippedValueElement = document.getElementById('shippedMetersValue');
        const customerCountElement = document.getElementById('shippedCustomerCount');

        if (shippedValueElement) {
            // 使用动画更新数字
            this.animateNumber(shippedValueElement, shippedMeters, 1);
        }

        if (customerCountElement) {
            customerCountElement.textContent = customerCount;
        }

        // 更新内部数据
        this.data.shippedMeters = shippedMeters;

        console.log(`✅ 已发货量卡片更新完成: ${shippedMeters.toFixed(1)}米 (${dataSource})`);

        return shippedMeters;
    }

    // 打开发货明细模态框
    openShippingDetailsModal() {
        console.log('📊 打开发货明细模态框...');

        // 计算各厂家发货统计
        const manufacturerStats = this.calculateManufacturerShippingStats();

        // 创建模态框
        this.createShippingDetailsModal(manufacturerStats);
    }

    // 计算客户发货统计 - 简化版本
    calculateManufacturerShippingStats() {
        console.log('📊 计算客户发货统计（简化版）...');

        let totalShippedMeters = 0;
        const customers = [];

        // 直接从客户统计获取数据
        if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();

                customerStats.forEach(customer => {
                    if (customer.totalMeters > 0) {
                        customers.push({
                            name: customer.customerName,
                            totalMeters: customer.totalMeters,
                            percentage: 0 // 稍后计算
                        });
                        totalShippedMeters += customer.totalMeters;
                    }
                });

                // 计算占比
                customers.forEach(customer => {
                    customer.percentage = totalShippedMeters > 0 ? (customer.totalMeters / totalShippedMeters * 100) : 0;
                });

                // 按发货量排序
                customers.sort((a, b) => b.totalMeters - a.totalMeters);

                console.log('📊 客户发货统计结果:', {
                    客户数量: customers.length,
                    总发货量: `${totalShippedMeters.toFixed(1)}米`
                });

            } catch (error) {
                console.error('❌ 客户统计计算失败:', error);
            }
        }

        return {
            customers: customers,
            totalMeters: totalShippedMeters
        };
    }

    // 从规格中提取厂家信息
    extractManufacturerFromSpec(spec) {
        if (!spec) return null;

        // 常见的厂家标识模式
        const patterns = [
            /厂家[：:]\s*([^，,\s]+)/,     // 厂家：XXX
            /生产厂家[：:]\s*([^，,\s]+)/, // 生产厂家：XXX
            /制造商[：:]\s*([^，,\s]+)/,   // 制造商：XXX
            /供应商[：:]\s*([^，,\s]+)/,   // 供应商：XXX
            /([^-\s]+)厂/,                // XXX厂
            /([^-\s]+)公司/,              // XXX公司
            /([^-\s]+)集团/               // XXX集团
        ];

        for (let pattern of patterns) {
            const match = spec.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    // 创建发货明细模态框 - 简洁版本
    createShippingDetailsModal(stats) {
        console.log('🎨 创建发货明细模态框（简洁版）...');

        // 移除已存在的模态框
        const existingModal = document.getElementById('shippingDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建简洁的模态框HTML
        const modalHTML = `
            <div class="modal" id="shippingDetailsModal">
                <div class="modal-content" style="max-width: 700px; width: 90%;">
                    <div class="modal-header">
                        <h3>
                            <i class="fas fa-truck"></i>
                            客户发货明细
                        </h3>
                        <button class="modal-close" id="closeShippingDetailsModal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <!-- 简洁的总体统计 -->
                        <div class="shipping-summary-simple">
                            <div class="summary-item">
                                <span class="label">总发货量:</span>
                                <span class="value">${stats.totalMeters.toFixed(1)} 米</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">客户数量:</span>
                                <span class="value">${stats.customers.length} 家</span>
                            </div>
                        </div>

                        <!-- 客户发货明细表格 -->
                        <div class="customer-details">
                            <div class="table-container">
                                <table class="customer-table">
                                    <thead>
                                        <tr>
                                            <th>排名</th>
                                            <th>客户名称</th>
                                            <th>发货量(米)</th>
                                            <th>占比</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${this.generateCustomerTableRows(stats.customers)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="exportShippingDetails">
                            <i class="fas fa-download"></i>
                            导出明细
                        </button>
                        <button type="button" class="btn btn-primary" id="closeShippingDetailsBtn">
                            关闭
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        const modalStyles = `
            <style id="shippingDetailsModalStyles">
                #shippingDetailsModal .modal-content {
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .shipping-summary {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 30px;
                    flex-wrap: wrap;
                }

                .summary-card {
                    flex: 1;
                    min-width: 150px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }

                .summary-label {
                    font-size: 14px;
                    opacity: 0.9;
                    margin-bottom: 8px;
                }

                .summary-value {
                    font-size: 24px;
                    font-weight: bold;
                }

                .manufacturer-details {
                    margin-bottom: 30px;
                }

                .manufacturer-details h4 {
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 2px solid #e5e7eb;
                    padding-bottom: 8px;
                }

                .table-container {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                }

                .customer-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }

                .customer-table th {
                    background: #f8fafc;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 2px solid #e5e7eb;
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }

                .customer-table td {
                    padding: 12px;
                    border-bottom: 1px solid #f1f5f9;
                }

                .customer-table tbody tr:hover {
                    background: #f8fafc;
                }

                .shipping-summary-simple {
                    display: flex;
                    justify-content: space-around;
                    background: #f8f9fa;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }

                .summary-item {
                    text-align: center;
                }

                .summary-item .label {
                    font-size: 14px;
                    color: #666;
                    display: block;
                    margin-bottom: 5px;
                }

                .summary-item .value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                }

                .customer-details {
                    margin-top: 20px;
                }

                .rank-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                }

                .rank-1 { background: #ffd700; color: #333; }
                .rank-2 { background: #c0c0c0; color: #333; }
                .rank-3 { background: #cd7f32; color: white; }
                .rank-other { background: #6b7280; }

                .percentage-bar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .percentage-fill {
                    height: 6px;
                    background: #3b82f6;
                    border-radius: 3px;
                    min-width: 2px;
                }

                .percentage-bg {
                    width: 60px;
                    height: 6px;
                    background: #e5e7eb;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .manufacturer-chart {
                    margin-top: 20px;
                }

                .manufacturer-chart h4 {
                    margin-bottom: 15px;
                    color: #333;
                }

                .detail-btn {
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .detail-btn:hover {
                    background: #2563eb;
                }

                @media (max-width: 768px) {
                    .shipping-summary-simple {
                        flex-direction: column;
                        gap: 10px;
                    }

                    .customer-table {
                        font-size: 12px;
                    }

                    .customer-table th,
                    .customer-table td {
                        padding: 8px;
                    }
                }
            </style>
        `;

        // 添加到页面
        document.head.insertAdjacentHTML('beforeend', modalStyles);
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 显示模态框
        const modal = document.getElementById('shippingDetailsModal');
        modal.classList.add('active');

        // 绑定事件
        this.bindShippingDetailsEvents(stats);

        console.log('✅ 发货明细模态框创建完成');
    }

    // 生成客户表格行 - 简洁版本
    generateCustomerTableRows(customers) {
        return customers.map((customer, index) => {
            const rank = index + 1;
            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';

            return `
                <tr>
                    <td>
                        <span class="rank-badge ${rankClass}">${rank}</span>
                    </td>
                    <td>
                        <strong>${customer.name}</strong>
                    </td>
                    <td>
                        <strong>${customer.totalMeters.toFixed(1)}</strong> 米
                    </td>
                    <td>
                        <div class="percentage-bar">
                            <div class="percentage-bg">
                                <div class="percentage-fill" style="width: ${customer.percentage}%"></div>
                            </div>
                            <span>${customer.percentage.toFixed(1)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 绑定发货明细模态框事件
    bindShippingDetailsEvents(stats) {
        // 关闭按钮
        const closeBtn = document.getElementById('closeShippingDetailsModal');
        const closeBtn2 = document.getElementById('closeShippingDetailsBtn');

        const closeModal = () => {
            const modal = document.getElementById('shippingDetailsModal');
            const styles = document.getElementById('shippingDetailsModalStyles');
            if (modal) modal.remove();
            if (styles) styles.remove();
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

        // 点击背景关闭
        const modal = document.getElementById('shippingDetailsModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportShippingDetails');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportShippingDetails(stats);
            });
        }

        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 显示厂家详细信息
    showManufacturerDetails(manufacturerName) {
        console.log(`📊 显示厂家详细信息: ${manufacturerName}`);

        // 这里可以实现显示特定厂家的详细发货记录
        // 暂时显示一个简单的提示
        this.showNotification(`正在加载 ${manufacturerName} 的详细信息...`, 'info');

        // TODO: 实现详细信息展示
    }

    // 导出发货明细 - 客户版本
    exportShippingDetails(stats) {
        console.log('📥 导出客户发货明细...');

        try {
            // 准备导出数据
            const exportData = [
                ['客户发货明细报表'],
                ['生成时间:', new Date().toLocaleString()],
                [''],
                ['总体统计'],
                ['总发货量(米)', stats.totalMeters.toFixed(1)],
                ['客户数量', stats.customers.length],
                [''],
                ['客户明细'],
                ['排名', '客户名称', '发货量(米)', '占比(%)']
            ];

            // 添加客户数据
            stats.customers.forEach((customer, index) => {
                exportData.push([
                    index + 1,
                    customer.name,
                    customer.totalMeters.toFixed(1),
                    customer.percentage.toFixed(1)
                ]);
            });

            // 转换为CSV格式
            const csvContent = exportData.map(row =>
                row.map(cell => `"${cell}"`).join(',')
            ).join('\n');

            // 创建下载链接
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `客户发货明细_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.showNotification('客户发货明细已导出', 'success');

        } catch (error) {
            console.error('❌ 导出失败:', error);
            this.showNotification('导出失败，请重试', 'error');
        }
    }

    // 创建厂家发货量图表
    createManufacturerChart(manufacturers) {
        const canvas = document.getElementById('manufacturerChart');
        if (!canvas || manufacturers.length === 0) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 取前8个厂家数据
        const topManufacturers = manufacturers.slice(0, 8);
        const maxValue = Math.max(...topManufacturers.map(m => m.totalMeters));

        // 设置样式
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        // 绘制柱状图
        const barWidth = (width - 80) / topManufacturers.length;
        const chartHeight = height - 60;

        topManufacturers.forEach((manufacturer, index) => {
            const x = 40 + index * barWidth;
            const barHeight = (manufacturer.totalMeters / maxValue) * chartHeight;
            const y = height - 40 - barHeight;

            // 绘制柱子
            const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#1d4ed8');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth - 10, barHeight);

            // 绘制数值
            ctx.fillStyle = '#333';
            ctx.fillText(
                manufacturer.totalMeters.toFixed(0),
                x + (barWidth - 10) / 2,
                y - 5
            );

            // 绘制厂家名称（旋转）
            ctx.save();
            ctx.translate(x + (barWidth - 10) / 2, height - 10);
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = 'right';
            ctx.fillText(
                manufacturer.name.length > 8 ?
                manufacturer.name.substring(0, 8) + '...' :
                manufacturer.name,
                0, 0
            );
            ctx.restore();
        });

        // 绘制Y轴标签
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';
        ctx.fillText('发货量(米)', 35, 20);

        console.log('✅ 厂家发货量图表创建完成');
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

    // 使用新模块化架构更新数据
    updateMetricsFromModules() {
        console.log('=== 🆕 使用模块化架构更新数据 ===');

        try {
            // 1. 从DataCore获取基础统计
            const productionStats = window.dataCore.getProductionStats();
            const shippingStats = window.dataCore.getShippingStats();

            console.log('📊 生产统计:', productionStats);
            console.log('🚚 发货统计:', shippingStats);

            // 2. 计算米制数据
            const totalDemandMeters = this.calculateMetersFromData(window.dataCore.data, 'planned');
            const producedMeters = this.calculateMetersFromData(window.dataCore.data, 'produced');

            // 3. 发货量计算 - 使用多种数据源确保准确性
            let shippedMeters = shippingStats.totalMeters;

            // 如果DataCore的发货统计为0，尝试从DataManager获取
            if (shippedMeters === 0 && window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
                console.log('🔄 DataCore发货统计为0，尝试从DataManager计算...');
                try {
                    const customerStats = window.dataManager.calculateCustomerStats();
                    const customerShippedMeters = customerStats.reduce((sum, customer) => {
                        return sum + (customer.totalMeters || 0);
                    }, 0);

                    if (customerShippedMeters > 0) {
                        shippedMeters = customerShippedMeters;
                        console.log(`📦 从DataManager客户统计获取发货量: ${shippedMeters.toFixed(1)}米`);
                    }
                } catch (error) {
                    console.error('❌ DataManager客户统计计算失败:', error);
                }
            }

            // 如果仍然为0，从生产数据的shipped字段计算
            if (shippedMeters === 0) {
                console.log('🔄 尝试从生产数据shipped字段计算...');
                shippedMeters = this.calculateMetersFromData(window.dataCore.data, 'shipped');
                console.log(`📦 从生产数据shipped字段计算: ${shippedMeters.toFixed(1)}米`);
            }

            // 4. 计算派生数据
            const pendingMeters = Math.max(0, totalDemandMeters - producedMeters);
            const unshippedMeters = Math.max(0, producedMeters - shippedMeters);
            const completionRate = totalDemandMeters > 0 ? (producedMeters / totalDemandMeters * 100) : 0;

            // 5. 更新内部数据
            this.data = {
                ...this.data,
                totalDemandMeters: totalDemandMeters,
                producedMeters: producedMeters,
                pendingMeters: pendingMeters,
                shippedMeters: shippedMeters,
                unshippedMeters: unshippedMeters,
                completionRate: Math.round(completionRate * 10) / 10,
                materialTons: this.calculateMaterialTons(),
                inventoryStatus: this.calculateInventoryStatus(unshippedMeters),
                lastUpdate: new Date()
            };

            console.log('✅ 模块化数据更新完成:', {
                总需求量: `${totalDemandMeters.toFixed(1)}米`,
                已生产量: `${producedMeters.toFixed(1)}米`,
                待生产量: `${pendingMeters.toFixed(1)}米`,
                已发货量: `${shippedMeters.toFixed(1)}米`,
                未发货量: `${unshippedMeters.toFixed(1)}米`,
                完成率: `${completionRate.toFixed(1)}%`
            });

            // 6. 更新界面
            this.updateMetrics();

        } catch (error) {
            console.error('❌ 模块化数据更新失败:', error);
            // 回退到原有方法
            this.updateMetricsFromDataManagerLegacy();
        }
    }

    // 计算米制数据的通用方法
    calculateMetersFromData(data, field) {
        return data.reduce((sum, item) => {
            const length = this.extractLengthFromSpec(item.spec);
            const quantity = item[field] || 0;
            return sum + (quantity * length / 1000);
        }, 0);
    }

    // 计算原材料吨数
    calculateMaterialTons() {
        if (!window.dataCore || !window.dataCore.materialPurchases) return 0;

        return window.dataCore.materialPurchases.reduce((sum, purchase) => {
            return sum + (purchase.quantity || 0);
        }, 0);
    }

    // 计算库存状态
    calculateInventoryStatus(unshippedMeters) {
        if (unshippedMeters > 10000) {
            return { status: '充足', level: 'high' };
        } else if (unshippedMeters > 5000) {
            return { status: '正常', level: 'normal' };
        } else if (unshippedMeters > 1000) {
            return { status: '偏低', level: 'low' };
        } else {
            return { status: '不足', level: 'critical' };
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 注释掉强制启用云同步的代码，允许用户自主选择
    /*
    // 强制启用云同步以解决数据同步问题
    if (localStorage.getItem('disableFirebase') === 'true') {
        localStorage.removeItem('disableFirebase');
        console.log('Firebase sync was disabled. Re-enabling for data consistency.');
        alert('为了解决多客户端数据同步问题，云同步功能已自动重新启用。页面将刷新以应用更改。');
        location.reload();
        return; // 重新加载页面，后续代码无需执行
    }
    */

    console.log('🚀 初始化系统架构...');

    // 初始化新的模块化架构
    if (typeof DataCore !== 'undefined' &&
        typeof ProductionManager !== 'undefined' &&
        typeof ShippingManager !== 'undefined' &&
        typeof UIController !== 'undefined') {

        console.log('✅ 使用新的模块化架构');

        // 初始化核心模块
        window.dataCore = new DataCore();
        window.productionManager = new ProductionManager(window.dataCore);
        window.shippingManager = new ShippingManager(window.dataCore, window.productionManager);
        window.uiController = new UIController(window.dataCore, window.productionManager, window.shippingManager);

        console.log('🎯 模块化架构初始化完成');
    } else {
        console.log('⚠️ 模块化架构不完整，使用传统架构');
    }

    // 初始化传统数据管理器（兼容层）
    window.dataManager = new DataManager();

    // 绑定事件
    window.dashboard = new SteelProductionDashboard();

    console.log('✅ 系统初始化完成');
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});

// 全局函数：显示发货明细
function showShippingDetails() {
    if (window.dashboard && typeof window.dashboard.openShippingDetailsModal === 'function') {
        window.dashboard.openShippingDetailsModal();
    } else {
        console.error('❌ Dashboard未初始化或方法不存在');
    }
}
