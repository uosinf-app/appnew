// account.js - Frontend for Accounts Management with Hybrid System
class AccountsApp {
  constructor() {
    this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
    
    this.supabase = null;
    this.state = {
      accounts: [],
      accountTypes: [],
      parentAccounts: [],
      childAccounts: [],
      suppliersCustomers: [],
      currentEditId: null,
      isLoading: false,
      selectedParentId: null
    };
    this.dom = this._initDOM();
    this.supabase = this._initSupabase();
    this._bindGlobalMethods();
    this.init();
  }

  // ======================== 🔌 تهيئة Supabase ========================
  _initSupabase() {
    try {
      if (typeof supabaseUrl !== 'undefined' && typeof supabaseKey !== 'undefined') {
        return supabase.createClient(supabaseUrl, supabaseKey);
      } else {
        return supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      return null;
    }
  }

  // ======================== 🏗️ تهيئة DOM ========================
  _initDOM() {
    const dom = {
      tableBody: document.getElementById("tableBody"),
      loading: document.getElementById("loading"),
      accountForm: document.getElementById("accountForm"),
      accountId: document.getElementById("accountId"),
      accountCode: document.getElementById("accountCode"),
      accountName: document.getElementById("accountName"),
      accountTypeId: document.getElementById("accountTypeId"),
      parentAccountId: document.getElementById("parentAccountId"),
      balance: document.getElementById("balance"),
      isActive: document.getElementById("isActive"),
      modalTitle: document.getElementById("modalTitle"),
      accountModal: document.getElementById("accountModal"),
      accountCodeDropdown: document.getElementById("accountCodeDropdown"),
      connectionStatus: document.getElementById("connectionStatus")
    };

    // ✅ إضافة شريط حالة الاتصال ديناميكياً إذا لم يكن موجوداً
    if (!dom.connectionStatus) {
      const connectionStatus = document.createElement('div');
      connectionStatus.id = 'connectionStatus';
      connectionStatus.className = 'connection-status';
      connectionStatus.innerHTML = '🔄 جاري التحميل...';
      document.body.appendChild(connectionStatus);
      dom.connectionStatus = connectionStatus;
    }

    return dom;
  }

  // ======================== 🔗 ربط الدوال العامة ========================
  _bindGlobalMethods() {
    window.openAddModal = () => this._openAddModal();
    window.saveAccount = () => this._saveAccount();
    window.editAccount = (id) => this._editAccount(id);
    window.deleteAccount = (id) => this._deleteAccount(id);
    window.loadChildAccounts = (parentId) => this._loadChildAccounts(parentId);
    window.accountsApp = this;
  }

  // ======================== ✅ الحصول على وضع الاتصال الحالي ========================
  getConnectionMode() {
    return localStorage.getItem('connection_mode') || 
           sessionStorage.getItem('connection_mode') || 
           'auto';
  }

  // ======================== ✅ تحديث شريط حالة الاتصال ========================
  updateConnectionStatus() {
    const statusDiv = this.dom.connectionStatus;
    if (!statusDiv) {
      console.warn('❌ connectionStatus element not found');
      return;
    }
    
    const mode = this.getConnectionMode();
    
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
      statusDiv.innerHTML = '🌐 Supabase مباشر <button class="switch-btn" onclick="accountsApp.switchConnectionMode()">تبديل</button>';
      statusDiv.className = 'connection-status supabase';
    } else {
      statusDiv.innerHTML = '🔗 اتصال محلي <button class="switch-btn" onclick="accountsApp.switchConnectionMode()">تبديل</button>';
      statusDiv.className = 'connection-status local';
    }
  }

  // ======================== ✅ تبديل وضع الاتصال ========================
  switchConnectionMode() {
    const currentMode = this.getConnectionMode();
    const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
    
    localStorage.setItem('connection_mode', newMode);
    sessionStorage.setItem('connection_mode', newMode);
    
    this.updateConnectionStatus();
    this._showAlert(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`, 'success');
    
    // إعادة تحميل البيانات
    this._loadAccounts();
    this._loadAccountTypes();
    this._loadParentAccounts();
  }

  // ======================== 🚀 تهيئة التطبيق ========================
  async init() {
    this.updateConnectionStatus();
    await this._loadAccountTypes();
    await this._loadParentAccounts();
    await this._loadAccounts();
    this._setupEventListeners();
    this._showAlert('✅ تم تهيئة نظام الحسابات', 'success');
  }

  // ======================== 🎯 إعداد مستمعي الأحداث ========================
  _setupEventListeners() {
    this.dom.accountModal.addEventListener('hidden.bs.modal', () => {
      this._resetForm();
    });

    this.dom.parentAccountId.addEventListener('change', (e) => {
      this._loadChildAccounts(e.target.value);
    });

    // البحث أثناء الكتابة
    this.dom.accountCode.addEventListener('input', (e) => {
      this._handleAccountCodeSearch(e.target.value);
    });

    // النقر على عنصر من القائمة
    this.dom.accountCodeDropdown.addEventListener('click', (e) => {
      e.preventDefault();
      this._handleAccountCodeSelection(e.target);
    });

    // التنقل باستخدام Enter
    this.dom.accountCode.addEventListener('keydown', (e) => {
      this._handleKeyNavigation(e);
    });

    // إخفاء ال dropdown عند النقر خارجها
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        this._hideDropdown();
      }
    });
  }

  // ======================== 📥 تحميل الحسابات ========================
  async _loadAccounts() {
    this._setLoading(true);
    
    try {
      const mode = this.getConnectionMode();
      let accounts = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب الحسابات من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('accounts')
          .select(`
            *,
            account_types(account_type_name),
            parent_account:parent_account_id(account_name)
          `)
          .order('account_id');
        
        if (error) throw error;
        
        accounts = data.map(account => ({
          ...account,
          account_type_name: account.account_types?.account_type_name,
          parent_account_name: account.parent_account?.account_name
        }));
        
        console.log(`✅ تم تحميل ${accounts.length} حساب من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.get('ACCOUNTS');
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          accounts = result.data || [];
        } else {
          throw new Error(result.message || 'خطأ في تحميل الحسابات');
        }
        
        console.log(`✅ تم تحميل ${accounts.length} حساب من الخادم المحلي`);
      }

      this.state.accounts = accounts;
      this._renderTable();
      
    } catch (error) {
      console.error("❌ Error loading accounts:", error);
      this._showAlert("خطأ في تحميل الحسابات", "danger");
      
      // التحول التلقائي إلى Supabase في حالة الفشل
      if (this.getConnectionMode() !== 'supabase') {
        const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
        if (switchNow) {
          localStorage.setItem('connection_mode', 'supabase');
          this._loadAccounts();
        }
      }
    } finally {
      this._setLoading(false);
    }
  }

  // ======================== 📥 تحميل أنواع الحسابات ========================
  async _loadAccountTypes() {
    try {
      const mode = this.getConnectionMode();
      let accountTypes = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب أنواع الحسابات من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('account_types')
          .select('*')
          .order('account_type_id');
        
        if (error) throw error;
        
        accountTypes = data || [];
        console.log(`✅ تم تحميل ${accountTypes.length} نوع حساب من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.get('ACCOUNT_TYPES');
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          accountTypes = result.data || [];
        } else {
          throw new Error(result.message || 'خطأ في تحميل أنواع الحسابات');
        }
        
        console.log(`✅ تم تحميل ${accountTypes.length} نوع حساب من الخادم المحلي`);
      }

      this.state.accountTypes = accountTypes;
      this._renderAccountTypesDropdown();
      
    } catch (error) {
      console.error("❌ Error loading account types:", error);
      this._showAlert("خطأ في تحميل أنواع الحسابات", "danger");
    }
  }

  // ======================== 📥 تحميل الحسابات الرئيسية ========================
  async _loadParentAccounts() {
    try {
      const mode = this.getConnectionMode();
      let parentAccounts = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب الحسابات الرئيسية من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('accounts')
          .select('account_id, account_code, account_name')
          .is('parent_account_id', null)
          .order('account_code');
        
        if (error) throw error;
        
        parentAccounts = data || [];
        console.log(`✅ تم تحميل ${parentAccounts.length} حساب رئيسي من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.getComplex('ACCOUNTS', 'PARENT_ACCOUNTS');
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          parentAccounts = result.data || [];
        } else {
          throw new Error(result.message || 'خطأ في تحميل الحسابات الرئيسية');
        }
        
        console.log(`✅ تم تحميل ${parentAccounts.length} حساب رئيسي من الخادم المحلي`);
      }

      this.state.parentAccounts = parentAccounts;
      this._renderParentAccountsDropdown();
      
    } catch (error) {
      console.error("❌ Error loading parent accounts:", error);
      this._showAlert("خطأ في تحميل الحسابات الرئيسية", "danger");
    }
  }

  // ======================== 📥 تحميل الحسابات الفرعية ========================
  async _loadChildAccounts(parentId) {
    if (!parentId) {
      this.state.childAccounts = [];
      return;
    }

    try {
      const mode = this.getConnectionMode();

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        const { data, error } = await this.supabase
          .from('accounts')
          .select('account_id, account_code, account_name')
          .eq('parent_account_id', parentId)
          .order('account_code');
        
        if (error) throw error;
        
        this.state.childAccounts = data || [];
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.getComplex('ACCOUNTS', 'CHILD_ACCOUNTS');
        const response = await fetch(`${apiUrl}/${parentId}`);
        const result = await response.json();

        if (result.success) {
          this.state.childAccounts = result.data || [];
        }
      }
    } catch (error) {
      console.error("❌ Error loading child accounts:", error);
    }
  }

  // ======================== 📥 تحميل الموردين والعملاء للبحث ========================
  async _loadSuppliersCustomers(searchTerm = '') {
    try {
      const mode = this.getConnectionMode();
      let suppliersCustomers = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase - افترض أن لديك جدول suppliers_customers
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }

        let query = this.supabase
          .from('suppliers_customers')
          .select('*')
          .or(`code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
          .limit(10);

        const { data, error } = await query;
        
        if (error) throw error;
        
        suppliersCustomers = data || [];
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.getComplex('ACCOUNTS', 'SUPPLIERS_CUSTOMERS');
        const url = searchTerm ? 
          `${apiUrl}?search=${encodeURIComponent(searchTerm)}` : 
          apiUrl;
        
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          suppliersCustomers = result.data || [];
        }
      }

      this.state.suppliersCustomers = suppliersCustomers;
      this._renderSuppliersCustomersDropdown();
      
    } catch (error) {
      console.error("❌ Error loading suppliers and customers:", error);
    }
  }

  // ======================== 🎨 عرض أنواع الحسابات في Dropdown ========================
  _renderAccountTypesDropdown() {
    this.dom.accountTypeId.innerHTML = `
      <option value="">اختر نوع الحساب</option>
      ${this.state.accountTypes.map(type => `
        <option value="${type.account_type_id}">${this._escapeHtml(type.account_type_name)}</option>
      `).join('')}
    `;
  }

  // ======================== 🎨 عرض الحسابات الرئيسية في Dropdown ========================
  _renderParentAccountsDropdown() {
    this.dom.parentAccountId.innerHTML = `
      <option value="">لا يوجد (حساب رئيسي)</option>
      ${this.state.parentAccounts.map(account => `
        <option value="${account.account_id}">${this._escapeHtml(account.account_code)} - ${this._escapeHtml(account.account_name)}</option>
      `).join('')}
    `;
  }

  // ======================== 🎨 عرض الموردين والعملاء في Dropdown ========================
  _renderSuppliersCustomersDropdown() {
    const { suppliersCustomers } = this.state;
    
    let dropdownHTML = '';
    
    if (suppliersCustomers.length === 0) {
      dropdownHTML = '<div class="dropdown-item text-muted">لا توجد نتائج</div>';
    } else {
      dropdownHTML = suppliersCustomers.map(item => `
        <a class="dropdown-item" href="#" data-code="${this._escapeHtml(item.code)}" data-name="${this._escapeHtml(item.name)}" data-type="${item.type}">
          <div class="d-flex justify-content-between align-items-center">
            <span><strong>${this._escapeHtml(item.code)}</strong> - ${this._escapeHtml(item.name)}</span>
            <span class="badge ${item.type === 'supplier' ? 'bg-warning' : 'bg-info'}">
              ${item.type === 'supplier' ? 'مورد' : 'عميل'}
            </span>
          </div>
        </a>
      `).join('');
    }
    
    this.dom.accountCodeDropdown.innerHTML = dropdownHTML;
  }

  // ======================== 🎨 عرض البيانات في الجدول ========================
  _renderTable() {
    const { accounts } = this.state;
    
    if (accounts.length === 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted">
            <i class="fas fa-inbox me-2"></i>لا توجد بيانات
          </td>
        </tr>
      `;
      return;
    }

    this.dom.tableBody.innerHTML = accounts.map((account, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${this._escapeHtml(account.account_code)}</td>
        <td>${this._escapeHtml(account.account_name)}</td>
        <td>${this._escapeHtml(account.account_type_name || '')}</td>
        <td>${account.parent_account_name ? this._escapeHtml(account.parent_account_name) : '<span class="text-muted">---</span>'}</td>
        <td>${(account.balance || 0).toLocaleString()}</td>
        <td>
          <span class="badge ${account.is_active ? 'bg-success' : 'bg-danger'}">
            ${account.is_active ? 'نشط' : 'غير نشط'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editAccount(${account.account_id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteAccount(${account.account_id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // ======================== 🔍 معالجة البحث أثناء الكتابة ========================
  _handleAccountCodeSearch(searchTerm) {
    clearTimeout(this.searchTimeout);
    
    this.searchTimeout = setTimeout(() => {
      this._loadSuppliersCustomers(searchTerm);
      
      // إظهار ال dropdown إذا كان هناك نص
      if (searchTerm.trim() !== '') {
        this._showDropdown();
      } else {
        this._hideDropdown();
      }
    }, 300);
  }

  // ======================== 🎯 معالجة اختيار عنصر من القائمة ========================
  _handleAccountCodeSelection(target) {
    const dropdownItem = target.closest('.dropdown-item');
    if (!dropdownItem) return;

    const code = dropdownItem.getAttribute('data-code');
    const name = dropdownItem.getAttribute('data-name');
    const type = dropdownItem.getAttribute('data-type');

    // تعبئة الحقول تلقائياً
    this.dom.accountCode.value = code;
    this.dom.accountName.value = name;

    // إخفاء ال dropdown
    this._hideDropdown();

    // إضافة فئة للتمييز بناءً على النوع
    this.dom.accountCode.classList.remove('is-supplier', 'is-customer');
    this.dom.accountCode.classList.add(`is-${type}`);

    // الانتقال تلقائياً للحقل التالي
    this.dom.accountName.focus();
  }

  // ======================== ⌨️ معالجة التنقل باستخدام لوحة المفاتيح ========================
  _handleKeyNavigation(e) {
    const items = this.dom.accountCodeDropdown.querySelectorAll('.dropdown-item');
    
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (items.length > 0) {
        // إذا كان هناك عناصر في القائمة، اختر الأول
        this._handleAccountCodeSelection(items[0]);
      } else {
        // إذا لم يكن هناك عناصر، انتقل للحقل التالي
        this.dom.accountName.focus();
      }
    }
    
    if (e.key === 'ArrowDown' && items.length > 0) {
      e.preventDefault();
      items[0].focus();
    }
  }

  // ======================== 👁️ إظهار ال dropdown ========================
  _showDropdown() {
    this.dom.accountCodeDropdown.style.display = 'block';
  }

  // ======================== 🙈 إخفاء ال dropdown ========================
  _hideDropdown() {
    this.dom.accountCodeDropdown.style.display = 'none';
  }

  // ======================== ➕ فتح مودال الإضافة ========================
  _openAddModal() {
    this.state.currentEditId = null;
    this.dom.modalTitle.textContent = "إضافة حساب جديد";
    this.dom.accountId.value = "";
    this.dom.accountCode.value = "";
    this.dom.accountName.value = "";
    this.dom.accountTypeId.value = "";
    this.dom.parentAccountId.value = "";
    this.dom.balance.value = "0";
    this.dom.isActive.checked = true;
    this.dom.accountForm.classList.remove("was-validated");
    
    // إزالة فئات التمييز
    this.dom.accountCode.classList.remove('is-supplier', 'is-customer');
    
    const modal = new bootstrap.Modal(this.dom.accountModal);
    modal.show();
    
    // التركيز على حقل البحث عند فتح المودال
    setTimeout(() => {
      this.dom.accountCode.focus();
    }, 500);
  }

  // ======================== ✏️ فتح مودال التعديل ========================
  async _editAccount(id) {
    try {
      const mode = this.getConnectionMode();
      let account;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        const { data, error } = await this.supabase
          .from('accounts')
          .select(`
            *,
            account_types(account_type_name),
            parent_account:parent_account_id(account_name)
          `)
          .eq('account_id', id)
          .single();
        
        if (error) throw error;
        
        account = {
          ...data,
          account_type_name: data.account_types?.account_type_name,
          parent_account_name: data.parent_account?.account_name
        };
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.get('ACCOUNTS');
        const response = await fetch(`${apiUrl}/${id}`);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message);
        }
        
        account = result.data;
      }

      this.state.currentEditId = id;
      
      this.dom.modalTitle.textContent = "تعديل الحساب";
      this.dom.accountId.value = account.account_id;
      this.dom.accountCode.value = account.account_code;
      this.dom.accountName.value = account.account_name;
      this.dom.accountTypeId.value = account.account_type_id;
      this.dom.parentAccountId.value = account.parent_account_id || "";
      this.dom.balance.value = account.balance || 0;
      this.dom.isActive.checked = account.is_active;
      this.dom.accountForm.classList.remove("was-validated");
      
      // إزالة فئات التمييز في حالة التعديل
      this.dom.accountCode.classList.remove('is-supplier', 'is-customer');
      
      const modal = new bootstrap.Modal(this.dom.accountModal);
      modal.show();
      
    } catch (error) {
      console.error("❌ Error editing account:", error);
      this._showAlert("خطأ في تحميل بيانات الحساب", "danger");
    }
  }

  // ======================== 💾 حفظ الحساب ========================
  async _saveAccount() {
    const form = this.dom.accountForm;
    
    form.classList.add("was-validated");
    
    if (!form.checkValidity()) {
      return;
    }
    
    const accountData = {
      account_code: this.dom.accountCode.value.trim(),
      account_name: this.dom.accountName.value.trim(),
      account_type_id: parseInt(this.dom.accountTypeId.value),
      parent_account_id: this.dom.parentAccountId.value ? parseInt(this.dom.parentAccountId.value) : null,
      balance: parseFloat(this.dom.balance.value) || 0,
      is_active: this.dom.isActive.checked
    };
    
    try {
      const mode = this.getConnectionMode();
      let result;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }

        if (this.state.currentEditId) {
          // تعديل
          const { data, error } = await this.supabase
            .from('accounts')
            .update(accountData)
            .eq('account_id', this.state.currentEditId)
            .select();

          if (error) throw error;
          result = { success: true, data: data[0] };
        } else {
          // إضافة
          const { data, error } = await this.supabase
            .from('accounts')
            .insert([accountData])
            .select();

          if (error) throw error;
          result = { success: true, data: data[0] };
        }
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.get('ACCOUNTS');
        let response;
        
        if (this.state.currentEditId) {
          // تعديل
          response = await fetch(`${apiUrl}/${this.state.currentEditId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(accountData)
          });
        } else {
          // إضافة
          response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(accountData)
          });
        }
        
        result = await response.json();
      }
      
      if (result.success) {
        this._showAlert(
          this.state.currentEditId ? "تم تعديل الحساب بنجاح" : "تم إضافة الحساب بنجاح",
          "success"
        );
        
        // إغلاق المودال وإعادة تحميل البيانات
        const modal = bootstrap.Modal.getInstance(this.dom.accountModal);
        modal.hide();
        await this._loadAccounts();
        await this._loadParentAccounts(); // إعادة تحميل القوائم المنسدلة
      } else {
        this._showAlert(result.message, "danger");
      }
    } catch (error) {
      console.error("❌ Error saving account:", error);
      this._showAlert("خطأ في حفظ الحساب", "danger");
    }
  }

  // ======================== 🗑️ حذف الحساب ========================
  async _deleteAccount(id) {
    if (!confirm("هل أنت متأكد من حذف هذا الحساب؟")) {
      return;
    }
    
    try {
      const mode = this.getConnectionMode();
      let result;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }

        const { error } = await this.supabase
          .from('accounts')
          .delete()
          .eq('account_id', id);

        if (error) throw error;
        result = { success: true };
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig.get('ACCOUNTS');
        const response = await fetch(`${apiUrl}/${id}`, {
          method: "DELETE"
        });
        
        result = await response.json();
      }
      
      if (result.success) {
        this._showAlert("تم حذف الحساب بنجاح", "success");
        await this._loadAccounts();
        await this._loadParentAccounts(); // إعادة تحميل القوائم المنسدلة
      } else {
        this._showAlert(result.message, "danger");
      }
    } catch (error) {
      console.error("❌ Error deleting account:", error);
      this._showAlert("خطأ في حذف الحساب", "danger");
    }
  }

  // ======================== 🔄 إعادة تعيين النموذج ========================
  _resetForm() {
    this.state.currentEditId = null;
    this.dom.accountForm.classList.remove("was-validated");
    this._hideDropdown();
  }

  // ======================== ⏳ تعيين حالة التحميل ========================
  _setLoading(loading) {
    this.state.isLoading = loading;
    this.dom.loading.style.display = loading ? "block" : "none";
  }

  // ======================== 💬 عرض التنبيهات ========================
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
    if (container) {
      container.insertBefore(alertDiv, container.firstChild);
    }
    
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 5000);
  }

  // ======================== 🛡️ حماية من XSS ========================
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
let accountsApp;
document.addEventListener("DOMContentLoaded", function() {
  accountsApp = new AccountsApp();
});