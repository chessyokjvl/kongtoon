// --- Global State ---
let currentUser = null;
let currentModule = 'Fund';
let rawData = [];
let charts = { main: null, incPie: null, expPie: null };

document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    const sessionStr = sessionStorage.getItem('user');
    if (!sessionStr) { window.location.href = 'index.html'; return; }
    
    currentUser = JSON.parse(sessionStr);
    document.getElementById('userDisplay').innerHTML = `<b>${currentUser.username}</b><br>สิทธิ์: ${currentUser.role}`;

    if (typeof API_URL === 'undefined' || !API_URL.startsWith('http')) {
        Swal.fire('ข้อผิดพลาดรุนแรง', 'หา API_URL ไม่พบ กรุณาตรวจสอบไฟล์ js/config.js', 'error');
        return;
    }

    switchModule('Fund');
});

// --- UI Controls ---
function openMenu() { document.getElementById('mobileMenu').classList.remove('hidden'); }
function closeMenu() { document.getElementById('mobileMenu').classList.add('hidden'); }

function switchModule(mod) {
    currentModule = mod;
    
    // อัปเดตเมนูด้านซ้าย
    ['Fund', 'Cafe', 'Shop'].forEach(btn => {
        const el = document.getElementById(`nav-${btn}`);
        if(el) el.className = (btn === mod) ? "w-full flex items-center p-3 rounded-lg bg-blue-600 transition shadow" : "w-full flex items-center p-3 rounded-lg hover:bg-slate-700 transition";
    });
    
    const titles = { Fund: 'บัญชีกองทุนเพื่อผู้ป่วยจิตเวชยากไร้', Cafe: 'ร้านกาแฟสุขใจ', Shop: 'ร้านผลิตภัณฑ์ผู้ป่วย' };
    document.getElementById('moduleTitle').innerText = titles[mod];
    document.getElementById('mobileTitle').innerText = titles[mod];

    // จัดการสิทธิ์ปุ่ม Add
    const btn = document.getElementById('btnAdd');
    if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${mod}`) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
    
    fetchData();
}

function updateItemOptions() {
    const type = document.getElementById('f_type').value;
    const itemEl = document.getElementById('f_item');
    itemEl.innerHTML = '';
    
    const opts = (type === 'รายรับ') 
        ? ['ขายสินค้า', 'ถอนเงินกองทุน', 'ยอดยกมา'] 
        : ['ซื้อของเข้าร้าน', 'เงินเดือน', 'ค่าใช้จ่ายอื่นๆ'];
        
    opts.forEach(o => itemEl.add(new Option(o, o)));
}

// --- Data Fetching & Rendering ---
async function fetchData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '<tr><td colspan="6" class="p-10 text-center"><i class="fa-solid fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i><br><span class="text-slate-500">กำลังดึงข้อมูลจากฐานข้อมูล...</span></td></tr>';
    
    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_data', payload: { module: currentModule } }) })).json();
        
        if (res.status === 'success') { 
            rawData = res.data; 
            renderData(); 
        } else {
            tb.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">Error: ${res.message}</td></tr>`;
        }
    } catch (err) { 
        tb.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500">การเชื่อมต่อขัดข้อง: ${err.message}</td></tr>`;
    }
}

function renderData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '';
    
    let sumInc = 0, sumExp = 0, sumFund = 0, initBF = 0;
    let minDate = new Date('2099-01-01');
    let cMonth = {}, pInc = {}, pExp = {};

    if (rawData.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">ยังไม่มีรายการบัญชีในระบบ</td></tr>';
        updateCards(0, 0, 0, 0); renderCharts(cMonth, pInc, pExp); return;
    }

    rawData.forEach(r => {
        let amt = Number(r.amount) || 0;
        let d = new Date(r.date);
        let sKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

        if(!cMonth[sKey]) cMonth[sKey] = { label: `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, inc: 0, exp: 0 };

        if (r.type === 'รายรับ') {
            if (r.item.includes('ขายสินค้า')) { 
                sumInc += amt; cMonth[sKey].inc += amt;
                let k = r.item + (r.method!=='-'?` (${r.method})`:''); pInc[k] = (pInc[k]||0) + amt;
            }
            else if (r.item.includes('กองทุน')) { 
                sumFund += amt; cMonth[sKey].inc += amt; pInc[r.item] = (pInc[r.item]||0) + amt;
            }
            else if (r.item === 'ยอดยกมา' && d < minDate) { minDate = d; initBF = amt; }
        } else if (r.type === 'รายจ่าย') {
            sumExp += amt; cMonth[sKey].exp += amt; pExp[r.item] = (pExp[r.item]||0) + amt;
        }

        // Action Buttons
        let act = '<span class="text-slate-300 text-xs">Read-Only</span>';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            act = `<button onclick="editTx('${r.id}')" class="text-amber-500 hover:text-amber-700 mx-1 p-1"><i class="fa-solid fa-edit"></i></button>
                   <button onclick="delTx('${r.id}')" class="text-red-500 hover:text-red-700 mx-1 p-1"><i class="fa-solid fa-trash"></i></button>`;
        }

        let evi = (r.evidence && r.evidence.length > 5) ? `<a href="${r.evidence}" target="_blank" class="text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-md text-xs whitespace-nowrap"><i class="fa-solid fa-paperclip"></i> ดูเอกสาร</a>` : '-';

        tb.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="p-4">${r.date}</td>
                <td class="p-4"><span class="px-2 py-1 text-xs rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
                <td class="p-4"><span class="font-medium">${r.item}</span> <br><span class="text-xs text-slate-500">${r.note}</span></td>
                <td class="p-4 text-right font-medium">฿${amt.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                <td class="p-4 text-center">${evi}</td>
                <td class="p-4 text-center">${act}</td>
            </tr>`;
    });

    let profit = sumInc - sumExp;
    let cash = (sumInc + sumFund + initBF) - sumExp;
    updateCards(sumInc, sumExp, profit, cash);
    renderCharts(cMonth, pInc, pExp);
}

