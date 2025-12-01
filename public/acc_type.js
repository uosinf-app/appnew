
// ⚡ التهيئة العالمية
const SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';

let supabase;
let allAccountTypes = [];
let currentPage = 1;
let itemsPerPage = 10;
let isEditing = false;
let originalAccountTypeId = null;

// ✅ الحصول على وضع الاتصال الحالي
function getConnectionMode() {
    return localStorage.getItem('connection_mode') || 
            sessionStorage.getItem('connection_mode') || 
            'auto';
}

// ✅ تحديث شريط حالة الاتصال
function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    const mode = getConnectionMode();
    
    if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        statusDiv.innerHTML = '🌐 Supabase مباشر <button class="switch-btn" onclick="switchConnectionMode()">تبديل</button>';
        statusDiv.className = 'connection-status supabase';
    } else {
        statusDiv.innerHTML = '🔗 اتصال محلي <button class="switch-btn" onclick="switchConnectionMode()">تبديل</button>';
        statusDiv.className = 'connection-status local';
    }
}

// ✅ تبديل وضع الاتصال
function switchConnectionMode() {
    const currentMode = getConnectionMode();
    const newMode = currentMode === 'supabase' ? 'local' : 'supabase';
    
    localStorage.setItem('connection_mode', newMode);
    sessionStorage.setItem('connection_mode', newMode);
    
    updateConnectionStatus();
    alert(`🔄 تم التبديل إلى: ${newMode === 'supabase' ? 'Supabase مباشر' : 'الاتصال المحلي'}`);
    
    // إعادة تحميل البيانات
    loadAccountTypes();
}

// ✅ تهيئة Supabase
function initializeSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase initialized');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
        return false;
    }
}

// ✅ تحميل البيانات (تعمل مع كلا الوضعين)
async function loadAccountTypes() {
    const statusDiv = document.getElementById('connectionStatus');
    const loadingDiv = document.getElementById('loading');
    
    statusDiv.innerHTML = '🔄 جاري تحميل أنواع الحسابات... <span class="loading-spinner"></span>';
    loadingDiv.style.display = 'block';
    
    try {
        const mode = getConnectionMode();
        console.log(`🔄 جاري تحميل أنواع الحسابات - الوضع: ${mode}`);

        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            // استخدام Supabase
            if (!supabase) initializeSupabase();
            
            const { data, error } = await supabase
                .from('account_types')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            allAccountTypes = data || [];
            console.log(`✅ تم تحميل ${allAccountTypes.length} نوع حساب من Supabase`);
            statusDiv.innerHTML = `🌐 Supabase - ${allAccountTypes.length} نوع حساب <button class="switch-btn" onclick="switchConnectionMode()">تبديل</button>`;
        } else {
            // استخدام API التقليدي
            const apiUrl = appConfig.get('ACCOUNT_TYPES');
            console.log('🔗 استخدام API التقليدي:', apiUrl);
            
            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(`خطأ في الخادم: ${res.status}`);
            
            const result = await res.json();
            if (result.success) {
                allAccountTypes = result.data || [];
            } else {
                throw new Error(result.message);
            }
            
            console.log(`✅ تم تحميل ${allAccountTypes.length} نوع حساب من الخادم المحلي`);
            statusDiv.innerHTML = `🔗 اتصال محلي - ${allAccountTypes.length} نوع حساب <button class="switch-btn" onclick="switchConnectionMode()">تبديل</button>`;
        }
        
        renderTable();
    } catch (err) {
        console.error("❌ خطأ في تحميل أنواع الحسابات:", err);
        statusDiv.innerHTML = '❌ فشل تحميل أنواع الحسابات <button class="switch-btn" onclick="switchConnectionMode()">تبديل</button>';
        
        // التحول التلقائي إلى Supabase في حالة الفشل
        if (getConnectionMode() !== 'supabase') {
            const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
            if (switchNow) {
                localStorage.setItem('connection_mode', 'supabase');
                loadAccountTypes();
            }
        }
        
        allAccountTypes = [];
        renderTable();
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// ✅ حفظ البيانات (تعمل مع كلا الوضعين)
async function saveAccountType() {
    const form = document.getElementById('accountTypeForm');
    const nameInput = document.getElementById('accountTypeName');
    const idInput = document.getElementById('accountTypeId');
    
    // التحقق من الصحة
    form.classList.add('was-validated');
    if (!nameInput.value.trim()) {
        return;
    }
    
    const accountTypeData = {
        account_type_name: nameInput.value.trim()
    };
    
    if (isEditing && idInput.value) {
        accountTypeData.account_type_id = parseInt(idInput.value);
    }
    
    try {
        const mode = getConnectionMode();
        console.log(`💾 جاري حفظ نوع الحساب - الوضع: ${mode}`);

        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            // استخدام Supabase
            if (!supabase) initializeSupabase();
            
            if (isEditing) {
                // تعديل
                const { error } = await supabase
                    .from('account_types')
                    .update(accountTypeData)
                    .eq('account_type_id', idInput.value);
                
                if (error) throw error;
            } else {
                // إضافة
                const { error } = await supabase
                    .from('account_types')
                    .insert([accountTypeData]);
                
                if (error) throw error;
            }
            
            alert("✅ تم حفظ نوع الحساب بنجاح في Supabase");
        } else {
            // استخدام API التقليدي
            const apiUrl = appConfig.get('ACCOUNT_TYPES');
            
            if (isEditing) {
                await fetch(`${apiUrl}/${idInput.value}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(accountTypeData)
                });
            } else {
                await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(accountTypeData)
                });
            }
            
            alert("✅ تم حفظ نوع الحساب بنجاح");
        }

        // إغلاق المودال وإعادة التحميل
        const modal = bootstrap.Modal.getInstance(document.getElementById('accountTypeModal'));
        modal.hide();
        form.reset();
        isEditing = false;
        originalAccountTypeId = null;
        loadAccountTypes();
    } catch (err) {
        console.error("❌ خطأ أثناء الحفظ:", err);
        alert("❌ حدث خطأ أثناء الحفظ. تحقق من الاتصال أو القيم المدخلة.");
    }
}

// ✅ تعديل (تعمل مع كلا الوضعين)
async function editAccountType(id) {
    try {
        const mode = getConnectionMode();
        console.log(`✏️ جاري تحميل بيانات نوع الحساب: ${id} - الوضع: ${mode}`);

        let accountType;
        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            // استخدام Supabase
            if (!supabase) initializeSupabase();
            
            const { data, error } = await supabase
                .from('account_types')
                .select('*')
                .eq('account_type_id', id)
                .single();
            
            if (error) throw error;
            accountType = data;
        } else {
            // استخدام API التقليدي
            const apiUrl = appConfig.get('ACCOUNT_TYPES');
            const res = await fetch(`${apiUrl}/${id}`);
            if (!res.ok) throw new Error('فشل تحميل البيانات');
            
            const result = await res.json();
            if (result.success) {
                accountType = result.data;
            } else {
                throw new Error(result.message);
            }
        }
        
        document.getElementById("accountTypeId").value = accountType.account_type_id;
        document.getElementById("accountTypeName").value = accountType.account_type_name;
        document.getElementById("modalTitle").textContent = "تعديل نوع الحساب";
        
        isEditing = true;
        originalAccountTypeId = accountType.account_type_id;
        
        const modal = new bootstrap.Modal(document.getElementById('accountTypeModal'));
        modal.show();
        
        setTimeout(() => document.getElementById("accountTypeName").focus(), 500);
    } catch (err) {
        console.error('❌ خطأ في التعديل:', err);
        alert('❌ فشل في تحميل بيانات نوع الحساب');
    }
}

// ✅ حذف (تعمل مع كلا الوضعين)
async function deleteAccountType(id) {
    if (!confirm("هل تريد حذف هذا النوع من الحساب؟")) return;
    
    try {
        const mode = getConnectionMode();
        console.log(`🗑️ جاري حذف نوع الحساب: ${id} - الوضع: ${mode}`);

        if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
            // استخدام Supabase
            if (!supabase) initializeSupabase();
            
            const { error } = await supabase
                .from('account_types')
                .delete()
                .eq('account_type_id', id);
            
            if (error) throw error;
        } else {
            // استخدام API التقليدي
            const apiUrl = appConfig.get('ACCOUNT_TYPES');
            const res = await fetch(`${apiUrl}/${id}`, { method: "DELETE" });
            
            const result = await res.json();
            if (!result.success) throw new Error(result.message);
        }
        
        allAccountTypes = allAccountTypes.filter(item => item.account_type_id !== parseInt(id));
        renderTable();
        alert('✅ تم حذف نوع الحساب بنجاح');
    } catch (err) {
        console.error('❌ خطأ في الحذف:', err);
        alert('❌ فشل في حذف نوع الحساب');
    }
}

// ✅ عرض البيانات في الجدول
function renderTable() {
    const items = filteredItems();
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = items.slice(start, end);

    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";
    
    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-3"></i>
                    <br>
                    لا توجد بيانات
                </td>
            </tr>
        `;
        renderPagination(0);
        renderCount(0);
        return;
    }

    pageItems.forEach((item, index) => {
        const tr = document.createElement("tr");
        const serial = start + index + 1;
        tr.innerHTML = `
            <td>${serial}</td>
            <td>${escapeHtml(item.account_type_name)}</td>
            <td>${new Date(item.created_at).toLocaleDateString('ar-EG')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" onclick="editAccountType(${item.account_type_id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAccountType(${item.account_type_id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(totalPages);
    renderCount(items.length);
}

// ✅ الترقيم
function renderPagination(totalPages) {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    
    if (totalPages <= 1) return;
    
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = "page-btn" + (i === currentPage ? " active" : "");
        btn.onclick = () => {
            currentPage = i;
            renderTable();
        };
        pagination.appendChild(btn);
    }
}

// ✅ عرض العدد
function renderCount(count) {
    const countDiv = document.getElementById("itemCount");
    countDiv.textContent = `عدد أنواع الحسابات: ${count}`;
}

// ✅ البحث
function filteredItems() {
    const query = document.getElementById("searchBox").value.toLowerCase().trim();
    if (!query) return allAccountTypes;

    return allAccountTypes.filter(item => 
        item.account_type_name.toLowerCase().includes(query)
    );
}

// ✅ حماية من XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ✅ إعداد Event Listeners
document.addEventListener("DOMContentLoaded", function() {
    // تهيئة Supabase
    initializeSupabase();
    
    // تحديث حالة الاتصال
    updateConnectionStatus();
    
    // تحميل البيانات
    loadAccountTypes();

    // إعداد الأحداث
    document.getElementById('addAccountTypeBtn').addEventListener('click', function() {
        document.getElementById('accountTypeForm').reset();
        document.getElementById('modalTitle').textContent = "إضافة نوع حساب جديد";
        document.getElementById('accountTypeForm').classList.remove('was-validated');
        isEditing = false;
        originalAccountTypeId = null;
        
        const modal = new bootstrap.Modal(document.getElementById('accountTypeModal'));
        modal.show();
        
        setTimeout(() => document.getElementById("accountTypeName").focus(), 500);
    });

    document.getElementById('saveAccountTypeBtn').addEventListener('click', saveAccountType);

    document.getElementById('searchBox').addEventListener('input', function() {
        currentPage = 1;
        renderTable();
    });

    // إدخال البيانات باستخدام Enter
    document.getElementById('accountTypeName').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveAccountType();
        }
    });

    // إعادة تعيين النموذج عند إغلاق المودال
    document.getElementById('accountTypeModal').addEventListener('hidden.bs.modal', function() {
        document.getElementById('accountTypeForm').reset();
        document.getElementById('accountTypeForm').classList.remove('was-validated');
        isEditing = false;
        originalAccountTypeId = null;
    });
});
