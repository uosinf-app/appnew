// public/js/global-config.js
class GlobalConfig {
    constructor() {
        this.systemReady = false;
        this.currentEnvironment = null;
        this.userData = null;
        this.init();
    }

    async init() {
        try {
            // تحميل البيانات من نظام الدخول
            await this.loadFromLoginSystem();
            this.systemReady = true;
            console.log('✅ تم تحميل الإعدادات العالمية');
        } catch (error) {
            console.warn('⚠️ استخدام الإعدادات المحلية:', error);
            this.loadLocalData();
        }
    }

    async loadFromLoginSystem() {
        // الانتظار حتى يكون نظام الدخول جاهزاً
        if (window.envSetup && window.appConfig) {
            this.currentEnvironment = window.envSetup.getCurrentEnvironment();
            this.userData = window.appInitializer?.getUserData();
        } else {
            // إذا لم يكن النظام جاهزاً، نستخدم البيانات المحفوظة
            this.loadLocalData();
        }
    }

    loadLocalData() {
        this.currentEnvironment = {
            name: localStorage.getItem('currentEnvironment') || 'local',
            label: localStorage.getItem('currentEnvironment') === 'supabase' ? '☁️ Supabase' : '🖥️ النظام المحلي',
            type: localStorage.getItem('currentEnvironment') === 'supabase' ? 'supabase' : 'rest',
            baseUrl: localStorage.getItem('currentEnvironment') === 'supabase' 
                ? 'https://rvjacvrrpguehbapvewe.supabase.co'
                : 'http://localhost:3000'
        };

        this.userData = {
            user_id: localStorage.getItem('user_id'),
            username: localStorage.getItem('username'),
            store_name: localStorage.getItem('store_name'),
            store_id: localStorage.getItem('store_id')
        };
    }

    // 🔧 الحصول على بيانات الاتصال
    getConnectionInfo() {
        return {
            environment: this.currentEnvironment,
            user: this.userData,
            isSupabase: this.currentEnvironment?.type === 'supabase',
            isLocal: this.currentEnvironment?.name === 'local'
        };
    }

    // 🌐 تنفيذ استعلام ذكي
    async executeQuery(endpoint, options = {}) {
        if (!this.systemReady) await this.init();

        if (this.currentEnvironment?.type === 'supabase' && window.envSetup) {
            return await window.envSetup.executeQuery(endpoint, options);
        } else {
            return await this.executeRestQuery(endpoint, options);
        }
    }

    async executeRestQuery(endpoint, options) {
        const baseUrl = this.currentEnvironment?.baseUrl || 'http://localhost:3000';
        const url = `${baseUrl}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const contentType = response.headers.get('content-type');
            return contentType?.includes('application/json') 
                ? await response.json() 
                : await response.text();

        } catch (error) {
            console.error('❌ فشل في الاستعلام:', error);
            throw error;
        }
    }

    // 👤 معلومات المستخدم
    getUserInfo() {
        return this.userData;
    }

    // 🌍 معلومات البيئة
    getEnvironment() {
        return this.currentEnvironment;
    }

    // 🔄 تبديل البيئة
    async switchEnvironment(envName) {
        if (envName === 'supabase') {
            localStorage.setItem('currentEnvironment', 'supabase');
        } else {
            localStorage.setItem('currentEnvironment', 'local');
        }
        
        location.reload();
    }

    // 🚪 تسجيل الخروج
    logout() {
        localStorage.removeItem('user_id');
        localStorage.removeItem('username');
        localStorage.removeItem('store_name');
        localStorage.removeItem('store_id');
        localStorage.removeItem('currentEnvironment');
        
        sessionStorage.clear();
        window.location.href = 'index.html';
    }
}

// إنشاء نسخة عالمية
window.globalConfig = new GlobalConfig();