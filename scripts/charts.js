// 图表配置和管理 - Chart.js集成

// 全局图表配置
Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#6b7280';

// 主题色彩配置
const chartColors = {
    primary: '#1e3a8a',
    secondary: '#3b82f6',
    accent: '#f97316',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    gray: '#6b7280',
    lightGray: '#e5e7eb'
};

// 渐变色生成函数
function createGradient(ctx, color1, color2, direction = 'vertical') {
    const gradient = direction === 'vertical' 
        ? ctx.createLinearGradient(0, 0, 0, 400)
        : ctx.createLinearGradient(0, 0, 400, 0);
    
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// 通用图表配置
const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'bottom',
            labels: {
                padding: 20,
                usePointStyle: true,
                font: {
                    size: 11
                }
            }
        },
        tooltip: {
            backgroundColor: 'rgba(31, 41, 55, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#374151',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
                label: function(context) {
                    const label = context.dataset.label || '';
                    const value = typeof context.parsed === 'object' 
                        ? context.parsed.y 
                        : context.parsed;
                    return `${label}: ${new Intl.NumberFormat('zh-CN').format(value)}`;
                }
            }
        }
    },
    scales: {
        x: {
            grid: {
                color: chartColors.lightGray,
                borderColor: chartColors.gray
            },
            ticks: {
                color: chartColors.gray
            }
        },
        y: {
            grid: {
                color: chartColors.lightGray,
                borderColor: chartColors.gray
            },
            ticks: {
                color: chartColors.gray,
                callback: function(value) {
                    return new Intl.NumberFormat('zh-CN').format(value);
                }
            }
        }
    }
};

