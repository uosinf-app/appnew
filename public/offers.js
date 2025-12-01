// offers.js - الإصدار المصحح والمتوافق مع هيكل Supabase الفعلي

class PriceOffers {
    constructor() {
        this.currentOffers = [];
        this.usingSupabase = false;
        this.supabase = null;
        this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
        this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
        
        // استخدام appConfig الموجود عالمياً مع قيم افتراضية
        this.apiUrl = window.appConfig?.get('OFFERS') || `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/offers`;
        this.storesApi = window.appConfig?.get('STORES') || `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/stores`;
        this.itemsApi = window.appConfig?.get('ITEMS') || `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/items`;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 تهيئة نظام العروض...');
            
            // تهيئة نظام الاتصال المزدوج
            await this.initializeConnection();
            
            // تحميل البيانات
            await this.loadStores();
            await this.loadItems();
            this.setDefaultDates();
            this.attachEventListeners();
            this.setupEnterNavigation();
            await this.loadOffers();
            
            console.log('✅ تم تهيئة نظام العروض بنجاح');
            
        } catch (error) {
            console.error('❌ خطأ في تهيئة النظام:', error);
            this.showToast('❌ فشل في تهيئة النظام', 'error');
        }
    }

    /**
     * تهيئة نظام الاتصال المزدوج
     */
    async initializeConnection() {
        try {
            this.updateConnectionStatus('connecting', '🔄 جاري الاتصال...');

            // التحقق من التفضيل المحفوظ - إجبار Supabase
            const preferredConnection = 'supabase'; // إجبار الاتصال بـ Supabase
            
            console.log(`🔍 وضع الاتصال المفضل: ${preferredConnection}`);

            // محاولة الاتصال بـ Supabase أولاً (مطلوب)
            try {
                const supabaseSuccess = await this.initializeSupabase();
                if (supabaseSuccess) {
                    this.usingSupabase = true;
                    this.updateConnectionStatus('supabase', '🌐 Supabase مباشر');
                    console.log('✅ الاتصال بـ Supabase ناجح');
                    return;
                }
            } catch (error) {
                console.warn('⚠️ فشل الاتصال بـ Supabase:', error);
                // الاستمرار بالمحلي كخيار احتياطي
            }

            // استخدام الاتصال المحلي كخيار احتياطي فقط
            this.usingSupabase = false;
            this.updateConnectionStatus('local', '🔗 اتصال محلي (احتياطي)');
            console.log('✅ استخدام الاتصال المحلي كخيار احتياطي');

        } catch (error) {
            console.error('❌ خطأ في initializeConnection:', error);
            this.updateConnectionStatus('error', '❌ خطأ في الاتصال');
        }
    }

    /**
     * تهيئة Supabase
     */
    async initializeSupabase() {
        return new Promise((resolve, reject) => {
            try {
                // التحقق من وجود مكتبة Supabase
                if (typeof window.supabase === 'undefined') {
                    // محاولة تحميل المكتبة ديناميكياً
                    this.loadSupabaseLibrary()
                        .then(() => {
                            this.createSupabaseClient()
                                .then(() => resolve(true))
                                .catch(reject);
                        })
                        .catch(reject);
                } else {
                    // المكتبة موجودة، إنشاء العميل
                    this.createSupabaseClient()
                        .then(() => resolve(true))
                        .catch(reject);
                }
                    
            } catch (error) {
                console.error('❌ خطأ في initializeSupabase:', error);
                reject(error);
            }
        });
    }

    /**
     * تحميل مكتبة Supabase ديناميكياً
     */
    async loadSupabaseLibrary() {
        return new Promise((resolve, reject) => {
            // التحقق إذا كانت المكتبة محملة مسبقاً
            if (typeof window.supabase !== 'undefined') {
                resolve();
                return;
            }

            // إنشاء عنصر script لتحميل المكتبة
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                console.log('✅ تم تحميل مكتبة Supabase بنجاح');
                resolve();
            };
            script.onerror = () => {
                console.error('❌ فشل تحميل مكتبة Supabase');
                reject(new Error('فشل تحميل مكتبة Supabase'));
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * إنشاء عميل Supabase
     */
    async createSupabaseClient() {
        return new Promise((resolve, reject) => {
            try {
                // استخدام النسخة الموجودة من Supabase إذا كانت متاحة
                if (window.__SUPABASE_CLIENT__) {
                    this.supabase = window.__SUPABASE_CLIENT__;
                    console.log('✅ استخدام نسخة Supabase الموجودة');
                    resolve(true);
                    return;
                }

                // إنشاء نسخة جديدة
                this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
                window.__SUPABASE_CLIENT__ = this.supabase;
                
                // اختبار الاتصال
                this.supabase.from('item_price_offers').select('count').limit(1)
                    .then(({ error }) => {
                        if (error) {
                            console.error('❌ فشل اختبار الاتصال بـ Supabase:', error);
                            reject(error);
                        } else {
                            console.log('✅ Supabase initialized successfully');
                            resolve(true);
                        }
                    })
                    .catch(reject);
                    
            } catch (error) {
                console.error('❌ خطأ في createSupabaseClient:', error);
                reject(error);
            }
        });
    }

    /**
     * تحديث شريط حالة الاتصال
     */
    updateConnectionStatus(status, message = '') {
        try {
            let statusDiv = document.getElementById('connectionStatus');
            
            // إنشاء شريط الحالة إذا لم يكن موجوداً
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.id = 'connectionStatus';
                statusDiv.className = 'connection-status';
                statusDiv.innerHTML = `
                    <span id="statusText">${message}</span>
                    <button class="switch-btn" onclick="window.priceOffers.switchConnectionMode()">
                        تبديل الاتصال
                    </button>
                `;
                document.body.insertBefore(statusDiv, document.body.firstChild);
            }

            // تحديث الحالة
            statusDiv.className = `connection-status ${status}`;
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = message;
            }

            console.log(`✅ تم تحديث حالة الاتصال: ${status} - ${message}`);

        } catch (error) {
            console.error('❌ خطأ في updateConnectionStatus:', error);
        }
    }

    /**
     * تبديل وضع الاتصال
     */
    switchConnectionMode() {
        try {
            const currentMode = this.usingSupabase ? 'supabase' : 'local';
            const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
            
            // حفظ التفضيل
            localStorage.setItem('preferred_connection', newMode);
            
            this.usingSupabase = (newMode === 'supabase');
            
            if (this.usingSupabase) {
                this.updateConnectionStatus('supabase', '🌐 Supabase مباشر');
                this.showToast('🔄 تم التبديل إلى Supabase', 'success');
            } else {
                this.updateConnectionStatus('local', '🔗 اتصال محلي');
                this.showToast('🔄 تم التبديل إلى الاتصال المحلي', 'success');
            }
            
            // إعادة تحميل البيانات
            this.reloadAllData();
            
        } catch (error) {
            console.error('❌ خطأ في switchConnectionMode:', error);
            this.showToast('❌ فشل في تبديل الاتصال', 'error');
        }
    }

    /**
     * إعادة تحميل جميع البيانات
     */
    async reloadAllData() {
        try {
            await this.loadStores();
            await this.loadItems();
            await this.loadOffers();
            this.showToast('✅ تم تحديث البيانات', 'success');
        } catch (error) {
            console.error('❌ خطأ في reloadAllData:', error);
            this.showToast('❌ فشل في تحديث بعض البيانات', 'warning');
        }
    }

    /**
     * تحميل الفروع من المصدر المناسب
     */
    async loadStores() {
        try {
            let stores = [];

            if (this.usingSupabase && this.supabase) {
                // التحميل من Supabase - استخدام الأسماء الصحيحة
                const { data, error } = await this.supabase
                    .from('stores')
                    .select('*')
                    .order('store_name'); // استخدام store_nm بدلاً من store_name

                if (error) throw error;
                stores = data || [];
            } else {
                // التحميل من API المحلي
                const res = await fetch(this.storesApi);
                if (!res.ok) throw new Error("خطأ في تحميل المخازن");
                stores = await res.json();
            }

            const storeSelect = document.getElementById('store_id');
            storeSelect.innerHTML = '<option value="">اختر الفرع</option>';
            stores.forEach(store => {
                const storeName = store.store_name || store.store_name || store.name || 'بدون اسم';
                storeSelect.add(new Option(storeName, store.store_id));
            });

            console.log(`✅ تم تحميل ${stores.length} فرع`);

        } catch (err) {
            console.error(err);
            this.showToast("❌ خطأ في تحميل الفروع", 'error');
        }
    }

    /**
     * تحميل الأصناف من المصدر المناسب
     */
    async loadItems() {
        try {
            let items = [];

            if (this.usingSupabase && this.supabase) {
                // التحميل من Supabase - استخدام الأسماء الصحيحة
                const { data, error } = await this.supabase
                    .from('items')
                    .select('*')
                    .order('item_nm'); // استخدام item_nm بدلاً من item_name

                if (error) throw error;
                items = data || [];
            } else {
                // التحميل من API المحلي
                const res = await fetch(this.itemsApi);
                if (!res.ok) throw new Error("خطأ في تحميل الأصناف");
                items = await res.json();
            }

            const itemSelect = document.getElementById('item_id');
            itemSelect.innerHTML = '<option value="">اختر الصنف</option>';
            items.forEach(item => {
                const itemName = item.item_nm || item.item_name || item.name || 'بدون اسم';
                itemSelect.add(new Option(itemName, item.item_id));
            });

            console.log(`✅ تم تحميل ${items.length} صنف`);

        } catch (err) {
            console.error(err);
            this.showToast("❌ خطأ في تحميل الأصناف", 'error');
        }
    }

    /**
     * تحميل العروض من المصدر المناسب
     */
    async loadOffers() {
        try {
            if (this.usingSupabase && this.supabase) {
                // التحميل من Supabase - بدون JOINs (لأن العلاقات غير معرفة)
                const { data, error } = await this.supabase
                    .from('item_price_offers')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                this.currentOffers = data || [];
                
                // تحميل أسماء الفروع والأصناف بشكل منفصل
                await this.enrichOffersData();
                
            } else {
                // التحميل من API المحلي - استخدام URL صحيح
                const offersApi = window.appConfig?.get('OFFERS_SHOW') || 
                                 `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/item_price_offers`;
                
                const res = await fetch(offersApi);
                if (!res.ok) throw new Error('فشل جلب العروض');
                const data = await res.json();
                this.currentOffers = Array.isArray(data) ? data : [];
            }

            this.renderOffers();
            console.log(`✅ تم تحميل ${this.currentOffers.length} عرض`);

        } catch (err) {
            console.error(err);
            this.showToast(`❌ ${err.message}`, 'error');
        }
    }

    /**
     * إثراء بيانات العروض بأسماء الفروع والأصناف
     */
    async enrichOffersData() {
        try {
            if (!this.usingSupabase || !this.supabase) return;

            // تحميل الفروع والأصناف للحصول على الأسماء
            const [storesResult, itemsResult] = await Promise.all([
                this.supabase.from('stores').select('store_id, store_name'),
                this.supabase.from('items').select('item_id, item_nm')
            ]);

            const storesMap = new Map();
            const itemsMap = new Map();

            if (storesResult.data) {
                storesResult.data.forEach(store => {
                    storesMap.set(store.store_id, store.store_name);
                });
            }

            if (itemsResult.data) {
                itemsResult.data.forEach(item => {
                    itemsMap.set(item.item_id, item.item_nm);
                });
            }

            // إثراء بيانات العروض
            this.currentOffers = this.currentOffers.map(offer => ({
                ...offer,
                store_name: storesMap.get(offer.store_id) || offer.store_id,
                item_name: itemsMap.get(offer.item_id) || offer.item_id
            }));

        } catch (error) {
            console.warn('⚠️ فشل في إثراء بيانات العروض:', error);
            // الاستمرار بدون أسماء
            this.currentOffers = this.currentOffers.map(offer => ({
                ...offer,
                store_name: offer.store_id,
                item_name: offer.item_id
            }));
        }
    }

    /**
     * إضافة عرض جديد
     */
    async addOffer() {
        try {
            const payload = {
                store_id: document.getElementById('store_id').value,
                item_id: document.getElementById('item_id').value,
                offer_price1: parseFloat(document.getElementById('offer_price1').value) || null,
                offer_price2: parseFloat(document.getElementById('offer_price2').value) || null,
                offer_price3: parseFloat(document.getElementById('offer_price3').value) || null,
                start_date: document.getElementById('startDate').value,
                end_date: document.getElementById('endDate').value || null,
                is_active: true,
                created_by: "Admin"
            };

            if (!payload.store_id || !payload.item_id || !payload.start_date){
                this.showToast('⚠️ الفرع والصنف وتاريخ البداية إلزامية', 'warning');
                return;
            }

            let result;

            if (this.usingSupabase && this.supabase) {
                // الحفظ في Supabase
                const { data, error } = await this.supabase
                    .from('item_price_offers')
                    .insert([payload])
                    .select();

                if (error) throw error;
                result = data;

            } else {
                // الحفظ في API المحلي
                const offersApi = window.appConfig?.get('OFFERS') || 
                                 `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/item_price_offers`;
                
                const res = await fetch(offersApi, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });

                if(!res.ok){
                    const errData = await res.json().catch(()=>({error:'فشل حفظ العرض'}));
                    throw new Error(errData.error || 'فشل حفظ العرض');
                }
                result = await res.json();
            }

            this.showToast('✅ تم إضافة العرض بنجاح', 'success');
            this.clearForm();
            this.loadOffers();

        } catch (err) {
            console.error(err);
            this.showToast(`❌ ${err.message}`, 'error');
        }
    }

    /**
     * تبديل حالة العرض
     */
    async toggleOffer(id, currentStatus) {
        try {
            if (this.usingSupabase && this.supabase) {
                // التحديث في Supabase
                const { error } = await this.supabase
                    .from('item_price_offers')
                    .update({ is_active: !currentStatus })
                    .eq('offer_id', id);

                if (error) throw error;
            } else {
                // التحديث في API المحلي
                const offersApi = window.appConfig?.get('OFFERS') || 
                                 `${window.APP_CONFIG?.BASE_URL || 'http://localhost:3000'}/api/item_price_offers`;
                
                const res = await fetch(`${offersApi}/${id}`, {
                    method: 'PATCH',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({is_active: !currentStatus})
                });
                
                if(!res.ok){
                    const errData = await res.json().catch(()=>({error:'فشل تحديث الحالة'}));
                    throw new Error(errData.error || 'فشل تحديث الحالة');
                }
            }

            this.loadOffers();
            this.showToast('✅ تم تحديث الحالة', 'success');

        } catch(err) {
            console.error(err);
            this.showToast(`❌ ${err.message}`, 'error');
        }
    }

    /**
     * عرض الرسائل للمستخدم
     */
    showToast(message, type = 'info') {
        // استخدام alert مؤقتاً - يمكن استبداله بمكتبة toast لاحقاً
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
        alert(`${icon} ${message}`);
    }

    setDefaultDates() {
        const today = new Date();
        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        document.getElementById('endDate').value = '';
    }

    attachEventListeners() {
        document.getElementById('addOfferBtn').addEventListener('click', () => this.addOffer());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearForm());
    }

    setupEnterNavigation() {
        const fields = ['store_id','item_id','offer_price1','offer_price2','offer_price3','startDate','endDate'];
        fields.forEach((id, idx) => {
            const field = document.getElementById(id);
            if (field) {
                field.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if(idx < fields.length-1) document.getElementById(fields[idx+1]).focus();
                        else document.getElementById('addOfferBtn').focus();
                    }
                });
            }
        });
    }

    renderOffers() {
        const container = document.getElementById('offersData');
        if(!this.currentOffers.length){
            container.innerHTML = '<div class="no-data">⚠️ لا توجد عروض حالية</div>';
            return;
        }

        let html = `<table>
            <thead>
                <tr>
                    <th>#</th><th>الفرع</th><th>الصنف</th>
                    <th>السعر 1</th><th>السعر 2</th><th>السعر 3</th>
                    <th>تاريخ البداية</th><th>تاريخ النهاية</th><th>فعال</th><th>إجراءات</th>
                </tr>
            </thead><tbody>`;

        this.currentOffers.forEach((o, idx) => {
            html += `<tr>
                <td>${idx+1}</td>
                <td>${o.store_name || o.store_name || o.store_id}</td>
                <td>${o.item_name || o.item_nm || o.item_id}</td>
                <td>${o.offer_price1||''}</td>
                <td>${o.offer_price2||''}</td>
                <td>${o.offer_price3||''}</td>
                <td>${o.start_date||''}</td>
                <td>${o.end_date||''}</td>
                <td>${o.is_active? 'نعم':'لا'}</td>
                <td>
                    <button onclick="window.priceOffers.toggleOffer(${o.offer_id},${o.is_active})">
                        ${o.is_active? 'إيقاف':'تفعيل'}
                    </button>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    clearForm(){
        ['store_id','item_id','offer_price1','offer_price2','offer_price3','startDate','endDate'].forEach(id=>{
            document.getElementById(id).value = '';
        });
        this.setDefaultDates();
        document.getElementById('store_id').focus();
    }
}

// الانتظار حتى تحميل DOM وتهيئة appConfig
document.addEventListener('DOMContentLoaded', () => { 
    // الانتظار لضمان تحميل جميع المكتبات
    setTimeout(() => {
        window.priceOffers = new PriceOffers(); 
    }, 500);
});