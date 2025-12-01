// public/js/init.js - كود البداية لكل الشاشات
class AppInitializer {
    constructor() {
        this.isInitialized = false;
        this.currentEnvironment = null;
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('🚀 بدء تهيئة التطبيق...');
        
        try {
            // 🔄 تهيئة نظام البيئة أولاً
            await this.initializeEnvironment();
            
            // 🔄 تهيئة مدير الاتصالات
            await this.initializeConnectionManager();
            
            // 👤 التحقق من تسجيل الدخول (لصفحات التطبيق فقط، ليس صفحة الدخول)
            if (!this.isLoginPage()) {
                await this.verifyAuthentication();
            }

            this.isInitialized = true;
            
            // 📊 عرض معلومات البيئة (لصفحات التطبيق فقط)
            if (!this.isLoginPage()) {
                this.showEnvironmentInfo();
            }
            
            console.log('✅ تم تهيئة التطبيق بنجاح');

            // 🎯 إطلاق حدث أن التطبيق جاهز
            this.dispatchAppReady();

        } catch (error) {
            console.error('❌ فشل في تهيئة التطبيق:', error);
            if (!this.isLoginPage()) {
                this.showError(error.message);
            }
        }
    }

    // 🔄 تهيئة نظام البيئة
    async initializeEnvironment() {
        // الانتظار حتى يكون envSetup جاهزاً
        if (!window.envSetup) {
            await new Promise((resolve) => {
                const checkEnvSetup = setInterval(() => {
                    if (window.envSetup) {
                        clearInterval(checkEnvSetup);
                        resolve();
                    }
                }, 100);
            });
        }

        // تحميل البيئة المحفوظة
        const hasSavedEnv = window.envSetup.loadSavedEnvironment();
        this.currentEnvironment = window.envSetup.getCurrentEnvironment();
        
        console.log(`🌍 البيئة الحالية: ${this.currentEnvironment.label}`);
        
        return true;
    }

    // 🔄 تهيئة مدير الاتصالات
    async initializeConnectionManager() {
        // الانتظار حتى يكون db جاهزاً
        if (!window.db) {
            await new Promise((resolve) => {
                const checkDB = setInterval(() => {
                    if (window.db) {
                        clearInterval(checkDB);
                        resolve();
                    }
                }, 100);
            });
        }

        await window.db.initialize();
        console.log('🔗 تم تهيئة مدير الاتصالات');
    }

    // 👤 التحقق من المصادقة
    async verifyAuthentication() {
        const userData = this.getUserData();
        if (!userData) {
            this.redirectToLogin('يجب تسجيل الدخول أولاً');
            return;
        }

        // التحقق من صحة الجلسة إذا لزم الأمر
        const isValid = await this.validateSession(userData);
        if (!isValid) {
            this.redirectToLogin('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى');
            return;
        }

        console.log('✅ تم التحقق من المصادقة بنجاح');
    }

    // 🔍 التحقق من صحة الجلسة
    async validateSession(userData) {
        try {
            const currentEnv = this.currentEnvironment;
            
            if (currentEnv.type === 'supabase') {
                // للبيئة السحابية، يمكن التحقق من صلاحية التوكن
                const client = window.envSetup.getSupabaseClient();
                if (client) {
                    const { data: { user }, error } = await client.auth.getUser();
                    return !error && user;
                }
            }
            
            // للبيئة المحلية، نتحقق من وجود البيانات الأساسية
            return userData && userData.user_id && userData.username;
        } catch (error) {
            console.warn('⚠️ خطأ في التحقق من الجلسة:', error);
            return false;
        }
    }

    // 📄 التحقق إذا كانت صفحة الدخول
    isLoginPage() {
        return window.location.pathname.includes('login.html') || 
               window.location.pathname.includes('index.html') ||
               document.querySelector('.login-container') !== null;
    }

    // 👤 الحصول على بيانات المستخدم
    getUserData() {
        // الأولوية لـ sessionStorage ثم localStorage
        const sessionData = sessionStorage.getItem('userData');
        const localData = localStorage.getItem('userData');
        
        if (sessionData) {
            return JSON.parse(sessionData);
        } else if (localData) {
            return JSON.parse(localData);
        }
        
        return null;
    }

    // 🔄 حفظ بيانات المستخدم
    saveUserData(userData, rememberMe = false) {
        const data = {
            user_id: userData.user_id,
            username: userData.username,
            store_name: userData.store_name,
            store_id: userData.store_id,
            login_time: new Date().toISOString(),
            environment: this.currentEnvironment ? this.currentEnvironment.name : 'local'
        };

        sessionStorage.setItem('userData', JSON.stringify(data));
        
        if (rememberMe) {
            localStorage.setItem('userData', JSON.stringify(data));
        }
    }

    // 🚀 إعادة التوجيه لصفحة الدخول
    redirectToLogin(reason) {
        console.warn(`⚠️ إعادة التوجيه للدخول: ${reason}`);
        
        if (!this.isLoginPage()) {
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        }
    }

    // 📊 عرض معلومات البيئة
    showEnvironmentInfo() {
        // إزالة شريط المعلومات القديم إذا كان موجوداً
        const oldBar = document.getElementById('appEnvironmentBar');
        if (oldBar) oldBar.remove();

        const envInfo = window.db.getConnectionInfo();
        
        // إنشاء شريط معلومات البيئة
        const infoBar = document.createElement('div');
        infoBar.id = 'appEnvironmentBar';
        infoBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: ${envInfo.connectionType === 'supabase' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 8px 15px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 9999;
            direction: rtl;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        const userData = this.getUserData();
        const userName = userData ? userData.username : 'زائر';
        
        infoBar.innerHTML = `
            <div>
                <strong>${envInfo.environment.label}</strong> | 
                ${userName} | 
                ${envInfo.connectionType === 'supabase' ? '🔗 Supabase مباشر' : '🌐 REST API'}
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span id="connectionStatus" style="display: flex; align-items: center; gap: 5px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
                    متصل
                </span>
                <button onclick="appInitializer.switchEnvironment()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 4px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.3s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                🔄 تبديل البيئة
                </button>
            </div>
        `;

        document.body.prepend(infoBar);
        
        // إضافة مساحة لمنع تداخل المحتوى
        if (!document.getElementById('environmentBarSpacer')) {
            const spacer = document.createElement('div');
            spacer.id = 'environmentBarSpacer';
            spacer.style.height = '40px';
            document.body.prepend(spacer);
        }
    }

    // ❌ عرض خطأ
    showError(message) {
        // إزالة أي أخطاء سابقة
        const oldError = document.getElementById('appInitializationError');
        if (oldError) oldError.remove();

        const errorDiv = document.createElement('div');
        errorDiv.id = 'appInitializationError';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e74c3c;
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            z-index: 10000;
            direction: rtl;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            max-width: 400px;
            width: 90%;
        `;
        
        errorDiv.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
            <h3 style="margin: 0 0 15px 0;">خطأ في التهيئة</h3>
            <p style="margin: 0 0 20px 0; line-height: 1.5;">${message}</p>
            <button onclick="appInitializer.handleErrorAction()" style="
                background: white;
                color: #e74c3c;
                border: none;
                padding: 10px 25px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.3s;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)'" 
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            إعادة المحاولة
            </button>
        `;

        document.body.appendChild(errorDiv);
    }

    // 🛠️ معالجة إجراء الخطأ
    handleErrorAction() {
        const errorDiv = document.getElementById('appInitializationError');
        if (errorDiv) errorDiv.remove();
        
        this.isInitialized = false;
        this.initialize();
    }

    // 🔄 تبديل البيئة
    async switchEnvironment() {
        if (confirm('سيتم تسجيل الخروج والانتقال لصفحة الدخول لاختيار بيئة جديدة. هل تريد المتابعة؟')) {
            // مسح بيانات الجلسة
            sessionStorage.clear();
            localStorage.removeItem('selectedEnvironment');
            localStorage.removeItem('userData');
            
            // الانتقال للدخول
            window.location.href = 'index.html';
        }
    }

    // 🎯 إطلاق حدث جاهزية التطبيق
    dispatchAppReady() {
        const event = new CustomEvent('appReady', {
            detail: {
                environment: window.db.getConnectionInfo(),
                user: this.getUserData(),
                config: window.appConfig ? window.appConfig.getCurrentMode() : null,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    // 📊 الحصول على حالة التهيئة
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            environment: window.db ? window.db.getConnectionInfo() : null,
            user: this.getUserData(),
            config: window.appConfig ? window.appConfig.getCurrentMode() : null,
            currentPage: this.isLoginPage() ? 'login' : 'app'
        };
    }

    // 🚪 تسجيل الخروج
    logout() {
        sessionStorage.clear();
        localStorage.removeItem('userData');
        window.location.href = 'index.html';
    }
}

// إنشاء نسخة عامة
const appInitializer = new AppInitializer();
window.appInitializer = appInitializer;

// التهيئة التلقائية عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
    // تأخير بسيط لضمان تحميل جميع الملفات
    setTimeout(async () => {
        await appInitializer.initialize();
    }, 100);
});

// جعل الدوال متاحة globally للاستخدام السهل
window.getAppStatus = () => appInitializer.getStatus();
window.switchEnvironment = () => appInitializer.switchEnvironment();
window.appLogout = () => appInitializer.logout();