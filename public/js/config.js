// js/config.js - الملف المحدث
class AppConfig {
    constructor() {
        this.currentMode = 'auto'; // auto, local, production, supabase
        this.currentEnvironment = null;
        this.init();
    }

    init() {
        // تهيئة البيئة الحالية من نظام البيئة
        this.updateFromEnvironment();
        
        // تعريف جميع الـ APIs في مكان واحد
        this.APIS = {
            // 🔐 Authentication & Users
            USERS: `${this.API_BASE}/users`,
            USERS_BK: `${this.API_BASE}/usersbk`,
            PRIVILEGES: `${this.API_BASE}/privilegesbk`,
            
            // 💰 Accounts
            ACCOUNTS: `${this.API_BASE}/accounts`,
            ACCOUNT_TYPES: `${this.API_BASE}/account-types`,
            ACCOUNT_TRANSACTIONS: `${this.API_BASE}/account-transactions`,
            ACCOUNT_REPORTS: `${this.API_BASE}/account-reports`,
            
            // 📦 Inventory
            ITEMS: `${this.API_BASE}/items`,
            STORES: `${this.API_BASE}/stores`,
            UNITS: `${this.API_BASE}/units`,
            A_MASTER: `${this.API_BASE}/a_master`,
            A_MASTER_REPORT: `${this.API_BASE}/a_master_report`,
            SEARCH: `${this.API_BASE}/searchbk`,
            
            // 🛍️ Sales
            SALES: `${this.API_BASE}/salesbk`,
            SALES_RETURN: `${this.API_BASE}/salesreturnbk`,
            SALES_REPORT: `${this.API_BASE}/salesbk/report`,
            SALES_RETURN_REPORT: `${this.API_BASE}/salesreturn_report`,
            
            // 📥 Purchases
            PURCHASES: `${this.API_BASE}/purchases`,
            PURCHASES_REPORT: `${this.API_BASE}/purchases-report`,
            
            // 🔄 Transfers
            TRANSFER_ITEM: `${this.API_BASE}/transferItembk`,
            ACCEPT_TRANSFER: `${this.API_BASE}/acceptTransferbk`,
            
            // 👥 HR
            EMPLOYEES: `${this.API_BASE}/emplbk`,
            DEPARTMENTS: `${this.API_BASE}/deptbk`,
            ATTENDANCE: `${this.API_BASE}/attendbk`,
            PAYROLL: `${this.API_BASE}/payrollbk`,
            
            // 🏢 Others
            CUSTOMERS: `${this.API_BASE}/customers`,
            SUPPLIERS: `${this.API_BASE}/suppliers`,
            FACTORIES: `${this.API_BASE}/factories`,
            COMPANY: `${this.API_BASE}/company`,
            OFFERS: `${this.API_BASE}/item_price_offers`,
            OFFERS_SHOW: `${this.API_BASE}/offershow`,

            // 🔍 Search & Filter
            SEARCH_ITEMS: `${this.API_BASE}/search-items`,
            FILTER_ITEMS: `${this.API_BASE}/filter-items`,

            // 📊 Reports
            INVENTORY_REPORT: `${this.API_BASE}/inventory-report`,
            STOCK_REPORT: `${this.API_BASE}/stock-report`,
            PROFIT_LOSS_REPORT: `${this.API_BASE}/profit-loss-report`,

            // 🔄 Sync
            SYNC_DATA: `${this.API_BASE}/sync-data`,
            BACKUP_DATA: `${this.API_BASE}/backup-data`
        };

        // APIs المعقدة (تحتاج parameters)
        this.getAPI = {
            ACCEPT_TRANSFER: {
                INCOMING: (storeId) => `${this.APIS.ACCEPT_TRANSFER}/incoming-transfers/${storeId}`,
                DETAILS: (transferNo) => `${this.APIS.ACCEPT_TRANSFER}/transfer-details/${transferNo}`,
                ACCEPT: (transferNo) => `${this.APIS.ACCEPT_TRANSFER}/accept-transfer/${transferNo}`,
                REJECT: (transferNo) => `${this.APIS.ACCEPT_TRANSFER}/reject-transfer/${transferNo}`,
                PARTIAL: (transferNo) => `${this.APIS.ACCEPT_TRANSFER}/partial-accept/${transferNo}`,
                ACCEPTED: `${this.APIS.ACCEPT_TRANSFER}/accepted-transfers`
            },
            ACCOUNTS: {
                PARENT_ACCOUNTS: `${this.APIS.ACCOUNTS}/parents/main`,
                CHILD_ACCOUNTS: `${this.APIS.ACCOUNTS}/parents/children`,
                SUPPLIERS_CUSTOMERS: `${this.APIS.ACCOUNTS}/suppliers-customers`,
                ACTIVE: `${this.APIS.ACCOUNT_TRANSACTIONS}/accounts/active`,
                BY_TYPE: `${this.APIS.ACCOUNT_TRANSACTIONS}/accounts/by-type`,
                BALANCE: (accountId) => `${this.APIS.ACCOUNTS}/balance/${accountId}`,
                TRANSACTIONS: (accountId) => `${this.APIS.ACCOUNTS}/transactions/${accountId}`
            },
            ACCOUNT_TRANSACTIONS: {
                LAST_ENTRY_NUMBER: `${this.APIS.ACCOUNT_TRANSACTIONS}/last-entry-number`,
                CHECK_ENTRY: `${this.APIS.ACCOUNT_TRANSACTIONS}/check-entry`,
                BY_DATE: (date) => `${this.APIS.ACCOUNT_TRANSACTIONS}/by-date/${date}`,
                BY_PERIOD: (startDate, endDate) => `${this.APIS.ACCOUNT_TRANSACTIONS}/by-period/${startDate}/${endDate}`
            },
            ACCOUNT_REPORTS: {
                ACCOUNT_STATEMENT: `${this.APIS.ACCOUNT_REPORTS}/account-statement`,
                ACCOUNTS_SUMMARY: `${this.APIS.ACCOUNT_REPORTS}/accounts-summary`,
                JOURNAL_LEDGER: `${this.APIS.ACCOUNT_REPORTS}/journal-ledger`,
                TRIAL_BALANCE: `${this.APIS.ACCOUNT_REPORTS}/trial-balance`,
                BALANCE_SHEET: `${this.APIS.ACCOUNT_REPORTS}/balance-sheet`
            },
            DEPARTMENTS: {
                EMPLOYEES: `${this.APIS.DEPARTMENTS}/employees`,
                BY_COMPANY: (companyId) => `${this.APIS.DEPARTMENTS}/by-company/${companyId}`
            },
            EMPLOYEES: {
                DEPARTMENTS: `${this.APIS.EMPLOYEES}/departments`,
                BY_DEPARTMENT: (deptId) => `${this.APIS.EMPLOYEES}/by-department/${deptId}`,
                ATTENDANCE: (empId) => `${this.APIS.EMPLOYEES}/attendance/${empId}`
            },
            PAYROLL: {
                EMPLOYEES: `${this.APIS.PAYROLL}/employees`,
                BY_MONTH: (month) => `${this.APIS.PAYROLL}/by-month/${month}`,
                GENERATE: `${this.APIS.PAYROLL}/generate`
            },
            ITEMS: {
                BY_STORE: (storeId) => `${this.APIS.ITEMS}/by-store/${storeId}`,
                STOCK: (itemId) => `${this.APIS.ITEMS}/stock/${itemId}`,
                PRICE_HISTORY: (itemId) => `${this.APIS.ITEMS}/price-history/${itemId}`
            },
            SALES: {
                BY_DATE: (date) => `${this.APIS.SALES}/by-date/${date}`,
                BY_CUSTOMER: (customerId) => `${this.APIS.SALES}/by-customer/${customerId}`,
                INVOICE: (invoiceNo) => `${this.APIS.SALES}/invoice/${invoiceNo}`
            },
            PURCHASES: {
                BY_DATE: (date) => `${this.APIS.PURCHASES}/by-date/${date}`,
                BY_SUPPLIER: (supplierId) => `${this.APIS.PURCHASES}/by-supplier/${supplierId}`,
                ORDER: (orderNo) => `${this.APIS.PURCHASES}/order/${orderNo}`
            }
        };
    }

