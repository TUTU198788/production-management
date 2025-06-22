// 数据管理系统 - 生产数量管理和发货功能

class DataManager {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.selectedItems = new Set();
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortField = '';
        this.sortDirection = 'asc';
        this.editingId = null;
        this.operationLogs = [];
        this.materialPurchases = []; // 原材料采购记录
        this.customAreas = new Set(['C1', 'C2', 'C3', 'E1', 'E3', 'D6', 'A14']); // 默认区域
        this.isMaterialHistoryMode = false;
        this.excelImportData = null; // Excel导入的原始数据

        // 发货历史管理
        this.shippingHistory = [];
        this.currentShippingRecord = null;
        this.isShippingEditMode = false;

        // 发货购物车
        this.shippingCart = [];

        // 批次发货需求相关
        this.shippingPlans = [];
        this.currentPlanCustomer = null;

        console.log('DataManager 构造函数开始');
        this.init();

        // 启动时清理测试数据
        this.cleanTestData();

        // 迁移现有发货数据到历史记录
        this.migrateShippingData();

        // 初始化完成后立即更新仪表板
        setTimeout(() => {
            console.log('DataManager 初始化完成，更新仪表板');
            this.updateStats();
        }, 200);

        console.log('DataManager 构造函数完成');

        // 设置Firebase同步状态模态框事件监听器
        this.setupFirebaseSyncListeners();
    }

    // 迁移现有发货数据到历史记录
    migrateShippingData(force = false) {
        console.log('开始迁移发货数据到历史记录...');

        // 如果已经有历史记录且不是强制迁移，跳过迁移
        if (this.shippingHistory.length > 0 && !force) {
            console.log('已存在发货历史记录，跳过迁移');
            return;
        }

        // 收集所有发货记录，按发货单分组
        const shippingGroups = new Map();

        console.log('检查数据中的发货记录...');
        console.log('总数据条数:', this.data.length);

        let totalShippingRecords = 0;
        this.data.forEach(item => {
            if (item.shippingRecords && item.shippingRecords.length > 0) {
                totalShippingRecords += item.shippingRecords.length;
                console.log(`项目 ${item.spec} (${item.area}) 有 ${item.shippingRecords.length} 条发货记录`);
            }
        });

        console.log('发现的发货记录总数:', totalShippingRecords);

        this.data.forEach(item => {
            if (item.shippingRecords && item.shippingRecords.length > 0) {
                item.shippingRecords.forEach(record => {
                    // 兼容旧的字段名（customer）和新的字段名（customerName）
                    const customerName = record.customerName || record.customer || '未知客户';

                    // 生成分组键（基于日期、客户、运输公司等）
                    const groupKey = `${record.date}-${customerName}-${record.company || ''}-${record.trackingNumber || ''}`;

                    if (!shippingGroups.has(groupKey)) {
                        shippingGroups.set(groupKey, {
                            id: Date.now() + Math.random(),
                            documentNumber: this.generateDocumentNumber(),
                            date: record.date,
                            customerName: customerName,
                            company: record.company || '',
                            trackingNumber: record.trackingNumber || '',
                            deliveryAddress: record.deliveryAddress || '',
                            remarks: record.remarks || '',
                            items: [],
                            totalQuantity: 0,
                            totalWeight: 0,
                            totalMeters: 0,
                            timestamp: record.timestamp || new Date().toISOString()
                        });
                    }

                    const group = shippingGroups.get(groupKey);
                    const meters = this.calculateMeters(item.spec, record.quantity);
                    const weight = this.calculateWeight(item.spec, record.quantity);

                    group.items.push({
                        spec: item.spec,
                        quantity: record.quantity,
                        weight: weight,
                        meters: meters
                    });

                    group.totalQuantity += record.quantity;
                    group.totalWeight += weight;
                    group.totalMeters += meters;
                });
            }
        });

        // 将分组的发货记录添加到历史记录
        const migratedRecords = Array.from(shippingGroups.values());

        if (force) {
            // 强制迁移时，清空现有历史记录
            this.shippingHistory = migratedRecords;
        } else {
            // 正常迁移时，只添加新记录
            this.shippingHistory.push(...migratedRecords);
        }

        if (migratedRecords.length > 0) {
            console.log(`成功迁移 ${migratedRecords.length} 条发货历史记录`);
            this.saveToLocalStorage();

            // 记录迁移日志
            this.addLog('system', '数据迁移',
                `${force ? '强制' : '自动'}迁移了 ${migratedRecords.length} 条发货历史记录`,
                {
                    migratedCount: migratedRecords.length,
                    totalItems: migratedRecords.reduce((sum, record) => sum + record.items.length, 0),
                    isForced: force
                });
        } else {
            console.log('没有发现需要迁移的发货数据');
        }
    }

    // 清理测试数据
    cleanTestData() {
        const originalLength = this.data.length;

        // 移除包含测试关键词的数据
        this.data = this.data.filter(item => {
            const isTestData = (
                (item.remarks && item.remarks.includes('测试')) ||
                (item.spec && item.spec.includes('测试')) ||
                (item.area && item.area.includes('测试')) ||
                (item.remarks && item.remarks.includes('测试导入数据'))
            );

            if (isTestData) {
                console.log('清理测试数据:', item);
            }

            return !isTestData;
        });

        this.filteredData = [...this.data];

        if (originalLength !== this.data.length) {
            console.log(`清理了 ${originalLength - this.data.length} 条测试数据`);
            this.saveToLocalStorage();
        }
    }
    
    init() {
        // 从本地存储加载数据
        this.loadFromLocalStorage();
        this.loadCustomAreas();

        // 系统启动时为空白状态，等待用户导入数据

        this.setupEventListeners();
        this.updateAreaOptions();
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();
        this.renderUnproducedStats();

        // 初始化产量统计
        this.updateProductionStats();
    }


    
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('productionData');
            const savedLogs = localStorage.getItem('operationLogs');
            const savedMaterials = localStorage.getItem('materialPurchases');
            const savedShippingHistory = localStorage.getItem('shippingHistory');

            if (savedData) {
                this.data = JSON.parse(savedData);
                this.filteredData = [...this.data];
            } else {
                this.data = [];
                this.filteredData = [];
            }

            if (savedLogs) {
                this.operationLogs = JSON.parse(savedLogs);
            } else {
                this.operationLogs = [];
            }

            if (savedMaterials) {
                this.materialPurchases = JSON.parse(savedMaterials);
            } else {
                this.materialPurchases = [];
            }

            if (savedShippingHistory) {
                this.shippingHistory = JSON.parse(savedShippingHistory);
            } else {
                this.shippingHistory = [];
            }

            console.log(`从本地存储加载了 ${this.data.length} 条生产数据、${this.operationLogs.length} 条操作日志、${this.materialPurchases.length} 条原材料采购记录和 ${this.shippingHistory.length} 条发货历史记录`);

            // 如果有数据，立即通知主界面更新
            if (this.data.length > 0) {
                console.log('✅ 检测到生产数据，立即通知主界面更新');
                setTimeout(() => {
                    this.forceUpdateDashboard();
                }, 100);
            }
        } catch (error) {
            console.error('加载本地存储数据失败:', error);
            this.data = [];
            this.filteredData = [];
            this.operationLogs = [];
            this.materialPurchases = [];
        }
    }
    
    setupEventListeners() {
        // 新增计划按钮
        document.getElementById('addPlanBtn').addEventListener('click', () => {
            this.openPlanModal();
        });

        // 新增生产按钮
        document.getElementById('addProductionBtn').addEventListener('click', () => {
            this.openProductionModal();
        });

        // 批量发货按钮
        document.getElementById('batchShippingBtn').addEventListener('click', () => {
            this.openShippingModal(); // 不传ID，进入批量发货模式
        });

        // 发货历史按钮
        document.getElementById('shippingHistoryBtn').addEventListener('click', () => {
            this.openShippingHistoryModal();
        });

        // 原材料卡片点击事件（已在后面绑定，删除重复）
        // const materialCard = document.getElementById('materialCard');
        // if (materialCard) {
        //     materialCard.addEventListener('click', () => {
        //         this.openMaterialModal();
        //     });
        // }

        // 批量编辑按钮
        document.getElementById('batchEditBtn').addEventListener('click', () => {
            if (this.selectedItems.size === 0) {
                this.showNotification('请先选择要操作的项目', 'warning');
                return;
            }
            this.openBatchModal();
        });
        
        // 导出数据按钮
        document.getElementById('exportDataBtn').addEventListener('click', () => {
            this.exportData();
        });
        
        // 导入JSON数据按钮
        document.getElementById('importDataBtn').addEventListener('click', () => {
            this.importData();
        });

        // 导入Excel数据按钮
        const importExcelBtn = document.getElementById('importExcelBtn');
        if (importExcelBtn) {
            console.log('Excel导入按钮找到，绑定事件');
            importExcelBtn.addEventListener('click', () => {
                console.log('Excel导入按钮被点击');
                this.openExcelImportModal();
            });
        } else {
            console.error('找不到Excel导入按钮');
        }

        // 查看日志按钮
        document.getElementById('viewLogsBtn').addEventListener('click', () => {
            this.openLogsModal();
        });

        // 清空所有数据按钮
        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            this.clearAllData();
        });

        // Firebase同步状态按钮
        document.getElementById('cloudSyncBtn').addEventListener('click', () => {
            this.showFirebaseSyncStatus();
        });
        
        // 搜索框
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.search(e.target.value);
        });
        
        // 筛选器
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.applyFilters();
        });
        
        document.getElementById('areaFilter').addEventListener('change', () => {
            this.applyFilters();
        });
        
        // 全选复选框
        document.getElementById('selectAll').addEventListener('change', (e) => {
            this.selectAll(e.target.checked);
        });
        
        // 分页按钮
        document.getElementById('prevPage').addEventListener('click', () => {
            this.previousPage();
        });
        
        document.getElementById('nextPage').addEventListener('click', () => {
            this.nextPage();
        });
        
        // 模态框事件
        this.setupModalEvents();

        // 规格型号联动
        this.setupSpecSelection();
        this.setupPlanSpecSelection();

        // 区域管理
        this.setupAreaManagement();

        // 区域统计刷新按钮
        const refreshAreasBtn = document.getElementById('refreshAreasBtn');
        if (refreshAreasBtn) {
            refreshAreasBtn.addEventListener('click', () => {
                this.renderAreaStats();
            });
        }

        // 未生产规格统计刷新按钮
        const refreshUnproducedStatsBtn = document.getElementById('refreshUnproducedStatsBtn');
        if (refreshUnproducedStatsBtn) {
            refreshUnproducedStatsBtn.addEventListener('click', () => {
                this.renderUnproducedStats();
                this.showNotification('未生产规格统计已刷新', 'success');
            });
        }

        // 客户发货统计刷新按钮
        const refreshCustomerStatsBtn = document.getElementById('refreshCustomerStats');
        if (refreshCustomerStatsBtn) {
            refreshCustomerStatsBtn.addEventListener('click', () => {
                this.renderCustomerStats();
                this.showNotification('客户发货统计已刷新', 'success');
            });
        }

        // 产量统计刷新按钮
        const refreshProductionStatsBtn = document.getElementById('refreshProductionStats');
        if (refreshProductionStatsBtn) {
            refreshProductionStatsBtn.addEventListener('click', () => {
                this.updateProductionStats();
                this.showNotification('产量统计已刷新', 'success');
            });
        }

        // 新增客户卡片按钮
        const addCustomerCardBtn = document.getElementById('addCustomerCardBtn');
        if (addCustomerCardBtn) {
            addCustomerCardBtn.addEventListener('click', () => {
                this.openAddCustomerCardModal();
            });
        }

        // 新增客户卡片模态框事件
        this.setupAddCustomerCardModal();
    }
    
    setupModalEvents() {
        // 计划模态框
        const closePlanModal = document.getElementById('closePlanModal');
        if (closePlanModal) {
            closePlanModal.addEventListener('click', () => {
                this.closePlanModal();
            });
        }

        const cancelPlanBtn = document.getElementById('cancelPlanBtn');
        if (cancelPlanBtn) {
            cancelPlanBtn.addEventListener('click', () => {
                this.closePlanModal();
            });
        }

        const planForm = document.getElementById('planForm');
        if (planForm) {
            planForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePlanData();
            });
        }

        // 生产数据模态框
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeProductionModal();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeProductionModal();
            });
        }

        const productionForm = document.getElementById('productionForm');
        if (productionForm) {
            productionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProductionData();
            });
        }

        // 保存按钮点击事件（始终用于批量模式）
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveProductionData();
            });
        }

        // 批量模式切换按钮已移除，不再需要事件监听器

        // 批量添加行按钮
        const addBatchRow = document.getElementById('addBatchRow');
        if (addBatchRow) {
            addBatchRow.addEventListener('click', () => {
                this.addBatchRow();
            });
        }
        
        // 发货模态框
        const closeShippingModal = document.getElementById('closeShippingModal');
        if (closeShippingModal) {
            closeShippingModal.addEventListener('click', () => {
                this.closeShippingModal();
            });
        }

        const cancelShippingBtn = document.getElementById('cancelShippingBtn');
        if (cancelShippingBtn) {
            cancelShippingBtn.addEventListener('click', () => {
                this.closeShippingModal();
            });
        }

        const shippingForm = document.getElementById('shippingForm');
        if (shippingForm) {
            shippingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processShipping();
            });
        }

        // 批量发货模式切换按钮已移除（只保留批量发货）

        // 确认批量发货按钮
        const confirmShippingBtn = document.getElementById('confirmShippingBtn');
        if (confirmShippingBtn) {
            console.log('批量发货按钮找到，绑定事件');
            confirmShippingBtn.addEventListener('click', () => {
                console.log('批量发货按钮被点击');
                this.processBatchShipping();
            });
        } else {
            console.error('找不到批量发货按钮');
        }

        // 加载可发货项目
        const loadAvailableItems = document.getElementById('loadAvailableItems');
        if (loadAvailableItems) {
            loadAvailableItems.addEventListener('click', () => {
                this.loadAvailableShippingItems();
            });
        }

        // 清空发货购物车按钮（使用内联onclick，无需额外绑定）

        // 搜索功能
        const specSearchInput = document.getElementById('specSearchInput');
        if (specSearchInput) {
            // 实时搜索
            specSearchInput.addEventListener('input', () => {
                this.filterShippingItems();
            });

            // 回车键搜索
            specSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.loadAvailableShippingItems();
                }
            });
        }

        // 清空搜索
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('specSearchInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.filterShippingItems();
                }
            });
        }

        // 全选发货项目
        const selectAllShipping = document.getElementById('selectAllShipping');
        if (selectAllShipping) {
            selectAllShipping.addEventListener('change', (e) => {
                this.selectAllShippingItems(e.target.checked);
            });
        }

        // 预览发货单
        const previewShippingBtn = document.getElementById('previewShippingBtn');
        if (previewShippingBtn) {
            previewShippingBtn.addEventListener('click', () => {
                this.previewShippingDocument();
            });
        }

        // 导出发货单
        const exportShippingBtn = document.getElementById('exportShippingBtn');
        if (exportShippingBtn) {
            exportShippingBtn.addEventListener('click', () => {
                this.exportShippingDocument();
            });
        }

        // 原材料采购模态框
        const closeMaterialModal = document.getElementById('closeMaterialModal');
        if (closeMaterialModal) {
            closeMaterialModal.addEventListener('click', () => {
                this.closeMaterialModal();
            });
        }

        const cancelMaterialBtn = document.getElementById('cancelMaterialBtn');
        if (cancelMaterialBtn) {
            cancelMaterialBtn.addEventListener('click', () => {
                this.closeMaterialModal();
            });
        }

        const materialForm = document.getElementById('materialForm');
        if (materialForm) {
            materialForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveMaterialPurchase();
            });
        }

        // 原材料模式切换
        const toggleMaterialMode = document.getElementById('toggleMaterialMode');
        if (toggleMaterialMode) {
            toggleMaterialMode.addEventListener('click', () => {
                this.toggleMaterialMode();
            });
        }

        // 筛选历史记录
        const filterMaterialHistory = document.getElementById('filterMaterialHistory');
        if (filterMaterialHistory) {
            filterMaterialHistory.addEventListener('click', () => {
                this.filterMaterialHistory();
            });
        }

        // 导出原材料记录
        const exportMaterialBtn = document.getElementById('exportMaterialBtn');
        if (exportMaterialBtn) {
            exportMaterialBtn.addEventListener('click', () => {
                this.exportMaterialHistory();
            });
        }

        // 发货历史模态框事件
        const closeShippingHistoryModal = document.getElementById('closeShippingHistoryModal');
        if (closeShippingHistoryModal) {
            closeShippingHistoryModal.addEventListener('click', () => {
                this.closeShippingHistoryModal();
            });
        }

        const cancelShippingHistoryBtn = document.getElementById('cancelShippingHistoryBtn');
        if (cancelShippingHistoryBtn) {
            cancelShippingHistoryBtn.addEventListener('click', () => {
                this.closeShippingHistoryModal();
            });
        }

        const refreshShippingHistoryBtn = document.getElementById('refreshShippingHistoryBtn');
        if (refreshShippingHistoryBtn) {
            refreshShippingHistoryBtn.addEventListener('click', () => {
                // 强制重新迁移数据
                this.migrateShippingData(true);
                this.loadShippingHistory();
                this.showNotification('发货历史已刷新', 'success');
            });
        }

        const filterShippingHistoryBtn = document.getElementById('filterShippingHistoryBtn');
        if (filterShippingHistoryBtn) {
            filterShippingHistoryBtn.addEventListener('click', () => {
                this.filterShippingHistory();
            });
        }

        const exportShippingHistoryBtn = document.getElementById('exportShippingHistoryBtn');
        if (exportShippingHistoryBtn) {
            exportShippingHistoryBtn.addEventListener('click', () => {
                this.exportShippingHistory();
            });
        }

        // 发货详情模态框事件
        const closeShippingDetailModal = document.getElementById('closeShippingDetailModal');
        if (closeShippingDetailModal) {
            closeShippingDetailModal.addEventListener('click', () => {
                this.closeShippingDetailModal();
            });
        }

        const cancelShippingDetailBtn = document.getElementById('cancelShippingDetailBtn');
        if (cancelShippingDetailBtn) {
            cancelShippingDetailBtn.addEventListener('click', () => {
                this.closeShippingDetailModal();
            });
        }

        const toggleShippingEditMode = document.getElementById('toggleShippingEditMode');
        if (toggleShippingEditMode) {
            toggleShippingEditMode.addEventListener('click', () => {
                this.toggleShippingEditMode();
            });
        }

        const saveShippingDetailBtn = document.getElementById('saveShippingDetailBtn');
        if (saveShippingDetailBtn) {
            saveShippingDetailBtn.addEventListener('click', () => {
                this.saveShippingDetail();
            });
        }

        const deleteShippingRecordBtn = document.getElementById('deleteShippingRecordBtn');
        if (deleteShippingRecordBtn) {
            deleteShippingRecordBtn.addEventListener('click', () => {
                this.deleteShippingRecord();
            });
        }

        const addShippingItemBtn = document.getElementById('addShippingItemBtn');
        if (addShippingItemBtn) {
            addShippingItemBtn.addEventListener('click', () => {
                this.addShippingItem();
            });
        }

        // 原材料采购卡片点击事件（延迟绑定确保DOM完全加载）
        setTimeout(() => {
            const materialCard = document.getElementById('materialCard');
            if (materialCard) {
                console.log('找到materialCard元素，绑定点击事件');
                materialCard.addEventListener('click', () => {
                    console.log('原材料采购卡片被点击');
                    this.openMaterialModal();
                });
            } else {
                console.error('未找到materialCard元素');
            }
        }, 100);

        // 已生产量卡片点击事件（延迟绑定确保DOM完全加载）
        setTimeout(() => {
            const producedCard = document.querySelector('.metric-card.produced');
            if (producedCard) {
                console.log('找到已生产量卡片，绑定点击事件');
                producedCard.style.cursor = 'pointer';
                producedCard.addEventListener('click', () => {
                    console.log('已生产量卡片被点击');
                    this.openProductionManagementModal();
                });
            } else {
                console.error('未找到已生产量卡片');
            }
        }, 100);

        // Excel导入模态框
        const closeExcelImportModal = document.getElementById('closeExcelImportModal');
        if (closeExcelImportModal) {
            closeExcelImportModal.addEventListener('click', () => {
                this.closeExcelImportModal();
            });
        }

        const cancelExcelImportBtn = document.getElementById('cancelExcelImportBtn');
        if (cancelExcelImportBtn) {
            cancelExcelImportBtn.addEventListener('click', () => {
                this.closeExcelImportModal();
            });
        }

        const excelFileInput = document.getElementById('excelFileInput');
        if (excelFileInput) {
            excelFileInput.addEventListener('change', () => {
                this.handleExcelFileSelect();
            });
        }

        // 为型号和区域选择添加事件监听器
        const importTypeSelect = document.getElementById('importTypeSelect');
        if (importTypeSelect) {
            importTypeSelect.addEventListener('change', () => {
                console.log('型号选择改变:', importTypeSelect.value);
                this.checkImportReadiness();
            });
        }

        const importAreaSelect = document.getElementById('importAreaSelect');
        if (importAreaSelect) {
            importAreaSelect.addEventListener('change', () => {
                console.log('区域选择改变:', importAreaSelect.value);

                // 支持在Excel导入中新增区域
                if (importAreaSelect.value === '__add_new__') {
                    this.handleNewAreaInImport();
                    return;
                }

                this.checkImportReadiness();
            });
        }

        const previewExcelBtn = document.getElementById('previewExcelBtn');
        if (previewExcelBtn) {
            previewExcelBtn.addEventListener('click', () => {
                this.previewExcelData();
            });
        }

        const confirmExcelImportBtn = document.getElementById('confirmExcelImportBtn');
        if (confirmExcelImportBtn) {
            console.log('确认导入按钮找到，绑定事件');
            confirmExcelImportBtn.addEventListener('click', () => {
                console.log('确认导入按钮被点击');
                this.confirmExcelImport();
            });
        } else {
            console.error('找不到确认导入按钮');
        }

        // 快速导入按钮
        const quickImportBtn = document.getElementById('quickImportBtn');
        if (quickImportBtn) {
            console.log('快速导入按钮找到，绑定事件');
            quickImportBtn.addEventListener('click', () => {
                console.log('快速导入按钮被点击');
                this.quickImportExcel();
            });
        }
        
        // 批量操作模态框
        const closeBatchModal = document.getElementById('closeBatchModal');
        if (closeBatchModal) {
            closeBatchModal.addEventListener('click', () => {
                this.closeBatchModal();
            });
        }

        const cancelBatchBtn = document.getElementById('cancelBatchBtn');
        if (cancelBatchBtn) {
            cancelBatchBtn.addEventListener('click', () => {
                this.closeBatchModal();
            });
        }

        const executeBatchBtn = document.getElementById('executeBatchBtn');
        if (executeBatchBtn) {
            executeBatchBtn.addEventListener('click', () => {
                this.executeBatchOperation();
            });
        }

        // 遮罩层点击关闭
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.closeAllModals();
            });
        }

        // 表格排序
        document.querySelectorAll('[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                this.sortTable(th.dataset.sort);
            });
        });

        // 日志模态框事件
        const closeLogsModal = document.getElementById('closeLogsModal');
        if (closeLogsModal) {
            closeLogsModal.addEventListener('click', () => {
                this.closeLogsModal();
            });
        }

        const logTypeFilter = document.getElementById('logTypeFilter');
        if (logTypeFilter) {
            logTypeFilter.addEventListener('change', () => {
                this.filterLogs();
            });
        }

        const logDateFilter = document.getElementById('logDateFilter');
        if (logDateFilter) {
            logDateFilter.addEventListener('change', () => {
                this.filterLogs();
            });
        }

        const clearLogsBtn = document.getElementById('clearLogsBtn');
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', () => {
                this.clearLogs();
            });
        }

        const exportLogsBtn = document.getElementById('exportLogsBtn');
        if (exportLogsBtn) {
            exportLogsBtn.addEventListener('click', () => {
                this.exportLogs();
            });
        }
    }

    setupSpecSelection() {
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');
        const specDisplay = document.getElementById('specDisplay');

        // 型号选择变化时更新长度选项
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                this.updateLengthOptions();
                this.updateSpecDisplay();
            });
        }

        // 长度选择变化时更新完整规格显示
        if (lengthSelect) {
            lengthSelect.addEventListener('change', () => {
                this.updateSpecDisplay();
            });
        }
    }

    updateLengthOptions() {
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');

        if (!typeSelect.value) {
            lengthSelect.disabled = true;
            lengthSelect.innerHTML = '<option value="">请先选择型号</option>';
            return;
        }

        lengthSelect.disabled = false;
        lengthSelect.innerHTML = '<option value="">请选择长度</option>';

        // 生成长度选项：200mm到11800mm，以200mm为模数
        for (let length = 200; length <= 11800; length += 200) {
            const option = document.createElement('option');
            option.value = length;
            option.textContent = `${length}mm`;
            lengthSelect.appendChild(option);
        }
    }

    updateSpecDisplay() {
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');
        const specDisplay = document.getElementById('specDisplay');

        if (typeSelect.value && lengthSelect.value) {
            const spec = `${typeSelect.value}-${lengthSelect.value}mm`;
            specDisplay.value = spec;
        } else {
            specDisplay.value = '';
        }
    }

    getSpecFromInputs() {
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');

        if (typeSelect.value && lengthSelect.value) {
            return `${typeSelect.value}-${lengthSelect.value}mm`;
        }
        return '';
    }

    setSpecInputs(spec) {
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');
        const specDisplay = document.getElementById('specDisplay');

        if (!spec) {
            typeSelect.value = '';
            lengthSelect.value = '';
            lengthSelect.disabled = true;
            lengthSelect.innerHTML = '<option value="">请先选择型号</option>';
            specDisplay.value = '';
            return;
        }

        // 解析规格型号，例如 "H100-1000mm"
        const match = spec.match(/^(H\d+)-(\d+)mm$/);
        if (match) {
            const [, type, length] = match;
            typeSelect.value = type;
            this.updateLengthOptions();
            lengthSelect.value = length;
            specDisplay.value = spec;
        }
    }
    
    renderTable() {
        const tbody = document.getElementById('tableBody');
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        if (pageData.length === 0) {
            // 显示空状态提示
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: #6b7280;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
                        <i class="fas fa-inbox" style="font-size: 48px; opacity: 0.3;"></i>
                        <div>
                            <h3 style="margin: 0 0 8px 0; font-size: 18px;">暂无数据</h3>
                            <p style="margin: 0; font-size: 14px;">
                                ${this.data.length === 0 ?
                                    '点击"新增生产"按钮添加第一条数据，或使用"导入数据"功能导入现有数据' :
                                    '当前筛选条件下没有匹配的数据，请调整筛选条件'}
                            </p>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(emptyRow);
        } else {
            pageData.forEach(item => {
                const row = this.createTableRow(item);
                tbody.appendChild(row);
            });
        }

        this.updatePagination();
        this.updateTableInfo();
    }
    
    createTableRow(item) {
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        
        if (this.selectedItems.has(item.id)) {
            row.classList.add('selected');
        }
        
        const remaining = item.planned - item.produced;
        const available = item.produced - item.shipped;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" ${this.selectedItems.has(item.id) ? 'checked' : ''}
                       onchange="dataManager.toggleSelection(${item.id}, this.checked)">
            </td>
            <td>${item.spec}</td>
            <td>${item.area}</td>
            <td>${this.formatNumber(item.planned)}</td>
            <td>${this.formatNumber(item.produced)}</td>
            <td>${this.formatNumber(remaining)}</td>
            <td><span class="status-badge ${item.status}">${this.getStatusText(item.status)}</span></td>
            <td>${item.deadline}</td>
            <td>
                <div class="operation-btns">
                    <button class="op-btn edit" onclick="dataManager.editItem(${item.id})">编辑</button>
                    <button class="op-btn delete" onclick="dataManager.deleteItem(${item.id})">删除</button>
                </div>
            </td>
        `;
        
        return row;
    }
    
    getStatusText(status) {
        const statusMap = {
            'planned': '计划中',
            'producing': '生产中',
            'completed': '已完成',
            'shipped': '已发货'
        };
        return statusMap[status] || status;
    }
    
    formatNumber(num) {
        return new Intl.NumberFormat('zh-CN').format(num);
    }
    
    toggleSelection(id, checked) {
        if (checked) {
            this.selectedItems.add(id);
        } else {
            this.selectedItems.delete(id);
        }
        
        this.updateSelectedCount();
        this.updateSelectAllCheckbox();
    }
    
    selectAll(checked) {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        pageData.forEach(item => {
            if (checked) {
                this.selectedItems.add(item.id);
            } else {
                this.selectedItems.delete(item.id);
            }
        });
        
        this.renderTable();
        this.updateSelectedCount();
    }
    
    updateSelectAllCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAll');
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        const selectedInPage = pageData.filter(item => this.selectedItems.has(item.id)).length;
        
        if (selectedInPage === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedInPage === pageData.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }
    
    updateSelectedCount() {
        document.getElementById('selectedCount').textContent = this.selectedItems.size;
    }
    
    updateTableInfo() {
        document.getElementById('totalRecords').textContent = this.filteredData.length;
        this.updateSelectedCount();
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }
    
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTable();
        }
    }
    
    nextPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTable();
        }
    }
    
    search(query) {
        if (!query.trim()) {
            this.filteredData = [...this.data];
        } else {
            const searchTerm = query.toLowerCase();
            this.filteredData = this.data.filter(item => 
                item.spec.toLowerCase().includes(searchTerm) ||
                item.area.toLowerCase().includes(searchTerm) ||
                item.remarks.toLowerCase().includes(searchTerm)
            );
        }
        
        this.currentPage = 1;
        this.applyFilters();
    }
    
    applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const areaFilter = document.getElementById('areaFilter').value;

        let filtered = [...this.data];

        // 应用搜索
        const searchInput = document.getElementById('searchInput');
        if (searchInput.value.trim()) {
            const searchTerm = searchInput.value.toLowerCase();
            filtered = filtered.filter(item =>
                item.spec.toLowerCase().includes(searchTerm) ||
                item.area.toLowerCase().includes(searchTerm) ||
                item.remarks.toLowerCase().includes(searchTerm)
            );
        }

        // 应用状态筛选
        if (statusFilter) {
            filtered = filtered.filter(item => item.status === statusFilter);
        }

        // 应用区域筛选
        if (areaFilter) {
            filtered = filtered.filter(item => item.area === areaFilter);
        }

        this.filteredData = filtered;
        this.currentPage = 1;
        this.renderTable();
    }

    sortTable(field) {
        // 更新排序状态
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        // 更新表头图标
        document.querySelectorAll('[data-sort]').forEach(th => {
            th.classList.remove('sorted');
            const icon = th.querySelector('i');
            icon.className = 'fas fa-sort';
        });

        const currentTh = document.querySelector(`[data-sort="${field}"]`);
        currentTh.classList.add('sorted');
        const currentIcon = currentTh.querySelector('i');
        currentIcon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';

        // 执行排序
        this.filteredData.sort((a, b) => {
            let aValue = a[field];
            let bValue = b[field];

            // 处理数字类型
            if (field === 'planned' || field === 'produced') {
                aValue = Number(aValue);
                bValue = Number(bValue);
            } else if (field === 'remaining') {
                aValue = a.planned - a.produced;
                bValue = b.planned - b.produced;
            }

            // 处理字符串类型
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) {
                return this.sortDirection === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return this.sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        this.currentPage = 1;
        this.renderTable();
    }
    
    // 保存到本地存储（增强版本控制）
    saveToLocalStorage() {
        // 为数据添加版本信息和时间戳
        const enhancedData = this.data.map(item => ({
            ...item,
            lastModified: Date.now(),
            version: (item.version || 0) + 1,
            lastModifiedBy: window.firebaseSync?.userConfig?.id || 'local_user',
            lastModifiedByName: window.firebaseSync?.userConfig?.name || '本地用户'
        }));

        // 为发货历史添加版本信息
        const enhancedShipping = this.shippingHistory.map(item => ({
            ...item,
            lastModified: item.lastModified || Date.now(),
            version: (item.version || 0) + 1,
            lastModifiedBy: window.firebaseSync?.userConfig?.id || 'local_user',
            lastModifiedByName: window.firebaseSync?.userConfig?.name || '本地用户'
        }));

        // 为原材料采购添加版本信息
        const enhancedMaterials = this.materialPurchases.map(item => ({
            ...item,
            lastModified: item.lastModified || Date.now(),
            version: (item.version || 0) + 1,
            lastModifiedBy: window.firebaseSync?.userConfig?.id || 'local_user',
            lastModifiedByName: window.firebaseSync?.userConfig?.name || '本地用户'
        }));

        localStorage.setItem('productionData', JSON.stringify(enhancedData));
        localStorage.setItem('operationLogs', JSON.stringify(this.operationLogs));
        localStorage.setItem('materialPurchases', JSON.stringify(enhancedMaterials));
        localStorage.setItem('shippingHistory', JSON.stringify(enhancedShipping));

        // 更新内存中的数据
        this.data = enhancedData;
        this.shippingHistory = enhancedShipping;
        this.materialPurchases = enhancedMaterials;

        // 触发云端同步（优先使用 Firebase）
        this.syncToCloud();
    }

    // 同步数据到云端
    async syncToCloud() {
        if (window.firebaseSync && window.firebaseSync.isConnected()) {
            console.log('🔄 开始同步数据到云端...');

            // 显示当前数据状态
            console.log('📊 当前本地数据状态:', {
                生产数据: this.data?.length || 0,
                发货历史: this.shippingHistory?.length || 0,
                原材料采购: this.materialPurchases?.length || 0,
                操作日志: this.operationLogs?.length || 0,
                是否手动同步: this.isManualSyncing
            });

            try {
                let syncCount = 0;
                const currentTime = Date.now();

                // 同步生产数据
                if (this.data && this.data.length > 0) {
                    console.log(`📤 正在同步 ${this.data.length} 条生产数据...`);

                    // 如果是手动同步，为数据添加优先级标志
                    let dataToSync = this.data;
                    if (this.isManualSyncing) {
                        dataToSync = this.data.map(item => ({
                            ...item,
                            manualSyncFlag: true,
                            lastModified: currentTime,
                            version: (item.version || 1) + 1
                        }));
                        // 更新本地数据
                        this.data = dataToSync;
                    }

                    await window.firebaseSync.syncToCloud('productionData', dataToSync);
                    console.log('✅ 生产数据同步成功');
                    syncCount++;
                } else {
                    console.log('⚠️ 没有生产数据需要同步');
                }

                // 同步发货历史
                if (this.shippingHistory && this.shippingHistory.length > 0) {
                    console.log(`📤 正在同步 ${this.shippingHistory.length} 条发货历史...`);

                    let shippingToSync = this.shippingHistory;
                    if (this.isManualSyncing) {
                        shippingToSync = this.shippingHistory.map(item => ({
                            ...item,
                            manualSyncFlag: true,
                            lastModified: currentTime,
                            version: (item.version || 1) + 1
                        }));
                        this.shippingHistory = shippingToSync;
                    }

                    await window.firebaseSync.syncToCloud('shippingHistory', shippingToSync);
                    console.log('✅ 发货历史同步成功');
                    syncCount++;
                } else {
                    console.log('⚠️ 没有发货历史需要同步');
                }

                // 同步原材料采购
                if (this.materialPurchases && this.materialPurchases.length > 0) {
                    console.log(`📤 正在同步 ${this.materialPurchases.length} 条原材料数据...`);

                    let materialsToSync = this.materialPurchases;
                    if (this.isManualSyncing) {
                        materialsToSync = this.materialPurchases.map(item => ({
                            ...item,
                            manualSyncFlag: true,
                            lastModified: currentTime,
                            version: (item.version || 1) + 1
                        }));
                        this.materialPurchases = materialsToSync;
                    }

                    await window.firebaseSync.syncToCloud('materialPurchases', materialsToSync);
                    console.log('✅ 原材料数据同步成功');
                    syncCount++;
                } else {
                    console.log('⚠️ 没有原材料数据需要同步');
                }

                // 同步操作日志
                if (this.operationLogs && this.operationLogs.length > 0) {
                    console.log(`📤 正在同步 ${this.operationLogs.length} 条操作日志...`);
                    await window.firebaseSync.syncToCloud('operationLogs', this.operationLogs);
                    console.log('✅ 操作日志同步成功');
                    syncCount++;
                } else {
                    console.log('⚠️ 没有操作日志需要同步');
                }

                console.log(`✅ 数据同步完成，共同步了 ${syncCount} 个数据集合`);

            } catch (error) {
                console.error('❌ 数据同步失败:', error);
                throw error; // 重新抛出错误以便上层处理
            }
        } else {
            console.log('⚠️ Firebase未连接，跳过云端同步');
            throw new Error('Firebase未连接');
        }
    }

    // 执行手动同步（优先保护本地数据）
    async performManualSync() {
        if (!window.firebaseSync || !window.firebaseSync.isConnected()) {
            this.showNotification('❌ Firebase未连接，无法执行同步', 'error');
            return;
        }

        this.showNotification('🔄 开始手动同步数据...', 'info');

        try {
            // 显示当前数据状态
            console.log('🔍 当前数据状态:', {
                本地生产数据: this.data.length,
                本地发货历史: this.shippingHistory.length,
                本地原材料: this.materialPurchases.length,
                Firebase连接状态: window.firebaseSync.isConnected(),
                Firebase初始化状态: window.firebaseSync.isInitialized
            });

            // 1. 先测试Firebase连接
            console.log('🧪 测试Firebase连接...');
            const connectionTest = await window.firebaseSync.testFirebaseConnection();
            if (!connectionTest) {
                throw new Error('Firebase连接测试失败');
            }

            // 2. 备份当前本地数据
            console.log('💾 备份本地数据...');
            const localDataBackup = [...this.data];
            const localShippingBackup = [...this.shippingHistory];
            const localMaterialBackup = [...this.materialPurchases];

            // 3. 设置标志，暂时禁用自动数据合并
            this.isManualSyncing = true;

            // 4. 暂停Firebase实时监听器
            if (window.firebaseSync) {
                window.firebaseSync.pauseRealtimeSync();
            }

            // 5. 记录手动同步时间（在上传之前设置，防止实时监听器触发）
            this.lastManualSyncTime = Date.now();

            // 6. 直接上传本地数据到云端（不先拉取云端数据）
            console.log('📤 直接上传本地数据到云端...');
            await this.syncToCloud();

            // 7. 等待一下让数据处理完成
            await new Promise(resolve => setTimeout(resolve, 3000)); // 增加等待时间

            // 8. 恢复数据合并功能
            this.isManualSyncing = false;

            // 9. 恢复Firebase实时监听器
            if (window.firebaseSync) {
                window.firebaseSync.resumeRealtimeSync();
            }

            // 保存更新后的数据到本地存储
            localStorage.setItem('productionData', JSON.stringify(this.data));
            localStorage.setItem('shippingHistory', JSON.stringify(this.shippingHistory));
            localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));

            this.showNotification('✅ 手动同步完成！本地数据已上传到云端', 'success');

            // 确保本地数据没有丢失
            if (this.data.length === 0 && localDataBackup.length > 0) {
                console.log('⚠️ 检测到数据丢失，恢复备份数据');
                this.data = localDataBackup;
                this.shippingHistory = localShippingBackup;
                this.materialPurchases = localMaterialBackup;

                // 保存到本地存储
                localStorage.setItem('productionData', JSON.stringify(this.data));
                localStorage.setItem('shippingHistory', JSON.stringify(this.shippingHistory));
                localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));
            }

            // 刷新界面
            this.renderTable();
            this.updateStats();
            this.renderAreaStats();
            this.renderUnproducedStats();
            this.renderCustomerStats();

        } catch (error) {
            console.error('❌ 手动同步失败:', error);
            this.showNotification('❌ 手动同步失败: ' + error.message, 'error');

            // 确保恢复数据合并功能和实时监听器
            this.isManualSyncing = false;
            if (window.firebaseSync) {
                window.firebaseSync.resumeRealtimeSync();
            }
        }
    }

    // 强制上传本地数据到云端（覆盖云端数据）
    async forceUploadToCloud() {
        if (!window.firebaseSync || !window.firebaseSync.isConnected()) {
            this.showNotification('❌ Firebase未连接，无法上传数据', 'error');
            return;
        }

        const confirmed = confirm('⚠️ 确定要强制上传本地数据到云端吗？\n\n这将：\n1. 清空云端所有数据\n2. 上传当前本地数据\n\n云端数据将被完全替换！');

        if (!confirmed) return;

        this.showNotification('🚀 开始强制上传本地数据...', 'info');

        try {
            // 1. 清空云端数据
            console.log('🗑️ 清空云端数据...');
            await window.firebaseSync.clearCollection('productionData');
            await window.firebaseSync.clearCollection('shippingHistory');
            await window.firebaseSync.clearCollection('materialPurchases');

            // 2. 等待清空完成
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. 上传本地数据
            console.log('📤 上传本地数据到云端...');

            if (this.data.length > 0) {
                await window.firebaseSync.syncToCloud('productionData', this.data, 'update');
                console.log(`✅ 已上传 ${this.data.length} 条生产数据`);
            }

            if (this.shippingHistory.length > 0) {
                await window.firebaseSync.syncToCloud('shippingHistory', this.shippingHistory, 'update');
                console.log(`✅ 已上传 ${this.shippingHistory.length} 条发货历史`);
            }

            if (this.materialPurchases.length > 0) {
                await window.firebaseSync.syncToCloud('materialPurchases', this.materialPurchases, 'update');
                console.log(`✅ 已上传 ${this.materialPurchases.length} 条原材料记录`);
            }

            // 4. 等待上传完成
            await new Promise(resolve => setTimeout(resolve, 2000));

            this.showNotification('✅ 本地数据已成功上传到云端！', 'success');

            console.log('🎉 强制上传完成:', {
                生产数据: this.data.length,
                发货历史: this.shippingHistory.length,
                原材料记录: this.materialPurchases.length
            });

        } catch (error) {
            console.error('❌ 强制上传失败:', error);
            this.showNotification('❌ 强制上传失败: ' + error.message, 'error');
        }
    }
    
    // 从本地存储加载（重复方法，已删除）
    // loadFromLocalStorage() {
    //     const saved = localStorage.getItem('productionData');
    //     if (saved) {
    //         this.data = JSON.parse(saved);
    //         this.filteredData = [...this.data];
    //     }

    //     const savedLogs = localStorage.getItem('operationLogs');
    //     if (savedLogs) {
    //         this.operationLogs = JSON.parse(savedLogs);
    //     }
    // }

    // 添加操作日志
    addLog(type, title, description, details = {}) {
        const log = {
            id: Date.now(),
            type,
            title,
            description,
            details,
            timestamp: new Date().toISOString(),
            user: '当前用户' // 在实际应用中应该是真实的用户信息
        };

        this.operationLogs.unshift(log);

        // 只保留最近1000条日志
        if (this.operationLogs.length > 1000) {
            this.operationLogs = this.operationLogs.slice(0, 1000);
        }

        localStorage.setItem('operationLogs', JSON.stringify(this.operationLogs));
    }
    
    // 更新统计数据
    updateStats() {
        console.log('updateStats 被调用');
        console.log('materialPurchases 数量:', this.materialPurchases.length);
        console.log('window.dashboard 存在:', !!window.dashboard);

        // 通知主界面更新统计数据
        if (window.dashboard) {
            console.log('调用 dashboard.updateMetricsFromDataManager');
            window.dashboard.updateMetricsFromDataManager();
            window.dashboard.updateCharts();
        } else {
            console.warn('window.dashboard 不存在，无法更新仪表板');
        }

        // 更新区域统计
        this.renderAreaStats();

        // 更新未生产规格统计
        this.renderUnproducedStats();

        // 更新客户发货统计
        this.renderCustomerStats();

        // 更新产量统计
        this.updateProductionStats();
    }
    
    showNotification(message, type = 'info') {
        // 复用主系统的通知功能
        if (window.dashboard) {
            window.dashboard.showNotification(message, type);
        }
    }

    // 强制更新主界面统计数据
    forceUpdateDashboard() {
        console.log('强制更新主界面统计数据...');

        // 等待一小段时间确保数据已经设置完成
        setTimeout(() => {
            if (window.dashboard) {
                console.log('调用 dashboard.updateMetricsFromDataManager (强制)');
                window.dashboard.updateMetricsFromDataManager();
                window.dashboard.updateCharts();

                // 再次延迟确保更新完成
                setTimeout(() => {
                    window.dashboard.updateMetrics();
                }, 100);
            } else {
                console.warn('window.dashboard 不存在，无法强制更新');
            }
        }, 50);
    }

    // 打开生产数据模态框
    openProductionModal(id = null) {
        console.log('openProductionModal 被调用，id:', id);
        this.editingId = id;

        const modal = document.getElementById('productionModal');
        const overlay = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const singleMode = document.getElementById('singleMode');
        const batchMode = document.getElementById('batchMode');

        if (id) {
            // 编辑模式：使用单项模式
            console.log('进入编辑模式');
            title.textContent = '编辑生产数据';
            this.isBatchMode = false;

            // 显示单项模式，隐藏批量模式
            if (singleMode) {
                singleMode.style.display = 'block';
                console.log('显示单项模式');
            } else {
                console.error('找不到 singleMode 元素');
            }
            if (batchMode) {
                batchMode.style.display = 'none';
                console.log('隐藏批量模式');
            }

            // 加载要编辑的数据
            this.fillProductionForm(id);
        } else {
            // 新增模式：使用批量模式
            console.log('进入新增模式');
            title.textContent = '新增生产数据';
            this.isBatchMode = true;

            // 显示批量模式，隐藏单项模式
            if (singleMode) singleMode.style.display = 'none';
            if (batchMode) {
                batchMode.style.display = 'block';
                console.log('显示批量模式');
            }

            this.clearBatchForm();

            // 设置默认生产日期为今天
            const batchProductionDate = document.getElementById('batchProductionDate');
            if (batchProductionDate) {
                batchProductionDate.value = new Date().toISOString().split('T')[0];
            }

            // 清空批量表格并添加第一行
            this.clearBatchTable();
            this.addBatchRow();
        }

        modal.classList.add('active');
        overlay.classList.add('active');
        console.log('模态框已打开');
    }

    closeProductionModal() {
        const modal = document.getElementById('productionModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');
        this.editingId = null;
    }

    fillProductionForm(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) {
            console.error('找不到ID为', id, '的数据项');
            return;
        }

        console.log('填充表单数据:', item);

        // 设置规格选择器
        this.setSpecInputs(item.spec);

        // 填充其他字段
        const areaInput = document.getElementById('areaInput');
        const plannedInput = document.getElementById('plannedInput');
        const producedInput = document.getElementById('producedInput');
        const statusInput = document.getElementById('statusInput');
        const deadlineInput = document.getElementById('deadlineInput');
        const remarksInput = document.getElementById('remarksInput');

        if (areaInput) areaInput.value = item.area || '';
        if (plannedInput) plannedInput.value = item.planned || '';
        if (producedInput) producedInput.value = item.produced || 0;
        if (statusInput) statusInput.value = item.status || 'planned';
        if (deadlineInput) deadlineInput.value = item.deadline || '';
        if (remarksInput) remarksInput.value = item.remarks || '';

        console.log('表单填充完成');
    }

    clearProductionForm() {
        document.getElementById('productionForm').reset();
        this.setSpecInputs(''); // 重置规格选择

        // 设置默认生产日期为今天
        const productionDate = document.getElementById('productionDate');
        if (productionDate) {
            productionDate.value = new Date().toISOString().split('T')[0];
        }

        // 设置默认批量生产日期为今天
        const batchProductionDate = document.getElementById('batchProductionDate');
        if (batchProductionDate) {
            batchProductionDate.value = new Date().toISOString().split('T')[0];
        }
    }

    clearBatchForm() {
        // 重置批量区域选择
        const batchArea = document.getElementById('batchArea');
        if (batchArea) {
            batchArea.value = '';
        }

        // 设置默认批量生产日期为今天
        const batchProductionDate = document.getElementById('batchProductionDate');
        if (batchProductionDate) {
            batchProductionDate.value = new Date().toISOString().split('T')[0];
        }
    }

    saveProductionData() {
        if (this.editingId) {
            // 编辑模式：保存单项数据
            this.saveSingleProduction();
        } else {
            // 新增模式：使用批量模式
            this.saveBatchProduction();
        }
    }

    saveSingleProduction() {
        // 获取表单数据
        const typeSelect = document.getElementById('typeInput');
        const lengthSelect = document.getElementById('lengthInput');
        const areaInput = document.getElementById('areaInput');
        const plannedInput = document.getElementById('plannedInput');
        const producedInput = document.getElementById('producedInput');
        const statusInput = document.getElementById('statusInput');
        const deadlineInput = document.getElementById('deadlineInput');
        const remarksInput = document.getElementById('remarksInput');

        // 验证必填字段
        if (!typeSelect.value || !lengthSelect.value || !areaInput.value || !plannedInput.value) {
            this.showNotification('请填写所有必填字段', 'error');
            return;
        }

        const formData = {
            spec: `${typeSelect.value}-${lengthSelect.value}mm`,
            area: areaInput.value,
            planned: parseInt(plannedInput.value),
            produced: parseInt(producedInput.value) || 0,
            status: statusInput.value,
            deadline: deadlineInput.value,
            remarks: remarksInput.value
        };

        // 验证数据有效性
        if (formData.planned <= 0) {
            this.showNotification('计划数量必须大于0', 'error');
            return;
        }

        if (formData.produced < 0) {
            this.showNotification('已生产数量不能小于0', 'error');
            return;
        }

        if (formData.produced > formData.planned) {
            if (!confirm(`已生产数量 ${this.formatNumber(formData.produced)} 根超过计划数量 ${this.formatNumber(formData.planned)} 根，是否继续？`)) {
                return;
            }
        }

        // 更新现有记录
        this.updateExistingRecord(formData);
    }

    saveBatchProduction() {
        const batchArea = document.getElementById('batchArea').value || ''; // 允许为空，使用智能分配
        const batchProductionDate = document.getElementById('batchProductionDate').value;

        if (!batchProductionDate) {
            this.showNotification('请选择生产日期', 'error');
            return;
        }

        const tableBody = document.getElementById('batchTableBody');
        const rows = Array.from(tableBody.children);
        const batchData = [];

        // 收集所有行的数据
        for (const row of rows) {
            const typeSelect = row.querySelector('.batch-type');
            const lengthSelect = row.querySelector('.batch-length');
            const quantityInput = row.querySelector('.batch-quantity');

            if (!typeSelect.value || !lengthSelect.value || !quantityInput.value) {
                this.showNotification('请完整填写所有规格信息', 'error');
                return;
            }

            batchData.push({
                type: typeSelect.value,
                length: lengthSelect.value,
                quantity: parseInt(quantityInput.value),
                area: batchArea
            });
        }

        if (batchData.length === 0) {
            this.showNotification('请至少添加一个规格', 'error');
            return;
        }

        // 批量保存数据
        let totalProcessed = 0;
        let smartAllocatedCount = 0;

        batchData.forEach(item => {
            const spec = `${item.type}-${item.length}mm`;

            if (item.area) {
                // 指定区域的处理
                this.updateAreaProduction(spec, item.area, item.quantity, batchProductionDate, '批量生产');
            } else {
                // 智能分配处理
                const allocatedAreas = this.smartAllocateProduction(spec, item.quantity);

                if (allocatedAreas.length === 0) {
                    // 没有找到匹配的计划，创建新记录到默认区域
                    this.createNewProductionRecord(spec, 'C1', item.quantity, batchProductionDate, '批量生产');
                } else {
                    // 按分配结果更新各区域
                    allocatedAreas.forEach(allocation => {
                        this.updateAreaProduction(allocation.spec, allocation.area, allocation.quantity, batchProductionDate, '批量生产');
                    });
                    smartAllocatedCount++;
                }
            }

            totalProcessed += item.quantity;
        });

        // 保存并更新界面
        this.saveToLocalStorage();
        this.filteredData = [...this.data];
        this.renderTable();
        this.updateStats();
        this.closeProductionModal();

        let message = `成功批量添加 ${batchData.length} 个规格的生产数据，共 ${this.formatNumber(totalProcessed)} 根`;
        if (smartAllocatedCount > 0) {
            message += `，其中 ${smartAllocatedCount} 个规格使用了智能分配`;
        }

        this.showNotification(message, 'success');
    }

    addProductionToExistingPlan(spec, area, producedQuantity, productionDate = null, remarks = '') {
        // 如果没有指定区域，使用智能分配
        if (!area) {
            const allocatedAreas = this.smartAllocateProduction(spec, producedQuantity);

            if (allocatedAreas.length === 0) {
                // 没有找到匹配的计划，创建新的生产记录到默认区域
                this.createNewProductionRecord(spec, 'C1', producedQuantity, productionDate, remarks);
                this.showNotification(`没有找到匹配的计划，已创建新记录到C1区域`, 'info');
            } else {
                // 按分配结果更新各区域
                allocatedAreas.forEach(allocation => {
                    this.updateAreaProduction(allocation.spec, allocation.area, allocation.quantity, productionDate, remarks);
                });

                const totalAllocated = allocatedAreas.reduce((sum, allocation) => sum + allocation.quantity, 0);
                const areaNames = [...new Set(allocatedAreas.map(a => a.area))];
                this.showNotification(`智能分配完成：${this.formatNumber(totalAllocated)} 根已分配到 ${areaNames.join(', ')} 区域`, 'success');
            }
        } else {
            // 指定区域的处理逻辑
            this.updateAreaProduction(spec, area, producedQuantity, productionDate, remarks);
        }

        // 保存数据并更新界面
        this.saveToLocalStorage();
        this.filteredData = [...this.data];
        this.renderTable();
        this.updateStats();
        this.closeProductionModal();
    }

    // 更新指定区域的生产数量
    updateAreaProduction(spec, area, producedQuantity, productionDate, remarks) {
        const existingPlan = this.data.find(item =>
            item.spec === spec && item.area === area
        );

        if (existingPlan) {
            // 更新现有计划的生产数量
            const newProduced = existingPlan.produced + producedQuantity;

            if (newProduced > existingPlan.planned) {
                if (confirm(`生产数量 ${this.formatNumber(newProduced)} 根超过计划数量 ${this.formatNumber(existingPlan.planned)} 根，是否继续？`)) {
                    existingPlan.produced = newProduced;
                } else {
                    return;
                }
            } else {
                existingPlan.produced = newProduced;
            }

            // 自动更新状态
            if (existingPlan.produced >= existingPlan.planned) {
                existingPlan.status = 'completed';
            } else if (existingPlan.status === 'planned') {
                existingPlan.status = 'producing';
            }

            // 添加生产记录
            if (!existingPlan.productionRecords) {
                existingPlan.productionRecords = [];
            }
            existingPlan.productionRecords.push({
                date: productionDate || new Date().toISOString().split('T')[0],
                quantity: producedQuantity,
                remarks: remarks || '',
                timestamp: new Date().toISOString()
            });

            // 记录日志
            this.addLog('update', '新增生产数量',
                `${spec} (${area}) 新增生产 ${this.formatNumber(producedQuantity)} 根，累计 ${this.formatNumber(existingPlan.produced)} 根`,
                { spec, area, addedQuantity: producedQuantity, totalProduced: existingPlan.produced });

        } else {
            // 没有找到匹配的计划，创建新的生产记录
            this.createNewProductionRecord(spec, area, producedQuantity, productionDate, remarks);
        }
    }

    // 创建新的生产记录
    createNewProductionRecord(spec, area, producedQuantity, productionDate, remarks) {
        const newId = this.data.length > 0 ? Math.max(...this.data.map(d => d.id)) + 1 : 1;
        const newRecord = {
            id: newId,
            spec: spec,
            area: area,
            planned: producedQuantity, // 计划数量等于生产数量
            produced: producedQuantity,
            status: 'completed',
            deadline: '',
            remarks: remarks || '生产部门直接录入',
            shipped: 0,
            shippingRecords: [],
            productionRecords: [{
                date: productionDate || new Date().toISOString().split('T')[0],
                quantity: producedQuantity,
                remarks: remarks || '',
                timestamp: new Date().toISOString()
            }]
        };

        this.data.push(newRecord);

        // 记录日志
        this.addLog('create', '新增生产记录',
            `新增 ${spec} (${area}) 生产记录，数量 ${this.formatNumber(producedQuantity)} 根`,
            { newRecord });

        this.showNotification(`成功创建新的生产记录 ${this.formatNumber(producedQuantity)} 根`, 'success');
    }

    updateExistingRecord(formData) {
        // 编辑现有数据的逻辑保持不变
        const index = this.data.findIndex(d => d.id === this.editingId);
        if (index !== -1) {
            const oldData = {...this.data[index]};
            this.data[index] = {
                ...this.data[index],
                ...formData
            };

            // 记录日志
            this.addLog('update', '更新生产数据',
                `更新了 ${formData.spec} (${formData.area}) 的生产信息`,
                { oldData, newData: this.data[index] });

            this.showNotification('数据更新成功', 'success');
        }

        this.saveToLocalStorage();
        this.filteredData = [...this.data];
        this.renderTable();
        this.updateStats();
        this.closeProductionModal();


    }

    editItem(id) {
        console.log('editItem 被调用，id:', id);
        console.log('dataManager 实例:', this);
        console.log('data 数组长度:', this.data.length);

        try {
            this.openProductionModal(id);
        } catch (error) {
            console.error('editItem 执行出错:', error);
            this.showNotification('编辑功能出现错误，请查看控制台', 'error');
        }
    }

    deleteItem(id) {
        const item = this.data.find(d => d.id === id);
        if (!item) return;

        const confirmMessage = `确定要删除这条记录吗？\n\n规格型号：${item.spec}\n工区区域：${item.area}\n计划数量：${this.formatNumber(item.planned)} 根\n已生产：${this.formatNumber(item.produced)} 根\n已发货：${this.formatNumber(item.shipped || 0)} 根\n\n此操作不可撤销！`;

        if (confirm(confirmMessage)) {
            const index = this.data.findIndex(d => d.id === id);
            if (index !== -1) {
                const deletedItem = this.data[index];
                this.data.splice(index, 1);
                this.selectedItems.delete(id);

                // 记录日志
                this.addLog('delete', '删除生产数据',
                    `删除了 ${deletedItem.spec} (${deletedItem.area}) 的生产记录`,
                    { deletedData: deletedItem });

                this.saveToLocalStorage();
                this.filteredData = [...this.data];
                this.renderTable();
                this.updateStats();
                this.showNotification('删除成功', 'success');
            }
        }
    }

    // 批量发货管理（移除单个发货功能）
    openShippingModal() {
        this.isBatchShippingMode = true; // 直接进入批量发货模式

        const modal = document.getElementById('shippingModal');
        const overlay = document.getElementById('modalOverlay');
        const title = document.getElementById('shippingModalTitle');

        // 直接显示批量发货模式
        const singleMode = document.getElementById('singleShippingMode');
        const batchMode = document.getElementById('batchShippingMode');
        const toggleShippingMode = document.getElementById('toggleShippingMode');
        const previewBtn = document.getElementById('previewShippingBtn');
        const exportBtn = document.getElementById('exportShippingBtn');

        if (singleMode && batchMode) {
            singleMode.style.display = 'none';
            batchMode.style.display = 'block';
        }

        // 显示批量发货相关按钮
        if (previewBtn) previewBtn.style.display = 'inline-flex';
        if (exportBtn) exportBtn.style.display = 'inline-flex';

        // 隐藏模式切换按钮（因为只有批量发货）
        if (toggleShippingMode) toggleShippingMode.style.display = 'none';

        title.textContent = '批量发货管理';

        // 设置默认发货日期
        document.getElementById('batchShippingDate').value = new Date().toISOString().split('T')[0];

        // 清空批量发货表格
        this.clearBatchShippingTable();

        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closeShippingModal() {
        const modal = document.getElementById('shippingModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        // 清空批量发货表格
        this.clearBatchShippingTable();
    }

    processShipping() {
        // 只处理批量发货模式
        this.processBatchShipping();
    }

    // 批量操作
    openBatchModal() {
        const modal = document.getElementById('batchModal');
        const overlay = document.getElementById('modalOverlay');

        // 重置批量操作选项
        document.querySelectorAll('.batch-option').forEach(option => {
            option.classList.remove('selected');
            option.addEventListener('click', () => {
                document.querySelectorAll('.batch-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                this.showBatchForm(option.dataset.action);
            });
        });

        document.getElementById('batchForm').style.display = 'none';
        document.getElementById('executeBatchBtn').style.display = 'none';

        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closeBatchModal() {
        const modal = document.getElementById('batchModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');
    }

    showBatchForm(action) {
        const formContainer = document.getElementById('batchForm');
        const executeBtn = document.getElementById('executeBatchBtn');

        let formHTML = '';

        switch (action) {
            case 'updateStatus':
                formHTML = `
                    <h4>批量更新状态</h4>
                    <div class="form-group">
                        <label for="batchStatus">新状态</label>
                        <select id="batchStatus">
                            <option value="planned">计划中</option>
                            <option value="producing">生产中</option>
                            <option value="completed">已完成</option>
                            <option value="shipped">已发货</option>
                        </select>
                    </div>
                `;
                break;

            case 'updateProduction':
                formHTML = `
                    <h4>批量增加生产数量</h4>
                    <div class="form-group">
                        <label for="batchQuantity">增加数量</label>
                        <input type="number" id="batchQuantity" min="1" placeholder="请输入要增加的数量">
                    </div>
                `;
                break;

            case 'delete':
                formHTML = `
                    <h4>批量删除</h4>
                    <p style="color: #ef4444; margin: 0;">确定要删除选中的 ${this.selectedItems.size} 项记录吗？此操作不可撤销。</p>
                `;
                break;
        }

        formContainer.innerHTML = formHTML;
        formContainer.style.display = 'block';
        executeBtn.style.display = 'block';
        executeBtn.dataset.action = action;
    }

    executeBatchOperation() {
        const action = document.getElementById('executeBatchBtn').dataset.action;
        const selectedIds = Array.from(this.selectedItems);

        if (selectedIds.length === 0) {
            this.showNotification('没有选中的项目', 'warning');
            return;
        }

        switch (action) {
            case 'updateStatus':
                this.batchUpdateStatus(selectedIds);
                break;
            case 'updateProduction':
                this.batchUpdateProduction(selectedIds);
                break;
            case 'delete':
                this.batchDelete(selectedIds);
                break;
        }
    }

    batchUpdateStatus(ids) {
        const newStatus = document.getElementById('batchStatus').value;
        const statusText = this.getStatusText(newStatus);

        ids.forEach(id => {
            const item = this.data.find(d => d.id === id);
            if (item) {
                item.status = newStatus;
            }
        });

        // 记录日志
        this.addLog('batch', '批量更新状态',
            `批量将 ${ids.length} 项记录的状态更新为 ${statusText}`,
            { operation: 'updateStatus', itemIds: ids, newStatus });

        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();
        this.closeBatchModal();
        this.selectedItems.clear();
        this.showNotification(`成功更新 ${ids.length} 项记录的状态`, 'success');
    }

    batchUpdateProduction(ids) {
        const quantity = parseInt(document.getElementById('batchQuantity').value);

        if (!quantity || quantity <= 0) {
            this.showNotification('请输入有效的数量', 'error');
            return;
        }

        ids.forEach(id => {
            const item = this.data.find(d => d.id === id);
            if (item) {
                item.produced = Math.min(item.produced + quantity, item.planned);
            }
        });

        // 记录日志
        this.addLog('batch', '批量增加生产数量',
            `批量为 ${ids.length} 项记录增加生产数量 ${this.formatNumber(quantity)} 根`,
            { operation: 'updateProduction', itemIds: ids, quantity });

        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();
        this.closeBatchModal();
        this.selectedItems.clear();
        this.showNotification(`成功为 ${ids.length} 项记录增加生产数量`, 'success');
    }

    batchDelete(ids) {
        if (confirm(`确定要删除选中的 ${ids.length} 项记录吗？`)) {
            const deletedItems = this.data.filter(item => ids.includes(item.id));
            this.data = this.data.filter(item => !ids.includes(item.id));
            this.selectedItems.clear();

            // 记录日志
            this.addLog('batch', '批量删除',
                `批量删除了 ${ids.length} 项生产记录`,
                { operation: 'delete', itemIds: ids, deletedItems });

            this.saveToLocalStorage();
            this.filteredData = [...this.data];
            this.renderTable();
            this.updateStats();
            this.closeBatchModal();
            this.showNotification(`成功删除 ${ids.length} 项记录`, 'success');
        }
    }

    closeAllModals() {
        this.closePlanModal();
        this.closeProductionModal();
        this.closeShippingModal();
        this.closeBatchModal();
        this.closeLogsModal();
    }

    // 计划管理相关方法
    setupPlanSpecSelection() {
        const typeSelect = document.getElementById('planTypeInput');
        const lengthSelect = document.getElementById('planLengthInput');
        const specDisplay = document.getElementById('planSpecDisplay');

        // 型号选择变化时更新长度选项
        typeSelect.addEventListener('change', () => {
            this.updatePlanLengthOptions();
            this.updatePlanSpecDisplay();
        });

        // 长度选择变化时更新完整规格显示
        lengthSelect.addEventListener('change', () => {
            this.updatePlanSpecDisplay();
        });
    }

    updatePlanLengthOptions() {
        const typeSelect = document.getElementById('planTypeInput');
        const lengthSelect = document.getElementById('planLengthInput');

        if (!typeSelect.value) {
            lengthSelect.disabled = true;
            lengthSelect.innerHTML = '<option value="">请先选择型号</option>';
            return;
        }

        lengthSelect.disabled = false;
        lengthSelect.innerHTML = '<option value="">请选择长度</option>';

        // 生成长度选项：200mm到11800mm，以200mm为模数
        for (let length = 200; length <= 11800; length += 200) {
            const option = document.createElement('option');
            option.value = length;
            option.textContent = `${length}mm`;
            lengthSelect.appendChild(option);
        }
    }

    updatePlanSpecDisplay() {
        const typeSelect = document.getElementById('planTypeInput');
        const lengthSelect = document.getElementById('planLengthInput');
        const specDisplay = document.getElementById('planSpecDisplay');

        if (typeSelect.value && lengthSelect.value) {
            const spec = `${typeSelect.value}-${lengthSelect.value}mm`;
            specDisplay.value = spec;
        } else {
            specDisplay.value = '';
        }
    }

    getPlanSpecFromInputs() {
        const typeSelect = document.getElementById('planTypeInput');
        const lengthSelect = document.getElementById('planLengthInput');

        if (typeSelect.value && lengthSelect.value) {
            return `${typeSelect.value}-${lengthSelect.value}mm`;
        }
        return '';
    }

    openPlanModal() {
        const modal = document.getElementById('planModal');
        const overlay = document.getElementById('modalOverlay');

        this.clearPlanForm();
        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closePlanModal() {
        const modal = document.getElementById('planModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');
    }

    clearPlanForm() {
        document.getElementById('planForm').reset();
        const lengthSelect = document.getElementById('planLengthInput');
        lengthSelect.disabled = true;
        lengthSelect.innerHTML = '<option value="">请先选择型号</option>';
        document.getElementById('planSpecDisplay').value = '';
    }

    savePlanData() {
        const spec = this.getPlanSpecFromInputs();
        const formData = {
            spec: spec,
            area: document.getElementById('planAreaInput').value,
            planned: parseInt(document.getElementById('planQuantityInput').value),
            produced: 0, // 新计划的已生产数量为0
            status: 'planned', // 新计划状态为计划中
            deadline: document.getElementById('planDeadlineInput').value,
            remarks: document.getElementById('planRemarksInput').value
        };

        // 验证数据
        if (!formData.spec || !formData.area || !formData.planned) {
            this.showNotification('请填写必填字段（型号、长度、工地区域、计划数量）', 'error');
            return;
        }

        // 检查是否已存在相同规格和区域的计划
        const existingPlan = this.data.find(item =>
            item.spec === formData.spec && item.area === formData.area
        );

        if (existingPlan) {
            if (confirm(`已存在 ${formData.spec} (${formData.area}) 的计划，是否要合并数量？`)) {
                // 合并到现有计划
                existingPlan.planned += formData.planned;

                // 记录日志
                this.addLog('update', '合并生产计划',
                    `将 ${formData.spec} (${formData.area}) 的计划数量增加 ${this.formatNumber(formData.planned)} 根`,
                    { mergedData: formData, existingPlan });

                this.showNotification(`已将 ${this.formatNumber(formData.planned)} 根合并到现有计划`, 'success');
            } else {
                return; // 用户取消操作
            }
        } else {
            // 新增计划
            const newId = this.data.length > 0 ? Math.max(...this.data.map(d => d.id)) + 1 : 1;
            this.data.push({
                id: newId,
                ...formData,
                shipped: 0,
                shippingRecords: []
            });

            // 记录日志
            this.addLog('create', '新增生产计划',
                `新增了 ${formData.spec} (${formData.area}) 的生产计划，数量 ${this.formatNumber(formData.planned)} 根`,
                { newData: formData });

            this.showNotification('生产计划添加成功', 'success');
        }

        this.saveToLocalStorage();
        this.filteredData = [...this.data];
        this.renderTable();
        this.updateStats();
        this.closePlanModal();
    }

    // 日志管理
    openLogsModal() {
        const modal = document.getElementById('logsModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.add('active');
        overlay.classList.add('active');

        this.renderLogs();
    }

    closeLogsModal() {
        const modal = document.getElementById('logsModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');
    }

    renderLogs() {
        const container = document.getElementById('logsList');
        const typeFilter = document.getElementById('logTypeFilter').value;
        const dateFilter = document.getElementById('logDateFilter').value;

        let filteredLogs = [...this.operationLogs];

        // 按类型筛选
        if (typeFilter) {
            filteredLogs = filteredLogs.filter(log => log.type === typeFilter);
        }

        // 按日期筛选
        if (dateFilter) {
            const filterDate = new Date(dateFilter).toDateString();
            filteredLogs = filteredLogs.filter(log =>
                new Date(log.timestamp).toDateString() === filterDate
            );
        }

        if (filteredLogs.length === 0) {
            container.innerHTML = `
                <div class="empty-logs">
                    <i class="fas fa-history"></i>
                    <p>暂无操作日志</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredLogs.map(log => this.createLogItem(log)).join('');
    }

    createLogItem(log) {
        const time = new Date(log.timestamp);
        const timeStr = time.toLocaleString('zh-CN');

        const iconMap = {
            'create': 'fas fa-plus',
            'update': 'fas fa-edit',
            'delete': 'fas fa-trash',
            'shipping': 'fas fa-truck',
            'batch': 'fas fa-layer-group'
        };

        return `
            <div class="log-item">
                <div class="log-icon ${log.type}">
                    <i class="${iconMap[log.type] || 'fas fa-info'}"></i>
                </div>
                <div class="log-content">
                    <div class="log-title">${log.title}</div>
                    <div class="log-description">${log.description}</div>
                    <div class="log-meta">
                        <div class="log-time">
                            <i class="fas fa-clock"></i>
                            <span>${timeStr}</span>
                        </div>
                        <div class="log-user">
                            <i class="fas fa-user"></i>
                            <span>${log.user}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    filterLogs() {
        this.renderLogs();
    }

    clearLogs() {
        if (confirm('确定要清空所有操作日志吗？此操作不可撤销。')) {
            this.operationLogs = [];
            localStorage.removeItem('operationLogs');
            this.renderLogs();
            this.showNotification('操作日志已清空', 'success');
        }
    }

    exportLogs() {
        const typeFilter = document.getElementById('logTypeFilter').value;
        const dateFilter = document.getElementById('logDateFilter').value;

        let filteredLogs = [...this.operationLogs];

        if (typeFilter) {
            filteredLogs = filteredLogs.filter(log => log.type === typeFilter);
        }

        if (dateFilter) {
            const filterDate = new Date(dateFilter).toDateString();
            filteredLogs = filteredLogs.filter(log =>
                new Date(log.timestamp).toDateString() === filterDate
            );
        }

        const exportData = {
            exportTime: new Date().toISOString(),
            filters: { type: typeFilter, date: dateFilter },
            logs: filteredLogs
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `operation-logs-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showNotification('操作日志导出成功', 'success');
    }

    // 数据导出 - 导出完整数据
    exportData() {
        console.log('=== 开始导出数据 ===');
        console.log('生产数据条数:', this.data.length);
        console.log('操作日志条数:', this.operationLogs.length);
        console.log('原材料记录条数:', this.materialPurchases.length);

        // 创建完整的导出数据包
        const completeExportData = {
            exportTime: new Date().toISOString(),
            exportVersion: '2.0',
            exportSource: 'production-management-system',
            summary: {
                productionRecords: this.data.length,
                operationLogs: this.operationLogs.length,
                materialPurchases: this.materialPurchases.length,
                customAreas: this.customAreas.size,
                dateRange: this.getDataDateRange()
            },
            data: {
                productionData: this.data,
                operationLogs: this.operationLogs,
                materialPurchases: this.materialPurchases,
                customAreas: [...this.customAreas]
            }
        };

        console.log('导出数据包:', completeExportData);

        const blob = new Blob([JSON.stringify(completeExportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `完整数据备份_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);

        // 记录导出操作
        this.addLog('export', '数据导出',
            `导出完整数据包：${this.data.length}条生产记录，${this.operationLogs.length}条操作日志，${this.materialPurchases.length}条原材料记录`);

        this.showNotification(`数据导出成功！包含${this.data.length}条生产记录`, 'success');
    }

    // 获取数据的日期范围
    getDataDateRange() {
        if (this.data.length === 0) {
            return { earliest: null, latest: null };
        }

        const dates = [];

        // 收集所有可能的日期
        this.data.forEach(item => {
            if (item.createdAt) dates.push(new Date(item.createdAt));
            if (item.deadline) dates.push(new Date(item.deadline));
            if (item.timestamp) dates.push(new Date(item.timestamp));
            if (item.date) dates.push(new Date(item.date));
        });

        // 从操作日志中收集日期
        this.operationLogs.forEach(log => {
            if (log.timestamp) dates.push(new Date(log.timestamp));
        });

        // 从原材料记录中收集日期
        this.materialPurchases.forEach(purchase => {
            if (purchase.date) dates.push(new Date(purchase.date));
        });

        if (dates.length === 0) {
            return { earliest: null, latest: null };
        }

        const validDates = dates.filter(date => !isNaN(date));
        if (validDates.length === 0) {
            return { earliest: null, latest: null };
        }

        const earliest = new Date(Math.min(...validDates));
        const latest = new Date(Math.max(...validDates));

        return {
            earliest: earliest.toISOString(),
            latest: latest.toISOString(),
            span: `${earliest.toLocaleDateString()} 到 ${latest.toLocaleDateString()}`
        };
    }

    // 数据导入 - 支持完整数据包和旧格式
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    console.log('导入的数据结构:', imported);

                    // 检查是否为新版完整数据包
                    if (imported.exportVersion && imported.data) {
                        this.importCompleteDataPackage(imported);
                    }
                    // 检查是否为旧版格式（只有生产数据）
                    else if (imported.data && Array.isArray(imported.data)) {
                        this.importLegacyFormat(imported);
                    }
                    // 检查是否为直接的数组格式
                    else if (Array.isArray(imported)) {
                        this.importDirectArrayFormat(imported);
                    }
                    else {
                        this.showNotification('无效的数据格式，请检查文件内容', 'error');
                        console.error('无法识别的数据格式:', imported);
                    }
                } catch (error) {
                    console.error('文件解析失败:', error);
                    this.showNotification(`文件解析失败: ${error.message}`, 'error');
                }
            };

            reader.readAsText(file);
        };

        input.click();
    }

    // 导入完整数据包（新版格式）
    importCompleteDataPackage(imported) {
        const summary = imported.summary || {};
        const data = imported.data || {};

        console.log('导入完整数据包:', summary);

        const confirmMessage = `检测到完整数据包，包含：

• 生产记录：${summary.productionRecords || 0} 条
• 操作日志：${summary.operationLogs || 0} 条
• 原材料记录：${summary.materialPurchases || 0} 条
• 自定义区域：${summary.customAreas || 0} 个
${summary.dateRange ? `• 数据时间范围：${summary.dateRange}` : ''}

导入将覆盖现有数据，确定继续吗？`;

        if (confirm(confirmMessage)) {
            // 导入生产数据
            if (data.productionData && Array.isArray(data.productionData)) {
                this.data = data.productionData;
                this.filteredData = [...this.data];
                console.log('导入生产数据:', this.data.length, '条');
            }

            // 导入操作日志
            if (data.operationLogs && Array.isArray(data.operationLogs)) {
                this.operationLogs = data.operationLogs;
                console.log('导入操作日志:', this.operationLogs.length, '条');
            }

            // 导入原材料记录
            if (data.materialPurchases && Array.isArray(data.materialPurchases)) {
                this.materialPurchases = data.materialPurchases;
                console.log('导入原材料记录:', this.materialPurchases.length, '条');
            }

            // 导入自定义区域
            if (data.customAreas && Array.isArray(data.customAreas)) {
                this.customAreas = new Set(data.customAreas);
                console.log('导入自定义区域:', this.customAreas.size, '个');
            }

            // 清空选择
            this.selectedItems.clear();

            // 保存到本地存储
            this.saveToLocalStorage();
            // 保存操作日志和材料采购记录
            if (this.operationLogs && this.operationLogs.length > 0) {
                localStorage.setItem('operationLogs', JSON.stringify(this.operationLogs));
            }
            if (this.materialPurchases && this.materialPurchases.length > 0) {
                localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));
            }
            localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));

            // 更新界面
            this.renderTable();
            this.updateStats();
            this.renderAreaStats();
            this.renderUnproducedStats();
            this.updateAreaOptions();

            // 记录导入操作
            this.addLog('import', '完整数据包导入',
                `导入完整数据包：${summary.productionRecords}条生产记录，${summary.operationLogs}条日志，${summary.materialPurchases}条原材料记录`);

            this.showNotification(`完整数据包导入成功！共导入${summary.productionRecords}条生产记录`, 'success');
        }
    }

    // 导入旧版格式（只有生产数据）
    importLegacyFormat(imported) {
        if (confirm('导入数据将覆盖现有生产数据，确定继续吗？')) {
            this.data = imported.data;
            this.filteredData = [...this.data];
            this.selectedItems.clear();
            this.saveToLocalStorage();
            this.renderTable();
            this.updateStats();

            this.addLog('import', '旧版数据导入', `导入旧版格式数据：${this.data.length}条记录`);
            this.showNotification(`数据导入成功！共导入${this.data.length}条记录`, 'success');
        }
    }

    // 导入直接数组格式
    importDirectArrayFormat(imported) {
        if (confirm(`检测到${imported.length}条记录，导入将覆盖现有数据，确定继续吗？`)) {
            this.data = imported;
            this.filteredData = [...this.data];
            this.selectedItems.clear();
            this.saveToLocalStorage();
            this.renderTable();
            this.updateStats();

            this.addLog('import', '数组格式数据导入', `导入数组格式数据：${this.data.length}条记录`);
            this.showNotification(`数据导入成功！共导入${this.data.length}条记录`, 'success');
        }
    }

    // 清空所有数据
    clearAllData() {
        const confirmMessage = `⚠️ 警告：此操作将清空所有数据！

包括：
• 所有生产数据记录
• 所有发货记录
• 所有操作日志

此操作不可撤销！

确定要继续吗？`;

        if (confirm(confirmMessage)) {
            // 二次确认
            const secondConfirm = prompt('请输入 "确认清空" 来确认此操作：');
            if (secondConfirm === '确认清空') {
                // 清空所有数据
                this.data = [];
                this.filteredData = [];
                this.selectedItems.clear();
                this.operationLogs = [];

                // 清空本地存储
                localStorage.removeItem('productionData');
                localStorage.removeItem('operationLogs');

                // 重新渲染界面
                this.renderTable();
                this.updateStats();

                // 记录清空操作
                this.addLog('system', '清空所有数据', '用户手动清空了所有生产数据和操作日志');

                this.showNotification('所有数据已清空，您现在可以导入新的数据', 'success');
            } else {
                this.showNotification('操作已取消', 'info');
            }
        }
    }

    // Excel数据导入 - 新版本
    openExcelImportModal() {
        console.log('尝试打开Excel导入模态框');

        const modal = document.getElementById('excelImportModal');
        const overlay = document.getElementById('modalOverlay');

        console.log('模态框元素:', modal);
        console.log('遮罩元素:', overlay);

        if (!modal) {
            console.error('找不到Excel导入模态框元素');
            this.showNotification('Excel导入功能初始化失败', 'error');
            return;
        }

        if (!overlay) {
            console.error('找不到模态框遮罩元素');
            this.showNotification('模态框遮罩初始化失败', 'error');
            return;
        }

        // 重置表单
        this.clearExcelImportForm();

        // 更新区域选项（包含新增区域选项）
        this.updateAreaOptions();

        // 确保Excel导入界面包含新增区域选项
        const importAreaSelect = document.getElementById('importAreaSelect');
        if (importAreaSelect) {
            // 检查是否已有新增选项，如果没有则添加
            const addNewOption = importAreaSelect.querySelector('option[value="__add_new__"]');
            if (!addNewOption) {
                const newOption = document.createElement('option');
                newOption.value = '__add_new__';
                newOption.textContent = '+ 新增区域';
                newOption.style.color = '#059669';
                newOption.style.fontWeight = 'bold';
                importAreaSelect.appendChild(newOption);
                console.log('已添加Excel导入界面的新增区域选项');
            }
        }

        console.log('显示模态框');
        modal.classList.add('active');
        overlay.classList.add('active');

        console.log('模态框已显示，类名:', modal.className);
    }

    closeExcelImportModal() {
        const modal = document.getElementById('excelImportModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        // 清理数据
        this.clearExcelImportForm();
        this.excelImportData = null;
    }

    // 处理Excel导入中的新增区域
    handleNewAreaInImport() {
        const areaName = prompt('请输入新区域名称（如：C4、E2等）：');

        if (!areaName) {
            // 用户取消，重置选择
            document.getElementById('importAreaSelect').value = '';
            return;
        }

        // 验证区域名称格式
        const trimmedName = areaName.trim().toUpperCase();
        if (!trimmedName) {
            this.showNotification('区域名称不能为空', 'error');
            document.getElementById('importAreaSelect').value = '';
            return;
        }

        // 检查区域是否已存在
        if (this.customAreas.has(trimmedName)) {
            this.showNotification(`区域 ${trimmedName} 已存在`, 'warning');
            // 直接选择已存在的区域
            document.getElementById('importAreaSelect').value = trimmedName;
            this.checkImportReadiness();
            return;
        }

        // 添加新区域
        this.customAreas.add(trimmedName);

        // 保存到localStorage
        localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));

        // 更新所有区域选择器
        this.updateAreaOptions();

        // 确保Excel导入界面重新添加新增选项
        const importAreaSelect = document.getElementById('importAreaSelect');
        if (importAreaSelect) {
            const addNewOption = importAreaSelect.querySelector('option[value="__add_new__"]');
            if (!addNewOption) {
                const newOption = document.createElement('option');
                newOption.value = '__add_new__';
                newOption.textContent = '+ 新增区域';
                newOption.style.color = '#059669';
                newOption.style.fontWeight = 'bold';
                importAreaSelect.appendChild(newOption);
            }

            // 选择新添加的区域
            importAreaSelect.value = trimmedName;
        }

        // 记录日志
        this.addLog('area', '新增区域', `在Excel导入中新增区域：${trimmedName}`);

        // 显示成功提示
        this.showNotification(`区域 ${trimmedName} 添加成功`, 'success');

        // 检查导入准备状态
        this.checkImportReadiness();

        console.log('新增区域:', trimmedName, '当前所有区域:', [...this.customAreas]);
    }

    // 生产数据管理功能
    openProductionManagementModal() {
        console.log('打开生产数据管理模态框');

        const modal = document.getElementById('productionManagementModal');
        const overlay = document.getElementById('modalOverlay');

        if (!modal || !overlay) {
            console.error('找不到生产数据管理模态框元素');
            this.showNotification('生产数据管理功能初始化失败', 'error');
            return;
        }

        // 初始化生产数据管理
        this.initProductionManagement();

        // 显示模态框
        modal.classList.add('active');
        overlay.classList.add('active');

        console.log('生产数据管理模态框已显示');
    }

    closeProductionManagementModal() {
        const modal = document.getElementById('productionManagementModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        // 清理选择状态
        this.selectedProductionRecords = new Set();
        this.updateProductionBatchButtons();
    }

    initProductionManagement() {
        // 初始化生产记录数据
        this.productionRecords = this.extractProductionRecords();
        this.filteredProductionRecords = [...this.productionRecords];
        this.selectedProductionRecords = new Set();
        this.currentProductionPage = 1;
        this.productionRecordsPerPage = 10;

        // 更新统计信息
        this.updateProductionStats();

        // 更新筛选器选项
        this.updateProductionFilters();

        // 渲染生产记录表格
        this.renderProductionTable();

        // 绑定事件监听器
        this.bindProductionManagementEvents();
    }

    extractProductionRecords() {
        const records = [];
        let recordId = 1;

        this.data.forEach(item => {
            if (item.produced > 0) {
                // 检查是否有详细的生产记录
                if (item.productionRecords && Array.isArray(item.productionRecords)) {
                    item.productionRecords.forEach(record => {
                        records.push({
                            id: `${item.id}_${recordId++}`,
                            itemId: item.id,
                            spec: item.spec,
                            area: item.area,
                            quantity: record.quantity || 0,
                            date: record.date || new Date().toISOString().split('T')[0],
                            remarks: record.remarks || '',
                            timestamp: record.timestamp || new Date().toISOString()
                        });
                    });
                } else {
                    // 如果没有详细记录，创建一个汇总记录
                    records.push({
                        id: `${item.id}_${recordId++}`,
                        itemId: item.id,
                        spec: item.spec,
                        area: item.area,
                        quantity: item.produced,
                        date: item.lastProductionDate || new Date().toISOString().split('T')[0],
                        remarks: item.productionRemarks || '历史生产记录',
                        timestamp: item.lastProductionTime || new Date().toISOString()
                    });
                }
            }
        });

        return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    updateProductionStats() {
        const totalRecords = this.productionRecords.length;
        const totalQuantity = this.productionRecords.reduce((sum, record) => sum + record.quantity, 0);
        const uniqueSpecs = new Set(this.productionRecords.map(record => record.spec));

        // 按型号分类统计
        const typeStats = {};
        this.productionRecords.forEach(record => {
            const typeMatch = record.spec.match(/^(H\d+)/);
            const type = typeMatch ? typeMatch[1] : '其他';

            if (!typeStats[type]) {
                typeStats[type] = new Set();
            }
            typeStats[type].add(record.spec);
        });

        // 生成型号统计文本
        const typeStatsText = Object.keys(typeStats)
            .sort()
            .map(type => `${type}: ${typeStats[type].size}种`)
            .join(', ');

        document.getElementById('totalProductionRecords').textContent = totalRecords;
        document.getElementById('totalProducedQuantity').textContent = `${this.formatNumber(totalQuantity)} 根`;
        document.getElementById('totalProductionSpecs').textContent = `${uniqueSpecs.size} 种`;
        document.getElementById('totalProductionAreas').textContent = typeStatsText || '暂无数据';
    }

    updateProductionFilters() {
        const specFilter = document.getElementById('productionSpecFilter');
        const areaFilter = document.getElementById('productionAreaFilter');

        // 更新规格筛选器
        const specs = [...new Set(this.productionRecords.map(record => record.spec))].sort();
        specFilter.innerHTML = '<option value="">全部规格</option>';
        specs.forEach(spec => {
            const option = document.createElement('option');
            option.value = spec;
            option.textContent = spec;
            specFilter.appendChild(option);
        });

        // 更新区域筛选器
        const areas = [...new Set(this.productionRecords.map(record => record.area))].sort();
        areaFilter.innerHTML = '<option value="">全部区域</option>';
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = `${area}区域`;
            areaFilter.appendChild(option);
        });
    }

    renderProductionTable() {
        const tableBody = document.getElementById('productionTableBody');
        const startIndex = (this.currentProductionPage - 1) * this.productionRecordsPerPage;
        const endIndex = startIndex + this.productionRecordsPerPage;
        const pageRecords = this.filteredProductionRecords.slice(startIndex, endIndex);

        tableBody.innerHTML = '';

        if (pageRecords.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #6b7280;">
                        <i class="fas fa-inbox" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
                        没有找到生产记录
                    </td>
                </tr>
            `;
            this.updateProductionPagination();
            return;
        }

        pageRecords.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" value="${record.id}"
                           onchange="dataManager.toggleProductionRecordSelection('${record.id}', this.checked)">
                </td>
                <td>${record.spec}</td>
                <td>${record.area}区域</td>
                <td class="quantity-cell">${this.formatNumber(record.quantity)} 根</td>
                <td class="date-cell">${record.date}</td>
                <td>${record.remarks || '-'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-primary" onclick="dataManager.editProductionRecord('${record.id}')">
                        <i class="fas fa-edit"></i>
                        编辑
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="dataManager.deleteProductionRecord('${record.id}')">
                        <i class="fas fa-trash"></i>
                        删除
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        this.updateProductionPagination();
    }

    updateProductionPagination() {
        const totalPages = Math.ceil(this.filteredProductionRecords.length / this.productionRecordsPerPage);

        document.getElementById('currentProductionPage').textContent = this.currentProductionPage;
        document.getElementById('totalProductionPages').textContent = totalPages;

        const prevBtn = document.getElementById('prevProductionPage');
        const nextBtn = document.getElementById('nextProductionPage');

        prevBtn.disabled = this.currentProductionPage <= 1;
        nextBtn.disabled = this.currentProductionPage >= totalPages;
    }

    toggleProductionRecordSelection(recordId, checked) {
        if (checked) {
            this.selectedProductionRecords.add(recordId);
        } else {
            this.selectedProductionRecords.delete(recordId);
        }

        this.updateProductionBatchButtons();
        this.updateSelectAllProductionCheckbox();
    }

    updateProductionBatchButtons() {
        const batchDeleteBtn = document.getElementById('batchDeleteProductionBtn');
        const batchEditBtn = document.getElementById('batchEditProductionBtn');
        const hasSelection = this.selectedProductionRecords.size > 0;

        batchDeleteBtn.disabled = !hasSelection;
        batchEditBtn.disabled = !hasSelection;

        if (hasSelection) {
            batchDeleteBtn.textContent = `批量删除 (${this.selectedProductionRecords.size})`;
            batchEditBtn.textContent = `批量修改 (${this.selectedProductionRecords.size})`;
        } else {
            batchDeleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> 批量删除';
            batchEditBtn.innerHTML = '<i class="fas fa-edit"></i> 批量修改';
        }
    }

    updateSelectAllProductionCheckbox() {
        const selectAllCheckbox = document.getElementById('selectAllProduction');
        const visibleRecords = this.filteredProductionRecords.slice(
            (this.currentProductionPage - 1) * this.productionRecordsPerPage,
            this.currentProductionPage * this.productionRecordsPerPage
        );

        const visibleSelected = visibleRecords.filter(record =>
            this.selectedProductionRecords.has(record.id)
        ).length;

        selectAllCheckbox.checked = visibleRecords.length > 0 && visibleSelected === visibleRecords.length;
        selectAllCheckbox.indeterminate = visibleSelected > 0 && visibleSelected < visibleRecords.length;
    }

    bindProductionManagementEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('closeProductionManagementModal');
        const cancelBtn = document.getElementById('cancelProductionManagementBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeProductionManagementModal());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeProductionManagementModal());
        }

        // 刷新数据按钮
        const refreshBtn = document.getElementById('refreshProductionDataBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.initProductionManagement();
                this.showNotification('生产数据已刷新', 'success');
            });
        }

        // 全选复选框
        const selectAllCheckbox = document.getElementById('selectAllProduction');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                this.toggleAllProductionRecords(e.target.checked);
            });
        }

        // 筛选器
        const specFilter = document.getElementById('productionSpecFilter');
        const areaFilter = document.getElementById('productionAreaFilter');
        const searchInput = document.getElementById('productionSearchInput');

        if (specFilter) {
            specFilter.addEventListener('change', () => this.applyProductionFilters());
        }
        if (areaFilter) {
            areaFilter.addEventListener('change', () => this.applyProductionFilters());
        }
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyProductionFilters());
        }

        // 分页按钮
        const prevBtn = document.getElementById('prevProductionPage');
        const nextBtn = document.getElementById('nextProductionPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentProductionPage > 1) {
                    this.currentProductionPage--;
                    this.renderProductionTable();
                }
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredProductionRecords.length / this.productionRecordsPerPage);
                if (this.currentProductionPage < totalPages) {
                    this.currentProductionPage++;
                    this.renderProductionTable();
                }
            });
        }

        // 批量操作按钮
        const batchDeleteBtn = document.getElementById('batchDeleteProductionBtn');
        const batchEditBtn = document.getElementById('batchEditProductionBtn');

        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => this.batchDeleteProductionRecords());
        }
        if (batchEditBtn) {
            batchEditBtn.addEventListener('click', () => this.batchEditProductionRecords());
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportProductionDataBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportProductionData());
        }
    }

    toggleAllProductionRecords(checked) {
        const visibleRecords = this.filteredProductionRecords.slice(
            (this.currentProductionPage - 1) * this.productionRecordsPerPage,
            this.currentProductionPage * this.productionRecordsPerPage
        );

        visibleRecords.forEach(record => {
            if (checked) {
                this.selectedProductionRecords.add(record.id);
            } else {
                this.selectedProductionRecords.delete(record.id);
            }
        });

        // 更新页面上的复选框
        const checkboxes = document.querySelectorAll('#productionTableBody input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });

        this.updateProductionBatchButtons();
    }

    applyProductionFilters() {
        const specFilter = document.getElementById('productionSpecFilter').value;
        const areaFilter = document.getElementById('productionAreaFilter').value;
        const searchText = document.getElementById('productionSearchInput').value.toLowerCase();

        this.filteredProductionRecords = this.productionRecords.filter(record => {
            const matchesSpec = !specFilter || record.spec === specFilter;
            const matchesArea = !areaFilter || record.area === areaFilter;
            const matchesSearch = !searchText ||
                record.spec.toLowerCase().includes(searchText) ||
                record.area.toLowerCase().includes(searchText) ||
                record.remarks.toLowerCase().includes(searchText);

            return matchesSpec && matchesArea && matchesSearch;
        });

        this.currentProductionPage = 1;
        this.renderProductionTable();
    }

    editProductionRecord(recordId) {
        const record = this.productionRecords.find(r => r.id === recordId);
        if (!record) {
            this.showNotification('找不到生产记录', 'error');
            return;
        }

        // 打开编辑模态框
        const editModal = document.getElementById('editProductionRecordModal');
        const overlay = document.getElementById('modalOverlay');

        if (!editModal) {
            this.showNotification('编辑功能初始化失败', 'error');
            return;
        }

        // 填充表单数据
        document.getElementById('editProductionSpec').value = record.spec;
        document.getElementById('editProductionArea').value = record.area;
        document.getElementById('editProductionQuantity').value = record.quantity;
        document.getElementById('editProductionDate').value = record.date;
        document.getElementById('editProductionRemarks').value = record.remarks || '';

        // 保存当前编辑的记录ID
        this.editingProductionRecordId = recordId;

        // 显示编辑模态框
        editModal.classList.add('active');

        // 绑定编辑表单事件
        this.bindEditProductionRecordEvents();
    }

    bindEditProductionRecordEvents() {
        const form = document.getElementById('editProductionRecordForm');
        const closeBtn = document.getElementById('closeEditProductionRecordModal');
        const cancelBtn = document.getElementById('cancelEditProductionRecordBtn');

        // 移除之前的事件监听器
        form.removeEventListener('submit', this.handleEditProductionRecordSubmit);

        // 添加新的事件监听器
        this.handleEditProductionRecordSubmit = (e) => {
            e.preventDefault();
            this.saveProductionRecordEdit();
        };
        form.addEventListener('submit', this.handleEditProductionRecordSubmit);

        if (closeBtn) {
            closeBtn.onclick = () => this.closeEditProductionRecordModal();
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => this.closeEditProductionRecordModal();
        }
    }

    closeEditProductionRecordModal() {
        const editModal = document.getElementById('editProductionRecordModal');
        editModal.classList.remove('active');
        this.editingProductionRecordId = null;
    }

    saveProductionRecordEdit() {
        const quantity = parseInt(document.getElementById('editProductionQuantity').value);
        const date = document.getElementById('editProductionDate').value;
        const remarks = document.getElementById('editProductionRemarks').value;

        if (!quantity || quantity <= 0) {
            this.showNotification('请输入有效的生产数量', 'error');
            return;
        }

        if (!date) {
            this.showNotification('请选择生产日期', 'error');
            return;
        }

        const record = this.productionRecords.find(r => r.id === this.editingProductionRecordId);
        if (!record) {
            this.showNotification('找不到要编辑的记录', 'error');
            return;
        }

        const oldQuantity = record.quantity;
        const quantityDiff = quantity - oldQuantity;

        // 更新生产记录
        record.quantity = quantity;
        record.date = date;
        record.remarks = remarks;
        record.timestamp = new Date().toISOString();

        // 更新主数据中的生产数量
        const mainItem = this.data.find(item => item.id === record.itemId);
        if (mainItem) {
            mainItem.produced += quantityDiff;

            // 确保生产数量不为负数
            if (mainItem.produced < 0) {
                mainItem.produced = 0;
            }

            // 更新状态
            if (mainItem.produced >= mainItem.planned) {
                mainItem.status = 'completed';
            } else if (mainItem.produced > 0) {
                mainItem.status = 'producing';
            } else {
                mainItem.status = 'planned';
            }

            // 更新生产记录
            if (!mainItem.productionRecords) {
                mainItem.productionRecords = [];
            }

            const existingRecord = mainItem.productionRecords.find(pr =>
                pr.date === record.date && pr.remarks === record.remarks
            );

            if (existingRecord) {
                existingRecord.quantity = quantity;
            } else {
                mainItem.productionRecords.push({
                    quantity: quantity,
                    date: date,
                    remarks: remarks,
                    timestamp: record.timestamp
                });
            }
        }

        // 保存数据
        this.saveToLocalStorage();

        // 记录日志
        this.addLog('edit', '编辑生产记录',
            `修改了 ${record.spec} (${record.area}) 的生产记录：${oldQuantity}根 → ${quantity}根`,
            {
                recordId: record.id,
                spec: record.spec,
                area: record.area,
                oldQuantity: oldQuantity,
                newQuantity: quantity,
                quantityDiff: quantityDiff
            });

        // 关闭编辑模态框
        this.closeEditProductionRecordModal();

        // 刷新生产数据管理界面
        this.initProductionManagement();

        // 更新主界面
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();

        this.showNotification('生产记录修改成功', 'success');
    }

    deleteProductionRecord(recordId) {
        const record = this.productionRecords.find(r => r.id === recordId);
        if (!record) {
            this.showNotification('找不到生产记录', 'error');
            return;
        }

        const confirmMessage = `确定要删除这条生产记录吗？\n\n规格：${record.spec}\n区域：${record.area}\n数量：${record.quantity}根\n日期：${record.date}\n\n此操作不可撤销！`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // 更新主数据中的生产数量
        const mainItem = this.data.find(item => item.id === record.itemId);
        if (mainItem) {
            mainItem.produced -= record.quantity;

            // 确保生产数量不为负数
            if (mainItem.produced < 0) {
                mainItem.produced = 0;
            }

            // 更新状态
            if (mainItem.produced >= mainItem.planned) {
                mainItem.status = 'completed';
            } else if (mainItem.produced > 0) {
                mainItem.status = 'producing';
            } else {
                mainItem.status = 'planned';
            }

            // 从生产记录中移除
            if (mainItem.productionRecords) {
                mainItem.productionRecords = mainItem.productionRecords.filter(pr =>
                    !(pr.date === record.date && pr.quantity === record.quantity && pr.remarks === record.remarks)
                );
            }
        }

        // 从生产记录列表中移除
        this.productionRecords = this.productionRecords.filter(r => r.id !== recordId);
        this.filteredProductionRecords = this.filteredProductionRecords.filter(r => r.id !== recordId);

        // 从选择列表中移除
        this.selectedProductionRecords.delete(recordId);

        // 保存数据
        this.saveToLocalStorage();

        // 记录日志
        this.addLog('delete', '删除生产记录',
            `删除了 ${record.spec} (${record.area}) 的生产记录：${record.quantity}根`,
            {
                recordId: record.id,
                spec: record.spec,
                area: record.area,
                quantity: record.quantity,
                date: record.date
            });

        // 刷新界面
        this.updateProductionStats();
        this.renderProductionTable();
        this.updateProductionBatchButtons();

        // 更新主界面
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();

        this.showNotification('生产记录删除成功', 'success');
    }

    batchDeleteProductionRecords() {
        if (this.selectedProductionRecords.size === 0) {
            this.showNotification('请先选择要删除的记录', 'warning');
            return;
        }

        const selectedRecords = this.productionRecords.filter(r =>
            this.selectedProductionRecords.has(r.id)
        );

        const totalQuantity = selectedRecords.reduce((sum, record) => sum + record.quantity, 0);
        const confirmMessage = `确定要删除选中的 ${selectedRecords.length} 条生产记录吗？\n\n总数量：${totalQuantity}根\n\n此操作不可撤销！`;

        if (!confirm(confirmMessage)) {
            return;
        }

        let deletedCount = 0;
        let totalDeletedQuantity = 0;

        selectedRecords.forEach(record => {
            // 更新主数据中的生产数量
            const mainItem = this.data.find(item => item.id === record.itemId);
            if (mainItem) {
                mainItem.produced -= record.quantity;
                totalDeletedQuantity += record.quantity;

                // 确保生产数量不为负数
                if (mainItem.produced < 0) {
                    mainItem.produced = 0;
                }

                // 更新状态
                if (mainItem.produced >= mainItem.planned) {
                    mainItem.status = 'completed';
                } else if (mainItem.produced > 0) {
                    mainItem.status = 'producing';
                } else {
                    mainItem.status = 'planned';
                }

                // 从生产记录中移除
                if (mainItem.productionRecords) {
                    mainItem.productionRecords = mainItem.productionRecords.filter(pr =>
                        !(pr.date === record.date && pr.quantity === record.quantity && pr.remarks === record.remarks)
                    );
                }
            }

            deletedCount++;
        });

        // 从生产记录列表中移除
        this.productionRecords = this.productionRecords.filter(r =>
            !this.selectedProductionRecords.has(r.id)
        );
        this.filteredProductionRecords = this.filteredProductionRecords.filter(r =>
            !this.selectedProductionRecords.has(r.id)
        );

        // 清空选择
        this.selectedProductionRecords.clear();

        // 保存数据
        this.saveToLocalStorage();

        // 记录日志
        this.addLog('delete', '批量删除生产记录',
            `批量删除了 ${deletedCount} 条生产记录，总计 ${totalDeletedQuantity} 根`,
            {
                deletedCount: deletedCount,
                totalQuantity: totalDeletedQuantity
            });

        // 刷新界面
        this.updateProductionStats();
        this.renderProductionTable();
        this.updateProductionBatchButtons();

        // 更新主界面
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();

        this.showNotification(`批量删除成功！删除了 ${deletedCount} 条记录`, 'success');
    }

    batchEditProductionRecords() {
        if (this.selectedProductionRecords.size === 0) {
            this.showNotification('请先选择要修改的记录', 'warning');
            return;
        }

        const newDate = prompt('请输入新的生产日期（格式：YYYY-MM-DD）：');
        if (!newDate) {
            return;
        }

        // 验证日期格式
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            this.showNotification('日期格式不正确，请使用 YYYY-MM-DD 格式', 'error');
            return;
        }

        const selectedRecords = this.productionRecords.filter(r =>
            this.selectedProductionRecords.has(r.id)
        );

        selectedRecords.forEach(record => {
            record.date = newDate;
            record.timestamp = new Date().toISOString();

            // 更新主数据中的生产记录
            const mainItem = this.data.find(item => item.id === record.itemId);
            if (mainItem && mainItem.productionRecords) {
                const existingRecord = mainItem.productionRecords.find(pr =>
                    pr.quantity === record.quantity && pr.remarks === record.remarks
                );
                if (existingRecord) {
                    existingRecord.date = newDate;
                    existingRecord.timestamp = record.timestamp;
                }
            }
        });

        // 保存数据
        this.saveToLocalStorage();

        // 记录日志
        this.addLog('edit', '批量修改生产记录',
            `批量修改了 ${selectedRecords.length} 条生产记录的日期为 ${newDate}`,
            {
                modifiedCount: selectedRecords.length,
                newDate: newDate
            });

        // 刷新界面
        this.renderProductionTable();

        this.showNotification(`批量修改成功！修改了 ${selectedRecords.length} 条记录`, 'success');
    }

    exportProductionData() {
        const exportData = {
            exportTime: new Date().toISOString(),
            exportType: 'production-records',
            summary: {
                totalRecords: this.productionRecords.length,
                totalQuantity: this.productionRecords.reduce((sum, record) => sum + record.quantity, 0),
                dateRange: this.getProductionDateRange()
            },
            records: this.productionRecords
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `生产记录_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);

        this.addLog('export', '导出生产记录', `导出了 ${this.productionRecords.length} 条生产记录`);
        this.showNotification('生产记录导出成功', 'success');
    }

    getProductionDateRange() {
        if (this.productionRecords.length === 0) {
            return { earliest: null, latest: null };
        }

        const dates = this.productionRecords.map(record => new Date(record.date));
        const earliest = new Date(Math.min(...dates));
        const latest = new Date(Math.max(...dates));

        return {
            earliest: earliest.toISOString().split('T')[0],
            latest: latest.toISOString().split('T')[0],
            span: `${earliest.toLocaleDateString()} 到 ${latest.toLocaleDateString()}`
        };
    }

    clearExcelImportForm() {
        const form = document.getElementById('excelImportForm');
        if (form) {
            form.reset();
        }

        // 重置按钮状态
        document.getElementById('previewExcelBtn').disabled = true;
        document.getElementById('confirmExcelImportBtn').disabled = true;

        // 重置按钮样式
        const confirmBtn = document.getElementById('confirmExcelImportBtn');
        confirmBtn.style.backgroundColor = '';
        confirmBtn.title = '';

        // 隐藏预览区域
        const previewArea = document.getElementById('importPreview');
        if (previewArea) {
            previewArea.style.display = 'none';
        }

        console.log('表单已重置');
    }

    handleExcelFileSelect() {
        const fileInput = document.getElementById('excelFileInput');
        const previewBtn = document.getElementById('previewExcelBtn');
        const typeSelect = document.getElementById('importTypeSelect');
        const areaSelect = document.getElementById('importAreaSelect');

        console.log('Excel文件选择事件触发', fileInput.files.length);

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            console.log('选择的文件:', file.name, file.type, file.size);

            // 检查是否已选择型号和区域
            if (typeSelect.value && areaSelect.value) {
                previewBtn.disabled = false;
                console.log('预览按钮已启用');
            } else {
                previewBtn.disabled = true;
                console.log('预览按钮禁用 - 需要选择型号和区域');
            }

            // 更新文件显示信息
            const fileInfo = document.querySelector('.file-input-info span');
            if (fileInfo) {
                fileInfo.textContent = `已选择: ${file.name}`;
            }
        } else {
            previewBtn.disabled = true;
            document.getElementById('confirmExcelImportBtn').disabled = true;

            // 重置文件显示信息
            const fileInfo = document.querySelector('.file-input-info span');
            if (fileInfo) {
                fileInfo.textContent = '点击选择文件或拖拽文件到此处';
            }
        }

        this.checkImportReadiness();
    }

    // 检查导入准备状态
    checkImportReadiness() {
        const fileInput = document.getElementById('excelFileInput');
        const typeSelect = document.getElementById('importTypeSelect');
        const areaSelect = document.getElementById('importAreaSelect');
        const previewBtn = document.getElementById('previewExcelBtn');
        const confirmBtn = document.getElementById('confirmExcelImportBtn');

        const hasFile = fileInput.files.length > 0;
        const hasArea = areaSelect.value !== '';
        // 型号选择变为可选，支持自动识别
        const hasTypeOrAutoDetect = true; // 总是允许，因为支持自动识别

        console.log('检查导入准备状态:', {
            hasFile,
            selectedType: typeSelect.value || '自动识别',
            hasArea,
            autoDetectMode: !typeSelect.value
        });

        // 只需要文件和区域，型号可以自动识别
        if (hasFile && hasArea) {
            previewBtn.disabled = false;

            // 启用快速导入按钮
            const quickImportBtn = document.getElementById('quickImportBtn');
            if (quickImportBtn) {
                quickImportBtn.disabled = false;
            }

            console.log('条件满足，启用预览和快速导入按钮 (支持自动识别型号)');
        } else {
            previewBtn.disabled = true;

            // 禁用快速导入按钮
            const quickImportBtn = document.getElementById('quickImportBtn');
            if (quickImportBtn) {
                quickImportBtn.disabled = true;
            }

            console.log('条件不满足，禁用预览和快速导入按钮');
        }

        // 确认导入按钮只有在预览数据后才启用
        // confirmBtn 的状态由 showExcelPreview 方法控制
    }

    previewExcelData() {
        console.log('开始预览Excel数据');

        const fileInput = document.getElementById('excelFileInput');
        const typeSelect = document.getElementById('importTypeSelect');
        const areaSelect = document.getElementById('importAreaSelect');

        console.log('检查输入:', {
            hasFile: !!fileInput.files[0],
            type: typeSelect.value,
            area: areaSelect.value
        });

        if (!fileInput.files[0]) {
            this.showNotification('请选择Excel文件', 'error');
            return;
        }

        if (!areaSelect.value) {
            this.showNotification('请选择工地区域', 'error');
            return;
        }

        // 检查XLSX库是否可用
        if (typeof XLSX === 'undefined') {
            console.error('XLSX库未加载');
            this.showNotification('Excel处理库未加载，请刷新页面重试', 'error');
            return;
        }

        const file = fileInput.files[0];
        console.log('开始读取文件:', file.name);

        const reader = new FileReader();

        reader.onerror = (e) => {
            console.error('文件读取失败:', e);
            this.showNotification('文件读取失败', 'error');
        };

        reader.onload = (e) => {
            try {
                console.log('文件读取完成，开始解析Excel');
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                console.log('Excel工作簿解析成功，工作表:', workbook.SheetNames);

                // 获取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // 转换为JSON数据
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                console.log('Excel数据转换完成，行数:', jsonData.length);

                this.processExcelDataForPreview(jsonData, file.name);

            } catch (error) {
                console.error('Excel文件解析失败:', error);
                this.showNotification(`Excel文件解析失败: ${error.message}`, 'error');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    processExcelDataForPreview(jsonData, fileName) {
        if (!jsonData || jsonData.length < 1) {
            this.showNotification('Excel文件内容为空', 'error');
            return;
        }

        console.log('=== Excel文件详细分析 ===');
        console.log('文件名:', fileName);
        console.log('总行数:', jsonData.length);
        console.log('前15行原始数据:');
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
            console.log(`第${i+1}行 (${jsonData[i] ? jsonData[i].length : 0}列):`, jsonData[i]);
            if (jsonData[i] && Array.isArray(jsonData[i])) {
                jsonData[i].forEach((cell, colIndex) => {
                    console.log(`  列${colIndex + 1}: "${cell}" (类型: ${typeof cell})`);
                });
            }
        }

        // 查找数据开始行
        let dataStartIndex = this.findDataStartIndex(jsonData);

        if (dataStartIndex === -1) {
            this.showNotification('无法识别Excel文件的数据格式，请检查文件内容', 'error');
            return;
        }

        console.log(`确定从第${dataStartIndex + 1}行开始解析数据`);

        // 解析数据
        const parsedData = this.parseExcelRows(jsonData, dataStartIndex, fileName);

        console.log('解析结果:', {
            validData: parsedData.validData.length,
            errors: parsedData.errors.length,
            errorDetails: parsedData.errors
        });

        if (parsedData.validData.length === 0) {
            this.showNotification(`Excel文件中没有找到有效的数据行。错误信息：${parsedData.errors.slice(0, 3).join('; ')}`, 'error');
            return;
        }

        // 保存解析结果
        this.excelImportData = parsedData;

        // 显示预览
        this.showExcelPreview(parsedData);

        // 启用确认导入按钮
        document.getElementById('confirmExcelImportBtn').disabled = false;
    }

    findDataStartIndex(jsonData) {
        console.log('查找数据开始行，总行数:', jsonData.length);

        // 查找包含长度和数量数据的行，或者包含规格型号的行
        for (let i = 0; i < Math.min(15, jsonData.length); i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row) || row.length < 2) continue;

            console.log(`检查第${i+1}行:`, row.slice(0, 5));

            let hasSpec = false;
            let hasLength = false;
            let hasQuantity = false;

            for (let j = 0; j < row.length; j++) {
                const cell = this.cleanCellValue(row[j]);

                // 检查是否包含规格型号（如 H100-1000mm）
                if (typeof cell === 'string' && cell.match(/^H\d+-\d+mm?$/i)) {
                    hasSpec = true;
                    console.log(`第${i+1}行找到规格型号:`, cell);
                }

                const num = parseInt(cell);

                // 检查是否为长度值（200-11800之间的200的倍数）
                if (num >= 200 && num <= 11800 && num % 200 === 0) {
                    hasLength = true;
                    console.log(`第${i+1}行找到长度值:`, num);
                }
                // 检查是否为数量值（正整数）
                if (num > 0 && num < 100000) {
                    hasQuantity = true;
                    console.log(`第${i+1}行找到数量值:`, num);
                }
            }

            // 如果找到规格型号和数量，或者长度和数量，则认为是数据行
            if ((hasSpec && hasQuantity) || (hasLength && hasQuantity)) {
                console.log(`确定数据开始行为第${i+1}行`);
                return i;
            }
        }

        // 查找标题行，然后返回下一行
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
            const row = jsonData[i];
            if (row && Array.isArray(row)) {
                const rowText = row.join('').toLowerCase();
                if (rowText.includes('序号') || rowText.includes('规格') ||
                    rowText.includes('长度') || rowText.includes('数量') ||
                    rowText.includes('型号') || rowText.includes('编号')) {
                    console.log(`找到标题行第${i+1}行，数据从第${i+2}行开始`);
                    return i + 1;
                }
            }
        }

        // 如果没找到明确的数据行，尝试从第一行开始解析
        console.log('没有找到明确的标题行，从第1行开始尝试解析数据');
        return 0;
    }

    parseExcelRows(jsonData, startIndex, fileName) {
        const typeSelect = document.getElementById('importTypeSelect');
        const areaSelect = document.getElementById('importAreaSelect');
        const selectedType = typeSelect.value;
        const selectedArea = areaSelect.value;
        const autoDetectType = !selectedType; // 如果没有选择型号，则自动识别

        console.log('开始解析Excel行数据，起始行:', startIndex);
        console.log('Excel数据总行数:', jsonData.length);
        console.log('选择的型号:', selectedType || '自动识别', '区域:', selectedArea);
        console.log('自动识别型号模式:', autoDetectType);

        const validData = [];
        const errors = [];

        // 检查是否为浦东机场肋条标准模版
        const isStandardTemplate = fileName.includes('浦东机场肋条') || fileName.includes('标准模版');
        console.log('是否为标准模版:', isStandardTemplate);

        for (let i = startIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row) || row.length < 2) {
                console.log(`跳过第${i+1}行: 行数据无效`);
                continue;
            }

            console.log(`处理第${i+1}行:`, row);
            console.log(`第${i+1}行原始数据:`, row.map((cell, idx) => `列${idx+1}: "${cell}"`).join(', '));

            try {
                let length = null;
                let quantity = null;
                let spec = null;
                let detectedType = null; // 自动识别的型号

                // 专门针对浦东机场肋条标准模版的解析逻辑
                console.log(`第${i+1}行有${row.length}列数据`);

                // 首先尝试自动识别型号和规格
                if (autoDetectType) {
                    // 自动识别模式：扫描所有列寻找型号和规格信息
                    for (let j = 0; j < row.length; j++) {
                        const cell = this.cleanCellValue(row[j]);

                        // 检查是否为完整规格（如 H100-1400mm, H80-800mm）
                        const fullSpecMatch = cell.match(/^(H\d+)-?(\d+)mm?$/i);
                        if (fullSpecMatch) {
                            detectedType = fullSpecMatch[1].toUpperCase();
                            length = parseInt(fullSpecMatch[2]);
                            spec = `${detectedType}-${length}mm`;
                            console.log(`第${i+1}行第${j+1}列自动识别完整规格: ${spec}`);
                            break;
                        }

                        // 检查是否为单独的型号（如 H100, H80）
                        const typeMatch = cell.match(/^H(\d+)$/i);
                        if (typeMatch) {
                            detectedType = cell.toUpperCase();
                            console.log(`第${i+1}行第${j+1}列自动识别型号: ${detectedType}`);
                        }
                    }
                }

                // 标准模版格式：A列序号 | B列型号 | C列长度 | D列数量
                if (row.length >= 4) {
                    const colA = this.cleanCellValue(row[0]); // 序号
                    const colB = this.cleanCellValue(row[1]); // 型号
                    const colC = this.cleanCellValue(row[2]); // 长度
                    const colD = this.cleanCellValue(row[3]); // 数量

                    console.log(`第${i+1}行各列内容: A="${colA}", B="${colB}", C="${colC}", D="${colD}"`);
                    console.log(`第${i+1}行各列类型: A=${typeof colA}, B=${typeof colB}, C=${typeof colC}, D=${typeof colD}`);

                    // 如果还没有识别到规格，尝试从B列识别型号，C列识别长度
                    if (!spec) {
                        // 检查B列是否为型号（H100, H80等）
                        const typeMatch = colB.match(/^H(\d+)$/i);
                        if (typeMatch) {
                            detectedType = colB.toUpperCase();
                            console.log(`第${i+1}行B列识别型号: ${detectedType}`);
                        }

                        // 检查C列是否为长度
                        const lengthNum = parseInt(colC);
                        if (lengthNum >= 200 && lengthNum <= 11800) {
                            length = lengthNum;
                            console.log(`第${i+1}行C列识别长度: ${length}mm`);
                        }

                        // 如果有型号和长度，生成规格
                        if (detectedType && length) {
                            spec = `${detectedType}-${length}mm`;
                            console.log(`第${i+1}行生成规格: ${spec}`);
                        } else if (!autoDetectType && selectedType && length) {
                            // 如果是手动选择型号模式，使用选择的型号
                            spec = `${selectedType}-${length}mm`;
                            console.log(`第${i+1}行使用选择型号生成规格: ${spec}`);
                        }
                    }

                    // 检查D列数量
                    const quantityNum = parseInt(colD);
                    if (quantityNum > 0 && quantityNum < 100000) {
                        quantity = quantityNum;
                        console.log(`第${i+1}行D列识别数量: ${quantity}根`);
                    } else {
                        console.error(`第${i+1}行D列数量无效: "${colD}" -> ${quantityNum}`);
                    }
                }

                // 如果还没有识别到规格，尝试更灵活的解析
                if (!spec) {
                    // 尝试在所有列中寻找长度和型号信息
                    for (let j = 0; j < row.length; j++) {
                        const cell = this.cleanCellValue(row[j]);

                        // 尝试识别长度
                        const num = parseInt(cell);
                        if (!length && num >= 200 && num <= 11800 && num % 200 === 0) {
                            length = num;
                            console.log(`第${i+1}行第${j+1}列识别长度: ${length}mm`);
                        }

                        // 尝试识别数量
                        if (!quantity && num > 0 && num < 100000 && num !== length) {
                            quantity = num;
                            console.log(`第${i+1}行第${j+1}列识别数量: ${quantity}根`);
                        }
                    }

                    // 如果有长度，生成规格
                    if (length) {
                        if (detectedType) {
                            spec = `${detectedType}-${length}mm`;
                            console.log(`第${i+1}行使用自动识别型号生成规格: ${spec}`);
                        } else if (!autoDetectType && selectedType) {
                            spec = `${selectedType}-${length}mm`;
                            console.log(`第${i+1}行使用选择型号生成规格: ${spec}`);
                        }
                    }
                }

                // 如果解析失败，记录错误
                if (!spec || !quantity) {
                    const missingInfo = [];
                    if (!spec) missingInfo.push('规格/型号/长度');
                    if (!quantity) missingInfo.push('数量');

                    const error = `第${i+1}行: 无法识别${missingInfo.join('和')} (行数据: ${row.slice(0, 6).join(', ')})`;
                    errors.push(error);
                    console.warn(error);
                    continue;
                }



                const newRecord = {
                    spec: spec,
                    area: selectedArea,
                    planned: quantity,
                    produced: 0,
                    status: 'planned',
                    deadline: '',
                    remarks: `从Excel导入: ${fileName}`,
                    shipped: 0,
                    shippingRecords: []
                };

                validData.push(newRecord);

                console.log(`第${i+1}行解析成功: ${spec} - ${quantity}根`);
                console.log(`第${i+1}行创建记录:`, newRecord);

            } catch (error) {
                const errorMsg = `第${i+1}行: 解析失败 - ${error.message}`;
                errors.push(errorMsg);
                console.error(errorMsg, error);
            }
        }

        console.log('Excel解析完成，有效数据:', validData.length, '错误:', errors.length);
        return { validData, errors, fileName };
    }

    // 解析标准模版行数据
    parseStandardTemplateRow(row, selectedType, selectedArea) {
        // 标准模版可能的列结构：
        // 序号 | 规格型号 | 长度 | 数量 | 备注
        // 或者：序号 | 长度 | 数量 | 备注

        for (let i = 0; i < row.length; i++) {
            const cell = this.cleanCellValue(row[i]);

            // 查找规格型号列（如 H100-1000mm）
            const specMatch = cell.match(/^(H\d+)-(\d+)mm?$/i);
            if (specMatch) {
                const spec = `${specMatch[1].toUpperCase()}-${specMatch[2]}mm`;

                // 在后续列中查找数量
                for (let j = i + 1; j < row.length; j++) {
                    const quantityCell = this.cleanCellValue(row[j]);
                    const quantity = parseInt(quantityCell);

                    if (quantity > 0 && quantity < 100000) {
                        return {
                            spec: spec,
                            area: selectedArea,
                            planned: quantity,
                            produced: 0,
                            status: 'planned',
                            deadline: '',
                            remarks: `从标准模版导入`,
                            shipped: 0,
                            shippingRecords: []
                        };
                    }
                }
            }
        }

        // 如果没有找到完整规格，尝试查找长度和数量
        let length = null;
        let quantity = null;

        for (let i = 0; i < row.length; i++) {
            const cell = this.cleanCellValue(row[i]);
            const num = parseInt(cell);

            if (!length && num >= 200 && num <= 11800 && num % 200 === 0) {
                length = num;
            }
            if (!quantity && num > 0 && num < 100000 && num !== length) {
                quantity = num;
            }
        }

        if (length && quantity) {
            return {
                spec: `${selectedType}-${length}mm`,
                area: selectedArea,
                planned: quantity,
                produced: 0,
                status: 'planned',
                deadline: '',
                remarks: `从标准模版导入`,
                shipped: 0,
                shippingRecords: []
            };
        }

        return null;
    }

    // 宽松的行解析方法
    relaxedParseRow(row, selectedType) {
        console.log('尝试宽松解析行:', row);

        let possibleLengths = [];
        let possibleQuantities = [];

        for (let i = 0; i < row.length; i++) {
            const cell = this.cleanCellValue(row[i]);

            // 尝试解析各种可能的数字格式
            let num = null;

            // 直接解析数字
            if (!isNaN(cell) && cell !== '') {
                num = parseFloat(cell);
            }

            // 解析包含单位的数字（如 "1000mm", "1000毫米"）
            const unitMatch = cell.match(/(\d+)\s*(mm|毫米|米)?/i);
            if (unitMatch) {
                num = parseInt(unitMatch[1]);
                if (unitMatch[2] && (unitMatch[2].toLowerCase() === '米' || unitMatch[2] === 'm')) {
                    num = num * 1000; // 米转毫米
                }
            }

            if (num !== null && !isNaN(num)) {
                // 判断是否为长度值
                if (num >= 200 && num <= 11800) {
                    // 如果是200的倍数，很可能是长度
                    if (num % 200 === 0) {
                        possibleLengths.push({ value: num, confidence: 'high', index: i });
                    } else if (num >= 1000 && num <= 12000) {
                        // 可能是以毫米为单位的长度，但不是200的倍数
                        possibleLengths.push({ value: num, confidence: 'medium', index: i });
                    }
                }

                // 判断是否为数量值
                if (num > 0 && num < 10000 && Number.isInteger(num)) {
                    possibleQuantities.push({ value: num, confidence: 'high', index: i });
                }
            }
        }

        console.log('可能的长度值:', possibleLengths);
        console.log('可能的数量值:', possibleQuantities);

        // 选择最可能的长度和数量
        let bestLength = null;
        let bestQuantity = null;

        // 优先选择高置信度的长度
        const highConfidenceLengths = possibleLengths.filter(l => l.confidence === 'high');
        if (highConfidenceLengths.length > 0) {
            bestLength = highConfidenceLengths[0].value;
        } else if (possibleLengths.length > 0) {
            bestLength = possibleLengths[0].value;
        }

        // 选择数量（避免与长度相同的值）
        for (const qty of possibleQuantities) {
            if (qty.value !== bestLength) {
                bestQuantity = qty.value;
                break;
            }
        }

        // 如果没有找到合适的数量，但有长度，尝试使用其他数值
        if (bestLength && !bestQuantity && possibleQuantities.length > 0) {
            bestQuantity = possibleQuantities[0].value;
        }

        if (bestLength && bestQuantity) {
            const spec = `${selectedType}-${bestLength}mm`;
            console.log('宽松解析成功:', { spec, quantity: bestQuantity });
            return { spec, quantity: bestQuantity };
        }

        console.log('宽松解析失败');
        return null;
    }

    cleanCellValue(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    showExcelPreview(parsedData) {
        console.log('=== 显示Excel预览 ===');
        console.log('解析数据总数:', parsedData.validData.length);
        console.log('前5条数据详情:');
        parsedData.validData.slice(0, 5).forEach((item, index) => {
            console.log(`预览第${index + 1}条: ${item.spec} - 计划${item.planned}根 (区域:${item.area})`);
        });

        const previewArea = document.getElementById('importPreview');
        const totalRowsSpan = document.getElementById('previewTotalRows');
        const tableHead = document.getElementById('previewTableHead');
        const tableBody = document.getElementById('previewTableBody');
        const confirmBtn = document.getElementById('confirmExcelImportBtn');

        // 显示预览区域
        previewArea.style.display = 'block';
        totalRowsSpan.textContent = parsedData.validData.length;

        // 设置表头
        tableHead.innerHTML = `
            <tr>
                <th>规格型号</th>
                <th>工地区域</th>
                <th>计划数量</th>
                <th>备注</th>
            </tr>
        `;

        // 显示前5行数据
        tableBody.innerHTML = '';
        const previewCount = Math.min(5, parsedData.validData.length);

        for (let i = 0; i < previewCount; i++) {
            const item = parsedData.validData[i];
            console.log(`渲染预览第${i+1}行:`, {
                spec: item.spec,
                area: item.area,
                planned: item.planned,
                plannedType: typeof item.planned,
                formatted: this.formatNumber(item.planned)
            });

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.spec}</td>
                <td>${item.area}</td>
                <td>${this.formatNumber(item.planned)}</td>
                <td>${item.remarks}</td>
            `;
            tableBody.appendChild(row);
        }

        // 如果有更多数据，显示省略提示
        if (parsedData.validData.length > 5) {
            const moreRow = document.createElement('tr');
            moreRow.innerHTML = `
                <td colspan="4" style="text-align: center; color: #6b7280; font-style: italic;">
                    ... 还有 ${parsedData.validData.length - 5} 行数据
                </td>
            `;
            tableBody.appendChild(moreRow);
        }

        // 启用确认导入按钮
        if (parsedData.validData.length > 0) {
            confirmBtn.disabled = false;
            console.log('启用确认导入按钮');
        } else {
            confirmBtn.disabled = true;
            console.log('禁用确认导入按钮 - 没有有效数据');
        }

        // 显示错误信息
        if (parsedData.errors.length > 0) {
            console.warn('Excel导入错误:', parsedData.errors);
            this.showNotification(`预览完成，发现 ${parsedData.errors.length} 个错误行`, 'warning');
        } else {
            this.showNotification(`预览完成，共 ${parsedData.validData.length} 条有效数据`, 'success');
        }
    }

    confirmExcelImport() {
        console.log('确认导入函数被调用');
        console.log('当前导入数据:', this.excelImportData);

        if (!this.excelImportData || !this.excelImportData.validData.length) {
            this.showNotification('没有可导入的数据，请先预览Excel文件', 'error');
            return;
        }

        const remarks = document.getElementById('importRemarks').value;
        const importData = this.excelImportData.validData;

        // 添加备注到每条记录
        if (remarks) {
            importData.forEach(item => {
                item.remarks += ` | ${remarks}`;
            });
        }

        // 合并相同规格的数据
        const mergedData = this.mergeImportData(importData);

        // 添加到现有数据（不覆盖）
        this.addImportedDataToExisting(mergedData);

        // 记录日志
        this.addLog('import', 'Excel数据导入',
            `从Excel文件 "${this.excelImportData.fileName}" 导入了 ${mergedData.length} 条生产计划`,
            {
                fileName: this.excelImportData.fileName,
                recordCount: mergedData.length,
                totalQuantity: mergedData.reduce((sum, item) => sum + item.planned, 0)
            });

        // 保存并更新界面
        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();

        // 关闭模态框
        this.closeExcelImportModal();

        this.showNotification(`Excel数据导入成功！共导入 ${mergedData.length} 条记录`, 'success');
    }

    // 快速导入Excel（跳过预览直接导入）
    quickImportExcel() {
        console.log('开始快速导入Excel');

        // 检查XLSX库是否可用
        if (typeof XLSX === 'undefined') {
            console.error('XLSX库未加载');
            this.showNotification('Excel处理库未加载，请刷新页面重试', 'error');
            return;
        }

        const fileInput = document.getElementById('excelFileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showNotification('请先选择Excel文件', 'error');
            return;
        }

        console.log('快速导入文件:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                console.log('快速导入 - Excel数据读取完成');

                // 直接处理数据，不显示预览
                this.processQuickImport(jsonData, file.name);

            } catch (error) {
                console.error('Excel文件读取失败:', error);
                this.showNotification('Excel文件读取失败，请检查文件格式', 'error');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // 处理快速导入
    processQuickImport(jsonData, fileName) {
        if (!jsonData || jsonData.length < 1) {
            this.showNotification('Excel文件内容为空', 'error');
            return;
        }

        console.log('快速导入 - 开始处理数据');

        // 查找数据开始行
        let dataStartIndex = this.findDataStartIndex(jsonData);

        if (dataStartIndex === -1) {
            this.showNotification('无法识别Excel文件的数据格式，请使用预览模式检查', 'error');
            return;
        }

        // 解析数据
        const parsedData = this.parseExcelRows(jsonData, dataStartIndex, fileName);

        if (parsedData.validData.length === 0) {
            this.showNotification(`Excel文件中没有找到有效的数据行。请使用预览模式查看详细错误`, 'error');
            return;
        }

        console.log(`快速导入 - 解析成功，共${parsedData.validData.length}条数据`);

        // 直接导入数据
        const remarks = document.getElementById('importRemarks').value;
        const importData = parsedData.validData;

        // 添加备注到每条记录
        if (remarks) {
            importData.forEach(item => {
                item.remarks += ` | ${remarks}`;
            });
        }

        // 合并相同规格的数据
        const mergedData = this.mergeImportData(importData);

        // 添加到现有数据
        this.addImportedDataToExisting(mergedData);

        // 记录日志
        this.addLog('import', 'Excel快速导入',
            `快速导入Excel文件 "${fileName}"，共导入 ${mergedData.length} 条生产计划`,
            {
                fileName: fileName,
                recordCount: mergedData.length,
                totalQuantity: mergedData.reduce((sum, item) => sum + item.planned, 0)
            });

        // 保存并更新界面
        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();

        // 关闭模态框
        this.closeExcelImportModal();

        this.showNotification(`Excel快速导入成功！共导入 ${mergedData.length} 条记录`, 'success');
    }

    mergeImportData(importData) {
        const mergedMap = new Map();

        importData.forEach(record => {
            const key = `${record.spec}-${record.area}`;
            if (mergedMap.has(key)) {
                // 合并相同规格的数量
                mergedMap.get(key).planned += record.planned;
            } else {
                mergedMap.set(key, { ...record });
            }
        });

        return Array.from(mergedMap.values());
    }

    addImportedDataToExisting(importedData) {
        importedData.forEach(newItem => {
            // 检查是否已存在相同规格和区域的记录
            const existingIndex = this.data.findIndex(item =>
                item.spec === newItem.spec && item.area === newItem.area
            );

            if (existingIndex !== -1) {
                // 如果存在，增加计划数量
                this.data[existingIndex].planned += newItem.planned;
                this.data[existingIndex].remarks += ` | 追加导入: ${newItem.planned}根`;
            } else {
                // 如果不存在，添加新记录
                const newId = this.getNextId();
                this.data.push({
                    id: newId,
                    ...newItem
                });
            }
        });

        // 更新过滤数据
        this.filteredData = [...this.data];
    }

    getNextId() {
        if (this.data.length === 0) return 1;
        return Math.max(...this.data.map(item => item.id)) + 1;
    }

    // 区域管理功能
    setupAreaManagement() {
        // 为计划模态框的区域选择添加事件监听
        const planAreaSelect = document.getElementById('planAreaInput');
        if (planAreaSelect) {
            planAreaSelect.addEventListener('change', (e) => {
                if (e.target.value === '__add_new__') {
                    this.addNewArea(planAreaSelect);
                }
            });
        }

        // 为生产模态框的区域选择添加事件监听
        const areaSelect = document.getElementById('areaInput');
        if (areaSelect) {
            areaSelect.addEventListener('change', (e) => {
                if (e.target.value === '__add_new__') {
                    this.addNewArea(areaSelect);
                }
            });
        }

        // 初始化区域统计
        this.renderAreaStats();
    }

    addNewArea(selectElement) {
        const newArea = prompt('请输入新的工地区域名称（例如：D8、F1等）：');

        if (newArea && newArea.trim()) {
            const areaName = newArea.trim().toUpperCase();

            // 验证区域名称格式（字母+数字）
            if (!/^[A-Z]\d+$/.test(areaName)) {
                this.showNotification('区域名称格式不正确，请使用字母+数字格式（如C1、E3）', 'error');
                selectElement.value = '';
                return;
            }

            // 检查是否已存在
            if (this.customAreas.has(areaName)) {
                this.showNotification('该区域已存在', 'warning');
                selectElement.value = areaName;
                return;
            }

            // 添加新区域
            this.customAreas.add(areaName);
            this.updateAreaOptions();
            selectElement.value = areaName;

            // 保存到本地存储
            localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));

            this.showNotification(`成功添加新区域：${areaName}`, 'success');

            // 记录日志
            this.addLog('system', '新增工地区域', `添加了新的工地区域：${areaName}`);
        } else {
            selectElement.value = '';
        }
    }

    updateAreaOptions() {
        const selects = ['planAreaInput', 'areaInput', 'areaFilter', 'importAreaSelect'];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                const isFilter = selectId === 'areaFilter';
                const isImport = selectId === 'importAreaSelect';

                // 清空现有选项（保留第一个默认选项）
                if (isFilter) {
                    select.innerHTML = '<option value="">全部区域</option>';
                } else {
                    select.innerHTML = '<option value="">请选择工地区域</option>';
                }

                // 添加所有区域选项（按字母数字排序）
                const sortedAreas = [...this.customAreas].sort();
                sortedAreas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = `${area}区域`;
                    select.appendChild(option);
                });

                // 为非筛选器添加"新增区域"选项（包括Excel导入界面）
                if (!isFilter) {
                    const addOption = document.createElement('option');
                    addOption.value = '__add_new__';
                    addOption.textContent = '+ 新增区域';
                    addOption.style.color = '#059669';
                    addOption.style.fontWeight = 'bold';
                    select.appendChild(addOption);
                }

                // 恢复之前的选择
                if (currentValue && currentValue !== '__add_new__') {
                    select.value = currentValue;
                }
            }
        });
    }

    loadCustomAreas() {
        try {
            const savedAreas = localStorage.getItem('customAreas');
            if (savedAreas) {
                this.customAreas = new Set(JSON.parse(savedAreas));
            }
        } catch (error) {
            console.error('加载自定义区域失败:', error);
        }
    }

    renderAreaStats() {
        const container = document.getElementById('areaCardsContainer');
        const totalAreasSpan = document.getElementById('totalAreas');

        if (!container) return;

        // 统计各区域数据
        const areaStats = this.calculateAreaStats();

        // 更新区域总数
        if (totalAreasSpan) {
            totalAreasSpan.textContent = areaStats.length;
        }

        // 清空容器
        container.innerHTML = '';

        if (areaStats.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-map-marker-alt" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                    <h3 style="margin: 0 0 0.5rem 0;">暂无区域数据</h3>
                    <p style="margin: 0;">添加生产计划后，这里将显示各区域的统计信息</p>
                </div>
            `;
            return;
        }

        // 获取保存的区域排序
        const savedOrder = this.getAreaPriorityOrder();

        // 按保存的排序重新排列区域统计
        if (savedOrder.length > 0) {
            areaStats.sort((a, b) => {
                const aIndex = savedOrder.indexOf(a.area);
                const bIndex = savedOrder.indexOf(b.area);
                // 如果区域不在保存的排序中，放到最后
                if (aIndex === -1 && bIndex === -1) return 0;
                if (aIndex === -1) return 1;
                if (bIndex === -1) return -1;
                return aIndex - bIndex;
            });
        }

        // 生成区域卡片
        areaStats.forEach((areaStat, index) => {
            const card = this.createAreaCard(areaStat, index + 1);
            container.appendChild(card);
        });

        // 初始化拖拽排序功能
        this.initAreaDragSort();
    }

    calculateAreaStats() {
        const areaMap = new Map();

        // 统计每个区域的数据
        this.data.forEach(item => {
            if (!areaMap.has(item.area)) {
                areaMap.set(item.area, {
                    area: item.area,
                    totalDemand: 0,
                    totalDemandMeters: 0,
                    produced: 0,
                    producedMeters: 0,
                    pending: 0,
                    pendingMeters: 0,
                    completionRate: 0,
                    status: 'pending',
                    recordCount: 0
                });
            }

            const areaStat = areaMap.get(item.area);
            const length = this.extractLengthFromSpec(item.spec);

            areaStat.totalDemand += item.planned;
            areaStat.totalDemandMeters += (item.planned * length / 1000);
            areaStat.produced += item.produced;
            areaStat.producedMeters += (item.produced * length / 1000);
            areaStat.recordCount++;
        });

        // 计算衍生数据
        areaMap.forEach(areaStat => {
            areaStat.pending = areaStat.totalDemand - areaStat.produced;
            areaStat.pendingMeters = areaStat.totalDemandMeters - areaStat.producedMeters;
            areaStat.completionRate = areaStat.totalDemand > 0 ?
                ((areaStat.produced / areaStat.totalDemand) * 100) : 0;

            // 确定状态
            if (areaStat.completionRate >= 100) {
                areaStat.status = 'completed';
            } else if (areaStat.completionRate > 0) {
                areaStat.status = 'active';
            } else {
                areaStat.status = 'pending';
            }
        });

        // 转换为数组并排序（按完成率降序）
        return Array.from(areaMap.values()).sort((a, b) => b.completionRate - a.completionRate);
    }

    extractLengthFromSpec(spec) {
        if (!spec) return 0;
        const match = spec.match(/(\d+)mm/);
        return match ? parseInt(match[1]) : 0;
    }

    createAreaCard(areaStat, priority = 0) {
        const card = document.createElement('div');
        card.className = 'area-card';
        card.draggable = true; // 启用拖拽
        card.dataset.area = areaStat.area; // 添加区域数据属性
        card.dataset.priority = priority; // 添加优先级指示

        const statusText = {
            'completed': '已完成',
            'active': '生产中',
            'pending': '待开始'
        };

        card.innerHTML = `
            <div class="area-card-header">
                <div class="area-card-title-wrapper">
                    <i class="fas fa-grip-vertical area-drag-handle" title="拖拽排序 - 当前优先级: ${priority}"></i>
                    <h4 class="area-name editable-area-name"
                        onclick="dataManager.editAreaName('${areaStat.area}', this)"
                        title="点击编辑区域名称"
                        style="cursor: pointer; border: 1px solid transparent; padding: 2px 4px; border-radius: 4px;"
                        onmouseover="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.borderColor='#3b82f6'"
                        onmouseout="this.style.backgroundColor=''; this.style.borderColor='transparent'"
                    >${areaStat.area}区域</h4>
                    <span class="priority-badge" title="优先级排序">#${priority}</span>
                </div>
                <span class="area-status ${areaStat.status}">${statusText[areaStat.status]}</span>
            </div>

            <div class="area-metrics">
                <div class="area-metric">
                    <div class="area-metric-value total">${this.formatNumber(areaStat.totalDemandMeters.toFixed(1))}</div>
                    <div class="area-metric-label">总需求(m)</div>
                </div>
                <div class="area-metric">
                    <div class="area-metric-value produced">${this.formatNumber(areaStat.producedMeters.toFixed(1))}</div>
                    <div class="area-metric-label">已生产(m)</div>
                </div>
                <div class="area-metric">
                    <div class="area-metric-value pending">${this.formatNumber(areaStat.pendingMeters.toFixed(1))}</div>
                    <div class="area-metric-label">未生产(m)</div>
                </div>
            </div>

            <div class="area-progress">
                <div class="area-progress-bar">
                    <div class="area-progress-fill" style="width: ${areaStat.completionRate}%"></div>
                </div>
                <div class="area-progress-text">
                    <span>完成率: ${areaStat.completionRate.toFixed(1)}%</span>
                    <span>${areaStat.recordCount} 个规格</span>
                </div>
            </div>

            <div class="area-card-actions">
                <button class="area-action-btn primary" onclick="dataManager.filterByArea('${areaStat.area}')">
                    <i class="fas fa-eye"></i>
                    查看详情
                </button>
                <button class="area-action-btn secondary" onclick="dataManager.addProductionForArea('${areaStat.area}')">
                    <i class="fas fa-plus"></i>
                    新增生产
                </button>
                <button class="area-action-btn danger" onclick="dataManager.confirmDeleteArea('${areaStat.area}', ${areaStat.recordCount})">
                    <i class="fas fa-trash-alt"></i>
                    删除区域
                </button>
            </div>
        `;

        return card;
    }

    filterByArea(area) {
        // 设置区域筛选器并应用筛选
        const areaFilter = document.getElementById('areaFilter');
        if (areaFilter) {
            areaFilter.value = area;
            this.applyFilters();
        }

        // 滚动到数据表格
        const dataSection = document.querySelector('.data-management-section');
        if (dataSection) {
            dataSection.scrollIntoView({ behavior: 'smooth' });
        }

        this.showNotification(`已筛选显示 ${area} 区域的数据`, 'info');
    }

    addProductionForArea(area) {
        // 打开新增生产模态框并预设区域
        this.openProductionModal();

        // 预设区域选择
        setTimeout(() => {
            const areaSelect = document.getElementById('areaInput');
            if (areaSelect) {
                areaSelect.value = area;
            }
        }, 100);
    }

    // 确认删除区域
    confirmDeleteArea(area, recordCount) {
        const message = `确定要删除 ${area} 区域吗？\n\n此操作将：\n• 删除该区域的所有 ${recordCount} 个订单\n• 删除所有相关的生产记录\n• 删除所有相关的发货记录\n\n此操作不可撤销！`;

        if (confirm(message)) {
            this.deleteArea(area);
        }
    }

    // 删除区域及其所有数据
    deleteArea(area) {
        console.log(`开始删除区域: ${area}`);

        // 统计删除前的数据
        const itemsToDelete = this.data.filter(item => item.area === area);
        const deleteCount = itemsToDelete.length;

        if (deleteCount === 0) {
            this.showNotification(`${area} 区域没有数据需要删除`, 'info');
            return;
        }

        // 统计删除的数据详情
        let totalPlanned = 0;
        let totalProduced = 0;
        let totalShipped = 0;
        const deletedSpecs = new Set();

        itemsToDelete.forEach(item => {
            totalPlanned += item.planned;
            totalProduced += item.produced;
            totalShipped += item.shipped;
            deletedSpecs.add(item.spec);
        });

        // 执行删除操作
        this.data = this.data.filter(item => item.area !== area);
        this.filteredData = [...this.data];

        // 从自定义区域列表中移除（如果存在）
        if (this.customAreas.has(area)) {
            this.customAreas.delete(area);
            localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));
        }

        // 记录删除操作日志
        this.addLog('delete', '删除区域',
            `删除了 ${area} 区域及其所有数据：${deleteCount} 个订单，${deletedSpecs.size} 个规格`,
            {
                deletedArea: area,
                deletedCount: deleteCount,
                deletedSpecs: Array.from(deletedSpecs),
                totalPlanned: totalPlanned,
                totalProduced: totalProduced,
                totalShipped: totalShipped
            });

        // 保存数据并更新界面
        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();
        this.updateAreaOptions();

        // 显示删除结果
        this.showNotification(
            `成功删除 ${area} 区域！删除了 ${deleteCount} 个订单，涉及 ${deletedSpecs.size} 个规格`,
            'success'
        );

        console.log(`区域删除完成: ${area}，删除了 ${deleteCount} 个订单`);
    }

    // 编辑区域名称
    editAreaName(currentArea, nameElement) {
        // 防止在拖拽时触发编辑
        if (nameElement.closest('.area-card').classList.contains('dragging')) {
            return;
        }

        const currentName = currentArea;
        const newName = prompt(`请输入新的区域名称：\n\n当前名称：${currentName}\n\n注意：修改后将在整个系统内联动更新`, currentName);

        if (!newName || newName.trim() === '') {
            return;
        }

        const trimmedName = newName.trim().toUpperCase();

        // 验证新名称格式（可以是字母+数字，或者更灵活的格式）
        if (!/^[A-Z0-9]+[A-Z0-9]*$/.test(trimmedName)) {
            this.showNotification('区域名称格式不正确，请使用字母和数字组合（如D53F、C1、E3等）', 'error');
            return;
        }

        // 检查新名称是否已存在
        if (trimmedName !== currentName && this.data.some(item => item.area === trimmedName)) {
            this.showNotification(`区域名称 "${trimmedName}" 已存在，请使用其他名称`, 'error');
            return;
        }

        // 如果名称没有变化，直接返回
        if (trimmedName === currentName) {
            return;
        }

        // 确认修改
        const affectedCount = this.data.filter(item => item.area === currentName).length;
        const confirmMessage = `确定要将区域名称从 "${currentName}" 修改为 "${trimmedName}" 吗？\n\n此操作将影响：\n• ${affectedCount} 个订单记录\n• 所有相关的生产记录\n• 所有相关的发货记录\n• 区域优先级排序\n\n修改后将在整个系统内联动更新。`;

        if (!confirm(confirmMessage)) {
            return;
        }

        this.updateAreaName(currentName, trimmedName);
    }

    // 更新区域名称（系统内联动）
    updateAreaName(oldName, newName) {
        console.log(`开始更新区域名称: ${oldName} → ${newName}`);

        let updatedCount = 0;

        // 1. 更新主数据中的区域名称
        this.data.forEach(item => {
            if (item.area === oldName) {
                item.area = newName;
                updatedCount++;
            }
        });

        // 2. 更新过滤数据
        this.filteredData.forEach(item => {
            if (item.area === oldName) {
                item.area = newName;
            }
        });

        // 3. 更新生产记录中的区域名称
        if (this.productionRecords && this.productionRecords.length > 0) {
            this.productionRecords.forEach(record => {
                if (record.area === oldName) {
                    record.area = newName;
                }
            });
        }

        // 4. 更新发货历史中的区域名称
        const shippingHistory = JSON.parse(localStorage.getItem('shippingHistory') || '[]');
        let shippingUpdated = false;
        shippingHistory.forEach(shipment => {
            if (shipment.items) {
                shipment.items.forEach(item => {
                    if (item.area === oldName) {
                        item.area = newName;
                        shippingUpdated = true;
                    }
                });
            }
        });

        if (shippingUpdated) {
            localStorage.setItem('shippingHistory', JSON.stringify(shippingHistory));
        }

        // 5. 更新自定义区域列表
        if (this.customAreas.has(oldName)) {
            this.customAreas.delete(oldName);
            this.customAreas.add(newName);
            localStorage.setItem('customAreas', JSON.stringify([...this.customAreas]));
        }

        // 6. 更新区域优先级排序
        const savedOrder = this.getAreaPriorityOrder();
        const orderIndex = savedOrder.indexOf(oldName);
        if (orderIndex !== -1) {
            savedOrder[orderIndex] = newName;
            this.saveAreaPriorityOrder(savedOrder);
        }

        // 7. 保存所有更新
        this.saveToLocalStorage();

        // 8. 更新界面
        this.renderTable();
        this.updateStats();
        this.renderAreaStats();
        this.renderUnproducedStats();
        this.updateAreaOptions();

        // 9. 记录操作日志
        this.addLog('update', '区域名称修改',
            `将区域名称从 "${oldName}" 修改为 "${newName}"，影响了 ${updatedCount} 个订单记录`,
            {
                oldAreaName: oldName,
                newAreaName: newName,
                affectedRecords: updatedCount
            });

        // 10. 显示成功提示
        this.showNotification(
            `区域名称修改成功！"${oldName}" → "${newName}"，已更新 ${updatedCount} 个相关记录`,
            'success'
        );

        console.log(`区域名称更新完成: ${oldName} → ${newName}，更新了 ${updatedCount} 个记录`);
    }

    // 批量模式相关方法（单个模式已移除）

    addBatchRow() {
        const tableBody = document.getElementById('batchTableBody');
        const rowIndex = tableBody.children.length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <select class="batch-type" data-row="${rowIndex}" required>
                    <option value="">请选择型号</option>
                    <option value="H100">H100</option>
                    <option value="H80">H80</option>
                </select>
            </td>
            <td>
                <select class="batch-length" data-row="${rowIndex}" required disabled>
                    <option value="">请先选择型号</option>
                </select>
            </td>
            <td>
                <input type="number" class="batch-quantity" data-row="${rowIndex}" min="1" placeholder="生产根数" required>
            </td>
            <td>
                <button type="button" class="btn btn-danger btn-sm" onclick="dataManager.removeBatchRow(${rowIndex})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(row);

        // 为新行添加事件监听器
        this.setupBatchRowEvents(row, rowIndex);
        this.updateBatchSummary();
    }

    setupBatchRowEvents(row, rowIndex) {
        const typeSelect = row.querySelector('.batch-type');
        const lengthSelect = row.querySelector('.batch-length');
        const quantityInput = row.querySelector('.batch-quantity');

        // 型号选择事件
        typeSelect.addEventListener('change', () => {
            this.updateBatchLengthOptions(typeSelect.value, lengthSelect);
        });

        // 数量输入事件
        quantityInput.addEventListener('input', () => {
            this.updateBatchSummary();
        });

        // 长度选择事件
        lengthSelect.addEventListener('change', () => {
            this.updateBatchSummary();
        });
    }

    updateBatchLengthOptions(type, lengthSelect) {
        lengthSelect.innerHTML = '<option value="">请选择长度</option>';

        if (type) {
            const lengths = this.getLengthsByType(type);
            lengths.forEach(length => {
                const option = document.createElement('option');
                option.value = length;
                option.textContent = `${length}mm`;
                lengthSelect.appendChild(option);
            });
            lengthSelect.disabled = false;
        } else {
            lengthSelect.disabled = true;
        }
    }

    getLengthsByType(type) {
        // 生成长度选项：200mm到11800mm，以200mm为模数
        const lengths = [];
        for (let length = 200; length <= 11800; length += 200) {
            lengths.push(length);
        }
        return lengths;
    }

    removeBatchRow(rowIndex) {
        const tableBody = document.getElementById('batchTableBody');
        const rows = Array.from(tableBody.children);

        // 找到对应的行并删除
        const rowToRemove = rows.find(row => {
            const typeSelect = row.querySelector('.batch-type');
            return typeSelect && typeSelect.dataset.row == rowIndex;
        });

        if (rowToRemove) {
            rowToRemove.remove();
            this.updateBatchSummary();
        }
    }

    clearBatchTable() {
        const tableBody = document.getElementById('batchTableBody');
        tableBody.innerHTML = '';
        this.updateBatchSummary();
    }

    updateBatchSummary() {
        const tableBody = document.getElementById('batchTableBody');
        const rows = Array.from(tableBody.children);

        let totalSpecs = 0;
        let totalQuantity = 0;
        let totalMeters = 0;

        rows.forEach(row => {
            const typeSelect = row.querySelector('.batch-type');
            const lengthSelect = row.querySelector('.batch-length');
            const quantityInput = row.querySelector('.batch-quantity');

            if (typeSelect.value && lengthSelect.value && quantityInput.value) {
                totalSpecs++;
                const quantity = parseInt(quantityInput.value) || 0;
                const length = parseInt(lengthSelect.value) || 0;

                totalQuantity += quantity;
                totalMeters += (quantity * length / 1000);
            }
        });

        document.getElementById('totalSpecs').textContent = totalSpecs;
        document.getElementById('totalQuantity').textContent = totalQuantity;
        document.getElementById('totalMeters').textContent = totalMeters.toFixed(1);
    }

    // 批量发货相关方法


    loadAvailableShippingItems() {
        // 筛选出所有可发货的项目（不限制区域）
        let availableItems = this.data.filter(item =>
            item.produced > item.shipped &&
            item.status !== 'planned'
        );

        // 应用搜索过滤
        const searchTerm = document.getElementById('specSearchInput')?.value?.trim();
        if (searchTerm) {
            availableItems = this.filterItemsBySearch(availableItems, searchTerm);
        }

        if (availableItems.length === 0) {
            const message = searchTerm ?
                `没有找到匹配"${searchTerm}"的可发货项目` :
                '暂无可发货项目';
            this.showNotification(message, 'info');
            this.clearBatchShippingTable();
            return;
        }

        // 按规格合并库存数量
        const mergedItems = this.mergeInventoryBySpec(availableItems);

        this.renderBatchShippingTable(mergedItems);

        const message = searchTerm ?
            `找到 ${mergedItems.length} 种匹配"${searchTerm}"的规格` :
            `加载了 ${mergedItems.length} 种规格的可发货项目`;
        this.showNotification(message, 'success');
    }

    // 根据搜索条件过滤项目
    filterItemsBySearch(items, searchTerm) {
        if (!searchTerm) return items;

        const lowerSearchTerm = searchTerm.toLowerCase();

        return items.filter(item => {
            // 搜索规格型号
            if (item.spec.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }

            // 搜索型号（如H100、H80）
            const typeMatch = item.spec.match(/^(H\d+)/);
            if (typeMatch && typeMatch[1].toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }

            // 搜索尺寸（如1200mm、1400mm）
            const sizeMatch = item.spec.match(/(\d+mm)$/);
            if (sizeMatch && sizeMatch[1].toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }

            // 搜索区域
            if (item.area && item.area.toLowerCase().includes(lowerSearchTerm)) {
                return true;
            }

            return false;
        });
    }

    // 实时过滤已加载的发货项目
    filterShippingItems() {
        const searchTerm = document.getElementById('specSearchInput')?.value?.trim();
        const tableBody = document.getElementById('batchShippingTableBody');

        if (!tableBody || tableBody.children.length === 0) {
            return; // 没有加载的项目，不需要过滤
        }

        const rows = Array.from(tableBody.querySelectorAll('tr'));
        let visibleCount = 0;

        rows.forEach(row => {
            const specElement = row.querySelector('.spec-name');
            const areasElement = row.querySelector('.spec-areas');

            if (!specElement) return;

            const spec = specElement.textContent.toLowerCase();
            const areas = areasElement ? areasElement.textContent.toLowerCase() : '';

            let shouldShow = true;

            if (searchTerm) {
                const lowerSearchTerm = searchTerm.toLowerCase();
                shouldShow = spec.includes(lowerSearchTerm) ||
                           areas.includes(lowerSearchTerm);
            }

            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
                // 取消选中隐藏的项目
                const checkbox = row.querySelector('.shipping-item-checkbox');
                if (checkbox && checkbox.checked) {
                    checkbox.checked = false;
                    const itemId = row.dataset.itemId;
                    this.toggleShippingItem(itemId, false);
                }
            }
        });

        // 更新统计信息
        this.updateShippingSummary();
        this.updateSelectAllShippingCheckbox();

        // 显示过滤结果提示
        if (searchTerm && visibleCount === 0) {
            this.showNotification(`没有找到匹配"${searchTerm}"的项目`, 'info');
        }
    }

    // 按规格合并库存数量
    mergeInventoryBySpec(items) {
        const specMap = new Map();

        items.forEach(item => {
            const spec = item.spec;
            const available = item.produced - item.shipped;

            if (available > 0) {
                if (specMap.has(spec)) {
                    const existing = specMap.get(spec);
                    existing.totalAvailable += available;
                    existing.areas.add(item.area);
                    existing.items.push(item);
                } else {
                    specMap.set(spec, {
                        spec: spec,
                        totalAvailable: available,
                        areas: new Set([item.area]),
                        items: [item],
                        // 使用第一个项目的ID作为合并项目的ID
                        id: `merged_${spec.replace(/[^a-zA-Z0-9]/g, '_')}`
                    });
                }
            }
        });

        // 转换为数组并排序
        return Array.from(specMap.values()).sort((a, b) => {
            // 按型号排序（H80, H100等）
            const typeA = a.spec.match(/^(H\d+)/)?.[1] || 'Z';
            const typeB = b.spec.match(/^(H\d+)/)?.[1] || 'Z';

            if (typeA !== typeB) {
                return typeA.localeCompare(typeB);
            }

            // 同型号内按规格名称排序
            return a.spec.localeCompare(b.spec);
        });
    }

    renderBatchShippingTable(items) {
        const tableBody = document.getElementById('batchShippingTableBody');
        tableBody.innerHTML = '';

        items.forEach(item => {
            const available = item.totalAvailable || (item.produced - item.shipped);
            const row = document.createElement('tr');
            row.className = 'shipping-item-row';
            row.dataset.itemId = item.id;
            row.dataset.spec = item.spec;
            row.dataset.available = available;
            const areasText = item.areas ? Array.from(item.areas).join(', ') : item.area;

            row.innerHTML = `
                <td>
                    <div class="spec-info">
                        <div class="spec-name">${item.spec}</div>
                        ${item.areas ? `<div class="spec-areas">涉及区域: ${areasText}</div>` : ''}
                    </div>
                </td>
                <td>${this.formatNumber(available)}</td>
                <td>
                    <input type="number" class="shipping-quantity-input"
                           min="1" max="${available}" value="1"
                           data-spec="${item.spec}"
                           data-item-id="${item.id}"
                           onchange="dataManager.updateRowMeters('${item.id}')">
                </td>
                <td class="meters-cell">${this.calculateMeters(item.spec, 1).toFixed(1)}</td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn btn-sm btn-success"
                                onclick="dataManager.addToShippingCart('${item.id}')">
                            <i class="fas fa-plus"></i>
                            加入发货单
                        </button>
                        <button type="button" class="btn btn-sm btn-outline"
                                onclick="dataManager.setMaxShippingQuantity('${item.id}')">
                            全部
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // 初始化发货购物车（如果还没有）
        if (!this.shippingCart) {
            this.shippingCart = [];
        }
        this.updateShippingCart();
    }

    calculateWeight(spec, quantity) {
        // 根据规格计算重量，这里使用简化的计算方法
        // 实际应用中应该根据具体的钢筋规格和密度计算
        const match = spec.match(/^(H\d+)-(\d+)mm$/);
        if (!match) return 0;

        const [, type, length] = match;
        const lengthM = parseInt(length) / 1000;

        // 简化的重量计算：假设每米重量
        const weightPerMeter = type === 'H100' ? 2.5 : 2.0; // kg/m
        return quantity * lengthM * weightPerMeter;
    }

    calculateMeters(spec, quantity) {
        // 根据规格计算总米数
        const match = spec.match(/^(H\d+)-(\d+)mm$/);
        if (!match) return 0;

        const [, type, length] = match;
        const lengthM = parseInt(length) / 1000;

        return quantity * lengthM;
    }

    // 这些函数已被购物车功能替代，保留空实现以避免错误
    toggleShippingItem(itemId, checked) {
        // 已被购物车功能替代
    }

    selectAllShippingItems(checked) {
        // 已被购物车功能替代
    }

    updateSelectAllShippingCheckbox() {
        // 已被购物车功能替代
    }

    // 更新行的米数显示
    updateRowMeters(itemId) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        const quantityInput = row.querySelector('.shipping-quantity-input');
        const metersCell = row.querySelector('.meters-cell');
        const spec = row.dataset.spec;

        const quantity = parseInt(quantityInput.value) || 0;
        const meters = this.calculateMeters(spec, quantity);
        metersCell.textContent = meters.toFixed(1);
    }

    // 设置最大发货数量
    setMaxShippingQuantity(itemId) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        const quantityInput = row.querySelector('.shipping-quantity-input');
        const available = parseInt(row.dataset.available);

        quantityInput.value = available;
        this.updateRowMeters(itemId);
    }

    // 添加到发货购物车
    addToShippingCart(itemId) {
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        const quantityInput = row.querySelector('.shipping-quantity-input');
        const spec = row.dataset.spec;
        const available = parseInt(row.dataset.available);
        const quantity = parseInt(quantityInput.value) || 0;

        if (quantity <= 0) {
            this.showNotification('请输入有效的发货数量', 'warning');
            return;
        }

        if (quantity > available) {
            this.showNotification('发货数量不能超过可发货数量', 'warning');
            return;
        }

        // 检查购物车中是否已有相同规格
        const existingIndex = this.shippingCart.findIndex(item => item.spec === spec);

        if (existingIndex >= 0) {
            // 更新现有项目的数量
            const newQuantity = this.shippingCart[existingIndex].quantity + quantity;
            if (newQuantity > available) {
                this.showNotification(`${spec} 总发货数量不能超过可发货数量 ${available}`, 'warning');
                return;
            }
            this.shippingCart[existingIndex].quantity = newQuantity;
            this.shippingCart[existingIndex].meters = this.calculateMeters(spec, newQuantity);
        } else {
            // 添加新项目到购物车
            this.shippingCart.push({
                itemId: itemId,
                spec: spec,
                quantity: quantity,
                available: available,
                meters: this.calculateMeters(spec, quantity),
                areas: row.querySelector('.spec-areas')?.textContent?.replace('涉及区域: ', '') || ''
            });
        }

        // 重置输入框
        quantityInput.value = 1;
        this.updateRowMeters(itemId);

        // 更新购物车显示
        this.updateShippingCart();

        this.showNotification(`已将 ${quantity} 根 ${spec} 加入发货单`, 'success');
    }

    // 更新发货购物车显示
    updateShippingCart() {
        const cartContainer = document.getElementById('shippingCartContainer');
        if (!cartContainer) return;

        if (!this.shippingCart || this.shippingCart.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>发货单为空，请选择规格加入发货单</p>
                </div>
            `;
            this.updateShippingCartSummary();
            return;
        }

        let cartHTML = '<div class="cart-items">';
        this.shippingCart.forEach((item, index) => {
            cartHTML += `
                <div class="cart-item" data-index="${index}">
                    <div class="cart-item-info">
                        <div class="cart-spec">${item.spec}</div>
                        ${item.areas ? `<div class="cart-areas">${item.areas}</div>` : ''}
                    </div>
                    <div class="cart-quantity">
                        <input type="number" class="cart-quantity-input"
                               min="1" max="${item.available}" value="${item.quantity}"
                               onchange="dataManager.updateCartItemQuantity(${index}, this.value)">
                        <span class="quantity-unit">根</span>
                    </div>
                    <div class="cart-meters">${item.meters.toFixed(1)} m</div>
                    <div class="cart-actions">
                        <button type="button" class="btn btn-sm btn-danger"
                                onclick="dataManager.removeFromShippingCart(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        cartHTML += '</div>';

        cartContainer.innerHTML = cartHTML;
        this.updateShippingCartSummary();
    }

    // 更新购物车中项目的数量
    updateCartItemQuantity(index, newQuantity) {
        const quantity = parseInt(newQuantity) || 0;
        const item = this.shippingCart[index];

        if (quantity <= 0) {
            this.removeFromShippingCart(index);
            return;
        }

        if (quantity > item.available) {
            this.showNotification(`${item.spec} 数量不能超过可发货数量 ${item.available}`, 'warning');
            // 恢复原值
            const input = document.querySelector(`.cart-item[data-index="${index}"] .cart-quantity-input`);
            if (input) input.value = item.quantity;
            return;
        }

        item.quantity = quantity;
        item.meters = this.calculateMeters(item.spec, quantity);

        // 更新显示
        const cartItem = document.querySelector(`.cart-item[data-index="${index}"]`);
        const metersElement = cartItem.querySelector('.cart-meters');
        if (metersElement) {
            metersElement.textContent = item.meters.toFixed(1) + ' m';
        }

        this.updateShippingCartSummary();
    }

    // 从购物车中移除项目
    removeFromShippingCart(index) {
        const item = this.shippingCart[index];
        this.shippingCart.splice(index, 1);
        this.updateShippingCart();
        this.showNotification(`已从发货单中移除 ${item.spec}`, 'info');
    }

    // 更新购物车汇总信息
    updateShippingCartSummary() {
        let totalSpecs = this.shippingCart ? this.shippingCart.length : 0;
        let totalQuantity = 0;
        let totalMeters = 0;
        let totalWeight = 0;

        if (this.shippingCart) {
            this.shippingCart.forEach(item => {
                totalQuantity += item.quantity;
                totalMeters += item.meters;
                totalWeight += this.calculateWeight(item.spec, item.quantity);
            });
        }

        // 更新汇总显示
        const summaryElements = {
            'totalShippingSpecs': totalSpecs,
            'totalShippingQuantity': totalQuantity,
            'totalShippingMeters': totalMeters.toFixed(1) + ' m',
            'totalShippingWeight': totalWeight.toFixed(1) + ' kg'
        };

        Object.entries(summaryElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // 清空发货购物车
    clearShippingCart() {
        this.shippingCart = [];
        this.updateShippingCart();
        this.showNotification('已清空发货单', 'info');
    }

    updateShippingSummary() {
        // 使用购物车汇总功能
        this.updateShippingCartSummary();
    }

    clearBatchShippingTable() {
        const tableBody = document.getElementById('batchShippingTableBody');
        tableBody.innerHTML = '';
        this.updateShippingSummary();
    }

    processBatchShipping() {
        console.log('=== processBatchShipping 开始执行 ===');
        const date = document.getElementById('batchShippingDate').value;
        const customerName = document.getElementById('batchCustomerName').value;
        const company = document.getElementById('batchTransportCompany').value;
        const trackingNumber = document.getElementById('batchTrackingNumber').value;
        const deliveryAddress = document.getElementById('batchDeliveryAddress').value;
        const remarks = document.getElementById('batchShippingRemarks').value;

        console.log('表单数据:', { date, customerName, company, trackingNumber, deliveryAddress, remarks });
        console.log('购物车数据:', this.shippingCart);

        if (!date || !customerName) {
            this.showNotification('请填写必填字段（发货日期、客户名称）', 'error');
            return;
        }

        if (!this.shippingCart || this.shippingCart.length === 0) {
            this.showNotification('发货单为空，请先添加要发货的规格', 'warning');
            return;
        }

        const shippingItems = [];
        let hasError = false;

        // 从购物车收集发货数据并验证
        this.shippingCart.forEach(cartItem => {
            const spec = cartItem.spec;
            const quantity = cartItem.quantity;
            const itemId = cartItem.itemId;

            if (quantity <= 0) {
                this.showNotification(`${spec} 的发货数量必须大于0`, 'error');
                hasError = true;
                return;
            }

            // 对于合并的规格，需要从多个项目中分配发货数量
            if (itemId.startsWith('merged_')) {
                // 获取该规格的所有可发货项目
                const availableItems = this.data.filter(item =>
                    item.spec === spec &&
                    item.produced > item.shipped &&
                    item.status !== 'planned'
                );

                const totalAvailable = availableItems.reduce((sum, item) =>
                    sum + (item.produced - item.shipped), 0);

                if (quantity > totalAvailable) {
                    this.showNotification(`${spec} 的发货数量超过可发货数量`, 'error');
                    hasError = true;
                    return;
                }

                // 按比例分配发货数量到各个项目
                let remainingQuantity = quantity;
                availableItems.forEach((item, index) => {
                    const itemAvailable = item.produced - item.shipped;
                    let itemQuantity;

                    if (index === availableItems.length - 1) {
                        // 最后一个项目分配剩余数量
                        itemQuantity = remainingQuantity;
                    } else {
                        // 按比例分配
                        itemQuantity = Math.min(
                            Math.floor((itemAvailable / totalAvailable) * quantity),
                            itemAvailable,
                            remainingQuantity
                        );
                    }

                    if (itemQuantity > 0) {
                        shippingItems.push({
                            item: item,
                            quantity: itemQuantity,
                            weight: this.calculateWeight(item.spec, itemQuantity)
                        });
                        remainingQuantity -= itemQuantity;
                    }
                });
            } else {
                // 单个项目发货
                const item = this.data.find(d => d.id == itemId);
                if (!item) {
                    this.showNotification(`找不到项目 ${itemId}`, 'error');
                    hasError = true;
                    return;
                }

                const available = item.produced - item.shipped;
                if (quantity > available) {
                    this.showNotification(`${item.spec} 的发货数量超过可发货数量`, 'error');
                    hasError = true;
                    return;
                }

                shippingItems.push({
                    item: item,
                    quantity: quantity,
                    weight: this.calculateWeight(item.spec, quantity)
                });
            }
        });

        if (hasError) return;

        // 执行批量发货
        const shippingRecord = {
            date,
            customerName,
            company,
            trackingNumber,
            deliveryAddress,
            remarks,
            timestamp: new Date().toISOString()
        };

        let totalQuantity = 0;
        let totalWeight = 0;

        shippingItems.forEach(({ item, quantity, weight }) => {
            // 添加发货记录
            item.shippingRecords.push({
                ...shippingRecord,
                quantity
            });

            // 更新已发货数量
            item.shipped += quantity;

            // 如果全部发货完成，更新状态
            if (item.shipped >= item.produced && item.status === 'completed') {
                item.status = 'shipped';
            }

            totalQuantity += quantity;
            totalWeight += weight;
        });

        // 添加到发货历史
        const historyRecord = {
            id: Date.now() + Math.random(),
            documentNumber: this.generateDocumentNumber(),
            date,
            customerName,
            company,
            trackingNumber,
            deliveryAddress,
            remarks,
            items: shippingItems.map(si => ({
                spec: si.item.spec,
                quantity: si.quantity,
                weight: si.weight,
                meters: this.calculateMeters(si.item.spec, si.quantity)
            })),
            totalQuantity,
            totalWeight,
            totalMeters: shippingItems.reduce((sum, si) => sum + this.calculateMeters(si.item.spec, si.quantity), 0),
            timestamp: new Date().toISOString()
        };

        this.shippingHistory.push(historyRecord);

        // 记录日志
        this.addLog('shipping', '批量发货操作',
            `批量发货 ${shippingItems.length} 个规格，共 ${this.formatNumber(totalQuantity)} 根给 ${customerName}`,
            {
                customerName,
                itemCount: shippingItems.length,
                totalQuantity,
                totalWeight: totalWeight.toFixed(1),
                company,
                trackingNumber,
                deliveryAddress,
                date,
                remarks,
                historyRecordId: historyRecord.id,
                items: shippingItems.map(si => ({
                    spec: si.item.spec,
                    quantity: si.quantity
                }))
            });

        this.saveToLocalStorage();
        this.renderTable();
        this.updateStats();

        // 清空发货购物车
        this.clearShippingCart();

        this.closeShippingModal();
        this.showNotification(`成功批量发货 ${shippingItems.length} 个规格，共 ${this.formatNumber(totalQuantity)} 根`, 'success');
    }

    previewShippingDocument() {
        const shippingData = this.collectShippingData();
        if (!shippingData) return;

        this.generateShippingDocument(shippingData, true);
    }

    exportShippingDocument() {
        const shippingData = this.collectShippingData();
        if (!shippingData) return;

        this.generateShippingDocument(shippingData, false);
    }

    collectShippingData() {
        const date = document.getElementById('batchShippingDate').value;
        const customerName = document.getElementById('batchCustomerName').value;
        const company = document.getElementById('batchTransportCompany').value;
        const trackingNumber = document.getElementById('batchTrackingNumber').value;
        const deliveryAddress = document.getElementById('batchDeliveryAddress').value;
        const remarks = document.getElementById('batchShippingRemarks').value;

        if (!date || !customerName) {
            this.showNotification('请填写必填字段（发货日期、客户名称）', 'error');
            return null;
        }

        if (!this.shippingCart || this.shippingCart.length === 0) {
            this.showNotification('发货单为空，请先添加要发货的规格', 'warning');
            return null;
        }

        const items = [];
        let totalQuantity = 0;
        let totalWeight = 0;
        let totalMeters = 0;

        this.shippingCart.forEach(cartItem => {
            const spec = cartItem.spec;
            const quantity = cartItem.quantity;

            if (quantity > 0) {
                const weight = this.calculateWeight(spec, quantity);
                const meters = cartItem.meters;

                items.push({
                    spec: spec,
                    quantity: quantity,
                    weight: weight,
                    meters: meters
                });

                totalQuantity += quantity;
                totalWeight += weight;
                totalMeters += meters;
            }
        });

        return {
            date,
            customerName,
            company,
            trackingNumber,
            deliveryAddress,
            remarks,
            items,
            totalQuantity,
            totalWeight,
            totalMeters,
            documentNumber: this.generateDocumentNumber()
        };
    }

    generateDocumentNumber() {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        return `FH${dateStr}${timeStr}`;
    }

    generateShippingDocument(data, isPreview = false) {
        const documentHTML = this.createShippingDocumentHTML(data);

        if (isPreview) {
            // 预览模式：在新窗口中显示
            const previewWindow = window.open('', '_blank', 'width=800,height=600');
            previewWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>发货单预览 - ${data.documentNumber}</title>
                    <style>
                        body { font-family: 'Microsoft YaHei', sans-serif; margin: 0; padding: 20px; }
                        .shipping-document { max-width: 800px; margin: 0 auto; }
                        .shipping-document-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
                        .shipping-document-title { font-size: 28px; font-weight: bold; color: #1e3a8a; margin: 0 0 10px 0; }
                        .shipping-document-subtitle { font-size: 16px; color: #6b7280; margin: 0; }
                        .shipping-document-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .shipping-document-section { background: #f8fafc; padding: 15px; border-radius: 8px; }
                        .shipping-document-section h4 { margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: bold; }
                        .shipping-document-field { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
                        .shipping-document-field:last-child { margin-bottom: 0; }
                        .shipping-document-field .label { color: #6b7280; }
                        .shipping-document-field .value { color: #1f2937; font-weight: 500; }
                        .shipping-document-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e5e7eb; }
                        .shipping-document-table th, .shipping-document-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                        .shipping-document-table th { background: #1e3a8a; color: white; font-weight: bold; }
                        .shipping-document-table tr:last-child td { border-bottom: none; }
                        .shipping-document-table .number-cell { text-align: right; }
                        .shipping-document-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
                        .shipping-document-signature { text-align: center; }
                        .shipping-document-signature .title { font-weight: bold; margin-bottom: 20px; color: #1f2937; }
                        .shipping-document-signature .line { border-bottom: 1px solid #6b7280; height: 40px; margin-bottom: 8px; }
                        .shipping-document-signature .date { font-size: 12px; color: #6b7280; }
                        @media print { body { margin: 0; } .shipping-document { max-width: none; } }
                    </style>
                </head>
                <body>
                    ${documentHTML}
                    <div style="text-align: center; margin-top: 30px;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer;">打印发货单</button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">关闭</button>
                    </div>
                </body>
                </html>
            `);
            previewWindow.document.close();
        } else {
            // 导出模式：下载HTML文件
            const fullHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>发货单 - ${data.documentNumber}</title>
                    <style>
                        body { font-family: 'Microsoft YaHei', sans-serif; margin: 0; padding: 20px; }
                        .shipping-document { max-width: 800px; margin: 0 auto; }
                        .shipping-document-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
                        .shipping-document-title { font-size: 28px; font-weight: bold; color: #1e3a8a; margin: 0 0 10px 0; }
                        .shipping-document-subtitle { font-size: 16px; color: #6b7280; margin: 0; }
                        .shipping-document-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .shipping-document-section { background: #f8fafc; padding: 15px; border-radius: 8px; }
                        .shipping-document-section h4 { margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: bold; }
                        .shipping-document-field { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
                        .shipping-document-field:last-child { margin-bottom: 0; }
                        .shipping-document-field .label { color: #6b7280; }
                        .shipping-document-field .value { color: #1f2937; font-weight: 500; }
                        .shipping-document-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e5e7eb; }
                        .shipping-document-table th, .shipping-document-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                        .shipping-document-table th { background: #1e3a8a; color: white; font-weight: bold; }
                        .shipping-document-table tr:last-child td { border-bottom: none; }
                        .shipping-document-table .number-cell { text-align: right; }
                        .shipping-document-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
                        .shipping-document-signature { text-align: center; }
                        .shipping-document-signature .title { font-weight: bold; margin-bottom: 20px; color: #1f2937; }
                        .shipping-document-signature .line { border-bottom: 1px solid #6b7280; height: 40px; margin-bottom: 8px; }
                        .shipping-document-signature .date { font-size: 12px; color: #6b7280; }
                        @media print { body { margin: 0; } .shipping-document { max-width: none; } }
                    </style>
                </head>
                <body>
                    ${documentHTML}
                </body>
                </html>
            `;

            const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `发货单-${data.documentNumber}.html`;
            a.click();
            URL.revokeObjectURL(url);

            this.showNotification('发货单导出成功', 'success');
        }
    }

    createShippingDocumentHTML(data) {
        const currentDate = new Date().toLocaleDateString('zh-CN');

        return `
            <div class="shipping-document">
                <div class="shipping-document-header">
                    <h1 class="shipping-document-title">梯桁筋与组合肋发货单</h1>
                    <p class="shipping-document-subtitle">浦东机场T3桁架钢筋生产推进管理系统</p>
                </div>

                <div class="shipping-document-info">
                    <div class="shipping-document-section">
                        <h4>发货信息</h4>
                        <div class="shipping-document-field">
                            <span class="label">发货单号:</span>
                            <span class="value">${data.documentNumber}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">发货日期:</span>
                            <span class="value">${data.date}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">制单日期:</span>
                            <span class="value">${currentDate}</span>
                        </div>
                    </div>

                    <div class="shipping-document-section">
                        <h4>客户及运输信息</h4>
                        <div class="shipping-document-field">
                            <span class="label">客户名称:</span>
                            <span class="value">${data.customerName}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">收货地址:</span>
                            <span class="value">${data.deliveryAddress || '-'}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">运输公司:</span>
                            <span class="value">${data.company || '-'}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">运单号:</span>
                            <span class="value">${data.trackingNumber || '-'}</span>
                        </div>
                        <div class="shipping-document-field">
                            <span class="label">备注:</span>
                            <span class="value">${data.remarks || '-'}</span>
                        </div>
                    </div>
                </div>

                <table class="shipping-document-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>规格型号</th>
                            <th>发货数量(根)</th>
                            <th>长度(米)</th>
                            <th>合计米数</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.spec}</td>
                                <td class="number-cell">${this.formatNumber(item.quantity)}</td>
                                <td class="number-cell">${(item.meters / item.quantity).toFixed(1)}</td>
                                <td class="number-cell">${item.meters.toFixed(1)}</td>
                            </tr>
                        `).join('')}
                        <tr style="background: #f8fafc; font-weight: bold;">
                            <td colspan="2">合计</td>
                            <td class="number-cell">${this.formatNumber(data.totalQuantity)}</td>
                            <td class="number-cell">${data.totalMeters.toFixed(1)}</td>
                            <td class="number-cell">${data.totalMeters.toFixed(1)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="shipping-document-footer">
                    <div class="shipping-document-signature">
                        <div class="title">发货人</div>
                        <div class="line"></div>
                        <div class="date">日期：_______</div>
                    </div>
                    <div class="shipping-document-signature">
                        <div class="title">运输方</div>
                        <div class="line"></div>
                        <div class="date">日期：_______</div>
                    </div>
                    <div class="shipping-document-signature">
                        <div class="title">收货人</div>
                        <div class="line"></div>
                        <div class="date">日期：_______</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 原材料采购管理方法
    openMaterialModal() {
        this.isMaterialHistoryMode = false;

        const modal = document.getElementById('materialModal');
        const overlay = document.getElementById('modalOverlay');
        const title = document.getElementById('materialModalTitle');

        // 重置模式显示
        const addMode = document.getElementById('addMaterialMode');
        const historyMode = document.getElementById('materialHistoryMode');
        const materialModeText = document.getElementById('materialModeText');
        const materialButtonText = document.getElementById('materialButtonText');
        const exportBtn = document.getElementById('exportMaterialBtn');

        if (addMode && historyMode) {
            addMode.style.display = 'block';
            historyMode.style.display = 'none';
            if (materialModeText) materialModeText.textContent = '查看记录';
            if (materialButtonText) materialButtonText.textContent = '保存采购';
        }

        // 隐藏导出按钮
        if (exportBtn) exportBtn.style.display = 'none';

        title.textContent = '原材料采购管理';

        // 清空表单并设置默认值
        this.clearMaterialForm();
        document.getElementById('materialDate').value = new Date().toISOString().split('T')[0];

        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closeMaterialModal() {
        const modal = document.getElementById('materialModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        this.clearMaterialForm();
    }

    clearMaterialForm() {
        const form = document.getElementById('materialForm');
        if (form) {
            form.reset();
        }
    }

    toggleMaterialMode() {
        const addMode = document.getElementById('addMaterialMode');
        const historyMode = document.getElementById('materialHistoryMode');
        const materialModeText = document.getElementById('materialModeText');
        const materialButtonText = document.getElementById('materialButtonText');
        const exportBtn = document.getElementById('exportMaterialBtn');

        if (historyMode.style.display === 'none') {
            // 切换到历史记录模式
            addMode.style.display = 'none';
            historyMode.style.display = 'block';
            materialModeText.textContent = '新增采购';
            materialButtonText.textContent = '新增采购';
            this.isMaterialHistoryMode = true;

            // 显示导出按钮
            exportBtn.style.display = 'inline-flex';

            // 加载历史记录
            this.loadMaterialHistory();
        } else {
            // 切换到新增采购模式
            addMode.style.display = 'block';
            historyMode.style.display = 'none';
            materialModeText.textContent = '查看记录';
            materialButtonText.textContent = '保存采购';
            this.isMaterialHistoryMode = false;

            // 隐藏导出按钮
            exportBtn.style.display = 'none';
        }
    }

    saveMaterialPurchase() {
        console.log('=== saveMaterialPurchase 开始 ===');
        console.log('isMaterialHistoryMode:', this.isMaterialHistoryMode);

        // 检查是否为历史记录模式
        if (this.isMaterialHistoryMode) {
            console.log('处于历史记录模式，切换到新增模式');
            this.toggleMaterialMode(); // 切换到新增模式
            return;
        }

        const date = document.getElementById('materialDate').value;
        const quantity = parseFloat(document.getElementById('materialQuantity').value);
        const diameter = document.getElementById('materialDiameter').value;
        const supplier = document.getElementById('materialSupplier').value;
        const price = parseFloat(document.getElementById('materialPrice').value) || 0;
        const batch = document.getElementById('materialBatch').value;
        const remarks = document.getElementById('materialRemarks').value;

        console.log('表单数据收集:', {
            date, quantity, diameter, supplier, price, batch, remarks
        });

        // 验证必填字段
        if (!date || !quantity || !diameter || !supplier) {
            this.showNotification('请填写必填字段（采购日期、采购吨位、钢筋直径、供应厂家）', 'error');
            return;
        }

        if (quantity <= 0) {
            this.showNotification('采购吨位必须大于0', 'error');
            return;
        }

        // 创建采购记录
        const purchaseRecord = {
            id: Date.now() + Math.random(),
            date: date,
            quantity: quantity,
            diameter: diameter,
            supplier: supplier,
            price: price,
            totalAmount: quantity * price,
            batch: batch,
            remarks: remarks,
            timestamp: new Date().toISOString()
        };

        // 添加到采购记录
        this.materialPurchases.push(purchaseRecord);
        console.log('添加到materialPurchases数组，当前长度:', this.materialPurchases.length);
        console.log('最新记录:', purchaseRecord);

        // 记录日志
        this.addLog('material', '原材料采购',
            `采购 ${supplier} 厂家 ${diameter} 钢筋 ${quantity} 吨`,
            {
                purchaseId: purchaseRecord.id,
                supplier: supplier,
                diameter: diameter,
                quantity: quantity,
                price: price,
                totalAmount: purchaseRecord.totalAmount,
                date: date
            });

        // 保存并更新界面
        console.log('开始保存到localStorage...');
        this.saveToLocalStorage();
        console.log('保存完成，开始更新统计...');
        this.updateStats(); // 更新仪表板统计数据
        console.log('统计更新完成，关闭模态框...');
        this.closeMaterialModal();

        this.showNotification(`成功添加采购记录：${supplier} ${diameter} ${quantity}吨`, 'success');
        console.log('=== saveMaterialPurchase 完成 ===');
    }

    loadMaterialHistory() {
        this.renderMaterialHistoryTable(this.materialPurchases);
        this.updateMaterialSummary(this.materialPurchases);
    }

    renderMaterialHistoryTable(purchases) {
        const tableBody = document.getElementById('materialHistoryTableBody');
        tableBody.innerHTML = '';

        if (purchases.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="8" style="text-align: center; padding: 40px; color: #6b7280;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="fas fa-inbox" style="font-size: 32px; opacity: 0.3;"></i>
                        <div>暂无采购记录</div>
                    </div>
                </td>
            `;
            tableBody.appendChild(emptyRow);
            return;
        }

        purchases.forEach(purchase => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${purchase.date}</td>
                <td>${purchase.diameter}</td>
                <td>${purchase.supplier}</td>
                <td>${purchase.quantity.toFixed(1)}</td>
                <td>${purchase.price > 0 ? purchase.price.toFixed(2) : '-'}</td>
                <td>${purchase.totalAmount > 0 ? purchase.totalAmount.toFixed(2) : '-'}</td>
                <td>${purchase.batch || '-'}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-danger"
                            onclick="dataManager.deleteMaterialPurchase(${purchase.id})"
                            title="删除记录">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    updateMaterialSummary(purchases) {
        const totalPurchases = purchases.length;
        const totalTons = purchases.reduce((sum, p) => sum + p.quantity, 0);
        const totalAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const averagePrice = totalTons > 0 ? totalAmount / totalTons : 0;

        document.getElementById('totalPurchases').textContent = totalPurchases;
        document.getElementById('totalPurchasedTons').textContent = totalTons.toFixed(1) + ' 吨';
        document.getElementById('totalPurchaseAmount').textContent = totalAmount.toFixed(2) + ' 元';
        document.getElementById('averagePrice').textContent = averagePrice.toFixed(2) + ' 元/吨';
    }

    filterMaterialHistory() {
        const dateFrom = document.getElementById('historyDateFrom').value;
        const dateTo = document.getElementById('historyDateTo').value;
        const supplier = document.getElementById('historySupplier').value;

        let filteredPurchases = [...this.materialPurchases];

        // 日期筛选
        if (dateFrom) {
            filteredPurchases = filteredPurchases.filter(p => p.date >= dateFrom);
        }
        if (dateTo) {
            filteredPurchases = filteredPurchases.filter(p => p.date <= dateTo);
        }

        // 厂家筛选
        if (supplier) {
            filteredPurchases = filteredPurchases.filter(p => p.supplier === supplier);
        }

        this.renderMaterialHistoryTable(filteredPurchases);
        this.updateMaterialSummary(filteredPurchases);

        this.showNotification(`筛选结果：${filteredPurchases.length} 条记录`, 'info');
    }

    deleteMaterialPurchase(purchaseId) {
        if (!confirm('确定要删除这条采购记录吗？')) {
            return;
        }

        const index = this.materialPurchases.findIndex(p => p.id === purchaseId);
        if (index !== -1) {
            const deletedPurchase = this.materialPurchases[index];
            this.materialPurchases.splice(index, 1);

            // 记录日志
            this.addLog('material', '删除采购记录',
                `删除了 ${deletedPurchase.supplier} ${deletedPurchase.diameter} ${deletedPurchase.quantity}吨 的采购记录`,
                { deletedPurchase });

            // 保存并刷新显示
            this.saveToLocalStorage();
            this.updateStats(); // 更新仪表板统计数据
            this.loadMaterialHistory();

            this.showNotification('采购记录删除成功', 'success');
        }
    }

    exportMaterialHistory() {
        if (this.materialPurchases.length === 0) {
            this.showNotification('暂无采购记录可导出', 'warning');
            return;
        }

        // 生成CSV格式的数据
        const headers = ['采购日期', '钢筋直径', '供应厂家', '采购吨位', '单价(元/吨)', '总金额(元)', '批次号', '备注'];
        const csvContent = [
            headers.join(','),
            ...this.materialPurchases.map(purchase => [
                purchase.date,
                purchase.diameter,
                purchase.supplier,
                purchase.quantity.toFixed(1),
                purchase.price > 0 ? purchase.price.toFixed(2) : '',
                purchase.totalAmount > 0 ? purchase.totalAmount.toFixed(2) : '',
                purchase.batch || '',
                purchase.remarks || ''
            ].join(','))
        ].join('\n');

        // 创建并下载文件
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `原材料采购记录_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('采购记录导出成功', 'success');
    }

    // 设置Firebase同步状态模态框事件监听器
    setupFirebaseSyncListeners() {
        const setupListeners = () => {
            // 关闭Firebase同步状态模态框
            const closeCloudSyncModal = document.getElementById('closeCloudSyncModal');
            const cancelCloudSyncBtn = document.getElementById('cancelCloudSyncBtn');

            if (closeCloudSyncModal) {
                closeCloudSyncModal.addEventListener('click', () => {
                    this.closeFirebaseSyncModal();
                });
            }

            if (cancelCloudSyncBtn) {
                cancelCloudSyncBtn.addEventListener('click', () => {
                    this.closeFirebaseSyncModal();
                });
            }

            // 刷新Firebase状态按钮
            const refreshFirebaseStatusBtn = document.getElementById('refreshFirebaseStatusBtn');
            if (refreshFirebaseStatusBtn) {
                refreshFirebaseStatusBtn.addEventListener('click', () => {
                    this.updateFirebaseSyncStatus();
                    this.showNotification('Firebase状态已刷新', 'info');
                });
            }

            // 测试Firebase连接按钮
            const testFirebaseConnectionBtn = document.getElementById('testFirebaseConnectionBtn');
            if (testFirebaseConnectionBtn) {
                testFirebaseConnectionBtn.addEventListener('click', () => {
                    this.testFirebaseConnection();
                });
            }

            // 手动同步按钮
            const manualSyncBtn = document.getElementById('manualSyncBtn');
            if (manualSyncBtn) {
                manualSyncBtn.addEventListener('click', async () => {
                    await this.performManualSync();
                });
            }

            // Firebase禁用开关
            const disableFirebaseCheckbox = document.getElementById('disableFirebaseCheckbox');
            if (disableFirebaseCheckbox) {
                // 加载保存的设置
                const isDisabled = localStorage.getItem('disableFirebase') === 'true';
                disableFirebaseCheckbox.checked = isDisabled;

                disableFirebaseCheckbox.addEventListener('change', (e) => {
                    const disabled = e.target.checked;
                    localStorage.setItem('disableFirebase', disabled.toString());

                    if (disabled) {
                        this.showNotification('Firebase已禁用，系统将使用本地存储模式', 'info');
                    } else {
                        this.showNotification('Firebase已启用，页面刷新后生效', 'info');
                    }

                    // 更新状态显示
                    setTimeout(() => {
                        this.updateFirebaseSyncStatus();
                    }, 100);
                });
            }

            // 点击背景关闭模态框
            const modalOverlay = document.getElementById('modalOverlay');
            if (modalOverlay) {
                modalOverlay.addEventListener('click', (e) => {
                    if (e.target === modalOverlay) {
                        const cloudSyncModal = document.getElementById('cloudSyncModal');
                        if (cloudSyncModal && cloudSyncModal.classList.contains('active')) {
                            this.closeFirebaseSyncModal();
                        }
                    }
                });
            }
        };

        // 如果DOM已经加载完成，直接设置监听器
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupListeners);
        } else {
            setupListeners();
        }
    }

    // 关闭Firebase同步状态模态框
    closeFirebaseSyncModal() {
        const modal = document.getElementById('cloudSyncModal');
        const overlay = document.getElementById('modalOverlay');

        if (modal && overlay) {
            modal.classList.remove('active');
            overlay.classList.remove('active');
        }
    }

    // Firebase实时同步状态显示
    updateFirebaseSyncStatus() {
        const statusDot = document.getElementById('syncStatusDot');
        const statusText = document.getElementById('syncStatusText');
        const syncInfo = document.getElementById('syncInfo');

        if (!statusDot || !statusText || !syncInfo) return;

        // 检查是否在代码中临时禁用了Firebase（检查index.html中的设置）
        const codeDisabledFirebase = false; // Firebase已重新启用

        // 检查用户是否禁用了Firebase
        const userDisabledFirebase = localStorage.getItem('disableFirebase') === 'true';

        if (codeDisabledFirebase || userDisabledFirebase) {
            statusDot.className = 'status-dot warning';
            statusText.textContent = '本地模式';
            syncInfo.innerHTML = `
                <p>💾 系统使用本地存储模式</p>
                <p>📱 数据保存在本地浏览器中</p>
                <p>✅ 所有功能正常可用</p>
                ${codeDisabledFirebase ? '<p>🔧 Firebase已临时禁用（配置问题）</p>' : ''}
                ${userDisabledFirebase ? '<p>🔧 如需启用云端同步，请取消下方的禁用选项并刷新页面</p>' : ''}
            `;
            return;
        }

        if (window.firebaseSync) {
            const status = window.firebaseSync.getConnectionStatus();
            console.log('Firebase连接状态:', status);

            if (window.firebaseSync.isConnected()) {
                statusDot.className = 'status-dot active';
                statusText.textContent = '已连接';
                syncInfo.innerHTML = `
                    <p>🚀 Firebase 实时同步已启用</p>
                    <p>👥 支持多用户协作</p>
                    <p>📱 跨设备数据同步</p>
                    <p>⚡ 实时数据更新</p>
                    <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">用户: ${status.userConfig.name}</p>
                `;
            } else if (status.initialized) {
                statusDot.className = 'status-dot warning';
                statusText.textContent = '连接中';
                syncInfo.innerHTML = `
                    <p>🔄 Firebase 正在连接中...</p>
                    <p>📡 请稍等片刻</p>
                `;
            } else {
                statusDot.className = 'status-dot error';
                statusText.textContent = '未连接';
                syncInfo.innerHTML = `
                    <p>❌ Firebase连接失败</p>
                    <p>🔧 可能的原因：</p>
                    <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
                        <li>网络连接问题</li>
                        <li>Firebase配置错误</li>
                        <li>防火墙阻止连接</li>
                    </ul>
                    <p>💡 建议：勾选下方"禁用Firebase"选项使用本地存储</p>
                `;
            }
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = '未加载';
            syncInfo.innerHTML = `
                <p>❌ Firebase同步模块未加载</p>
                <p>💡 建议：勾选下方"禁用Firebase"选项使用本地存储</p>
            `;
        }
    }

    // 显示Firebase同步状态模态框
    showFirebaseSyncStatus() {
        const modal = document.getElementById('cloudSyncModal');
        const overlay = document.getElementById('modalOverlay');

        if (modal && overlay) {
            // 更新同步状态
            this.updateFirebaseSyncStatus();

            modal.classList.add('active');
            overlay.classList.add('active');
        }
    }

    // 测试Firebase连接
    async testFirebaseConnection() {
        this.showNotification('正在测试Firebase连接...', 'info');

        try {
            if (!window.firebaseSync) {
                throw new Error('Firebase同步模块未加载');
            }

            const status = window.firebaseSync.getConnectionStatus();
            console.log('Firebase连接测试 - 当前状态:', status);

            if (window.firebaseSync.isConnected()) {
                // 尝试写入测试数据
                const testData = {
                    id: 'connection_test_' + Date.now(),
                    message: 'Firebase连接测试',
                    timestamp: Date.now(),
                    user: status.userConfig.name
                };

                const success = await window.firebaseSync.syncToCloud('connectionTest', [testData], 'update');

                if (success) {
                    this.showNotification('✅ Firebase连接测试成功！数据读写正常', 'success');
                } else {
                    this.showNotification('⚠️ Firebase连接正常，但数据写入失败', 'warning');
                }
            } else {
                this.showNotification('❌ Firebase未连接，请检查网络和配置', 'error');
            }

            // 刷新状态显示
            this.updateFirebaseSyncStatus();

        } catch (error) {
            console.error('Firebase连接测试失败:', error);
            this.showNotification('❌ Firebase连接测试失败: ' + error.message, 'error');
        }
    }









    // 渲染未生产规格统计
    renderUnproducedStats() {
        const container = document.getElementById('unproducedStatsContainer');
        const countElement = document.getElementById('unproducedSpecCount');

        if (!container) return;

        // 计算未生产规格数据（按型号分组）
        const unproducedSpecsByType = this.calculateUnproducedSpecsByType();

        // 清空容器
        container.innerHTML = '';

        // 检查是否有未生产规格
        const totalSpecs = unproducedSpecsByType.H100.length + unproducedSpecsByType.H80.length + unproducedSpecsByType.other.length;

        if (totalSpecs === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;">
                    <i class="fas fa-check-circle" style="font-size: 2rem; opacity: 0.3; margin-bottom: 1rem; color: #10b981;"></i>
                    <h4 style="margin: 0 0 0.5rem 0;">所有规格已完成生产</h4>
                    <p style="margin: 0;">当前没有未完成生产的规格</p>
                </div>
            `;
            if (countElement) {
                countElement.textContent = '0';
            }
            return;
        }

        // 更新规格数量显示
        if (countElement) {
            countElement.textContent = totalSpecs;
        }

        // 渲染H100规格组
        if (unproducedSpecsByType.H100.length > 0) {
            this.renderSpecTypeGroup(container, 'H100', unproducedSpecsByType.H100, '#3b82f6');
        }

        // 渲染H80规格组
        if (unproducedSpecsByType.H80.length > 0) {
            this.renderSpecTypeGroup(container, 'H80', unproducedSpecsByType.H80, '#10b981');
        }

        // 渲染其他规格组
        if (unproducedSpecsByType.other.length > 0) {
            this.renderSpecTypeGroup(container, '其他规格', unproducedSpecsByType.other, '#f59e0b');
        }
    }

    // 渲染规格类型组
    renderSpecTypeGroup(container, typeName, specs, color) {
        // 创建类型分组标题
        const typeHeader = document.createElement('div');
        typeHeader.className = 'spec-type-header';
        typeHeader.innerHTML = `
            <div class="spec-type-title" style="border-left-color: ${color};">
                <h4>${typeName} 规格</h4>
                <span class="spec-type-count">${specs.length} 个规格</span>
            </div>
        `;
        container.appendChild(typeHeader);

        // 创建规格卡片容器
        const typeContainer = document.createElement('div');
        typeContainer.className = 'spec-type-container';

        // 渲染该类型的所有规格卡片
        specs.forEach(spec => {
            const card = document.createElement('div');

            // 根据型号设置样式类
            const typeMatch = spec.spec.match(/^(H\d+)/);
            const typeClass = typeMatch ? typeMatch[1].toLowerCase() : 'default';
            card.className = `unproduced-spec-card ${typeClass}`;

            // 计算完成率
            const completionRate = spec.planned > 0 ? ((spec.produced / spec.planned) * 100).toFixed(1) : 0;
            const progressWidth = Math.min(completionRate, 100);

            card.innerHTML = `
                <div class="unproduced-spec-title">${spec.spec}</div>
                <div class="unproduced-spec-value">${this.formatNumber(spec.unproduced)}</div>
                <div class="unproduced-spec-unit">根 (待生产)</div>
                <div class="unproduced-spec-progress">
                    <div class="unproduced-spec-progress-bar" style="width: ${progressWidth}%"></div>
                </div>
                <div class="unproduced-spec-details">
                    <div>计划: ${this.formatNumber(spec.planned)}根</div>
                    <div>已产: ${this.formatNumber(spec.produced)}根</div>
                    <div>完成: ${completionRate}%</div>
                    <div>区域: ${spec.areas.join(', ')}</div>
                </div>
            `;

            typeContainer.appendChild(card);
        });

        container.appendChild(typeContainer);
    }

    // 计算未生产规格数据（按型号分组）
    calculateUnproducedSpecsByType() {
        const specMap = new Map();

        // 遍历所有数据，按规格分组统计
        this.data.forEach(item => {
            const spec = item.spec;

            if (!specMap.has(spec)) {
                specMap.set(spec, {
                    spec: spec,
                    planned: 0,
                    produced: 0,
                    areas: new Set()
                });
            }

            const specData = specMap.get(spec);
            specData.planned += item.planned || 0;
            specData.produced += item.produced || 0;
            specData.areas.add(item.area);
        });

        // 筛选出未完成生产的规格
        const unproducedSpecs = Array.from(specMap.values())
            .map(spec => ({
                spec: spec.spec,
                planned: spec.planned,
                produced: spec.produced,
                unproduced: Math.max(0, spec.planned - spec.produced),
                areas: Array.from(spec.areas).sort()
            }))
            .filter(spec => spec.unproduced > 0); // 只显示未完成的规格

        // 按型号分组
        const specsByType = {
            H100: [],
            H80: [],
            other: []
        };

        unproducedSpecs.forEach(spec => {
            if (spec.spec.startsWith('H100')) {
                specsByType.H100.push(spec);
            } else if (spec.spec.startsWith('H80')) {
                specsByType.H80.push(spec);
            } else {
                specsByType.other.push(spec);
            }
        });

        // 分别对每个类型按未生产量从多到少排序
        specsByType.H100.sort((a, b) => b.unproduced - a.unproduced);
        specsByType.H80.sort((a, b) => b.unproduced - a.unproduced);
        specsByType.other.sort((a, b) => b.unproduced - a.unproduced);

        console.log('未生产规格数据（按型号分组）:', specsByType);
        return specsByType;
    }

    // 保留原方法以兼容其他可能的调用
    calculateUnproducedSpecs() {
        const specsByType = this.calculateUnproducedSpecsByType();
        // 合并所有类型的规格，保持分组内的排序
        return [...specsByType.H100, ...specsByType.H80, ...specsByType.other];
    }

    // 渲染客户发货统计
    renderCustomerStats() {
        const container = document.getElementById('customerStatsContainer');
        const totalCustomersSpan = document.getElementById('totalCustomers');
        const totalShippedMetersSpan = document.getElementById('totalShippedMeters');

        if (!container) {
            console.log('客户统计容器未找到');
            return;
        }

        console.log('开始渲染客户发货统计...');

        // 计算客户发货统计
        const customerStats = this.calculateCustomerStats();
        console.log('客户统计数据:', customerStats);

        // 更新总计信息
        if (totalCustomersSpan) {
            totalCustomersSpan.textContent = customerStats.length;
        }

        const totalMeters = customerStats.reduce((sum, customer) => sum + customer.totalMeters, 0);
        if (totalShippedMetersSpan) {
            totalShippedMetersSpan.textContent = this.formatNumber(totalMeters.toFixed(1));
        }

        // 清空容器
        container.innerHTML = '';

        if (customerStats.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-truck" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                    <h3 style="margin: 0 0 0.5rem 0;">暂无发货数据</h3>
                    <p style="margin: 0;">完成生产并发货后，这里将显示各客户的发货统计</p>
                </div>
            `;
            return;
        }

        // 生成客户统计卡片
        customerStats.forEach((customerStat, index) => {
            const card = this.createCustomerStatCard(customerStat, index + 1, totalMeters);
            container.appendChild(card);
        });
    }

    // 计算客户发货统计
    calculateCustomerStats() {
        const customerMap = new Map();

        // 首先添加已添加到统计中的预定义客户
        const predefinedCustomers = [
            '南通际铨', '盐城恒逸明', '绍兴精工', '上海福铁龙',
            '苏州良浦', '南通顶德', '南通科达'
        ];

        const addedCustomers = JSON.parse(localStorage.getItem('addedCustomers') || '[]');

        // 只显示已添加的预定义客户
        predefinedCustomers.forEach(customerName => {
            if (addedCustomers.includes(customerName)) {
                customerMap.set(customerName, {
                    customerName: customerName,
                    totalQuantity: 0,
                    totalMeters: 0,
                    orderCount: 0,
                    specs: new Set(),
                    lastShippingDate: null,
                    isPredefined: true
                });
            }
        });

        // 优先从发货历史记录中统计（新数据）
        if (this.shippingHistory && this.shippingHistory.length > 0) {
            console.log('从发货历史记录中统计客户数据，记录数:', this.shippingHistory.length);

            this.shippingHistory.forEach(record => {
                const customerName = record.customerName;
                if (!customerName) return;

                if (!customerMap.has(customerName)) {
                    customerMap.set(customerName, {
                        customerName: customerName,
                        totalQuantity: 0,
                        totalMeters: 0,
                        orderCount: 0,
                        specs: new Set(),
                        lastShippingDate: null
                    });
                }

                const customerStat = customerMap.get(customerName);
                customerStat.totalQuantity += record.totalQuantity || 0;
                customerStat.totalMeters += record.totalMeters || record.items.reduce((sum, item) => sum + (item.meters || 0), 0);
                customerStat.orderCount += 1;
                customerStat.isPredefined = false; // 有发货记录的不是预定义状态

                // 添加规格信息
                record.items.forEach(item => {
                    customerStat.specs.add(item.spec);
                });

                // 更新最后发货日期
                const shippingDate = new Date(record.date);
                if (!customerStat.lastShippingDate || shippingDate > customerStat.lastShippingDate) {
                    customerStat.lastShippingDate = shippingDate;
                }
            });
        } else {
            console.log('发货历史为空，从原始数据中统计客户数据');

            // 如果没有发货历史，从原始数据中统计（兼容旧数据）
            this.data.forEach(item => {
                if (item.shippingRecords && item.shippingRecords.length > 0) {
                    item.shippingRecords.forEach(record => {
                        // 兼容旧的customer字段和新的customerName字段
                        const customerName = record.customerName || record.customer;
                        if (!customerName) return;

                        if (!customerMap.has(customerName)) {
                            customerMap.set(customerName, {
                                customerName: customerName,
                                totalQuantity: 0,
                                totalMeters: 0,
                                orderCount: 0,
                                specs: new Set(),
                                lastShippingDate: null
                            });
                        }

                        const customerStat = customerMap.get(customerName);
                        const length = this.extractLengthFromSpec(item.spec);
                        const meters = (record.quantity * length) / 1000;

                        customerStat.totalQuantity += record.quantity;
                        customerStat.totalMeters += meters;
                        customerStat.orderCount += 1;
                        customerStat.specs.add(item.spec);
                        customerStat.isPredefined = false; // 有发货记录的不是预定义状态

                        // 更新最后发货日期
                        const shippingDate = new Date(record.date);
                        if (!customerStat.lastShippingDate || shippingDate > customerStat.lastShippingDate) {
                            customerStat.lastShippingDate = shippingDate;
                        }
                    });
                }
            });
        }

        // 转换为数组并按发货量排序（从多到少）
        const customerStats = Array.from(customerMap.values()).map(stat => ({
            ...stat,
            specsCount: stat.specs.size,
            specs: undefined // 移除Set对象，避免序列化问题
        }));

        // 按发货总量排序（从高到低），预定义客户（无发货记录）排在最后
        return customerStats.sort((a, b) => {
            if (a.isPredefined && !b.isPredefined) return 1;
            if (!a.isPredefined && b.isPredefined) return -1;
            return b.totalMeters - a.totalMeters;
        });
    }

    // 创建客户统计卡片
    createCustomerStatCard(customerStat, rank, totalMeters) {
        const card = document.createElement('div');
        card.className = 'customer-stat-card';

        const percentage = totalMeters > 0 ? (customerStat.totalMeters / totalMeters * 100) : 0;
        const lastShippingText = customerStat.lastShippingDate ?
            customerStat.lastShippingDate.toLocaleDateString('zh-CN') : '无记录';

        // 获取该客户的发货需求
        const customerPlans = this.getShippingPlansForCustomer(customerStat.customerName);
        const plansSummary = this.getCustomerPlansSummary(customerPlans);

        card.innerHTML = `
            <div class="customer-card-layout" style="display: flex; gap: 16px; height: 200px;">
                <!-- 左侧：发货需求列表 -->
                <div class="customer-plans-section" style="flex: 1; display: flex; flex-direction: column;">
                    <div class="customer-stat-header" style="margin-bottom: 12px;">
                        <h4 class="customer-name" style="font-size: 16px; margin: 0;">${customerStat.customerName}</h4>
                        <span class="customer-rank">#${rank}</span>
                    </div>

                    <div class="customer-plans-list" style="flex: 1; overflow-y: auto;">
                        ${this.renderCustomerPlansList(customerPlans)}
                    </div>

                    <div class="customer-card-actions" style="margin-top: 8px;">
                        <button class="customer-action-btn primary" onclick="dataManager.openShippingPlanModal('${customerStat.customerName}')" style="
                            width: 100%;
                            padding: 8px 12px;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            font-size: 12px;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 6px;
                        ">
                            <i class="fas fa-plus-circle"></i>
                            批次发货需求
                        </button>
                    </div>
                </div>

                <!-- 右侧：累计发货统计 -->
                <div class="customer-stats-section" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; padding: 16px;">
                    ${customerStat.isPredefined ? `
                        <div class="customer-stat-metrics" style="display: flex; flex-direction: column; gap: 16px; text-align: center; width: 100%;">
                            <div class="customer-metric">
                                <div class="customer-metric-value" style="font-size: 18px; font-weight: bold; color: #6b7280;">新添加客户</div>
                                <div class="customer-metric-label" style="font-size: 12px; color: #6b7280; margin-top: 4px;">暂无发货记录</div>
                            </div>
                            <div class="customer-metric">
                                <div class="customer-metric-value" style="font-size: 14px; color: #6b7280;">开始发货后将显示统计数据</div>
                            </div>
                        </div>
                    ` : `
                        <div class="customer-stat-metrics" style="display: flex; flex-direction: column; gap: 16px; text-align: center; width: 100%;">
                            <div class="customer-metric">
                                <div class="customer-metric-value" style="font-size: 24px; font-weight: bold; color: #0369a1;">${this.formatNumber(customerStat.totalMeters.toFixed(1))}</div>
                                <div class="customer-metric-label" style="font-size: 12px; color: #0369a1; margin-top: 4px;">累计发货(米)</div>
                            </div>
                            <div class="customer-metric">
                                <div class="customer-metric-value" style="font-size: 20px; font-weight: bold; color: #0369a1;">${this.formatNumber(customerStat.totalQuantity)}</div>
                                <div class="customer-metric-label" style="font-size: 12px; color: #0369a1; margin-top: 4px;">累计发货(根)</div>
                            </div>
                        </div>

                        <div class="customer-stat-progress" style="width: 100%; margin-top: 12px;">
                            <div class="customer-progress-bar" style="width: 100%; height: 4px; background: #e0f2fe; border-radius: 2px; overflow: hidden;">
                                <div class="customer-progress-fill" style="width: ${percentage.toFixed(1)}%; height: 100%; background: #0369a1; transition: width 0.3s ease;"></div>
                            </div>
                            <div class="customer-progress-text" style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #0369a1;">
                                <span>占比: ${percentage.toFixed(1)}%</span>
                                <span>${customerStat.specsCount} 个规格</span>
                            </div>
                        </div>
                    `}
                </div>
            </div>
        `;

        return card;
    }

    // 获取客户发货需求摘要
    getCustomerPlansSummary(customerPlans) {
        if (!customerPlans || customerPlans.length === 0) {
            return {
                totalPlans: 0,
                completePlans: 0,
                incompletePlans: 0
            };
        }

        const completePlans = customerPlans.filter(plan => {
            if (!plan.items || plan.items.length === 0) return false;
            return plan.items.every(item =>
                item.modelType && item.spec && item.quantity > 0 && item.status === 'sufficient'
            );
        }).length;

        return {
            totalPlans: customerPlans.length,
            completePlans: completePlans,
            incompletePlans: customerPlans.length - completePlans
        };
    }

    // 渲染客户发货需求列表
    renderCustomerPlansList(customerPlans) {
        if (!customerPlans || customerPlans.length === 0) {
            return `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #6b7280;
                    text-align: center;
                ">
                    <i class="fas fa-clipboard-list" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p style="margin: 0; font-size: 12px;">暂无发货需求</p>
                </div>
            `;
        }

        let html = '';
        customerPlans.slice(0, 3).forEach((plan, index) => {
            const status = this.getPlanOverallStatus(plan);
            const statusColor = status === 'sufficient' ? '#10b981' :
                               status === 'insufficient' ? '#f59e0b' : '#6b7280';
            const statusText = status === 'sufficient' ? '规格齐全' :
                              status === 'insufficient' ? '规格不全' : '待完善';

            html += `
                <div class="plan-item-mini" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    margin-bottom: 6px;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-left: 3px solid ${statusColor};
                    border-radius: 6px;
                    font-size: 12px;
                ">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; color: #1f2937; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${plan.name}
                        </div>
                        <div style="color: #6b7280; font-size: 10px;">
                            ${plan.items ? plan.items.length : 0} 个规格
                        </div>
                    </div>
                    <div class="status-badge" style="
                        background: ${statusColor};
                        color: white;
                        padding: 2px 6px;
                        border-radius: 10px;
                        font-size: 9px;
                        font-weight: 500;
                        white-space: nowrap;
                    ">
                        ${statusText}
                    </div>
                </div>
            `;
        });

        // 如果有更多需求，显示省略提示
        if (customerPlans.length > 3) {
            html += `
                <div style="
                    text-align: center;
                    padding: 6px;
                    color: #6b7280;
                    font-size: 10px;
                    border-top: 1px dashed #d1d5db;
                    margin-top: 4px;
                ">
                    还有 ${customerPlans.length - 3} 个需求...
                </div>
            `;
        }

        return html;
    }

    // 新增客户卡片相关方法
    openAddCustomerCardModal() {
        const modal = document.getElementById('addCustomerCardModal');
        const overlay = document.getElementById('modalOverlay');

        if (modal && overlay) {
            // 重置模态框状态
            this.resetAddCustomerCardModal();

            // 加载可选客户列表
            this.loadAvailableCustomers();

            modal.classList.add('active');
            overlay.classList.add('active');
        }
    }

    closeAddCustomerCardModal() {
        const modal = document.getElementById('addCustomerCardModal');
        const overlay = document.getElementById('modalOverlay');

        if (modal && overlay) {
            modal.classList.remove('active');
            overlay.classList.remove('active');
            this.resetAddCustomerCardModal();
        }
    }

    setupAddCustomerCardModal() {
        // 关闭按钮
        const closeBtn = document.getElementById('closeAddCustomerCardModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeAddCustomerCardModal();
            });
        }

        // 取消按钮
        const cancelBtn = document.getElementById('cancelAddCustomerCard');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeAddCustomerCardModal();
            });
        }

        // 确认添加按钮
        const confirmBtn = document.getElementById('confirmAddCustomerCard');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmAddCustomerCard();
            });
        }

        // 搜索框
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCustomerList(e.target.value);
            });
        }
    }

    resetAddCustomerCardModal() {
        // 重置搜索框
        const searchInput = document.getElementById('customerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }

        // 隐藏选中客户区域
        const selectedSection = document.getElementById('selectedCustomerSection');
        if (selectedSection) {
            selectedSection.style.display = 'none';
        }

        // 禁用确认按钮
        const confirmBtn = document.getElementById('confirmAddCustomerCard');
        if (confirmBtn) {
            confirmBtn.disabled = true;
        }

        // 重置复选框
        const checkbox = document.getElementById('createShippingPlanCheckbox');
        if (checkbox) {
            checkbox.checked = false;
        }

        // 清空选中状态
        this.selectedCustomerForCard = null;
    }

    loadAvailableCustomers() {
        // 获取预定义的客户列表（来自批量发货系统）
        const predefinedCustomers = [
            '南通际铨', '盐城恒逸明', '绍兴精工', '上海福铁龙',
            '苏州良浦', '南通顶德', '南通科达'
        ];

        // 获取所有已有发货记录的客户
        const recordCustomers = this.getAllCustomersFromShippingRecords();

        // 合并预定义客户和发货记录中的客户
        const allCustomersMap = new Map();

        // 先添加预定义客户
        predefinedCustomers.forEach(customerName => {
            allCustomersMap.set(customerName, {
                name: customerName,
                totalOrders: 0,
                totalQuantity: 0,
                totalMeters: 0,
                lastShippingDate: null,
                isPredefined: true
            });
        });

        // 再添加发货记录中的客户（如果已存在则更新数据）
        recordCustomers.forEach(customer => {
            if (allCustomersMap.has(customer.name)) {
                // 更新预定义客户的数据
                const existing = allCustomersMap.get(customer.name);
                existing.totalOrders = customer.totalOrders;
                existing.totalQuantity = customer.totalQuantity;
                existing.totalMeters = customer.totalMeters;
                existing.lastShippingDate = customer.lastShippingDate;
            } else {
                // 添加新客户
                allCustomersMap.set(customer.name, customer);
            }
        });

        // 获取当前已显示的客户统计
        const currentCustomerStats = this.calculateCustomerStats();
        const displayedCustomers = new Set(currentCustomerStats.map(stat => stat.customerName));

        // 筛选出未显示的客户
        const availableCustomers = Array.from(allCustomersMap.values()).filter(customer =>
            !displayedCustomers.has(customer.name)
        );

        this.renderCustomerSelectionList(availableCustomers);
    }

    getAllCustomersFromShippingRecords() {
        const customerMap = new Map();

        // 遍历所有数据项的发货记录
        this.data.forEach(item => {
            if (item.shippingRecords && Array.isArray(item.shippingRecords)) {
                item.shippingRecords.forEach(record => {
                    const customerName = record.customer;
                    if (customerName && !customerMap.has(customerName)) {
                        customerMap.set(customerName, {
                            name: customerName,
                            totalOrders: 0,
                            totalQuantity: 0,
                            totalMeters: 0,
                            lastShippingDate: null
                        });
                    }

                    if (customerName) {
                        const customer = customerMap.get(customerName);
                        customer.totalOrders++;
                        customer.totalQuantity += record.quantity || 0;

                        const length = this.extractLengthFromSpec(item.spec);
                        customer.totalMeters += (record.quantity * length) / 1000;

                        const shippingDate = new Date(record.date);
                        if (!customer.lastShippingDate || shippingDate > customer.lastShippingDate) {
                            customer.lastShippingDate = shippingDate;
                        }
                    }
                });
            }
        });

        return Array.from(customerMap.values());
    }

    renderCustomerSelectionList(customers) {
        const container = document.getElementById('customerSelectionList');
        if (!container) return;

        if (customers.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">
                    <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                    <p>暂无可添加的客户</p>
                    <p style="font-size: var(--text-xs);">所有有发货记录的客户都已显示</p>
                </div>
            `;
            return;
        }

        let html = '';
        customers.forEach(customer => {
            const lastShippingText = customer.lastShippingDate ?
                customer.lastShippingDate.toLocaleDateString('zh-CN') : '无发货记录';

            // 为预定义客户显示不同的统计信息
            let statsText = '';
            if (customer.totalOrders > 0) {
                statsText = `${customer.totalOrders}个订单 · ${this.formatNumber(customer.totalMeters.toFixed(1))}米 · 最后发货: ${lastShippingText}`;
            } else {
                statsText = `系统预设客户 · 暂无发货记录`;
            }

            html += `
                <div class="customer-list-item" data-customer="${customer.name}">
                    <div class="customer-item-info">
                        <div class="customer-item-name">
                            ${customer.name}
                            ${customer.isPredefined ? '<span class="customer-badge">系统客户</span>' : ''}
                        </div>
                        <div class="customer-item-stats">
                            ${statsText}
                        </div>
                    </div>
                    <div class="customer-item-actions">
                        <button class="btn btn-sm btn-outline" onclick="dataManager.selectCustomerForCard('${customer.name}')">
                            选择
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    selectCustomerForCard(customerName) {
        this.selectedCustomerForCard = customerName;

        // 更新选中状态的视觉效果
        const items = document.querySelectorAll('.customer-list-item');
        items.forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.customer === customerName) {
                item.classList.add('selected');
            }
        });

        // 显示选中客户信息
        this.showSelectedCustomerInfo(customerName);

        // 启用确认按钮
        const confirmBtn = document.getElementById('confirmAddCustomerCard');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
    }

    showSelectedCustomerInfo(customerName) {
        const section = document.getElementById('selectedCustomerSection');
        const infoContainer = document.getElementById('selectedCustomerInfo');

        if (!section || !infoContainer) return;

        // 获取客户信息 - 需要从完整的客户列表中查找（包括预定义客户）
        const predefinedCustomers = [
            '南通际铨', '盐城恒逸明', '绍兴精工', '上海福铁龙',
            '苏州良浦', '南通顶德', '南通科达'
        ];

        // 先从发货记录中查找
        const recordCustomers = this.getAllCustomersFromShippingRecords();
        let customer = recordCustomers.find(c => c.name === customerName);

        // 如果没找到，说明是预定义客户
        if (!customer && predefinedCustomers.includes(customerName)) {
            customer = {
                name: customerName,
                totalOrders: 0,
                totalQuantity: 0,
                totalMeters: 0,
                lastShippingDate: null,
                isPredefined: true
            };
        }

        if (customer) {
            let infoHtml = '';

            if (customer.totalOrders > 0) {
                const lastShippingText = customer.lastShippingDate ?
                    customer.lastShippingDate.toLocaleDateString('zh-CN') : '无记录';

                infoHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500; font-size: 16px; margin-bottom: 4px;">${customer.name}</div>
                            <div style="font-size: var(--text-sm); color: var(--text-secondary);">
                                历史发货: ${customer.totalOrders}个订单 · ${this.formatNumber(customer.totalMeters.toFixed(1))}米
                            </div>
                            <div style="font-size: var(--text-xs); color: var(--text-secondary);">
                                最后发货: ${lastShippingText}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <i class="fas fa-check-circle" style="color: var(--accent-green); font-size: 24px;"></i>
                        </div>
                    </div>
                `;
            } else {
                infoHtml = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500; font-size: 16px; margin-bottom: 4px;">${customer.name}</div>
                            <div style="font-size: var(--text-sm); color: var(--text-secondary);">
                                系统预设客户 · 暂无发货记录
                            </div>
                            <div style="font-size: var(--text-xs); color: var(--text-secondary);">
                                添加后可开始统计发货数据
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <i class="fas fa-check-circle" style="color: var(--accent-green); font-size: 24px;"></i>
                        </div>
                    </div>
                `;
            }

            infoContainer.innerHTML = infoHtml;
        }

        section.style.display = 'block';
    }

    filterCustomerList(searchTerm) {
        const items = document.querySelectorAll('.customer-list-item');
        const term = searchTerm.toLowerCase();

        items.forEach(item => {
            const customerName = item.dataset.customer.toLowerCase();
            const isVisible = customerName.includes(term);
            item.style.display = isVisible ? 'flex' : 'none';
        });
    }

    confirmAddCustomerCard() {
        if (!this.selectedCustomerForCard) {
            this.showNotification('请先选择一个客户', 'warning');
            return;
        }

        const createShippingPlan = document.getElementById('createShippingPlanCheckbox').checked;

        // 添加客户到显示的统计中
        this.addCustomerToStats(this.selectedCustomerForCard);

        // 如果选择了创建发货需求，则打开发货需求模态框
        if (createShippingPlan) {
            this.closeAddCustomerCardModal();
            setTimeout(() => {
                this.openShippingPlanModal(this.selectedCustomerForCard);
            }, 300);
        } else {
            this.closeAddCustomerCardModal();
        }

        this.showNotification(`客户 ${this.selectedCustomerForCard} 已添加到统计中`, 'success');
    }

    addCustomerToStats(customerName) {
        // 将客户添加到已添加列表中
        const addedCustomers = JSON.parse(localStorage.getItem('addedCustomers') || '[]');
        if (!addedCustomers.includes(customerName)) {
            addedCustomers.push(customerName);
            localStorage.setItem('addedCustomers', JSON.stringify(addedCustomers));
        }

        // 强制刷新客户统计，新客户会自动显示
        this.renderCustomerStats();
    }

    // 更新产量统计
    updateProductionStats() {
        const stats = this.calculateProductionStats();

        // 更新显示
        const dailyElement = document.getElementById('dailyProduction');
        const monthlyElement = document.getElementById('monthlyProduction');
        const quarterlyElement = document.getElementById('quarterlyProduction');
        const yearlyElement = document.getElementById('yearlyProduction');

        if (dailyElement) dailyElement.textContent = this.formatNumber(stats.daily.toFixed(1));
        if (monthlyElement) monthlyElement.textContent = this.formatNumber(stats.monthly.toFixed(1));
        if (quarterlyElement) quarterlyElement.textContent = this.formatNumber(stats.quarterly.toFixed(1));
        if (yearlyElement) yearlyElement.textContent = this.formatNumber(stats.yearly.toFixed(1));
    }

    // 处理远程数据更新（Firebase 实时同步）
    handleRemoteDataUpdate(remoteData) {
        if (!remoteData || !Array.isArray(remoteData)) return;

        // 如果正在手动同步，跳过远程数据更新，保护本地数据
        if (this.isManualSyncing) {
            console.log('⏸️ 手动同步进行中，跳过远程数据更新，保护本地数据');
            return;
        }

        // 检查是否刚刚完成手动同步（5秒内）
        const timeSinceManualSync = Date.now() - (this.lastManualSyncTime || 0);
        if (timeSinceManualSync < 5000) {
            console.log('⏸️ 刚完成手动同步，跳过远程数据更新，保护本地数据');
            return;
        }

        console.log('收到远程生产数据更新:', remoteData.length, '条记录');
        console.log('当前本地数据:', this.data.length, '条记录');

        // 如果远程数据为空且本地有数据，保护本地数据
        if (remoteData.length === 0 && this.data.length > 0) {
            console.log('⚠️ 远程生产数据为空，保护本地数据，跳过更新');
            return;
        }

        // 如果本地没有数据，直接使用远程数据
        if (this.data.length === 0 && remoteData.length > 0) {
            console.log('本地无数据，直接使用远程数据');
            this.data = [...remoteData];
            this.filteredData = [...this.data];

            // 更新本地存储（不触发云端同步，避免循环）
            localStorage.setItem('productionData', JSON.stringify(this.data));

            // 更新界面
            this.renderTable();
            this.updateStats();
            this.renderAreaStats();
            this.renderUnproducedStats();

            // 强制更新主界面统计数据
            this.forceUpdateDashboard();

            this.showNotification(`已从云端加载 ${remoteData.length} 条生产数据`, 'success');
            return;
        }

        // 合并远程数据和本地数据
        const mergedData = this.mergeDataWithRemote(this.data, remoteData);

        if (this.hasDataChanged(this.data, mergedData)) {
            console.log('数据有变化，更新本地数据');
            this.data = mergedData;
            this.filteredData = [...this.data];

            // 更新本地存储（不触发云端同步，避免循环）
            localStorage.setItem('productionData', JSON.stringify(this.data));

            // 更新界面
            this.renderTable();
            this.updateStats();
            this.renderAreaStats();
            this.renderUnproducedStats();

            // 强制更新主界面统计数据
            this.forceUpdateDashboard();

            this.showNotification('数据已从云端同步更新', 'info');
        } else {
            console.log('数据无变化，跳过更新');
        }
    }

    // 处理远程发货历史更新
    handleRemoteShippingUpdate(remoteData) {
        if (!remoteData || !Array.isArray(remoteData)) return;

        // 如果正在手动同步，跳过远程数据更新
        if (this.isManualSyncing) {
            console.log('⏸️ 手动同步进行中，跳过远程发货历史更新');
            return;
        }

        console.log('收到远程发货历史更新:', remoteData.length, '条记录');
        console.log('当前本地发货历史:', this.shippingHistory.length, '条记录');

        // 如果远程数据为空且本地有数据，保护本地数据
        if (remoteData.length === 0 && this.shippingHistory.length > 0) {
            console.log('⚠️ 远程发货历史为空，保护本地数据，跳过更新');
            return;
        }

        // 如果本地没有数据，直接使用远程数据
        if (this.shippingHistory.length === 0 && remoteData.length > 0) {
            console.log('本地无发货历史，直接使用远程数据');
            this.shippingHistory = [...remoteData];
            localStorage.setItem('shippingHistory', JSON.stringify(this.shippingHistory));
            this.renderCustomerStats();
            this.forceUpdateDashboard(); // 强制更新主界面
            this.showNotification(`已从云端加载 ${remoteData.length} 条发货记录`, 'success');
            return;
        }

        const mergedData = this.mergeDataWithRemote(this.shippingHistory, remoteData);

        if (this.hasDataChanged(this.shippingHistory, mergedData)) {
            this.shippingHistory = mergedData;
            localStorage.setItem('shippingHistory', JSON.stringify(this.shippingHistory));

            // 更新相关界面
            this.renderCustomerStats();
            this.forceUpdateDashboard(); // 强制更新主界面

            this.showNotification('发货数据已从云端同步更新', 'info');
        }
    }

    // 处理远程原材料采购更新
    handleRemoteMaterialUpdate(remoteData) {
        if (!remoteData || !Array.isArray(remoteData)) return;

        // 如果正在手动同步，跳过远程数据更新
        if (this.isManualSyncing) {
            console.log('⏸️ 手动同步进行中，跳过远程原材料更新');
            return;
        }

        console.log('收到远程原材料采购更新:', remoteData.length, '条记录');
        console.log('当前本地原材料采购:', this.materialPurchases.length, '条记录');

        // 如果远程数据为空且本地有数据，保护本地数据
        if (remoteData.length === 0 && this.materialPurchases.length > 0) {
            console.log('⚠️ 远程原材料数据为空，保护本地数据，跳过更新');
            return;
        }

        // 如果本地没有数据，直接使用远程数据
        if (this.materialPurchases.length === 0 && remoteData.length > 0) {
            console.log('本地无原材料数据，直接使用远程数据');
            this.materialPurchases = [...remoteData];
            localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));
            this.forceUpdateDashboard(); // 强制更新主界面
            this.showNotification(`已从云端加载 ${remoteData.length} 条原材料记录`, 'success');
            return;
        }

        const mergedData = this.mergeDataWithRemote(this.materialPurchases, remoteData);

        if (this.hasDataChanged(this.materialPurchases, mergedData)) {
            this.materialPurchases = mergedData;
            localStorage.setItem('materialPurchases', JSON.stringify(this.materialPurchases));
            this.forceUpdateDashboard(); // 强制更新主界面

            this.showNotification('原材料数据已从云端同步更新', 'info');
        }
    }

    // 合并本地和远程数据（改进版本）
    mergeDataWithRemote(localData, remoteData) {
        // 确保输入数据是数组
        if (!Array.isArray(localData)) localData = [];
        if (!Array.isArray(remoteData)) remoteData = [];

        const merged = new Map();
        const conflicts = [];

        console.log('🔄 开始智能数据合并...');
        console.log(`本地数据: ${localData.length} 条，远程数据: ${remoteData.length} 条`);

        // 先添加本地数据
        localData.forEach(item => {
            // 确保item有有效的ID
            if (!item || !item.id) {
                console.warn('跳过无效的本地数据项:', item);
                return;
            }

            // 确保每个项目都有必要的元数据
            const enhancedItem = {
                ...item,
                source: 'local',
                lastModified: item.lastModified || item.timestamp || Date.now(),
                version: item.version || 1
            };
            merged.set(String(item.id), enhancedItem);
        });

        // 处理远程数据
        remoteData.forEach(item => {
            // 确保item有有效的ID
            if (!item || !item.id) {
                console.warn('跳过无效的远程数据项:', item);
                return;
            }

            const itemId = String(item.id);
            const existing = merged.get(itemId);
            const remoteItem = {
                ...item,
                source: 'remote',
                lastModified: item.lastModified || item.timestamp || Date.now(),
                version: item.version || 1
            };

            if (!existing) {
                // 新的远程数据，直接添加
                merged.set(itemId, remoteItem);
                console.log(`➕ 新增远程数据: ID ${itemId}`);
            } else {
                // 存在冲突，需要智能合并
                const mergeResult = this.resolveDataConflict(existing, remoteItem);

                if (mergeResult.hasConflict) {
                    conflicts.push({
                        id: itemId,
                        local: existing,
                        remote: remoteItem,
                        resolution: mergeResult.resolution
                    });
                    console.log(`⚠️ 数据冲突: ID ${itemId}, 解决方案: ${mergeResult.resolution}`);
                }

                merged.set(itemId, mergeResult.mergedItem);
            }
        });

        // 只显示真正重要的冲突
        const importantConflicts = conflicts.filter(conflict =>
            conflict.resolution !== 'data_identical' &&
            conflict.resolution !== 'minor_differences'
        );

        if (importantConflicts.length > 0) {
            this.showConflictNotification(importantConflicts);
        } else if (conflicts.length > 0) {
            console.log(`📝 数据同步完成，处理了 ${conflicts.length} 个轻微差异，无需用户关注`);
        }

        const result = Array.from(merged.values()).map(item => {
            const { source, ...cleanItem } = item;
            return cleanItem;
        });

        console.log(`✅ 数据合并完成: ${result.length} 条记录，${conflicts.length} 个冲突`);
        return result;
    }

    // 解决数据冲突
    resolveDataConflict(localItem, remoteItem) {
        const localTime = localItem.lastModified || localItem.timestamp || 0;
        const remoteTime = remoteItem.lastModified || remoteItem.timestamp || 0;
        const localVersion = localItem.version || 1;
        const remoteVersion = remoteItem.version || 1;

        // 检查是否是手动同步的数据（优先级最高）
        const localIsManualSync = localItem.manualSyncFlag === true;
        const remoteIsManualSync = remoteItem.manualSyncFlag === true;

        // 如果本地数据是手动同步的，优先使用本地数据
        if (localIsManualSync && !remoteIsManualSync) {
            return {
                hasConflict: true,
                resolution: 'local_manual_sync_priority',
                mergedItem: { ...localItem, version: Math.max(localVersion, remoteVersion) + 1 }
            };
        }

        // 如果远程数据是手动同步的，使用远程数据
        if (remoteIsManualSync && !localIsManualSync) {
            return {
                hasConflict: true,
                resolution: 'remote_manual_sync_priority',
                mergedItem: { ...remoteItem, version: Math.max(localVersion, remoteVersion) + 1 }
            };
        }

        // 首先检查数据是否实际相同（忽略元数据）
        const localCore = this.extractCoreData(localItem);
        const remoteCore = this.extractCoreData(remoteItem);
        const isCoreDataSame = JSON.stringify(localCore) === JSON.stringify(remoteCore);

        // 如果核心数据相同，只是元数据不同，不算冲突
        if (isCoreDataSame) {
            return {
                hasConflict: false,
                resolution: 'data_identical',
                mergedItem: {
                    ...localItem,
                    version: Math.max(localVersion, remoteVersion),
                    lastModified: Math.max(localTime, remoteTime)
                }
            };
        }

        // 策略1: 版本号优先（只有在数据不同时才算冲突）
        if (remoteVersion > localVersion) {
            return {
                hasConflict: true,
                resolution: 'remote_version_newer',
                mergedItem: { ...remoteItem, version: remoteVersion + 1 }
            };
        }

        if (localVersion > remoteVersion) {
            return {
                hasConflict: true,
                resolution: 'local_version_newer',
                mergedItem: { ...localItem, version: localVersion + 1 }
            };
        }

        // 策略2: 时间戳优先（版本号相同时，增加容错时间到30秒）
        if (remoteTime > localTime + 30000) { // 30秒容错
            return {
                hasConflict: true,
                resolution: 'remote_time_newer',
                mergedItem: { ...remoteItem, version: Math.max(localVersion, remoteVersion) + 1 }
            };
        }

        if (localTime > remoteTime + 30000) { // 30秒容错
            return {
                hasConflict: false,
                resolution: 'local_time_newer',
                mergedItem: { ...localItem, version: Math.max(localVersion, remoteVersion) + 1 }
            };
        }

        // 策略3: 智能字段合并（时间相近时）
        const mergedItem = this.smartFieldMerge(localItem, remoteItem);
        const hasRealChanges = JSON.stringify(this.extractCoreData(mergedItem)) !== JSON.stringify(localCore);

        return {
            hasConflict: hasRealChanges,
            resolution: hasRealChanges ? 'smart_merge' : 'minor_differences',
            mergedItem: { ...mergedItem, version: Math.max(localVersion, remoteVersion) + 1 }
        };
    }

    // 提取核心数据（排除元数据）
    extractCoreData(item) {
        const {
            id, timestamp, lastModified, version, source,
            lastModifiedBy, lastModifiedByName, syncedAt, manualSyncFlag,
            ...coreData
        } = item;
        return coreData;
    }

    // 智能字段合并
    smartFieldMerge(localItem, remoteItem) {
        const merged = { ...localItem };

        // 数量字段：取较大值（通常表示更新的生产进度）
        const localProduced = Number(localItem.produced) || 0;
        const remoteProduced = Number(remoteItem.produced) || 0;
        if (remoteProduced > localProduced) {
            merged.produced = remoteProduced;
            merged.lastModifiedBy = remoteItem.lastModifiedBy;
            merged.lastModifiedByName = remoteItem.lastModifiedByName;
        }

        // 发货数量：取较大值
        const localShipped = Number(localItem.shipped) || 0;
        const remoteShipped = Number(remoteItem.shipped) || 0;
        if (remoteShipped > localShipped) {
            merged.shipped = remoteShipped;
            merged.shippingRecords = remoteItem.shippingRecords || merged.shippingRecords;
        }

        // 状态：优先级排序
        const statusPriority = { '未开始': 1, '进行中': 2, '已完成': 3, '已发货': 4 };
        if ((statusPriority[remoteItem.status] || 0) > (statusPriority[localItem.status] || 0)) {
            merged.status = remoteItem.status;
        }

        // 备注：合并（如果不同）
        if (remoteItem.remarks && remoteItem.remarks !== localItem.remarks) {
            merged.remarks = `${localItem.remarks || ''} | 远程更新: ${remoteItem.remarks}`.trim();
        }

        merged.lastModified = Math.max(
            localItem.lastModified || 0,
            remoteItem.lastModified || 0
        );

        return merged;
    }

    // 显示冲突通知
    showConflictNotification(conflicts) {
        // 检查用户是否禁用了冲突通知
        const isDisabled = localStorage.getItem('disableConflictNotifications') === 'true';

        const conflictCount = conflicts.length;

        // 在控制台显示详细冲突信息（总是显示）
        console.group('📋 数据冲突详情');
        conflicts.forEach((conflict, index) => {
            console.log(`${index + 1}. ID: ${conflict.id}, 解决方案: ${conflict.resolution}`);
            console.log('   本地数据:', conflict.local);
            console.log('   远程数据:', conflict.remote);
        });
        console.groupEnd();

        // 只有在未禁用时才显示UI通知
        if (!isDisabled) {
            const message = `检测到 ${conflictCount} 个数据冲突，已自动合并。详情请查看控制台。`;
            this.showNotification(message, 'warning');
        } else {
            console.log(`📝 检测到 ${conflictCount} 个数据冲突，已自动合并（通知已禁用）`);
        }
    }

    // 检查数据是否有变化
    hasDataChanged(oldData, newData) {
        if (oldData.length !== newData.length) return true;

        // 安全的深度比较（确保ID是字符串）
        try {
            const sortedOld = [...oldData].sort((a, b) => {
                const idA = String(a.id || '');
                const idB = String(b.id || '');
                return idA.localeCompare(idB);
            });
            const sortedNew = [...newData].sort((a, b) => {
                const idA = String(a.id || '');
                const idB = String(b.id || '');
                return idA.localeCompare(idB);
            });

            return JSON.stringify(sortedOld) !== JSON.stringify(sortedNew);
        } catch (error) {
            console.warn('数据比较出错，使用简单比较:', error);
            return JSON.stringify(oldData) !== JSON.stringify(newData);
        }
    }

    // 计算产量统计
    calculateProductionStats() {
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

        // 遍历所有生产记录
        this.data.forEach(item => {
            if (item.productionRecords && Array.isArray(item.productionRecords)) {
                // 获取规格长度（毫米）
                const length = this.extractLengthFromSpec(item.spec);

                item.productionRecords.forEach(record => {
                    const recordDate = new Date(record.date);
                    const quantity = record.quantity || 0;
                    // 将根数转换为米数：根数 × 长度(mm) ÷ 1000
                    const meters = (quantity * length) / 1000;

                    // 日产量（只统计今天新增的生产记录）
                    // 检查记录的时间戳，只统计今天创建的记录
                    if (record.date === todayString) {
                        // 如果有时间戳，进一步检查是否为今天创建
                        if (record.timestamp) {
                            const recordTimestamp = new Date(record.timestamp);
                            if (recordTimestamp >= today) {
                                dailyProduction += meters;
                            }
                        } else {
                            // 没有时间戳的记录，按日期判断
                            dailyProduction += meters;
                        }
                    }

                    // 月产量（本月）
                    if (recordDate >= thisMonth) {
                        monthlyProduction += meters;
                    }

                    // 季度产量（本季度）
                    if (recordDate >= thisQuarter) {
                        quarterlyProduction += meters;
                    }

                    // 年产量（本年）
                    if (recordDate >= thisYear) {
                        yearlyProduction += meters;
                    }
                });
            }
        });

        return {
            daily: Math.round(dailyProduction * 10) / 10, // 保留1位小数
            monthly: Math.round(monthlyProduction * 10) / 10,
            quarterly: Math.round(quarterlyProduction * 10) / 10,
            yearly: Math.round(yearlyProduction * 10) / 10
        };
    }

    // 批次发货需求功能
    openShippingPlanModal(customerName) {
        const modal = document.getElementById('shippingPlanModal');
        const overlay = document.getElementById('modalOverlay');

        if (!modal) {
            this.createShippingPlanModal();
            return this.openShippingPlanModal(customerName);
        }

        // 设置客户名称
        document.getElementById('planCustomerName').textContent = customerName;
        this.currentPlanCustomer = customerName;

        // 初始化发货需求数据
        this.shippingPlans = this.getShippingPlansForCustomer(customerName);
        this.renderShippingPlans();

        // 显示模态框
        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closeShippingPlanModal() {
        const modal = document.getElementById('shippingPlanModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        // 清理数据
        this.currentPlanCustomer = null;
        this.shippingPlans = [];
    }

    createShippingPlanModal() {
        const modalHTML = `
            <div id="shippingPlanModal" class="modal">
                <div class="modal-content large-modal">
                    <div class="modal-header">
                        <h3>📦 批次发货需求 - <span id="planCustomerName"></span></h3>
                        <button class="modal-close" onclick="dataManager.closeShippingPlanModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="modal-body">
                        <div class="shipping-plan-controls">
                            <button class="btn btn-primary" onclick="dataManager.addShippingPlan()">
                                <i class="fas fa-plus"></i>
                                新增发货需求
                            </button>
                            <button class="btn btn-success" onclick="dataManager.executeShippingPlans()">
                                <i class="fas fa-truck"></i>
                                执行发货需求
                            </button>
                        </div>

                        <div class="shipping-plans-container" id="shippingPlansContainer">
                            <!-- 发货需求将在这里动态生成 -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    getShippingPlansForCustomer(customerName) {
        // 从localStorage获取该客户的发货需求
        const allPlans = JSON.parse(localStorage.getItem('shippingPlans') || '{}');
        return allPlans[customerName] || [];
    }

    saveShippingPlansForCustomer(customerName, plans) {
        // 保存该客户的发货需求到localStorage
        const allPlans = JSON.parse(localStorage.getItem('shippingPlans') || '{}');
        allPlans[customerName] = plans;
        localStorage.setItem('shippingPlans', JSON.stringify(allPlans));
    }

    addShippingPlan() {
        const newPlan = {
            id: Date.now().toString(),
            name: `发货需求 ${this.shippingPlans.length + 1}`,
            items: [], // 包含多个规格的数组
            status: 'pending', // pending, sufficient, insufficient
            createdAt: new Date().toISOString()
        };

        this.shippingPlans.push(newPlan);

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    renderShippingPlans() {
        const container = document.getElementById('shippingPlansContainer');
        if (!container) return;

        if (this.shippingPlans.length === 0) {
            container.innerHTML = `
                <div class="empty-plans">
                    <i class="fas fa-clipboard-list"></i>
                    <p>暂无发货需求，点击"新增发货需求"开始添加</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.shippingPlans.forEach((plan, planIndex) => {
            const statusClass = this.getPlanOverallStatus(plan);
            const statusColor = statusClass === 'sufficient' ? '#10b981' :
                               statusClass === 'insufficient' ? '#f59e0b' : '#6b7280';
            const statusText = statusClass === 'sufficient' ? '规格齐全' :
                              statusClass === 'insufficient' ? '规格不全' : '待完善';

            html += `
                <div class="shipping-plan-card ${statusClass}" data-plan-id="${plan.id}" style="
                    border: 2px solid ${statusColor};
                    border-radius: 12px;
                    margin-bottom: 16px;
                    background: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    position: relative;
                    cursor: pointer;
                    transition: all 0.2s ease;
                " onclick="dataManager.togglePlanDetails('${plan.id}')">
                    <div class="plan-header" style="
                        padding: 16px;
                        border-bottom: 1px solid #e5e7eb;
                        background: linear-gradient(135deg, ${statusColor}15, ${statusColor}05);
                    ">
                        <div class="plan-title-section" style="display: flex; align-items: center; gap: 12px;">
                            <span class="plan-number" style="
                                background: ${statusColor};
                                color: white;
                                width: 32px;
                                height: 32px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                font-size: 14px;
                            ">#${planIndex + 1}</span>
                            <div style="flex: 1;">
                                <input type="text" class="plan-name-input" value="${plan.name}"
                                       onchange="dataManager.updatePlanName('${plan.id}', this.value)"
                                       onclick="event.stopPropagation()"
                                       placeholder="需求名称" style="
                                           border: none;
                                           background: transparent;
                                           font-size: 16px;
                                           font-weight: 600;
                                           color: #1f2937;
                                           width: 100%;
                                           padding: 4px 0;
                                       ">
                                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                                    ${statusText} • ${plan.items ? plan.items.length : 0} 个规格
                                </div>
                            </div>
                            <div class="status-indicator" style="
                                background: ${statusColor};
                                color: white;
                                padding: 4px 8px;
                                border-radius: 12px;
                                font-size: 11px;
                                font-weight: 500;
                            ">${statusText}</div>
                        </div>
                        <div class="plan-header-actions" style="
                            display: flex;
                            gap: 8px;
                            margin-top: 12px;
                        ">
                            <button class="plan-add-item-btn" data-plan-id="${plan.id}" data-action="add-plan-item"
                                    onclick="event.stopPropagation(); dataManager.addPlanItem('${plan.id}')" style="
                                background: #3b82f6;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 6px;
                                font-size: 12px;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                gap: 4px;
                            ">
                                <i class="fas fa-plus"></i>
                                添加规格
                            </button>
                            <button class="plan-delete-btn" onclick="event.stopPropagation(); dataManager.removeShippingPlan('${plan.id}')" style="
                                background: #ef4444;
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 6px;
                                font-size: 12px;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                gap: 4px;
                            ">
                                <i class="fas fa-trash"></i>
                                删除
                            </button>
                        </div>
                    </div>

                    <div class="plan-content" id="plan-content-${plan.id}" style="display: block;">
                        <div class="plan-items-container">
                            ${this.renderPlanItems(plan)}
                        </div>

                        <div class="plan-summary">
                            ${this.getPlanSummary(plan)}
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // 添加事件委托处理按钮点击
        this.setupShippingPlanEventListeners();
    }

    setupShippingPlanEventListeners() {
        const container = document.getElementById('shippingPlansContainer');
        if (!container) return;

        // 移除之前的事件监听器
        container.removeEventListener('click', this.handleShippingPlanClick);

        // 添加事件委托
        this.handleShippingPlanClick = (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const planId = target.dataset.planId;

            console.log('按钮被点击了!', { action, planId });

            if (action === 'add-plan-item' && planId) {
                console.log('调用 addPlanItem:', planId);
                this.addPlanItem(planId);
            } else if (action === 'save-plan' && planId) {
                console.log('调用 savePlan:', planId);
                this.savePlan(planId);
            }
        };

        container.addEventListener('click', this.handleShippingPlanClick);
        console.log('发货需求事件监听器已设置');
    }

    renderPlanItems(plan) {
        if (!plan.items || plan.items.length === 0) {
            return `
                <div class="empty-plan-items" onclick="event.stopPropagation(); dataManager.addPlanItem('${plan.id}')" style="cursor: pointer;">
                    <i class="fas fa-plus-circle" style="font-size: 48px; color: #9ca3af; margin-bottom: 16px;"></i>
                    <p style="color: #6b7280; margin-bottom: 16px;">暂无规格项目，点击此处开始添加</p>
                    <button class="empty-add-item-btn" onclick="event.stopPropagation(); dataManager.addPlanItem('${plan.id}')" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        pointer-events: auto;
                    ">
                        <i class="fas fa-plus"></i>
                        添加规格
                    </button>
                </div>
            `;
        }

        let html = '';
        plan.items.forEach((item, itemIndex) => {
            const statusClass = item.status === 'sufficient' ? 'sufficient' :
                               item.status === 'insufficient' ? 'insufficient' : 'pending';

            html += `
                <div class="plan-item ${statusClass}" data-item-index="${itemIndex}" onclick="event.stopPropagation()" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    background: white;
                ">
                    <span class="item-number" style="
                        background: #3b82f6;
                        color: white;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        font-weight: bold;
                        flex-shrink: 0;
                    ">${itemIndex + 1}</span>

                    <div class="plan-field" style="flex: 0 0 100px;">
                        <select class="plan-model-select" onchange="dataManager.updatePlanItemModel('${plan.id}', ${itemIndex}, this.value)" onclick="event.stopPropagation()" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 13px;
                        ">
                            <option value="">选择型号</option>
                            <option value="H80" ${item.modelType === 'H80' ? 'selected' : ''}>H80</option>
                            <option value="H100" ${item.modelType === 'H100' ? 'selected' : ''}>H100</option>
                        </select>
                    </div>

                    <div class="plan-field" style="flex: 1; min-width: 150px;">
                        <select class="plan-spec-select" onchange="dataManager.updatePlanItemSpec('${plan.id}', ${itemIndex}, this.value)" onclick="event.stopPropagation()" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid #d1d5db;
                            border-radius: 4px;
                            font-size: 13px;
                        ">
                            <option value="">请先选择型号类型</option>
                            ${this.generateSpecOptions(item.modelType, item.spec)}
                        </select>
                    </div>

                    <div class="plan-field" style="flex: 0 0 100px;">
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <input type="number" class="plan-quantity-input"
                                   value="${item.quantity || 0}" min="1"
                                   onchange="dataManager.updatePlanItemQuantity('${plan.id}', ${itemIndex}, this.value)"
                                   onclick="event.stopPropagation()"
                                   style="
                                       width: 70px;
                                       padding: 6px 8px;
                                       border: 1px solid #d1d5db;
                                       border-radius: 4px;
                                       font-size: 13px;
                                   ">
                            <span style="font-size: 12px; color: #6b7280;">根</span>
                        </div>
                    </div>

                    <div class="plan-field" style="flex: 0 0 100px;">
                        <div class="available-quantity ${statusClass}" style="
                            display: flex;
                            align-items: center;
                            gap: 4px;
                            padding: 6px 8px;
                            border-radius: 4px;
                            font-size: 13px;
                            ${item.status === 'sufficient' ? 'background: #dcfce7; color: #166534;' :
                              item.status === 'insufficient' ? 'background: #fef2f2; color: #dc2626;' :
                              'background: #f3f4f6; color: #6b7280;'}
                        ">
                            <span class="quantity">${item.availableQuantity || 0}</span>
                            <span style="font-size: 11px;">根</span>
                            <span class="status-indicator" style="font-weight: bold;">
                                ${item.status === 'sufficient' ? '✓' :
                                  item.status === 'insufficient' ? '⚠' : '?'}
                            </span>
                        </div>
                    </div>

                    <div class="plan-item-status" style="flex: 1; min-width: 120px; font-size: 12px;">
                        ${this.getPlanItemStatusText(item)}
                    </div>

                    <button class="item-delete-btn" onclick="event.stopPropagation(); dataManager.removePlanItem('${plan.id}', ${itemIndex})" style="
                        background: #ef4444;
                        color: white;
                        border: none;
                        width: 28px;
                        height: 28px;
                        border-radius: 4px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i class="fas fa-times" style="font-size: 12px;"></i>
                    </button>
                </div>
            `;
        });

        // 添加"添加更多规格"和"保存发货需求"按钮
        html += `
            <div onclick="event.stopPropagation()" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                margin-top: 8px;
                background: #f9fafb;
                gap: 12px;
            ">
                <button class="add-more-item-btn" onclick="event.stopPropagation(); dataManager.addPlanItem('${plan.id}')" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 500;
                ">
                    <i class="fas fa-plus"></i>
                    添加更多规格
                </button>

                <button class="save-plan-btn" onclick="event.stopPropagation(); dataManager.savePlan('${plan.id}')" style="
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-weight: 500;
                ">
                    <i class="fas fa-save"></i>
                    保存发货需求
                </button>
            </div>
        `;

        return html;
    }

    getPlanSummary(plan) {
        if (!plan.items || plan.items.length === 0) {
            return '<div class="plan-summary-empty">暂无规格项目</div>';
        }

        const totalItems = plan.items.length;
        const sufficientItems = plan.items.filter(item => item.status === 'sufficient').length;
        const insufficientItems = plan.items.filter(item => item.status === 'insufficient').length;
        const pendingItems = plan.items.filter(item => item.status === 'pending').length;

        const totalQuantity = plan.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalAvailable = plan.items.reduce((sum, item) => sum + (item.availableQuantity || 0), 0);

        return `
            <div class="plan-summary-content">
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-label">总规格数</span>
                        <span class="stat-value">${totalItems}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-label">计划总量</span>
                        <span class="stat-value">${totalQuantity} 根</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-label">可发货量</span>
                        <span class="stat-value">${totalAvailable} 根</span>
                    </div>
                </div>
                <div class="summary-status">
                    ${sufficientItems > 0 ? `<span class="status-badge sufficient">${sufficientItems} 个充足</span>` : ''}
                    ${insufficientItems > 0 ? `<span class="status-badge insufficient">${insufficientItems} 个不足</span>` : ''}
                    ${pendingItems > 0 ? `<span class="status-badge pending">${pendingItems} 个待完善</span>` : ''}
                </div>
            </div>
        `;
    }

    getPlanOverallStatus(plan) {
        if (!plan.items || plan.items.length === 0) {
            return 'pending';
        }

        const hasInsufficient = plan.items.some(item => item.status === 'insufficient');
        const hasPending = plan.items.some(item => item.status === 'pending');

        if (hasInsufficient) return 'insufficient';
        if (hasPending) return 'pending';
        return 'sufficient';
    }

    addPlanItem(planId) {
        console.log('addPlanItem 被调用，planId:', planId);
        console.log('当前 shippingPlans:', this.shippingPlans);

        const plan = this.shippingPlans.find(p => p.id === planId);
        console.log('找到的计划:', plan);

        if (!plan) {
            console.log('未找到计划，返回');
            return;
        }

        const newItem = {
            id: Date.now().toString() + Math.random(),
            modelType: '',
            spec: '',
            quantity: 0,
            availableQuantity: 0,
            status: 'pending'
        };

        console.log('新建项目:', newItem);
        console.log('添加前 plan.items:', plan.items);

        plan.items.push(newItem);

        console.log('添加后 plan.items:', plan.items);
        console.log('准备重新渲染...');

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    removePlanItem(planId, itemIndex) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (!plan || !plan.items) return;

        plan.items.splice(itemIndex, 1);

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    updatePlanName(planId, name) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (plan) {
            plan.name = name;
            // 保存到localStorage
            this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);
        }
    }

    updatePlanItemModel(planId, itemIndex, modelType) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (!plan || !plan.items[itemIndex]) return;

        const item = plan.items[itemIndex];
        item.modelType = modelType;
        item.spec = ''; // 重置规格选择
        item.quantity = 0;
        item.availableQuantity = 0;
        item.status = 'pending';

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    updatePlanItemSpec(planId, itemIndex, spec) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (!plan || !plan.items[itemIndex]) return;

        const item = plan.items[itemIndex];
        item.spec = spec;
        item.availableQuantity = this.getAvailableQuantityForSpec(spec);
        this.updatePlanItemStatus(item);

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    updatePlanItemQuantity(planId, itemIndex, quantity) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (!plan || !plan.items[itemIndex]) return;

        const item = plan.items[itemIndex];
        item.quantity = parseInt(quantity) || 0;
        this.updatePlanItemStatus(item);

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
    }

    updatePlanItemStatus(item) {
        if (!item.spec || item.quantity === 0) {
            item.status = 'pending';
        } else if (item.availableQuantity >= item.quantity) {
            item.status = 'sufficient';
        } else {
            item.status = 'insufficient';
        }
    }

    getPlanItemStatusText(item) {
        switch (item.status) {
            case 'sufficient':
                return `<span style="color: #166534; font-weight: 500;">✓ 库存充足</span>`;
            case 'insufficient':
                return `<span style="color: #dc2626; font-weight: 500;">⚠ 缺少 ${item.quantity - item.availableQuantity} 根</span>`;
            default:
                return `<span style="color: #6b7280; font-weight: 500;">? 请完善信息</span>`;
        }
    }

    generateSpecOptions(modelType, selectedSpec) {
        if (!modelType) return '';

        const availableSpecs = this.getAvailableSpecsByModel(modelType);
        let options = '';

        availableSpecs.forEach(spec => {
            const selected = spec === selectedSpec ? 'selected' : '';
            options += `<option value="${spec}" ${selected}>${spec}</option>`;
        });

        return options;
    }

    getAvailableSpecsByModel(modelType) {
        // 获取该型号下所有有库存的规格
        return this.data
            .filter(item => {
                const itemModel = item.spec.match(/^(H\d+)/)?.[1];
                return itemModel === modelType && (item.produced - item.shipped) > 0;
            })
            .map(item => item.spec)
            .filter((spec, index, arr) => arr.indexOf(spec) === index)
            .sort();
    }



    getAvailableQuantityForSpec(spec) {
        // 计算该规格的总可发货数量
        return this.data
            .filter(item => item.spec === spec)
            .reduce((sum, item) => sum + (item.produced - item.shipped), 0);
    }



    removeShippingPlan(planId) {
        this.shippingPlans = this.shippingPlans.filter(p => p.id !== planId);

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        this.renderShippingPlans();
        this.showNotification('发货需求已删除', 'success');
    }

    savePlan(planId) {
        const plan = this.shippingPlans.find(p => p.id === planId);
        if (!plan) {
            this.showNotification('未找到发货需求', 'error');
            return;
        }

        // 检查计划是否有效（至少有一个规格项目）
        if (!plan.items || plan.items.length === 0) {
            this.showNotification('请至少添加一个规格项目', 'warning');
            return;
        }

        // 检查所有项目是否完整
        const incompleteItems = plan.items.filter(item =>
            !item.modelType || !item.spec || item.quantity <= 0
        );

        if (incompleteItems.length > 0) {
            this.showNotification('请完善所有规格项目的信息', 'warning');
            return;
        }

        // 更新计划状态
        plan.status = this.calculatePlanStatus(plan);
        plan.savedAt = new Date().toISOString();

        // 保存到localStorage
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        // 重新渲染以更新状态显示
        this.renderShippingPlans();

        this.showNotification(`发货需求 "${plan.name}" 已保存`, 'success');
    }

    calculatePlanStatus(plan) {
        if (!plan.items || plan.items.length === 0) {
            return 'pending';
        }

        const hasPending = plan.items.some(item => item.status === 'pending');
        const hasInsufficient = plan.items.some(item => item.status === 'insufficient');

        if (hasPending) return 'pending';
        if (hasInsufficient) return 'insufficient';
        return 'sufficient';
    }

    togglePlanDetails(planId) {
        const contentElement = document.getElementById(`plan-content-${planId}`);
        if (contentElement) {
            const isVisible = contentElement.style.display !== 'none';
            contentElement.style.display = isVisible ? 'none' : 'block';
        }
    }

    executeShippingPlans() {
        // 收集所有可执行的规格项目
        const validItems = [];
        const insufficientItems = [];

        this.shippingPlans.forEach(plan => {
            if (plan.items) {
                plan.items.forEach(item => {
                    if (item.status === 'sufficient') {
                        validItems.push(item);
                    } else if (item.status === 'insufficient') {
                        insufficientItems.push(item);
                    }
                });
            }
        });

        if (validItems.length === 0) {
            this.showNotification('没有可执行的发货项目，请检查库存状态', 'warning');
            return;
        }

        if (insufficientItems.length > 0) {
            const confirmMessage = `有 ${insufficientItems.length} 个规格库存不足，是否只执行库存充足的 ${validItems.length} 个规格？`;
            if (!confirm(confirmMessage)) {
                return;
            }
        }

        // 保存发货需求
        this.saveShippingPlansForCustomer(this.currentPlanCustomer, this.shippingPlans);

        // 转换为发货单格式并执行
        this.convertItemsToShipping(validItems);
    }

    convertItemsToShipping(items) {
        // 关闭计划模态框
        this.closeShippingPlanModal();

        // 打开发货模态框并预填数据
        this.openShippingModal();

        // 设置客户名称
        setTimeout(() => {
            document.getElementById('batchCustomerName').value = this.currentPlanCustomer;

            // 清空现有发货项目
            this.shippingCart = [];

            // 添加规格项目到发货购物车
            items.forEach(item => {
                this.shippingCart.push({
                    id: item.id,
                    spec: item.spec,
                    quantity: item.quantity,
                    meters: this.calculateMeters(item.spec, item.quantity)
                });
            });

            // 更新发货购物车显示
            this.updateShippingCart();

            this.showNotification(`已将 ${items.length} 个规格项目添加到发货单`, 'success');
        }, 100);
    }

    // 获取区域优先级排序（用于智能分配）
    getAreaPriorityOrder() {
        // 从localStorage获取保存的区域排序，如果没有则使用默认排序
        const savedOrder = localStorage.getItem('areaPriorityOrder');
        if (savedOrder) {
            return JSON.parse(savedOrder);
        }

        // 默认按区域名称排序
        const areas = [...new Set(this.data.map(item => item.area))].sort();
        return areas;
    }

    // 保存区域优先级排序
    saveAreaPriorityOrder(areaOrder) {
        localStorage.setItem('areaPriorityOrder', JSON.stringify(areaOrder));
        console.log('区域优先级排序已保存:', areaOrder);
    }

    // 智能分配生产数量到各区域
    smartAllocateProduction(spec, totalQuantity) {
        // 获取当前区域排序（紧急程度）
        const areaOrder = this.getAreaPriorityOrder();

        // 查找该规格的所有未完成计划，按区域优先级排序
        const unfinishedPlans = this.data
            .filter(item => item.spec === spec && item.produced < item.planned)
            .sort((a, b) => {
                const aIndex = areaOrder.indexOf(a.area);
                const bIndex = areaOrder.indexOf(b.area);
                return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
            });

        const allocations = [];
        let remainingQuantity = totalQuantity;

        // 按优先级分配到各区域
        for (const plan of unfinishedPlans) {
            if (remainingQuantity <= 0) break;

            const needed = plan.planned - plan.produced;
            const allocated = Math.min(needed, remainingQuantity);

            if (allocated > 0) {
                allocations.push({
                    spec: spec,
                    area: plan.area,
                    quantity: allocated,
                    planId: plan.id
                });
                remainingQuantity -= allocated;
            }
        }

        console.log(`智能分配结果:`, allocations);
        return allocations;
    }

    // 初始化区域拖拽排序功能
    initAreaDragSort() {
        const container = document.getElementById('areaCardsContainer');
        if (!container) return;

        // 清除之前的事件监听器
        container.removeEventListener('dragstart', this.dragStartHandler);
        container.removeEventListener('dragend', this.dragEndHandler);
        container.removeEventListener('dragover', this.dragOverHandler);
        container.removeEventListener('dragenter', this.dragEnterHandler);
        container.removeEventListener('dragleave', this.dragLeaveHandler);
        container.removeEventListener('drop', this.dropHandler);

        // 使用优化的拖拽实现
        this.initSimpleDragSort(container);

        console.log('区域拖拽排序已初始化，共', container.children.length, '个区域卡片');
    }

    // 处理区域重新排序
    handleAreaReorder(evt) {
        const container = evt.to;
        const cards = Array.from(container.children);
        const newOrder = cards.map(card => card.dataset.area).filter(area => area);

        // 保存新的排序
        this.saveAreaPriorityOrder(newOrder);

        // 显示提示
        this.showNotification(`区域优先级已更新：${newOrder.join(' → ')}`, 'success');

        console.log('新的区域优先级排序:', newOrder);
    }

    // 优化的拖拽排序实现
    initSimpleDragSort(container) {
        let draggedElement = null;
        let placeholder = null;

        // 创建占位符元素
        const createPlaceholder = () => {
            const placeholder = document.createElement('div');
            placeholder.className = 'area-card-placeholder';
            placeholder.innerHTML = `
                <div style="
                    height: 100%;
                    border: 2px dashed #3b82f6;
                    border-radius: 12px;
                    background: rgba(59, 130, 246, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #3b82f6;
                    font-weight: 500;
                ">
                    <i class="fas fa-arrow-down" style="margin-right: 8px;"></i>
                    放置到这里
                </div>
            `;
            return placeholder;
        };

        // 拖拽开始
        this.dragStartHandler = (e) => {
            if (e.target.classList.contains('area-card')) {
                draggedElement = e.target;
                placeholder = createPlaceholder();

                // 添加拖拽状态类
                e.target.classList.add('dragging');
                container.classList.add('drag-active');

                // 设置拖拽数据
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.outerHTML);

                // 添加拖拽提示
                this.showNotification('拖拽卡片到新位置来调整优先级', 'info', 2000);

                console.log('开始拖拽区域卡片:', e.target.dataset.area);
            }
        };
        container.addEventListener('dragstart', this.dragStartHandler);

        // 拖拽结束
        this.dragEndHandler = (e) => {
            if (e.target.classList.contains('area-card')) {
                // 移除拖拽状态类
                e.target.classList.remove('dragging');
                container.classList.remove('drag-active');

                // 移除占位符
                if (placeholder && placeholder.parentNode) {
                    placeholder.parentNode.removeChild(placeholder);
                }

                // 清理所有临时样式
                container.querySelectorAll('.area-card').forEach(card => {
                    card.classList.remove('drag-over');
                    card.style.transform = '';
                    card.style.transition = '';
                });

                draggedElement = null;
                placeholder = null;

                console.log('拖拽结束');
            }
        };
        container.addEventListener('dragend', this.dragEndHandler);

        // 拖拽经过
        this.dragOverHandler = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            const afterElement = this.getDragAfterElement(container, e.clientY);
            const draggingCard = document.querySelector('.area-card.dragging');

            if (draggingCard && placeholder) {
                if (afterElement == null) {
                    container.appendChild(placeholder);
                } else {
                    container.insertBefore(placeholder, afterElement);
                }
            }
        };
        container.addEventListener('dragover', this.dragOverHandler);

        // 拖拽进入
        this.dragEnterHandler = (e) => {
            e.preventDefault();
            if (e.target.classList.contains('area-card') && e.target !== draggedElement) {
                e.target.classList.add('drag-over');
            }
        };
        container.addEventListener('dragenter', this.dragEnterHandler);

        // 拖拽离开
        this.dragLeaveHandler = (e) => {
            if (e.target.classList.contains('area-card') && e.target !== draggedElement) {
                e.target.classList.remove('drag-over');
            }
        };
        container.addEventListener('dragleave', this.dragLeaveHandler);

        // 放置
        this.dropHandler = (e) => {
            e.preventDefault();

            if (draggedElement && placeholder && placeholder.parentNode) {
                // 在占位符位置插入拖拽的元素
                placeholder.parentNode.insertBefore(draggedElement, placeholder);
                placeholder.parentNode.removeChild(placeholder);

                // 获取新的排序
                const cards = Array.from(container.children);
                const newOrder = cards
                    .filter(card => card.classList.contains('area-card'))
                    .map(card => card.dataset.area)
                    .filter(area => area);

                // 保存新的排序
                this.saveAreaPriorityOrder(newOrder);

                // 更新优先级徽章
                this.updatePriorityBadges(container);

                // 显示成功提示
                this.showNotification(`区域优先级已更新：${newOrder.join(' → ')}`, 'success', 3000);

                console.log('新的区域优先级排序:', newOrder);

                // 重新渲染区域统计以更新优先级显示
                setTimeout(() => {
                    this.renderAreaStats();
                }, 100);
            }
        };
        container.addEventListener('drop', this.dropHandler);
    }

    // 获取拖拽后应该插入的位置
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.area-card:not(.dragging)')]
            .filter(card => !card.classList.contains('area-card-placeholder'));

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 更新优先级徽章
    updatePriorityBadges(container) {
        const cards = container.querySelectorAll('.area-card');
        cards.forEach((card, index) => {
            const priorityBadge = card.querySelector('.priority-badge');
            const dragHandle = card.querySelector('.area-drag-handle');

            if (priorityBadge) {
                priorityBadge.textContent = `#${index + 1}`;
            }

            if (dragHandle) {
                dragHandle.title = `拖拽排序 - 当前优先级: ${index + 1}`;
            }

            card.dataset.priority = index + 1;
        });
    }

    // 发货历史管理方法
    openShippingHistoryModal() {
        const modal = document.getElementById('shippingHistoryModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.add('active');
        overlay.classList.add('active');

        this.loadShippingHistory();
    }

    closeShippingHistoryModal() {
        const modal = document.getElementById('shippingHistoryModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');
    }

    loadShippingHistory() {
        // 如果没有历史记录，尝试重新迁移数据
        if (this.shippingHistory.length === 0) {
            console.log('发货历史为空，尝试重新迁移数据...');
            this.migrateShippingData();
        }

        this.renderShippingHistoryList(this.shippingHistory);
        this.updateShippingHistorySummary(this.shippingHistory);
    }

    renderShippingHistoryList(records) {
        const container = document.getElementById('shippingHistoryList');

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-shipping-history">
                    <i class="fas fa-truck"></i>
                    <p>暂无发货历史记录</p>
                </div>
            `;
            return;
        }

        let html = '';
        records.forEach(record => {
            const totalMeters = record.totalMeters || record.items.reduce((sum, item) => sum + (item.meters || 0), 0);

            html += `
                <div class="shipping-record-card" onclick="dataManager.openShippingDetailModal('${record.id}')">
                    <div class="shipping-record-header">
                        <h4 class="shipping-record-title">${record.customerName} - ${record.documentNumber || '无单号'}</h4>
                        <span class="shipping-record-date">${record.date}</span>
                    </div>
                    <div class="shipping-record-info">
                        <div class="shipping-record-field">
                            <span class="label">运输公司:</span>
                            <span class="value">${record.company || '-'}</span>
                        </div>
                        <div class="shipping-record-field">
                            <span class="label">运单号:</span>
                            <span class="value">${record.trackingNumber || '-'}</span>
                        </div>
                        <div class="shipping-record-field">
                            <span class="label">收货地址:</span>
                            <span class="value">${record.deliveryAddress || '-'}</span>
                        </div>
                    </div>
                    <div class="shipping-record-stats">
                        <div class="shipping-stat">
                            <span class="label">规格数</span>
                            <span class="value">${record.items.length}</span>
                        </div>
                        <div class="shipping-stat">
                            <span class="label">总根数</span>
                            <span class="value">${this.formatNumber(record.totalQuantity)}</span>
                        </div>
                        <div class="shipping-stat">
                            <span class="label">总重量</span>
                            <span class="value">${record.totalWeight.toFixed(1)} kg</span>
                        </div>
                        <div class="shipping-stat">
                            <span class="label">总米数</span>
                            <span class="value">${totalMeters.toFixed(1)} m</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    updateShippingHistorySummary(records) {
        const totalRecords = records.length;
        const totalQuantity = records.reduce((sum, record) => sum + record.totalQuantity, 0);
        const totalWeight = records.reduce((sum, record) => sum + record.totalWeight, 0);
        const totalMeters = records.reduce((sum, record) => {
            return sum + (record.totalMeters || record.items.reduce((itemSum, item) => itemSum + (item.meters || 0), 0));
        }, 0);

        document.getElementById('totalShippingRecords').textContent = totalRecords;
        document.getElementById('totalShippedQuantity').textContent = this.formatNumber(totalQuantity) + ' 根';
        document.getElementById('totalShippedWeight').textContent = totalWeight.toFixed(1) + ' kg';
        document.getElementById('totalShippedMeters').textContent = totalMeters.toFixed(1) + ' m';
    }

    filterShippingHistory() {
        const dateFrom = document.getElementById('historyDateFrom').value;
        const dateTo = document.getElementById('historyDateTo').value;
        const customer = document.getElementById('historyCustomer').value;

        let filteredRecords = [...this.shippingHistory];

        if (dateFrom) {
            filteredRecords = filteredRecords.filter(record => record.date >= dateFrom);
        }

        if (dateTo) {
            filteredRecords = filteredRecords.filter(record => record.date <= dateTo);
        }

        if (customer) {
            filteredRecords = filteredRecords.filter(record => record.customerName === customer);
        }

        this.renderShippingHistoryList(filteredRecords);
        this.updateShippingHistorySummary(filteredRecords);
    }

    exportShippingHistory() {
        if (this.shippingHistory.length === 0) {
            this.showNotification('暂无发货历史可导出', 'warning');
            return;
        }

        // 生成CSV格式的数据
        const headers = ['发货日期', '客户名称', '运输公司', '运单号', '收货地址', '规格数量', '总根数', '总重量(kg)', '总米数(m)', '备注'];
        let csvContent = headers.join(',') + '\n';

        this.shippingHistory.forEach(record => {
            const totalMeters = record.totalMeters || record.items.reduce((sum, item) => sum + (item.meters || 0), 0);
            const row = [
                record.date,
                record.customerName,
                record.company || '',
                record.trackingNumber || '',
                record.deliveryAddress || '',
                record.items.length,
                record.totalQuantity,
                record.totalWeight.toFixed(1),
                totalMeters.toFixed(1),
                record.remarks || ''
            ];
            csvContent += row.map(field => `"${field}"`).join(',') + '\n';
        });

        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `发货历史-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        this.showNotification('发货历史导出成功', 'success');
    }

    // 发货详情编辑方法
    openShippingDetailModal(recordId) {
        const record = this.shippingHistory.find(r => r.id == recordId);
        if (!record) {
            this.showNotification('找不到发货记录', 'error');
            return;
        }

        this.currentShippingRecord = record;
        this.isShippingEditMode = false;

        const modal = document.getElementById('shippingDetailModal');
        const overlay = document.getElementById('modalOverlay');

        // 填充基本信息
        document.getElementById('detailShippingDate').value = record.date;
        document.getElementById('detailCustomerName').value = record.customerName;
        document.getElementById('detailTransportCompany').value = record.company || '';
        document.getElementById('detailTrackingNumber').value = record.trackingNumber || '';
        document.getElementById('detailDeliveryAddress').value = record.deliveryAddress || '';
        document.getElementById('detailShippingRemarks').value = record.remarks || '';

        // 设置只读模式
        this.setShippingDetailReadOnly(true);

        // 渲染发货项目
        this.renderShippingDetailItems(record.items);

        // 更新汇总
        this.updateShippingDetailSummary(record);

        modal.classList.add('active');
        overlay.classList.add('active');
    }

    closeShippingDetailModal() {
        const modal = document.getElementById('shippingDetailModal');
        const overlay = document.getElementById('modalOverlay');

        modal.classList.remove('active');
        overlay.classList.remove('active');

        this.currentShippingRecord = null;
        this.isShippingEditMode = false;
    }

    toggleShippingEditMode() {
        this.isShippingEditMode = !this.isShippingEditMode;

        const editModeText = document.getElementById('editModeText');
        const saveBtn = document.getElementById('saveShippingDetailBtn');
        const deleteBtn = document.getElementById('deleteShippingRecordBtn');
        const addItemBtn = document.getElementById('addShippingItemBtn');
        const editColumns = document.querySelectorAll('.edit-mode-column');

        if (this.isShippingEditMode) {
            editModeText.textContent = '取消编辑';
            saveBtn.style.display = 'inline-flex';
            deleteBtn.style.display = 'inline-flex';
            addItemBtn.style.display = 'inline-flex';
            editColumns.forEach(col => col.style.display = 'table-cell');
            this.setShippingDetailReadOnly(false);
        } else {
            editModeText.textContent = '编辑';
            saveBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            addItemBtn.style.display = 'none';
            editColumns.forEach(col => col.style.display = 'none');
            this.setShippingDetailReadOnly(true);
        }

        // 重新渲染项目列表以显示/隐藏编辑控件
        this.renderShippingDetailItems(this.currentShippingRecord.items);
    }

    setShippingDetailReadOnly(readonly) {
        const inputs = [
            'detailShippingDate',
            'detailCustomerName',
            'detailTransportCompany',
            'detailTrackingNumber',
            'detailDeliveryAddress',
            'detailShippingRemarks'
        ];

        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.readOnly = readonly;
            }
        });

        // 添加/移除编辑模式样式
        const container = document.querySelector('#shippingDetailModal .modal-body');
        if (readonly) {
            container.classList.remove('edit-mode');
        } else {
            container.classList.add('edit-mode');
        }
    }

    renderShippingDetailItems(items) {
        const tbody = document.getElementById('shippingDetailItemsBody');
        let html = '';

        items.forEach((item, index) => {
            const meters = item.meters || this.calculateMeters(item.spec, item.quantity);
            const weight = item.weight || this.calculateWeight(item.spec, item.quantity);

            html += `
                <tr>
                    <td>${item.spec}</td>
                    <td class="number-cell">
                        ${this.isShippingEditMode ?
                            `<input type="number" class="item-quantity-input" value="${item.quantity}"
                                    min="1" onchange="dataManager.updateShippingItemQuantity(${index}, this.value)">` :
                            this.formatNumber(item.quantity)
                        }
                    </td>
                    <td class="number-cell">${weight.toFixed(1)}</td>
                    <td class="number-cell">${meters.toFixed(1)}</td>
                    <td class="edit-mode-column" style="display: ${this.isShippingEditMode ? 'table-cell' : 'none'};">
                        <button class="btn btn-sm btn-danger" onclick="dataManager.removeShippingItem(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    updateShippingItemQuantity(index, newQuantity) {
        const quantity = parseInt(newQuantity) || 0;
        if (quantity <= 0) {
            this.showNotification('数量必须大于0', 'error');
            this.renderShippingDetailItems(this.currentShippingRecord.items);
            return;
        }

        this.currentShippingRecord.items[index].quantity = quantity;
        this.currentShippingRecord.items[index].meters = this.calculateMeters(
            this.currentShippingRecord.items[index].spec,
            quantity
        );
        this.currentShippingRecord.items[index].weight = this.calculateWeight(
            this.currentShippingRecord.items[index].spec,
            quantity
        );

        this.renderShippingDetailItems(this.currentShippingRecord.items);
        this.updateShippingDetailSummary(this.currentShippingRecord);
    }

    removeShippingItem(index) {
        if (confirm('确定要删除这个发货项目吗？')) {
            this.currentShippingRecord.items.splice(index, 1);
            this.renderShippingDetailItems(this.currentShippingRecord.items);
            this.updateShippingDetailSummary(this.currentShippingRecord);
        }
    }

    updateShippingDetailSummary(record) {
        const totalSpecs = record.items.length;
        const totalQuantity = record.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalWeight = record.items.reduce((sum, item) => {
            return sum + (item.weight || this.calculateWeight(item.spec, item.quantity));
        }, 0);
        const totalMeters = record.items.reduce((sum, item) => {
            return sum + (item.meters || this.calculateMeters(item.spec, item.quantity));
        }, 0);

        document.getElementById('detailTotalSpecs').textContent = totalSpecs;
        document.getElementById('detailTotalQuantity').textContent = this.formatNumber(totalQuantity);
        document.getElementById('detailTotalWeight').textContent = totalWeight.toFixed(1) + ' kg';
        document.getElementById('detailTotalMeters').textContent = totalMeters.toFixed(1) + ' m';

        // 更新记录中的汇总数据
        record.totalQuantity = totalQuantity;
        record.totalWeight = totalWeight;
        record.totalMeters = totalMeters;
    }

    saveShippingDetail() {
        if (!this.currentShippingRecord) return;

        // 收集表单数据
        const date = document.getElementById('detailShippingDate').value;
        const customerName = document.getElementById('detailCustomerName').value;
        const company = document.getElementById('detailTransportCompany').value;
        const trackingNumber = document.getElementById('detailTrackingNumber').value;
        const deliveryAddress = document.getElementById('detailDeliveryAddress').value;
        const remarks = document.getElementById('detailShippingRemarks').value;

        if (!date || !customerName) {
            this.showNotification('请填写必填字段（发货日期、客户名称）', 'error');
            return;
        }

        if (this.currentShippingRecord.items.length === 0) {
            this.showNotification('发货项目不能为空', 'error');
            return;
        }

        // 保存原始记录用于比较
        const originalRecord = JSON.parse(JSON.stringify(this.currentShippingRecord));

        // 更新记录
        this.currentShippingRecord.date = date;
        this.currentShippingRecord.customerName = customerName;
        this.currentShippingRecord.company = company;
        this.currentShippingRecord.trackingNumber = trackingNumber;
        this.currentShippingRecord.deliveryAddress = deliveryAddress;
        this.currentShippingRecord.remarks = remarks;

        // 同步更新原始数据中的发货记录
        this.syncShippingRecordToOriginalData(originalRecord, this.currentShippingRecord);

        // 保存到本地存储
        this.saveToLocalStorage();

        // 记录日志
        this.addLog('edit', '编辑发货记录',
            `修改了发货记录：${customerName} - ${this.currentShippingRecord.documentNumber}`,
            {
                recordId: this.currentShippingRecord.id,
                customerName: customerName,
                itemCount: this.currentShippingRecord.items.length,
                totalQuantity: this.currentShippingRecord.totalQuantity
            });

        // 刷新历史列表
        this.loadShippingHistory();

        // 退出编辑模式
        this.toggleShippingEditMode();

        this.showNotification('发货记录保存成功', 'success');
    }

    deleteShippingRecord() {
        if (!this.currentShippingRecord) return;

        const confirmMessage = `确定要删除这条发货记录吗？\n\n客户：${this.currentShippingRecord.customerName}\n发货日期：${this.currentShippingRecord.date}\n规格数量：${this.currentShippingRecord.items.length}\n\n注意：删除后库存将相应增加，已发货数量将减少`;

        if (confirm(confirmMessage)) {
            const recordIndex = this.shippingHistory.findIndex(r => r.id === this.currentShippingRecord.id);
            if (recordIndex >= 0) {
                const deletedRecord = this.shippingHistory.splice(recordIndex, 1)[0];

                // 从原始数据中删除对应的发货记录并调整库存
                this.removeShippingFromOriginalData(deletedRecord);

                // 保存到本地存储
                this.saveToLocalStorage();

                // 记录日志
                this.addLog('delete', '删除发货记录',
                    `删除了发货记录：${deletedRecord.customerName} - ${deletedRecord.documentNumber}，已调整库存`,
                    {
                        recordId: deletedRecord.id,
                        customerName: deletedRecord.customerName,
                        itemCount: deletedRecord.items.length,
                        totalQuantity: deletedRecord.totalQuantity,
                        adjustedItems: deletedRecord.items.map(item => ({
                            spec: item.spec,
                            quantity: item.quantity
                        }))
                    });

                // 关闭详情模态框
                this.closeShippingDetailModal();

                // 刷新相关显示
                this.renderTable();
                this.updateStats();
                this.loadShippingHistory();

                this.showNotification('发货记录删除成功，库存已调整', 'success');
            }
        }
    }

    addShippingItem() {
        // 这里可以添加新增发货项目的逻辑
        // 为了简化，暂时显示提示
        this.showNotification('新增发货项目功能开发中...', 'info');
    }

    // 从原始数据中删除发货记录并调整库存
    removeShippingFromOriginalData(deletedRecord) {
        console.log('开始从原始数据中删除发货记录并调整库存...');

        deletedRecord.items.forEach(deletedItem => {
            console.log(`处理删除项目: ${deletedItem.spec}, 数量: ${deletedItem.quantity}`);

            // 查找所有匹配规格的数据项
            const matchingItems = this.data.filter(item => item.spec === deletedItem.spec);

            let remainingQuantityToRemove = deletedItem.quantity;

            matchingItems.forEach(item => {
                if (remainingQuantityToRemove <= 0) return;

                if (item.shippingRecords && item.shippingRecords.length > 0) {
                    // 查找匹配的发货记录（基于日期、客户等信息）
                    const matchingShippingRecords = item.shippingRecords.filter(record => {
                        const customerName = record.customerName || record.customer || '未知客户';
                        return record.date === deletedRecord.date &&
                               customerName === deletedRecord.customerName &&
                               (record.company || '') === (deletedRecord.company || '') &&
                               (record.trackingNumber || '') === (deletedRecord.trackingNumber || '');
                    });

                    matchingShippingRecords.forEach(shippingRecord => {
                        if (remainingQuantityToRemove <= 0) return;

                        const quantityToRemove = Math.min(shippingRecord.quantity, remainingQuantityToRemove);

                        console.log(`从项目 ${item.spec} (${item.area}) 删除发货记录，数量: ${quantityToRemove}`);

                        // 调整库存
                        item.shipped = Math.max(0, item.shipped - quantityToRemove);

                        // 删除或调整发货记录
                        if (shippingRecord.quantity <= quantityToRemove) {
                            // 完全删除这条发货记录
                            const recordIndex = item.shippingRecords.indexOf(shippingRecord);
                            item.shippingRecords.splice(recordIndex, 1);
                            console.log(`完全删除发货记录`);
                        } else {
                            // 减少发货记录的数量
                            shippingRecord.quantity -= quantityToRemove;
                            console.log(`调整发货记录数量为: ${shippingRecord.quantity}`);
                        }

                        remainingQuantityToRemove -= quantityToRemove;

                        console.log(`项目 ${item.spec} 调整后: 已发货=${item.shipped}, 剩余需删除=${remainingQuantityToRemove}`);
                    });
                }
            });

            if (remainingQuantityToRemove > 0) {
                console.warn(`警告: 规格 ${deletedItem.spec} 还有 ${remainingQuantityToRemove} 数量未能从原始数据中删除`);
            }
        });

        console.log('发货记录删除和库存调整完成');
    }

    // 同步发货记录修改到原始数据
    syncShippingRecordToOriginalData(originalRecord, updatedRecord) {
        console.log('开始同步发货记录修改到原始数据...');

        // 处理项目数量变化
        const originalItems = new Map();
        const updatedItems = new Map();

        originalRecord.items.forEach(item => {
            originalItems.set(item.spec, item.quantity);
        });

        updatedRecord.items.forEach(item => {
            updatedItems.set(item.spec, item.quantity);
        });

        // 查找数量变化的项目
        const allSpecs = new Set([...originalItems.keys(), ...updatedItems.keys()]);

        allSpecs.forEach(spec => {
            const originalQty = originalItems.get(spec) || 0;
            const updatedQty = updatedItems.get(spec) || 0;
            const quantityDiff = updatedQty - originalQty;

            if (quantityDiff !== 0) {
                console.log(`规格 ${spec} 数量变化: ${originalQty} → ${updatedQty} (差值: ${quantityDiff})`);
                this.adjustShippingQuantityInOriginalData(spec, originalRecord, quantityDiff);
            }
        });

        // 更新基本信息（日期、客户等）
        this.updateShippingRecordBasicInfo(originalRecord, updatedRecord);

        console.log('发货记录同步完成');
    }

    // 调整原始数据中的发货数量
    adjustShippingQuantityInOriginalData(spec, originalRecord, quantityDiff) {
        const matchingItems = this.data.filter(item => item.spec === spec);

        matchingItems.forEach(item => {
            if (item.shippingRecords && item.shippingRecords.length > 0) {
                const matchingShippingRecords = item.shippingRecords.filter(record => {
                    const customerName = record.customerName || record.customer || '未知客户';
                    return record.date === originalRecord.date &&
                           customerName === originalRecord.customerName &&
                           (record.company || '') === (originalRecord.company || '') &&
                           (record.trackingNumber || '') === (originalRecord.trackingNumber || '');
                });

                if (matchingShippingRecords.length > 0) {
                    const shippingRecord = matchingShippingRecords[0];
                    const newQuantity = Math.max(0, shippingRecord.quantity + quantityDiff);
                    const actualDiff = newQuantity - shippingRecord.quantity;

                    shippingRecord.quantity = newQuantity;
                    item.shipped = Math.max(0, item.shipped + actualDiff);

                    console.log(`调整项目 ${item.spec} (${item.area}): 发货记录数量=${newQuantity}, 总已发货=${item.shipped}`);

                    // 如果数量变为0，删除发货记录
                    if (newQuantity === 0) {
                        const recordIndex = item.shippingRecords.indexOf(shippingRecord);
                        item.shippingRecords.splice(recordIndex, 1);
                        console.log(`删除数量为0的发货记录`);
                    }
                }
            }
        });
    }

    // 更新发货记录的基本信息
    updateShippingRecordBasicInfo(originalRecord, updatedRecord) {
        this.data.forEach(item => {
            if (item.shippingRecords && item.shippingRecords.length > 0) {
                item.shippingRecords.forEach(record => {
                    const customerName = record.customerName || record.customer || '未知客户';
                    if (record.date === originalRecord.date &&
                        customerName === originalRecord.customerName &&
                        (record.company || '') === (originalRecord.company || '') &&
                        (record.trackingNumber || '') === (originalRecord.trackingNumber || '')) {

                        // 更新基本信息
                        record.date = updatedRecord.date;
                        if (record.customerName !== undefined) {
                            record.customerName = updatedRecord.customerName;
                        } else if (record.customer !== undefined) {
                            record.customer = updatedRecord.customerName;
                        }
                        record.company = updatedRecord.company;
                        record.trackingNumber = updatedRecord.trackingNumber;
                        record.deliveryAddress = updatedRecord.deliveryAddress;
                        record.remarks = updatedRecord.remarks;
                    }
                });
            }
        });
    }
}

// 页面加载完成后初始化数据管理器
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== 初始化DataManager ===');
    try {
        window.dataManager = new DataManager();
        console.log('✅ DataManager实例创建成功');
        console.log('数据条数:', window.dataManager.data.length);

        // 如果数据为空，尝试重新加载
        if (window.dataManager.data.length === 0) {
            console.log('数据为空，尝试重新加载...');
            window.dataManager.loadFromLocalStorage();
            console.log('重新加载后数据条数:', window.dataManager.data.length);
        }

        // 确保界面更新
        setTimeout(() => {
            if (window.dataManager.data.length > 0) {
                window.dataManager.renderTable();
                window.dataManager.updateStats();
                window.dataManager.renderAreaStats();
                window.dataManager.renderUnproducedStats();
                console.log('✅ 界面更新完成');
            }
        }, 100);

    } catch (error) {
        console.error('❌ DataManager初始化失败:', error);

        // 备用初始化方案
        setTimeout(() => {
            try {
                console.log('尝试备用初始化方案...');
                window.dataManager = new DataManager();
                window.dataManager.loadFromLocalStorage();
                console.log('✅ 备用方案成功，数据条数:', window.dataManager.data.length);
            } catch (retryError) {
                console.error('❌ 备用方案也失败:', retryError);
            }
        }, 1000);
    }
});

// 额外的安全检查 - 如果DOMContentLoaded已经触发
if (document.readyState === 'loading') {
    // 文档还在加载中，DOMContentLoaded事件会触发
} else {
    // 文档已经加载完成，立即初始化
    console.log('=== 文档已加载，立即初始化DataManager ===');
    if (!window.dataManager) {
        try {
            window.dataManager = new DataManager();
            console.log('✅ 立即初始化成功，数据条数:', window.dataManager.data.length);

            if (window.dataManager.data.length === 0) {
                window.dataManager.loadFromLocalStorage();
                console.log('重新加载后数据条数:', window.dataManager.data.length);
            }
        } catch (error) {
            console.error('❌ 立即初始化失败:', error);
        }
    }
}

// 版本标识
console.log('📊 数据管理器脚本已加载 - 版本: 2024-12-21-v4 (激进修复：本地数据优先)');

// 紧急数据恢复功能
window.emergencyDataRecovery = function() {
    console.log('🚨 启动紧急数据恢复...');

    if (!window.dataManager) {
        console.log('❌ DataManager未加载');
        return;
    }

    // 尝试从localStorage恢复数据
    try {
        const savedData = localStorage.getItem('productionData');
        const savedMaterials = localStorage.getItem('materialPurchases');
        const savedShipping = localStorage.getItem('shippingHistory');

        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.length > 0) {
                window.dataManager.data = data;
                window.dataManager.filteredData = [...data];
                console.log(`✅ 恢复生产数据: ${data.length} 条`);
            }
        }

        if (savedMaterials) {
            const materials = JSON.parse(savedMaterials);
            if (materials.length > 0) {
                window.dataManager.materialPurchases = materials;
                console.log(`✅ 恢复原材料数据: ${materials.length} 条`);
            }
        }

        if (savedShipping) {
            const shipping = JSON.parse(savedShipping);
            if (shipping.length > 0) {
                window.dataManager.shippingHistory = shipping;
                console.log(`✅ 恢复发货历史: ${shipping.length} 条`);
            }
        }

        // 更新界面
        window.dataManager.renderTable();
        window.dataManager.updateStats();
        window.dataManager.renderAreaStats();
        window.dataManager.renderUnproducedStats();

        console.log('🎉 紧急数据恢复完成');

    } catch (error) {
        console.error('❌ 紧急数据恢复失败:', error);
    }
};
