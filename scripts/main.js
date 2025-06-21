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
        this.updateMetricsFromDataManager();
        this.updateLastUpdateTime();
        this.startAutoRefresh();

        // 延迟加载图表，确保DOM完全加载
        setTimeout(() => {
            this.initializeCharts();
        }, 100);
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
                }
            }

            console.log('dataManager.data 前5条:');
            data.slice(0, 5).forEach((item, index) => {
                console.log(`第${index + 1}条:`, item);
            });

            console.log('=== 开始计算 ===');
            let totalCheck = 0;

            // 计算总米数（根数 × 长度）
            this.data.totalDemandMeters = data.reduce((sum, item, index) => {
                const length = this.extractLengthFromSpec(item.spec); // 提取长度（mm）
                const meters = item.planned * length / 1000; // 转换为米
                totalCheck += meters;

                console.log(`第${index + 1}条: ${item.spec} (${item.area})`);
                console.log(`  计算: ${item.planned}根 × ${length}mm ÷ 1000 = ${meters.toFixed(1)}米`);
                console.log(`  累计: ${totalCheck.toFixed(1)}米`);

                return sum + meters;
            }, 0);

            console.log(`最终总需求量: ${this.data.totalDemandMeters.toFixed(1)}米`);
            console.log(`验证计算: ${totalCheck.toFixed(1)}米`);

            this.data.producedMeters = data.reduce((sum, item) => {
                const length = this.extractLengthFromSpec(item.spec);
                const meters = item.produced * length / 1000;
                if (item.produced > 0) {
                    console.log(`已生产 ${item.spec}: ${item.produced}根 × ${length}mm = ${meters.toFixed(1)}米`);
                }
                return sum + meters;
            }, 0);

            // 计算已发货量（米）
            this.data.shippedMeters = data.reduce((sum, item) => {
                const length = this.extractLengthFromSpec(item.spec);
                const meters = (item.shipped || 0) * length / 1000;
                if ((item.shipped || 0) > 0) {
                    console.log(`已发货 ${item.spec}: ${item.shipped}根 × ${length}mm = ${meters.toFixed(1)}米`);
                }
                return sum + meters;
            }, 0);

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
            this.data.completionRate = this.data.totalDemand > 0 ?
                ((this.data.produced / this.data.totalDemand) * 100).toFixed(1) : 0;

            // 计算生产效率（根/天）
            this.data.efficiency = this.calculateProductionEfficiency(data);

            console.log('计算结果汇总:');
            console.log('总需求量:', this.data.totalDemandMeters.toFixed(1), '米');
            console.log('已生产量:', this.data.producedMeters.toFixed(1), '米');
            console.log('待生产量:', this.data.pendingMeters.toFixed(1), '米');
            console.log('已发货量:', this.data.shippedMeters.toFixed(1), '米');
            console.log('未发货量:', this.data.unshippedMeters.toFixed(1), '米');
        }

        this.updateMetrics();
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

    // 从规格型号中提取长度（mm）
    extractLengthFromSpec(spec) {
        if (!spec) return 0;
        const match = spec.match(/(\d+)mm/);
        return match ? parseInt(match[1]) : 0;
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
        
        // 筛选器事件
        this.setupFilters();
        
        // 图表操作按钮
        this.setupChartActions();
        
        // 窗口大小变化时重新调整图表
        window.addEventListener('resize', this.debounce(() => {
            this.resizeCharts();
        }, 300));
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
    
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
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