// 初始化所有图表
function initCharts() {
    const charts = {};
    
    // 生产状态分布图表
    const productionCtx = document.getElementById('productionChart');
    if (productionCtx) {
        charts.productionChart = new Chart(productionCtx, {
            type: 'doughnut',
            data: {
                labels: ['未生产', '已生产'],
                datasets: [{
                    data: [50, 50],
                    backgroundColor: [
                        chartColors.lightGray,
                        chartColors.success
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(31, 41, 55, 0.9)',
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 发货状态分布图表
    const shippingCtx = document.getElementById('shippingChart');
    if (shippingCtx) {
        charts.shippingChart = new Chart(shippingCtx, {
            type: 'doughnut',
            data: {
                labels: ['库存', '已发货'],
                datasets: [{
                    data: [50, 50],
                    backgroundColor: [
                        chartColors.warning,
                        chartColors.primary
                    ],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(31, 41, 55, 0.9)',
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 规格型号需求分布图表
    const specCtx = document.getElementById('specChart');
    if (specCtx) {
        charts.specChart = new Chart(specCtx, {
            type: 'bar',
            data: {
                labels: ['等待数据加载...'],
                datasets: [{
                    label: '需求量 (m)',
                    data: [0],
                    backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) return chartColors.primary;
                        return createGradient(ctx, chartColors.primary, chartColors.secondary);
                    },
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                ...commonChartOptions,
                plugins: {
                    ...commonChartOptions.plugins,
                    legend: {
                        display: false
                    }
                },
                scales: {
                    ...commonChartOptions.scales,
                    y: {
                        ...commonChartOptions.scales.y,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '需求量 (根)',
                            color: chartColors.gray
                        }
                    },
                    x: {
                        ...commonChartOptions.scales.x,
                        title: {
                            display: true,
                            text: '规格型号',
                            color: chartColors.gray
                        }
                    }
                }
            }
        });
    }
    
    // 工地区域需求分布图表
    const areaCtx = document.getElementById('areaChart');
    if (areaCtx) {
        charts.areaChart = new Chart(areaCtx, {
            type: 'line',
            data: {
                labels: ['暂无数据'],
                datasets: [
                    {
                        label: '计划需求',
                        data: [0],
                        borderColor: chartColors.primary,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return 'rgba(30, 58, 138, 0.1)';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(30, 58, 138, 0.2)');
                            gradient.addColorStop(1, 'rgba(30, 58, 138, 0.02)');
                            return gradient;
                        },
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: chartColors.primary,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2
                    },
                    {
                        label: '实际完成',
                        data: [0],
                        borderColor: chartColors.success,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) return 'rgba(16, 185, 129, 0.1)';
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
                            return gradient;
                        },
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointHoverRadius: 8,
                        pointBackgroundColor: chartColors.success,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2
                    }
                ]
            },
            options: {
                ...commonChartOptions,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    ...commonChartOptions.scales,
                    y: {
                        ...commonChartOptions.scales.y,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '数量 (根)',
                            color: chartColors.gray
                        }
                    },
                    x: {
                        ...commonChartOptions.scales.x,
                        title: {
                            display: true,
                            text: '工地区域',
                            color: chartColors.gray
                        }
                    }
                }
            }
        });
    }
    
    return charts;
}

// 更新生产进度图表
// 更新生产状态图表
function updateProductionChart(chart, data) {
    if (!chart || !data || data.length === 0) {
        // 没有数据时显示空状态
        chart.data.datasets[0].data = [100, 0];
        chart.data.labels = ['未生产', '已生产'];
        chart.update('active');
        return;
    }

    // 计算生产状态（按数量统计）
    let totalPlanned = 0;
    let totalProduced = 0;

    data.forEach(item => {
        totalPlanned += item.planned || 0;
        totalProduced += item.produced || 0;
    });

    const unproduced = totalPlanned - totalProduced;
    const unproducedPercentage = totalPlanned > 0 ? ((unproduced / totalPlanned) * 100) : 100;
    const producedPercentage = totalPlanned > 0 ? ((totalProduced / totalPlanned) * 100) : 0;

    chart.data.datasets[0].data = [
        parseFloat(unproducedPercentage.toFixed(1)),
        parseFloat(producedPercentage.toFixed(1))
    ];
    chart.data.labels = ['未生产', '已生产'];
    chart.update('active');
}

// 更新发货状态图表
function updateShippingChart(chart, data) {
    if (!chart || !data || data.length === 0) {
        // 没有数据时显示空状态
        chart.data.datasets[0].data = [100, 0];
        chart.data.labels = ['库存', '已发货'];
        chart.update('active');
        return;
    }

    // 计算发货状态（按数量统计）
    let totalProduced = 0;
    let totalShipped = 0;

    data.forEach(item => {
        totalProduced += item.produced || 0;
        totalShipped += item.shipped || 0;
    });

    const inventory = totalProduced - totalShipped;
    const inventoryPercentage = totalProduced > 0 ? ((inventory / totalProduced) * 100) : 100;
    const shippedPercentage = totalProduced > 0 ? ((totalShipped / totalProduced) * 100) : 0;

    chart.data.datasets[0].data = [
        parseFloat(inventoryPercentage.toFixed(1)),
        parseFloat(shippedPercentage.toFixed(1))
    ];
    chart.data.labels = ['库存', '已发货'];
    chart.update('active');
}

// 更新规格型号图表
function updateSpecChart(chart, data) {
    if (!chart) return;

    if (!data || data.length === 0) {
        // 没有数据时显示空状态
        chart.data.labels = ['暂无数据'];
        chart.data.datasets[0].data = [0];
        chart.options.scales.y.title.text = '需求量 (m)';
        chart.update('none'); // 使用 'none' 模式强制立即更新
        return;
    }

    // 统计各规格的需求量（转换为米）
    const specStats = {};

    data.forEach(item => {
        const spec = item.spec;
        const length = extractLengthFromSpec(spec);
        const meters = item.planned * length / 1000;

        if (specStats[spec]) {
            specStats[spec] += meters;
        } else {
            specStats[spec] = meters;
        }
    });

    // 按需求量排序，取前8个规格
    const sortedSpecs = Object.entries(specStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const labels = sortedSpecs.map(([spec, _]) => spec);
    const values = sortedSpecs.map(([_, meters]) => parseFloat(meters.toFixed(1)));

    // 强制清除旧数据并设置新数据
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].label = '需求量 (m)';
    chart.options.scales.y.title.text = '需求量 (m)';

    // 强制重新渲染
    chart.update('none');
    chart.render();
}

// 从规格中提取长度的辅助函数
function extractLengthFromSpec(spec) {
    if (!spec) return 0;
    const match = spec.match(/(\d+)mm/);
    return match ? parseInt(match[1]) : 0;
}

// 更新工地区域图表
function updateAreaChart(chart, data) {
    if (!chart) return;

    if (!data || data.length === 0) {
        // 没有数据时显示空状态
        chart.data.labels = ['暂无数据'];
        chart.data.datasets[0].data = [0];
        chart.data.datasets[1].data = [0];
        chart.update('active');
        return;
    }

    // 统计各区域的计划和实际生产量（转换为米）
    const areaStats = {};

    data.forEach(item => {
        const area = item.area;
        const length = extractLengthFromSpec(item.spec);
        const plannedMeters = item.planned * length / 1000;
        const producedMeters = item.produced * length / 1000;

        if (areaStats[area]) {
            areaStats[area].planned += plannedMeters;
            areaStats[area].produced += producedMeters;
        } else {
            areaStats[area] = {
                planned: plannedMeters,
                produced: producedMeters
            };
        }
    });

    // 按计划量排序
    const sortedAreas = Object.entries(areaStats)
        .sort((a, b) => b[1].planned - a[1].planned);

    const labels = sortedAreas.map(([area, _]) => `${area}区域`);
    const plannedData = sortedAreas.map(([_, stats]) => stats.planned.toFixed(1));
    const producedData = sortedAreas.map(([_, stats]) => stats.produced.toFixed(1));

    chart.data.labels = labels;
    chart.data.datasets[0].data = plannedData;
    chart.data.datasets[1].data = producedData;
    chart.options.scales.y.title.text = '数量 (m)';
    chart.update('active');
}

// 图表主题切换
function switchChartTheme(isDark = false) {
    const textColor = isDark ? '#e5e7eb' : '#6b7280';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    
    Chart.defaults.color = textColor;
    
    // 更新所有现有图表
    Chart.instances.forEach(chart => {
        if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(scaleKey => {
                const scale = chart.options.scales[scaleKey];
                if (scale.grid) scale.grid.color = gridColor;
                if (scale.ticks) scale.ticks.color = textColor;
            });
        }
        chart.update();
    });
}

// 导出图表为图片
function exportChart(chart, filename = 'chart') {
    if (!chart) return;
    
    const canvas = chart.canvas;
    const url = canvas.toDataURL('image/png');
    
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = url;
    link.click();
}

// 全局暴露函数
window.initCharts = initCharts;
window.updateProductionChart = updateProductionChart;
window.updateShippingChart = updateShippingChart;
window.updateSpecChart = updateSpecChart;
window.updateAreaChart = updateAreaChart;
window.switchChartTheme = switchChartTheme;
window.exportChart = exportChart;
