// ======================== 🧩 allstoresinfbk_front.js ========================
class AllStoresReport {
  constructor() {
    this.apiUrl = "/api/all-stores-report"; // رابط الراوتر الجديد
    this.dom = this.initDOM();
    this.bindEvents();
    this.loadReport(); // تحميل التقرير تلقائياً عند فتح الصفحة
  }

  initDOM() {
    return {
      fromDate: document.getElementById("fromDate"),
      toDate: document.getElementById("toDate"),
      tableBody: document.getElementById("reportTableBody"),
      btnFilter: document.getElementById("btnFilter"),
      btnExportExcel: document.getElementById("btnExportExcel"),
      btnExportPDF: document.getElementById("btnExportPDF"),
      chartCanvas: document.getElementById("reportChart"), // <canvas> للرسم البياني
    };
  }

  bindEvents() {
    this.dom.btnFilter.addEventListener("click", () => this.loadReport());
    this.dom.btnExportExcel.addEventListener("click", () => this.exportExcel());
    this.dom.btnExportPDF.addEventListener("click", () => this.exportPDF());
  }

  async loadReport() {
    const from = this.dom.fromDate.value;
    const to = this.dom.toDate.value;

    let url = this.apiUrl;
    if (from && to) url += `?from=${from}&to=${to}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      this.renderTable(data.data);
      this.renderChart(data.data); // رسم المخطط البياني
    } catch (err) {
      console.error("❌ خطأ عند تحميل التقرير:", err);
      alert("حدث خطأ أثناء تحميل التقرير. تحقق من السيرفر.");
    }
  }

  renderTable(rows) {
    this.dom.tableBody.innerHTML = "";
    let html = "";
    rows.forEach((r, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td>${r.store_name}</td>
          <td>${r.total_purchases.toFixed(2)}</td>
          <td>${r.total_sales.toFixed(2)}</td>
          <td>${r.total_expenses.toFixed(2)}</td>
        </tr>
      `;
    });
    this.dom.tableBody.innerHTML = html;
  }

  renderChart(rows) {
    // تجهيز البيانات للمخطط
    const labels = rows.map(r => r.store_name);
    const purchasesData = rows.map(r => r.total_purchases);
    const salesData = rows.map(r => r.total_sales);
    const expensesData = rows.map(r => r.total_expenses);

    // إذا كان هناك مخطط سابق، احذفه قبل الرسم
    if (this.chartInstance) this.chartInstance.destroy();

    this.chartInstance = new Chart(this.dom.chartCanvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'المشتريات', data: purchasesData, backgroundColor: 'rgba(54, 162, 235, 0.7)' },
          { label: 'المبيعات', data: salesData, backgroundColor: 'rgba(75, 192, 192, 0.7)' },
          { label: 'المصاريف', data: expensesData, backgroundColor: 'rgba(255, 99, 132, 0.7)' },
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'تحليل المشتريات – المبيعات – المصاريف لكل متجر' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  exportExcel() {
    const table = document.getElementById("reportTable");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });
    XLSX.writeFile(wb, `Stores_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  exportPDF() {
    const table = document.getElementById("reportTable");
    const doc = new jsPDF();
    doc.autoTable({ html: table });
    doc.save(`Stores_Report_${new Date().toISOString().slice(0,10)}.pdf`);
  }
}

// ======================== 🏁 تهيئة التقرير عند فتح الصفحة ========================
document.addEventListener("DOMContentLoaded", () => {
  new AllStoresReport();
});
