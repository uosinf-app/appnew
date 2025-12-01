// public/js/dailyCashier.js
class DailyCashier {
    constructor() {
        // إعدادات Supabase (الخيار الأول)
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        this.supabase = null;
        this.useSupabase = true;

        // إعدادات API التقليدي (النسخ الاحتياطي)
        this.apiUrl = "http://localhost:3000/api/daily-cashier";
        this.storesApi = "http://localhost:3000/api/stores";
        
        this.currentSales = [];
        this.currentReturns = [];
        this.summaryData = {};
        this.filtersData = {};
        
        this.init();
    }

    async init() {
        try {
            this.showLoading();
            await this.initSupabase();
            await this.loadUserInfo();
            await this.loadFilterData();
            await this.loadData();
            this.bindEvents();
            this.hideLoading();
            this.updateConnectionUI();
        } catch (error) {
            console.error('خطأ في التهيئة:', error);
            this.showMessage('حدث خطأ أثناء تحميل البيانات', 'error');
        }
    }

    async initSupabase() {
        if (this.useSupabase && window.supabase) {
            try {
                this.supabase = window.supabase.createClient(
                    this.SUPABASE_URL,
                    this.SUPABASE_KEY
                );
                console.log("✅ تم تهيئة Supabase للكاشير اليومي");
            } catch (error) {
                console.error("❌ فشل تهيئة Supabase:", error);
                this.useSupabase = false;
            }
        } else {
            console.log("⚠️  Supabase غير متاح، الانتقال للوضع التقليدي");
            this.useSupabase = false;
        }
    }

    async loadUserInfo() {
        try {
            const username = localStorage.getItem("username") || sessionStorage.getItem("username") || "مستخدم";
            const storeName = localStorage.getItem("store_name") || sessionStorage.getItem("store_name") || "غير محدد";
            const storeId = localStorage.getItem("store_id") || sessionStorage.getItem("store_id") || "";
            
            document.getElementById('cashierName').textContent = `الكاشير: ${username}`;
            document.getElementById('branchName').textContent = `الفرع: ${storeName}`;
            document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-EG');
            
            if (storeId) {
                this.filtersData.storeId = storeId;
            }
        } catch (error) {
            console.error('خطأ في تحميل معلومات المستخدم:', error);
        }
    }

    async loadFilterData() {
        try {
            if (this.useSupabase && this.supabase) {
                await this.loadFilterDataFromSupabase();
            } else {
                await this.loadFilterDataFromAPI();
            }
            this.populateFilterDropdowns();
        } catch (error) {
            console.error('خطأ في تحميل بيانات الفلاتر:', error);
            this.showMessage('حدث خطأ في تحميل قوائم الفلاتر', 'error');
        }
    }

    async loadFilterDataFromSupabase() {
        try {
            // جلب المخازن
            const { data: stores, error: storesError } = await this.supabase
                .from('stores')
                .select('store_id, store_name')
                .order('store_name');
            
            if (storesError) throw storesError;
            this.filtersData.stores = stores;

            // جلب الكاشيرات من جدول users
            const { data: cashiers, error: cashiersError } = await this.supabase
                .from('users')
                .select('user_id, username, full_name, role, store_id')
                .eq('active', true)
                .order('username');
            
            if (cashiersError) throw cashiersError;
            this.filtersData.cashiers = cashiers;

        } catch (error) {
            console.error('خطأ في جلب بيانات الفلاتر من Supabase:', error);
            throw error;
        }
    }

    async loadFilterDataFromAPI() {
        try {
            // جلب المخازن
            const storesResponse = await fetch(this.storesApi);
            if (storesResponse.ok) {
                const storesData = await storesResponse.json();
                this.filtersData.stores = storesData.success ? storesData.data : [];
            }

            // جلب الكاشيرات
            const filtersResponse = await fetch(`${this.apiUrl}/filters`);
            if (filtersResponse.ok) {
                const filtersData = await filtersResponse.json();
                if (filtersData.success) {
                    this.filtersData.cashiers = filtersData.data.cashiers || [];
                }
            }
        } catch (error) {
            console.error('خطأ في جلب بيانات الفلاتر من API:', error);
            throw error;
        }
    }

    populateFilterDropdowns() {
        const storeFilter = document.getElementById('storeFilter');
        const cashierFilter = document.getElementById('cashierFilter');

        // تعبئة المخازن
        storeFilter.innerHTML = '<option value="">جميع الفروع</option>';
        this.filtersData.stores.forEach(store => {
            storeFilter.innerHTML += `<option value="${store.store_id}">${store.store_name}</option>`;
        });

        // تعبئة الكاشيرات
        cashierFilter.innerHTML = '<option value="">جميع الكاشيرات</option>';
        this.filtersData.cashiers.forEach(cashier => {
            const displayName = cashier.full_name || cashier.username;
            cashierFilter.innerHTML += `<option value="${cashier.user_id}">${displayName}</option>`;
        });

        // تعيين القيم الافتراضية إذا كانت موجودة
        if (this.filtersData.storeId) {
            storeFilter.value = this.filtersData.storeId;
        }
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadSummary(),
                this.loadSales(),
                this.loadReturns()
            ]);
            this.renderTable();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.showMessage('حدث خطأ في تحميل البيانات', 'error');
        }
    }

    async loadSummary() {
        try {
            if (this.useSupabase && this.supabase) {
                await this.loadSummaryFromSupabase();
            } else {
                await this.loadSummaryFromAPI();
            }
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
            throw error;
        }
    }

    async loadSummaryFromSupabase() {
        const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
        
        try {
            // جلب المبيعات
            let salesQuery = this.supabase
                .from('sales')
                .select('total_price, discount', { count: 'exact' });
            
            if (startDate) salesQuery = salesQuery.gte('tran_date', startDate);
            if (endDate) salesQuery = salesQuery.lte('tran_date', endDate);
            if (storeId) salesQuery = salesQuery.eq('store_id', storeId);
            if (cashierId) salesQuery = salesQuery.eq('user_id', cashierId);
            
            const { data: salesData, error: salesError, count: salesCount } = await salesQuery;
            if (salesError) throw salesError;

            // جلب المرتجعات
            let returnsQuery = this.supabase
                .from('sales_return')
                .select('total_price, discount', { count: 'exact' });
            
            if (startDate) returnsQuery = returnsQuery.gte('tran_date', startDate);
            if (endDate) returnsQuery = returnsQuery.lte('tran_date', endDate);
            if (storeId) returnsQuery = returnsQuery.eq('store_id', storeId);
            if (cashierId) returnsQuery = returnsQuery.eq('user_id', cashierId);
            
            const { data: returnsData, error: returnsError, count: returnsCount } = await returnsQuery;
            if (returnsError) throw returnsError;

            // حساب الإحصائيات
            const totalSalesAmount = salesData?.reduce((sum, sale) => sum + (parseFloat(sale.total_price) || 0), 0) || 0;
            const totalReturnsAmount = returnsData?.reduce((sum, ret) => sum + (parseFloat(ret.total_price) || 0), 0) || 0;
            
            this.summaryData = {
                total_sales: {
                    amount: totalSalesAmount,
                    invoices: salesCount || 0
                },
                total_returns: {
                    amount: totalReturnsAmount,
                    invoices: returnsCount || 0
                },
                net_sales: {
                    amount: totalSalesAmount - totalReturnsAmount,
                    invoices: (salesCount || 0) + (returnsCount || 0)
                }
            };
            
            this.updateSummaryCards();
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات من Supabase:', error);
            throw error;
        }
    }

    async loadSummaryFromAPI() {
        const queryParams = this.buildQueryParams();
        const response = await fetch(`${this.apiUrl}/summary?${queryParams}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                this.summaryData = data.data;
                this.updateSummaryCards();
            } else {
                throw new Error(data.message || 'فشل في جلب الإحصائيات');
            }
        } else {
            throw new Error('فشل في جلب الإحصائيات من الخادم');
        }
    }

    async loadSales() {
        try {
            if (this.useSupabase && this.supabase) {
                await this.loadSalesFromSupabase();
            } else {
                await this.loadSalesFromAPI();
            }
        } catch (error) {
            console.error('خطأ في جلب المبيعات:', error);
            this.currentSales = [];
            throw error;
        }
    }

    async loadSalesFromSupabase() {
    const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
    
    try {
        // أولاً: جلب البيانات الأساسية من sales
        let query = this.supabase
            .from('sales')
            .select('*');
        
        if (startDate) query = query.gte('tran_date', startDate);
        if (endDate) query = query.lte('tran_date', endDate);
        if (storeId) query = query.eq('store_id', storeId);
        if (cashierId) query = query.eq('user_id', cashierId);
        
        const { data, error } = await query;
        if (error) throw error;

        // ثانياً: جلب البيانات المرتبطة بشكل منفصل
        await this.enrichSalesData(data);
        
    } catch (error) {
        console.error('خطأ في جلب المبيعات من Supabase:', error);
        throw error;
    }
}

    async enrichSalesData(salesData) {
        try {
            // جلب أسماء المخازن
            const storeIds = [...new Set(salesData.map(sale => sale.store_id))];
            const { data: stores, error: storesError } = await this.supabase
                .from('stores')
                .select('store_id, store_name')
                .in('store_id', storeIds);
            
            const storeMap = {};
            if (!storesError && stores) {
                stores.forEach(store => {
                    storeMap[store.store_id] = store.store_name;
                });
            }

            // جلب أسماء الكاشيرات
            const userIds = [...new Set(salesData.map(sale => sale.user_id))];
            const { data: users, error: usersError } = await this.supabase
                .from('users')
                .select('user_id, username, full_name')
                .in('user_id', userIds);
            
            const userMap = {};
            if (!usersError && users) {
                users.forEach(user => {
                    userMap[user.user_id] = user.full_name || user.username;
                });
            }

            // جلب أسماء الأصناف
            const itemIds = [...new Set(salesData.map(sale => sale.item_id))];
            const { data: items, error: itemsError } = await this.supabase
                .from('items')
                .select('item_id, item_nm, item_code')
                .in('item_id', itemIds);
            
            const itemMap = {};
            if (!itemsError && items) {
                items.forEach(item => {
                    itemMap[item.item_id] = {
                        item_name: item.item_nm,
                        item_code: item.item_code
                    };
                });
            }

            // دمج جميع البيانات
            this.currentSales = salesData.map(sale => {
                const itemInfo = itemMap[sale.item_id] || {};
                
                return {
                    ...sale,
                    type: 'sale',
                    displayType: 'بيع',
                    cashier_name: userMap[sale.user_id] || '',
                    store_name: storeMap[sale.store_id] || '',
                    item_name: itemInfo.item_name || sale.item_id,
                    item_code: itemInfo.item_code || sale.item_id
                };
            });

        } catch (error) {
            console.error('خطأ في إثراء بيانات المبيعات:', error);
            // الاستمرار بالبيانات الأساسية حتى مع وجود خطأ
            this.currentSales = salesData.map(sale => ({
                ...sale,
                type: 'sale',
                displayType: 'بيع',
                cashier_name: '',
                store_name: '',
                item_name: sale.item_id,
                item_code: sale.item_id
            }));
        }
    }

    async loadSalesFromAPI() {
        const queryParams = this.buildQueryParams();
        const response = await fetch(`${this.apiUrl}/sales?${queryParams}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                this.currentSales = data.data.map(sale => ({
                    ...sale,
                    type: 'sale',
                    displayType: 'بيع'
                }));
            } else {
                throw new Error(data.message || 'فشل في جلب المبيعات');
            }
        } else {
            throw new Error('فشل في جلب المبيعات من الخادم');
        }
    }

    async loadReturns() {
        try {
            if (this.useSupabase && this.supabase) {
                await this.loadReturnsFromSupabase();
            } else {
                await this.loadReturnsFromAPI();
            }
        } catch (error) {
            console.error('خطأ في جلب المرتجعات:', error);
            this.currentReturns = [];
            throw error;
        }
    }

    async loadReturnsFromSupabase() {
    const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
    
    try {
        // أولاً: جلب البيانات الأساسية من sales_return
        let query = this.supabase
            .from('sales_return')
            .select('*');
        
        if (startDate) query = query.gte('tran_date', startDate);
        if (endDate) query = query.lte('tran_date', endDate);
        if (storeId) query = query.eq('store_id', storeId);
        if (cashierId) query = query.eq('user_id', cashierId);
        
        const { data, error } = await query;
        if (error) throw error;

        // ثانياً: جلب البيانات المرتبطة بشكل منفصل
        await this.enrichReturnsData(data);
        
    } catch (error) {
        console.error('خطأ في جلب المرتجعات من Supabase:', error);
        throw error;
    }
}

    async enrichReturnsData(returnsData) {
        try {
            // جلب أسماء المخازن
            const storeIds = [...new Set(returnsData.map(ret => ret.store_id))];
            const { data: stores, error: storesError } = await this.supabase
                .from('stores')
                .select('store_id, store_name')
                .in('store_id', storeIds);
            
            const storeMap = {};
            if (!storesError && stores) {
                stores.forEach(store => {
                    storeMap[store.store_id] = store.store_name;
                });
            }

            // جلب أسماء الكاشيرات
            const userIds = [...new Set(returnsData.map(ret => ret.user_id))];
            const { data: users, error: usersError } = await this.supabase
                .from('users')
                .select('user_id, username, full_name')
                .in('user_id', userIds);
            
            const userMap = {};
            if (!usersError && users) {
                users.forEach(user => {
                    userMap[user.user_id] = user.full_name || user.username;
                });
            }

            // جلب أسماء الأصناف
            const itemIds = [...new Set(returnsData.map(ret => ret.item_id))];
            const { data: items, error: itemsError } = await this.supabase
                .from('items')
                .select('item_id, item_nm, item_code')
                .in('item_id', itemIds);
            
            const itemMap = {};
            if (!itemsError && items) {
                items.forEach(item => {
                    itemMap[item.item_id] = {
                        item_name: item.item_nm,
                        item_code: item.item_code
                    };
                });
            }

            // دمج جميع البيانات
            this.currentReturns = returnsData.map(returnItem => {
                const itemInfo = itemMap[returnItem.item_id] || {};
                
                return {
                    ...returnItem,
                    type: 'return',
                    displayType: 'مرتجع',
                    cashier_name: userMap[returnItem.user_id] || '',
                    store_name: storeMap[returnItem.store_id] || '',
                    item_name: itemInfo.item_name || returnItem.item_id,
                    item_code: itemInfo.item_code || returnItem.item_id
                };
            });

        } catch (error) {
            console.error('خطأ في إثراء بيانات المرتجعات:', error);
            // الاستمرار بالبيانات الأساسية حتى مع وجود خطأ
            this.currentReturns = returnsData.map(returnItem => ({
                ...returnItem,
                type: 'return',
                displayType: 'مرتجع',
                cashier_name: '',
                store_name: '',
                item_name: returnItem.item_id,
                item_code: returnItem.item_id
            }));
        }
    }

    async loadReturnsFromAPI() {
        const queryParams = this.buildQueryParams();
        const response = await fetch(`${this.apiUrl}/sales-returns?${queryParams}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                this.currentReturns = data.data.map(returnItem => ({
                    ...returnItem,
                    type: 'return',
                    displayType: 'مرتجع'
                }));
            } else {
                throw new Error(data.message || 'فشل في جلب المرتجعات');
            }
        } else {
            throw new Error('فشل في جلب المرتجعات من الخادم');
        }
    }

    getFilterValues() {
        return {
            startDate: document.getElementById('startDateFilter').value,
            endDate: document.getElementById('endDateFilter').value,
            storeId: document.getElementById('storeFilter').value,
            cashierId: document.getElementById('cashierFilter').value
        };
    }

    buildQueryParams() {
        const params = new URLSearchParams();
        const { startDate, endDate, storeId, cashierId } = this.getFilterValues();
        
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (storeId) params.append('storeId', storeId);
        if (cashierId) params.append('userId', cashierId);

        return params.toString();
    }

    updateSummaryCards() {
        const summary = this.summaryData;
        
        document.getElementById('totalSales').textContent = 
            this.formatCurrency(summary.total_sales?.amount || 0);
        document.getElementById('totalSalesInvoices').textContent = 
            `${summary.total_sales?.invoices || 0} فاتورة`;
        
        document.getElementById('totalReturns').textContent = 
            this.formatCurrency(summary.total_returns?.amount || 0);
        document.getElementById('totalReturnsInvoices').textContent = 
            `${summary.total_returns?.invoices || 0} فاتورة`;
        
        document.getElementById('netSales').textContent = 
            this.formatCurrency(summary.net_sales?.amount || 0);
        document.getElementById('netSalesInvoices').textContent = 
            `${summary.net_sales?.invoices || 0} فاتورة صافية`;
    }

    renderTable() {
        const tableBody = document.getElementById('transactionsTable');
        const typeFilter = document.getElementById('typeFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        let allTransactions = [...this.currentSales, ...this.currentReturns];
        
        // تطبيق الفلاتر
        if (typeFilter !== 'all') {
            allTransactions = allTransactions.filter(
                transaction => transaction.type === typeFilter
            );
        }
        
        if (searchTerm) {
            allTransactions = allTransactions.filter(transaction =>
                (transaction.item_id && transaction.item_id.toString().toLowerCase().includes(searchTerm)) ||
                (transaction.item_name && transaction.item_name.toLowerCase().includes(searchTerm)) ||
                (transaction.invoice_id && transaction.invoice_id.toString().includes(searchTerm)) ||
                (transaction.item_code && transaction.item_code.toString().toLowerCase().includes(searchTerm))
            );
        }

        // ترتيب حسب التاريخ
        allTransactions = allTransactions.sort((a, b) => 
            new Date(b.tran_date) - new Date(a.tran_date)
        );

        if (allTransactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4">
                        <i class="fas fa-inbox fa-2x text-muted mb-2"></i><br>
                        لا توجد حركات متطابقة مع معايير البحث
                    </td>
                </tr>
            `;
            return;
        }

        const rows = allTransactions.map(transaction => this.createTableRow(transaction));
        tableBody.innerHTML = rows.join('');
    }

    createTableRow(transaction) {
        const isSale = transaction.type === 'sale';
        const rowClass = isSale ? 'sale-row' : 'return-row';
        const typeBadge = isSale ? 
            '<span class="badge bg-success">بيع</span>' : 
            '<span class="badge bg-danger">مرتجع</span>';
        
        const totalClass = isSale ? 'positive' : 'negative';
        const totalSign = isSale ? '+' : '-';

        return `
            <tr class="${rowClass}">
                <td>${typeBadge}</td>
                <td>${this.formatDateTime(transaction.tran_date)}</td>
                <td>${transaction.invoice_id || ''}</td>
                <td>
                    <div>${transaction.item_code || transaction.item_id || ''}</div>
                    <small class="text-muted">${transaction.item_name || ''}</small>
                </td>
                <td>${this.formatNumber(transaction.item_qty)}</td>
                <td>${this.formatCurrency(transaction.sale_price)}</td>
                <td>${this.formatCurrency(transaction.discount || 0)}</td>
                <td class="${totalClass}">
                    ${totalSign} ${this.formatCurrency(transaction.total_price)}
                </td>
                <td>${transaction.cashier_name || ''}</td>
                <td class="mobile-hidden">${transaction.store_name || ''}</td>
            </tr>
        `;
    }

    updateConnectionUI() {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.innerHTML = `
                <div class="connection-status ${this.useSupabase ? 'supabase' : 'local'}">
                    <i class="fas fa-${this.useSupabase ? 'cloud' : 'server'}"></i>
                    ${this.useSupabase ? 'Supabase' : 'API محلي'}
                    <button class="switch-btn" onclick="dailyCashierApp.toggleConnection()">
                        تبديل
                    </button>
                </div>
            `;
        }
    }

    async toggleConnection() {
        this.useSupabase = !this.useSupabase;
        this.updateConnectionUI();
        
        try {
            this.showLoading();
            await this.loadData();
            this.hideLoading();
            this.showMessage(`تم التبديل إلى ${this.useSupabase ? 'Supabase' : 'API المحلي'}`, 'success');
        } catch (error) {
            this.hideLoading();
            this.showMessage('حدث خطأ أثناء التبديل', 'error');
        }
    }

    formatCurrency(amount) {
        const num = parseFloat(amount || 0);
        return num.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' ر.س';
    }

    formatNumber(number) {
        const num = parseFloat(number || 0);
        return num.toLocaleString('ar-EG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    bindEvents() {
        document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
        document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());
        document.getElementById('refreshData').addEventListener('click', () => this.refreshData());
        
        document.getElementById('searchInput').addEventListener('input', () => this.renderTable());
        document.getElementById('typeFilter').addEventListener('change', () => this.renderTable());
        
        // تحديث التاريخ الافتراضي
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDateFilter').value = today;
        document.getElementById('endDateFilter').value = today;
    }

    async applyFilters() {
        try {
            this.showLoading();
            await this.loadData();
            this.hideLoading();
            this.showMessage('تم تطبيق الفلاتر بنجاح', 'success');
        } catch (error) {
            this.hideLoading();
            this.showMessage('حدث خطأ أثناء تطبيق الفلاتر', 'error');
        }
    }

    resetFilters() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDateFilter').value = today;
        document.getElementById('endDateFilter').value = today;
        document.getElementById('storeFilter').value = '';
        document.getElementById('cashierFilter').value = '';
        document.getElementById('typeFilter').value = 'all';
        document.getElementById('searchInput').value = '';
        
        this.applyFilters();
    }

    async refreshData() {
        try {
            this.showLoading();
            await this.loadData();
            this.hideLoading();
            this.showMessage('تم تحديث البيانات بنجاح', 'success');
        } catch (error) {
            this.hideLoading();
            this.showMessage('حدث خطأ أثناء تحديث البيانات', 'error');
        }
    }

    showLoading() {
        document.getElementById('loadingSpinner').classList.remove('d-none');
    }

    hideLoading() {
        document.getElementById('loadingSpinner').classList.add('d-none');
    }

    showMessage(message, type = 'info') {
        try {
            const messageDiv = document.createElement('div');
            messageDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'info'} alert-dismissible fade show`;
            messageDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            const container = document.querySelector('.container-fluid');
            if (container) {
                container.insertBefore(messageDiv, container.firstChild);
                
                setTimeout(() => {
                    if (messageDiv.parentElement) {
                        messageDiv.remove();
                    }
                }, 5000);
            } else {
                // إذا لم يكن container موجوداً، استخدم alert عادي
                alert(message);
            }
        } catch (error) {
            console.error('خطأ في عرض الرسالة:', error);
            alert(message); // نسخة احتياطية
        }
    }
}

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    window.dailyCashierApp = new DailyCashier();
});