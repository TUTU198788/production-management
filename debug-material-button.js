// 调试原材料模态框按钮的脚本
// 在浏览器控制台中运行此脚本来检查问题

console.log('🔍 开始调试原材料模态框按钮...');

// 检查按钮元素是否存在
function checkButtonElement() {
    const button = document.getElementById('toggleMaterialMode');
    console.log('📋 按钮元素检查:', {
        exists: !!button,
        element: button,
        innerHTML: button ? button.innerHTML : 'N/A',
        disabled: button ? button.disabled : 'N/A',
        style: button ? button.style.cssText : 'N/A',
        classList: button ? Array.from(button.classList) : 'N/A'
    });
    
    if (button) {
        // 检查事件监听器
        const listeners = getEventListeners ? getEventListeners(button) : 'getEventListeners not available';
        console.log('🎧 事件监听器:', listeners);
        
        // 检查父元素
        console.log('👨‍👩‍👧‍👦 父元素:', button.parentElement);
        
        // 检查是否被其他元素遮挡
        const rect = button.getBoundingClientRect();
        const elementAtPoint = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
        console.log('🎯 位置检查:', {
            rect: rect,
            elementAtPoint: elementAtPoint,
            isButtonAtPoint: elementAtPoint === button || button.contains(elementAtPoint)
        });
    }
    
    return button;
}

// 检查模态框状态
function checkModalState() {
    const modal = document.getElementById('materialModal');
    const addMode = document.getElementById('addMaterialMode');
    const historyMode = document.getElementById('materialHistoryMode');
    
    console.log('🏠 模态框状态:', {
        modal: {
            exists: !!modal,
            classList: modal ? Array.from(modal.classList) : 'N/A',
            style: modal ? modal.style.cssText : 'N/A'
        },
        addMode: {
            exists: !!addMode,
            display: addMode ? addMode.style.display : 'N/A'
        },
        historyMode: {
            exists: !!historyMode,
            display: historyMode ? historyMode.style.display : 'N/A'
        }
    });
}

// 检查数据管理器
function checkDataManager() {
    console.log('🗃️ 数据管理器检查:', {
        dataManagerExists: typeof dataManager !== 'undefined',
        dataManager: typeof dataManager !== 'undefined' ? dataManager : 'N/A',
        toggleMaterialModeMethod: typeof dataManager !== 'undefined' && typeof dataManager.toggleMaterialMode === 'function'
    });
    
    if (typeof dataManager !== 'undefined' && dataManager.toggleMaterialMode) {
        console.log('✅ toggleMaterialMode方法存在');
    } else {
        console.log('❌ toggleMaterialMode方法不存在或数据管理器未初始化');
    }
}

// 手动测试按钮点击
function testButtonClick() {
    const button = document.getElementById('toggleMaterialMode');
    if (button) {
        console.log('🖱️ 手动触发按钮点击...');
        
        // 尝试直接调用方法
        if (typeof dataManager !== 'undefined' && dataManager.toggleMaterialMode) {
            try {
                console.log('📞 直接调用toggleMaterialMode方法...');
                dataManager.toggleMaterialMode();
                console.log('✅ 方法调用成功');
            } catch (error) {
                console.error('❌ 方法调用失败:', error);
            }
        }
        
        // 尝试触发点击事件
        try {
            console.log('🖱️ 触发点击事件...');
            button.click();
            console.log('✅ 点击事件触发成功');
        } catch (error) {
            console.error('❌ 点击事件触发失败:', error);
        }
        
        // 尝试手动创建和分发事件
        try {
            console.log('🎭 手动创建点击事件...');
            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            button.dispatchEvent(event);
            console.log('✅ 手动事件分发成功');
        } catch (error) {
            console.error('❌ 手动事件分发失败:', error);
        }
    } else {
        console.log('❌ 按钮元素不存在，无法测试点击');
    }
}

// 添加临时事件监听器进行测试
function addTestListener() {
    const button = document.getElementById('toggleMaterialMode');
    if (button) {
        console.log('🎧 添加临时测试事件监听器...');
        
        const testListener = function(e) {
            console.log('🎯 测试监听器被触发!', e);
            console.log('🎯 事件目标:', e.target);
            console.log('🎯 当前目标:', e.currentTarget);
        };
        
        button.addEventListener('click', testListener);
        console.log('✅ 临时监听器已添加');
        
        // 5秒后移除
        setTimeout(() => {
            button.removeEventListener('click', testListener);
            console.log('🗑️ 临时监听器已移除');
        }, 5000);
    }
}

// 检查CSS样式是否影响点击
function checkCSSIssues() {
    const button = document.getElementById('toggleMaterialMode');
    if (button) {
        const computedStyle = window.getComputedStyle(button);
        console.log('🎨 CSS样式检查:', {
            pointerEvents: computedStyle.pointerEvents,
            display: computedStyle.display,
            visibility: computedStyle.visibility,
            opacity: computedStyle.opacity,
            zIndex: computedStyle.zIndex,
            position: computedStyle.position
        });
        
        // 检查是否有遮挡元素
        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);
        
        console.log('🔍 遮挡检查:', {
            buttonRect: rect,
            centerPoint: { x: centerX, y: centerY },
            topElement: topElement,
            isButtonOnTop: topElement === button,
            isButtonParent: button.contains(topElement)
        });
    }
}

// 运行所有检查
function runAllChecks() {
    console.log('🚀 开始全面检查...');
    console.log('='.repeat(50));
    
    checkButtonElement();
    console.log('-'.repeat(30));
    
    checkModalState();
    console.log('-'.repeat(30));
    
    checkDataManager();
    console.log('-'.repeat(30));
    
    checkCSSIssues();
    console.log('-'.repeat(30));
    
    addTestListener();
    console.log('-'.repeat(30));
    
    console.log('🧪 现在可以手动点击按钮测试，或运行 testButtonClick() 进行自动测试');
    console.log('='.repeat(50));
}

// 修复函数 - 重新绑定事件
function fixButtonBinding() {
    console.log('🔧 尝试修复按钮绑定...');
    
    const button = document.getElementById('toggleMaterialMode');
    if (!button) {
        console.error('❌ 按钮元素不存在，无法修复');
        return;
    }
    
    if (typeof dataManager === 'undefined') {
        console.error('❌ dataManager不存在，无法修复');
        return;
    }
    
    // 移除现有监听器（如果有的话）
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // 重新绑定事件
    newButton.addEventListener('click', function(e) {
        console.log('🖱️ 修复后的按钮被点击');
        e.preventDefault();
        e.stopPropagation();
        
        if (dataManager && typeof dataManager.toggleMaterialMode === 'function') {
            dataManager.toggleMaterialMode();
        } else {
            console.error('❌ toggleMaterialMode方法不可用');
        }
    });
    
    console.log('✅ 按钮事件重新绑定完成');
}

// 导出函数到全局作用域
window.debugMaterialButton = {
    checkButtonElement,
    checkModalState,
    checkDataManager,
    testButtonClick,
    addTestListener,
    checkCSSIssues,
    runAllChecks,
    fixButtonBinding
};

// 自动运行检查
runAllChecks();

console.log('💡 使用方法:');
console.log('- debugMaterialButton.runAllChecks() - 运行所有检查');
console.log('- debugMaterialButton.testButtonClick() - 测试按钮点击');
console.log('- debugMaterialButton.fixButtonBinding() - 尝试修复按钮绑定');
