// 测试简化的发货明细模态框
// 在浏览器控制台中运行此脚本

console.log('🧪 测试简化的发货明细模态框...');

// 1. 模拟客户发货数据
const mockCustomerStats = {
    customers: [
        { name: '客户A', totalMeters: 800.5, percentage: 40.0 },
        { name: '客户B', totalMeters: 600.2, percentage: 30.0 },
        { name: '客户C', totalMeters: 400.8, percentage: 20.0 },
        { name: '客户D', totalMeters: 200.5, percentage: 10.0 }
    ],
    totalMeters: 2002.0
};

// 2. 创建简化的模态框HTML
function createSimpleShippingModal(stats) {
    // 移除已存在的模态框
    const existingModal = document.getElementById('testShippingModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal" id="testShippingModal" style="
            display: flex;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
        ">
            <div class="modal-content" style="
                background-color: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-height: 90vh;
                overflow-y: auto;
                width: 90%;
                max-width: 600px;
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    border-radius: 12px 12px 0 0;
                ">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                        <i class="fas fa-truck" style="margin-right: 8px;"></i>
                        客户发货明细
                    </h3>
                    <button class="modal-close" id="closeTestModal" style="
                        background: none;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 4px;
                    ">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <!-- 简洁的总体统计 -->
                    <div class="shipping-summary-simple" style="
                        display: flex;
                        justify-content: space-around;
                        background: #f8f9fa;
                        padding: 16px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    ">
                        <div class="summary-item" style="text-align: center;">
                            <span class="label" style="
                                font-size: 14px;
                                color: #666;
                                display: block;
                                margin-bottom: 5px;
                            ">总发货量:</span>
                            <span class="value" style="
                                font-size: 18px;
                                font-weight: bold;
                                color: #333;
                            ">${stats.totalMeters.toFixed(1)} 米</span>
                        </div>
                        <div class="summary-item" style="text-align: center;">
                            <span class="label" style="
                                font-size: 14px;
                                color: #666;
                                display: block;
                                margin-bottom: 5px;
                            ">客户数量:</span>
                            <span class="value" style="
                                font-size: 18px;
                                font-weight: bold;
                                color: #333;
                            ">${stats.customers.length} 家</span>
                        </div>
                    </div>
                    
                    <!-- 客户发货明细表格 -->
                    <div class="customer-details">
                        <div class="table-container" style="
                            border: 1px solid #e5e7eb;
                            border-radius: 8px;
                            overflow: hidden;
                            max-height: 400px;
                            overflow-y: auto;
                        ">
                            <table class="customer-table" style="
                                width: 100%;
                                border-collapse: collapse;
                                font-size: 14px;
                            ">
                                <thead>
                                    <tr>
                                        <th style="
                                            background: #f8fafc;
                                            padding: 12px;
                                            text-align: left;
                                            font-weight: 600;
                                            border-bottom: 2px solid #e5e7eb;
                                        ">排名</th>
                                        <th style="
                                            background: #f8fafc;
                                            padding: 12px;
                                            text-align: left;
                                            font-weight: 600;
                                            border-bottom: 2px solid #e5e7eb;
                                        ">客户名称</th>
                                        <th style="
                                            background: #f8fafc;
                                            padding: 12px;
                                            text-align: left;
                                            font-weight: 600;
                                            border-bottom: 2px solid #e5e7eb;
                                        ">发货量(米)</th>
                                        <th style="
                                            background: #f8fafc;
                                            padding: 12px;
                                            text-align: left;
                                            font-weight: 600;
                                            border-bottom: 2px solid #e5e7eb;
                                        ">占比</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${generateCustomerRows(stats.customers)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    border-top: 1px solid #e5e7eb;
                    background: #f9fafb;
                    border-radius: 0 0 12px 12px;
                ">
                    <button type="button" class="btn btn-secondary" id="exportTestDetails" style="
                        background: #6b7280;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        <i class="fas fa-download"></i>
                        导出明细
                    </button>
                    <button type="button" class="btn btn-primary" id="closeTestModalBtn" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定事件
    bindTestModalEvents();
    
    console.log('✅ 简化模态框创建完成');
}

// 3. 生成客户表格行
function generateCustomerRows(customers) {
    return customers.map((customer, index) => {
        const rank = index + 1;
        const rankColors = {
            1: { bg: '#ffd700', color: '#333' },
            2: { bg: '#c0c0c0', color: '#333' },
            3: { bg: '#cd7f32', color: 'white' },
            default: { bg: '#6b7280', color: 'white' }
        };
        
        const rankStyle = rankColors[rank] || rankColors.default;
        
        return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px;">
                    <span style="
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        font-weight: bold;
                        font-size: 12px;
                        background: ${rankStyle.bg};
                        color: ${rankStyle.color};
                    ">${rank}</span>
                </td>
                <td style="padding: 12px;">
                    <strong>${customer.name}</strong>
                </td>
                <td style="padding: 12px;">
                    <strong>${customer.totalMeters.toFixed(1)}</strong> 米
                </td>
                <td style="padding: 12px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="
                            width: 60px;
                            height: 6px;
                            background: #e5e7eb;
                            border-radius: 3px;
                            overflow: hidden;
                        ">
                            <div style="
                                height: 100%;
                                background: #3b82f6;
                                border-radius: 3px;
                                width: ${customer.percentage}%;
                            "></div>
                        </div>
                        <span>${customer.percentage.toFixed(1)}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 4. 绑定事件
function bindTestModalEvents() {
    const closeBtn = document.getElementById('closeTestModal');
    const closeBtn2 = document.getElementById('closeTestModalBtn');
    const exportBtn = document.getElementById('exportTestDetails');
    
    const closeModal = () => {
        const modal = document.getElementById('testShippingModal');
        if (modal) modal.remove();
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            console.log('📥 导出功能测试');
            alert('导出功能正常！');
        });
    }
    
    // 点击背景关闭
    const modal = document.getElementById('testShippingModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
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

// 5. 执行测试
console.log('🚀 创建简化的发货明细模态框...');
createSimpleShippingModal(mockCustomerStats);

console.log('');
console.log('✅ 测试完成！');
console.log('📊 新界面特点:');
console.log('  - 简洁的总体统计');
console.log('  - 客户发货排行榜');
console.log('  - 清晰的占比显示');
console.log('  - 响应式设计');
console.log('');
console.log('💡 界面已显示，请查看效果！');
