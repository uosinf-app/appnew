// ======================== 📁 empl.js ========================
const BASE_URL = "http://localhost:3000";
const API = {
  EMPLOYEES: `${BASE_URL}/api/emplbk`,
  DEPARTMENTS: `${BASE_URL}/api/emplbk/departments`
};

class EmployeeApp {
  constructor() {
    this.dom = this._initDOM();
    this._bindEvents();
    this.loadDepartments();
    this.loadEmployees();

    // ✅ ضبط تاريخ التعيين الافتراضي عند فتح الصفحة
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0]; // yyyy-mm-dd
    if (this.dom.hireDate) this.dom.hireDate.value = formattedDate;

    // ✅ تفعيل التنقل بين الحقول بالزر Enter
    this._enableEnterNavigation();
  }

  // ======================== 🔧 ربط العناصر ========================
  _initDOM() {
    return {
      form: document.getElementById("emp-form"),
      tableBody: document.querySelector("#emp-table tbody"),
      firstName: document.getElementById("first_name"),
      lastName: document.getElementById("last_name"),
      jobTitle: document.getElementById("job_title"),
      department: document.getElementById("department_id"),
      salary: document.getElementById("salary"),
      hireDate: document.getElementById("hire_date"),
      clearBtn: document.getElementById("clear-btn")
    };
  }

  // ======================== 🧠 الأحداث ========================
  _bindEvents() {
    this.dom.form.addEventListener("submit", (e) => this.saveEmployee(e));
    this.dom.clearBtn.addEventListener("click", () => this.clearForm());
  }

  // ======================== ↔️ التنقل باستخدام Enter ========================
  _enableEnterNavigation() {
    const inputs = this.dom.form.querySelectorAll("input, select");
    inputs.forEach((input, index) => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const next = inputs[index + 1];
          if (next) next.focus();
          else this.dom.form.requestSubmit(); // يرسل النموذج عند آخر حقل
        }
      });
    });
  }

  // ======================== 🏢 تحميل الإدارات ========================
  async loadDepartments() {
    try {
      const res = await fetch(API.DEPARTMENTS);
      const data = await res.json();
      this.dom.department.innerHTML = data
        .map(dep => `<option value="${dep.department_id}">${dep.department_name}</option>`)
        .join("");
    } catch (err) {
      console.error("❌ Error loading departments:", err);
    }
  }

  // ======================== 👥 تحميل الموظفين ========================
  async loadEmployees() {
    try {
      const res = await fetch(API.EMPLOYEES);
      const employees = await res.json();

      this.dom.tableBody.innerHTML = employees.map(emp => `
        <tr>
          <td>${emp.emp_id}</td>
          <td>${emp.first_name} ${emp.last_name}</td>
          <td>${emp.job_title || ""}</td>
          <td>${emp.department_name || ""}</td>
          <td>${emp.salary || 0}</td>
          <td>${emp.hire_date ? emp.hire_date.split("T")[0] : ""}</td>
          <td>
            <button onclick="app.editEmployee(${emp.emp_id})">✏️</button>
            <button onclick="app.deleteEmployee(${emp.emp_id})">🗑️</button>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      console.error("❌ Error loading employees:", err);
    }
  }

  // ======================== 💾 حفظ موظف ========================
  async saveEmployee(e) {
    e.preventDefault();

    const emp = {
      first_name: this.dom.firstName.value.trim(),
      last_name: this.dom.lastName.value.trim(),
      job_title: this.dom.jobTitle.value.trim(),
      department_id: this.dom.department.value || null,
      salary: this.dom.salary.value || 0,
      hire_date: this.dom.hireDate.value || null
    };

    try {
      const res = await fetch(API.EMPLOYEES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emp)
      });

      if (!res.ok) throw new Error("Insert failed");

      this.clearForm();
      this.loadEmployees();
      alert("✅ تم حفظ الموظف بنجاح");
    } catch (err) {
      console.error("❌ Error saving employee:", err);
      alert("حدث خطأ أثناء الحفظ");
    }
  }

  // ======================== 🗑️ حذف موظف ========================
  async deleteEmployee(id) {
    if (!confirm("هل تريد حذف هذا الموظف؟")) return;
    await fetch(`${API.EMPLOYEES}/${id}`, { method: "DELETE" });
    this.loadEmployees();
  }

  // ======================== 🧹 مسح النموذج ========================
  clearForm() {
    this.dom.form.reset();

    // إعادة تعيين تاريخ التعيين لتاريخ اليوم بعد المسح
    const today = new Date();
    this.dom.hireDate.value = today.toISOString().split("T")[0];
  }
}

// ✅ إنشاء الكائن العام للتطبيق
const app = new EmployeeApp();
