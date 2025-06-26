/**
 * 移动端优化脚本
 * 提供移动端特有的交互体验和功能
 */

class MobileOptimization {
    constructor() {
        this.isMobile = this.detectMobile();
        this.isKeyboardOpen = false;
        this.lastScrollY = 0;
        
        if (this.isMobile) {
            this.init();
        }
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    init() {
        this.setupViewportHandler();
        this.setupTouchFeedback();
        this.setupKeyboardHandler();
        this.setupScrollOptimization();
        this.setupModalOptimization();
        this.setupFormOptimization();
        this.setupNotificationOptimization();
        
        console.log('📱 移动端优化已启用');
    }
    
    setupViewportHandler() {
        // 防止页面缩放
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 处理设备旋转
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
                this.adjustModalHeight();
            }, 100);
        });
    }
    
    setupTouchFeedback() {
        // 为按钮添加触摸反馈
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.btn, .action-btn, .metric-card');
            if (target && !target.classList.contains('touch-feedback')) {
                target.classList.add('touch-feedback');
            }
        });
    }
    
    setupKeyboardHandler() {
        // 检测虚拟键盘
        const initialViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        
        const handleViewportChange = () => {
            if (window.visualViewport) {
                const currentHeight = window.visualViewport.height;
                const heightDifference = initialViewportHeight - currentHeight;
                
                if (heightDifference > 150) { // 键盘打开
                    if (!this.isKeyboardOpen) {
                        this.isKeyboardOpen = true;
                        document.body.classList.add('keyboard-open');
                        this.adjustForKeyboard();
                    }
                } else { // 键盘关闭
                    if (this.isKeyboardOpen) {
                        this.isKeyboardOpen = false;
                        document.body.classList.remove('keyboard-open');
                        this.restoreFromKeyboard();
                    }
                }
            }
        };
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportChange);
        } else {
            // 降级方案
            window.addEventListener('resize', handleViewportChange);
        }
        
        // 输入框焦点处理
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea, select')) {
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        });
    }
    
    setupScrollOptimization() {
        // 平滑滚动优化
        let ticking = false;
        
        const updateScrollPosition = () => {
            this.lastScrollY = window.scrollY;
            ticking = false;
        };
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollPosition);
                ticking = true;
            }
        }, { passive: true });
        
        // 滚动到顶部功能
        this.addScrollToTop();
    }
    
    setupModalOptimization() {
        // 模态框移动端优化
        const modals = document.querySelectorAll('.modal');
        
        modals.forEach(modal => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                // 添加下拉关闭手势
                this.addPullToClose(modal, modalContent);
                
                // 优化模态框滚动
                const modalBody = modal.querySelector('.modal-body');
                if (modalBody) {
                    modalBody.style.webkitOverflowScrolling = 'touch';
                }
            }
        });
    }
    
    setupFormOptimization() {
        // 表单输入优化
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[type="number"]')) {
                // 数字输入优化
                this.optimizeNumberInput(e.target);
            }
        });
        
        // 选择框优化
        document.querySelectorAll('select').forEach(select => {
            select.addEventListener('touchstart', () => {
                select.style.fontSize = '16px'; // 防止iOS缩放
            });
        });
    }
    
    setupNotificationOptimization() {
        // 通知消息移动端优化
        const originalShowNotification = window.showNotification;
        if (originalShowNotification) {
            window.showNotification = (message, type = 'info', duration = 3000) => {
                this.showMobileNotification(message, type, duration);
            };
        }
    }
    
    adjustForKeyboard() {
        // 键盘打开时的调整
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const modalContent = activeModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.maxHeight = '50vh';
                modalContent.style.transform = 'translateY(-20px)';
            }
        }
    }
    
    restoreFromKeyboard() {
        // 键盘关闭时的恢复
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const modalContent = activeModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.maxHeight = '';
                modalContent.style.transform = '';
            }
        }
    }
    
    adjustModalHeight() {
        // 调整模态框高度
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const modalContent = activeModal.querySelector('.modal-content');
            if (modalContent) {
                const maxHeight = window.innerHeight * 0.9;
                modalContent.style.maxHeight = `${maxHeight}px`;
            }
        }
    }
    
    addPullToClose(modal, modalContent) {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        modalContent.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
        }, { passive: true });
        
        modalContent.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0 && modalContent.scrollTop === 0) {
                const translateY = Math.min(deltaY * 0.5, 100);
                modalContent.style.transform = `translateY(${translateY}px)`;
                modalContent.style.opacity = Math.max(1 - deltaY / 300, 0.5);
            }
        }, { passive: true });
        
        modalContent.addEventListener('touchend', () => {
            if (!isDragging) return;
            
            const deltaY = currentY - startY;
            
            if (deltaY > 100) {
                // 关闭模态框
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.click();
                }
            } else {
                // 恢复位置
                modalContent.style.transform = '';
                modalContent.style.opacity = '';
            }
            
            isDragging = false;
        }, { passive: true });
    }
    
    addScrollToTop() {
        // 添加返回顶部按钮
        const scrollTopBtn = document.createElement('button');
        scrollTopBtn.className = 'scroll-top-btn';
        scrollTopBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        scrollTopBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #3b82f6;
            color: white;
            border: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            opacity: 0;
            transform: scale(0);
            transition: all 0.3s ease;
            cursor: pointer;
        `;
        
        document.body.appendChild(scrollTopBtn);
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollTopBtn.style.opacity = '1';
                scrollTopBtn.style.transform = 'scale(1)';
            } else {
                scrollTopBtn.style.opacity = '0';
                scrollTopBtn.style.transform = 'scale(0)';
            }
        });
        
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    optimizeNumberInput(input) {
        // 数字输入优化
        const value = input.value;
        if (value && !isNaN(value)) {
            input.style.borderColor = '#10b981';
        } else {
            input.style.borderColor = '#ef4444';
        }
    }
    
    showMobileNotification(message, type, duration) {
        // 移动端通知
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, duration);
    }
    
    // 公共方法
    static getInstance() {
        if (!window.mobileOptimization) {
            window.mobileOptimization = new MobileOptimization();
        }
        return window.mobileOptimization;
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    MobileOptimization.getInstance();
});

// 导出到全局
window.MobileOptimization = MobileOptimization;
