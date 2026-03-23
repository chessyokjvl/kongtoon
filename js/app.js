let currentUser = null;
let currentModule = 'Overview'; // เริ่มต้นที่หน้า Overview
let rawData = [];

document.addEventListener('DOMContentLoaded', () => {
    const sessionStr = sessionStorage.getItem('user');
    if (!sessionStr) { window.location.href = 'index.html'; return; }
    
    currentUser = JSON.parse(sessionStr);
    document.getElementById('userDisplay').innerHTML = `<b>${currentUser.username}</b><br>สิทธิ์: ${currentUser.role}`;

    if (typeof API_URL === 'undefined' || !API_URL.startsWith('http')) {
        Swal.fire('Error', 'ไม่พบ API_URL กรุณาตรวจสอบ js/config.js', 'error'); return;
    }
    switchModule('Overview');
});

function openMenu() { document.getElementById('mobileMenu').classList.remove('hidden'); }
function closeMenu() { document.getElementById('mobileMenu').classList.add('hidden'); }

function switchModule(mod) {
    currentModule = mod;
    ['Overview', 'Fund', 'Cafe', 'Shop'].forEach(btn => {
        const el = document.getElementById(`nav-${btn}`);
        if(el) el.className = (btn === mod) ? "w-full flex items-center p-3 rounded-lg bg-blue-600 transition shadow text-white" : "w-full flex items-center p-3 rounded-lg hover:bg-slate-700 transition text-white";
    });
    
    const titles = { Overview: 'ภาพรวมระบบ (Overview)', Fund: 'บัญชีกองทุนฯ', Cafe: 'ร้านกาแฟสุขใจ', Shop: 'ร้านผลิตภัณฑ์ฯ' };
    document.getElementById('moduleTitle').innerText = titles[mod];
    document.getElementById('mobileTitle').innerText = titles[mod];

    if (mod === 'Overview') {
        document.getElementById('viewOverview').classList.remove('hidden');
        document.getElementById('viewModule').classList.add('hidden');
        document.getElementById('btnAdd').classList.add('hidden');
        fetchOverview();
    } else {
        document.getElementById('viewOverview').classList.add('hidden');
        document.getElementById('viewModule').classList.remove('hidden');
        const btn = document.getElementById('btnAdd');
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${mod}`) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
        
        fetchData();
    }
}

// --- Dynamic Dropdowns ---
function updateItemOptions() {
    const type = document.getElementById('f_type').value;
    const itemEl = document.getElementById('f_item');
    itemEl.innerHTML = '';
    
    let opts = [];
    if (currentModule === 'Fund') {
        if (type === 'รายรับ') opts = ['ยอดยกมา', 'เงินโอน (ปรับสมุด)', 'เงินสด', 'อื่นๆ'];
        else opts = ['ถอนเงิน', 'อื่นๆ'];
    } else { // Cafe & Shop
        if (type === 'รายรับ') opts = ['ยอดยกมา', 'ยอดขาย', 'เบิกเงินกองทุน', 'อื่นๆ'];
        else opts = ['เงินเดือน', 'ซื้อของ', 'คืนเงินกองทุน', 'อื่นๆ'];
    }
    
    opts.forEach(o => itemEl.add(new Option(o, o)));
    toggleFundExpenseDetails();
}

function toggleFundExpenseDetails() {
    const type = document.getElementById('f_type').value;
    const panel = document.getElementById('fundExpenseDetails');
    // โชว์ฟิลด์เสริมเฉพาะ บัญชีกองทุน -> รายจ่าย (ถอนเงิน/อื่นๆ)
    if (currentModule === 'Fund' && type === 'รายจ่าย') {
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
        document.getElementById('f_subItem').value = '';
        document.getElementById('f_department').value = '';
    }
}

// --- Fetch Logic ---
async function fetchOverview() {
    Swal.showLoading();
    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_overview' }) })).json();
        Swal.close();
        if(res.status === 'success') {
            document.getElementById('ov_fund').innerText = '฿' + (res.data.fund||0).toLocaleString('th-TH',{minimumFractionDigits:2});
            document.getElementById('ov_cafe').innerText = '฿' + (res.data.cafe||0).toLocaleString('th-TH',{minimumFractionDigits:2});
            document.getElementById('ov_shop').innerText = '฿' + (res.data.shop||0).toLocaleString('th-TH',{minimumFractionDigits:2});
        }
    } catch (e) { Swal.fire('Error', 'โหลดภาพรวมไม่สำเร็จ', 'error'); }
}

async function fetchData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '<tr><td colspan="6" class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i><br>กำลังดึงข้อมูล...</td></tr>';
    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_data', payload: { module: currentModule } }) })).json();
        if (res.status === 'success') { rawData = res.data; renderData(); }
    } catch (err) { tb.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">การเชื่อมต่อขัดข้อง</td></tr>`; }
}

