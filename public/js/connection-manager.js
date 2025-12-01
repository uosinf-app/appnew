// public/js/connection-manager.js - المدير الذكي للاتصالات
class DBConnectionManager {
    constructor() {
        this.envSetup = window.envSetup;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 2;
        this.connectionStatus = 'disconnected'; // disconnected, connecting, connected, error
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('🚀 تهيئة مدير الاتصالات...');
        
        // الانتظار حتى يتم تحديد البيئة
        if (!this.envSetup || !this.envSetup.getCurrentEnvironment()) {
            console.log('⏳ في انتظار تحديد البيئة...');
            return new Promise((resolve) => {
                const checkEnv = setInterval(() => {
                    if (this.envSetup && this.envSetup.getCurrentEnvironment()) {
                        clearInterval(checkEnv);
                        this.completeInitialization().then(resolve);
                    }
                }, 100);
            });
        }
        
        await this.completeInitialization();
    }

    async completeInitialization() {
        const currentEnv = this.envSetup.getCurrentEnvironment();
        console.log(`🎯 تهيئة الاتصال على: ${currentEnv.label} (${currentEnv.type})`);
        
        this.connectionStatus = 'connected';
        this.isInitialized = true;
        console.log('✅ تم تهيئة الاتصال بنجاح');
        
        // تحديث شريط حالة البيئة
        this.updateEnvironmentBar();
    }

    // 🔥 الدالة الرئيسية الذكية للاتصالات
    async fetch(url, options = {}) {
        await this.initialize();
        
        const currentEnv = this.envSetup.getCurrentEnvironment();
        
        // إذا كانت بيئة Supabase، نستخدم envSetup مباشرة
        if (currentEnv.type === 'supabase') {
            return this.envSetup.executeQuery(url, options);
        }
        
        // إذا كانت بيئة REST، نستخدم fetch العادي
        return this.restFetch(url, options);
    }

    // الاتصال عبر REST API
    async restFetch(url, options) {
        const currentEnv = this.envSetup.getCurrentEnvironment();
        const fullUrl = this.prepareRestUrl(url, currentEnv);
        
        try {
            console.log(`🌐 طلب REST إلى: ${fullUrl}`);
            
            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // معالجة الاستجابة بناءً على نوع المحتوى
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('❌ خطأ في الاتصال REST:', error);
            this.connectionStatus = 'error';
            this.updateEnvironmentBar();
            throw error;
        }
    }

    // إعداد URL لـ REST
    prepareRestUrl(url, env) {
        if (url.startsWith('http')) return url;
        if (url.startsWith('/api')) return `${env.baseUrl}${url}`;
        return `${env.baseUrl}/api/${url}`;
    }

    // 🔄 دالة ذكية للاستعلام (للتطبيقات القديمة)
    async smartQuery(table, operation = 'select', data = null, filters = null) {
        await this.initialize();
        
        const currentEnv = this.envSetup.getCurrentEnvironment();
        
        if (currentEnv.type === 'supabase') {
            return this.supabaseSmartQuery(table, operation, data, filters);
        } else {
            return this.restSmartQuery(table, operation, data, filters);
        }
    }

    // استعلام ذكي لـ Supabase
    async supabaseSmartQuery(table, operation, data, filters) {
        try {
            const client = this.envSetup.getSupabaseClient();
            if (!client) {
                throw new Error('عميل Supabase غير متاح');
            }

            let result;

            switch (operation) {
                case 'select':
                    let query = client.from(table).select('*');
                    
                    // تطبيق الفلاتر إذا وجدت
                    if (filters) {
                        Object.keys(filters).forEach(key => {
                            if (filters[key] !== null && filters[key] !== undefined) {
                                query = query.eq(key, filters[key]);
                            }
                        });
                    }
                    
                    result = await query;
                    break;

                case 'insert':
                    result = await client.from(table).insert(data).select();
                    break;

                case 'update':
                    let updateQuery = client.from(table).update(data);
                    
                    if (filters) {
                        Object.keys(filters).forEach(key => {
                            if (filters[key] !== null && filters[key] !== undefined) {
                                updateQuery = updateQuery.eq(key, filters[key]);
                            }
                        });
                    }
                    
                    result = await updateQuery.select();
                    break;

                case 'delete':
                    let deleteQuery = client.from(table).delete();
                    
                    if (filters) {
                        Object.keys(filters).forEach(key => {
                            if (filters[key] !== null && filters[key] !== undefined) {
                                deleteQuery = deleteQuery.eq(key, filters[key]);
                            }
                        });
                    }
                    
                    result = await deleteQuery;
                    break;

                default:
                    throw new Error(`العملية غير مدعومة: ${operation}`);
            }

            if (result.error) {
                throw result.error;
            }

            return { data: result.data, error: null };
        } catch (error) {
            console.error(`❌ خطأ في استعلام Supabase (${operation}):`, error);
            return { data: null, error: error.message };
        }
    }

    // استعلام ذكي لـ REST API
    async restSmartQuery(table, operation, data, filters) {
        const currentEnv = this.envSetup.getCurrentEnvironment();
        let url = `${currentEnv.baseUrl}/api/${table}`;
        let options = {
            headers: { 'Content-Type': 'application/json' }
        };

        try {
            switch (operation) {
                case 'select':
                    options.method = 'GET';
                    if (filters) {
                        url += '?' + new URLSearchParams(filters).toString();
                    }
                    break;

                case 'insert':
                    options.method = 'POST';
                    options.body = JSON.stringify(data);
                    break;

                case 'update':
                    options.method = 'PUT';
                    options.body = JSON.stringify(data);
                    if (filters && filters.id) {
                        url += `/${filters.id}`;
                    }
                    break;

                case 'delete':
                    options.method = 'DELETE';
                    if (filters && filters.id) {
                        url += `/${filters.id}`;
                    }
                    break;

                default:
                    throw new Error(`العملية غير مدعومة: ${operation}`);
            }

            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return { data: result, error: null };
        } catch (error) {
            console.error(`❌ خطأ في استعلام REST (${operation}):`, error);
            return { data: null, error: error.message };
        }
    }

    // 🔍 اختبار الاتصال
    async testConnection() {
        try {
            const currentEnv = this.envSetup.getCurrentEnvironment();
            
            if (currentEnv.type === 'supabase') {
                const client = this.envSetup.getSupabaseClient();
                if (!client) return false;
                
                const { data, error } = await client.from('users').select('count').limit(1);
                return !error;
            } else {
                const response = await fetch(`${currentEnv.baseUrl}/health`, { 
                    method: 'GET',
                    timeout: 5000 
                });
                return response.ok;
            }
        } catch (error) {
            console.error('❌ فشل اختبار الاتصال:', error);
            return false;
        }
    }

    // 📊 تحديث شريط حالة البيئة
    updateEnvironmentBar() {
        const envBar = document.getElementById('environmentBar');
        if (!envBar) return;

        const currentEnv = this.envSetup.getCurrentEnvironment();
        if (!currentEnv) return;

        let statusText = '';
        let backgroundColor = '';
        
        switch (this.connectionStatus) {
            case 'connected':
                statusText = 'اتصال نشط';
                backgroundColor = '#27ae60';
                break;
            case 'connecting':
                statusText = 'جاري الاتصال...';
                backgroundColor = '#f39c12';
                break;
            case 'error':
                statusText = 'خطأ في الاتصال';
                backgroundColor = '#e74c3c';
                break;
            default:
                statusText = 'غير متصل';
                backgroundColor = '#95a5a6';
        }

        envBar.style.display = 'block';
        envBar.style.background = backgroundColor;
        envBar.style.color = 'white';
        envBar.style.padding = '8px 15px';
        envBar.style.fontSize = '12px';
        envBar.style.textAlign = 'center';
        envBar.style.fontWeight = 'bold';
        
        envBar.textContent = `🌍 ${currentEnv.label} - ${statusText}`;
    }

    // 📝 الحصول على معلومات الاتصال
    getConnectionInfo() {
        const currentEnv = this.envSetup ? this.envSetup.getCurrentEnvironment() : null;
        const supabaseClient = this.envSetup ? this.envSetup.getSupabaseClient() : null;
        
        return {
            environment: currentEnv,
            connectionType: currentEnv ? currentEnv.type : 'unknown',
            connectionStatus: this.connectionStatus,
            isInitialized: this.isInitialized,
            supabase: {
                client: supabaseClient ? '✅ متاح' : '❌ غير متاح',
                status: supabaseClient ? 'connected' : 'disconnected'
            },
            timestamp: new Date().toISOString()
        };
    }

    // 🔄 إعادة الاتصال
    async reconnect() {
        console.log('🔄 محاولة إعادة الاتصال...');
        this.connectionStatus = 'connecting';
        this.updateEnvironmentBar();
        
        try {
            // إعادة تهيئة Supabase إذا لزم الأمر
            if (this.envSetup.getCurrentEnvironment().type === 'supabase') {
                await this.envSetup.initSupabase();
            }
            
            await this.completeInitialization();
            return true;
        } catch (error) {
            console.error('❌ فشل إعادة الاتصال:', error);
            this.connectionStatus = 'error';
            this.updateEnvironmentBar();
            return false;
        }
    }

    // 🛡️ معالجة الأخطاء
    handleError(error, context = '') {
        console.error(`❌ خطأ في ${context}:`, error);
        
        // تحديث حالة الاتصال
        this.connectionStatus = 'error';
        this.updateEnvironmentBar();
        
        // يمكن إضافة إجراءات إضافية هنا (مثل إشعار للمستخدم)
        return {
            success: false,
            error: error.message,
            context: context,
            timestamp: new Date().toISOString()
        };
    }
}

// إنشاء نسخة عامة
const db = new DBConnectionManager();
window.db = db;

// التهيئة التلقائية عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await db.initialize();
    } catch (error) {
        console.error('❌ فشل في تهيئة مدير الاتصالات:', error);
    }
});

// تحديث شريط البيئة عند تغييرها
window.addEventListener('environmentSelected', () => {
    if (db) {
        db.initialize().then(() => {
            db.updateEnvironmentBar();
        });
    }
});