// 性能优化和监控脚本

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTime: 0,
            renderTime: 0,
            chartInitTime: 0,
            memoryUsage: 0,
            fps: 0
        };
        
        this.init();
    }
    
    init() {
        this.measureLoadTime();
        this.measureRenderTime();
        this.startFPSMonitoring();
        this.setupMemoryMonitoring();
        this.setupErrorTracking();
    }
    
    measureLoadTime() {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            this.metrics.loadTime = navigation.loadEventEnd - navigation.loadEventStart;
            
            console.log(`页面加载时间: ${this.metrics.loadTime.toFixed(2)}ms`);
            
            // 如果加载时间过长，显示警告
            if (this.metrics.loadTime > 3000) {
                console.warn('页面加载时间较长，建议优化资源加载');
            }
        });
    }
    
    measureRenderTime() {
        const startTime = performance.now();
        
        // 监听DOM内容加载完成
        document.addEventListener('DOMContentLoaded', () => {
            this.metrics.renderTime = performance.now() - startTime;
            console.log(`DOM渲染时间: ${this.metrics.renderTime.toFixed(2)}ms`);
        });
    }
    
    startFPSMonitoring() {
        let lastTime = performance.now();
        let frameCount = 0;
        
        const measureFPS = (currentTime) => {
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                this.metrics.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                frameCount = 0;
                lastTime = currentTime;
                
                // 如果FPS过低，发出警告
                if (this.metrics.fps < 30) {
                    console.warn(`FPS较低: ${this.metrics.fps}, 建议优化动画性能`);
                }
            }
            
            requestAnimationFrame(measureFPS);
        };
        
        requestAnimationFrame(measureFPS);
    }
    
    setupMemoryMonitoring() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.metrics.memoryUsage = {
                    used: Math.round(memory.usedJSHeapSize / 1048576), // MB
                    total: Math.round(memory.totalJSHeapSize / 1048576), // MB
                    limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
                };
                
                // 内存使用率超过80%时警告
                const usagePercent = (this.metrics.memoryUsage.used / this.metrics.memoryUsage.limit) * 100;
                if (usagePercent > 80) {
                    console.warn(`内存使用率过高: ${usagePercent.toFixed(1)}%`);
                }
            }, 5000);
        }
    }
    
    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            console.error('JavaScript错误:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
            
            // 可以发送错误信息到监控服务
            this.reportError(event);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.reportError(event);
        });
    }
    
    reportError(error) {
        // 这里可以集成错误监控服务，如Sentry
        // 目前只是记录到控制台
        const errorInfo = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            error: error
        };
        
        // 存储到localStorage用于调试
        const errors = JSON.parse(localStorage.getItem('errorLog') || '[]');
        errors.push(errorInfo);
        
        // 只保留最近50个错误
        if (errors.length > 50) {
            errors.splice(0, errors.length - 50);
        }
        
        localStorage.setItem('errorLog', JSON.stringify(errors));
    }
    
    measureChartPerformance(chartName, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`${chartName}图表初始化时间: ${duration.toFixed(2)}ms`);
        
        if (duration > 1000) {
            console.warn(`${chartName}图表初始化时间过长，建议优化`);
        }
        
        return duration;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: new Date().toISOString()
        };
    }
    
    generateReport() {
        const report = {
            ...this.getMetrics(),
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio
            }
        };
        
        console.table(report);
        return report;
    }
}

// 图片懒加载优化
class LazyLoader {
    constructor() {
        this.imageObserver = null;
        this.init();
    }
    
    init() {
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        this.imageObserver.unobserve(img);
                    }
                });
            });
            
            this.observeImages();
        } else {
            // 降级处理：直接加载所有图片
            this.loadAllImages();
        }
    }
    
    observeImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            this.imageObserver.observe(img);
        });
    }
    
    loadAllImages() {
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
        });
    }
}

// 资源预加载优化
class ResourcePreloader {
    constructor() {
        this.preloadQueue = [];
        this.init();
    }
    
    init() {
        this.preloadCriticalResources();
        this.setupPrefetch();
    }
    
    preloadCriticalResources() {
        const criticalResources = [
            'https://cdn.jsdelivr.net/npm/chart.js',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
        ];
        
        criticalResources.forEach(url => {
            this.preloadResource(url);
        });
    }
    
    preloadResource(url, type = 'script') {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = type;
        
        if (type === 'script') {
            link.crossOrigin = 'anonymous';
        }
        
        document.head.appendChild(link);
    }
    
    setupPrefetch() {
        // 预取可能需要的资源
        const prefetchResources = [
            // 可以添加其他可能需要的资源
        ];
        
        prefetchResources.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = url;
            document.head.appendChild(link);
        });
    }
}

// 缓存管理
class CacheManager {
    constructor() {
        this.cacheName = 'steel-dashboard-v1';
        this.init();
    }
    
    init() {
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
        
        this.setupLocalStorageCache();
    }
    
    registerServiceWorker() {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker注册成功:', registration);
            })
            .catch(error => {
                console.log('Service Worker注册失败:', error);
            });
    }
    
    setupLocalStorageCache() {
        // 缓存配置数据
        const cacheConfig = {
            maxAge: 24 * 60 * 60 * 1000, // 24小时
            maxSize: 5 * 1024 * 1024 // 5MB
        };
        
        this.cacheConfig = cacheConfig;
    }
    
    setCache(key, data, ttl = this.cacheConfig.maxAge) {
        const item = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
            console.warn('缓存存储失败:', e);
            this.clearOldCache();
        }
    }
    
    getCache(key) {
        try {
            const item = JSON.parse(localStorage.getItem(key));
            
            if (!item) return null;
            
            if (Date.now() - item.timestamp > item.ttl) {
                localStorage.removeItem(key);
                return null;
            }
            
            return item.data;
        } catch (e) {
            console.warn('缓存读取失败:', e);
            return null;
        }
    }
    
    clearOldCache() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item && item.timestamp && Date.now() - item.timestamp > item.ttl) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                // 忽略解析错误
            }
        });
    }
}

// 初始化性能监控
if (typeof window !== 'undefined') {
    window.performanceMonitor = new PerformanceMonitor();
    window.lazyLoader = new LazyLoader();
    window.resourcePreloader = new ResourcePreloader();
    window.cacheManager = new CacheManager();
    
    // 暴露性能报告函数
    window.getPerformanceReport = () => {
        return window.performanceMonitor.generateReport();
    };
}
