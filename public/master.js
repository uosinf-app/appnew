// ⚡ التهيئة العالمية
const SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

let supabase;
let allData = [];
let currentPage = 1;
let itemsPerPage = 20;

class MasterManager {
  constructor() {
    // cache عناصر DOM
    this.cache();
    // state متغيرة
    this.currentUnitsPerPackage = 1;
    this.currentUnitType = 'piece';
    this.currentItemName = '';
    this.editKey = null;

    // bind & init
    this.bindMethods();
    this.init();
  }

  // ✅ الحصول على وضع الاتصال الحالي
  getConnectionMode() {
    return localStorage.getItem('connection_mode') || 
           sessionStorage.getItem('connection_mode') || 
           'auto';
  }

  // ✅ تحديث شريط حالة الاتصال
  updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    
    const mode = this.getConnectionMode();
    
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
      statusDiv.innerHTML = `🌐 Supabase مباشر - ${allData.length} سجل <button class="switch-btn" onclick="master.switchConnectionMode()">تبديل</button>`;
      statusDiv.className = 'connection-status supabase';
    } else {
      statusDiv.innerHTML = `🔗 اتصال محلي - ${allData.length} سجل <button class="switch-btn" onclick="master.switchConnectionMode()">تبديل</button>`;
      statusDiv.className = 'connection-status local';
    }
  }

  // ✅ تبديل وضع الاتصال
  switchConnectionMode() {
    const currentMode = this.getConnectionMode();
    const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
    
    localStorage.setItem('connection_mode', newMode);
    sessionStorage.setItem('connection_mode', newMode);
    
    this.updateConnectionStatus();
    this.showToast(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`);
    
    // إعادة تحميل البيانات
    this.loadData();
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

  cache() {
    // عناصر أساسية
    this.form = document.getElementById('masterForm');
    this.tbody = document.querySelector('#masterTable tbody');
    this.toast = document.getElementById('toast');
    this.importBtn = document.getElementById('importBtn');
    this.importInput = document.getElementById('importInput');
    this.exportBtn = document.getElementById('exportBtn');
    this.searchBox = document.getElementById('searchBox');
    this.itemsCount = document.getElementById('itemsCount');
    this.storeSelect = document.getElementById('store_id');
    this.supplierSelect = document.getElementById('supplierid');
    this.itemIdInput = document.getElementById('item_id');
    this.itemNameInput = document.getElementById('item_nm');
    
    // باقي العناصر...
    this.unitsPerPackageEl = document.getElementById('units_per_package');
    this.unitTypeEl = document.getElementById('unit_type');
    this.saleUnitEl = document.getElementById('sale_unit');
    this.convFactorEl = document.getElementById('conversion_factor');
    this.itemQtyPiece = document.getElementById('item_qty_piece');
    this.itemQtyPackage = document.getElementById('item_qty_package');
    this.itemQty = document.getElementById('item_qty');
    this.buyPricePiece = document.getElementById('buy_price_piece');
    this.buyPricePackage = document.getElementById('buy_price_package');
    this.buyPrice = document.getElementById('buy_price');
    this.totalPrice = document.getElementById('total_price');
    this.rate = document.getElementById('rate');
    this.salePrice1Piece = document.getElementById('sale_price1_piece');
    this.salePrice1Package = document.getElementById('sale_price1_package');
    this.salePrice1 = document.getElementById('sale_price1');
    this.salePrice2 = document.getElementById('sale_price2');
    this.salePrice3 = document.getElementById('sale_price3');
    this.convertFromQty = document.getElementById('convert_from_qty');
    this.convertFromUnit = document.getElementById('convert_from_unit');
    this.convertToQty = document.getElementById('convert_to_qty');
    this.convertToUnit = document.getElementById('convert_to_unit');
    this.conversionResult = document.getElementById('conversion_result');
    this.tranDate = document.getElementById('tran_date');
    this.supplierId = document.getElementById('supplierid');
    this.mndop = document.getElementById('mndop');
    this.buyPriceField = document.getElementById('buy_price');
    this.saveBtn = document.getElementById('saveBtn');
    this.itemStatus = document.getElementById('itemStatus');
    this.searchBtn = document.getElementById('searchBtn');
    this.showAllBtn = document.getElementById('showAllBtn');
    this.lowStockBtn = document.getElementById('lowStockBtn');
    this.pageSizeSelector = document.getElementById('pageSizeSelector');
  }

  bindMethods() {
    // استخدام arrow functions أو bind للدوال التي تستخدم this
    this.showToast = this.showToast.bind(this);
    this.setDateNow = this.setDateNow.bind(this);
    this.formatDateForInput = this.formatDateForInput.bind(this);
    this.formatDateForServer = this.formatDateForServer.bind(this);
    this.calc = this.calc.bind(this);
    this.updateUnitDisplays = this.updateUnitDisplays.bind(this);
    this.calculateQuantities = this.calculateQuantities.bind(this);
    this.calculatePrices = this.calculatePrices.bind(this);
    this.calculatePricesForSaleUnit = this.calculatePricesForSaleUnit.bind(this);
    this.convertUnits = this.convertUnits.bind(this);
    this.loadOptions = this.loadOptions.bind(this);
    this.loadData = this.loadData.bind(this);
    this.searchItems = this.searchItems.bind(this);
    this.loadLowStockAlerts = this.loadLowStockAlerts.bind(this);
    this.render = this.render.bind(this);
    this.fillFormWithItemData = this.fillFormWithItemData.bind(this);
    this.clearForm = this.clearForm.bind(this);
    this.saveHandler = this.saveHandler.bind(this);
    this.editRow = this.editRow.bind(this);
    this.delRow = this.delRow.bind(this);
    this.handleImport = this.handleImport.bind(this);
    this.handleExport = this.handleExport.bind(this);
    this.setupEnterNavigation = this.setupEnterNavigation.bind(this);
    this.updateQuantityFields = this.updateQuantityFields.bind(this);
    this.updatePriceFields = this.updatePriceFields.bind(this);
    this.switchConnectionMode = this.switchConnectionMode.bind(this);
    this.attachItemBlur = this.attachItemBlur.bind(this);
    this.loadItemData = this.loadItemData.bind(this);
    this.showItemStatus = this.showItemStatus.bind(this);
  }

  // --- مساعدات صغيرة ---
  showToast(msg, time = 2000) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.style.display = 'block';
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => (this.toast.style.display = 'none'), time);
  }

  setDateNow() {
    const n = new Date();
    this.tranDate.value = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  formatDateForInput(dateString) {
    if (!dateString) return '';
    return dateString.replace(/\//g, '-');
  }

  formatDateForServer(dateString) {
    if (!dateString) return '';
    return dateString.replace(/-/g, '/');
  }

  // --- حسابات عامة ---
  calc() {
    const q = +this.itemQty.value || 0;
    const p = +this.buyPriceField.value || 0;
    const r = +this.rate.value || 0;
    const t = +(q * p).toFixed(2);
    this.totalPrice.value = isNaN(t) ? '' : t;
    if (r > 0 && p > 0) {
      const s = +(p + (p * r) / 100).toFixed(2);
      this.salePrice1.value = s;
      if (this.currentUnitType === 'package' && this.currentUnitsPerPackage > 0) {
        this.salePrice1Package.value = (s * this.currentUnitsPerPackage).toFixed(2);
      }
    }
  }

  // --- تحميل الخيارات للمخازن والموردين ---
  async loadOptions() {
    try {
      const mode = this.getConnectionMode();
      
      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        const [stores, suppliers] = await Promise.all([
          supabase.from('stores').select('*').then(({ data, error }) => {
            if (error) {
              console.error('Error loading stores:', error);
              return [];
            }
            return data || [];
          }),
          supabase.from('suppliers').select('*').then(({ data, error }) => {
            if (error) {
              console.error('Error loading suppliers:', error);
              return [];
            }
            return data || [];
          })
        ]);
        
        this.storeSelect.innerHTML = stores.map(s => 
          `<option value="${s.store_id}">${s.store_name || s.name || s.store_id}</option>`
        ).join('');
        
        this.supplierSelect.innerHTML = '<option value="">--اختر--</option>' + 
          suppliers.map(s => 
            `<option value="${s.supplierid}">${s.supplier_name || s.name || s.supplierid}</option>`
          ).join('');
          
      } else {
        // استخدام API التقليدي
        const storeApi = appConfig?.get('STORES') || 'http://localhost:3000/api/stores';
        const suppliersApi = appConfig?.get('SUPPLIERS') || 'http://localhost:3000/api/suppliers';
        
        const [stores, suppliers] = await Promise.all([
          fetch(storeApi).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch(suppliersApi).then(r => r.ok ? r.json() : []).catch(() => [])
        ]);
        
        this.storeSelect.innerHTML = stores.map(s => 
          `<option value="${s.store_id}">${s.store_name || s.name || s.store_id}</option>`
        ).join('');
        
        this.supplierSelect.innerHTML = '<option value="">--اختر--</option>' + 
          suppliers.map(s => 
            `<option value="${s.supplierid}">${s.supplier_name || s.name || s.supplierid}</option>`
          ).join('');
      }
    } catch (err) {
      console.error('loadOptions err', err);
    }
  }

  // --- تحميل البيانات (تعمل مع كلا الوضعين) ---
  async loadData() {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
      statusDiv.innerHTML = '🔄 جاري تحميل البيانات... <span class="loading"></span>';
    }
    
    try {
      const mode = this.getConnectionMode();
      console.log(`🔄 جاري تحميل البيانات - الوضع: ${mode}`);

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        // 🆕 إصلاح: استخدام عمود موجود للترتيب بدلاً من created_at
        const { data, error } = await supabase
          .from('a_master')
          .select('*')
          .order('tran_date', { ascending: false });
        
        if (error) {
          console.error('Supabase load error:', error);
          // 🆕 محاولة بدون ترتيب إذا فشلت
          const { data: data2, error: error2 } = await supabase
            .from('a_master')
            .select('*');
          
          if (error2) throw error2;
          allData = data2 || [];
        } else {
          allData = data || [];
        }
        
        console.log(`✅ تم تحميل ${allData.length} سجل من Supabase`);
        
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`خطأ في الخادم: ${res.status}`);
        
        allData = await res.json();
        console.log(`✅ تم تحميل ${allData.length} سجل من الخادم المحلي`);
      }
      
      this.render();
      this.updateConnectionStatus();
      
    } catch (err) {
      console.error("❌ خطأ في تحميل البيانات:", err);
      const statusDiv = document.getElementById('connectionStatus');
      if (statusDiv) {
        statusDiv.innerHTML = '❌ فشل تحميل البيانات <button class="switch-btn" onclick="master.switchConnectionMode()">تبديل</button>';
      }
      
      // التحول التلقائي إلى Supabase في حالة الفشل
      if (this.getConnectionMode() !== 'supabase') {
        const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
        if (switchNow) {
          localStorage.setItem('connection_mode', 'supabase');
          this.loadData();
          return;
        }
      }
      
      allData = [];
      this.render();
      this.updateConnectionStatus();
    }
  }

  // --- تحميل اسم الصنف ووحداته عند blur ---
  attachItemBlur() {
    if (!this.itemIdInput) return;
    
    this.itemIdInput.addEventListener('blur', async () => {
      const itemId = this.itemIdInput.value.trim();
      if (!itemId) return;
      
      try {
        const mode = this.getConnectionMode();
        
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
          // استخدام Supabase
          if (!supabase) this.initializeSupabase();
          
          const { data: itemData, error } = await supabase
            .from('items')
            .select('*')
            .eq('item_id', itemId)
            .single();
            
          if (!error && itemData) {
            this.itemNameInput.value = itemData.item_nm || '';
            this.currentItemName = itemData.item_nm || '';
          } else {
            this.itemNameInput.value = '';
            this.currentItemName = '';
          }
        } else {
          // استخدام API التقليدي
          const itemsApi = appConfig?.get('ITEMS') || 'http://localhost:3000/api/items';
          const itemRes = await fetch(`${itemsApi}/${itemId}`);
          if (itemRes.ok) {
            const itemData = await itemRes.json();
            this.itemNameInput.value = itemData.item_nm || '';
            this.currentItemName = itemData.item_nm || '';
          } else {
            this.itemNameInput.value = '';
            this.currentItemName = '';
          }
        }
      } catch (err) {
        console.error('خطأ في جلب بيانات الصنف:', err);
      }
    });
  }

  // --- تحميل بيانات الصنف من a_master إن وجد ---
  async loadItemData() {
    const itemId = this.itemIdInput.value.trim();
    const storeId = this.storeSelect.value;
    if (!itemId) return this.showItemStatus('⚠️ يرجى إدخال كود الصنف', 'warning');

    try {
      const mode = this.getConnectionMode();
      
      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        // جلب اسم الصنف
        const { data: itemData, error: itemError } = await supabase
          .from('items')
          .select('item_nm')
          .eq('item_id', itemId)
          .single();
          
        if (!itemError && itemData) {
          this.itemNameInput.value = itemData.item_nm || '';
          this.currentItemName = itemData.item_nm || '';
          this.showItemStatus('✅ تم تحميل اسم الصنف', 'success');
        } else {
          this.itemNameInput.value = '';
          this.currentItemName = '';
          this.showItemStatus('❌ الصنف غير موجود في جدول الأصناف', 'error');
        }

        if (storeId) {
          // جلب بيانات المخزون
          const { data: masterData, error: masterError } = await supabase
            .from('a_master')
            .select('*')
            .eq('store_id', storeId)
            .eq('item_id', itemId)
            .single();
            
          if (!masterError && masterData) {
            this.fillFormWithItemData(masterData);
            this.showItemStatus('✅ الصنف موجود في الفروع - يمكنك التحديث', 'success');
          } else {
            this.showItemStatus('📝 الصنف جديد على المخزن - يمكنك إضافته', 'warning');
          }
        }
        
      } else {
        // استخدام API التقليدي
        const itemsApi = appConfig?.get('ITEMS') || 'http://localhost:3000/api/items';
        const masterApi = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        
        const itemRes = await fetch(`${itemsApi}/${itemId}`);
        if (itemRes.ok) {
          const itemData = await itemRes.json();
          this.itemNameInput.value = itemData.item_nm || '';
          this.currentItemName = itemData.item_nm || '';
          this.showItemStatus('✅ تم تحميل اسم الصنف', 'success');
        } else {
          this.itemNameInput.value = '';
          this.currentItemName = '';
          this.showItemStatus('❌ الصنف غير موجود في جدول الأصناف', 'error');
        }

        if (storeId) {
          const masterRes = await fetch(`${masterApi}/${storeId}_${itemId}`);
          if (masterRes.ok) {
            const masterData = await masterRes.json();
            this.fillFormWithItemData(masterData);
            this.showItemStatus('✅ الصنف موجود في الفروع - يمكنك التحديث', 'success');
          } else {
            this.showItemStatus('📝 الصنف جديد على المخزن - يمكنك إضافته', 'warning');
          }
        }
      }
      
      if (this.currentItemName && !this.itemNameInput.value) {
        this.itemNameInput.value = this.currentItemName;
      }
      
      if (storeId) {
        setTimeout(() => this.unitTypeEl.focus(), 100);
      } else {
        this.storeSelect.focus();
      }
      
    } catch (err) {
      console.error('❌ خطأ في تحميل بيانات الصنف:', err);
      this.showItemStatus('⚠️ حدث خطأ في تحميل البيانات', 'warning');
    }
  }

  showItemStatus(msg, type) {
    if (!this.itemStatus) return;
    this.itemStatus.textContent = msg;
    this.itemStatus.className = 'item-status';
    this.itemStatus.style.display = 'block';
    this.itemStatus.classList.add(type === 'success' ? 'good-stock' : type === 'error' ? 'low-stock' : 'medium-stock');
  }

  // --- تعبئة النموذج من كائن بيانات master ---
  fillFormWithItemData(data = {}) {
    try {
      console.log('🔄 تعبئة النموذج بالبيانات:', data);
      
      const formFields = [
        'tran_date', 'store_id', 'supplierid', 'mndop', 'item_id', 'item_nm',
        'item_qty', 'buy_price', 'total_price', 'rate', 'sale_price1', 'sale_price2', 'sale_price3',
        'tran_type', 'batch_no', 'expiry_date', 'min_qty', 'remarks',
        'unit_type', 'units_per_package', 'sale_unit', 'conversion_factor'
      ];

      formFields.forEach(key => {
        const el = document.getElementById(key);
        if (el && data[key] !== undefined && data[key] !== null) {
          if (key === 'tran_date' || key === 'expiry_date') {
            el.value = this.formatDateForInput(data[key]);
          } else {
            el.value = data[key];
          }
        }
      });

      // تعبئة الحقول المشتقة (القطع والعلب)
      if (data.item_qty !== undefined && data.unit_type) {
        this.updateQuantityFields(data.item_qty, data.unit_type, data.units_per_package);
      }

      if (data.buy_price !== undefined && data.unit_type) {
        this.updatePriceFields(data.buy_price, data.unit_type, data.units_per_package, 'buy');
      }

      if (data.sale_price1 !== undefined && data.unit_type) {
        this.updatePriceFields(data.sale_price1, data.unit_type, data.units_per_package, 'sale');
      }

    } catch (err) {
      console.error('fillFormWithItemData err', err);
    }
  }

  // 🆕 دالة مساعدة لتحديث حقول الكمية
  updateQuantityFields(totalQty, unitType, unitsPerPackage) {
    const qty = parseFloat(totalQty) || 0;
    const units = parseFloat(unitsPerPackage) || 1;
    
    if (unitType === 'package') {
      const packages = Math.floor(qty / units);
      const pieces = qty % units;
      if (this.itemQtyPiece) this.itemQtyPiece.value = pieces;
      if (this.itemQtyPackage) this.itemQtyPackage.value = packages;
    } else {
      if (this.itemQtyPiece) this.itemQtyPiece.value = qty;
      if (this.itemQtyPackage) this.itemQtyPackage.value = 0;
    }
  }

  // 🆕 دالة مساعدة لتحديث حقول الأسعار
  updatePriceFields(price, unitType, unitsPerPackage, priceType) {
    const priceVal = parseFloat(price) || 0;
    const units = parseFloat(unitsPerPackage) || 1;
    
    if (unitType === 'package') {
      if (priceType === 'buy') {
        if (this.buyPricePiece) this.buyPricePiece.value = priceVal;
        if (this.buyPricePackage) this.buyPricePackage.value = (priceVal * units).toFixed(2);
      } else if (priceType === 'sale') {
        if (this.salePrice1Piece) this.salePrice1Piece.value = priceVal;
        if (this.salePrice1Package) this.salePrice1Package.value = (priceVal * units).toFixed(2);
      }
    } else {
      if (priceType === 'buy') {
        if (this.buyPricePiece) this.buyPricePiece.value = priceVal;
        if (this.buyPricePackage) this.buyPricePackage.value = 0;
      } else if (priceType === 'sale') {
        if (this.salePrice1Piece) this.salePrice1Piece.value = priceVal;
        if (this.salePrice1Package) this.salePrice1Package.value = 0;
      }
    }
  }

  // --- تنظيف النموذج مع الحفاظ على مخزن واسم الصنف وتاريخ اليوم ---
  clearForm() {
    const storeId = this.storeSelect.value;
    const currentName = this.currentItemName;
    if (this.form) this.form.reset();
    if (storeId && this.storeSelect) this.storeSelect.value = storeId;
    if (currentName && this.itemNameInput) this.itemNameInput.value = currentName;
    this.setDateNow();
    this.updateUnitDisplays();
  }

  // --- اظهار/اخفاء حقول الوحدة بحسب النوع ---
  updateUnitDisplays() {
    if (!this.unitTypeEl || !this.unitsPerPackageEl) return;
    
    const unitType = this.unitTypeEl.value;
    const unitsPerPackage = parseFloat(this.unitsPerPackageEl.value) || 1;
    if (this.convFactorEl) this.convFactorEl.value = unitsPerPackage;
    this.currentUnitsPerPackage = unitsPerPackage;
    this.currentUnitType = unitType;

    const packageFields = ['item_qty_package', 'buy_price_package', 'sale_price1_package'];
    const pieceFields = ['item_qty_piece', 'buy_price_piece', 'sale_price1_piece'];

    packageFields.forEach(id => {
      const el = document.getElementById(id);
      const label = document.querySelector(`label[for="${id}"]`);
      if (el) {
        el.style.display = unitType === 'package' ? 'block' : 'none';
        el.disabled = unitType !== 'package';
      }
      if (label) label.style.display = unitType === 'package' ? 'block' : 'none';
    });
    
    pieceFields.forEach(id => {
      const el = document.getElementById(id);
      const label = document.querySelector(`label[for="${id}"]`);
      if (el) {
        el.style.display = unitType === 'package' ? 'none' : 'block';
        el.disabled = unitType === 'package';
      }
      if (label) label.style.display = unitType === 'package' ? 'none' : 'block';
    });

    this.updateFieldSkipping();
    
    // إعادة حساب الكميات والأسعار بعد تحديث الوحدات
    this.calculateQuantities();
    this.calculatePrices();
    this.calculatePricesForSaleUnit();
  }

  updateFieldSkipping() {
    if (!this.unitTypeEl) return;
    
    const unitType = this.unitTypeEl.value;
    const autoFields = ['item_qty', 'buy_price', 'total_price', 'sale_price1', 'conversion_factor'];
    const allFields = this.form ? [...this.form.querySelectorAll('input, select')] : [];
    
    allFields.forEach(field => {
      const id = field.id;
      field.style.background = '';
      field.tabIndex = 0;
      if (autoFields.includes(id)) {
        field.style.background = '#f0f8ff';
        field.tabIndex = -1;
      }
      if (unitType === 'package' && ['item_qty_piece', 'buy_price_piece', 'sale_price1_piece'].includes(id)) {
        field.tabIndex = -1;
      }
      if (unitType === 'piece' && ['item_qty_package', 'buy_price_package', 'sale_price1_package'].includes(id)) {
        field.tabIndex = -1;
      }
    });
  }

  // --- تنقل Enter مبسط (يحافظ على ترتيب الحقول) ---
  setupEnterNavigation() {
    if (!this.form) return;
    
    const fieldOrder = [
      'tran_date', 'store_id', 'supplierid', 'mndop', 'item_id', 
      'unit_type', 'units_per_package', 'sale_unit',
      'item_qty_piece', 'item_qty_package', 'item_qty',
      'buy_price_piece', 'buy_price_package', 'buy_price',
      'total_price', 'rate', 'sale_price1_piece', 'sale_price1_package',
      'sale_price1', 'sale_price2', 'sale_price3', 'tran_type',
      'batch_no', 'expiry_date', 'min_qty', 'convert_from_qty',
      'convert_from_unit', 'convert_to_qty', 'convert_to_unit', 'remarks'
    ];

    const getNavFields = () => {
      const unitType = this.unitTypeEl.value;
      const nav = [];
      
      fieldOrder.forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        
        // تخطي الحقول المخفية أو المعطلة
        if (field.style.display === 'none' || field.disabled || field.offsetParent === null) return;
        
        // تخطي الحقول التلقائية (للقراءة فقط)
        if (['item_qty', 'buy_price', 'total_price', 'sale_price1', 'conversion_factor', 'convert_to_qty'].includes(id)) return;
        
        // تخطي حقول الوحدات غير المناسبة
        if (unitType === 'package' && id.includes('_piece') && !id.includes('convert')) return;
        if (unitType === 'piece' && id.includes('_package') && !id.includes('convert')) return;
        
        nav.push(id);
      });
      
      return nav;
    };

    const moveNext = (currentId) => {
      const nav = getNavFields();
      const idx = nav.indexOf(currentId);
      if (idx === -1) return false;
      
      if (idx < nav.length - 1) {
        const nextId = nav[idx + 1];
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          if (nextEl.tagName === 'SELECT') {
            setTimeout(() => nextEl.click(), 10);
          }
          return true;
        }
      }
      
      // إذا كنا في آخر حقل، ننتقل إلى زر الحفظ
      if (this.saveBtn) {
        this.saveBtn.focus();
        return true;
      }
      return false;
    };

    // إضافة مستمعي الأحداث لجميع الحقول
    fieldOrder.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            moveNext(id);
          }
        });
      }
    });

    // إضافة مستمع للزر حفظ
    if (this.saveBtn) {
      this.saveBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.form.dispatchEvent(new Event('submit'));
        }
      });
    }
  }

  // --- حساب الكميات النهائية من حقول قطعة/علبة ---
  calculateQuantities() {
    if (!this.itemQtyPiece || !this.itemQtyPackage || !this.itemQty) return;
    
    const pieceQty = parseFloat(this.itemQtyPiece.value) || 0;
    const packageQty = parseFloat(this.itemQtyPackage.value) || 0;
    const finalQty = this.currentUnitType === 'package' ? pieceQty + packageQty * this.currentUnitsPerPackage : pieceQty;
    this.itemQty.value = finalQty.toFixed(2);
    this.calc();
  }

  // --- حساب أسعار الشراء وبيع1 (قواعد عامة) ---
  calculatePrices() {
    if (!this.buyPricePiece || !this.buyPricePackage || !this.buyPrice) return;
    
    const piecePrice = parseFloat(this.buyPricePiece.value) || 0;
    const packagePrice = parseFloat(this.buyPricePackage.value) || 0;
    let finalPrice = piecePrice;

    if (this.currentUnitType === 'package' && this.currentUnitsPerPackage > 0) {
      if (packagePrice > 0) {
        finalPrice = packagePrice / this.currentUnitsPerPackage;
        if (this.buyPricePiece) this.buyPricePiece.value = finalPrice.toFixed(2);
      } else if (piecePrice > 0) {
        finalPrice = piecePrice;
        if (this.buyPricePackage) this.buyPricePackage.value = (piecePrice * this.currentUnitsPerPackage).toFixed(2);
      }
    }

    if (this.buyPrice) this.buyPrice.value = finalPrice.toFixed(2);

    const r = parseFloat(this.rate.value) || 0;
    if (r > 0 && finalPrice > 0) {
      const salePrice = +(finalPrice + finalPrice * r / 100).toFixed(2);
      if (this.salePrice1) this.salePrice1.value = salePrice.toFixed(2);
      if (this.salePrice1Piece) this.salePrice1Piece.value = salePrice.toFixed(2);
      if (this.currentUnitType === 'package' && this.currentUnitsPerPackage > 0 && this.salePrice1Package) {
        this.salePrice1Package.value = (salePrice * this.currentUnitsPerPackage).toFixed(2);
      }
    }
    this.calc();
    this.calculatePricesForSaleUnit();
  }

  // --- التوزيع حسب sale_unit (طلب المستخدم) ---
  calculatePricesForSaleUnit() {
    if (!this.unitsPerPackageEl || !this.salePrice1Piece || !this.salePrice1Package) return;
    
    const units = parseFloat(this.unitsPerPackageEl.value) || 1;

    const piecePrice = parseFloat(this.salePrice1Piece.value) || 0;
    const packagePrice = parseFloat(this.salePrice1Package.value) || 0;

    let finalPiece = piecePrice;
    let finalPackage = packagePrice;

    // إذا كان سعر العلبة موجود → نحول لسعر القطعة
    if (packagePrice > 0 && units > 0) {
      finalPiece = packagePrice / units;
      if (this.salePrice1Piece) this.salePrice1Piece.value = finalPiece.toFixed(2);
    }

    // إذا كان سعر القطعة موجود → نحول لسعر العلبة
    if (piecePrice > 0 && units > 0) {
      finalPackage = piecePrice * units;
      if (this.salePrice1Package) this.salePrice1Package.value = finalPackage.toFixed(2);
    }

    // ✅ دائماً نضع سعر العلبة في sale_price2
    if (this.salePrice2) this.salePrice2.value = finalPackage.toFixed(2);

    // ✅ إذا البيع بالقطعة → sale_price1 = سعر القطعة
    // ✅ إذا البيع بالعلبة → sale_price1 يُفرغ
    if (this.saleUnitEl && this.salePrice1) {
      if (this.saleUnitEl.value === 'piece') {
        this.salePrice1.value = finalPiece.toFixed(2);
      } else {
        this.salePrice1.value = "";
      }
    }
  }

  // --- تحويل وحدات ---
  async convertUnits() {
    const fromQty = parseFloat(this.convertFromQty.value) || 0;
    const fromUnit = this.convertFromUnit.value;
    const toUnit = this.convertToUnit.value;
    const itemId = this.itemIdInput.value || '';
    
    if (!fromQty) return this.showToast('⚠️ أدخل الكمية للتحويل');
    
    try {
      // حساب محلي بسيط
      let result = fromQty;
      
      if (fromUnit === 'piece' && toUnit === 'package') {
        result = fromQty / this.currentUnitsPerPackage;
      } else if (fromUnit === 'package' && toUnit === 'piece') {
        result = fromQty * this.currentUnitsPerPackage;
      }
      
      if (this.convertToQty) this.convertToQty.value = result.toFixed(2);
      if (this.conversionResult) {
        this.conversionResult.textContent = `${fromQty} ${fromUnit === 'piece' ? 'قطعة' : 'علبة'} = ${result.toFixed(2)} ${toUnit === 'piece' ? 'قطعة' : 'علبة'}`;
      }
      
    } catch (err) {
      console.error('خطأ في التحويل:', err);
      this.showToast('❌ حدث خطأ أثناء التحويل');
    }
  }

  async searchItems(query) {
    if (!query) return await this.loadData();
    
    try {
      const mode = this.getConnectionMode();
      let results = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        const { data, error } = await supabase
          .from('a_master')
          .select('*')
          .or(`item_id.ilike.%${query}%,item_nm.ilike.%${query}%`);
        
        if (error) throw error;
        results = data || [];
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(`${apiUrl}/search/${encodeURIComponent(query)}`);
        if (res.ok) {
          results = await res.json();
        }
      }
      
      allData = results;
      this.render();
      this.showToast(`🔍 تم العثور على ${results.length} نتيجة`);
    } catch (err) {
      console.error('خطأ في البحث:', err);
      this.showToast('❌ حدث خطأ أثناء البحث');
    }
  }

  async loadLowStockAlerts() {
    try {
      const mode = this.getConnectionMode();
      let alerts = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        // 🆕 إصلاح: استخدام استعلام صحيح للتنبيهات
        const { data, error } = await supabase
          .from('a_master')
          .select('*');
        
        if (error) throw error;
        
        // تصفية محلي للكميات المنخفضة
        alerts = (data || []).filter(item => {
          const itemQty = parseFloat(item.item_qty) || 0;
          const minQty = parseFloat(item.min_qty) || 0;
          return itemQty <= minQty;
        });
        
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(`${apiUrl}/alerts/low-stock`);
        if (res.ok) {
          alerts = await res.json();
        }
      }
      
      this.displayAlerts(alerts);
    } catch (err) {
      console.error('خطأ في التنبيهات:', err);
      this.showToast('ℹ️ خاصية التنبيهات غير متاحة حالياً');
    }
  }

  displayAlerts(alerts) {
    const alertsList = document.getElementById('alertsList');
    const alertsPanel = document.getElementById('alertsPanel');
    if (!alertsList || !alertsPanel) return;
    
    if (!alerts || alerts.length === 0) {
      alertsList.innerHTML = '<p>🎉 لا توجد تنبيهات - الفروع جيد</p>';
    } else {
      alertsList.innerHTML = alerts.map(alert => `
        <div class="alert-item">
          <strong>${alert.item_id} - ${alert.item_nm}</strong><br>
          الفروع: ${alert.item_qty} | حد الطلب: ${alert.min_qty}
          <button class="btn-edit" onclick="master.editRow('${alert.store_id}','${alert.item_id}')" style="margin-right:10px;">✏️ تحديث</button>
        </div>
      `).join('');
      this.showToast(`📢 تم العثور على ${alerts.length} صنف منخفض الفروع`);
    }
    alertsPanel.style.display = 'block';
  }

  // --- رسم الجدول ---
  render() {
    if (!this.tbody) return;
    
    this.tbody.innerHTML = '';
    const query = (this.searchBox?.value || '').toLowerCase();
    const data = !query ? allData : allData.filter(row => 
      Object.values(row).some(val => String(val || '').toLowerCase().includes(query))
    );
    
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
      const itemQty = parseFloat(row.item_qty) || 0;
      const minQty = parseFloat(row.min_qty) || 0;
      
      if (itemQty <= minQty) tr.style.background = '#ffebee';
      else if (itemQty <= minQty * 2) tr.style.background = '#fff3e0';
      
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${row.tran_date || ''}</td>
        <td>${row.store_id || ''}</td>
        <td>${row.supplierid || ''}</td>
        <td>${row.mndop || ''}</td>
        <td><strong>${row.item_id || ''}</strong></td>
        <td>${row.item_nm || ''}</td>
        <td><strong>${row.item_qty || ''}</strong></td>
        <td><span class="unit-badge">${row.unit_type === 'package' ? 'علبة' : 'قطعة'}</span></td>
        <td>${row.buy_price || ''}</td>
        <td>${row.total_price || ''}</td>
        <td>${row.rate || ''}</td>
        <td>${row.sale_price1 || ''}</td>
        <td>${row.sale_price2 || ''}</td>
        <td>${row.sale_price3 || ''}</td>
        <td>${row.tran_type || ''}</td>
        <td>${row.batch_no || ''}</td>
        <td>${row.expiry_date || ''}</td>
        <td>${row.min_qty || ''}</td>
        <td>${row.remarks || ''}</td>
        <td>
          <button class="btn-edit" onclick="master.editRow('${row.store_id}','${row.item_id}')">✏️ تحديث</button>
          <button class="btn-del" onclick="master.delRow('${row.store_id}','${row.item_id}')">🗑️ حذف</button>
        </td>`;
      this.tbody.appendChild(tr);
    });
    
    if (this.itemsCount) this.itemsCount.textContent = data.length;
  }

  // --- حفظ / تعديل السجل ---
  async saveHandler(e) {
    e.preventDefault();

    const formData = {
      tran_date: this.formatDateForServer(this.tranDate.value),
      store_id: this.storeSelect.value,
      supplierid: this.supplierId.value || null,
      mndop: this.mndop.value || '',
      item_id: this.itemIdInput.value,
      item_nm: this.itemNameInput.value,
      item_qty: parseFloat(this.itemQty.value) || 0,
      buy_price: parseFloat(this.buyPriceField.value) || 0,
      total_price: parseFloat(this.totalPrice.value) || 0,
      rate: parseFloat(this.rate.value) || 0,
      sale_price1: parseFloat(this.salePrice1.value) || 0,
      sale_price2: parseFloat(this.salePrice2.value) || 0,
      sale_price3: parseFloat(this.salePrice3.value) || 0,
      tran_type: document.getElementById('tran_type').value || 'شراء',
      batch_no: document.getElementById('batch_no').value || '',
      expiry_date: this.formatDateForServer(document.getElementById('expiry_date').value),
      min_qty: parseFloat(document.getElementById('min_qty').value) || 0,
      remarks: document.getElementById('remarks').value || '',
      unit_type: this.unitTypeEl.value,
      units_per_package: parseFloat(this.unitsPerPackageEl.value) || 1,
      sale_unit: this.saleUnitEl.value,
      conversion_factor: parseFloat(this.convFactorEl.value) || 1
    };

    if (!formData.store_id) return this.showToast('⚠️ المخزن مطلوب'), this.storeSelect.focus();
    if (!formData.item_id) return this.showToast('⚠️ كود الصنف مطلوب'), this.itemIdInput.focus();
    if (!formData.item_nm) return this.showToast('⚠️ اسم الصنف مطلوب'), this.itemIdInput.focus();

    try {
      const mode = this.getConnectionMode();
      console.log(`💾 جاري حفظ السجل - الوضع: ${mode}`);

      // جلب الكمية الحالية إن وُجدت وإضافة الكمية الجديدة
      let existingQty = 0;
      const storeId = formData.store_id, itemId = formData.item_id;
      
      try {
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
          // 🆕 إصلاح: استخدام select('*') بدلاً من select('item_qty')
          const { data, error } = await supabase
            .from('a_master')
            .select('*')
            .eq('store_id', storeId)
            .eq('item_id', itemId)
            .maybeSingle(); // 🆕 استخدام maybeSingle بدلاً من single
          
          if (!error && data) {
            existingQty = parseFloat(data.item_qty) || 0;
            this.showToast(`📊 الكمية الحالية: ${existingQty} - سيتم إضافة: ${formData.item_qty}`);
          }
        } else {
          // البحث في API التقليدي
          const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
          const existingRes = await fetch(`${apiUrl}/${storeId}_${itemId}`);
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            existingQty = parseFloat(existingData.item_qty) || 0;
            this.showToast(`📊 الكمية الحالية: ${existingQty} - سيتم إضافة: ${formData.item_qty}`);
          }
        }
      } catch (err) {
        console.log('سجل جديد أو خطأ في جلب الكمية السابقة:', err);
      }

      formData.item_qty = existingQty + formData.item_qty;
      formData.total_price = +(formData.item_qty * formData.buy_price).toFixed(2);

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        // 🆕 إصلاح: استخدام upsert بشكل صحيح
        const { data, error } = await supabase
          .from('a_master')
          .upsert(formData, { // 🆕 إزالة الأقواس المربعة حول formData
            onConflict: 'store_id,item_id'
          });
        
        if (error) {
          console.error('Supabase save error:', error);
          
          // 🆕 محاولة بديلة باستخدام insert/update
          if (error.code === '400' || error.code === '406') {
            console.log('🔄 تجربة طريقة بديلة للحفظ...');
            
            if (existingQty > 0) {
              // تحديث السجل الموجود
              const { error: updateError } = await supabase
                .from('a_master')
                .update(formData)
                .eq('store_id', storeId)
                .eq('item_id', itemId);
                
              if (updateError) throw updateError;
            } else {
              // إدراج سجل جديد
              const { error: insertError } = await supabase
                .from('a_master')
                .insert([formData]);
                
              if (insertError) throw insertError;
            }
          } else {
            throw error;
          }
        }
        
        this.showToast('✅ تم حفظ السجل بنجاح في Supabase' + ` - الكمية الإجمالية: ${formData.item_qty}`);
        
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(formData)
        });

        const responseText = await res.text();
        if (!res.ok) {
          let errorData;
          try { errorData = JSON.parse(responseText); } catch { errorData = { error: `خطأ في الخادم: ${res.status} ${res.statusText}` }; }
          throw new Error(errorData.error || 'خطأ في الاستجابة من الخادم');
        }

        let result;
        try { result = JSON.parse(responseText); } catch { result = { message: 'تم الحفظ بنجاح' }; }
        this.showToast((result.message || '✅ تم حفظ السجل بنجاح') + ` - الكمية الإجمالية: ${formData.item_qty}`);
      }

      this.clearForm();
      this.editKey = null;
      await this.loadData();
      if (this.itemStatus) this.itemStatus.style.display = 'none';
      setTimeout(() => this.itemIdInput.focus(), 100);
      
    } catch (err) {
      console.error('❌ خطأ في الحفظ:', err);
      this.showToast('❌ ' + (err.message || 'حدث خطأ أثناء الحفظ'));
    }
  }

  // --- تعديل سجل ---
  async editRow(store, item) {
    try {
      const mode = this.getConnectionMode();
      let data;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        const { data: result, error } = await supabase
          .from('a_master')
          .select('*')
          .eq('store_id', store)
          .eq('item_id', item)
          .single();
        
        if (error) throw error;
        data = result;
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(`${apiUrl}/${store}_${item}`);
        if (!res.ok) throw new Error('لم يتم العثور على السجل');
        data = await res.json();
      }
      
      this.fillFormWithItemData(data);

      // تحميل اسم الصنف من جدول items إذا كان فارغاً
      if (data.item_id && (!this.itemNameInput.value || this.itemNameInput.value === '')) {
        try {
          if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            const { data: itemData, error } = await supabase
              .from('items')
              .select('item_nm')
              .eq('item_id', data.item_id)
              .single();
              
            if (!error && itemData) {
              this.itemNameInput.value = itemData.item_nm || '';
              this.currentItemName = this.itemNameInput.value;
            }
          } else {
            const itemsApi = appConfig?.get('ITEMS') || 'http://localhost:3000/api/items';
            const itemRes = await fetch(`${itemsApi}/${data.item_id}`);
            if (itemRes.ok) {
              const itemData = await itemRes.json();
              this.itemNameInput.value = itemData.item_nm || '';
              this.currentItemName = this.itemNameInput.value;
            }
          }
        } catch (err) {
          console.error('خطأ في جلب اسم الصنف:', err);
        }
      }

      // تحديث إعدادات الوحدات
      if (data.unit_type) {
        this.currentUnitType = data.unit_type;
        this.currentUnitsPerPackage = parseFloat(data.units_per_package) || 1;
        if (this.unitTypeEl) this.unitTypeEl.value = data.unit_type || 'piece';
        if (this.unitsPerPackageEl) this.unitsPerPackageEl.value = data.units_per_package || 1;
        if (this.saleUnitEl) this.saleUnitEl.value = data.sale_unit || 'piece';
        if (this.convFactorEl) this.convFactorEl.value = data.conversion_factor || 1;
        
        this.updateUnitDisplays();
        this.calculateQuantities();
        this.calculatePrices();
        this.calculatePricesForSaleUnit();
      }

      this.editKey = `${store}_${item}`;
      this.showItemStatus('✏️ جاهز للتحديث - يمكنك تعديل البيانات', 'success');
      
      setTimeout(() => this.storeSelect.focus(), 100);
      
    } catch (err) {
      console.error('خطأ في التعديل:', err);
      this.showToast('❌ خطأ في تحميل البيانات');
    }
  }

  // --- حذف سجل ---
  async delRow(store, item) {
    if (!confirm('🗑️ حذف السجل؟')) return;
    
    try {
      const mode = this.getConnectionMode();

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase) this.initializeSupabase();
        
        const { error } = await supabase
          .from('a_master')
          .delete()
          .eq('store_id', store)
          .eq('item_id', item);
        
        if (error) throw error;
      } else {
        // استخدام API التقليدي
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(`${apiUrl}/${store}_${item}`, { method: "DELETE" });
        if (!res.ok) throw new Error('خطأ في الحذف');
      }
      
      allData = allData.filter(i => String(i.store_id) !== String(store) || String(i.item_id) !== String(item));
      this.render();
      this.showToast('🗑️ تم الحذف');
      
    } catch (err) {
      console.error('خطأ في الحذف:', err);
      this.showToast('❌ حدث خطأ أثناء الحذف');
    }
  }

  // --- استيراد ملف ---
  async handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const mode = this.getConnectionMode();
        
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
          alert('ℹ️ استيراد الملفات غير متاح في وضع Supabase المباشر');
          return;
        }

        const wb = XLSX.read(ev.target.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        
        const apiUrl = appConfig?.get('MASTER') || 'http://localhost:3000/api/a_master';
        const res = await fetch(apiUrl + '/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: data })
        });
        
        if (!res.ok) throw new Error('خطأ في الاستيراد');
        const result = await res.json();
        this.showToast(`📥 ${result.message || 'تم الاستيراد'}`);
        await this.loadData();
        setTimeout(() => this.saveBtn.focus(), 100);
      } catch (err) {
        console.error('خطأ في الاستيراد:', err);
        this.showToast('❌ حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  // --- تصدير ---
  handleExport() {
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'a_masterbk');
    XLSX.writeFile(wb, `a_masterbk_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --- تهيئة الأحداث وربط المستمعين ---
  initEvents() {
    // حسابات وحقول وحدات
    ['item_qty', 'buy_price', 'rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', this.calc);
    });

    if (this.itemQtyPiece) this.itemQtyPiece.addEventListener('input', this.calculateQuantities);
    if (this.itemQtyPackage) this.itemQtyPackage.addEventListener('input', this.calculateQuantities);
    if (this.buyPricePiece) this.buyPricePiece.addEventListener('input', this.calculatePrices);
    if (this.buyPricePackage) this.buyPricePackage.addEventListener('input', this.calculatePrices);

    // sale price manual change
    if (this.salePrice1Piece) {
      this.salePrice1Piece.addEventListener('input', () => {
        const piecePrice = parseFloat(this.salePrice1Piece.value) || 0;
        if (this.salePrice1) this.salePrice1.value = piecePrice.toFixed(2);
        if (this.currentUnitType === 'package' && this.currentUnitsPerPackage > 0 && this.salePrice1Package) {
          this.salePrice1Package.value = (piecePrice * this.currentUnitsPerPackage).toFixed(2);
        }
        this.calculatePricesForSaleUnit();
      });
    }

    // change handlers for unit settings
    if (this.unitTypeEl) this.unitTypeEl.addEventListener('change', this.updateUnitDisplays);
    if (this.unitsPerPackageEl) this.unitsPerPackageEl.addEventListener('input', this.updateUnitDisplays);
    if (this.saleUnitEl) this.saleUnitEl.addEventListener('change', this.calculatePricesForSaleUnit);

    // convert units button
    const convertBtn = document.querySelector('.unit-converter button');
    if (convertBtn) convertBtn.addEventListener('click', this.convertUnits);

    // CRUD & IO
    if (this.form) this.form.addEventListener('submit', this.saveHandler);
    if (this.importBtn) this.importBtn.addEventListener('click', () => this.importInput.click());
    if (this.importInput) this.importInput.addEventListener('change', this.handleImport);
    if (this.exportBtn) this.exportBtn.addEventListener('click', this.handleExport);

    // بحث و أزرار
    if (this.searchBtn) this.searchBtn.addEventListener('click', () => this.searchItems(this.searchBox.value));
    if (this.showAllBtn) this.showAllBtn.addEventListener('click', () => { 
      if (this.searchBox) this.searchBox.value = ''; 
      this.loadData(); 
    });
    if (this.lowStockBtn) this.lowStockBtn.addEventListener('click', this.loadLowStockAlerts);
    if (this.searchBox) {
      this.searchBox.addEventListener('keypress', e => { 
        if (e.key === 'Enter') this.searchItems(this.searchBox.value); 
      });
    }

    // blur on item id
    this.attachItemBlur();

    // enter navigation
    this.setupEnterNavigation();
  }

  // --- تهيئة نهائية ---
  async init() {
    try {
      console.log('🚀 بدء تهيئة النظام...');
      // تهيئة Supabase
      this.initializeSupabase();
      
      // تحديث حالة الاتصال
      this.updateConnectionStatus();
      
      await this.loadOptions();
      this.setDateNow();
      await this.loadData();
      this.initEvents();
      this.updateUnitDisplays();
      
      setTimeout(() => { 
        if (this.itemIdInput) {
          this.itemIdInput.focus(); 
          console.log('🎯 جاهز - المؤشر على حقل كود الصنف'); 
        }
      }, 500);
      
      setTimeout(() => { 
        console.log('📢 تحميل تنبيهات الفروع...'); 
        this.loadLowStockAlerts(); 
      }, 1000);
      
      console.log('✅ تم تهيئة النظام بنجاح');
    } catch (err) {
      console.error('init err', err);
    }
  }
}

// أنشئ مثيلاً واحداً ليكون مرجعاً في الواجهة
window.master = new MasterManager();