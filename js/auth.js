// เช็ค Session ถ้าเคยล็อกอินแล้ว เด้งไป Dashboard เลย
if(sessionStorage.getItem('user')) window.location.href = 'dashboard.html';

function toggleForm(showId) {
    document.getElementById('loginForm').classList.add('hidden-form');
    document.getElementById('regForm').classList.add('hidden-form');
    document.getElementById('forgotForm').classList.add('hidden-form');
    
    document.getElementById(showId).classList.remove('hidden-form');
}

// ฟังก์ชันเข้าใช้งานแบบ Guest (สร้าง Session จำลอง)
function loginAsGuest() {
    const guestUser = { 
        username: 'บุคคลทั่วไป (Guest)', 
        role: 'Guest', 
        email: '-' 
    };
    sessionStorage.setItem('user', JSON.stringify(guestUser));
    window.location.href = 'dashboard.html';
}

async function doAuth(e, action) {
    e.preventDefault();
    
    if (typeof API_URL === 'undefined' || API_URL === 'ใส่_URL_WEB_APP_ของคุณที่นี่') {
        Swal.fire('ข้อผิดพลาด', 'ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js', 'error');
        return;
    }

    const btn = e.target.querySelector('button');
    const ogText = btn.innerText; 
    btn.innerText = 'กำลังประมวลผล...'; 
    btn.disabled = true;

    let payload = {};
    if(action === 'login') payload = { username: document.getElementById('l_user').value, password: document.getElementById('l_pass').value };
    if(action === 'register') payload = { username: document.getElementById('r_user').value, email: document.getElementById('r_email').value, password: document.getElementById('r_pass').value, pdpa: document.getElementById('r_pdpa').checked };
    if(action === 'forgot_password') payload = { email: document.getElementById('f_email').value };

    try {
        const response = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: action, payload: payload }) 
        });
        const res = await response.json();
        
        if(res.status === 'success') {
            if(action === 'login') {
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
    } catch(err) { 
        Swal.fire('Error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: ' + err.message, 'error'); 
    } finally { 
        btn.innerText = ogText; 
        btn.disabled = false; 
    }
}
