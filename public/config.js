// js/config.js - الملف المحدث
class AppConfig {
    constructor() {
        this.BASE_URL = window.APP_CONFIG?.BASE_URL || "http://localhost:3000";
        this.API_BASE = `${this.BASE_URL}/api`;
        this.currentMode = 'auto'; // auto, local, supabase
        this.init();
    }

    init() {
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
            OFFERS_SHOW: `${this.API_BASE}/offershow`
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
                BY_TYPE: `${this.APIS.ACCOUNT_TRANSACTIONS}/accounts/by-type`
            },
            ACCOUNT_TRANSACTIONS: {
                LAST_ENTRY_NUMBER: `${this.APIS.ACCOUNT_TRANSACTIONS}/last-entry-number`,
                CHECK_ENTRY: `${this.APIS.ACCOUNT_TRANSACTIONS}/check-entry`
            },
            ACCOUNT_REPORTS: {
                ACCOUNT_STATEMENT: `${this.APIS.ACCOUNT_REPORTS}/account-statement`,
                ACCOUNTS_SUMMARY: `${this.APIS.ACCOUNT_REPORTS}/accounts-summary`,
                JOURNAL_LEDGER: `${this.APIS.ACCOUNT_REPORTS}/journal-ledger`
            },
            DEPARTMENTS: {
                EMPLOYEES: `${this.APIS.DEPARTMENTS}/employees`
            },
            EMPLOYEES: {
                DEPARTMENTS: `${this.APIS.EMPLOYEES}/departments`
            },
            PAYROLL: {
                EMPLOYEES: `${this.APIS.PAYROLL}/employees`
            }
        };
    }

    // 🔄 دالة التبديل بين البيئات
    switchMode(mode, customUrl = null) {
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
        console.log(`🔗 BASE_URL: ${this.BASE_URL}`);
        
        // إشعار للتطبيقات الأخرى بالتغيير
        this.dispatchModeChange();
    }

    // 🎯 إشعار التغيير للعناصر الأخرى
    dispatchModeChange() {
        const event = new CustomEvent('appConfigChanged', {
            detail: {
                mode: this.currentMode,
                baseUrl: this.BASE_URL,
                apiBase: this.API_BASE
            }
        });
        window.dispatchEvent(event);
    }

    // 📊 الحصول على معلومات الوضع الحالي
    getCurrentMode() {
        return {
            mode: this.currentMode,
            baseUrl: this.BASE_URL,
            apiBase: this.API_BASE,
            isLocal: this.BASE_URL.includes('localhost'),
            isProduction: !this.BASE_URL.includes('localhost')
        };
    }

    // الحصول على API بالاسم
    get(apiName) {
        return this.APIS[apiName] || null;
    }

    // الحصول على API معقد
    getComplex(apiGroup, method, ...params) {
        const group = this.getAPI[apiGroup];
        if (!group || !group[method]) return null;
        
        if (typeof group[method] === 'function') {
            return group[method](...params);
        }
        return group[method];
    }
}

// إنشاء instance عالمي
const appConfig = new AppConfig();