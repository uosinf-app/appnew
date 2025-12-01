// attend.js - Frontend for Attendance Management with Hybrid System
class AttendanceApp {
  constructor() {
    this.SUPABASE_URL = 'https://rvjacvrrpguehbapvewe.supabase.co';
    this.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2amFjdnJycGd1ZWhiYXB2ZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMjUxNTksImV4cCI6MjA3ODYwMTE1OX0.wSavKzxKOF7-56G-pzDMtbXNrCNAbGs0wvadw-cilBg';
    
    this.supabase = null;
    this.state = {
      employees: [],
      attendance: [],
      currentEditId: null,
      isLoading: false
    };
    this.dom = this._initDOM();
    this.supabase = this._initSupabase();
    this._setupEventListeners();
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
      form: document.getElementById("att-form"),
      emp_id: document.getElementById("emp_id"),
      att_date: document.getElementById("att_date"),
      check_in: document.getElementById("check_in"),
      check_out: document.getElementById("check_out"),
      notes: document.getElementById("notes"),
      tableBody: document.querySelector("#att-table tbody"),
      saveBtn: document.getElementById("save-btn"),
      newBtn: document.getElementById("new-btn"),
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

  // ======================== 🎯 إعداد مستمعي الأحداث ========================
  _setupEventListeners() {
    this.dom.form.addEventListener("submit", e => this._saveAttendance(e));
    this.dom.newBtn.addEventListener("click", () => this._clearForm());
    
    // تعيين التاريخ الحالي افتراضياً
    this.dom.att_date.value = new Date().toISOString().split('T')[0];
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
      statusDiv.innerHTML = '🌐 Online مباشر <button class="switch-btn" onclick="attendanceApp.switchConnectionMode()">تبديل</button>';
      statusDiv.className = 'connection-status supabase';
    } else {
      statusDiv.innerHTML = '🔗 اتصال محلي <button class="switch-btn" onclick="attendanceApp.switchConnectionMode()">تبديل</button>';
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
    this._loadEmployees();
    this._loadAttendance();
  }

  // ======================== 🚀 تهيئة التطبيق ========================
  async init() {
    this.updateConnectionStatus();
    await this._loadEmployees();
    await this._loadAttendance();
    this._showAlert('✅ تم تهيئة نظام الحضور والانصراف', 'success');
  }

  // ======================== 📥 تحميل الموظفين ========================
  async _loadEmployees() {
    try {
      const mode = this.getConnectionMode();
      let employees = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب الموظفين من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('employees')
          .select('*')
          .order('emp_id');
        
        if (error) throw error;
        
        employees = data || [];
        console.log(`✅ تم تحميل ${employees.length} موظف من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/emplbk';
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          employees = result.data || result;
        } else {
          throw new Error(result.message || 'خطأ في تحميل الموظفين');
        }
        
        console.log(`✅ تم تحميل ${employees.length} موظف من الخادم المحلي`);
      }

      this.state.employees = employees;
      this._renderEmployeesDropdown();
      
    } catch (error) {
      console.error("❌ Error loading employees:", error);
      this._showAlert("خطأ في تحميل الموظفين", "danger");
      
      // التحول التلقائي إلى Supabase في حالة الفشل
      if (this.getConnectionMode() !== 'supabase') {
        const switchNow = confirm('فشل الاتصال بالخادم المحلي. هل تريد التبديل إلى Supabase؟');
        if (switchNow) {
          localStorage.setItem('connection_mode', 'supabase');
          this._loadEmployees();
        }
      }
    }
  }

  // ======================== 📥 تحميل سجلات الحضور ========================
  async _loadAttendance() {
    this._setLoading(true);
    
    try {
      const mode = this.getConnectionMode();
      let attendance = [];

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        console.log('🔄 جاري جلب سجلات الحضور من Supabase');
        
        if (!this.supabase) {
          throw new Error('Supabase client not initialized');
        }
        
        const { data, error } = await this.supabase
          .from('attendance')
          .select(`
            *,
            employees(first_name, last_name)
          `)
          .order('attendance_date', { ascending: false });
        
        if (error) throw error;
        
        attendance = data.map(record => ({
          ...record,
          first_name: record.employees?.first_name || '',
          last_name: record.employees?.last_name || '',
          // للحفاظ على التوافق مع الكود السابق
          att_date: record.attendance_date,
          att_id: record.attendance_id
        }));
        
        console.log(`✅ تم تحميل ${attendance.length} سجل حضور من Supabase`);
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/attendbk';
        console.log('🔗 استخدام API التقليدي:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`خطأ في الشبكة: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
          attendance = result.data || result;
        } else {
          throw new Error(result.message || 'خطأ في تحميل سجلات الحضور');
        }
        
        console.log(`✅ تم تحميل ${attendance.length} سجل حضور من الخادم المحلي`);
      }

      this.state.attendance = attendance;
      this._renderTable();
      
    } catch (error) {
      console.error("❌ Error loading attendance:", error);
      this._showAlert("خطأ في تحميل سجلات الحضور", "danger");
    } finally {
      this._setLoading(false);
    }
  }

  // ======================== 🎨 عرض الموظفين في Dropdown ========================
  _renderEmployeesDropdown() {
    if (this.dom.emp_id) {
      this.dom.emp_id.innerHTML = `
        <option value="">اختر الموظف</option>
        ${this.state.employees.map(employee => `
          <option value="${employee.emp_id}">
            ${this._escapeHtml(employee.first_name)} ${this._escapeHtml(employee.last_name || '')}
          </option>
        `).join('')}
      `;
    }
  }

  // ======================== 🎨 عرض البيانات في الجدول ========================
  _renderTable() {
    const { attendance } = this.state;
    
    if (!attendance || attendance.length === 0) {
      this.dom.tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">
            <i class="fas fa-inbox me-2"></i>لا توجد بيانات للعرض
          </td>
        </tr>
      `;
      return;
    }

    this.dom.tableBody.innerHTML = attendance.map((record, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${this._escapeHtml(record.first_name)} ${this._escapeHtml(record.last_name || '')}</td>
        <td>${this._formatDate(record.attendance_date || record.att_date)}</td>
        <td>${record.check_in || '-'}</td>
        <td>${record.check_out || '-'}</td>
        <td>${this._renderStatusBadge(record.status)}</td>
        <td>${this._escapeHtml(record.notes || '')}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="attendanceApp.editAttendance(${record.attendance_id || record.att_id})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="attendanceApp.deleteAttendance(${record.attendance_id || record.att_id})">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // ======================== 🎨 عرض حالة الحضور ========================
  _renderStatusBadge(status) {
    if (!status) return '-';
    
    const statusMap = {
      present: '<span class="badge bg-success">حاضر</span>',
      absent: '<span class="badge bg-danger">غائب</span>',
      late: '<span class="badge bg-warning">متأخر</span>',
      early: '<span class="badge bg-info">مبكر</span>'
    };
    
    return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
  }

  // ======================== 💾 حفظ سجل الحضور ========================
  async _saveAttendance(e) {
    e.preventDefault();
    
    // التحقق من صحة البيانات
    if (!this.dom.emp_id.value) {
      this._showAlert("يرجى اختيار الموظف", "warning");
      return;
    }

    if (!this.dom.att_date.value) {
      this._showAlert("يرجى اختيار التاريخ", "warning");
      return;
    }

    if (!this.dom.check_in.value) {
      this._showAlert("يرجى إدخال وقت الحضور", "warning");
      return;
    }

    this._setLoading(true);

    try {
      const attendanceData = {
        emp_id: parseInt(this.dom.emp_id.value),
        attendance_date: this.dom.att_date.value,
        check_in: this.dom.check_in.value,
        check_out: this.dom.check_out.value || null,
        notes: this.dom.notes.value || '',
        status: this._calculateStatus(this.dom.check_in.value, this.dom.check_out.value)
      };

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
            .from('attendance')
            .update(attendanceData)
            .eq('attendance_id', this.state.currentEditId)
            .select();

          if (error) throw error;
          result = { success: true, data: data[0] };
        } else {
          // إضافة
          const { data, error } = await this.supabase
            .from('attendance')
            .insert([attendanceData])
            .select();

          if (error) throw error;
          result = { success: true, data: data[0] };
        }
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/attendbk';
        let response;
        
        if (this.state.currentEditId) {
          // تعديل
          response = await fetch(`${apiUrl}/${this.state.currentEditId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(attendanceData)
          });
        } else {
          // إضافة
          response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(attendanceData)
          });
        }
        
        result = await response.json();
      }
      
      if (result.success) {
        this._showAlert(
          this.state.currentEditId ? "تم تعديل سجل الحضور بنجاح" : "تم إضافة سجل الحضور بنجاح",
          "success"
        );
        
        this._clearForm();
        await this._loadAttendance();
      } else {
        this._showAlert(result.message, "danger");
      }
    } catch (error) {
      console.error("❌ Error saving attendance:", error);
      this._showAlert("خطأ في حفظ سجل الحضور", "danger");
    } finally {
      this._setLoading(false);
    }
  }

  // ======================== 🧮 حساب حالة الحضور ========================
  _calculateStatus(checkIn, checkOut) {
    if (!checkIn) return 'absent';
    
    const checkInTime = new Date(`2000-01-01T${checkIn}`);
    const expectedTime = new Date(`2000-01-01T09:00:00`); // وقت الحضور المتوقع 9 صباحاً
    
    if (checkInTime > expectedTime) {
      return 'late';
    } else if (checkInTime < new Date(`2000-01-01T08:30:00`)) {
      return 'early';
    } else {
      return 'present';
    }
  }

  // ======================== ✏️ تعديل سجل الحضور ========================
  async editAttendance(id) {
    try {
      const mode = this.getConnectionMode();
      let record;

      if (mode === 'supabase' || (mode === 'auto' && !window.APP_CONFIG?.IS_LOCAL)) {
        // استخدام Supabase
        const { data, error } = await this.supabase
          .from('attendance')
          .select('*')
          .eq('attendance_id', id)
          .single();
        
        if (error) throw error;
        record = data;
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/attendbk';
        const response = await fetch(`${apiUrl}/${id}`);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message);
        }
        
        record = result.data;
      }

      this.state.currentEditId = id;
      
      // تعبئة النموذج
      this.dom.emp_id.value = record.emp_id;
      this.dom.att_date.value = (record.attendance_date || record.att_date).split('T')[0];
      this.dom.check_in.value = record.check_in || '';
      this.dom.check_out.value = record.check_out || '';
      this.dom.notes.value = record.notes || '';
      
      this.dom.saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>تحديث';
      
      this._showAlert('✅ جاهز للتعديل', 'info');
      
    } catch (error) {
      console.error("❌ Error editing attendance:", error);
      this._showAlert("خطأ في تحميل بيانات السجل", "danger");
    }
  }

  // ======================== 🗑️ حذف سجل الحضور ========================
  async deleteAttendance(id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) {
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
          .from('attendance')
          .delete()
          .eq('attendance_id', id);

        if (error) throw error;
        result = { success: true };
      } else {
        // استخدام API التقليدي
        const apiUrl = 'http://localhost:3000/api/attendbk';
        const response = await fetch(`${apiUrl}/${id}`, {
          method: "DELETE"
        });
        
        result = await response.json();
      }
      
      if (result.success) {
        this._showAlert("تم حذف السجل بنجاح", "success");
        await this._loadAttendance();
      } else {
        this._showAlert(result.message, "danger");
      }
    } catch (error) {
      console.error("❌ Error deleting attendance:", error);
      this._showAlert("خطأ في حذف السجل", "danger");
    }
  }

  // ======================== 🔄 إعادة تعيين النموذج ========================
  _clearForm() {
    this.state.currentEditId = null;
    this.dom.form.reset();
    this.dom.att_date.value = new Date().toISOString().split('T')[0];
    this.dom.saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>حفظ';
  }

  // ======================== ⏳ تعيين حالة التحميل ========================
  _setLoading(loading) {
    this.state.isLoading = loading;
    if (this.dom.saveBtn) {
      this.dom.saveBtn.disabled = loading;
      this.dom.saveBtn.innerHTML = loading ? 
        '<i class="fas fa-spinner fa-spin me-2"></i>جاري الحفظ...' : 
        '<i class="fas fa-save me-2"></i>حفظ';
    }
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
    
    const container = document.querySelector("body");
    if (container) {
      container.insertBefore(alertDiv, container.firstChild);
    }
    
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 5000);
  }

  // ======================== 📅 تنسيق التاريخ ========================
  _formatDate(dt) {
    return dt ? new Date(dt).toLocaleDateString('ar-EG') : '-';
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
let attendanceApp;
document.addEventListener("DOMContentLoaded", function() {
  attendanceApp = new AttendanceApp();
});