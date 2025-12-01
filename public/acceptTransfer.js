// acceptTransfer.js - نظام قبول التحويلات الهجين
class AcceptTransferApp {
    constructor() {
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        
        this.supabase = null;
        this.currentTransfer = null;
        this.currentStoreId = null;
        this.state = {
            currentStore: null,
            incomingTransfers: [],
            selectedTransfer: null,
            transferDetails: [],
            selectedTransferNo: null,
            stores: []
        };
        
        this.dom = this._initDOM();
        this.supabase = this._initSupabase();
        
        // ✅ ربط الدوال بـ this لحل المشكلة
        this.renderIncomingTransfers = this.renderIncomingTransfers.bind(this);
        this.loadIncomingTransfers = this.loadIncomingTransfers.bind(this);
        this.selectTransfer = this.selectTransfer.bind(this);
        this.acceptTransfer = this.acceptTransfer.bind(this);
        this.rejectTransfer = this.rejectTransfer.bind(this);
        this.partialAcceptTransfer = this.partialAcceptTransfer.bind(this);
        this.updatePartialQty = this.updatePartialQty.bind(this);
        this.switchConnectionMode = this.switchConnectionMode.bind(this);
        
        this._bindEvents();
        this.init();
    }

    // ✅ تهيئة Supabase
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

    // ✅ الحصول على وضع الاتصال الحالي
    getConnectionMode() {
        return localStorage.getItem('connection_mode') || 
               sessionStorage.getItem('connection_mode') || 
               'auto';
    }

