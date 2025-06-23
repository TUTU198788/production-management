// 全新的已发货量卡片管理器
// 专门负责已发货量卡片的数据获取、显示和交互

class ShippedCardManager {
    constructor() {
        this.cardElement = null;
        this.metersDisplay = null;
        this.customersDisplay = null;
        this.viewButton = null;
        this.updateInterval = null;
        
        this.init();
    }
    
    init() {
        console.log('🚚 初始化已发货量卡片管理器...');
        
        // 获取DOM元素
        this.cardElement = document.getElementById('shippedCard');
        this.metersDisplay = document.getElementById('shippedMetersDisplay');
        this.customersDisplay = document.getElementById('shippedCustomersDisplay');
        
        if (!this.cardElement) {
            console.error('❌ 未找到已发货量卡片元素');
            return;
        }
        
        // 绑定事件
        this.bindEvents();
        
        // 立即更新一次
        this.updateDisplay();
        
        // 设置定时更新
        this.startAutoUpdate();
        
        console.log('✅ 已发货量卡片管理器初始化完成');
    }
    
    bindEvents() {
        // 卡片点击事件
        if (this.cardElement) {
            this.cardElement.addEventListener('click', (e) => {
                this.showShippingDetails();
            });
        }
    }
    
    // 获取发货数据
    getShippingData() {
        let shippedMeters = 0;
        let customerCount = 0;
        let dataSource = '';
        
        try {
            // 方法1：从客户统计获取
            if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
                const customerStats = window.dataManager.calculateCustomerStats();
                const customersWithShipping = customerStats.filter(c => c.totalMeters > 0);
                
                shippedMeters = customerStats.reduce((sum, customer) => {
                    return sum + (customer.totalMeters || 0);
                }, 0);
                
                customerCount = customersWithShipping.length;
                dataSource = '客户统计';
                
                console.log(`📦 从客户统计获取: ${shippedMeters.toFixed(1)}米, ${customerCount}个客户`);
            }
            
            // 方法2：从发货历史获取（备用）
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
            
            // 方法3：从生产数据的shipped字段获取（最后备用）
            if (shippedMeters === 0 && window.dataManager?.data) {
                shippedMeters = window.dataManager.data.reduce((sum, item) => {
                    const shipped = item.shipped || 0;
                    if (shipped > 0) {
                        const length = this.extractLengthFromSpec(item.spec);
                        return sum + (shipped * length / 1000);
                    }
                    return sum;
                }, 0);
                
                if (shippedMeters > 0) {
                    dataSource = '生产数据';
                    console.log(`📦 从生产数据获取: ${shippedMeters.toFixed(1)}米`);
                }
            }
            
        } catch (error) {
            console.error('❌ 获取发货数据失败:', error);
        }
        
