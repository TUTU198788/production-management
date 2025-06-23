// 修复仪表板卡片联动功能
// 确保所有卡片数据能够正确计算和显示

(function() {
    'use strict';
    
    console.log('🔧 开始修复仪表板卡片联动...');
    
    // 等待页面和模块加载完成
    function waitForModules() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkModules = () => {
                attempts++;
                
                const hasDataManager = !!window.dataManager;
                const hasDashboard = !!window.dashboard;
                const hasModules = !!(window.dataCore && window.productionManager && window.shippingManager);
                
                console.log(`检查模块 (${attempts}/${maxAttempts}):`, {
                    dataManager: hasDataManager,
                    dashboard: hasDashboard,
                    modules: hasModules
                });
                
                if ((hasDataManager && hasDashboard) || attempts >= maxAttempts) {
                    resolve({ hasDataManager, hasDashboard, hasModules });
                } else {
                    setTimeout(checkModules, 100);
                }
            };
            
            checkModules();
        });
    }
    
    // 强制更新所有卡片数据
    function forceUpdateAllCards() {
        console.log('🎯 强制更新所有卡片数据...');
        
        try {
            // 1. 获取数据源
            let data = [];
            let shippingHistory = [];
            let materialPurchases = [];
            
            if (window.dataCore) {
                // 使用新模块化架构
                data = window.dataCore.getAllProductionRecords();
                shippingHistory = window.dataCore.shippingHistory;
                materialPurchases = window.dataCore.materialPurchases;
                console.log('✅ 使用模块化架构数据源');
            } else if (window.dataManager) {
                // 使用传统架构
                data = window.dataManager.data || [];
                shippingHistory = window.dataManager.shippingHistory || [];
                materialPurchases = window.dataManager.materialPurchases || [];
                console.log('✅ 使用传统架构数据源');
            }
            
            console.log('📊 数据源统计:', {
                生产记录: data.length,
                发货历史: shippingHistory.length,
                原材料采购: materialPurchases.length
            });
            
            // 2. 计算统计数据
            const stats = calculateAllStats(data, shippingHistory, materialPurchases);
            console.log('📈 计算结果:', stats);
            
            // 3. 更新卡片显示
            updateCardDisplays(stats);
            
            // 4. 更新产量统计面板
            updateProductionStatsPanel(data);
            
            console.log('✅ 所有卡片数据更新完成');
            
        } catch (error) {
            console.error('❌ 更新卡片数据失败:', error);
        }
    }
    
    // 计算所有统计数据
    function calculateAllStats(data, shippingHistory, materialPurchases) {
        const stats = {
            totalDemandMeters: 0,
            producedMeters: 0,
            pendingMeters: 0,
            shippedMeters: 0,
            unshippedMeters: 0,
            materialTons: 0,
            completionRate: 0,
            inventoryStatus: '正常'
        };
        
        // 计算生产相关数据（米制）
        data.forEach(item => {
            const length = extractLengthFromSpec(item.spec);
            const planned = item.planned || 0;
            const produced = item.produced || 0;
            
            stats.totalDemandMeters += planned * length / 1000;
            stats.producedMeters += produced * length / 1000;
        });
        
        // 计算发货数据（米制）
        stats.shippedMeters = shippingHistory.reduce((sum, shipping) => {
            return sum + (shipping.meters || 0);
        }, 0);
        
        // 计算原材料数据（吨）
        stats.materialTons = materialPurchases.reduce((sum, purchase) => {
            return sum + (purchase.quantity || 0);
        }, 0);
        
        // 计算派生数据
        stats.pendingMeters = Math.max(0, stats.totalDemandMeters - stats.producedMeters);
        stats.unshippedMeters = Math.max(0, stats.producedMeters - stats.shippedMeters);
        stats.completionRate = stats.totalDemandMeters > 0 ? 
            (stats.producedMeters / stats.totalDemandMeters * 100) : 0;
        
        // 计算库存状态
        if (stats.unshippedMeters > 10000) {
            stats.inventoryStatus = '充足';
        } else if (stats.unshippedMeters > 5000) {
            stats.inventoryStatus = '正常';
        } else if (stats.unshippedMeters > 1000) {
            stats.inventoryStatus = '偏低';
        } else {
            stats.inventoryStatus = '不足';
        }
        
        return stats;
    }
    
    // 提取规格中的长度信息
    function extractLengthFromSpec(spec) {
        if (!spec) return 6000; // 默认长度
        
        // 尝试匹配各种格式
        const patterns = [
            /H\d+-(\d+)mm/,           // H100-2000mm
            /梯桁筋L=(\d+)/,          // 梯桁筋L=6000
            /L=(\d+)/,                // L=6000
            /(\d+)mm/,                // 2000mm
            /(\d{4,5})/               // 4-5位数字
        ];
        
        for (const pattern of patterns) {
            const match = spec.match(pattern);
            if (match) {
                const length = parseInt(match[1]);
                if (length >= 800 && length <= 20000) {
                    return length;
                }
            }
        }
        
        return 6000; // 默认长度
    }
    
    // 更新卡片显示
    function updateCardDisplays(stats) {
        console.log('🎨 更新卡片显示...');
        
        // 第一行卡片
        updateCardValue('.metric-card.total .metric-value', stats.totalDemandMeters, 1);
        updateCardValue('.metric-card.produced .metric-value', stats.producedMeters, 1);
        updateCardValue('.metric-card.pending .metric-value', stats.pendingMeters, 1);
        updateCardValue('.metric-card.efficiency .metric-value', stats.completionRate, 1, '%');
        
        // 第二行卡片
        updateCardValue('.metric-card.shipped .metric-value', stats.shippedMeters, 1);
        updateCardValue('.metric-card.unshipped .metric-value', stats.unshippedMeters, 1);
        updateCardValue('.metric-card.material .metric-value', stats.materialTons, 1);
        
        // 库存状态
        const inventoryElement = document.querySelector('.metric-card.inventory .metric-value');
        if (inventoryElement) {
            inventoryElement.textContent = stats.inventoryStatus;
        }
        
        const inventoryQuantityElement = document.querySelector('#inventoryQuantity');
        if (inventoryQuantityElement) {
            inventoryQuantityElement.textContent = formatNumber(stats.unshippedMeters, 1);
        }
        
        // 更新进度环
        updateProgressRing(stats.completionRate);
        
        console.log('✅ 卡片显示更新完成');
    }
    
    // 更新单个卡片值
    function updateCardValue(selector, value, decimals = 0, suffix = '') {
        const element = document.querySelector(selector);
        if (element) {
            const formattedValue = formatNumber(value, decimals) + suffix;
            element.textContent = formattedValue;
            
            // 添加更新动画
            element.style.transform = 'scale(1.05)';
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 200);
        }
    }
    
    // 格式化数字
    function formatNumber(num, decimals = 0) {
        return new Intl.NumberFormat('zh-CN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }
    
    // 更新进度环
    function updateProgressRing(percentage) {
        const progressCircle = document.querySelector('.progress-ring-circle');
        const progressText = document.querySelector('.progress-text');
        
        if (progressCircle && progressText) {
            const radius = 26;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percentage / 100) * circumference;
            
            progressCircle.style.strokeDasharray = circumference;
            progressCircle.style.strokeDashoffset = offset;
            progressText.textContent = `${percentage.toFixed(1)}%`;
        }
    }
    
    // 更新产量统计面板
    function updateProductionStatsPanel(data) {
        console.log('📊 更新产量统计面板...');

        // 计算各时间段的产量
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const thisYear = new Date(now.getFullYear(), 0, 1);

        let dailyProduction = 0;
        let monthlyProduction = 0;
        let quarterlyProduction = 0;
        let yearlyProduction = 0;

        // 获取今天的日期字符串（YYYY-MM-DD格式）
        const todayString = today.toISOString().split('T')[0];
        const thisMonthString = thisMonth.toISOString().split('T')[0];
        const thisQuarterString = thisQuarter.toISOString().split('T')[0];
        const thisYearString = thisYear.toISOString().split('T')[0];

        let totalProducedMeters = 0;
        let recordsWithDetails = 0;

        // 先计算总产量
        data.forEach(item => {
            const length = extractLengthFromSpec(item.spec);
            const produced = item.produced || 0;
            totalProducedMeters += (produced * length) / 1000;
        });

        // 遍历所有生产记录，基于详细记录计算
        data.forEach(item => {
            const length = extractLengthFromSpec(item.spec);

            if (item.productionRecords && Array.isArray(item.productionRecords) && item.productionRecords.length > 0) {
                recordsWithDetails++;

                item.productionRecords.forEach(record => {
                    const recordDate = record.date;
                    const quantity = record.quantity || 0;
                    const meters = (quantity * length) / 1000;

                    // 日产量（只统计今天的生产记录）
                    if (recordDate === todayString) {
                        dailyProduction += meters;
                    }

                    // 月产量（本月）
                    if (recordDate >= thisMonthString) {
                        monthlyProduction += meters;
                    }

                    // 季度产量（本季度）
                    if (recordDate >= thisQuarterString) {
                        quarterlyProduction += meters;
                    }

                    // 年产量（本年）
                    if (recordDate >= thisYearString) {
                        yearlyProduction += meters;
                    }
                });
            }
        });

        // 如果没有详细记录，基于总产量进行合理估算
        if (totalProducedMeters > 0 && recordsWithDetails === 0) {
            console.log('📊 没有详细生产记录，基于总产量进行智能估算...');

            const currentDate = now.getDate();
            const currentMonth = now.getMonth() + 1;
            const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
            const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const monthsInCurrentQuarter = (now.getMonth() % 3) + 1;

            // 年产量 = 总产量
            yearlyProduction = totalProducedMeters;

            // 季度产量：基于当前季度的进度
            quarterlyProduction = yearlyProduction * (currentQuarter / 4);

            // 月产量：基于当前月份在季度中的位置
            monthlyProduction = quarterlyProduction * (monthsInCurrentQuarter / 3);

            // 日产量：基于当前日期在月份中的位置，设置合理上限
            const dailyEstimate = monthlyProduction * (currentDate / daysInCurrentMonth);
            dailyProduction = Math.min(dailyEstimate, monthlyProduction * 0.2);
        }

        // 更新显示
        updateCardValue('#dailyProduction', dailyProduction, 1);
        updateCardValue('#monthlyProduction', monthlyProduction, 1);
        updateCardValue('#quarterlyProduction', quarterlyProduction, 1);
        updateCardValue('#yearlyProduction', yearlyProduction, 1);

        console.log('✅ 产量统计面板更新完成:', {
            daily: dailyProduction.toFixed(1),
            monthly: monthlyProduction.toFixed(1),
            quarterly: quarterlyProduction.toFixed(1),
            yearly: yearlyProduction.toFixed(1),
            recordsWithDetails
        });
    }
    
    // 主执行函数
    async function main() {
        console.log('🚀 启动卡片联动修复...');
        
        // 等待模块加载
        const moduleStatus = await waitForModules();
        console.log('📦 模块状态:', moduleStatus);
        
        // 强制更新所有卡片
        forceUpdateAllCards();
        
        // 设置定期更新
        setInterval(() => {
            console.log('🔄 定期更新卡片数据...');
            forceUpdateAllCards();
        }, 30000); // 每30秒更新一次
        
        // 监听数据变化
        if (window.dataManager) {
            const originalUpdateStats = window.dataManager.updateStats;
            window.dataManager.updateStats = function() {
                console.log('🔗 检测到数据更新，同步更新卡片...');
                originalUpdateStats.call(this);
                setTimeout(forceUpdateAllCards, 100);
            };
        }

        // 监听自定义数据更新事件
        document.addEventListener('dataUpdated', (event) => {
            console.log('🔗 收到数据更新事件:', event.detail);
            setTimeout(forceUpdateAllCards, 50);
        });

        // 监听数据清空事件
        document.addEventListener('dataCleared', (event) => {
            console.log('🗑️ 收到数据清空事件，重置所有卡片...');
            resetAllCardsToZero();
        });

        // 监听页面可见性变化，确保数据同步
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('🔗 页面重新可见，刷新卡片数据...');
                setTimeout(forceUpdateAllCards, 200);
            }
        });
        
        console.log('✅ 卡片联动修复完成');

        // 显示成功通知
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification('✅ 卡片联动功能已修复', 'success');
        }
    }

    // 重置所有卡片为零
    function resetAllCardsToZero() {
        console.log('🔄 重置所有卡片为零...');

        const stats = {
            totalDemandMeters: 0,
            producedMeters: 0,
            pendingMeters: 0,
            shippedMeters: 0,
            unshippedMeters: 0,
            materialTons: 0,
            completionRate: 0,
            inventoryStatus: '正常'
        };

        // 更新卡片显示
        updateCardDisplays(stats);

        // 更新产量统计面板
        updateProductionStatsPanel([]);

        console.log('✅ 所有卡片已重置为零');
    }
    
    // 启动修复
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
    
})();
