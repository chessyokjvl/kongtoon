// js/auth.js

// Check Session: ถ้า Login แล้วให้เด้งไปหน้า Dashboard เลย
if (sessionStorage.getItem('user')) {
    window.location.href = 'dashboard.html';
}

// สลับหน้าฟอร์ม Login / Register / Forgot Password
function toggleForm(showId) {
    ['loginForm', 'regForm', 'forgotForm'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(showId).classList.remove('hidden');
}

// ฟังก์ชันยืนยันตัวตน
async function doAuth(e, action) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const ogText = btn.innerText; 
    btn.innerText = 'กำลังประมวลผล...'; 
    btn.disabled = true;

    let payload = {};
    if (action === 'login') {
        payload = { username: l_user.value, password: l_pass.value };
    } else if (action === 'register') {
        payload = { username: r_user.value, email: r_email.value, password: r_pass.value, pdpa: r_pdpa.checked };
    } else if (action === 'forgot_password') {
        payload = { email: f_email.value };
    }

    try {
        // เรียกใช้ CONFIG.API_URL จากไฟล์ config.js
        const res = await (await fetch(CONFIG.API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action, payload }) 
        })).json();

        if (res.status === 'success') {
            if (action === 'login') {
                sessionStorage.setItem('user', JSON.stringify(res.user));
                window.location.href = 'dashboard.html';
            } else {
                Swal.fire('สำเร็จ', res.message, 'success'); 
                toggleForm('loginForm'); 
                e.target.reset();
            }
        } else {
            Swal.fire('ข้อผิดพลาด', res.message, 'error');
        }
    } catch (err) { 
        Swal.fire('Error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); 
        console.error(err);
    } finally { 
        btn.innerText = ogText; 
        btn.disabled = false; 
    }
}