    // ✅ تحديث شريط حالة الاتصال
    updateConnectionStatus() {
        const statusDiv = document.getElementById('connectionStatus');
        if (!statusDiv) {
            console.warn('❌ connectionStatus element not found');
            return;
        }
        
        const mode = this.getConnectionMode();
        
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            statusDiv.innerHTML = '🌐 Online مباشر <button class="switch-btn" onclick="acceptTransferApp.switchConnectionMode()">تبديل</button>';
            statusDiv.className = 'connection-status supabase';
        } else {
            statusDiv.innerHTML = '🔗 اتصال محلي <button class="switch-btn" onclick="acceptTransferApp.switchConnectionMode()">تبديل</button>';
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
        this.showMessage(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`, 'success');
        
        // إعادة تحميل البيانات
        this._loadStores();
    }

    _initDOM() {
        const ids = [
            'userInfo', 'storeSelect', 'incomingTransfersList', 'transferDetailsSection',
            'transferHeaderInfo', 'transferItemsList', 'acceptRemarks', 'rejectReason',
            'toast', 'noTransferSelected', 'connectionStatus'
        ];
        const dom = {};
        ids.forEach(id => {
            dom[id] = document.getElementById(id);
            if (!dom[id]) {
                console.warn(`❌ Element with id '${id}' not found`);
            }
        });
        return dom;
    }

    _bindEvents() {
        if (this.dom.storeSelect) {
            this.dom.storeSelect.addEventListener('change', (e) => {
                this.state.currentStore = e.target.value;
                this.loadIncomingTransfers();
            });
        }

        // ✅ إضافة event delegation للأزرار الديناميكية
        document.addEventListener('click', (e) => {
            // زر عرض التفاصيل
            if (e.target.closest('.transfer-item')) {
                const transferNo = e.target.closest('.transfer-item').dataset.transferNo;
                if (transferNo) {
                    this.selectTransfer(transferNo);
                }
            }
        });
    }

    async init() {
        console.log('🚀 تهيئة تطبيق قبول التحويلات...');
        this.updateConnectionStatus();
        this._loadUserInfo();
        await this._loadStores();
        this.showMessage('✅ تم تهيئة نظام قبول التحويلات', 'success');
    }

    _loadUserInfo() {
        const username = localStorage.getItem("username") || sessionStorage.getItem("username");
        const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        
        if (username && this.dom.userInfo) {
            this.dom.userInfo.textContent = `مرحباً: ${username} (ID: ${userId || 'N/A'})`;
        }
    }

    async _loadStores() {
        try {
            this.showMessage('⏳ جاري تحميل الفروع...', 'info');
            const mode = this.getConnectionMode();
            
            let stores = [];

            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                console.log('🔄 جاري جلب الفروع من Supabase');
                
                if (!this.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                
                const { data, error } = await this.supabase
                    .from('stores')
                    .select('*')
                    .order('store_id');
                
                if (error) throw error;
                
                stores = data || [];
                console.log(`✅ تم تحميل ${stores.length} فرع من Supabase`, stores);
            } else {
                // استخدام API التقليدي
                const apiUrl = appConfig.get('STORES');
                console.log('🔗 استخدام API التقليدي:', apiUrl);
                
                const response = await fetch(apiUrl);
                console.log('📡 استجابة جلب الفروع:', response);
                
                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('📊 بيانات الفروع المستلمة:', data);
                
                if (Array.isArray(data)) {
                    stores = data;
                } else if (data.stores && Array.isArray(data.stores)) {
                    stores = data.stores;
                } else if (data.data && Array.isArray(data.data)) {
                    stores = data.data;
                } else if (data.success && Array.isArray(data.data)) {
                    stores = data.data;
                } else {
                    console.warn('⚠️ تنسيق بيانات الفروع غير متوقع:', data);
                    stores = [];
                }
                
                console.log(`✅ تم تحميل ${stores.length} فرع من الخادم المحلي`, stores);
            }
            
            this.state.stores = stores;
            
            if (!Array.isArray(stores) || stores.length === 0) {
                throw new Error('لا توجد مخازن متاحة في النظام');
            }
            
            const select = this.dom.storeSelect;
            if (!select) {
                throw new Error('عنصر اختيار الفرع غير موجود في الصفحة');
            }
            
            select.innerHTML = '<option value="">اختر الفرع الهدف</option>';
            
            stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.store_id || store.id || store.code;
                option.textContent = store.store_name || store.name || `الفرع ${store.store_id || store.id}`;
                option.setAttribute('data-store-name', store.store_name || store.name || '');
                select.appendChild(option);
            });
            
            this.showMessage(`✅ تم تحميل ${stores.length} مخزن`, 'success');
            
        } catch (error) {
            console.error('❌ خطأ في تحميل الفروع:', error);
            this.showMessage(`❌ خطأ في تحميل الفروع: ${error.message}`, 'error');
            
            // التحول التلقائي إلى Supabase في حالة الفشل
            if (this.getConnectionMode() !== 'supabase') {
                const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'supabase');
                    this._loadStores();
                }
            }
            
            // عرض رسالة تفصيلية للمستخدم
            if (this.dom.storeSelect) {
                this.dom.storeSelect.innerHTML = `
                    <option value="">❌ خطأ في تحميل الفروع</option>
                    <option value="retry">🔄 إعادة المحاولة</option>
                `;
                
                // إعادة المحاولة
                this.dom.storeSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'retry') {
                        this._loadStores();
                    }
                });
            }
        }
    }

    async loadIncomingTransfers() {
        const storeId = this.dom.storeSelect?.value;
        if (!storeId) {
            if (this.dom.incomingTransfersList) {
                this.dom.incomingTransfersList.innerHTML = '<div class="no-data">⏳ اختر الفرع لعرض التحويلات الواردة</div>';
            }
            return;
        }

        try {
            this.showMessage('⏳ جاري تحميل التحويلات الواردة...', 'info');
            const mode = this.getConnectionMode();
            
            let transfers = [];

            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase - بناءً على الأعمدة الفعلية
                console.log('🔄 جاري جلب التحويلات من Online للمخزن:', storeId);
                
                if (!this.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                
                // جلب التحويلات بناءً على الأعمدة الفعلية
                const { data: transfersData, error: transfersError } = await this.supabase
                    .from('transfer_stores')
                    .select('*')
                    .eq('to_store', storeId)
                    .eq('status', 'sent') // ✅ استخدام العمود الصحيح 'status' بدلاً من 'transfer_status'
                    .order('tran_date', { ascending: false }); // ✅ استخدام العمود الصحيح 'tran_date'
                
                if (transfersError) {
                    console.error('❌ خطأ في جلب التحويلات:', transfersError);
                    throw transfersError;
                }
                
                transfers = transfersData || [];
                
                // جلب أسماء الفروع بشكل منفصل
                if (transfers.length > 0) {
                    const storeIds = [...new Set(transfers.map(t => t.from_store).concat(transfers.map(t => t.to_store)))];
                    
                    const { data: storesData, error: storesError } = await this.supabase
                        .from('stores')
                        .select('store_id, store_name')
                        .in('store_id', storeIds);
                    
                    if (!storesError) {
                        const storesMap = {};
                        storesData.forEach(store => {
                            storesMap[store.store_id] = store.store_name;
                        });
                        
                        // دمج أسماء الفروع مع التحويلات
                        transfers = transfers.map(transfer => ({
                            ...transfer,
                            from_store_name: storesMap[transfer.from_store] || 'غير معروف',
                            to_store_name: storesMap[transfer.to_store] || 'غير معروف',
                            // إضافة حقول متوافقة مع الكود الحالي
                            transfer_no: transfer.transfer_no,
                            transfer_date: transfer.tran_date, // ✅ استخدام tran_date
                            transfer_status: transfer.status, // ✅ استخدام status
                            created_by: transfer.user_id ? `User ${transfer.user_id}` : 'غير معروف',
                            remarks: transfer.remarks || ''
                        }));
                    }
                }
                
                console.log(`✅ تم تحميل ${transfers.length} تحويل وارد من Online`, transfers);
            } else {
                // استخدام API التقليدي
                const apiUrl = appConfig.getComplex('ACCEPT_TRANSFER', 'INCOMING', storeId);
                console.log('🔗 استخدام API التقليدي:', apiUrl);
                
                const response = await fetch(apiUrl);
                console.log('📡 استجابة التحويلات الواردة:', response);
                
                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('📊 بيانات التحويلات المستلمة:', data);

                if (data.success) {
                    transfers = data.transfers || data.data || [];
                } else {
                    throw new Error(data.message || 'خطأ غير معروف في جلب التحويلات');
                }
                
                console.log(`✅ تم تحميل ${transfers.length} تحويل وارد من الخادم المحلي`, transfers);
            }

            this.state.incomingTransfers = transfers;
            this.renderIncomingTransfers();
            
            if (transfers.length > 0) {
                this.showMessage(`✅ تم تحميل ${transfers.length} تحويل وارد`, 'success');
            } else {
                this.showMessage('ℹ️ لا توجد تحويلات واردة لهذا الفرع', 'info');
            }
        } catch (error) {
            console.error('❌ Error loading transfers:', error);
            this.showMessage(`❌ خطأ في تحميل التحويلات الواردة: ${error.message}`, 'error');
            
            // التحول التلقائي إلى Supabase في حالة الفشل
            if (this.getConnectionMode() !== 'supabase') {
                const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Online');
                if (switchNow) {
                    localStorage.setItem('connection_mode', 'supabase');
                    this.loadIncomingTransfers();
                }
            }
            
            if (this.dom.incomingTransfersList) {
                this.dom.incomingTransfersList.innerHTML = `<div class="no-data">❌ ${error.message}</div>`;
            }
        }
    }

    // ✅ الدالة المصححة - مرتبطة بـ this بشكل صحيح
    renderIncomingTransfers() {
        const list = this.dom.incomingTransfersList;
        if (!list) {
            console.error('❌ عنصر incomingTransfersList غير موجود');
            return;
        }

        if (!this.state.incomingTransfers || this.state.incomingTransfers.length === 0) {
            list.innerHTML = '<div class="no-data">📭 لا توجد تحويلات واردة معلقة</div>';
            return;
        }

        list.innerHTML = this.state.incomingTransfers.map(transfer => {
            const isSelected = this.state.selectedTransferNo === transfer.transfer_no;
            const isExpired = transfer.expires_at && new Date(transfer.expires_at) < new Date();
            
            return `
                <div class="transfer-item ${isSelected ? 'selected' : ''} ${isExpired ? 'expired' : ''}" 
                     data-transfer-no="${transfer.transfer_no}">
                    <div class="transfer-header">
                        <div class="transfer-number">#${transfer.transfer_no}</div>
                        <div class="transfer-date">${new Date(transfer.transfer_date || transfer.tran_date).toLocaleDateString('ar-EG')}</div>
                        <div class="transfer-status ${transfer.transfer_status || transfer.status}">${this._getStatusText(transfer.transfer_status || transfer.status)}</div>
                    </div>
                    <div class="transfer-info">
                        <div class="from-store">من: ${transfer.from_store_name || 'غير معروف'}</div>
                        <div class="to-store">إلى: ${transfer.to_store_name || 'غير معروف'}</div>
                        <div class="items-count">${transfer.qty || 0} وحدة</div>
                    </div>
                    <div class="transfer-meta">
                        <div class="created-by">أنشئ بواسطة: ${transfer.created_by || 'غير معروف'}</div>
                        ${transfer.expires_at ? `
                            <div class="expiry ${isExpired ? 'expired' : ''}">
                                ${isExpired ? '⏰ منتهي' : `ينتهي: ${new Date(transfer.expires_at).toLocaleDateString('ar-EG')}`}
                            </div>
                        ` : ''}
                    </div>
                    ${transfer.remarks ? `<div class="transfer-remarks">ملاحظات: ${transfer.remarks}</div>` : ''}
                </div>
            `;
        }).join('');

        console.log(`✅ تم عرض ${this.state.incomingTransfers.length} تحويل`);
    }

    async selectTransfer(transferNo) {
        try {
            this.state.selectedTransferNo = transferNo;
            this.showMessage('⏳ جاري تحميل تفاصيل التحويل...', 'info');
            
            const mode = this.getConnectionMode();
            let transferData = {};

            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase - بناءً على الأعمدة الفعلية
                console.log(`📋 جاري تحميل تفاصيل التحويل من Online: ${transferNo}`);
                
                if (!this.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                
                // جلب بيانات التحويل الأساسية
                const { data: headerData, error: headerError } = await this.supabase
                    .from('transfer_stores')
                    .select('*')
                    .eq('transfer_no', transferNo)
                    .single();
                
                if (headerError) throw headerError;
                
                // جلب أسماء الفروع
                const storeIds = [headerData.from_store, headerData.to_store];
                const { data: storesData } = await this.supabase
                    .from('stores')
                    .select('store_id, store_name')
                    .in('store_id', storeIds);
                
                const storesMap = {};
                if (storesData) {
                    storesData.forEach(store => {
                        storesMap[store.store_id] = store.store_name;
                    });
                }
                
                // جلب أسماء الأصناف
                const { data: itemsInfo } = await this.supabase
                    .from('items')
                    .select('item_id, item_nm, item_unit')
                    .eq('item_id', headerData.item_id);
                
                const itemName = itemsInfo && itemsInfo[0] ? itemsInfo[0].item_nm : 'غير معروف';
                const itemUnit = itemsInfo && itemsInfo[0] ? itemsInfo[0].item_unit : 'غير معروف';
                
                // إنشاء تفاصيل التحويل من البيانات الأساسية
                const details = [{
                    item_id: headerData.item_id,
                    item_nm: itemName,
                    item_unit: itemUnit,
                    quantity: headerData.qty,
                    transfer_qty: headerData.qty,
                    batch_no: headerData.batch_no,
                    expiry_date: headerData.expiry_date,
                    unit_type: headerData.unit_type,
                    item_price: headerData.sale_price1 || headerData.buy_price
                }];
                
                transferData = {
                    header: {
                        ...headerData,
                        from_store_name: storesMap[headerData.from_store] || 'غير معروف',
                        to_store_name: storesMap[headerData.to_store] || 'غير معروف',
                        transfer_date: headerData.tran_date, // ✅ استخدام tran_date
                        transfer_status: headerData.status, // ✅ استخدام status
                        created_by: headerData.user_id ? `User ${headerData.user_id}` : 'غير معروف'
                    },
                    details: details
                };
                
                console.log('✅ تم تحميل تفاصيل التحويل من Online', transferData);
            } else {
                // استخدام API التقليدي
                const apiUrl = appConfig.getComplex('ACCEPT_TRANSFER', 'DETAILS', transferNo);
                console.log('🔗 استخدام API التقليدي:', apiUrl);
                
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.status}`);
                }
                
