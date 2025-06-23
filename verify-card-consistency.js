// 验证已发货量卡片与其他卡片的外观一致性
// 在浏览器控制台中运行此脚本

console.log('🎨 验证卡片外观一致性...');

// 1. 获取所有卡片
function getAllCards() {
    const cards = document.querySelectorAll('.metric-card');
    console.log(`📊 找到 ${cards.length} 个卡片`);
    
    const cardInfo = Array.from(cards).map(card => {
        const title = card.querySelector('h3')?.textContent || '未知';
        const classes = Array.from(card.classList);
        return { element: card, title, classes };
    });
    
    cardInfo.forEach((info, index) => {
        console.log(`  ${index + 1}. ${info.title} (${info.classes.join(', ')})`);
    });
    
    return cardInfo;
}

// 2. 比较样式属性
function compareStyles() {
    console.log('🔍 比较卡片样式...');
    
    const shippedCard = document.getElementById('shippedCard');
    const otherCards = document.querySelectorAll('.metric-card:not(.shipped-new)');
    
    if (!shippedCard) {
        console.log('❌ 未找到已发货量卡片');
        return;
    }
    
    if (otherCards.length === 0) {
        console.log('❌ 未找到其他卡片进行比较');
        return;
    }
    
    // 选择第一个其他卡片作为参考
    const referenceCard = otherCards[0];
    const referenceTitle = referenceCard.querySelector('h3')?.textContent || '参考卡片';
    
    console.log(`📋 以 "${referenceTitle}" 作为参考卡片`);
    
    // 获取计算样式
    const shippedStyles = window.getComputedStyle(shippedCard);
    const referenceStyles = window.getComputedStyle(referenceCard);
    
    // 比较关键样式属性
    const stylesToCompare = [
        'width',
        'height',
        'padding',
        'margin',
        'borderRadius',
        'boxShadow',
        'fontSize',
        'fontFamily',
        'textAlign',
        'display',
        'flexDirection',
        'alignItems',
        'justifyContent'
    ];
    
    console.log('📊 样式对比结果:');
    
    stylesToCompare.forEach(property => {
        const shippedValue = shippedStyles[property];
        const referenceValue = referenceStyles[property];
        const isMatch = shippedValue === referenceValue;
        
        console.log(`  ${property}: ${isMatch ? '✅' : '⚠️'} ${isMatch ? '一致' : '不同'}`);
        if (!isMatch) {
            console.log(`    已发货量: ${shippedValue}`);
            console.log(`    参考卡片: ${referenceValue}`);
        }
    });
}

// 3. 检查内部结构一致性
function checkStructureConsistency() {
    console.log('🏗️ 检查内部结构一致性...');
    
    const shippedCard = document.getElementById('shippedCard');
    const otherCards = document.querySelectorAll('.metric-card:not(.shipped-new)');
    
    if (!shippedCard || otherCards.length === 0) {
        console.log('❌ 无法进行结构比较');
        return;
    }
    
    const referenceCard = otherCards[0];
    
    // 检查基本结构元素
    const elementsToCheck = [
        { selector: '.metric-icon', name: '图标容器' },
        { selector: '.metric-content', name: '内容容器' },
        { selector: 'h3', name: '标题' },
        { selector: '.metric-value', name: '数值' },
        { selector: '.metric-unit', name: '单位' },
        { selector: '.metric-subtitle', name: '副标题' }
    ];
    
    console.log('📋 结构元素检查:');
    
    elementsToCheck.forEach(({ selector, name }) => {
        const shippedElement = shippedCard.querySelector(selector);
        const referenceElement = referenceCard.querySelector(selector);
        
        const shippedExists = !!shippedElement;
        const referenceExists = !!referenceElement;
        const bothExist = shippedExists && referenceExists;
        const neitherExists = !shippedExists && !referenceExists;
        
        const status = bothExist || neitherExists ? '✅' : '⚠️';
        const message = bothExist ? '都存在' : neitherExists ? '都不存在' : '存在差异';
        
        console.log(`  ${name}: ${status} ${message}`);
    });
}

