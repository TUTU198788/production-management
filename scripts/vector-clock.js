/**
 * 向量时钟系统
 * 用于精确追踪分布式系统中的操作顺序和因果关系
 */

class VectorClock {
    constructor(clientId) {
        this.clientId = clientId;
        this.clock = { [clientId]: 0 };
        
        console.log('🕐 向量时钟已初始化，客户端ID:', clientId);
    }
    
    /**
     * 递增本地时钟
     * @returns {Object} 当前时钟状态的副本
     */
    tick() {
        this.clock[this.clientId]++;
        console.log('⏰ 时钟递增:', this.clientId, '→', this.clock[this.clientId]);
        return this.getCopy();
    }
    
    /**
     * 更新时钟（接收到远程操作时）
     * @param {Object} remoteClock 远程时钟状态
     */
    update(remoteClock) {
        if (!remoteClock || typeof remoteClock !== 'object') {
            console.warn('⚠️ 无效的远程时钟:', remoteClock);
            return;
        }
        
        let updated = false;
        
        // 更新所有已知客户端的时钟
        for (const [clientId, remoteTime] of Object.entries(remoteClock)) {
            const currentTime = this.clock[clientId] || 0;
            
            if (clientId === this.clientId) {
                // 本地客户端：取最大值并递增
                if (remoteTime >= currentTime) {
                    this.clock[clientId] = remoteTime + 1;
                    updated = true;
                }
            } else {
                // 远程客户端：取最大值
                if (remoteTime > currentTime) {
                    this.clock[clientId] = remoteTime;
                    updated = true;
                }
            }
        }
        
        if (updated) {
            console.log('🔄 时钟已更新:', this.clock);
        }
        
        return this.getCopy();
    }
    
    /**
     * 比较两个时钟的关系
     * @param {Object} clockA 时钟A
     * @param {Object} clockB 时钟B
     * @returns {string} 'before' | 'after' | 'concurrent' | 'equal'
     */
    static compare(clockA, clockB) {
        if (!clockA || !clockB) {
            return 'concurrent';
        }
        
        // 获取所有客户端ID
        const allClients = new Set([
            ...Object.keys(clockA),
            ...Object.keys(clockB)
        ]);
        
        let aBeforeB = true;
        let bBeforeA = true;
        let equal = true;
        
        for (const clientId of allClients) {
            const timeA = clockA[clientId] || 0;
            const timeB = clockB[clientId] || 0;
            
            if (timeA > timeB) {
                bBeforeA = false;
                equal = false;
            } else if (timeA < timeB) {
                aBeforeB = false;
                equal = false;
            }
        }
        
        if (equal) return 'equal';
        if (aBeforeB && !bBeforeA) return 'before';
        if (bBeforeA && !aBeforeB) return 'after';
        return 'concurrent';
    }
    
    /**
     * 检查操作A是否发生在操作B之前
     * @param {Object} operationA 操作A
     * @param {Object} operationB 操作B
     * @returns {boolean}
     */
    static happensBefore(operationA, operationB) {
        const comparison = VectorClock.compare(
            operationA.vectorClock,
            operationB.vectorClock
        );
        return comparison === 'before';
    }
    
    /**
     * 检查两个操作是否并发
     * @param {Object} operationA 操作A
     * @param {Object} operationB 操作B
     * @returns {boolean}
     */
    static areConcurrent(operationA, operationB) {
        const comparison = VectorClock.compare(
            operationA.vectorClock,
            operationB.vectorClock
        );
        return comparison === 'concurrent';
    }
    
    /**
     * 获取时钟状态的副本
     * @returns {Object}
     */
    getCopy() {
        return { ...this.clock };
    }
    
    /**
     * 重置时钟
     */
    reset() {
        this.clock = { [this.clientId]: 0 };
        console.log('🔄 时钟已重置:', this.clientId);
    }
    
    /**
     * 获取当前时钟的字符串表示
     * @returns {string}
     */
    toString() {
        const entries = Object.entries(this.clock)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([client, time]) => `${client}:${time}`);
        return `[${entries.join(', ')}]`;
    }
    
    /**
     * 从字符串恢复时钟状态
     * @param {string} clockString 时钟字符串
     * @returns {Object}
     */
    static fromString(clockString) {
        try {
            const clock = {};
            const matches = clockString.match(/\[([^\]]+)\]/);
            
            if (matches && matches[1]) {
                const entries = matches[1].split(', ');
                for (const entry of entries) {
                    const [client, time] = entry.split(':');
                    clock[client] = parseInt(time, 10);
                }
            }
            
            return clock;
        } catch (error) {
            console.error('解析时钟字符串失败:', error);
            return {};
        }
    }
    
    /**
     * 合并多个时钟状态
     * @param {Array<Object>} clocks 时钟数组
     * @returns {Object}
     */
    static merge(clocks) {
        const merged = {};
        
        for (const clock of clocks) {
            if (!clock) continue;
            
            for (const [clientId, time] of Object.entries(clock)) {
                merged[clientId] = Math.max(merged[clientId] || 0, time);
            }
        }
        
        return merged;
    }
    
    /**
     * 检查时钟是否有效
     * @param {Object} clock 时钟对象
     * @returns {boolean}
     */
    static isValid(clock) {
        if (!clock || typeof clock !== 'object') {
            return false;
        }
        
        for (const [clientId, time] of Object.entries(clock)) {
            if (typeof clientId !== 'string' || !Number.isInteger(time) || time < 0) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 计算时钟差异
     * @param {Object} clockA 时钟A
     * @param {Object} clockB 时钟B
     * @returns {Object} 差异对象
     */
    static diff(clockA, clockB) {
        const allClients = new Set([
            ...Object.keys(clockA || {}),
            ...Object.keys(clockB || {})
        ]);
        
        const diff = {};
        
        for (const clientId of allClients) {
            const timeA = clockA?.[clientId] || 0;
            const timeB = clockB?.[clientId] || 0;
            const delta = timeA - timeB;
            
            if (delta !== 0) {
                diff[clientId] = delta;
            }
        }
        
        return diff;
    }
    
    /**
     * 获取时钟的总和（用于排序）
     * @param {Object} clock 时钟对象
     * @returns {number}
     */
    static getSum(clock) {
        if (!clock) return 0;
        return Object.values(clock).reduce((sum, time) => sum + time, 0);
    }
    
    /**
     * 创建时钟快照
     * @returns {Object}
     */
    snapshot() {
        return {
            clientId: this.clientId,
            clock: this.getCopy(),
            timestamp: Date.now(),
            toString: () => this.toString()
        };
    }
    
    /**
     * 从快照恢复时钟
     * @param {Object} snapshot 快照对象
     */
    restoreFromSnapshot(snapshot) {
        if (snapshot && snapshot.clock) {
            this.clock = { ...snapshot.clock };
            console.log('📸 从快照恢复时钟:', this.toString());
        }
    }
    
    /**
     * 获取客户端列表
     * @returns {Array<string>}
     */
    getClients() {
        return Object.keys(this.clock);
    }
    
    /**
     * 获取指定客户端的时间
     * @param {string} clientId 客户端ID
     * @returns {number}
     */
    getTime(clientId) {
        return this.clock[clientId] || 0;
    }
    
    /**
     * 设置指定客户端的时间
     * @param {string} clientId 客户端ID
     * @param {number} time 时间值
     */
    setTime(clientId, time) {
        if (typeof time === 'number' && time >= 0) {
            this.clock[clientId] = time;
            console.log('⏰ 设置时钟:', clientId, '→', time);
        }
    }
    
    /**
     * 移除客户端
     * @param {string} clientId 客户端ID
     */
    removeClient(clientId) {
        if (clientId !== this.clientId && this.clock[clientId] !== undefined) {
            delete this.clock[clientId];
            console.log('🗑️ 移除客户端时钟:', clientId);
        }
    }
}

// 导出类
window.VectorClock = VectorClock;
