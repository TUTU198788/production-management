// 在浏览器控制台中运行此脚本来测试和修复原材料模态框按钮

console.log('🔧 原材料模态框按钮测试和修复脚本');
console.log('='.repeat(50));

// 1. 检查按钮是否存在
function checkButton() {
    const button = document.getElementById('toggleMaterialMode');
    console.log('1️⃣ 按钮检查:', {
        exists: !!button,
        visible: button ? button.offsetParent !== null : false,
        disabled: button ? button.disabled : 'N/A',
        innerHTML: button ? button.innerHTML : 'N/A'
    });
    return button;
}

// 2. 检查数据管理器
function checkDataManager() {
    console.log('2️⃣ 数据管理器检查:', {
        exists: typeof dataManager !== 'undefined',
        hasToggleMethod: typeof dataManager !== 'undefined' && typeof dataManager.toggleMaterialMode === 'function'
    });
    return typeof dataManager !== 'undefined' ? dataManager : null;
}

// 3. 手动绑定事件
function fixButtonBinding() {
    console.log('3️⃣ 修复按钮绑定...');
    
    const button = document.getElementById('toggleMaterialMode');
    const manager = checkDataManager();
    
    if (!button) {
        console.error('❌ 按钮不存在');
        return false;
    }
    
    if (!manager) {
        console.error('❌ 数据管理器不存在');
        return false;
    }
    
    // 移除所有现有事件监听器
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // 绑定新的事件监听器
    newButton.addEventListener('click', function(e) {
        console.log('🖱️ 按钮被点击（手动修复绑定）');
        e.preventDefault();
        e.stopPropagation();
        
        try {
            manager.toggleMaterialMode();
            console.log('✅ toggleMaterialMode方法调用成功');
        } catch (error) {
            console.error('❌ toggleMaterialMode方法调用失败:', error);
        }
    });
    
    console.log('✅ 按钮事件重新绑定完成');
    return true;
}

// 4. 测试按钮点击
function testButtonClick() {
    console.log('4️⃣ 测试按钮点击...');
    
    const button = document.getElementById('toggleMaterialMode');
    if (button) {
        try {
            button.click();
            console.log('✅ 按钮点击测试完成');
        } catch (error) {
            console.error('❌ 按钮点击测试失败:', error);
        }
    } else {
        console.error('❌ 按钮不存在，无法测试');
    }
}

// 5. 直接调用方法测试
function testDirectCall() {
    console.log('5️⃣ 直接调用方法测试...');
    
    if (typeof dataManager !== 'undefined' && dataManager.toggleMaterialMode) {
        try {
            dataManager.toggleMaterialMode();
            console.log('✅ 直接方法调用成功');
        } catch (error) {
            console.error('❌ 直接方法调用失败:', error);
        }
    } else {
        console.error('❌ 方法不存在，无法测试');
    }
}

// 6. 检查模态框状态
function checkModalState() {
    console.log('6️⃣ 模态框状态检查:');
    
    const modal = document.getElementById('materialModal');
    const addMode = document.getElementById('addMaterialMode');
    const historyMode = document.getElementById('materialHistoryMode');
    
    console.log({
        modal: {
            exists: !!modal,
            active: modal ? modal.classList.contains('active') : false
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

// 7. 完整的修复流程
function fullFix() {
    console.log('🔧 开始完整修复流程...');
    console.log('='.repeat(30));
    
    checkButton();
    checkDataManager();
    checkModalState();
    
    const success = fixButtonBinding();
    if (success) {
        console.log('✅ 修复完成，现在可以测试按钮');
        testButtonClick();
    } else {
        console.log('❌ 修复失败');
    }
    
    console.log('='.repeat(30));
}

// 8. 打开模态框并修复
function openModalAndFix() {
    console.log('📂 打开模态框并修复按钮...');
    
    if (typeof dataManager !== 'undefined' && dataManager.openMaterialModal) {
        dataManager.openMaterialModal();
        
        // 等待模态框完全打开后修复按钮
        setTimeout(() => {
            fixButtonBinding();
            console.log('✅ 模态框已打开，按钮已修复');
        }, 200);
    } else {
        console.error('❌ 无法打开模态框，dataManager不存在');
    }
}

// 导出函数到全局
window.materialButtonFix = {
    checkButton,
    checkDataManager,
    fixButtonBinding,
    testButtonClick,
    testDirectCall,
    checkModalState,
    fullFix,
    openModalAndFix
};

// 自动运行检查
console.log('🚀 自动运行检查...');
checkButton();
checkDataManager();
checkModalState();

console.log('');
console.log('💡 使用方法:');
console.log('materialButtonFix.fullFix() - 完整修复');
console.log('materialButtonFix.openModalAndFix() - 打开模态框并修复');
console.log('materialButtonFix.testButtonClick() - 测试按钮点击');
console.log('materialButtonFix.testDirectCall() - 直接调用方法');
console.log('');
console.log('🎯 建议: 先运行 materialButtonFix.openModalAndFix()');
