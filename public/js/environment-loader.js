// public/js/environment-loader.js
class EnvironmentLoader {
    constructor() {
        this.userData = null;
        this.environment = null;
        this.initialized = false;
    }

    async init() {
        try {
            console.log('🌍 بدء تحميل إعدادات البيئة...');

            // 🎯 تحميل النظام العالمي
            await window.globalConfig.init();
            
            // 🎯 تحميل البيانات الأساسية
            this.loadBasicData();
            
            // 🎯 إعداد واجهة المستخدم
            this.setupUI();
            
            this.initialized = true;
            console.log('✅ تم تحميل إعدادات البيئة بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل البيئة:', error);
            this.handleError(error);
        }
    }

    // 📊 تحميل البيانات الأساسية
    loadBasicData() {
        this.userData = window.globalConfig.getUserInfo();
        this.environment = window.globalConfig.getEnvironment();
        
        console.log('👤 المستخدم:', this.userData.username);
        console.log('🌍 البيئة:', this.environment.label);
    }

    // 🎨 إعداد واجهة المستخدم
    setupUI() {
        this.setupEnvironmentBar();
        this.setupUserInfo();
        this.updateDate();
    }

    // 🌍 إعداد شريط البيئة
    setupEnvironmentBar() {
        let envBar = document.getElementById('envBar');
        
        if (!envBar) {
            envBar = document.createElement('div');
            envBar.id = 'envBar';
            document.body.insertBefore(envBar, document.body.firstChild);
        }
        
        const isCloud = this.environment.type === 'supabase';
        const bgColor = isCloud ? '#10b981' : '#3b82f6';
        const envIcon = isCloud ? '☁️' : '💻';
        
        envBar.innerHTML = `
            <div style="background: ${bgColor}; 
                        color: white; padding: 8px; text-align: center; font-size: 12px; font-weight: bold;">
                ${envIcon} ${this.environment.label} 
                | المستخدم: ${this.userData.username}
                | الفرع: ${this.userData.store_name}
                <button onclick="environmentLoader.switchEnvironment()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    margin: 0 5px;
                ">🔄 تبديل</button>
                <button onclick="environmentLoader.logout()" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                ">🚪 خروج</button>
            </div>
        `;
    }

    // 👤 إعداد معلومات المستخدم
    setupUserInfo() {
        if (document.getElementById('username')) {
            document.getElementById('username').textContent = 'اسم المستخدم: ' + this.userData.username;
        }
        
        if (document.getElementById('store-name')) {
            document.getElementById('store-name').textContent = 'اسم الفرع: ' + this.userData.store_name;
        }
        
        if (document.getElementById('user-id')) {
            document.getElementById('user-id').textContent = 'كود المستخدم: ' + this.userData.user_id;
        }
    }

    // 📅 تحديث التاريخ
    updateDate() {
        if (document.getElementById('current-date')) {
            const currentDate = new Date().toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('current-date').textContent = 'تاريخ اليوم: ' + currentDate;
        }
    }

    // 🌍 الحصول على البيئة الحالية
    getCurrentEnvironment() {
        return this.environment?.name || 'local';
    }

    // 🔍 الحصول على بيانات البيئة (محدث)
    getEnvironmentData() {
        return {
            userData: this.userData,
            environment: this.environment,
            initialized: this.initialized,
            currentEnvironment: this.getCurrentEnvironment()
        };
    }

    // ✅ التحقق من جاهزية السحابي
    isCloudReady() {
        return this.initialized && 
               this.environment?.name === 'supabase' && 
               window.globalConfig?.isSupabaseConfigured?.();
    }

    // 🔄 تبديل البيئة مع تحديث الصفحة
    async switchEnvironment() {
        const currentEnv = this.environment.name;
        const newEnv = currentEnv === 'supabase' ? 'local' : 'supabase';
        
        const envNames = {
            'supabase': '☁️ Supabase',
            'local': '🖥️ النظام المحلي'
        };
        
        if (confirm(`هل تريد التبديل من ${envNames[currentEnv]} إلى ${envNames[newEnv]}؟`)) {
            try {
                await window.globalConfig.switchEnvironment(newEnv);
                
                // إعادة تحميل الصفحة لتطبيق التغييرات
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } catch (error) {
                console.error('❌ خطأ في تبديل البيئة:', error);
                alert('حدث خطأ أثناء تبديل البيئة');
            }
        }
    }

    // 🚪 تسجيل الخروج
    logout() {
        window.globalConfig.logout();
    }

    // 🌐 تنفيذ استعلام محسّن
    async executeQuery(endpoint, options = {}) {
        if (!this.initialized) await this.init();
        
        try {
            // إذا كنا في وضع السحابي، استخدام globalConfig
            if (this.isCloudReady()) {
                console.log('☁️ تنفيذ استعلام سحابي:', endpoint);
                return await window.globalConfig.executeQuery(endpoint, options);
            } else {
                // إذا كنا في وضع محلي، استخدام fetch مباشرة
                console.log('💻 تنفيذ استعلام محلي:', endpoint);
                const baseUrl = 'http://localhost:3000';
                const fullUrl = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
                
                const response = await fetch(fullUrl, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`خطأ في الاستعلام: ${response.status}`);
                }
                
                return await response.json();
            }
        } catch (error) {
            console.error('❌ خطأ في executeQuery:', error);
            throw error;
        }
    }

    // 🎯 بديل للاستعلام المحلي
    async executeLocalQuery(endpoint, options = {}) {
        const baseUrl = 'http://localhost:3000';
        const fullUrl = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`;
        
        console.log('💻 استعلام محلي مباشر:', fullUrl);
        
        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`خطأ في الاستعلام المحلي: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('❌ خطأ في الاستعلام المحلي:', error);
            throw error;
        }
    }

    // 📡 التحقق من اتصال السحابي
    async checkCloudConnection() {
        if (!this.isCloudReady()) {
            return { success: false, message: 'السحابي غير مفعل' };
        }
        
        try {
            const result = await window.globalConfig.executeQuery('/api/health');
            return { success: true, data: result };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 🔍 التحقق من اتصال المحلي
    async checkLocalConnection() {
        try {
            const response = await fetch('http://localhost:3000/api/health', {
                method: 'GET',
                timeout: 5000
            });
            return { success: response.ok, status: response.status };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // 🎯 الحصول على معلومات الاتصال
    async getConnectionInfo() {
        const cloudStatus = await this.checkCloudConnection();
        const localStatus = await this.checkLocalConnection();
        
        return {
            currentEnvironment: this.getCurrentEnvironment(),
            cloud: cloudStatus,
            local: localStatus,
            user: this.userData,
            timestamp: new Date().toISOString()
        };
    }

    // ⚠️ معالجة الأخطاء
    handleError(error) {
        console.error('❌ خطأ في تحميل البيئة:', error);
        
        // عرض رسالة خطأ في واجهة المستخدم
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            background: #ef4444;
            color: white;
            padding: 10px;
            text-align: center;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
        `;
        errorDiv.textContent = '❌ خطأ في تحميل إعدادات النظام';
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }

    // 🔐 التحقق من المصادقة
    async checkAuth() {
        if (!this.userData?.user_id) {
            alert('❌ يرجى تسجيل الدخول أولاً');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
}

// إنشاء نسخة عالمية
window.environmentLoader = new EnvironmentLoader();