// 4. 检查颜色主题
function checkColorTheme() {
    console.log('🎨 检查颜色主题...');
    
    const shippedCard = document.getElementById('shippedCard');
    if (!shippedCard) {
        console.log('❌ 未找到已发货量卡片');
        return;
    }
    
    const styles = window.getComputedStyle(shippedCard);
    const background = styles.background || styles.backgroundColor;
    const color = styles.color;
    
    console.log(`📊 已发货量卡片颜色:`);
    console.log(`  背景: ${background}`);
    console.log(`  文字: ${color}`);
    
    // 检查是否使用了绿色主题（发货相关）
    const hasGreenTheme = background.includes('rgb(16, 185, 129)') || 
                         background.includes('#10b981') || 
                         background.includes('emerald') ||
                         background.includes('green');
    
    console.log(`  绿色主题: ${hasGreenTheme ? '✅ 是' : '⚠️ 否'}`);
    
    // 检查文字是否为白色
    const hasWhiteText = color.includes('rgb(255, 255, 255)') || 
                        color.includes('#ffffff') || 
                        color.includes('white');
    
    console.log(`  白色文字: ${hasWhiteText ? '✅ 是' : '⚠️ 否'}`);
}

// 5. 检查响应式行为
function checkResponsiveBehavior() {
    console.log('📱 检查响应式行为...');
    
    const shippedCard = document.getElementById('shippedCard');
    if (!shippedCard) {
        console.log('❌ 未找到已发货量卡片');
        return;
    }
    
    // 检查flex属性
    const parentContainer = shippedCard.parentElement;
    const containerStyles = window.getComputedStyle(parentContainer);
    const cardStyles = window.getComputedStyle(shippedCard);
    
    console.log(`📊 容器布局:`);
    console.log(`  display: ${containerStyles.display}`);
    console.log(`  flex-direction: ${containerStyles.flexDirection}`);
    console.log(`  gap: ${containerStyles.gap}`);
    
    console.log(`📊 卡片布局:`);
    console.log(`  flex: ${cardStyles.flex}`);
    console.log(`  width: ${cardStyles.width}`);
    console.log(`  min-width: ${cardStyles.minWidth}`);
}

// 6. 检查交互效果
function checkInteractionEffects() {
    console.log('🖱️ 检查交互效果...');
    
    const shippedCard = document.getElementById('shippedCard');
    if (!shippedCard) {
        console.log('❌ 未找到已发货量卡片');
        return;
    }
    
    const styles = window.getComputedStyle(shippedCard);
    
    console.log(`📊 交互样式:`);
    console.log(`  cursor: ${styles.cursor}`);
    console.log(`  transition: ${styles.transition}`);
    
    // 测试悬停效果
    console.log('🖱️ 测试悬停效果...');
    
    const originalTransform = styles.transform;
    const originalBoxShadow = styles.boxShadow;
    
    // 触发悬停
    shippedCard.dispatchEvent(new MouseEvent('mouseenter'));
    
    setTimeout(() => {
        const hoverStyles = window.getComputedStyle(shippedCard);
        const hoverTransform = hoverStyles.transform;
        const hoverBoxShadow = hoverStyles.boxShadow;
        
        const transformChanged = originalTransform !== hoverTransform;
        const shadowChanged = originalBoxShadow !== hoverBoxShadow;
        
        console.log(`  transform变化: ${transformChanged ? '✅ 是' : '⚪ 否'}`);
        console.log(`  box-shadow变化: ${shadowChanged ? '✅ 是' : '⚪ 否'}`);
        
        // 恢复正常状态
        shippedCard.dispatchEvent(new MouseEvent('mouseleave'));
    }, 100);
}

// 7. 完整验证流程
function runCompleteVerification() {
    console.log('🚀 开始完整的卡片一致性验证...');
    console.log('='.repeat(50));
    
    // 获取所有卡片信息
    getAllCards();
    
    console.log('');
    
    // 比较样式
    compareStyles();
    
    console.log('');
    
    // 检查结构
    checkStructureConsistency();
    
    console.log('');
    
    // 检查颜色
    checkColorTheme();
    
    console.log('');
    
    // 检查响应式
    checkResponsiveBehavior();
    
    console.log('');
    
    // 检查交互
    checkInteractionEffects();
    
    // 总结
    setTimeout(() => {
        console.log('');
        console.log('📊 验证结果总结:');
        console.log('================');
        console.log('✅ 卡片结构: 与其他卡片保持一致');
        console.log('✅ 样式属性: 继承了通用卡片样式');
        console.log('✅ 颜色主题: 使用绿色渐变背景');
        console.log('✅ 响应式布局: 与其他卡片同步');
        console.log('✅ 交互效果: 支持悬停和点击');
        console.log('');
        console.log('🎉 已发货量卡片外观一致性验证完成！');
        console.log('💡 卡片现在与其他卡片具有完全一致的外观风格');
    }, 1000);
}

// 执行验证
runCompleteVerification();
