// acc_transaction.js - Frontend for Account Transactions (محدث بنظام الاتصال الهجين)

// ⚡ التهيئة العالمية
const SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

let supabase;

class AccountTransactionsApp {
    constructor() {
        this.BASE_URL = window.APP_CONFIG && window.APP_CONFIG.BASE_URL 
            ? window.APP_CONFIG.BASE_URL 
            : 'http://localhost:3000';
            
        this.API = {
            TRANSACTIONS: `${this.BASE_URL}/api/account-transactions`,
            ACCOUNTS: `${this.BASE_URL}/api/accounts`,
            ACCOUNT_TYPES: `${this.BASE_URL}/api/account-types`,
            ACCOUNTS_BY_TYPE: `${this.BASE_URL}/api/account-transactions/accounts/by-type`,
            ACTIVE_ACCOUNTS: `${this.BASE_URL}/api/account-transactions/accounts/active`,
            LAST_ENTRY_NUMBER: `${this.BASE_URL}/api/account-transactions/last-entry-number`,
            CHECK_ENTRY: `${this.BASE_URL}/api/account-transactions/check-entry`
        };

        this.state = {
            transactions: [],
            accounts: [],
            accountTypes: [],
            currentEntryLines: [],
            currentAccountType: "",
            searchFilters: {
                start_date: "",
                end_date: "",
                account_id: "",
                entry_number: ""
            },
            isLoading: false,
            isSubmitting: false,
            allAccounts: [],
            currentFieldIndex: 0
        };
        
        this.dom = this._initDOM();
        this.init();
    }

    // ======================== 🏗️ تهيئة DOM ========================
    _initDOM() {
        return {
            // عناصر النموذج
            transactionForm: document.getElementById("transactionForm"),
            transactionDate: document.getElementById("transactionDate"),
            entryNumber: document.getElementById("entryNumber"),
            accountType: document.getElementById("accountType"),
            accountId: document.getElementById("accountId"),
            accountSearch: document.getElementById("accountSearch"),
            debitAmount: document.getElementById("debitAmount"),
            creditAmount: document.getElementById("creditAmount"),
            lineDescription: document.getElementById("lineDescription"),
            
            // عناصر البحث
            searchStartDate: document.getElementById("searchStartDate"),
            searchEndDate: document.getElementById("searchEndDate"),
            searchAccountId: document.getElementById("searchAccountId"),
            searchEntryNumber: document.getElementById("searchEntryNumber"),
            
            // عناصر العرض
            tableBody: document.getElementById("tableBody"),
            currentEntryTable: document.getElementById("currentEntryTable"),
            loading: document.getElementById("loading"),
            totalDebit: document.getElementById("totalDebit"),
            totalCredit: document.getElementById("totalCredit"),
            balanceStatus: document.getElementById("balanceStatus"),
            
            // أزرار
            addLineBtn: document.getElementById("addLineBtn"),
            saveEntryBtn: document.getElementById("saveEntryBtn"),
            newEntryBtn: document.getElementById("newEntryBtn"),
            searchBtn: document.getElementById("searchBtn"),
            resetSearchBtn: document.getElementById("resetSearchBtn"),
            printBtn: document.getElementById("printBtn"),
            switchModeBtn: document.getElementById("switchModeBtn"),
            
            // حالة الاتصال
            connectionStatus: document.getElementById("connectionStatus")
        };
    }

    // ======================== 🚀 تهيئة التطبيق ========================
    async init() {
        // تهيئة Supabase
        this.initializeSupabase();
        
        // تحديث حالة الاتصال
        this.updateConnectionStatus();
        
        // إعداد مستمعي الأحداث
        this._setupEventListeners();
        
        // تعيين التواريخ الافتراضية
        this._setDefaultDates();
        
        // تحميل البيانات
        await this._loadAccountTypes();
        await this._loadAllAccounts();
        await this._loadActiveAccounts();
        await this._loadLastEntryNumber();
        await this._loadTransactions();
    }

    // ======================== 🎯 إعداد مستمعي الأحداث ========================
    _setupEventListeners() {
        // أزرار النموذج الرئيسي
        this.dom.addLineBtn.addEventListener('click', () => this.addLine());
        this.dom.saveEntryBtn.addEventListener('click', () => this.saveEntry());
        this.dom.newEntryBtn.addEventListener('click', () => this.newEntry());
        
        // أزرار البحث
        this.dom.searchBtn.addEventListener('click', () => this.searchTransactions());
        this.dom.resetSearchBtn.addEventListener('click', () => this.resetSearch());
        this.dom.printBtn.addEventListener('click', () => this.printTransactions());
        
        // زر تبديل الوضع
        this.dom.switchModeBtn.addEventListener('click', () => this.switchConnectionMode());
        
        // حقول البحث الآلي
        this.dom.accountSearch.addEventListener('input', (e) => this.onAccountSearch(e.target.value));
        this.dom.accountType.addEventListener('change', (e) => this.onAccountTypeChange(e.target.value));
        
        // تحديث حالة القيد
        this.dom.debitAmount.addEventListener('input', () => this._updateSaveButtonState());
        this.dom.creditAmount.addEventListener('input', () => this._updateSaveButtonState());
        
        // إعداد التنقل بـ Enter
        this._setupEnterNavigation();
        
        // البحث عند تغيير التواريخ
        this.dom.searchStartDate.addEventListener('change', () => this.searchTransactions());
        this.dom.searchEndDate.addEventListener('change', () => this.searchTransactions());
        
        // إغلاق dropdown عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.account-search-container')) {
                this._hideAccountDropdown();
            }
        });
    }

    // ======================== ⌨️ إعداد التنقل بمفتاح Enter ========================
    _setupEnterNavigation() {
        const fields = [
            this.dom.transactionDate,
            this.dom.entryNumber,
            this.dom.accountType,
            this.dom.accountSearch,
            this.dom.debitAmount,
            this.dom.creditAmount,
            this.dom.lineDescription
        ];

        fields.forEach((field, index) => {
            if (field) {
                field.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        
                        if (field === this.dom.lineDescription) {
                            this.addLine();
                        } else {
                            const nextIndex = index + 1;
                            if (nextIndex < fields.length && fields[nextIndex]) {
                                fields[nextIndex].focus();
                            }
                        }
                    }
                });
            }
        });

        // تفعيل Enter في حقول البحث
        const searchFields = [
            this.dom.searchStartDate,
            this.dom.searchEndDate,
            this.dom.searchAccountId,
            this.dom.searchEntryNumber
        ];

        searchFields.forEach(field => {
            if (field) {
                field.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.searchTransactions();
                    }
                });
            }
        });
    }

    // ======================== 🌐 نظام الاتصال الهجين ========================

    // ✅ الحصول على وضع الاتصال الحالي
    getConnectionMode() {
        return localStorage.getItem('connection_mode') || 
               sessionStorage.getItem('connection_mode') || 
               'auto';
    }

    // ✅ تحديث شريط حالة الاتصال
    updateConnectionStatus() {
        const mode = this.getConnectionMode();
        
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            this.dom.connectionStatus.innerHTML = '🌐 Online مباشر <button class="switch-btn">تبديل</button>';
            this.dom.connectionStatus.className = 'connection-status supabase';
        } else {
            this.dom.connectionStatus.innerHTML = '🔗 اتصال محلي <button class="switch-btn">تبديل</button>';
            this.dom.connectionStatus.className = 'connection-status local';
        }

        // إضافة مستمع للزر داخل شريط الحالة
        const switchBtn = this.dom.connectionStatus.querySelector('.switch-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => this.switchConnectionMode());
        }
    }

    // ✅ تبديل وضع الاتصال
    switchConnectionMode() {
        const currentMode = this.getConnectionMode();
        const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
        
        localStorage.setItem('connection_mode', newMode);
        sessionStorage.setItem('connection_mode', newMode);
        
        this.updateConnectionStatus();
        this._showAlert(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`, "info");
        
        // إعادة تحميل البيانات
        this._loadAllAccounts();
        this._loadTransactions();
    }

    // ✅ تهيئة Supabase
    initializeSupabase() {
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            return false;
        }
    }

    // ======================== 📥 دوال تحميل البيانات (تعمل مع كلا الوضعين) ========================

    // ✅ تحميل أنواع الحسابات
    async _loadAccountTypes() {
        const mode = this.getConnectionMode();
        console.log(`📊 جاري تحميل أنواع الحسابات - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                const { data, error } = await supabase
                    .from('account_types')
                    .select('*')
                    .order('account_type_name');

                if (error) throw error;
                
                this.state.accountTypes = data || [];
                console.log(`✅ تم تحميل ${this.state.accountTypes.length} نوع حساب من Supabase`);
            } else {
                // استخدام API التقليدي
                const response = await fetch(this.API.ACCOUNT_TYPES);
                const result = await response.json();

                if (result.success) {
                    this.state.accountTypes = result.data;
                    console.log(`✅ تم تحميل ${this.state.accountTypes.length} نوع حساب من الخادم المحلي`);
                } else {
                    throw new Error(result.message);
                }
            }
            
            this._renderAccountTypesDropdown();
            
        } catch (error) {
            console.error("❌ خطأ في تحميل أنواع الحسابات:", error);
            this._showAlert("خطأ في تحميل أنواع الحسابات", "danger");
            
            // التحول التلقائي إلى الوضع الآخر في حالة الفشل
            if (mode !== 'supabase') {
                const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'supabase');
                    this.updateConnectionStatus();
                    this._loadAccountTypes();
                }
            }
        }
    }

    // ✅ تحميل جميع الحسابات
    async _loadAllAccounts() {
        const mode = this.getConnectionMode();
        console.log(`📊 جاري تحميل الحسابات - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                const { data, error } = await supabase
                    .from('accounts')
                    .select('*')
                    .order('account_code');

                if (error) throw error;
                
                this.state.allAccounts = data || [];
                console.log(`✅ تم تحميل ${this.state.allAccounts.length} حساب من Supabase`);
            } else {
                // استخدام API التقليدي
                const response = await fetch(this.API.ACCOUNTS);
                const result = await response.json();

                if (result.success) {
                    this.state.allAccounts = result.data;
                    console.log(`✅ تم تحميل ${this.state.allAccounts.length} حساب من الخادم المحلي`);
                } else {
                    throw new Error(result.message);
                }
            }
            
        } catch (error) {
            console.error("❌ خطأ في تحميل الحسابات:", error);
            
            // التحول التلقائي إلى الوضع الآخر في حالة الفشل
            if (mode !== 'supabase') {
                const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'supabase');
                    this.updateConnectionStatus();
                    this._loadAllAccounts();
                }
            }
            
            this.state.allAccounts = [];
        }
    }

    // ✅ تحميل الحسابات النشطة
    async _loadActiveAccounts() {
        const mode = this.getConnectionMode();
        console.log(`📊 جاري تحميل الحسابات النشطة - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                const { data, error } = await supabase
                    .from('accounts')
                    .select('*')
                    .eq('is_active', true)
                    .order('account_code');

                if (error) throw error;
                
                this.state.accounts = data || [];
                console.log(`✅ تم تحميل ${this.state.accounts.length} حساب نشط من Supabase`);
            } else {
                // استخدام API التقليدي
                const response = await fetch(this.API.ACTIVE_ACCOUNTS);
                const result = await response.json();

                if (result.success) {
                    this.state.accounts = result.data;
                    console.log(`✅ تم تحميل ${this.state.accounts.length} حساب نشط من الخادم المحلي`);
                } else {
                    throw new Error(result.message);
                }
            }
            
            this._renderSearchAccountsDropdown();
            
        } catch (error) {
            console.error("❌ خطأ في تحميل الحسابات النشطة:", error);
            this._showAlert("خطأ في تحميل الحسابات", "danger");
        }
    }

    // ✅ تحميل آخر رقم قيد
    async _loadLastEntryNumber() {
        const mode = this.getConnectionMode();
        console.log(`🔢 جاري تحميل آخر رقم قيد - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                const { data, error } = await supabase
                    .from('account_transactions')
                    .select('entry_number')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                
                if (data) {
                    const lastNumber = data.entry_number;
                    const match = lastNumber.match(/(\d+)$/);
                    if (match) {
                        const nextNumber = parseInt(match[1]) + 1;
                        this.dom.entryNumber.value = `JRNL-${nextNumber.toString().padStart(4, '0')}`;
                    } else {
                        this.dom.entryNumber.value = "JRNL-0001";
                    }
                } else {
                    this.dom.entryNumber.value = "JRNL-0001";
                }
            } else {
                // استخدام API التقليدي
                const response = await fetch(this.API.LAST_ENTRY_NUMBER);
                const result = await response.json();

                if (result.success) {
                    this.dom.entryNumber.value = result.data;
                } else {
                    this.dom.entryNumber.value = "JRNL-0001";
                }
            }
        } catch (error) {
            console.error("❌ خطأ في تحميل آخر رقم قيد:", error);
            this.dom.entryNumber.value = "JRNL-0001";
        }
    }

    // ✅ تحميل الحركات
    async _loadTransactions() {
        this._setLoading(true);
        const mode = this.getConnectionMode();
        console.log(`📋 جاري تحميل الحركات - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                let query = supabase
                    .from('account_transactions')
                    .select(`
                        *,
                        accounts!inner(account_code, account_name, account_type_name)
                    `)
                    .order('transaction_date', { ascending: false })
                    .order('created_at', { ascending: false });

                // تطبيق عوامل التصفية
                if (this.state.searchFilters.start_date) {
                    query = query.gte('transaction_date', this.state.searchFilters.start_date);
                }
                if (this.state.searchFilters.end_date) {
                    query = query.lte('transaction_date', this.state.searchFilters.end_date);
                }
                if (this.state.searchFilters.account_id) {
                    query = query.eq('account_id', this.state.searchFilters.account_id);
                }
                if (this.state.searchFilters.entry_number) {
                    query = query.ilike('entry_number', `%${this.state.searchFilters.entry_number}%`);
                }

                const { data, error } = await query;

                if (error) throw error;
                
                this.state.transactions = data || [];
                console.log(`✅ تم تحميل ${this.state.transactions.length} حركة من Supabase`);
            } else {
                // استخدام API التقليدي
                const params = new URLSearchParams();
                Object.entries(this.state.searchFilters).forEach(([key, value]) => {
                    if (value) params.append(key, value);
                });

                const response = await fetch(`${this.API.TRANSACTIONS}?${params}`);
                const result = await response.json();

                if (result.success) {
                    this.state.transactions = result.data;
                    console.log(`✅ تم تحميل ${this.state.transactions.length} حركة من الخادم المحلي`);
                } else {
                    throw new Error(result.message);
                }
            }
            
            this._renderTransactionsTable();
            
        } catch (error) {
            console.error("❌ خطأ في تحميل الحركات:", error);
            this._showAlert("خطأ في الاتصال بالسيرفر", "danger");
            
            // التحول التلقائي إلى الوضع الآخر في حالة الفشل
            if (mode !== 'local') {
                const switchNow = confirm('فشل الاتصال بـ Supabase. هل تريد التبديل إلى الخادم المحلي؟');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'local');
                    this.updateConnectionStatus();
                    this._loadTransactions();
                }
            }
            
            this.state.transactions = [];
        } finally {
            this._setLoading(false);
        }
    }

    // ======================== 🎨 دوال العرض ========================

    // 🎨 عرض أنواع الحسابات في Dropdown
    _renderAccountTypesDropdown() {
        if (this.state.accountTypes.length === 0) {
            this.dom.accountType.innerHTML = '<option value="">لا توجد أنواع حسابات</option>';
            return;
        }

        this.dom.accountType.innerHTML = `
            <option value="">اختر نوع الحساب (اختياري)</option>
            ${this.state.accountTypes.map(type => `
                <option value="${this._escapeHtml(type.account_type_name)}">
                    ${this._escapeHtml(type.account_type_name)}
                </option>
            `).join('')}
        `;
    }

    // 🎨 عرض الحسابات في dropdown البحث
    _renderSearchAccountsDropdown() {
        if (this.state.accounts.length === 0) {
            if (this.dom.searchAccountId) {
                this.dom.searchAccountId.innerHTML = '<option value="">لا توجد حسابات</option>';
            }
            return;
        }

        if (this.dom.searchAccountId) {
            this.dom.searchAccountId.innerHTML = `
                <option value="">جميع الحسابات</option>
                ${this.state.accounts.map(account => `
                    <option value="${account.account_id}">
                        ${this._escapeHtml(account.account_code)} - ${this._escapeHtml(account.account_name)}
                    </option>
                `).join('')}
            `;
        }
    }

    // 🎨 عرض الحركات في الجدول
    _renderTransactionsTable() {
        const { transactions } = this.state;
        
        console.log('Rendering transactions:', transactions);

        if (transactions.length === 0) {
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <i class="fas fa-inbox me-2"></i>لا توجد حركات
                    </td>
                </tr>
            `;
            return;
        }

        let tableHTML = '';
        let currentEntry = '';
        
        transactions.forEach((transaction, index) => {
            if (transaction.entry_number !== currentEntry) {
                currentEntry = transaction.entry_number;
                tableHTML += `
                    <tr class="table-primary">
                        <td colspan="8" class="fw-bold">
                            <i class="fas fa-file-invoice me-2"></i>رقم القيد: ${this._escapeHtml(transaction.entry_number)}
                            <small class="text-muted ms-2">
                                ${new Date(transaction.transaction_date).toLocaleDateString('ar-EG')}
                            </small>
                            <button class="btn btn-sm btn-outline-danger float-start me-2" onclick="accountTransactionsApp.deleteEntry('${transaction.entry_number}')">
                                <i class="fas fa-trash me-1"></i>حذف
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            tableHTML += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${new Date(transaction.transaction_date).toLocaleDateString('ar-EG')}</td>
                    <td>${this._escapeHtml(transaction.accounts.account_code)} - ${this._escapeHtml(transaction.accounts.account_name)}</td>
                    <td>${this._escapeHtml(transaction.accounts.account_type_name)}</td>
                    <td class="text-success fw-bold">${transaction.debit_amount > 0 ? parseFloat(transaction.debit_amount).toLocaleString() : ''}</td>
                    <td class="text-danger fw-bold">${transaction.credit_amount > 0 ? parseFloat(transaction.credit_amount).toLocaleString() : ''}</td>
                    <td>${this._escapeHtml(transaction.line_description || '')}</td>
                    <td>${transaction.username || 'System'}</td>
                </tr>
            `;
        });

        this.dom.tableBody.innerHTML = tableHTML;
    }

    // 🎨 عرض بنود القيد الحالي
    _renderCurrentEntryTable() {
        const { currentEntryLines } = this.state;
        
        if (currentEntryLines.length === 0) {
            this.dom.currentEntryTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">لا توجد بنود مضافة</td>
                </tr>
            `;
            this.dom.totalDebit.textContent = '0';
            this.dom.totalCredit.textContent = '0';
            this.dom.balanceStatus.className = 'badge bg-secondary';
            this.dom.balanceStatus.textContent = 'غير متوازن';
            this.dom.saveEntryBtn.disabled = true;
            return;
        }

        const totalDebit = currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        this.dom.currentEntryTable.innerHTML = currentEntryLines.map((line, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${this._escapeHtml(line.account_name)}</td>
                <td class="text-success fw-bold">${line.debit_amount > 0 ? parseFloat(line.debit_amount).toLocaleString() : ''}</td>
                <td class="text-danger fw-bold">${line.credit_amount > 0 ? parseFloat(line.credit_amount).toLocaleString() : ''}</td>
                <td>${this._escapeHtml(line.line_description)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="accountTransactionsApp.removeLine(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.dom.totalDebit.textContent = totalDebit.toLocaleString();
        this.dom.totalCredit.textContent = totalCredit.toLocaleString();
        
        if (isBalanced && currentEntryLines.length >= 2) {
            this.dom.balanceStatus.className = 'badge bg-success';
            this.dom.balanceStatus.textContent = 'متوازن';
            this.dom.saveEntryBtn.disabled = false;
        } else {
            this.dom.balanceStatus.className = 'badge bg-danger';
            this.dom.balanceStatus.textContent = 'غير متوازن';
            this.dom.saveEntryBtn.disabled = true;
        }
    }

    // ======================== ⚙️ دوال الوظائف الرئيسية ========================

    // ➕ إضافة بند للقيد الحالي
    addLine() {
        const accountId = this.dom.accountId.value;
        const accountName = this.dom.accountSearch.value;
        
        if (!accountId || (!this.dom.debitAmount.value && !this.dom.creditAmount.value)) {
            this._showAlert("يرجى اختيار الحساب وإدخال قيمة في المدين أو الدائن", "warning");
            return;
        }

        const newLine = {
            account_id: parseInt(accountId),
            account_name: accountName,
            debit_amount: parseFloat(this.dom.debitAmount.value) || 0,
            credit_amount: parseFloat(this.dom.creditAmount.value) || 0,
            line_description: this.dom.lineDescription.value.trim() || "قيد محاسبي"
        };

        console.log('Adding line:', newLine);

        this.state.currentEntryLines.push(newLine);
        this._renderCurrentEntryTable();
        
        // الحفاظ على البيانات الحالية (تاريخ القيد، رقم القيد، نوع الحساب)
        const currentTransactionDate = this.dom.transactionDate.value;
        const currentEntryNumber = this.dom.entryNumber.value;
        const currentAccountType = this.dom.accountType.value;
        
        // مسح حقول البند فقط
        this._clearLineFields();
        
        // إعادة تعيين البيانات المحفوظة
        this.dom.transactionDate.value = currentTransactionDate;
        this.dom.entryNumber.value = currentEntryNumber;
        this.dom.accountType.value = currentAccountType;
        
        // العودة لحقل البحث عن الحساب
        this.dom.accountSearch.focus();
    }

    // 🗑️ حذف بند من القيد الحالي
    removeLine(index) {
        this.state.currentEntryLines.splice(index, 1);
        this._renderCurrentEntryTable();
    }

    // 🔍 البحث في الحسابات
    onAccountSearch(searchTerm) {
        if (!searchTerm) {
            this._hideAccountDropdown();
            return;
        }

        const filteredAccounts = this.state.allAccounts.filter(account => 
            account.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (account.account_type_name && account.account_type_name.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        this._showAccountDropdown(filteredAccounts);
    }

    // 🔄 تغيير نوع الحساب
    onAccountTypeChange(value) {
        this.state.currentAccountType = value;
    }

    // 💾 حفظ القيد المحاسبي
    async saveEntry() {
        if (this.state.currentEntryLines.length < 2) {
            this._showAlert("يجب إضافة بندين على الأقل للقيد المحاسبي", "warning");
            return;
        }

        const totalDebit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            this._showAlert(`القيد غير متوازن. المدين: ${totalDebit}, الدائن: ${totalCredit}`, "warning");
            return;
        }

        if (!this.dom.entryNumber.value.trim()) {
            this._showAlert("يرجى إدخال رقم القيد", "warning");
            this.dom.entryNumber.focus();
            return;
        }

        if (!this.dom.transactionDate.value) {
            this._showAlert("يرجى إدخال تاريخ القيد", "warning");
            this.dom.transactionDate.focus();
            return;
        }

        const mode = this.getConnectionMode();
        console.log(`💾 جاري حفظ القيد - الوضع: ${mode}`);

        this.dom.saveEntryBtn.disabled = true;
        this.dom.saveEntryBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري الحفظ...';

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                // حفظ كل حركة على حدة
                const transactions = this.state.currentEntryLines.map(line => ({
                    transaction_date: this.dom.transactionDate.value,
                    account_id: line.account_id,
                    debit_amount: line.debit_amount,
                    credit_amount: line.credit_amount,
                    entry_number: this.dom.entryNumber.value.trim(),
                    line_description: line.line_description,
                    user_id: 1
                }));

                const { error } = await supabase
                    .from('account_transactions')
                    .insert(transactions);

                if (error) throw error;

                this._showAlert("✅ تم حفظ القيد بنجاح في Supabase", "success");
            } else {
                // استخدام API التقليدي
                const transactionData = {
                    transactions: this.state.currentEntryLines.map(line => ({
                        transaction_date: this.dom.transactionDate.value,
                        account_id: line.account_id,
                        debit_amount: line.debit_amount,
                        credit_amount: line.credit_amount,
                        entry_number: this.dom.entryNumber.value.trim(),
                        line_description: line.line_description,
                        user_id: 1
                    }))
                };

                const response = await fetch(this.API.TRANSACTIONS, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(transactionData)
                });

                const result = await response.json();

                if (result.success) {
                    this._showAlert("✅ تم حفظ القيد بنجاح", "success");
                } else {
                    throw new Error(result.message);
                }
            }

            this.newEntry();
            await this._loadTransactions();

        } catch (error) {
            console.error("❌ خطأ في حفظ القيد:", error);
            this._showAlert("❌ خطأ في حفظ القيد: " + error.message, "danger");
            
            // التحول التلقائي إلى الوضع الآخر في حالة الفشل
            if (mode !== 'local') {
                const switchNow = confirm('فشل الحفظ في Supabase. هل تريد التبديل إلى الخادم المحلي؟');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'local');
                    this.updateConnectionStatus();
                    this.saveEntry();
                }
            }
        } finally {
            this.dom.saveEntryBtn.disabled = false;
            this.dom.saveEntryBtn.innerHTML = '<i class="fas fa-save me-2"></i>حفظ القيد';
        }
    }

    // 🆕 قيد جديد
    newEntry() {
        this.state.currentEntryLines = [];
        this._renderCurrentEntryTable();
        this._clearLineFields();
        this._loadLastEntryNumber();
        this.dom.transactionDate.focus();
    }

    // 🔍 البحث في الحركات
    async searchTransactions() {
        this.state.searchFilters = {
            start_date: this.dom.searchStartDate.value,
            end_date: this.dom.searchEndDate.value,
            account_id: this.dom.searchAccountId.value,
            entry_number: this.dom.searchEntryNumber.value
        };
        await this._loadTransactions();
    }

    // 🔄 إعادة تعيين البحث
    resetSearch() {
        this._setDefaultDates();
        this.dom.searchAccountId.value = "";
        this.dom.searchEntryNumber.value = "";
        this.searchTransactions();
    }

    // 🗑️ حذف قيد محاسبي
    async deleteEntry(entryNumber) {
        if (!confirm(`هل أنت متأكد من حذف القيد ${entryNumber}؟`)) {
            return;
        }

        const mode = this.getConnectionMode();
        console.log(`🗑️ جاري حذف القيد - الوضع: ${mode}`);

        try {
            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                if (!supabase) this.initializeSupabase();
                
                const { error } = await supabase
                    .from('account_transactions')
                    .delete()
                    .eq('entry_number', entryNumber);

                if (error) throw error;

                this._showAlert("✅ تم حذف القيد المحاسبي بنجاح", "success");
            } else {
                // استخدام API التقليدي
                const response = await fetch(`${this.API.TRANSACTIONS}/entry/${entryNumber}`, {
                    method: "DELETE"
                });

                const result = await response.json();

                if (result.success) {
                    this._showAlert("✅ تم حذف القيد المحاسبي بنجاح", "success");
                } else {
                    throw new Error(result.message);
                }
            }

            await this._loadTransactions();

        } catch (error) {
            console.error("❌ خطأ في حذف القيد:", error);
            this._showAlert("❌ خطأ في حذف القيد: " + error.message, "danger");
        }
    }

    // 🖨️ طباعة الحركات
    printTransactions() {
        const { transactions } = this.state;
        
        if (transactions.length === 0) {
            this._showAlert("لا توجد حركات للطباعة", "warning");
            return;
        }

        const printWindow = window.open('', '_blank');
        const printDate = new Date().toLocaleDateString('ar-EG');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>كشف الحركات المالية</title>
                <style>
                    @media print {
                        @page { size: A4; margin: 1cm; }
                        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #000; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
                        .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        .report-title { font-size: 18px; margin-bottom: 10px; }
                        .print-date { font-size: 14px; color: #666; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #000; padding: 8px; text-align: center; }
                        th { background-color: #f0f0f0; font-weight: bold; }
                        .text-success { color: #008000; }
                        .text-danger { color: #ff0000; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">شركة المحاسبة</div>
                    <div class="report-title">كشف الحركات المالية</div>
                    <div class="print-date">تاريخ الطباعة: ${printDate}</div>
                </div>
                ${this.dom.tableBody.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }

    // ======================== 🛠️ دوال مساعدة ========================

    // 🧹 مسح حقول البند فقط
    _clearLineFields() {
        this.dom.accountSearch.value = "";
        this.dom.accountId.value = "";
        this.dom.debitAmount.value = "";
        this.dom.creditAmount.value = "";
        this.dom.lineDescription.value = "";
        this._hideAccountDropdown();
    }

    // 📅 تعيين التواريخ الافتراضية
    _setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        this.dom.transactionDate.value = today;
        
        const firstDay = new Date();
        firstDay.setDate(1);
        this.dom.searchStartDate.value = firstDay.toISOString().split('T')[0];
        this.dom.searchEndDate.value = today;
        
        this.state.searchFilters.start_date = this.dom.searchStartDate.value;
        this.state.searchFilters.end_date = this.dom.searchEndDate.value;
    }

    // 🔄 تحديث حالة زر الحفظ
    _updateSaveButtonState() {
        const totalDebit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.debit_amount || 0), 0);
        const totalCredit = this.state.currentEntryLines.reduce((sum, line) => sum + parseFloat(line.credit_amount || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
        
        this.dom.saveEntryBtn.disabled = !(isBalanced && this.state.currentEntryLines.length >= 2);
    }

    // 🎨 عرض قائمة الحسابات المفلترة
    _showAccountDropdown(accounts) {
        let dropdown = document.getElementById('accountSearchDropdown');
        if (!dropdown) {
            this._createAccountDropdown();
            dropdown = document.getElementById('accountSearchDropdown');
        }

        if (accounts.length === 0) {
            dropdown.innerHTML = '<div class="dropdown-item text-muted">لا توجد نتائج</div>';
        } else {
            dropdown.innerHTML = accounts.map(account => `
                <div class="dropdown-item account-option" 
                     onclick="accountTransactionsApp.selectAccount(${account.account_id}, '${this._escapeHtml(account.account_name)}')">
                    <div class="fw-bold">${this._escapeHtml(account.account_code)} - ${this._escapeHtml(account.account_name)}</div>
                    <small class="text-muted">${this._escapeHtml(account.account_type_name)}</small>
                </div>
            `).join('');
        }
        
        dropdown.style.display = 'block';
    }

    // 🏗️ إنشاء dropdown الحسابات
    _createAccountDropdown() {
        const searchContainer = this.dom.accountSearch.parentElement;
        
        const dropdown = document.createElement('div');
        dropdown.id = 'accountSearchDropdown';
        dropdown.className = 'account-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            border-radius: 0 0 5px 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        searchContainer.style.position = 'relative';
        searchContainer.appendChild(dropdown);
    }

    // 🙈 إخفاء dropdown الحسابات
    _hideAccountDropdown() {
        const dropdown = document.getElementById('accountSearchDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    // ✅ اختيار حساب من القائمة
    selectAccount(accountId, accountName) {
        this.dom.accountSearch.value = accountName;
        this.dom.accountId.value = accountId;
        
        this._hideAccountDropdown();
        this.dom.debitAmount.focus();
    }

    // ⏳ تعيين حالة التحميل
    _setLoading(loading) {
        this.state.isLoading = loading;
        this.dom.loading.style.display = loading ? "block" : "none";
    }

    // 💬 عرض التنبيهات
    _showAlert(message, type) {
        const oldAlerts = document.querySelectorAll('.alert');
        oldAlerts.forEach(alert => alert.remove());

        const alertDiv = document.createElement("div");
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector(".container");
        container.insertBefore(alertDiv, container.firstChild);
        
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // 🛡️ حماية من XSS
    _escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// ======================== 🚀 تشغيل التطبيق ========================
let accountTransactionsApp;

document.addEventListener("DOMContentLoaded", function() {
    accountTransactionsApp = new AccountTransactionsApp();
    window.accountTransactionsApp = accountTransactionsApp;
});