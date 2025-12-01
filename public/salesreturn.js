class SalesReturnApp {
    constructor() {
        // ثوابت Supabase
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

        // تهيئة state موحد
        this.state = {
            // حالة التطبيق
            originalInvoice: null,
            returnLines: [],
            currentItem: null,
            currentStore: null,
            currentMode: 'with-invoice',
            searchTimer: null,
            user: null,
            
            // Supabase وإعدادات الاتصال
            supabase: null,
            useSupabase: true,
            baseURL: 'http://localhost:3000',
            stores: [],
            
            // عناصر DOM
            dom: null
        };
        
        // تهيئة DOM
        this.state.dom = this._initDOM();
        
        // استدعاء دوال التهيئة
        this._initSupabase();
        this._bindEvents();
        this.initEventListeners();
        this.loadConnectionState();
        this.init();
    }

    _initDOM() {
        return {
            connectionToggle: document.getElementById('connectionToggle'),
            printInfo: document.getElementById('printInfo'),
            storeSelect: document.getElementById('storeSelect'),
            invoiceSearch: document.getElementById('searchInvoice'),
            itemSearch: document.getElementById('itemSearch'),
            itemsTable: document.getElementById('returnItemsList'),
            totalQuantity: document.getElementById('totalQty'),
            totalAmount: document.getElementById('totalAmount'),
            saveBtn: document.getElementById('saveBtn'),
            newReturnBtn: document.getElementById('newReturnBtn'),
            totalItems: document.getElementById('totalItems'),
            customerRefund: document.getElementById('customerRefund'),
            returnQty: document.getElementById('returnQty'),
            returnPrice: document.getElementById('returnPrice'),
            returnReason: document.getElementById('returnReason'),
            returnRemarks: document.getElementById('returnRemarks')
        };
    }

    _initSupabase() {
        if (this.state.useSupabase) {
            try {
                this.state.supabase = supabase.createClient(
                    this.SUPABASE_URL,
                    this.SUPABASE_KEY
                );
                console.log("✅ تم تهيئة Supabase لمرتجع المبيعات");
            } catch (error) {
                console.error("❌ فشل تهيئة Supabase:", error);
                this.state.useSupabase = false;
                this._updateConnectionUI();
            }
        }
    }

    _bindEvents() {
        // اختصار لوحة المفاتيح للتبديل
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                this.toggleConnection();
            }
        });

        // التنقل ب Enter بين الحقول
        this._setupEnterNavigation();
    }

    _setupEnterNavigation() {
        // زر Enter في البحث عن الصنف
        this.state.dom.itemSearch?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchItem(this.state.dom.itemSearch.value);
            }
        });

        // زر Enter في البحث عن الفاتورة
        this.state.dom.invoiceSearch?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.searchInvoice();
            }
        });

        // زر Enter في كمية المرتجع - الانتقال للسعر
        this.state.dom.returnQty?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.state.dom.returnPrice) {
                    this.state.dom.returnPrice.focus();
                    this.state.dom.returnPrice.select();
                }
            }
        });

        // زر Enter في سعر المرتجع - الانتقال للإضافة
        this.state.dom.returnPrice?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addReturnItem();
            }
        });

        // زر Enter في سبب الإرجاع - الانتقال للملاحظات
        this.state.dom.returnReason?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.state.dom.returnRemarks) {
                    this.state.dom.returnRemarks.focus();
                }
            }
        });

        // زر Enter في الملاحظات - إضافة الصنف
        this.state.dom.returnRemarks?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addReturnItem();
            }
        });
    }

    initEventListeners() {
        // البحث عن الفاتورة
        this.state.dom.invoiceSearch?.addEventListener('input', (e) => {
            this.handleInvoiceSearch(e.target.value);
        });

        // البحث عن الصنف
        this.state.dom.itemSearch?.addEventListener('input', (e) => {
            this.handleItemSearch(e.target.value);
        });

        // تغيير المخزن
        this.state.dom.storeSelect?.addEventListener('change', (e) => {
            this.state.currentStore = e.target.value;
            console.log(`🏪 تم اختيار المخزن: ${this.state.currentStore}`);
        });

        // إضافة زر الإضافة للمرتجع
        document.getElementById('addItemBtn')?.addEventListener('click', () => {
            this.addReturnItem();
        });

        // أزرار التبويب
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                this.setMode(tabId);
            });
        });
    }

    loadConnectionState() {
        const saved = localStorage.getItem('salesReturn_useSupabase');
        if (saved !== null) {
            this.state.useSupabase = JSON.parse(saved);
        }
        this._updateConnectionUI();
    }

    _saveConnectionState() {
        localStorage.setItem('salesReturn_useSupabase', JSON.stringify(this.state.useSupabase));
    }

    toggleConnection() {
        this.state.useSupabase = !this.state.useSupabase;
        this._updateConnectionUI();
        this._saveConnectionState();
        
        // إعادة تحميل البيانات تلقائياً
        this._loadStores();
        console.log(`🔄 تم التبديل إلى: ${this.state.useSupabase ? 'Supabase' : 'API التقليدي'}`);
    }

    _updateConnectionUI() {
        if (this.state.dom.connectionToggle) {
            const isSupabase = this.state.useSupabase;
            this.state.dom.connectionToggle.textContent = 
                isSupabase ? '🟢 Supabase' : '🔵 API التقليدي';
            this.state.dom.connectionToggle.title = 
                isSupabase ? 'الاتصال مع Supabase - Ctrl+T للتبديل' : 'الاتصال مع API التقليدي - Ctrl+T للتبديل';
        }
    }

    async init() {
        await this._loadStores();
        this._updateConnectionUI();
        console.log("✅ تم تهيئة نظام مرتجعات المبيعات");
    }

    async _loadStores() {
        console.log("🔄 جلب المخازن - المحاولة مع Supabase أولاً");
        
        // المحاولة الأولى مع Supabase
        if (this.state.useSupabase && this.state.supabase) {
            try {
                const { data, error } = await this.state.supabase
                    .from('stores')
                    .select('*')
                    .order('store_name');
                
                if (!error && data) {
                    console.log("✅ تم جلب المخازن من Supabase");
                    this.state.stores = data;
                    this._populateStoreSelect();
                    return;
                }
            } catch (error) {
                console.log("❌ فشل جلب المخازن من Supabase:", error);
            }
        }
        
        // المحاولة الثانية مع API التقليدي
        try {
            console.log("🔄 المحاولة مع API التقليدي...");
            const response = await fetch(`${this.state.baseURL}/api/stores`);
            
            if (response.ok) {
                const data = await response.json();
                console.log("✅ تم جلب المخازن من API التقليدي");
                this.state.stores = data;
                this._populateStoreSelect();
                
                // تبديل تلقائي للوضع التقليدي
                this.state.useSupabase = false;
                this._updateConnectionUI();
                this._saveConnectionState();
            }
        } catch (error) {
            console.error("❌ فشل جلب المخازن من كلا المصدرين:", error);
            this._showError("فشل في الاتصال بالخادم. تأكد من اتصال الإنترنت.");
        }
    }

    _populateStoreSelect() {
        if (!this.state.dom.storeSelect) return;
        
        this.state.dom.storeSelect.innerHTML = '<option value="">اختر المخزن...</option>';
        
        this.state.stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.store_id;
            option.textContent = store.store_name;
            this.state.dom.storeSelect.appendChild(option);
        });
    }

    // البحث عن الفاتورة
    handleInvoiceSearch(searchTerm) {
        clearTimeout(this.state.searchTimer);
        
        if (searchTerm.length < 1) {
            this.state.originalInvoice = null;
            this._clearInvoiceResults();
            return;
        }
        
        this.state.searchTimer = setTimeout(async () => {
            if (searchTerm.length >= 1) {
                await this.searchInvoice();
            }
        }, 500);
    }

    async searchInvoice() {
        const invoiceNumber = this.state.dom.invoiceSearch.value;
        
        if (!invoiceNumber) {
            this._showError("يرجى إدخال رقم الفاتورة");
            return;
        }
        
        console.log(`🔍 البحث عن الفاتورة: ${invoiceNumber}`);
        
        try {
            let invoiceData = null;
            
            if (this.state.useSupabase && this.state.supabase) {
                // البحث في جدول sales باستخدام invoice_id
                const { data, error } = await this.state.supabase
                    .from('sales')
                    .select('*')
                    .eq('invoice_id', invoiceNumber)
                    .limit(1);
                
                if (!error && data && data.length > 0) {
                    invoiceData = {
                        invoice_id: invoiceNumber,
                        tran_date: data[0].tran_date,
                        store_id: data[0].store_id,
                        customer_id: data[0].customer_id,
                        items: []
                    };
                    
                    // جلب جميع أصناف الفاتورة
                    const { data: saleItems, error: itemsError } = await this.state.supabase
                        .from('sales')
                        .select('*')
                        .eq('invoice_id', invoiceNumber);
                    
                    if (!itemsError && saleItems) {
                        invoiceData.items = saleItems;
                        
                        // جلب أسماء الأصناف من جدول items
                        for (let item of invoiceData.items) {
                            const itemInfo = await this._getItemInfo(item.item_id);
                            item.item_name = itemInfo.item_name;
                            item.item_code = itemInfo.item_code;
                        }
                    }
                    
                    console.log("✅ تم العثور على الفاتورة مع الأصناف:", invoiceData.items.length);
                }
            } else {
                // البحث في API التقليدي
                const response = await fetch(
                    `${this.state.baseURL}/api/salesreturnbk/invoice/${invoiceNumber}`
                );
                
                if (response.ok) {
                    invoiceData = await response.json();
                }
            }
            
            if (invoiceData) {
                this.state.originalInvoice = invoiceData;
                this._displayInvoiceResults(invoiceData);
                console.log("✅ تم العثور على الفاتورة");
            } else {
                this._showError("لم يتم العثور على الفاتورة");
                this._clearInvoiceResults();
            }
        } catch (error) {
            console.error("❌ خطأ في البحث عن الفاتورة:", error);
            this._showError("خطأ في البحث عن الفاتورة");
            this._clearInvoiceResults();
        }
    }

    async _getItemInfo(itemId) {
        if (this.state.useSupabase && this.state.supabase) {
            try {
                const { data, error } = await this.state.supabase
                    .from('items')
                    .select('item_nm, item_code')
                    .eq('item_id', itemId)
                    .single();
                
                if (!error && data) {
                    return {
                        item_name: data.item_nm,
                        item_code: data.item_code
                    };
                }
            } catch (error) {
                console.error('خطأ في جلب معلومات الصنف:', error);
            }
        }
        return {
            item_name: itemId,
            item_code: itemId
        };
    }

    _displayInvoiceResults(invoice) {
        const resultsDiv = document.getElementById('invoiceResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            let itemsHtml = '';
            
            if (invoice.items && invoice.items.length > 0) {
                itemsHtml = invoice.items.map(item => `
                    <div class="search-item" onclick="app.selectInvoiceItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                        <div>
                            <strong>${item.item_code || item.item_id}</strong>
                            <div class="text-muted small">${item.item_name || item.item_id}</div>
                        </div>
                        <div>
                            <small>الكمية: ${item.item_qty}</small><br>
                            <small>السعر: ${item.sale_price} ريال</small>
                        </div>
                    </div>
                `).join('');
            }
            
            resultsDiv.innerHTML = `
                <div class="invoice-info">
                    <strong>فاتورة #${invoice.invoice_id}</strong><br>
                    <small>التاريخ: ${new Date(invoice.tran_date).toLocaleDateString('ar-SA')}</small><br>
                    <small>عدد الأصناف: ${invoice.items?.length || 0}</small>
                    ${itemsHtml ? `
                        <div class="mt-2">
                            <strong>أصناف الفاتورة:</strong>
                            <div class="search-results">${itemsHtml}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }

    _clearInvoiceResults() {
        const resultsDiv = document.getElementById('invoiceResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }

    // البحث عن الصنف (للوضع بدون فاتورة)
    handleItemSearch(searchTerm) {
        clearTimeout(this.state.searchTimer);
        
        if (searchTerm.length < 1) {
            this._clearItemResults();
            return;
        }
        
        this.state.searchTimer = setTimeout(async () => {
            await this.searchItem(searchTerm);
        }, 300);
    }

    async searchItem(itemName) {
        console.log(`🔍 البحث عن الصنف: ${itemName}`);
        
        try {
            let items = [];
            
            if (this.state.useSupabase && this.state.supabase) {
                // البحث في جدول items أولاً
                const { data: itemsData, error: itemsError } = await this.state.supabase
                    .from('items')
                    .select('item_id, item_nm, item_code')
                    .or(`item_nm.ilike.%${itemName}%,item_code.ilike.%${itemName}%`)
                    .limit(10);
                
                if (!itemsError && itemsData) {
                    items = itemsData;
                    
                    // التحقق من وجود الأصناف في المبيعات وجلب آخر سعر بيع
                    for (let item of items) {
                        const { data: lastSale, error: saleError } = await this.state.supabase
                            .from('sales')
                            .select('sale_price, tran_date')
                            .eq('item_id', item.item_id)
                            .order('tran_date', { ascending: false })
                            .limit(1)
                            .single();
                        
                        if (!saleError && lastSale) {
                            item.last_sale_price = lastSale.sale_price;
                            item.exists_in_sales = true;
                        } else {
                            item.last_sale_price = 0;
                            item.exists_in_sales = false;
                        }
                    }
                }
            } else {
                const response = await fetch(
                    `${this.state.baseURL}/api/items/search?name=${encodeURIComponent(itemName)}`
                );
                
                if (response.ok) {
                    items = await response.json();
                }
            }
            
            if (items && items.length > 0) {
                this._displayItemResults(items);
            } else {
                this._showError("لم يتم العثور على أصناف");
                this._clearItemResults();
            }
        } catch (error) {
            console.error("❌ خطأ في البحث عن الأصناف:", error);
            this._showError("خطأ في البحث عن الأصناف");
            this._clearItemResults();
        }
    }

    _displayItemResults(items) {
        const resultsDiv = document.getElementById('itemResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = items.map(item => `
                <div class="search-item" onclick="app.selectItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                    <div>
                        <strong>${item.item_code || item.item_id}</strong>
                        <div class="text-muted small">${item.item_nm || 'لا يوجد اسم'}</div>
                        ${!item.exists_in_sales ? '<small class="text-warning">⚠️ غير موجود في المبيعات</small>' : ''}
                    </div>
                    <div>
                        <small>آخر سعر: ${item.last_sale_price || 0} ريال</small>
                        ${item.exists_in_sales ? '<div class="text-success">✓ موجود في المبيعات</div>' : ''}
                    </div>
                </div>
            `).join('');
        }
    }

    _clearItemResults() {
        const resultsDiv = document.getElementById('itemResults');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }

    selectItem(item) {
        this.state.currentItem = item;
        this.state.dom.itemSearch.value = `${item.item_code || item.item_id} - ${item.item_nm}`;
        
        // تحديث السعر تلقائياً
        if (this.state.dom.returnPrice) {
            this.state.dom.returnPrice.value = item.last_sale_price || 0;
        }
        
        // إظهار تحذير إذا لم يكن موجوداً في المبيعات
        if (!item.exists_in_sales) {
            this._showError("⚠️ هذا الصنف غير موجود في سجل المبيعات");
        }
        
        // التركيز على حقل الكمية
        if (this.state.dom.returnQty) {
            this.state.dom.returnQty.focus();
            this.state.dom.returnQty.select();
        }
        
        this._clearItemResults();
        console.log("✅ تم اختيار الصنف:", item.item_nm);
    }

    selectInvoiceItem(item) {
        this.state.currentItem = {
            item_id: item.item_id,
            item_nm: item.item_name || item.item_id,
            item_code: item.item_code || item.item_id,
            last_sale_price: item.sale_price,
            exists_in_sales: true
        };
        
        // تحديث الحقول تلقائياً
        if (this.state.dom.itemSearch) {
            this.state.dom.itemSearch.value = `${item.item_code || item.item_id} - ${item.item_name || item.item_id}`;
        }
        
        if (this.state.dom.returnPrice) {
            this.state.dom.returnPrice.value = item.sale_price || 0;
        }
        
        if (this.state.dom.returnQty) {
            this.state.dom.returnQty.value = item.item_qty || 1;
            this.state.dom.returnQty.focus();
            this.state.dom.returnQty.select();
        }
        
        console.log("✅ تم اختيار صنف من الفاتورة:", item.item_id);
    }

    addReturnItem() {
        if (!this.state.currentItem) {
            this._showError("يجب اختيار الصنف أولاً");
            return;
        }

        if (!this.state.currentStore && this.state.currentMode === 'without-invoice') {
            this._showError("يجب اختيار المخزن أولاً");
            return;
        }

        // التحقق من وجود الصنف في المبيعات (للحالة بدون فاتورة)
        if (this.state.currentMode === 'without-invoice' && !this.state.currentItem.exists_in_sales) {
            if (!confirm("⚠️ هذا الصنف غير موجود في سجل المبيعات. هل تريد الاستمرار في إضافته؟")) {
                return;
            }
        }

        const quantity = parseFloat(this.state.dom.returnQty?.value) || 0;
        const price = parseFloat(this.state.dom.returnPrice?.value) || this.state.currentItem.last_sale_price || 0;
        const reason = this.state.dom.returnReason?.value || 'تالف';
        const remarks = this.state.dom.returnRemarks?.value || '';

        if (quantity <= 0) {
            this._showError("يجب إدخال كمية صحيحة");
            return;
        }

        const returnLine = {
            item_id: this.state.currentItem.item_id,
            item_code: this.state.currentItem.item_code || this.state.currentItem.item_id,
            item_name: this.state.currentItem.item_nm || this.state.currentItem.item_id,
            quantity: quantity,
            price: price,
            total: quantity * price,
            reason: reason,
            remarks: remarks,
            store_id: this.state.currentStore,
            exists_in_sales: this.state.currentItem.exists_in_sales,
            timestamp: new Date().toISOString()
        };

        this.state.returnLines.push(returnLine);
        this._updateReturnTable();
        this._updateTotals();
        this._clearItemForm();

        console.log("✅ تم إضافة صنف للمرتجع");
        this._showSuccess("تم إضافة الصنف للمرتجع بنجاح");
    }

    _updateReturnTable() {
        if (!this.state.dom.itemsTable) return;

        const itemsHTML = this.state.returnLines.map((line, index) => `
            <div class="item-row ${!line.exists_in_sales ? 'warning-row' : ''}">
                <div>${index + 1}</div>
                <div>
                    <strong>${line.item_code}</strong><br>
                    <small class="text-muted">${line.item_name}</small>
                    ${!line.exists_in_sales ? '<br><small class="text-warning">⚠️ غير موجود في المبيعات</small>' : ''}
                </div>
                <div>${line.quantity}</div>
                <div>${line.price.toFixed(2)}</div>
                <div>${line.total.toFixed(2)}</div>
                <div>${line.reason}</div>
                <div>
                    <button class="btn btn-danger btn-sm" onclick="app.removeReturnLine(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        this.state.dom.itemsTable.innerHTML = `
            <div class="item-row header">
                <div>#</div>
                <div>الصنف</div>
                <div>الكمية</div>
                <div>السعر</div>
                <div>الإجمالي</div>
                <div>السبب</div>
                <div>إجراءات</div>
            </div>
            ${itemsHTML}
        `;
    }

    _updateTotals() {
        const totalQty = this.state.returnLines.reduce((sum, line) => sum + line.quantity, 0);
        const totalAmount = this.state.returnLines.reduce((sum, line) => sum + line.total, 0);

        if (this.state.dom.totalQuantity) {
            this.state.dom.totalQuantity.textContent = totalQty;
        }
        if (this.state.dom.totalAmount) {
            this.state.dom.totalAmount.textContent = totalAmount.toFixed(2);
        }
        if (this.state.dom.totalItems) {
            this.state.dom.totalItems.textContent = this.state.returnLines.length;
        }
        if (this.state.dom.customerRefund) {
            this.state.dom.customerRefund.textContent = totalAmount.toFixed(2);
        }
    }

    _clearItemForm() {
        this.state.currentItem = null;
        this.state.dom.itemSearch.value = '';
        if (this.state.dom.returnQty) this.state.dom.returnQty.value = '1';
        if (this.state.dom.returnPrice) this.state.dom.returnPrice.value = '';
        if (this.state.dom.returnRemarks) this.state.dom.returnRemarks.value = '';
        
        // التركيز على البحث عن الصنف
        if (this.state.dom.itemSearch) {
            this.state.dom.itemSearch.focus();
        }
        
        this._clearItemResults();
    }

    removeReturnLine(index) {
        this.state.returnLines.splice(index, 1);
        this._updateReturnTable();
        this._updateTotals();
        console.log("🗑️ تم حذف صنف من المرتجع");
        this._showSuccess("تم حذف الصنف من المرتجع");
    }

    // الدوال الجديدة
    setMode(mode) {
        this.state.currentMode = mode;
        
        // تحديث الواجهة
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const activeTab = document.querySelector(`[data-tab="${mode}"]`);
        const activeContent = document.getElementById(mode);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        // إعادة تعيين البيانات
        this._clearInvoiceResults();
        this._clearItemResults();
        
        // التركيز على الحقل المناسب
        if (mode === 'with-invoice') {
            this.state.dom.invoiceSearch?.focus();
        } else {
            this.state.dom.itemSearch?.focus();
        }
        
        console.log(`🎛️ تم التبديل إلى: ${mode === 'with-invoice' ? 'مرتجع بفاتورة' : 'مرتجع بدون فاتورة'}`);
    }

    cancelReturn() {
        if (confirm("هل أنت متأكد من إلغاء المرتجع؟ سيتم فقدان جميع البيانات.")) {
            this.newReturn();
            this._showSuccess("تم إلغاء المرتجع بنجاح");
        }
    }

    async processReturn() {
        if (this.state.returnLines.length === 0) {
            this._showError("لا توجد أصناف في المرتجع");
            return;
        }

        if (!this.state.currentStore && this.state.currentMode === 'without-invoice') {
            this._showError("يجب اختيار المخزن");
            return;
        }

        try {
            const success = await this.saveReturn();
            if (success) {
                this._showSuccess("✅ تم معالجة المرتجع بنجاح");
                this.newReturn();
            } else {
                this._showError("❌ فشل في حفظ المرتجع");
            }
        } catch (error) {
            this._showError("❌ فشل في معالجة المرتجع");
        }
    }

    async saveReturn() {
        const returnData = {
            store_id: this.state.currentStore,
            lines: this.state.returnLines,
            original_invoice: this.state.originalInvoice,
            mode: this.state.currentMode,
            created_at: new Date().toISOString(),
            connection_type: this.state.useSupabase ? 'supabase' : 'api'
        };

        try {
            let success = false;

            if (this.state.useSupabase && this.state.supabase) {
                // حفظ في جدول sales_return مباشرة
                const returnLinesData = returnData.lines.map(line => ({
                    tran_date: new Date().toISOString(),
                    store_id: returnData.store_id,
                    invoice_id: this.state.originalInvoice?.invoice_id || Math.floor(Math.random() * 1000000),
                    item_id: line.item_id,
                    item_qty: line.quantity,
                    sale_price: line.price,
                    total_price: line.total,
                    user_id: 1, // افتراضي - يمكن جلب من المستخدم
                    return_reason: line.reason,
                    remarks: line.remarks
                }));

                const { error } = await this.state.supabase
                    .from('sales_return')
                    .insert(returnLinesData);

                success = !error;
            } else {
                const response = await fetch(`${this.state.baseURL}/api/salesreturns`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(returnData)
                });
                success = response.ok;
            }

            return success;
        } catch (error) {
            console.error("❌ خطأ في حفظ المرتجع:", error);
            return false;
        }
    }

    newReturn() {
        this.state.originalInvoice = null;
        this.state.returnLines = [];
        this.state.currentItem = null;
        this.state.currentStore = null;

        this.state.dom.invoiceSearch.value = '';
        this.state.dom.itemSearch.value = '';
        if (this.state.dom.storeSelect) {
            this.state.dom.storeSelect.value = '';
        }

        if (this.state.dom.returnQty) this.state.dom.returnQty.value = '1';
        if (this.state.dom.returnPrice) this.state.dom.returnPrice.value = '';
        if (this.state.dom.returnRemarks) this.state.dom.returnRemarks.value = '';

        this._clearInvoiceResults();
        this._clearItemResults();
        this._updateReturnTable();
        this._updateTotals();

        // التركيز على البحث
        if (this.state.currentMode === 'with-invoice') {
            this.state.dom.invoiceSearch?.focus();
        } else {
            this.state.dom.itemSearch?.focus();
        }

        console.log("🆕 بدء مرتجع جديد");
    }

    _showError(message) {
        this._showToast(message, 'error');
        console.error(`❌ ${message}`);
    }

    _showSuccess(message) {
        this._showToast(message, 'success');
        console.log(`✅ ${message}`);
    }

    _showToast(message, type = 'success') {
        try {
            // استخدام SweetAlert إذا كان متوفراً، أو التنبيه العادي
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: type === 'success' ? 'success' : 'error',
                    title: type === 'success' ? 'نجح' : 'خطأ',
                    text: message,
                    timer: 3000,
                    showConfirmButton: false
                });
            } else {
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.textContent = message;
                    toast.style.background = type === 'success' ? '#28a745' : '#dc3545';
                    toast.style.display = 'block';
                    
                    setTimeout(() => {
                        toast.style.display = 'none';
                    }, 3000);
                } else {
                    alert(message);
                }
            }
        } catch (error) {
            alert(message);
        }
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.app = new SalesReturnApp();
});