function renderData() {
    const tb = document.getElementById('tableBody'); tb.innerHTML = '';
    
    let opInc = 0, opExp = 0; // รายรับ-รายจ่าย ดำเนินงาน (ยอดขาย, เงินโอนปกติ / ต้นทุน, เงินเดือน)
    let nonOpInc = 0, nonOpExp = 0; // รับ-จ่าย อื่นๆ (ยอดยกมา, เบิกเงิน, คืนเงิน)

    if (rawData.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">ยังไม่มีรายการบัญชี</td></tr>';
        updateCards(0, 0, 0, 0); return;
    }

    rawData.forEach(r => {
        let amt = Number(r.amount) || 0;
        
        // --- การคัดแยก ผลประกอบการ (Performance) vs กระแสเงินสด ---
        if (r.type === 'รายรับ') {
            if (['ยอดยกมา', 'เบิกเงินกองทุน'].includes(r.item)) nonOpInc += amt;
            else opInc += amt; // ยอดขาย, เงินโอน, เงินสด, อื่นๆ ถือเป็น Operating Income
        } else if (r.type === 'รายจ่าย') {
            if (['คืนเงินกองทุน', 'ถอนเงิน'].includes(r.item)) nonOpExp += amt;
            else opExp += amt; // ซื้อของ, เงินเดือน, อื่นๆ ถือเป็น Operating Expense
        }

        let act = '<span class="text-slate-300 text-xs">Read-Only</span>';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            act = `<button onclick="editTx('${r.id}')" class="text-amber-500 mx-1"><i class="fa-solid fa-edit"></i></button>
                   <button onclick="delTx('${r.id}')" class="text-red-500 mx-1"><i class="fa-solid fa-trash"></i></button>`;
        }
        let evi = (r.evidence && r.evidence.length > 5) ? `<a href="${r.evidence}" target="_blank" class="text-blue-600 hover:underline"><i class="fa-solid fa-file"></i></a>` : '-';
        
        // แสดงรายละเอียดกองทุน (ถ้ามี)
        let noteHtml = r.note;
        if(currentModule === 'Fund' && r.subItem) {
            noteHtml = `<span class="text-blue-600 font-semibold">[${r.subItem}]</span> ${r.department ? 'หน่วย: '+r.department : ''} <br> ${r.note}`;
        }

        tb.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-4">${r.date}</td>
                <td class="p-4"><span class="px-2 py-1 text-xs rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
                <td class="p-4"><span class="font-medium">${r.item}</span> <br><span class="text-xs text-slate-500">${noteHtml}</span></td>
                <td class="p-4 text-right font-medium">฿${amt.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                <td class="p-4 text-center">${evi}</td>
                <td class="p-4 text-center">${act}</td>
            </tr>`;
    });

    let profit = opInc - opExp; // กำไรจากผลประกอบการจริง
    let cashOnHand = (opInc + nonOpInc) - (opExp + nonOpExp); // กระแสเงินสดรวมทั้งหมด
    
    // เปลี่ยนข้อความบนการ์ดให้ตรงบริบท
    document.getElementById('lbl_inc').innerText = currentModule === 'Fund' ? 'รายรับรวม (เงินโอน/เงินสด)' : 'รายได้ดำเนินงาน (ยอดขาย)';
    updateCards(opInc, opExp, profit, cashOnHand);
}

function updateCards(inc, exp, pro, cash) {
    const f = n => '฿' + (n||0).toLocaleString('th-TH', {minimumFractionDigits:2});
    document.getElementById('c_income').innerText = f(inc);
    document.getElementById('c_expense').innerText = f(exp);
    document.getElementById('c_profit').innerText = f(pro);
    document.getElementById('c_profit').className = pro >= 0 ? "text-lg md:text-2xl font-bold text-blue-600 mt-1" : "text-lg md:text-2xl font-bold text-red-600 mt-1";
    document.getElementById('c_cash').innerText = f(cash);
}

// --- CRUD ---
function toggleEvi() { document.getElementById('f_file').classList.toggle('hidden', document.getElementById('f_eviType').value !== 'file'); document.getElementById('f_link').classList.toggle('hidden', document.getElementById('f_eviType').value === 'file'); }
function getBase64(f) { return new Promise((res,rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = ()=>res(r.result.replace(/^data:(.*,)?/,'')); r.onerror=rej; }); }

async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); btn.innerText = 'กำลังบันทึก...'; btn.disabled = true;

    let pay = {
        module: currentModule, username: currentUser.username, rowIndex: document.getElementById('f_id').value,
        date: document.getElementById('f_date').value, type: document.getElementById('f_type').value,
        item: document.getElementById('f_item').value, method: document.getElementById('f_method').value,
        amount: document.getElementById('f_amount').value, note: document.getElementById('f_note').value,
        subItem: document.getElementById('f_subItem').value, department: document.getElementById('f_department').value
    };

    if(document.getElementById('f_eviType').value === 'file') {
        const f = document.getElementById('f_file').files[0];
        if(f) {
            if(f.size > 5242880) { Swal.fire('Error', 'ไฟล์เกิน 5MB', 'warning'); btn.innerText='บันทึกข้อมูล'; btn.disabled=false; return; }
            pay.fileBase64 = await getBase64(f); pay.fileName = f.name; pay.fileMimeType = f.type;
        }
    } else pay.evidenceLink = document.getElementById('f_link').value;

    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action:'save_tx', payload:pay }) })).json();
        if(res.status==='success') { Swal.fire('สำเร็จ', res.message, 'success'); closeModal(); fetchData(); }
        else Swal.fire('Error', res.message, 'error');
    } catch(err) { Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error'); }
    finally { btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; }
}

function editTx(id) {
    const r = rawData.find(x => x.id === id); if(!r) return;
    document.getElementById('modalTitle').innerText = 'แก้ไขรายการ';
    document.getElementById('f_id').value = r.id; document.getElementById('f_date').value = r.date;
    document.getElementById('f_type').value = r.type; updateItemOptions(); document.getElementById('f_item').value = r.item;
    document.getElementById('f_method').value = r.method; document.getElementById('f_amount').value = r.amount;
    document.getElementById('f_note').value = r.note; 
    document.getElementById('f_subItem').value = r.subItem || '';
    document.getElementById('f_department').value = r.department || '';
    toggleFundExpenseDetails();
    openModal();
}

function delTx(id) {
    Swal.fire({title:'ลบรายการ?', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'ลบเลย'}).then(async (res) => {
        if(res.isConfirmed) {
            Swal.showLoading();
            const r = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) })).json();
            if(r.status==='success') { Swal.fire('ลบแล้ว','','success'); fetchData(); } else Swal.fire('Error', r.message, 'error');
        }
    });
}

function openModal() { document.getElementById('txModal').classList.remove('hidden'); updateItemOptions(); }
function closeModal() { document.getElementById('txModal').classList.add('hidden'); document.getElementById('txForm').reset(); document.getElementById('f_id').value=''; }
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }
