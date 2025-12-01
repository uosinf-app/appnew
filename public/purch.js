// ⚡ التهيئة العالمية
const SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

let supabase;

class PurchaseManager {
  constructor() {
    // صوت تنبيهات
    this.sndOk = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
    this.sndErr = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');
    const pbtn = document.getElementById('printBtn'); if(pbtn) pbtn.addEventListener('click', ()=> this.printInvoice());

    // 🆕 نظام التبديل بين المحلي وSupabase
    this.BASE_API = this.getBaseAPI();
    this.API_PURCHASES = `${this.BASE_API}/purchases`;
    
    this.items = [];
    this.allPurchases = [];
    this.allSuppliers = [];
    this.allItems = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.currentSort = { field: 'tran_date', direction: 'desc' };
    this.dateFilter = { from: null, to: null };
    
    this.bindMethods();
    this.init();
  }

  // 🆕 الحصول على وضع الاتصال الحالي
  getConnectionMode() {
    return localStorage.getItem('connection_mode') || 
           sessionStorage.getItem('connection_mode') || 
           'auto';
  }

  // 🆕 تحديث شريط حالة الاتصال
  updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    if (!statusDiv) return;
    
    const mode = this.getConnectionMode();
    
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
      statusDiv.innerHTML = `🌐 Supabase مباشر - ${this.allPurchases.length} فاتورة <button class="switch-btn" onclick="purchaseManager.switchConnectionMode()">تبديل</button>`;
      statusDiv.className = 'connection-status supabase';
    } else {
      statusDiv.innerHTML = `🔗 اتصال محلي - ${this.allPurchases.length} فاتورة <button class="switch-btn" onclick="purchaseManager.switchConnectionMode()">تبديل</button>`;
      statusDiv.className = 'connection-status local';
    }
  }

  // 🆕 تبديل وضع الاتصال
  switchConnectionMode() {
    const currentMode = this.getConnectionMode();
    const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
    
    localStorage.setItem('connection_mode', newMode);
    sessionStorage.setItem('connection_mode', newMode);
    
    this.updateConnectionStatus();
    this.showToast(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`);
    
    // تحديث الـ API base وإعادة تحميل البيانات
    this.BASE_API = this.getBaseAPI();
    this.API_PURCHASES = `${this.BASE_API}/purchases`;
    
    this.loadSuppliersAndItems();
    this.loadDropdowns();
    this.loadPurchases();
  }

  // 🆕 الحصول على API base بناء على الوضع
  getBaseAPI() {
    const mode = this.getConnectionMode();
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
      return 'https://rvjacvrrpguehbapvewe.supabase.co/rest/v1';
    } else {
      return 'http://localhost:3000/api';
    }
  }

  // 🆕 تهيئة Supabase
  initializeSupabase() {
    try {
      if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase initialized for purchases');
        return true;
      } else {
        console.error('❌ Supabase JS not loaded properly');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Supabase:', error);
      return false;
    }
  }

  // 🆕 دالة الجلب مع دعم كلا الوضعين
  async fetchData(url, options = {}) {
    try {
      const mode = this.getConnectionMode();
      
      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase && !this.initializeSupabase()) {
          throw new Error('Supabase not available');
        }
        
        const headers = {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          ...options.headers
        };

        const response = await fetch(url, {
          ...options,
          headers
        });

        if (!response.ok) {
          throw new Error(`خطأ في الخادم: ${response.status}`);
        }

        const result = await response.json();
        return Array.isArray(result) ? result : (result.data || []);
      } else {
        // استخدام API التقليدي
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`خطأ في الخادم: ${response.status}`);
        }
        return await response.json();
      }
    } catch (error) {
      console.error('❌ خطأ في الجلب:', error);
      
      // 🆕 التحويل التلقائي لـ Supabase عند فشل المحلي
      if (this.getConnectionMode() !== 'supabase' && error.message.includes('Failed to fetch')) {
        this.showToast('🔄 التحويل التلقائي إلى Supabase...');
        this.switchConnectionMode();
        return this.fetchData(url, options);
      }
      
      throw error;
    }
  }

  // 🆕 دالة الحفظ مع دعم كلا الوضعين
  async saveData(url, data, method = 'POST') {
    try {
      const mode = this.getConnectionMode();
      
      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        if (!supabase && !this.initializeSupabase()) {
          throw new Error('Supabase not available');
        }
        
        const headers = {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
        };

        const response = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`خطأ في الحفظ: ${response.status} - ${errorText}`);
        }

        if (response.status === 204) {
          return { success: true };
        }

        const result = await response.json();
        return result[0] || result;
      } else {
        // استخدام API التقليدي
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`خطأ في الحفظ: ${response.status} - ${errorText}`);
        }

        return await response.json();
      }
    } catch (error) {
      console.error('❌ خطأ في الحفظ:', error);
      
      // 🆕 التحويل التلقائي لـ Supabase عند فشل المحلي
      if (this.getConnectionMode() !== 'supabase' && error.message.includes('Failed to fetch')) {
        this.showToast('🔄 التحويل التلقائي إلى Supabase...');
        this.switchConnectionMode();
        return this.saveData(url, data, method);
      }
      
      throw error;
    }
  }

  // 🆕 دالة لعرض الإشعارات
  showToast(msg, time = 2000) {
    console.log('🔔', msg);
  }

  bindMethods() {
    this.switchConnectionMode = this.switchConnectionMode.bind(this);
    this.updateConnectionStatus = this.updateConnectionStatus.bind(this);
    this.fetchData = this.fetchData.bind(this);
    this.saveData = this.saveData.bind(this);
  }

  init() {
    this.cache();
    this.setCurrentDate();
    this.bindUI();
    
    // 🆕 تهيئة Supabase وتحديث الحالة
    this.initializeSupabase();
    this.updateConnectionStatus();
    
    this.loadDropdowns();
    this.loadSuppliersAndItems();
    this.loadPurchases();
    this.setupPaymentHandler();
    this.setupAutoSelect();
    this.setupCalculations();
    setTimeout(()=>this.$store?.focus(), 300);
  }

  // ============ باقي الكود يبقى كما هو تماماً ============
  cache(){
    this.$ = el => document.getElementById(el);
    this.$store = this.$('store_id');
    this.$tran = this.$('tran_date');
    this.$supplier = this.$('supplierid');
    this.$invoice = this.$('invoice_id');
    this.$addItem = this.$('addItemBtn');
    this.$itemInput = this.$('item_id');
    this.$itemsTableBody = this.$('itemsTableBody');
    this.$itemsCount = this.$('itemsCount');
    this.$save = this.$('savePurchaseBtn');
    this.$purchasesBody = this.$('purchasesTableBody');
    this.$pageSize = this.$('pageSizeSelector');
    this.$search = this.$('searchBox');
    this.$export = this.$('exportSelect');
    this.$fileInput = this.$('fileInput');
  }

  setCurrentDate(){
    const now=new Date(); const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
    if(this.$tran) this.$tran.value = local.toISOString().slice(0,16);
  }

  bindUI(){
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);
    on('addItemBtn','click', ()=> this.addItem());
    on('savePurchaseBtn','click', ()=> this.savePurchase());
    on('pageSizeSelector','change', ()=> { this.itemsPerPage = this.$pageSize.value==='all'?'all':parseInt(this.$pageSize.value); this.currentPage=1; this.renderPurchasesTable(); });
    on('searchBox','input', ()=> { this.currentPage=1; this.renderPurchasesTable(); });
    on('exportSelect','change', ()=> { this.handleExport(); });
    on('importBtn','click', ()=> this.$fileInput.click());
    on('fileInput','change', (e)=> this.importData(e));
    on('sortDateAsc','click', ()=> { this.setSort('tran_date','asc'); });
    on('sortDateDesc','click', ()=> { this.setSort('tran_date','desc'); });
    on('applyDateFilter','click', ()=> this.applyDateFilter());
    on('resetDateFilter','click', ()=> this.resetDateFilter());
    on('updateExpiryBtn', 'click', ()=> this.updateExpiryDates());

    this.setupSortableHeaders();
    this.setupFormNavigation();
    this.setupAutocompleteBehavior();
    const printBtn = this.$('printBtn');
        if (printBtn) {
            printBtn.onclick = () => this.printInvoice();
        }
    }

  setupPaymentHandler(){
    const p = this.$('payment_method');
    const credit = this.$('creditFields'), check = this.$('checkFields');
    const hideAll = ()=>{ if(credit) credit.style.display='none'; if(check) check.style.display='none';
      document.querySelectorAll('#creditFields input,#checkFields input').forEach(i=>i?.removeAttribute('required'));
    };
    const show = ()=>{
      hideAll();
      if(!p) return;
      if(p.value==='credit'){ credit.style.display='block'; this.$('due_date')?.setAttribute('required','required'); }
      else if(p.value==='check'){ check.style.display='block'; ['check_number','bank_name','check_date','check_holder'].forEach(id=>this.$(id)?.setAttribute('required','required')); }
    };
    p?.addEventListener('change', show);
    show();
  }

  setupAutoSelect(){
    document.querySelectorAll('.auto-select').forEach(el=>{
      el.addEventListener('focus', e=> { if(['0','0.00',''].includes(e.target.value)) e.target.value=''; e.target.select(); });
      el.addEventListener('blur', e=> { if(e.target.value==='') e.target.classList.add('empty-field'); else e.target.classList.remove('empty-field'); });
      if(el.type==='number') el.addEventListener('input', e=> { if(e.target.value==='') e.target.classList.add('empty-field'); else e.target.classList.remove('empty-field'); });
      if(['rate','discount_value','unit','credit_period'].includes(el.id) && (el.value==='0' || el.value==='0.00')) { el.value=''; el.classList.add('empty-field'); }
    });
  }

  setupSortableHeaders(){
    document.querySelectorAll('.sortable').forEach(th=>{
      th.addEventListener('click', ()=> {
        const f = th.getAttribute('data-sort');
        if(this.currentSort.field===f) this.currentSort.direction = this.currentSort.direction==='asc'?'desc':'asc';
        else { this.currentSort.field = f; this.currentSort.direction='asc'; }
        this.renderPurchasesTable();
      });
    });
  }

  setupFormNavigation() {
  const form = document.getElementById('purchaseForm');
    if (!form) return;

    const inputs = Array.from(form.querySelectorAll('input:not([readonly]), select, textarea'));

    inputs.forEach((input, i) => {
        input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            let ni = i + 1;
            while (ni < inputs.length) {
            const next = inputs[ni];
            if (next.offsetParent !== null && !next.disabled && next.type !== 'hidden') {
                next.focus();
                if (next.select) next.select();
                break;
            }
            ni++;
            }
        }
        });
    });

    const addBtn = this.$('addItemBtn');
    const lastField = this.$('unit');
    if (lastField && addBtn) {
        lastField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.focus();
        }
        });
    }
    }

    // في دالة savePurchase - تصحيح البحث عن المورد
  setupAutocompleteBehavior(){
    this.$supplier?.addEventListener('blur', e=> {
      const s = (e.target.value||'').toLowerCase().trim();
      if (!s) return;
      
      // 🆕 البحث بطرق متعددة
      const matched = this.allSuppliers.find(sup => 
        String(sup.supplier_id).toLowerCase() === s || 
        String(sup.supplier_name).toLowerCase() === s ||
        String(sup.supplier_id).includes(s) ||
        String(sup.supplier_name).toLowerCase().includes(s)
      );
      
      if(matched){ 
        e.target.value = matched.supplier_name || matched.supplier_id || ''; 
      } else {
        this.showErr('supplierError','المورد غير موجود');
      }
    });
  }

  // ============ helpers ============
  num(id){ const v = this.$(id)?.value; return v===''?0:parseFloat(v)||0; }
  setVal(id, val){
    const el = this.$(id); if(!el) return;
    if(val===0){ el.value=''; el.classList.add('empty-field'); } else { el.value = isFinite(val)?Number(val).toFixed(2):val; el.classList.remove('empty-field'); }
  }
  showErr(id,msg){ const e = this.$(id); if(e){ e.textContent = msg; e.style.display='block'; } }
  hideErr(id){ const e = this.$(id); if(e) e.style.display='none'; }
  hideAllErr(){ document.querySelectorAll('.error-message').forEach(e=>e.style.display='none'); }

  // ============ حساب الأسعار ============
  setupCalculations(){
    const calc = ()=> {
      const qty = this.num('item_qty'), buy = this.num('buy_price');
      const type = this.$('discount_type').value, d = this.num('discount_value'), rate = this.num('rate');
      const total = qty * buy;
      this.setVal('total_price', total);
      const discount = type==='percent'? total*(d/100) : type==='fixed'? d : 0;
      this.setVal('discount', discount);
      this.setVal('net_buy_price', buy);
      this.setVal('total_net_buy_price', total - discount);
      this.setVal('sale_price1', buy + (buy*rate/100));
    };
    ['item_qty','buy_price','discount_type','discount_value','rate','unit'].forEach(id=>{
      this.$(id)?.addEventListener('input', calc);
    });
    calc();
  }

  // ============ إدارة الأصناف في الفاتورة ============
  validateItemForm(){
    const itemInput = (this.$('item_id').value||'').trim();
    const qty=this.num('item_qty'), buy=this.num('buy_price');
    this.hideAllErr();
    const errs=[];
    if(!itemInput){ errs.push('الصنف مطلوب'); this.showErr('itemError','الصنف مطلوب'); }
    if(!qty || qty<=0){ errs.push('الكمية > 0'); this.showErr('qtyError','الكمية يجب أن تكون أكبر من الصفر'); }
    if(!buy || buy<=0){ errs.push('سعر الشراء > 0'); this.showErr('priceError','سعر الشراء يجب أن يكون أكبر من الصفر'); }
    if(itemInput && !this.findMatchingItem(itemInput)){ errs.push('الصنف غير موجود'); this.showErr('itemError','الصنف غير موجود في قاعدة البيانات'); }
    return errs;
  }

  findMatchingItem(term){ if(!term) return null; term = term.toString().toLowerCase(); return this.allItems.find(it => ((it.item_id||'')+''+ (it.item_nm||'')).toLowerCase().includes(term)); }

  addItem(){
    const errs = this.validateItemForm(); if(errs.length){ this.sndErr.play();
    alert("يرجى تصحيح الأخطاء:\n• " + errs.join("\n• ")); return; }
    const matched = this.findMatchingItem(this.$('item_id').value);
    if(!matched){ alert('❌ الصنف غير موجود'); return; }

   const item = {
        item_id: matched.item_id,
        item_nm: matched.item_nm,
        batch_no: (this.$('batch_no').value || '').trim(),
        expiry_date: this.$('expiry_date').value || null,
        item_qty: this.num('item_qty'),
        buy_price: this.num('buy_price'),
        total_price: this.num('total_price'),
        discount: this.num('discount'),
        net_buy_price: this.num('net_buy_price'),
        total_net_buy_price: this.num('total_net_buy_price'),
        rate: this.num('rate'),
        unit: this.num('unit') || 1,
        discount_type: this.$('discount_type').value,
        discount_value: this.num('discount_value'),
        sale_price1: this.num('sale_price1')
    };

    this.items.push(item);
    this.updateItemsTable();
    this.resetItemForm();
    this.calculateTotals();
    this.sndOk.play();
        setTimeout(() => {
        this.$('item_id').focus();
        this.$('item_id').select();
        }, 150);
    }

  updateItemsTable(){
    if(!this.$itemsTableBody) return;
    if(this.items.length===0){
      this.$itemsTableBody.innerHTML = '<tr><td colspan="12" style="text-align:center" class="loading">لم يتم إضافة أي أصناف بعد</td></tr>';
    } else {
      this.$itemsTableBody.innerHTML = this.items.map((it,i)=>`
        <tr>
          <td>${i+1}</td>
          <td>${it.item_id}</td>
          <td>${it.item_nm}</td>
          <td>${it.item_qty}</td>
          <td>${(it.buy_price||0).toFixed(2)}</td>
          <td>${(it.total_price||0).toFixed(2)}</td>
          <td>${(it.discount||0).toFixed(2)}</td>
          <td>${(it.unit||1).toFixed(2)}</td>
          <td>${(it.net_buy_price||0).toFixed(2)}</td>
          <td>${(it.total_net_buy_price||0).toFixed(2)}</td>
          <td>${(it.sale_price1||0).toFixed(2)}</td>
          <td><button class="delete-btn" data-index="${i}">🗑️</button></td>
        </tr>`).join('');
      this.$itemsTableBody.querySelectorAll('.delete-btn').forEach(btn=> btn.addEventListener('click', e=>{
        const idx = parseInt(btn.getAttribute('data-index')); if(confirm('هل تريد حذف هذا الصنف؟')){ this.items.splice(idx,1); this.updateItemsTable(); this.calculateTotals(); }
      }));
    }
    if(this.$itemsCount) this.$itemsCount.textContent = this.items.length;
  }

  resetItemForm(){
    ['item_id','item_qty','buy_price','total_price','discount','net_buy_price','total_net_buy_price','sale_price1','rate','discount_value','unit'].forEach(id=>{
      const el=this.$(id); if(el){ el.value=''; el.classList.add('empty-field'); }
    });
    this.$('discount_type').value='none';
    this.hideAllErr();
  }

  calculateTotals(){
    const totalInvoice = this.items.reduce((s,it)=> s + (it.total_price||0), 0);
    const totalDiscount = this.items.reduce((s,it)=> s + (it.discount||0), 0);
    const finalNet = totalInvoice - totalDiscount;
    this.setVal('total_invoice', totalInvoice);
    this.setVal('total_discount', totalDiscount);
    this.setVal('final_net_total', finalNet);
  }

  // ============ حفظ الفاتورة مع فحص التكرار بحسب التاريخ ============
  isPurchaseDuplicate(invoiceId, tran_date){
    const dateOnly = d => {
      if(!d) return '';
      if(typeof d === 'string' && d.includes('T')) return d.split('T')[0];
      try { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; } catch { return ''; }
    };
    const newDate = dateOnly(tran_date);
    return this.allPurchases.some(p => String(p.invoice_id) === String(invoiceId) && dateOnly(p.tran_date) === newDate);
  }

  // ============ حفظ الفاتورة مع دعم كلا الوضعين - نسخة سلسة ============
  // 🆕 استبدال دالة savePurchase بالكامل
  async savePurchase(){
    if(this.items.length===0){ alert('يرجى إضافة أصناف على الأقل'); return; }
    const tran_date = this.$tran.value;
    const store_id = this.$store.value;
    const supplierInput = (this.$supplier.value||'').trim();
    const invoice_id = this.$invoice.value;
    const user_id = this.$('user_id').value;

    this.hideAllErr();
    if(!tran_date){ alert('يرجى إدخال تاريخ الحركة'); this.$tran.focus(); return; }
    if(!store_id){ alert('يرجى اختيار المخزن'); this.$store.focus(); return; }
    if(!supplierInput){ this.showErr('supplierError','المورد مطلوب'); this.$supplier.focus(); return; }
    if(!invoice_id){ this.showErr('invoiceError','رقم الفاتورة مطلوب'); this.$invoice.focus(); return; }
    if(!user_id){ alert('يرجى اختيار المستخدم'); this.$('user_id').focus(); return; }

    // 🆕 تصحيح البحث عن المورد
    const matchedSupplier = this.allSuppliers.find(s => 
      String(s.supplier_id) === supplierInput || 
      String(s.supplier_name).toLowerCase() === supplierInput.toLowerCase() ||
      String(s.supplier_id).includes(supplierInput)
    );
    
    if(!matchedSupplier){ 
      this.showErr('supplierError','المورد غير موجود في قاعدة البيانات'); 
      this.$supplier.focus(); 
      return; 
    }

    const payment_method = this.$('payment_method').value;
    const mode = this.getConnectionMode();
    const isSupabase = (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL));

    try {
      let result;
      
      if (isSupabase) {
        // وضع Supabase: حفظ كل صنف كسجل منفصل
        for(const item of this.items) {
          const payload = {
            tran_date,
            store_id: parseInt(store_id),
            supplierid: matchedSupplier.supplier_id, // 🆕 استخدام supplier_id وليس supplier_name
            invoice_id: parseInt(invoice_id),
            payment_method,
            mndop: this.$('mndop').value || '',
            user_id: parseInt(user_id),
            user_stamp: new Date().toISOString(),
            ser_no: parseInt(invoice_id),
            
            // بيانات الصنف الفعلية
            item_id: item.item_id,
            item_nm: item.item_nm,
            item_qty: item.item_qty,
            buy_price: item.buy_price,
            total_price: item.total_price,
            discount: item.discount,
            net_buy_price: item.net_buy_price,
            total_net_buy_price: item.total_net_buy_price,
            rate: item.rate || 0,
            unit: item.unit || 1,
            discount_type: item.discount_type || 'none',
            discount_value: item.discount_value || 0,
            sale_price1: item.sale_price1 || item.buy_price,
            batch_no: item.batch_no || '',
            expiry_date: item.expiry_date || null
          };
          
          // إضافة بيانات الدفع
          if(payment_method==='credit'){ 
            payload.due_date = this.$('due_date').value; 
            payload.credit_period = parseInt(this.$('credit_period').value)||30; 
            payload.payment_terms = this.$('payment_terms').value || ''; 
          }
          else if(payment_method==='check'){ 
            ['check_number','bank_name','check_date','check_holder','check_branch'].forEach(k=> {
              payload[k] = this.$(k)?.value || '';
            }); 
          }
          
          await this.saveData(this.API_PURCHASES, payload, 'POST');
        }
        result = { success: true, count: this.items.length };
      } else {
        // وضع المحلي
        const payload = {
          tran_date,
          store_id: parseInt(store_id),
          supplierid: matchedSupplier.supplier_id, // 🆕 استخدام supplier_id
          invoice_id: parseInt(invoice_id),
          payment_method,
          mndop: this.$('mndop').value,
          user_id: parseInt(user_id),
          items: this.items
        };
        
        if(payment_method==='credit'){ 
          payload.due_date = this.$('due_date').value; 
          payload.credit_period = parseInt(this.$('credit_period').value)||30; 
          payload.payment_terms = this.$('payment_terms').value; 
        }
        else if(payment_method==='check'){ 
          ['check_number','bank_name','check_date','check_holder','check_branch'].forEach(k=> payload[k]=this.$(k).value); 
        }

        result = await this.saveData(this.API_PURCHASES, payload, 'POST');
      }
      
      alert(`✅ تم حفظ ${this.items.length} صنف في الفاتورة رقم ${invoice_id}`);
      
      // تحديث الواجهة
      const newPurchase = {
        invoice_id: parseInt(invoice_id),
        tran_date,
        store_id: parseInt(store_id),
        supplierid: matchedSupplier.supplier_name, // 🆕 عرض الاسم للمستخدم
        payment_method,
        mndop: this.$('mndop').value,
        items_count: this.items.length,
        total_amount: this.items.reduce((s,i)=> s + (parseFloat(i.total_net_buy_price)||0), 0),
        items: [...this.items],
        due_date: this.$('due_date')?.value, 
        credit_period: parseInt(this.$('credit_period')?.value)||30, 
        payment_terms: this.$('payment_terms')?.value,
        check_number: this.$('check_number')?.value, 
        bank_name: this.$('bank_name')?.value, 
        check_date: this.$('check_date')?.value, 
        check_holder: this.$('check_holder')?.value, 
        check_branch: this.$('check_branch')?.value
      };
      
      this.allPurchases.unshift(newPurchase);
      this.items = [];
      this.updateItemsTable();
      this.calculateTotals();
      this.resetFormAfterSave();
      this.renderPurchasesTable();
      this.updateConnectionStatus();
      
    } catch(err){ 
      console.error('❌ خطأ في الحفظ:', err); 
      alert('حدث خطأ أثناء الحفظ: '+ (err.message||err)); 
    }
  }

  // 🆕 دالة جديدة لإعادة تعيين النموذج للصنف التالي
  resetFormForNextItem() {
    // مسح فقط حقول الصنف، والحفاظ على بيانات الفاتورة الأساسية
    ['item_id','item_qty','buy_price','total_price','discount','net_buy_price','total_net_buy_price','sale_price1','rate','discount_value','unit','batch_no','expiry_date'].forEach(id=>{
      const el = this.$(id); 
      if(el){ 
        el.value=''; 
        el.classList.add('empty-field'); 
      }
    });
    this.$('discount_type').value='none';
    this.hideAllErr();
    
    // 🆕 التركيز على حقل إدخال الصنف الجديد مباشرة
    setTimeout(() => {
      this.$('item_id').focus();
      this.$('item_id').select();
    }, 100);
  }

  // 🆕 إزالة الدوال المكررة - احتفظ بواحدة فقط
  resetFormAfterSave(){
    // مسح حقول الدفع
    ['payment_method','due_date','credit_period','payment_terms','check_number','bank_name','check_date','check_holder','check_branch','mndop'].forEach(id=>{
      const el=this.$(id); if(el){ el.value=''; if(el.value==='') el.classList.add('empty-field'); }
    });
    
    // مسح حقول الصنف
    ['item_id','item_qty','buy_price','total_price','discount','net_buy_price','total_net_buy_price','sale_price1','rate','discount_value','unit','batch_no','expiry_date'].forEach(id=>{
      const el = this.$(id); 
      if(el){ 
        el.value=''; 
        el.classList.add('empty-field'); 
      }
    });
    
    this.$('discount_type').value='none';
    this.hideAllErr();
    this.setupPaymentHandler();
    
    // التركيز على حقل الصنف
    setTimeout(() => {
      this.$('item_id').focus();
      this.$('item_id').select();
    }, 100);
  }


  // ============ تحميل بيانات من السيرفر ============
  async loadSuppliersAndItems(){
    try {
      // 🆕 استخدام دالة الجلب الجديدة
      const [suppliers, items] = await Promise.all([
        this.fetchData(`${this.BASE_API}/suppliers`).catch(() => []),
        this.fetchData(`${this.BASE_API}/items`).catch(() => [])
      ]);
      
      this.allSuppliers = suppliers || [];
      this.allItems = items || [];
      
      this.populateDatalist('suppliers-list', this.allSuppliers, 'supplier_name','supplier_id');
      this.populateDatalist('items-list', this.allItems, 'item_nm','item_id','buy_price');
    } catch(e){ console.error('load suppliers/items', e); }
  }

  populateDatalist(listId, data, textField, idField, priceField=null){
    const list = document.getElementById(listId); if(!list) return;
    list.innerHTML = '';
    data.forEach(row => { const opt=document.createElement('option'); opt.value = row[textField]||''; opt.setAttribute('data-id', row[idField]||''); if(priceField) opt.setAttribute('data-price', row[priceField]||0); list.appendChild(opt); });
  }

  async loadDropdowns(){
    const map = [{endpoint:'stores', el:'store_id', name:'store_name', id:'store_id'}, {endpoint:'users', el:'user_id', name:'username', id:'user_id'}];
    for(const m of map){
      try{
        // 🆕 استخدام دالة الجلب الجديدة
        const data = await this.fetchData(`${this.BASE_API}/${m.endpoint}`).catch(() => []);
        const sel = this.$(m.el); if(!sel) continue;
        sel.innerHTML = `<option value="">اختر ${m.el==='store_id'?'المخزن':'المستخدم'}</option>`;
        
        data.forEach(r=>{ const o=document.createElement('option'); o.value=r[m.id]; o.textContent=r[m.name]||r[m.id]; sel.appendChild(o); });
      } catch(err){ console.error('loadDropdown',err); const sel=this.$(m.el); if(sel) sel.innerHTML=`<option value="">خطأ في التحميل</option>`; }
    }
  }

  async loadPurchases(){
    try{
      console.log('🔄 جلب المشتريات من:', this.API_PURCHASES);
      this.allPurchases = await this.fetchData(this.API_PURCHASES);
      console.log('✅ تم تحميل:', this.allPurchases.length, 'فاتورة');
      this.updateConnectionStatus();
    } catch(e){ 
      console.error('❌ خطأ في تحميل المشتريات:', e); 
      this.allPurchases = []; 
    }
    this.renderPurchasesTable();
  }

  // ============ عرض وفلترة وترتيب وسجل المشتريات ============
renderPurchasesTable(){
  const tbody = this.$purchasesBody; 
  if(!tbody) {
    console.error('❌ عنصر purchasesTableBody غير موجود في الـ DOM');
    return;
  }
  
  console.log('📊 عرض المشتريات:', this.allPurchases.length, 'فاتورة');
  
  document.querySelectorAll('.sortable').forEach(th=>{ 
    th.classList.remove('asc','desc'); 
    if(th.getAttribute('data-sort')===this.currentSort.field) th.classList.add(this.currentSort.direction); 
  });

  const filtered = this.filteredPurchases();
  const sorted = this.sortPurchases(filtered);

  if(sorted.length===0){ 
    tbody.innerHTML = `<tr><td colspan="15" style="text-align:center;color:#666;padding:20px;">لا توجد فواتير في سجل المشتريات</td></tr>`; 
    this.$('pagination').innerHTML=''; 
    return; 
  }

  const totalPages = Math.ceil(sorted.length / (this.itemsPerPage==='all'?sorted.length:this.itemsPerPage));
  const start = this.itemsPerPage==='all'?0:(this.currentPage-1)*this.itemsPerPage;
  const pageItems = sorted.slice(start, this.itemsPerPage==='all'?sorted.length:start+this.itemsPerPage);

  // 🆕 عرض البيانات في الأعلى (الأحدث أولاً)
  tbody.innerHTML = pageItems.map((p,idx)=> {
    const serial = this.itemsPerPage==='all'? idx+1 : start+idx+1;
    const total = p.total_amount || (p.items||[]).reduce((s,i)=> s + (parseFloat(i.total_net_buy_price)||0),0);
    const d = p.tran_date ? new Date(p.tran_date) : null;
    const formatted = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
    
    // 🆕 عرض أول صنف من الفاتورة
    const firstItem = p.items && p.items.length > 0 ? p.items[0] : {};
    
    return `<tr>
      <td>${serial}</td>
      <td>${formatted}</td>
      <td>${p.store_id||''}</td>
      <td>${p.supplierid||''}</td>
      <td>${p.invoice_id||''}</td>
      <td>${firstItem.item_id || ''}</td>
      <td>${firstItem.item_nm || ''}</td>
      <td>${firstItem.item_qty || ''}</td>
      <td>${firstItem.buy_price ? Number(firstItem.buy_price).toFixed(2) : ''}</td>
      <td>${firstItem.total_price ? Number(firstItem.total_price).toFixed(2) : ''}</td>
      <td>${firstItem.discount ? Number(firstItem.discount).toFixed(2) : ''}</td>
      <td>${firstItem.unit || ''}</td>
      <td>${firstItem.net_buy_price ? Number(firstItem.net_buy_price).toFixed(2) : ''}</td>
      <td>${firstItem.total_net_buy_price ? Number(firstItem.total_net_buy_price).toFixed(2) : ''}</td>
      <td>${this.getPaymentMethodText(p.payment_method)}</td>
      <td>${p.mndop||''}</td>
      <td>${p.items_count || (p.items||[]).length}</td>
      <td>${total.toFixed(2)}</td>
      <td class="actions">
        <button data-inv="${p.invoice_id}" class="view-btn">👁️</button>
        <button data-inv="${p.invoice_id}" class="del-btn">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  
  this.renderPagination(totalPages);

  // إعادة ربط الأزرار
  tbody.querySelectorAll('.view-btn').forEach(b=> b.addEventListener('click', e=> this.viewPurchase(b.getAttribute('data-inv'))));
  tbody.querySelectorAll('.del-btn').forEach(b=> b.addEventListener('click', e=> this.deletePurchase(b.getAttribute('data-inv'))));
}

  renderPagination(totalPages){
    const container = this.$('pagination'); if(!container) return;
    container.innerHTML = '';
    if(this.itemsPerPage==='all' || totalPages<=1) return;
    for(let i=1;i<=totalPages;i++){
      const btn = document.createElement('button'); btn.textContent = i; btn.className = 'page-btn' + (i===this.currentPage ? ' active' : '');
      btn.onclick = ()=> { this.currentPage = i; this.renderPurchasesTable(); }; container.appendChild(btn);
    }
  }

  setSort(field, direction){ this.currentSort = { field, direction }; this.renderPurchasesTable(); }

  sortPurchases(arr){
    return arr.sort((a,b)=>{
      let av=a[this.currentSort.field], bv=b[this.currentSort.field];
      if(this.currentSort.field==='tran_date'){ av = new Date(av||0); bv = new Date(bv||0); }
      if(typeof av === 'string'){ av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if(av < bv) return this.currentSort.direction==='asc'?-1:1;
      if(av > bv) return this.currentSort.direction==='asc'?1:-1;
      return 0;
    });
  }

  filteredPurchases(){
    const q = (this.$search.value||'').toLowerCase();
    let filtered = this.allPurchases;
    if(q){
      filtered = filtered.filter(p=>{
        const top = Object.values(p||{}).some(v=>String(v||'').toLowerCase().includes(q));
        const inItems = (p.items||[]).some(it=> Object.values(it||{}).some(v=> String(v||'').toLowerCase().includes(q)));
        return top || inItems;
      });
    }
    if(this.dateFilter.from || this.dateFilter.to){
      filtered = filtered.filter(p=>{
        if(!p.tran_date) return false;
        const pd = new Date(p.tran_date);
        if(this.dateFilter.from && pd < this.dateFilter.from) return false;
        if(this.dateFilter.to && pd > this.dateFilter.to) return false;
        return true;
      });
    }
    return filtered;
  }

  applyDateFilter(){
    const f = this.$('dateFrom').value, t = this.$('dateTo').value;
    this.dateFilter.from = f ? new Date(f) : null;
    this.dateFilter.to = t ? new Date(t) : null;
    if(this.dateFilter.to) this.dateFilter.to.setHours(23,59,59,999);
    this.currentPage = 1; this.renderPurchasesTable();
  }
  resetDateFilter(){ this.$('dateFrom').value=''; this.$('dateTo').value=''; this.dateFilter.from=null; this.dateFilter.to=null; this.currentPage=1; this.renderPurchasesTable(); }

  // ============ استيراد / تصدير ============
  handleExport(){
    const fmt = this.$export.value; if(!fmt) return;
    if(this.allPurchases.length===0){ alert('لا توجد بيانات للتصدير'); this.$export.value=''; return; }
    if(fmt==='json') this.exportToJSON();
    else if(fmt==='csv') this.exportToCSV();
    else if(fmt==='xls' || fmt==='xlsx') this.exportToExcel(fmt);
    this.$export.value='';
  }

  exportToJSON(){
    const data = { exported_at: new Date().toISOString(), total_records: this.allPurchases.length, purchases: this.allPurchases };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    this.downloadBlob(blob, `purchases_${new Date().toISOString().split('T')[0]}.json`);
    alert(`✅ تم تصدير ${this.allPurchases.length} فاتورة بصيغة JSON بنجاح`);
  }

  exportToCSV(){
    const headers = ['رقم الفاتورة','التاريخ','المخزن','المورد','طريقة الدفع','اسم المندوب','عدد الأصناف','الإجمالي'];
    const rows = this.allPurchases.map(p=> [
      p.invoice_id, p.tran_date? p.tran_date.split('T')[0]:'', p.store_id, p.supplierid, this.getPaymentMethodText(p.payment_method), p.mndop||'', p.items_count|| (p.items? p.items.length:0), p.total_amount || (p.items? p.items.reduce((s,i)=> s + (parseFloat(i.total_net_buy_price)||0),0):0)
    ]);
    let csv = '\uFEFF' + headers.join(',') + "\n";
    rows.forEach(r=> csv += r.map(f=> `"${f}"`).join(',') + "\n");
    this.downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8;'}), `purchases_${new Date().toISOString().split('T')[0]}.csv`);
    alert(`✅ تم تصدير ${this.allPurchases.length} فاتورة بصيغة CSV بنجاح`);
  }

  exportToExcel(fmt){
    if(typeof XLSX !== 'undefined'){ this.exportWithSheetJS(fmt); }
    else { alert(`لتصدير بصيغة ${fmt.toUpperCase()}، يرجى تحميل مكتبة SheetJS. سيتم التصدير بصيغة CSV بدلاً من ذلك.`); this.exportToCSV(); }
  }

  exportWithSheetJS(fmt){
    const wsData = [['رقم الفاتورة','التاريخ','المخزن','المورد','طريقة الدفع','اسم المندوب','عدد الأصناف','الإجمالي']];
    this.allPurchases.forEach(p=> wsData.push([ p.invoice_id, p.tran_date? p.tran_date.split('T')[0]:'', p.store_id, p.supplierid, this.getPaymentMethodText(p.payment_method), p.mndop||'', p.items_count|| (p.items? p.items.length:0), p.total_amount || 0 ]));
    const ws = XLSX.utils.aoa_to_sheet(wsData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'المشتريات');
    const buf = XLSX.write(wb, { bookType: fmt, type: 'array' });
    this.downloadBlob(new Blob([buf],{type:'application/vnd.ms-excel'}), `purchases_${new Date().toISOString().split('T')[0]}.${fmt}`);
    alert(`✅ تم تصدير ${this.allPurchases.length} فاتورة بصيغة ${fmt.toUpperCase()} بنجاح`);
  }

  downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  parseCSV(text){
    const lines = text.split('\n').filter(l=>l.trim()); const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'')); 
    const purchases = lines.slice(1).map(line=>{
      const vals = line.split(',').map(v=> v.trim().replace(/^"|"$/g,''));
      const p = {};
      headers.forEach((h,i)=>{
        const mapped = this.mapHeaderToField(h);
        if(vals[i] && vals[i]!== '') p[mapped] = ['رقم الفاتورة','المخزن','عدد الأصناف','الإجمالي'].includes(h) ? parseFloat(vals[i])||0 : vals[i];
      });
      return p;
    });
    return { purchases };
  }

  mapHeaderToField(header){
    const m = { 'رقم الفاتورة':'invoice_id','التاريخ':'tran_date','المخزن':'store_id','المورد':'supplierid','طريقة الدفع':'payment_method','اسم المندوب':'mndop','عدد الأصناف':'items_count','الإجمالي':'total_amount' };
    return m[header] || header;
  }

  importData(event){
    const file = event.target.files[0]; if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase(); const reader = new FileReader();
    reader.onload = e=>{
      try{
        let imported;
        if(ext==='json') imported = JSON.parse(e.target.result);
        else if(ext==='csv') imported = this.parseCSV(e.target.result);
        else { alert('صيغة غير مدعومة، استخدم JSON أو CSV'); event.target.value=''; return; }
        if(!imported.purchases || !Array.isArray(imported.purchases)) throw new Error('هيكل الملف غير صحيح');
        if(confirm(`هل تريد استيراد ${imported.purchases.length} فاتورة؟`)) this.processImportedData(imported.purchases);
      } catch(err){ console.error('import',err); alert('خطأ في الاستيراد: '+err.message); }
      event.target.value='';
    };
    reader.readAsText(file);
  }

  processImportedData(purchases){
    let success=0, duplicate=0, missing=0, errors=0; const missingList=[];
    purchases.forEach(p=>{
      try{
        if(!p.invoice_id || !p.store_id || !p.supplierid){ errors++; return; }
        if(this.allPurchases.some(ap=> String(ap.invoice_id) === String(p.invoice_id) && String(ap.tran_date||'').split('T')[0] === String((p.tran_date||'').split('T')[0]) )){ duplicate++; return; }
        if(p.items && Array.isArray(p.items)){
          const miss = p.items.filter(it=> !this.isItemExists(it.item_id, it.item_nm)).map(it=> `${it.item_id} - ${it.item_nm}`);
          if(miss.length){ missing++; missingList.push({invoice_id:p.invoice_id, missing: miss}); return; }
        }
        this.allPurchases.unshift({ invoice_id: p.invoice_id, tran_date: p.tran_date || new Date().toISOString(), store_id: p.store_id, supplierid: p.supplierid, payment_method: p.payment_method||'cash', mndop:p.mndop||'', user_id:p.user_id||1, items_count:p.items_count|| (p.items? p.items.length:0), total_amount:p.total_amount||0, items:p.items||[] });
        success++;
      } catch(e){ errors++; console.error(e); }
    });
    this.renderPurchasesTable();
    let msg = `✅ تم استيراد ${success} فاتورة\n`;
    if(duplicate) msg += `⚠️ تم تجاهل ${duplicate} فاتورة مكررة\n`;
    if(missing){ msg += `⚠️ تم تجاهل ${missing} فاتورة لوجود أصناف مفقودة\n`; missingList.forEach(m=> msg += `\nالفاتورة ${m.invoice_id}:\n` + m.missing.map(x=>'  - '+x).join('\n') + '\n'); }
    if(errors) msg += `❌ فشل ${errors} فاتورة بسبب أخطاء\n`;
    alert(msg);
  }

  isItemExists(itemId, itemName){ return this.allItems.some(it => String(it.item_id) === String(itemId) || it.item_nm === itemName); }

  // ============ عرض، حذف ============
  viewPurchase(invoiceId){
    const p = this.allPurchases.find(x=> String(x.invoice_id) === String(invoiceId));
    if(!p){ alert('السجل غير موجود'); return; }
    let itemsList = 'لا توجد أصناف';
    if(p.items && p.items.length>0){ const display = p.items.slice(0,50); itemsList = display.map(it=> `${it.item_id} - ${it.item_nm}: ${it.item_qty} × ${it.buy_price} = ${it.total_price}`).join('\n'); if(p.items.length>50) itemsList += `\n\n... و ${p.items.length-50} صنف إضافي`; }
    let payDet = '';
    if(p.payment_method==='credit') payDet = `\nتفاصيل الدفع الآجل:\n- تاريخ الاستحقاق: ${p.due_date||'غير محدد'}\n- فترة السماح: ${p.credit_period||30} يوم\n- شروط: ${p.payment_terms||'لا توجد'}`;
    else if(p.payment_method==='check') payDet = `\nتفاصيل الشيك:\n- رقم الشيك: ${p.check_number||'غير محدد'}\n- البنك: ${p.bank_name||'غير محدد'}\n- تاريخ الشيك: ${p.check_date||'غير محدد'}`;
    alert(`تفاصيل الفاتورة ${invoiceId}:\n\nالمخزن: ${p.store_id}\nالمورد: ${p.supplierid}\nطريقة الدفع: ${this.getPaymentMethodText(p.payment_method)}\nاسم المندوب: ${p.mndop||'غير محدد'}\nعدد الأصناف: ${p.items_count || (p.items||[]).length}${payDet}\n\nالأصناف:\n${itemsList}`);
  }

  async deletePurchase(invoiceId){
    if(!confirm('هل تريد حذف هذه الفاتورة؟')) return;
    try{
      const res = await fetch(`${this.API_PURCHASES}/${encodeURIComponent(invoiceId)}`, { method:'DELETE' });
      if(!res.ok) throw new Error('فشل الحذف');
      this.allPurchases = this.allPurchases.filter(p => String(p.invoice_id) !== String(invoiceId));
      this.renderPurchasesTable();
      alert('✅ تم الحذف');
    } catch(e){ console.error('delete',e); alert('حدث خطأ أثناء الحذف'); }
  }

  getPaymentMethodText(m){ const methods = { 'cash':'نقدي','credit':'آجل','check':'شيك' }; return methods[m]||m||'نقدي'; }

  printInvoice() {

        const printType = document.getElementById("printType")?.value || "a4";
        const username = document.getElementById("user_id")?.selectedOptions[0]?.textContent || "";
        const companyName = "اسم الشركة / المؤسسة";
        const now = new Date();
        const printDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

        if (this.__printWindow && !this.__printWindow.closed) {
            this.__printWindow.focus();
            return;
        }


        const items = this.items;
        if (!items.length){
            alert("لا توجد أصناف للطباعة");
            return;
        }

        let pageWidth = "210mm";     // A4 الافتراضي
        let fontSize = "14px";

        if (printType === "thermal58"){
            pageWidth = "58mm";
            fontSize = "11px";
        }

        if (printType === "thermal80"){
            pageWidth = "80mm";
            fontSize = "12px";
        }

        this.__printWindow = window.open('', '', 'width=800,height=600');
        const win = this.__printWindow;


        win.document.write(`
        <html lang="ar" dir="rtl">
        <head>
        <title>فاتورة مشتريات</title>
        <style>
            body {
            font-family: "Cairo", sans-serif;
            direction: rtl;
            width: ${pageWidth};
            margin: 0 auto;
            font-size: ${fontSize};
            text-align: right;
            }
            h2 { text-align: center; margin: 4px 0; }
            .header { margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 3px; text-align: center; }
            .summary { margin-top: 8px; font-weight: bold; }
        </style>
        </head>
        <body>

        <div class="header">
            <b>${companyName}</b><br>
            المستخدم: ${username}<br>
            التاريخ: ${printDate}
        </div>

        <h2>فاتورة مشتريات</h2>

        <table>
            <thead>
            <tr>
                <th>م</th><th>كود</th><th>اسم</th><th>كمية</th><th>شراء</th><th>خصم</th><th>وحدة</th><th>صافى</th><th>إجمالى</th>
            </tr>
            </thead>
            <tbody>
            ${items.map((it, i) => `
            <tr>
                <td>${i+1}</td>
                <td>${it.item_id}</td>
                <td>${it.item_nm}</td>
                <td>${it.item_qty}</td>
                <td>${(+it.buy_price).toFixed(2)}</td>
                <td>${(+it.discount).toFixed(2)}</td>
                <td>${it.unit}</td>
                <td>${(+it.net_buy_price).toFixed(2)}</td>
                <td>${(+it.total_net_buy_price).toFixed(2)}</td>
            </tr>`).join('')}
            </tbody>
        </table>

        <div class="summary">
            عدد الأصناف: ${items.length}<br>
            إجمالي الفاتورة: ${document.getElementById('total_invoice').value}<br>
            إجمالي الخصومات: ${document.getElementById('total_discount').value}<br>
            الصافي النهائي: ${document.getElementById('final_net_total').value}
        </div>

        </body>
        </html>
        `);

        win.document.close();
        win.print();
    }


   async updateExpiryDates(){
      if(!confirm("سيتم نقل الأصناف منتهية الصلاحية إلى جدول expired_items وتحديث الفروع.\nهل تريد المتابعة؟")) 
        return;

      try {
        const res = await fetch(`${this.API_PURCHASES}/update-expiry`, { method:"POST" });        
        const result = await res.json();
        if(!res.ok) throw new Error(result.error || JSON.stringify(result));

        alert(`✅ تمت العملية بنجاح:
        - عدد الأصناف المنتهية: ${result.expiredMoved}
        - عدد الأصناف التي تم تحديث صلاحيتها: ${result.updated}`);

      } catch (err){
        console.error(err);
        alert("❌ حدث خطأ أثناء تحديث الصلاحيات:\n" + err.message);
      }
    }
 
}
// init
const purchaseManager = new PurchaseManager();
// expose for template functions (زر حذف الصنف)
window.removeItem = (index) => { 
  if(confirm('هل تريد حذف هذا الصنف؟')){
    purchaseManager.items.splice(index,1); 
    purchaseManager.updateItemsTable(); 
    purchaseManager.calculateTotals(); 
  }  
};

