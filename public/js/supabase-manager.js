// في صفحة الدخول - استبدال الدوال القديمة
async function fetchUserInfo() {
    const userId = document.getElementById("user_id").value;
    if (!userId) return;

    try {
        let data;
        if (window.envSetup) {
            // استخدام النظام الجديد
            data = await window.envSetup.executeQuery('/api/users/get_user_info', {
                method: "POST",
                body: JSON.stringify({ user_id: userId })
            });
        } else {
            // النظام القديم
            const response = await fetch("http://localhost:3000/api/users/get_user_info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId })
            });
            data = await response.json();
        }

        document.getElementById("username").value = data.username || "";
        document.getElementById("store_name").value = data.store_name || "";
        
        if (data.store_id) {
            localStorage.setItem("temp_store_id", data.store_id);
        }
    } catch (error) {
        console.error(error);
        alert("حدث خطأ أثناء جلب بيانات المستخدم");
    }
}