    // 🔄 تحديث الإعدادات من نظام البيئة
    updateFromEnvironment() {
        if (window.envSetup && window.envSetup.getCurrentEnvironment()) {
            this.currentEnvironment = window.envSetup.getCurrentEnvironment();
            this.BASE_URL = this.currentEnvironment.baseUrl;
            this.API_BASE = this.currentEnvironment.type === 'supabase' ? 
                'supabase' : `${this.BASE_URL}/api`;
            this.currentMode = this.currentEnvironment.name;
        } else {
            // الإعدادات الافتراضية
            this.BASE_URL = window.APP_CONFIG?.BASE_URL || "http://localhost:3000";
            this.API_BASE = `${this.BASE_URL}/api`;
            this.currentMode = 'auto';
            this.currentEnvironment = {
                name: 'local',
                baseUrl: 'http://localhost:3000',
                label: '🖥️ النظام المحلي',
                type: 'rest'
            };
        }
    }

    // 🔄 دالة التبديل بين البيئات
    switchMode(mode, customUrl = null) {
        if (window.envSetup) {
            // استخدام نظام البيئة للتبديل
            const success = window.envSetup.setEnvironment(mode);
            if (success) {
                this.updateFromEnvironment();
                this.init();
                console.log(`🔄 تم التبديل إلى: ${this.currentEnvironment.label}`);
                this.dispatchModeChange();
            }
        } else {
            // النظام القديم
            switch(mode) {
                case 'local':
                    this.BASE_URL = customUrl || 'http://localhost:3000';
                    this.currentMode = 'local';
                    break;
                case 'production':
                    this.BASE_URL = customUrl || window.location.origin;
                    this.currentMode = 'production';
                    break;
                case 'auto':
                default:
                    this.BASE_URL = window.APP_CONFIG?.BASE_URL || window.location.origin;
                    this.currentMode = 'auto';
            }
            
            this.API_BASE = `${this.BASE_URL}/api`;
            this.init();
            console.log(`🔄 تم التبديل إلى: ${this.currentMode}`);
            this.dispatchModeChange();
        }
    }

    // 🎯 إشعار التغيير للعناصر الأخرى
    dispatchModeChange() {
        const event = new CustomEvent('appConfigChanged', {
            detail: {
                mode: this.currentMode,
                environment: this.currentEnvironment,
                baseUrl: this.BASE_URL,
                apiBase: this.API_BASE,
                apis: this.APIS,
                isSupabase: this.currentEnvironment?.type === 'supabase',
                isLocal: this.currentEnvironment?.name === 'local'
            }
        });
        window.dispatchEvent(event);
    }

    // 📊 الحصول على معلومات الوضع الحالي
    getCurrentMode() {
        return {
            mode: this.currentMode,
            environment: this.currentEnvironment,
            baseUrl: this.BASE_URL,
            apiBase: this.API_BASE,
            isLocal: this.currentEnvironment?.name === 'local',
            isSupabase: this.currentEnvironment?.type === 'supabase',
            isProduction: this.currentEnvironment?.name === 'production'
        };
    }

    // 🎯 الحصول على API بالاسم
    get(apiName) {
        // إذا كان Supabase، نعيد null لأن الاستعلامات مباشرة
        if (this.currentEnvironment?.type === 'supabase') {
            console.log(`ℹ️  نظام Supabase - الاستعلامات مباشرة عبر envSetup.executeQuery()`);
            return null;
        }
        return this.APIS[apiName] || null;
    }

    // 🎯 الحصول على API معقد
    getComplex(apiGroup, method, ...params) {
        // إذا كان Supabase، نعيد null لأن الاستعلامات مباشرة
        if (this.currentEnvironment?.type === 'supabase') {
            console.log(`ℹ️  نظام Supabase - الاستعلامات مباشرة عبر envSetup.executeQuery()`);
            return null;
        }

        const group = this.getAPI[apiGroup];
        if (!group || !group[method]) {
            console.warn(`❌ API غير موجود: ${apiGroup}.${method}`);
            return null;
        }
        
        if (typeof group[method] === 'function') {
            return group[method](...params);
        }
        return group[method];
    }

    // 🔍 التحقق من اتصال API
    async checkConnection() {
        if (this.currentEnvironment?.type === 'supabase') {
            // اختبار اتصال Supabase
            try {
                const client = window.envSetup.getSupabaseClient();
                if (!client) return false;
                
                const { data, error } = await client.from('users').select('count').limit(1);
                return !error;
            } catch (error) {
                console.error('❌ فشل الاتصال بـ Supabase:', error);
                return false;
            }
        } else {
            // اختبار اتصال REST API
            try {
                const response = await fetch(`${this.BASE_URL}/health`);
                return response.ok;
            } catch (error) {
                console.error('❌ فشل الاتصال بالخادم:', error);
                return false;
            }
        }
    }

    // 🛠️ إنشاء رابط كامل مع parameters
    buildUrl(endpoint, params = {}) {
        if (this.currentEnvironment?.type === 'supabase') {
            console.warn('⚠️ نظام Supabase لا يستخدم URLs مباشرة');
            return endpoint;
        }
        
        const url = new URL(endpoint, this.BASE_URL);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    }

    // 🔄 تنفيذ استعلام ذكي (يعمل مع جميع البيئات)
    async executeQuery(endpoint, options = {}) {
        if (window.envSetup) {
            return await window.envSetup.executeQuery(endpoint, options);
        } else {
            // النظام القديم
            const url = this.buildUrl(endpoint);
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });
                
                if (response.ok) {
                    if (endpoint.includes('/check_db')) {
                        return await response.text();
                    }
                    return await response.json();
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('❌ فشل في الاستعلام:', error);
                throw error;
            }
        }
    }

    // 📝 معلومات التصحيح
    debugInfo() {
        return {
            environment: this.currentEnvironment,
            baseUrl: this.BASE_URL,
            apiBase: this.API_BASE,
            mode: this.currentMode,
            isSupabase: this.currentEnvironment?.type === 'supabase',
            supabaseClient: window.envSetup?.getSupabaseClient() ? '✅ متاح' : '❌ غير متاح'
        };
    }
}

// إنشاء instance عالمي
const appConfig = new AppConfig();

// جعلها متاحة globally
window.appConfig = appConfig;

// تحديث الإعدادات عند تغيير البيئة
window.addEventListener('environmentSelected', () => {
    appConfig.updateFromEnvironment();
    appConfig.init();
    console.log('🔄 تم تحديث الإعدادات مع البيئة الجديدة:', appConfig.currentEnvironment.label);
});

// Export للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = appConfig;
}