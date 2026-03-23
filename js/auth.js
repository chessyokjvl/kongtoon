// ถ้ามี Session อยู่แล้ว ให้ข้ามไปหน้า Dashboard เลย
if (sessionStorage.getItem('user')) { 
    window.location.href = 'dashboard.html'; 
}

// ฟังก์ชันสลับหน้าฟอร์ม (เปลี่ยนมาใช้ style.display แบบเด็ดขาด)
function toggleForm(showId) {
    const forms = ['loginForm', 'regForm', 'forgotForm'];
    
    // ซ่อนทุกอันก่อน
    forms.forEach(id => { 
        document.getElementById(id).style.display = 'none'; 
    });
    
    // โชว์เฉพาะอันที่เลือก
    document.getElementById(showId).style.display = 'block';
}

// ฟังก์ชันสำหรับ Guest
function guestLogin() {
    sessionStorage.setItem('user', JSON.stringify({ username: 'Guest', role: 'Guest' }));
    window.location.href = 'dashboard.html';
}

// ฟังก์ชันจัดการ ยืนยันตัวตน/สมัครสมาชิก
async function doAuth(e, action) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const ogText = btn.innerText; 
    btn.innerText = 'กำลังประมวลผล...'; 
    btn.disabled = true;

    let payload = {};
    
    if (action === 'login') {
        payload = { 
            username: document.getElementById('l_user').value, 
            password: document.getElementById('l_pass').value 
        };
    } else if (action === 'register') {
        payload = { 
            username: document.getElementById('r_user').value, 
            email: document.getElementById('r_email').value, 
            password: document.getElementById('r_pass').value, 
            pdpa: document.getElementById('r_pdpa').checked 
        };
    } else if (action === 'forgot_password') {
        payload = { 
            email: document.getElementById('f_email').value 
        };
    }

    try {
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
        Swal.fire('Error', 'ไม่สามารถเชื่อมต่อระบบเซิร์ฟเวอร์ได้', 'error'); 
        console.error(err);
    } finally { 
        btn.innerText = ogText; 
        btn.disabled = false; 
    }
}