        return {
            shippedMeters,
            customerCount,
            dataSource
        };
    }
    
    // 提取规格长度的辅助方法
    extractLengthFromSpec(spec) {
        if (!spec) return 6000;
        
        const patterns = [
            /L=(\d+)/,           // L=6000
            /长度[：:]\s*(\d+)/,   // 长度：6000
            /(\d+)mm/i,          // 6000mm
            /(\d+)MM/,           // 6000MM
            /L(\d+)/,            // L6000
            /-(\d+)$/,           // 规格-6000
            /×(\d+)/,            // 规格×6000
            /\*(\d+)/,           // 规格*6000
            /(\d{4,})/           // 直接的4位以上数字
        ];
        
        for (const pattern of patterns) {
            const match = spec.match(pattern);
            if (match) {
                const length = parseInt(match[1]);
                if (length >= 1000 && length <= 20000) {
                    return length;
                }
            }
        }
        
        return 6000; // 默认长度
    }
    
    // 更新显示
    updateDisplay() {
        console.log('🔄 更新已发货量卡片显示...');
        
        const data = this.getShippingData();
        
        // 更新发货量显示
        if (this.metersDisplay) {
            if (data.shippedMeters > 0) {
                this.animateNumber(this.metersDisplay, data.shippedMeters, 1);
            } else {
                this.metersDisplay.textContent = '0.0';
            }
        }
        
        // 更新客户数量显示
        if (this.customersDisplay) {
            this.customersDisplay.textContent = data.customerCount;
        }
        
        // 更新卡片状态
        if (this.cardElement) {
            if (data.shippedMeters > 0) {
                this.cardElement.classList.remove('no-data');
                this.cardElement.title = `点击查看发货明细 (数据来源: ${data.dataSource})`;
            } else {
                this.cardElement.classList.add('no-data');
                this.cardElement.title = '暂无发货数据';
            }
        }
        
        console.log(`✅ 卡片更新完成: ${data.shippedMeters.toFixed(1)}米, ${data.customerCount}个客户 (${data.dataSource})`);
        
        return data;
    }
    
    // 数字动画效果
    animateNumber(element, targetValue, decimals = 0) {
        const startValue = parseFloat(element.textContent.replace(/[^\d.-]/g, '')) || 0;
        const duration = 1000; // 1秒动画
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用缓动函数
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = startValue + (targetValue - startValue) * easeOutQuart;
            
            element.textContent = currentValue.toFixed(decimals);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // 显示发货明细
    showShippingDetails() {
        console.log('📊 显示发货明细...');
        
        // 检查是否有数据
        const data = this.getShippingData();
        if (data.shippedMeters === 0) {
            this.showNotification('暂无发货数据', 'info');
            return;
        }
        
        // 调用Dashboard的发货明细模态框
        if (window.dashboard && typeof window.dashboard.openShippingDetailsModal === 'function') {
            window.dashboard.openShippingDetailsModal();
        } else {
            // 创建简单的发货明细显示
            this.createSimpleShippingModal(data);
        }
    }
    
    // 创建简单的发货明细模态框
    createSimpleShippingModal(data) {
        // 移除已存在的模态框
        const existingModal = document.getElementById('simpleShippingModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 获取客户统计数据
        let customersList = '';
        if (window.dataManager && typeof window.dataManager.calculateCustomerStats === 'function') {
            try {
                const customerStats = window.dataManager.calculateCustomerStats();
                const customersWithShipping = customerStats.filter(c => c.totalMeters > 0);
                
                customersList = customersWithShipping.map((customer, index) => `
                    <div class="customer-item">
                        <span class="customer-rank">${index + 1}</span>
                        <span class="customer-name">${customer.customerName}</span>
                        <span class="customer-meters">${customer.totalMeters.toFixed(1)}米</span>
                    </div>
                `).join('');
            } catch (error) {
                customersList = '<div class="error-message">无法获取客户数据</div>';
            }
        }
        
        const modalHTML = `
            <div class="modal-overlay" id="simpleShippingModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>发货明细</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="shipping-summary">
                            <div class="summary-item">
                                <span class="label">总发货量:</span>
                                <span class="value">${data.shippedMeters.toFixed(1)} 米</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">客户数量:</span>
                                <span class="value">${data.customerCount} 家</span>
                            </div>
                        </div>
                        <div class="customers-list">
                            <h4>客户发货明细</h4>
                            ${customersList}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加样式和HTML
        const style = document.createElement('style');
        style.textContent = `
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .modal-content {
                background: white;
                border-radius: 8px;
                padding: 20px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                border-bottom: 1px solid #eee;
                padding-bottom: 10px;
            }
            .modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
            }
            .shipping-summary {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
            }
            .summary-item {
                flex: 1;
                text-align: center;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 6px;
            }
            .summary-item .label {
                display: block;
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
            }
            .summary-item .value {
                font-size: 18px;
                font-weight: bold;
                color: #333;
            }
            .customers-list h4 {
                margin-bottom: 15px;
                color: #333;
            }
            .customer-item {
                display: flex;
                align-items: center;
                padding: 10px;
                border-bottom: 1px solid #eee;
            }
            .customer-rank {
                width: 30px;
                height: 30px;
                background: #3b82f6;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                margin-right: 15px;
            }
            .customer-name {
                flex: 1;
                font-weight: 500;
            }
            .customer-meters {
                font-weight: bold;
                color: #3b82f6;
            }
        `;
        
        document.head.appendChild(style);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 绑定关闭事件
        const modal = document.getElementById('simpleShippingModal');
        const closeBtn = modal.querySelector('.modal-close');
        
        const closeModal = () => {
            modal.remove();
            style.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 简单的通知实现
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'info' ? '#3b82f6' : '#ef4444'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // 开始自动更新
    startAutoUpdate() {
        // 每30秒更新一次
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 30000);
    }
    
    // 停止自动更新
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    // 强制更新
    forceUpdate() {
        console.log('🔄 强制更新已发货量卡片...');
        return this.updateDisplay();
    }
}

// 全局实例
window.shippedCardManager = null;

// 初始化函数
function initShippedCard() {
    if (!window.shippedCardManager) {
        window.shippedCardManager = new ShippedCardManager();
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShippedCard);
} else {
    initShippedCard();
}

// 导出到全局
window.ShippedCardManager = ShippedCardManager;
window.initShippedCard = initShippedCard;
