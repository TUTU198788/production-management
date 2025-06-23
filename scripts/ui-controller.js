// UI控制器模块 - 专门处理用户界面交互
// 从 data-management.js 中提取的UI控制功能

class UIController {
    constructor(dataCore, productionManager, shippingManager) {
        this.dataCore = dataCore;
        this.productionManager = productionManager;
        this.shippingManager = shippingManager;
        
        // UI状态
        this.currentPage = 1;
        this.pageSize = 10;
        this.filteredData = [];
        this.selectedItems = new Set();
        this.sortField = '';
        this.sortDirection = 'asc';
        this.editingId = null;
        
        this.init();
        console.log('✅ UIController 初始化完成');
    }
    
    init() {
        this.setupEventListeners();
        this.updateDisplay();
    }
    
    // ==================== 事件监听器设置 ====================
    
    setupEventListeners() {
        // 搜索功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filterAndRenderTable();
            }, 300));
        }
        
        // 筛选器
        const statusFilter = document.getElementById('statusFilter');
        const areaFilter = document.getElementById('areaFilter');
        
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.filterAndRenderTable());
        }
        
        if (areaFilter) {
            areaFilter.addEventListener('change', () => this.filterAndRenderTable());
        }
        
        // 全选功能
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }
        
        // 分页按钮
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.previousPage());
        }
        
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.nextPage());
        }
        
        // 表格排序
        this.setupTableSorting();
        
        console.log('✅ UI事件监听器设置完成');
    }
    
    setupTableSorting() {
        const table = document.getElementById('productionTable');
        if (!table) return;
        
        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.getAttribute('data-sort');
                this.sortTable(field);
            });
            
            // 添加可点击样式
            header.style.cursor = 'pointer';
        });
    }
    
    // ==================== 数据显示和更新 ====================
    
    updateDisplay() {
        this.updateAreaFilter();
        this.filterAndRenderTable();
        this.updateStatistics();
    }
    
    // 更新区域筛选器
    updateAreaFilter() {
        const areaFilter = document.getElementById('areaFilter');
        if (!areaFilter) return;
        
        const areas = [...new Set(this.dataCore.data.map(item => item.area))].sort();
        
        // 清空现有选项（保留"全部区域"）
        while (areaFilter.children.length > 1) {
            areaFilter.removeChild(areaFilter.lastChild);
        }
        
        // 添加区域选项
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaFilter.appendChild(option);
        });
    }
    
    // 筛选和渲染表格
    filterAndRenderTable() {
        this.applyFilters();
        this.renderTable();
        this.updatePagination();
        this.updateTableInfo();
    }
    
    // 应用筛选条件
    applyFilters() {
        let filtered = [...this.dataCore.data];
        
        // 搜索筛选
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(item => 
                (item.spec || '').toLowerCase().includes(searchTerm) ||
                (item.area || '').toLowerCase().includes(searchTerm) ||
                (item.remarks || '').toLowerCase().includes(searchTerm)
            );
        }
        
        // 状态筛选
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        if (statusFilter) {
            filtered = filtered.filter(item => item.status === statusFilter);
        }
        
        // 区域筛选
        const areaFilter = document.getElementById('areaFilter')?.value || '';
        if (areaFilter) {
            filtered = filtered.filter(item => item.area === areaFilter);
        }
        
        this.filteredData = filtered;
    }
    
    // 渲染表格
    renderTable() {
        const tableBody = document.getElementById('tableBody');
        if (!tableBody) return;
        
        // 应用排序
        if (this.sortField) {
            this.filteredData.sort((a, b) => {
                let aVal = a[this.sortField] || '';
                let bVal = b[this.sortField] || '';
                
                // 数字类型排序
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
                }
                
                // 字符串排序
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
                
                if (this.sortDirection === 'asc') {
                    return aVal.localeCompare(bVal);
                } else {
                    return bVal.localeCompare(aVal);
                }
            });
        }
        
        // 分页
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        // 清空表格
        tableBody.innerHTML = '';
        
        // 渲染行
        pageData.forEach(item => {
            const row = this.createTableRow(item);
            tableBody.appendChild(row);
        });
        
        // 更新选中状态
        this.updateSelectAllState();
    }
    
    // 创建表格行
    createTableRow(item) {
        const row = document.createElement('tr');
        row.setAttribute('data-id', item.id);
        
        // 计算状态和进度
        const completionRate = item.planned > 0 ? (item.produced / item.planned * 100) : 0;
        const remainingQuantity = Math.max(0, (item.planned || 0) - (item.produced || 0));
        const availableToShip = Math.max(0, (item.produced || 0) - (item.shipped || 0));
        
        // 状态显示
        const statusMap = {
            'planned': { text: '计划中', class: 'status-planned' },
            'producing': { text: '生产中', class: 'status-producing' },
            'completed': { text: '已完成', class: 'status-completed' },
            'shipped': { text: '已发货', class: 'status-shipped' }
        };
        
        const statusInfo = statusMap[item.status] || { text: '未知', class: 'status-unknown' };
        
        row.innerHTML = `
            <td>
                <input type="checkbox" class="row-checkbox" data-id="${item.id}" 
                       ${this.selectedItems.has(item.id) ? 'checked' : ''}>
            </td>
            <td class="spec-cell">${item.spec || ''}</td>
            <td class="area-cell">${item.area || ''}</td>
            <td class="number-cell">${this.dataCore.formatNumber(item.planned || 0)}</td>
            <td class="number-cell">
                ${this.dataCore.formatNumber(item.produced || 0)}
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${completionRate}%"></div>
                </div>
            </td>
            <td class="number-cell">${this.dataCore.formatNumber(remainingQuantity)}</td>
            <td>
                <span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>
            </td>
            <td class="date-cell">${item.deadline || '-'}</td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="btn-small btn-primary" onclick="uiController.editRecord(${item.id})" title="编辑">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${availableToShip > 0 ? `
                        <button class="btn-small btn-success" onclick="uiController.shipRecord(${item.id})" title="发货">
                            <i class="fas fa-truck"></i>
                        </button>
                    ` : ''}
                    <button class="btn-small btn-danger" onclick="uiController.deleteRecord(${item.id})" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // 添加行点击事件
        const checkbox = row.querySelector('.row-checkbox');
        checkbox.addEventListener('change', (e) => {
            this.toggleRowSelection(item.id, e.target.checked);
        });
        
        return row;
    }
    
    // ==================== 表格操作 ====================
    
    // 排序表格
    sortTable(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        
        this.renderTable();
        this.updateSortIndicators();
    }
    
    // 更新排序指示器
    updateSortIndicators() {
        const headers = document.querySelectorAll('th[data-sort]');
        headers.forEach(header => {
            const icon = header.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-sort';
                
                if (header.getAttribute('data-sort') === this.sortField) {
                    icon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
                }
            }
        });
    }
    
    // ==================== 选择功能 ====================
    
    // 切换行选择
    toggleRowSelection(id, selected) {
        if (selected) {
            this.selectedItems.add(id);
        } else {
            this.selectedItems.delete(id);
        }
        
        this.updateSelectAllState();
        this.updateSelectedCount();
    }
    
    // 全选/取消全选
    toggleSelectAll(selectAll) {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        checkboxes.forEach(checkbox => {
            const id = parseInt(checkbox.getAttribute('data-id'));
            checkbox.checked = selectAll;
            
            if (selectAll) {
                this.selectedItems.add(id);
            } else {
                this.selectedItems.delete(id);
            }
        });
        
        this.updateSelectedCount();
    }
    
    // 更新全选状态
    updateSelectAllState() {
        const selectAllCheckbox = document.getElementById('selectAll');
        if (!selectAllCheckbox) return;
        
        const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
        const checkedCount = Array.from(visibleCheckboxes).filter(cb => cb.checked).length;
        
        if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCount === visibleCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    // 更新选中计数
    updateSelectedCount() {
        const selectedCountElement = document.getElementById('selectedCount');
        if (selectedCountElement) {
            selectedCountElement.textContent = this.selectedItems.size;
        }
    }
    
    // ==================== 分页功能 ====================
    
    // 上一页
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
            this.updatePagination();
        }
    }
    
    // 下一页
    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
            this.updatePagination();
        }
    }
    
    // 更新分页信息
    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        
        const currentPageElement = document.getElementById('currentPage');
        const totalPagesElement = document.getElementById('totalPages');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        
        if (currentPageElement) currentPageElement.textContent = this.currentPage;
        if (totalPagesElement) totalPagesElement.textContent = totalPages;
        
        if (prevPageBtn) prevPageBtn.disabled = this.currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = this.currentPage >= totalPages;
    }
    
    // 更新表格信息
    updateTableInfo() {
        const totalRecordsElement = document.getElementById('totalRecords');
        if (totalRecordsElement) {
            totalRecordsElement.textContent = this.filteredData.length;
        }
    }
    
    // ==================== 统计更新 ====================
    
    updateStatistics() {
        // 更新区域统计
        this.renderAreaStats();
        
        // 更新客户统计
        this.renderCustomerStats();
        
        // 更新未生产规格统计
        this.renderUnproducedStats();
    }
    
    renderAreaStats() {
        const container = document.getElementById('areaCardsContainer');
        if (!container) return;
        
        const areaStats = this.productionManager.getAreaProductionStats();
        
        container.innerHTML = '';
        
        areaStats.forEach(stats => {
            const card = this.createAreaStatsCard(stats);
            container.appendChild(card);
        });
    }
    
    createAreaStatsCard(stats) {
        const card = document.createElement('div');
        card.className = 'area-card';
        card.innerHTML = `
            <div class="area-header">
                <h4>${stats.area}</h4>
                <span class="completion-rate">${stats.completionRate.toFixed(1)}%</span>
            </div>
            <div class="area-stats">
                <div class="stat-item">
                    <span class="stat-label">计划:</span>
                    <span class="stat-value">${this.dataCore.formatNumber(stats.totalPlanned)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已产:</span>
                    <span class="stat-value">${this.dataCore.formatNumber(stats.totalProduced)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">已发:</span>
                    <span class="stat-value">${this.dataCore.formatNumber(stats.totalShipped)}</span>
                </div>
            </div>
        `;
        
        return card;
    }
    
    renderCustomerStats() {
        // 客户统计渲染逻辑
        console.log('渲染客户统计');
    }
    
    renderUnproducedStats() {
        // 未生产规格统计渲染逻辑
        console.log('渲染未生产规格统计');
    }
    
    // ==================== 工具方法 ====================
    
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
    
    // 显示通知
    showNotification(message, type = 'info') {
        if (window.dashboard && window.dashboard.showNotification) {
            window.dashboard.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // ==================== 记录操作 ====================
    
    editRecord(id) {
        console.log(`编辑记录: ${id}`);
        // 编辑逻辑
    }
    
    shipRecord(id) {
        console.log(`发货记录: ${id}`);
        // 发货逻辑
    }
    
    deleteRecord(id) {
        if (confirm('确定要删除这条记录吗？')) {
            try {
                this.dataCore.deleteProductionRecord(id);
                this.updateDisplay();
                this.showNotification('记录删除成功', 'success');
            } catch (error) {
                this.showNotification(`删除失败: ${error.message}`, 'error');
            }
        }
    }
}

// 导出模块
if (typeof window !== 'undefined') {
    window.UIController = UIController;
}