function updateCards(inc, exp, pro, cash) {
    const f = n => '฿' + (n||0).toLocaleString('th-TH', {minimumFractionDigits:2});
    document.getElementById('c_income').innerText = f(inc);
    document.getElementById('c_expense').innerText = f(exp);
    document.getElementById('c_profit').innerText = f(pro);
    document.getElementById('c_profit').className = pro >= 0 ? "text-lg md:text-2xl font-bold text-blue-600 mt-1" : "text-lg md:text-2xl font-bold text-red-600 mt-1";
    document.getElementById('c_cash').innerText = f(cash);
}

// --- Charts ---
function renderCharts(m, pI, pE) {
    const k = Object.keys(m).sort();
    
    if(charts.main) charts.main.destroy();
    charts.main = new Chart(document.getElementById('mainChart').getContext('2d'), {
        data: {
            labels: k.map(x=>m[x].label),
            datasets: [
                { type: 'line', label: 'กำไรสุทธิ', data: k.map(x=>m[x].inc-m[x].exp), borderColor: '#3b82f6', backgroundColor: '#3b82f6', borderWidth: 3 },
                { type: 'bar', label: 'รายรับ', data: k.map(x=>m[x].inc), backgroundColor: '#22c55e' },
                { type: 'bar', label: 'รายจ่าย', data: k.map(x=>m[x].exp), backgroundColor: '#ef4444' }
            ]
        }, options: { responsive: true, maintainAspectRatio: false }
    });

    const opt = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels:{boxWidth:10, font:{size:11}} } } };
    if(charts.incPie) charts.incPie.destroy();
    charts.incPie = new Chart(document.getElementById('incPieChart').getContext('2d'), { type:'doughnut', data:{labels:Object.keys(pI), datasets:[{data:Object.values(pI), backgroundColor:['#22c55e','#10b981','#eab308']}]}, options:opt});
    if(charts.expPie) charts.expPie.destroy();
    charts.expPie = new Chart(document.getElementById('expPieChart').getContext('2d'), { type:'doughnut', data:{labels:Object.keys(pE), datasets:[{data:Object.values(pE), backgroundColor:['#ef4444','#f97316','#8b5cf6']}]}, options:opt});
}

// --- CRUD Operations ---
function toggleEvi() {
    const isFile = document.getElementById('f_eviType').value === 'file';
    document.getElementById('f_file').classList.toggle('hidden', !isFile);
    document.getElementById('f_link').classList.toggle('hidden', isFile);
}

async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); btn.innerText = 'กำลังบันทึก...'; btn.disabled = true;

    let pay = {
        module: currentModule, username: currentUser.username, rowIndex: document.getElementById('f_id').value,
        date: document.getElementById('f_date').value, type: document.getElementById('f_type').value,
        item: document.getElementById('f_item').value, method: document.getElementById('f_method').value,
        amount: document.getElementById('f_amount').value, note: document.getElementById('f_note').value
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
    } catch(err) { Swal.fire('Error', 'เชื่อมต่อไม่สำเร็จ', 'error'); }
    finally { btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; }
}

function getBase64(f) { return new Promise((res,rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = ()=>res(r.result.replace(/^data:(.*,)?/,'')); r.onerror=rej; }); }

function editTx(id) {
    const r = rawData.find(x => x.id === id); if(!r) return;
    document.getElementById('modalTitle').innerText = 'แก้ไขรายการ';
    document.getElementById('f_id').value = r.id; document.getElementById('f_date').value = r.date;
    document.getElementById('f_type').value = r.type; updateItemOptions(); document.getElementById('f_item').value = r.item;
    document.getElementById('f_method').value = r.method; document.getElementById('f_amount').value = r.amount;
    document.getElementById('f_note').value = r.note; openModal();
}

function delTx(id) {
    Swal.fire({title:'ลบรายการ?', icon:'warning', showCancelButton:true, confirmButtonColor:'#d33', confirmButtonText:'ลบเลย'}).then(async (res) => {
        if(res.isConfirmed) {
            Swal.showLoading();
            try {
                const r = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) })).json();
                if(r.status==='success') { Swal.fire('ลบแล้ว','','success'); fetchData(); } else Swal.fire('Error', r.message, 'error');
            } catch(e) { Swal.fire('Error','ลบไม่สำเร็จ','error'); }
        }
    });
}

function openModal() { document.getElementById('txModal').classList.remove('hidden'); updateItemOptions(); }
function closeModal() { document.getElementById('txModal').classList.add('hidden'); document.getElementById('txForm').reset(); document.getElementById('f_id').value=''; }
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }
