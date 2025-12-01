// public/js/environment-setup.js - الإصدار المصحح
class EnvironmentSetup {
    constructor() {
        this.environments = {
            local: {
                name: 'local',
                baseUrl: 'http://localhost:3000',
                label: '🖥️ النظام المحلي',
                description: 'خادم التطوير المحلي',
                type: 'rest'
            },
            supabase: {
                name: 'supabase', 
                baseUrl: 'https://rvjacvrrpguehbapvewe.supabase.co',
                label: '☁️ Supabase',
                description: 'خادم السحابة الإلكتروني',
                type: 'supabase'
            }
        };
        
        this.currentEnv = null;
        this.supabaseClient = null;
        this.isSupabaseInitialized = false;
    }

    // تهيئة Supabase - الإصدار المصحح
    async initSupabase() {
        try {
            console.log('🔗 بدء تهيئة Supabase...');


            
            
            // الطريقة الموثوقة - استخدام dynamic import
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            
            // إنشاء العميل - استخدام createClient مباشرة وليس window.supabase.createClient
            this.supabaseClient = createClient(
                'https://rvjacvrrpguehbapvewe.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg'
            );
            
            // اختبار الاتصال (مع معالجة الأخطاء)
            const { data, error } = await this.supabaseClient
                .from('users')
                .select('*')
                .limit(1);
            
            if (error) {
                console.warn('⚠️ تحذير في اختبار الاتصال:', error.message);
                // نستمر رغم التحذير - قد يكون الجدول فارغاً
            }
            
            this.isSupabaseInitialized = true;
            console.log('✅ تم تهيئة Supabase بنجاح');
            return true;
            
        } catch (error) {
            console.error('❌ فشل في تهيئة Supabase:', error);
            this.isSupabaseInitialized = false;
            return false;
        }
    }

    // عرض واجهة اختيار البيئة
    showEnvironmentSelector() {
        // إذا كانت هناك بيئة محفوظة، لا نعرض الاختيار تلقائياً
        if (this.loadSavedEnvironment()) {
            console.log('✅ تم تحميل البيئة المحفوظة:', this.currentEnv.label);
            return;
        }

        const selectorHTML = `
            <div id="environmentModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    width: 90%;
                    max-width: 500px;
                    text-align: center;
                    direction: rtl;
                ">
                    <h2 style="color: #2c3e50; margin-bottom: 20px;">🌍 اختر بيئة التشغيل</h2>
                    
                    <div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-radius: 5px;">
                        <strong>معلومات:</strong> 
                        <span id="envDescription">اختر البيئة المناسبة</span>
                    </div>
                    
                    <div id="environmentOptions" style="margin: 20px 0;">
                        ${Object.values(this.environments).map(env => `
                            <div class="env-option" data-env="${env.name}" style="
                                padding: 15px;
                                margin: 10px 0;
                                border: 2px solid #ddd;
                                border-radius: 10px;
                                cursor: pointer;
                                transition: all 0.3s;
                                background: #f8f9fa;
                            ">
                                <div style="font-weight: bold; font-size: 18px;">${env.label}</div>
                                <div style="color: #666; font-size: 14px; margin-top: 5px;">${env.description}</div>
                                <div style="color: #888; font-size: 12px; margin-top: 5px;">
                                    ${env.type === 'supabase' ? '🔗 اتصال مباشر بقاعدة البيانات' : '🌐 اتصال عبر REST API'}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
                        <label style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <input type="checkbox" id="rememberChoice">
                            تذكر اختياري ولا تسألني مرة أخرى
                        </label>
                    </div>

                    <button id="confirmEnv" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        margin-top: 15px;
                        display: none;
                    ">تأكيد وتحميل النظام</button>
                </div>
            </div>

            <style>
                .env-option:hover {
                    border-color: #3498db !important;
                    background: #e3f2fd !important;
                    transform: translateY(-2px);
                }
                .env-option.selected {
                    border-color: #27ae60 !important;
                    background: #e8f6f3 !important;
                }
            </style>
        `;

        document.body.insertAdjacentHTML('beforeend', selectorHTML);
        this.bindEnvironmentEvents();
    }

    bindEnvironmentEvents() {
        const options = document.querySelectorAll('.env-option');
        const descriptionEl = document.getElementById('envDescription');
        const confirmBtn = document.getElementById('confirmEnv');

        options.forEach(option => {
            option.addEventListener('mouseenter', () => {
                const envName = option.dataset.env;
                const env = this.environments[envName];
                descriptionEl.textContent = 
                    env.type === 'supabase' 
                    ? 'اتصال مباشر مع Supabase - أسرع ولكن يحتاج اتصال إنترنت' 
                    : 'اتصال عبر REST API - متوافق مع جميع الخوادم';
            });

            option.addEventListener('click', () => {
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                confirmBtn.style.display = 'block';
            });
        });

        confirmBtn.addEventListener('click', async () => {
            const selectedEnv = document.querySelector('.env-option.selected');
            if (selectedEnv) {
                const envName = selectedEnv.dataset.env;
                confirmBtn.innerHTML = '<span class="loading"></span> جاري التحميل...';
                confirmBtn.disabled = true;
                
                await this.setEnvironment(envName);
                this.hideModal();
            }
        });
    }

    hideModal() {
        const modal = document.getElementById('environmentModal');
        if (modal) {
            modal.remove();
        }
    }

    // تحديد البيئة
    async setEnvironment(envName) {
        const env = this.environments[envName];
        if (env) {
            this.currentEnv = env;
            
            // إذا كانت بيئة Supabase، نقوم بتهيئتها
            if (env.type === 'supabase') {
                const success = await this.initSupabase();
                if (!success) {
                    alert('⚠️ تعذر الاتصال بـ Supabase، جاري استخدام النظام المحلي تلقائياً');
                    return this.setEnvironment('local');
                }
            }

            // حفظ في localStorage إذا طلب المستخدم
            const remember = document.getElementById('rememberChoice')?.checked;
            if (remember) {
                localStorage.setItem('selectedEnvironment', JSON.stringify({
                    env: envName,
                    timestamp: new Date().toISOString()
                }));
            }

            // حفظ في sessionStorage للجلسة الحالية
            sessionStorage.setItem('currentEnvironment', envName);
            
            console.log(`✅ تم تحديد البيئة: ${env.label}`);
            
            // إطلاق حدث أن البيئة تم تحديدها
            this.dispatchEnvironmentSelected(env);
            return true;
        }
        return false;
    }

    // تحميل البيئة المحفوظة
    loadSavedEnvironment() {
        // الأولوية للبيئة المحفوظة في الجلسة
        const sessionEnv = sessionStorage.getItem('currentEnvironment');
        if (sessionEnv && this.environments[sessionEnv]) {
            this.currentEnv = this.environments[sessionEnv];
            console.log(`📁 تم تحميل البيئة من الجلسة: ${this.currentEnv.label}`);
            
            // إذا كانت supabase، نقوم بتهيئتها
            if (this.currentEnv.type === 'supabase') {
                this.initSupabase().then(success => {
                    if (!success) {
                        console.warn('⚠️ فشل في تهيئة Supabase، الانتقال للنظام المحلي');
                        this.setEnvironment('local');
                    }
                });
            }
            
            return true;
        }

        // ثم التحقق من localStorage
        try {
            const saved = localStorage.getItem('selectedEnvironment');
            if (saved) {
                const { env, timestamp } = JSON.parse(saved);
                
                // التحقق من أن الإعدادات ليست قديمة (أكثر من 7 أيام)
                const savedDate = new Date(timestamp);
                const now = new Date();
                const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);
                
                if (daysDiff < 7 && this.environments[env]) {
                    this.currentEnv = this.environments[env];
                    console.log(`💾 تم تحميل البيئة المحفوظة: ${this.currentEnv.label}`);
                    
                    // إذا كانت supabase، نقوم بتهيئتها
                    if (this.currentEnv.type === 'supabase') {
                        this.initSupabase().then(success => {
                            if (!success) {
                                console.warn('⚠️ فشل في تهيئة Supabase، الانتقال للنظام المحلي');
                                this.setEnvironment('local');
                            }
                        });
                    }
                    
                    return true;
                }
            }
        } catch (error) {
            console.warn('⚠️ خطأ في تحميل البيئة المحفوظة');
        }

        return false;
    }

    // الحصول على البيئة الحالية
    getCurrentEnvironment() {
        return this.currentEnv || this.environments.local;
    }

    // الحصول على عميل Supabase
    getSupabaseClient() {
        return this.supabaseClient;
    }

    // تنفيذ استعلام بناءً على البيئة
    async executeQuery(endpoint, options = {}) {
        const env = this.getCurrentEnvironment();
        
        console.log(`🎯 تنفيذ استعلام على ${env.label}: ${endpoint}`);
        
        if (env.type === 'supabase' && this.supabaseClient) {
            return await this.executeSupabaseQuery(endpoint, options);
        } else {
            return await this.executeRestQuery(endpoint, options);
        }
    }

    // تنفيذ استعلام Supabase
    async executeSupabaseQuery(endpoint, options) {
        if (!this.supabaseClient) {
            throw new Error('عميل Supabase غير مهيأ');
        }

        const body = options.body ? JSON.parse(options.body) : {};
        
        try {
            console.log(`🔍 معالجة طلب Supabase: ${endpoint}`, body);
            
            switch(endpoint) {
                case '/api/users/get_user_info':
                    const { data: userData, error: userError } = await this.supabaseClient
                        .from('users')
                        .select('*')
                        .eq('user_id', body.user_id)
                        .single();
                    
                    if (userError) {
                        console.warn('⚠️ لم يتم العثور على مستخدم:', userError);
                        return { username: '', store_name: '', store_id: '' };
                    }
                    return userData || { username: '', store_name: '', store_id: '' };

                case '/api/users/check_db':
                    const { data: authData, error: authError } = await this.supabaseClient
                        .from('users')
                        .select('*')
                        .eq('user_id', body.user_id)
                        .eq('password', body.password)
                        .single();
                    
                    if (authError) {
                        console.warn('⚠️ خطأ في المصادقة:', authError);
                        return "كود المستخدم أو كلمة المرور غير صحيحة";
                    }
                    return authData ? "تم التحقق من المستخدم بنجاح." : "كود المستخدم أو كلمة المرور غير صحيحة";

                default:
                    console.warn(`❌ endpoint غير معروف لـ Supabase: ${endpoint}`);
                    throw new Error(`Endpoint غير معروف: ${endpoint}`);
            }
        } catch (error) {
            console.error('❌ خطأ في Supabase:', error);
            throw error;
        }
    }

    // تنفيذ استعلام REST
    async executeRestQuery(endpoint, options) {
        const env = this.getCurrentEnvironment();
        
        // استخدام baseUrl من البيئة الحالية
        const apiUrl = `${env.baseUrl}${endpoint}`;
        
        console.log(`🌐 طلب REST إلى: ${apiUrl}`);
        
        try {
            const response = await fetch(apiUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // معالجة الاستجابة بناءً على نوع المحتوى
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('❌ خطأ في REST API:', error);
            
            // إذا فشل الاتصال مع البيئة الحالية، نعيد بيانات افتراضية
            if (endpoint === '/api/users/get_user_info') {
                return { username: '', store_name: '', store_id: '' };
            } else if (endpoint === '/api/users/check_db') {
                return "فشل الاتصال بالخادم";
            }
            
            throw error;
        }
    }

    // إطلاق حدث
    dispatchEnvironmentSelected(env) {
        const event = new CustomEvent('environmentSelected', {
            detail: env
        });
        window.dispatchEvent(event);
    }

    // التبديل اليدوي للبيئة (لشاشة الإعدادات)
    async switchEnvironment(envName) {
        if (this.environments[envName]) {
            const success = await this.setEnvironment(envName);
            if (success) {
                // إعادة تحميل الصفحة لتطبيق التغييرات
                if (confirm(`سيتم إعادة تحميل الصفحة للتطبيق التغييرات على البيئة. هل تريد المتابعة؟`)) {
                    location.reload();
                }
            }
        }
    }

    // الحصول على حالة النظام
    getStatus() {
        return {
            currentEnvironment: this.currentEnv,
            supabaseInitialized: this.isSupabaseInitialized,
            supabaseClient: !!this.supabaseClient,
            environments: Object.keys(this.environments)
        };
    }
}

// إنشاء نسخة عامة
const envSetup = new EnvironmentSetup();
window.envSetup = envSetup;