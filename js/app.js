// --- Initial Setup & Auth Guard ---
let currentUser = null;
let currentModule = 'Fund';
let rawData = [];
let charts = { main: null, incPie: null, expPie: null }; // เก็บ Instance ของกราฟ

document.addEventListener('DOMContentLoaded', () => {
    // 1. ตรวจสอบว่าได้ Login มาหรือยัง
    const sessionData = sessionStorage.getItem('user');
    if (!sessionData) {
        window.location.href = 'index.html'; // ถ้ายังไม่ Login เด้งกลับไปหน้าแรก
        return;
    }
    currentUser = JSON.parse(sessionData);
    document.getElementById('userDisplay').innerText = `ผู้ใช้งาน: ${currentUser.username}\nสิทธิ์: ${currentUser.role}`;

    // 2. ตรวจสอบว่า API_URL ถูกตั้งค่ามาจาก config.js หรือยัง
    if (typeof API_URL === 'undefined' || API_URL === 'YOUR_WEB_APP_URL_HERE' || API_URL === '') {
        Swal.fire('ข้อผิดพลาดของระบบ', 'ยังไม่ได้ระบุ API_URL ในไฟล์ config.js', 'error');
        return;
    }

    // เริ่มต้นแอปด้วยโมดูล Fund
    switchModule('Fund');
});

// --- Navigation & Role Logic ---
function switchModule(mod) {
    currentModule = mod;
    
    // อัปเดต UI เมนูด้านซ้าย
    const navButtons = ['Fund', 'Cafe', 'Shop'];
    navButtons.forEach(btn => {
        const el = document.getElementById(`nav-${btn}`);
        el.className = (btn === mod) 
            ? "w-full flex items-center p-3 rounded-lg bg-blue-600 text-white transition shadow" 
            : "w-full flex items-center p-3 rounded-lg hover:bg-slate-700 text-white transition";
    });
    
    // อัปเดตหัวข้อ
    const titles = { Fund: 'บัญชีกองทุนเพื่อผู้ป่วยจิตเวชยากไร้', Cafe: 'ร้านกาแฟสุขใจ', Shop: 'ร้านผลิตภัณฑ์ผู้ป่วย' };
    document.getElementById('moduleTitle').innerText = titles[mod];
    document.getElementById('mobileTitle').innerText = (mod==='Fund') ? 'บัญชีกองทุนฯ' : titles[mod];

    // ตรวจสอบสิทธิ์ว่ามีปุ่ม "เพิ่มข้อมูล" ไหม
    checkPermissions();
    
    // โหลดข้อมูลจาก Database
    fetchData();
}

function checkPermissions() {
    const btn = document.getElementById('btnAdd');
    if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// --- Fetch & Render Data ---
async function fetchData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '<tr><td colspan="6" class="p-8 text-center"><i class="fa-solid fa-spinner fa-spin text-blue-500 text-3xl mb-2"></i><br>กำลังดึงข้อมูลจากฐานข้อมูล...</td></tr>';
    
    try {
        const response = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'get_data', payload: { module: currentModule } }) 
        });
        const res = await response.json();
        
        if (res.status === 'success') { 
            rawData = res.data; 
            processAndRenderData(); 
        } else {
            tb.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">หลังบ้านแจ้งเตือน: ${res.message}</td></tr>`;
            Swal.fire('ข้อผิดพลาดจากฐานข้อมูล', res.message, 'error');
        }
    } catch (err) { 
        tb.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">การเชื่อมต่อขัดข้อง หรือ URL API ไม่ถูกต้อง</td></tr>`;
        console.error("Fetch Error:", err);
    }
}