                const data = await response.json();
                if (data.success) {
                    transferData = data;
                } else {
                    throw new Error(data.message || 'خطأ في تحميل التفاصيل');
                }
                
                console.log('✅ تم تحميل تفاصيل التحويل من الخادم المحلي', transferData);
            }

            this.state.selectedTransfer = transferData.header;
            this.state.transferDetails = transferData.details || [];
            this.renderTransferDetails();
            // ✅ إعادة التصيير لتحديث التحديد
            this.renderIncomingTransfers();
            this.showMessage('✅ تم تحميل تفاصيل التحويل', 'success');
        } catch (error) {
            console.error('❌ Error loading transfer details:', error);
            this.showMessage(`❌ خطأ في تحميل تفاصيل التحويل: ${error.message}`, 'error');
        }
    }

    renderTransferDetails() {
        this._renderHeaderInfo();
        this._renderItemsList();
        
        if (this.dom.transferDetailsSection) {
            this.dom.transferDetailsSection.style.display = 'block';
        }
        if (this.dom.noTransferSelected) {
            this.dom.noTransferSelected.style.display = 'none';
        }
    }

    _renderHeaderInfo() {
        const transfer = this.state.selectedTransfer;
        if (!transfer) return;

        const expiresAt = transfer.expires_at ? new Date(transfer.expires_at) : null;
        const now = new Date();
        const isExpired = expiresAt && expiresAt < now;
        const expiresIn = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : null;

        this.dom.transferHeaderInfo.innerHTML = `
            <div class="header-grid">
                <div><strong>رقم التحويل:</strong> ${transfer.transfer_no}</div>
                <div><strong>التاريخ:</strong> ${new Date(transfer.transfer_date || transfer.tran_date).toLocaleDateString('ar-EG')}</div>
                <div><strong>من:</strong> ${transfer.from_store_name || 'غير معروف'}</div>
                <div><strong>إلى:</strong> ${transfer.to_store_name || 'غير معروف'}</div>
                <div><strong>المنشئ:</strong> ${transfer.created_by || 'غير معروف'}</div>
                <div><strong>الحالة:</strong> ${this._getStatusText(transfer.transfer_status || transfer.status)}</div>
                ${expiresIn !== null ? `
                    <div><strong>مدة الصلاحية:</strong> 
                        <span style="color: ${isExpired ? '#e74c3c' : '#27ae60'}; font-weight: bold;">
                            ${isExpired ? '⏰ منتهي' : `${expiresIn} يوم متبقي`}
                        </span>
                    </div>
                ` : ''}
            </div>
            ${transfer.remarks ? `<div class="remarks"><strong>ملاحظات:</strong> ${transfer.remarks}</div>` : ''}
        `;
    }

    _renderItemsList() {
        const list = this.dom.transferItemsList;
        if (!list) return;

        if (this.state.transferDetails.length === 0) {
            list.innerHTML = '<div class="no-data">📭 لا توجد أصناف في هذا التحويل</div>';
            return;
        }

        list.innerHTML = this.state.transferDetails.map((item, index) => `
            <div class="item-row">
                <div class="item-info">
                    <strong>${item.item_id}</strong> - ${item.item_nm || 'غير معروف'}
                    <div class="item-details">
                        ${item.batch_no ? `الدفعة: ${item.batch_no} | ` : ''}
                        ${item.expiry_date ? `الصلاحية: ${new Date(item.expiry_date).toLocaleDateString('ar-EG')} | ` : ''}
                        الوحدة: ${item.item_unit || item.unit_type || 'غير معروف'} |
                        السعر: ${item.item_price || 0} 
                    </div>
                </div>
                <div class="item-qty" title="الكمية المرسلة">${item.quantity || item.transfer_qty || 0}</div>
                <div class="item-actions">
                    <input type="number" class="partial-qty" data-item-id="${item.item_id}" 
                           value="${item.quantity || item.transfer_qty || 0}" min="0" max="${item.quantity || item.transfer_qty || 0}" 
                           step="0.01" 
                           title="الكمية المقبولة">
                </div>
            </div>
        `).join('');

        // ✅ إضافة مستمعي الأحداث لحقول الكميات
        list.querySelectorAll('.partial-qty').forEach(input => {
            input.addEventListener('change', (e) => {
                const itemId = e.target.dataset.itemId;
                const value = e.target.value;
                this.updatePartialQty(itemId, value);
            });
        });
    }

    async acceptTransfer() {
        const transferNo = this.state.selectedTransfer?.transfer_no;
        if (!transferNo) {
            this.showMessage('⚠️ يرجى اختيار تحويل أولاً', 'error');
            return;
        }

        if ((this.state.selectedTransfer.transfer_status || this.state.selectedTransfer.status) !== 'sent') {
            this.showMessage('⚠️ لا يمكن قبول تحويل تم معالجته مسبقاً', 'error');
            return;
        }

        const remarks = this.dom.acceptRemarks?.value || '';

        if (!confirm('هل تريد قبول هذا التحويل بالكامل؟ سيتم إضافة الكميات إلى مخزنك.')) {
            return;
        }

        try {
            this.showMessage('⏳ جاري معالجة قبول التحويل...', 'info');
            const mode = this.getConnectionMode();

            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                console.log(`✅ جاري قبول التحويل في Online: ${transferNo}`);
                
                if (!this.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                
                // تحديث حالة التحويل
                const { error } = await this.supabase
                    .from('transfer_stores')
                    .update({
                        status: 'accepted', // ✅ استخدام العمود الصحيح 'status'
                        approved_date: new Date().toISOString(),
                        approved_by: localStorage.getItem("user_id") || sessionStorage.getItem("user_id"),
                        remarks: remarks
                    })
                    .eq('transfer_no', transferNo);
                
                if (error) throw error;
                
                this.showMessage('✅ تم قبول التحويل بنجاح', 'success');
                
            } else {
                // استخدام API التقليدي
                const apiUrl = appConfig.getComplex('ACCEPT_TRANSFER', 'ACCEPT', transferNo);
                
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ remarks })
                });

                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.status}`);
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.message || 'خطأ في قبول التحويل');
                }
                
                this.showMessage('✅ تم قبول التحويل بنجاح', 'success');
            }
            
            this.loadIncomingTransfers();
            this._resetDetailsSection();
            
        } catch (error) {
            console.error('❌ Error accepting transfer:', error);
            this.showMessage(`❌ خطأ في قبول التحويل: ${error.message}`, 'error');
        }
    }

    async rejectTransfer() {
        const transferNo = this.state.selectedTransfer?.transfer_no;
        if (!transferNo) {
            this.showMessage('⚠️ يرجى اختيار تحويل أولاً', 'error');
            return;
        }

        if ((this.state.selectedTransfer.transfer_status || this.state.selectedTransfer.status) !== 'sent') {
            this.showMessage('⚠️ لا يمكن رفض تحويل تم معالجته مسبقاً', 'error');
            return;
        }

        const reason = this.dom.rejectReason?.value;
        if (!reason || reason.trim() === '') {
            this.showMessage('⚠️ يرجى إدخال سبب الرفض', 'error');
            return;
        }

        if (!confirm('هل تريد رفض هذا التحويل؟')) {
            return;
        }

        try {
            this.showMessage('⏳ جاري معالجة رفض التحويل...', 'info');
            const mode = this.getConnectionMode();

            if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
                // استخدام Supabase
                console.log(`❌ جاري رفض التحويل في Online: ${transferNo}`);
                
                if (!this.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                
                const { error } = await this.supabase
                    .from('transfer_stores')
                    .update({
                        status: 'rejected', // ✅ استخدام العمود الصحيح 'status'
                        approved_date: new Date().toISOString(),
                        approved_by: localStorage.getItem("user_id") || sessionStorage.getItem("user_id"),
                        remarks: reason
                    })
                    .eq('transfer_no', transferNo);
                
                if (error) throw error;
                
                this.showMessage('✅ تم رفض التحويل بنجاح', 'success');
                
            } else {
                // استخدام API التقليدي
                const apiUrl = appConfig.getComplex('ACCEPT_TRANSFER', 'REJECT', transferNo);
                
                const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ rejection_reason: reason })
                });

                if (!response.ok) {
                    throw new Error(`خطأ في الشبكة: ${response.status}`);
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.message || 'خطأ في رفض التحويل');
                }
                
                this.showMessage('✅ تم رفض التحويل بنجاح', 'success');
            }
            
            this.loadIncomingTransfers();
            this._resetDetailsSection();
            
        } catch (error) {
            console.error('❌ Error rejecting transfer:', error);
            this.showMessage(`❌ خطأ في رفض التحويل: ${error.message}`, 'error');
        }
    }

    async partialAcceptTransfer() {
        this.showMessage('⚠️ هذه الميزة قيد التطوير', 'warning');
    }

    updatePartialQty(itemId, value) {
        // وظيفة أساسية للقبول الجزئي
        const item = this.state.transferDetails.find(d => d.item_id === itemId);
        if (item) {
            const newValue = parseFloat(value);
            const maxValue = parseFloat(item.quantity || item.transfer_qty);
            
            if (isNaN(newValue) || newValue < 0) {
                this.showMessage('⚠️ يرجى إدخال قيمة رقمية صحيحة', 'error');
                const input = document.querySelector(`[data-item-id="${itemId}"]`);
                if (input) input.value = maxValue;
                return;
            }
            
            if (newValue > maxValue) {
                this.showMessage('⚠️ الكمية لا يمكن أن تكون أكبر من الكمية المرسلة', 'error');
                const input = document.querySelector(`[data-item-id="${itemId}"]`);
                if (input) input.value = maxValue;
            }
        }
    }

    _resetDetailsSection() {
        this.state.selectedTransfer = null;
        this.state.transferDetails = [];
        this.state.selectedTransferNo = null;
        
        if (this.dom.transferDetailsSection) {
            this.dom.transferDetailsSection.style.display = 'none';
        }
        if (this.dom.noTransferSelected) {
            this.dom.noTransferSelected.style.display = 'block';
        }
        if (this.dom.acceptRemarks) {
            this.dom.acceptRemarks.value = '';
        }
        if (this.dom.rejectReason) {
            this.dom.rejectReason.value = '';
        }
        
        // ✅ إعادة تحميل قائمة التحويلات
        this.renderIncomingTransfers();
    }

    _getStatusText(status) {
        const statusMap = {
            'pending': '⏳ قيد الانتظار',
            'sent': '📤 مرسل',
            'completed': '✅ مقبول',
            'accepted': '✅ مقبول',
            'rejected': '❌ مرفوض',
            'partially_accepted': '⚠️ مقبول جزئياً'
        };
        return statusMap[status] || status;
    }

    showMessage(message, type = 'info') {
        const toast = this.dom.toast;
        if (!toast) {
            console.log(`${type}: ${message}`);
            return;
        }

        toast.textContent = message;
        toast.style.display = 'block';
        toast.style.background = 
            type === 'success' ? '#27ae60' :
            type === 'error' ? '#e74c3c' :
            type === 'warning' ? '#f39c12' : '#3498db';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }
}

let acceptTransferApp;
document.addEventListener('DOMContentLoaded', () => {
    acceptTransferApp = new AcceptTransferApp();
});