function processAndRenderData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '';
    
    let totalSales = 0, totalExp = 0, totalFund = 0, initBroughtForward = 0;
    let minDate = new Date('2099-12-31');
    
    // สำหรับกราฟ
    let chartMonthly = {}; 
    let incPieData = {}; 
    let expPieData = {};

    if (rawData.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">ยังไม่มีรายการบัญชีในระบบ</td></tr>';
        updateCards(0, 0, 0);
        renderCharts({}, {}, {});
        return;
    }

    // วนลูปข้อมูลสร้างตารางและจัดกลุ่มตัวเลข
    rawData.forEach(r => {
        let amount = Number(r.amount) || 0;
        let d = new Date(r.date);
        let sortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

        if(!chartMonthly[sortKey]) chartMonthly[sortKey] = { label: `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, inc: 0, exp: 0 };

        if (r.type === 'รายรับ') {
            if (r.item === 'ขายสินค้า') { 
                totalSales += amount; 
                chartMonthly[sortKey].inc += amount;
                incPieData[r.item + ' (' + r.method + ')'] = (incPieData[r.item + ' (' + r.method + ')'] || 0) + amount;
            }
            else if (r.item === 'ถอนเงินกองทุน') { 
                totalFund += amount; 
                chartMonthly[sortKey].inc += amount; 
                incPieData[r.item] = (incPieData[r.item] || 0) + amount;
            }
            else if (r.item === 'ยอดยกมา') {
                if (d < minDate) { minDate = d; initBroughtForward = amount; }
            }
        } else if (r.type === 'รายจ่าย') {
            totalExp += amount;
            chartMonthly[sortKey].exp += amount;
            expPieData[r.item] = (expPieData[r.item] || 0) + amount;
        }

        // สร้าง HTML ตาราง
        let eviHtml = r.evidence && r.evidence !== "undefined" ? `<a href="${r.evidence}" target="_blank" class="text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs"><i class="fa-solid fa-file-invoice"></i> ดูหลักฐาน</a>` : '<span class="text-slate-300">-</span>';
        
        let actionHtml = '<span class="text-slate-300 text-xs">ไม่มีสิทธิ์</span>';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            // ป้องกันปัญหาการพ่น JSON ใส่ HTML ตรงๆ ด้วยการส่งแค่ ID แล้วค่อยหาใน Array ตอนกด
            actionHtml = `
                <button onclick="triggerEdit('${r.id}')" class="text-amber-500 hover:text-amber-700 mx-1"><i class="fa-solid fa-edit"></i></button>
                <button onclick="deleteTx('${r.id}')" class="text-red-500 hover:text-red-700 mx-1"><i class="fa-solid fa-trash"></i></button>
            `;
        }

        tb.innerHTML += `
            <tr class="hover:bg-slate-50 transition border-b">
                <td class="p-3 whitespace-nowrap">${r.date}</td>
                <td class="p-3"><span class="px-2 py-1 text-xs rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'} font-medium">${r.type}</span></td>
                <td class="p-3">${r.item} <span class="text-xs text-slate-400 block">${r.note||''}</span></td>
                <td class="p-3 text-right font-medium">฿${amount.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                <td class="p-3 text-center">${eviHtml}</td>
                <td class="p-3 text-center">${actionHtml}</td>
            </tr>`;
    });

    // อัปเดตการ์ด
    let profit = totalSales - totalExp;
    let cashOnHand = (totalSales + totalFund + initBroughtForward) - totalExp;
    updateCards(totalSales, totalExp, profit, cashOnHand);
    
    // วาดกราฟ
    renderCharts(chartMonthly, incPieData, expPieData);
}

function updateCards(inc, exp, profit, cash) {
    document.getElementById('c_income').innerText = `฿${inc.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
    document.getElementById('c_expense').innerText = `฿${exp.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
    document.getElementById('c_profit').innerText = `฿${profit.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
    document.getElementById('c_profit').className = profit >= 0 ? "text-2xl font-bold text-blue-600" : "text-2xl font-bold text-red-600";
    document.getElementById('c_cash').innerText = `฿${(cash || 0).toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
}

// --- Chart.js ---
function renderCharts(monthly, incPie, expPie) {
    const keys = Object.keys(monthly).sort();
    const labels = keys.map(k => monthly[k].label);
    const incData = keys.map(k => monthly[k].inc);
    const expData = keys.map(k => monthly[k].exp);
    const profData = keys.map(k => monthly[k].inc - monthly[k].exp);

    // Main Chart (Bar + Line)
    if(charts.main) charts.main.destroy();
    charts.main = new Chart(document.getElementById('mainChart').getContext('2d'), {
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'กำไร (ยอดขาย-รายจ่าย)', data: profData, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3, borderWidth: 3 },
                { type: 'bar', label: 'รายรับ (รวมกองทุน)', data: incData, backgroundColor: '#22c55e' },
                { type: 'bar', label: 'รายจ่าย', data: expData, backgroundColor: '#ef4444' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Pie Charts
    const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } } } };
    
    if(charts.incPie) charts.incPie.destroy();
    charts.incPie = new Chart(document.getElementById('incPieChart').getContext('2d'), { type: 'doughnut', data: { labels: Object.keys(incPie), datasets: [{ data: Object.values(incPie), backgroundColor: ['#22c55e', '#10b981', '#f59e0b', '#3b82f6'] }] }, options: pieOptions });
    
    if(charts.expPie) charts.expPie.destroy();
    charts.expPie = new Chart(document.getElementById('expPieChart').getContext('2d'), { type: 'doughnut', data: { labels: Object.keys(expPie), datasets: [{ data: Object.values(expPie), backgroundColor: ['#ef4444', '#f97316', '#8b5cf6', '#ec4899'] }] }, options: pieOptions });
}

// --- Forms & Actions ---
function toggleEvi() {
    if(document.getElementById('f_eviType').value === 'file') {
        document.getElementById('f_file').classList.remove('hidden'); document.getElementById('f_link').classList.add('hidden');
    } else {
        document.getElementById('f_file').classList.add('hidden'); document.getElementById('f_link').classList.remove('hidden');
    }
}

function getBase64(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => res(reader.result.replace(/^data:(.*,)?/, ''));
        reader.onerror = e => rej(e);
    });
}

async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); btn.innerText = 'กำลังอัปโหลดและบันทึก...'; btn.disabled = true;

    let payload = {
        module: currentModule, username: currentUser.username, rowIndex: document.getElementById('f_id').value,
        date: document.getElementById('f_date').value, type: document.getElementById('f_type').value,
        item: document.getElementById('f_item').value, method: document.getElementById('f_method').value,
        amount: document.getElementById('f_amount').value, note: document.getElementById('f_note').value
    };

    if(document.getElementById('f_eviType').value === 'file') {
        const f = document.getElementById('f_file').files[0];
        if(f) {
            if(f.size > 5242880) { Swal.fire('ไฟล์ใหญ่เกินไป', 'กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 5MB', 'warning'); btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; return; }
            payload.fileBase64 = await getBase64(f); payload.fileName = f.name; payload.fileMimeType = f.type;
        }
    } else {
        payload.evidenceLink = document.getElementById('f_link').value;
    }

    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'save_tx', payload }) })).json();
        if (res.status === 'success') { Swal.fire('สำเร็จ', res.message, 'success'); closeModal(); fetchData(); }
        else Swal.fire('ผิดพลาด', res.message, 'error');
    } catch (err) { Swal.fire('Error', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); }
    finally { btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; }
}

function triggerEdit(id) {
    const r = rawData.find(row => row.id === id);
    if(!r) return;
    document.getElementById('modalTitle').innerText = 'แก้ไขรายการ';
    document.getElementById('f_id').value = r.id; 
    document.getElementById('f_date').value = r.date;
    document.getElementById('f_type').value = r.type; 
    document.getElementById('f_item').value = r.item;
    document.getElementById('f_method').value = r.method; 
    document.getElementById('f_amount').value = r.amount;
    document.getElementById('f_note').value = r.note; 
    openModal();
}

function deleteTx(id) {
    Swal.fire({ title: 'ยืนยันการลบ?', text: 'ข้อมูลนี้จะถูกลบออกจากฐานข้อมูลถาวร', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ลบเลย' })
    .then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            try {
                const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) })).json();
                if(res.status === 'success') { Swal.fire('ลบสำเร็จ', '', 'success'); fetchData(); }
                else Swal.fire('ผิดพลาด', res.message, 'error');
            } catch(err) { Swal.fire('Error', 'ไม่สามารถลบได้', 'error'); }
        }
    });
}

function openModal() { document.getElementById('txModal').classList.remove('hidden'); }
function closeModal() { 
    document.getElementById('txModal').classList.add('hidden'); 
    document.getElementById('txForm').reset(); 
    document.getElementById('f_id').value = ''; 
    document.getElementById('modalTitle').innerText = 'บันทึกรายการ'; 
}
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }
