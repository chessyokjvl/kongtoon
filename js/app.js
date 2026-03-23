let currentUser = null;
let currentModule = 'Overview'; 
let rawData = [];
let charts = { main: null, incPie: null, expPie: null };

document.addEventListener('DOMContentLoaded', () => {
    const sessionStr = sessionStorage.getItem('user');
    if (!sessionStr) { window.location.href = 'index.html'; return; }
    
    currentUser = JSON.parse(sessionStr);
    document.getElementById('userDisplay').innerHTML = `<b>${currentUser.username}</b><br>สิทธิ์: ${currentUser.role}`;

    const yr = new Date().getFullYear();
    const ySel = document.getElementById('r_year');
    for(let i = yr-2; i <= yr+2; i++) ySel.options.add(new Option(i+543, i));
    ySel.value = yr; document.getElementById('r_month').value = new Date().getMonth()+1;

    switchModule('Overview');
});

function openMenu() { document.getElementById('mobileMenu').classList.remove('hidden'); }
function closeMenu() { document.getElementById('mobileMenu').classList.add('hidden'); }

function switchModule(mod) {
    currentModule = mod;
    ['Overview', 'Fund', 'Cafe', 'Shop'].forEach(btn => {
        const el = document.getElementById(`nav-${btn}`);
        if(el) el.className = (btn === mod) ? "w-full flex items-center p-3 rounded-lg bg-blue-600 shadow text-white" : "w-full flex items-center p-3 rounded-lg hover:bg-slate-700 text-white";
    });
    
    const titles = { Overview: 'ภาพรวมระบบ', Fund: 'บัญชีกองทุนฯ', Cafe: 'ร้านกาแฟสุขใจ', Shop: 'ร้านผลิตภัณฑ์ฯ' };
    document.getElementById('moduleTitle').innerText = titles[mod];
    document.getElementById('mobileTitle').innerText = titles[mod];

    if(charts.main) { charts.main.destroy(); charts.main = null; }
    if(charts.incPie) { charts.incPie.destroy(); charts.incPie = null; }
    if(charts.expPie) { charts.expPie.destroy(); charts.expPie = null; }

    if (mod === 'Overview') {
        document.getElementById('viewOverview').classList.remove('hidden');
        document.getElementById('viewModule').classList.add('hidden');
        document.getElementById('btnReport').classList.add('hidden');
        document.getElementById('btnAdd').classList.add('hidden');
        fetchOverview();
    } else {
        document.getElementById('viewOverview').classList.add('hidden');
        document.getElementById('viewModule').classList.remove('hidden');
        document.getElementById('btnReport').classList.remove('hidden');
        
        const btnA = document.getElementById('btnAdd');
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${mod}`) btnA.classList.remove('hidden');
        else btnA.classList.add('hidden');
        
        fetchData();
    }
}

async function fetchOverview() {
    document.getElementById('ov_fund').innerText = 'กำลังโหลด...';
    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_overview' }) })).json();
        if(res.status === 'success') {
            document.getElementById('ov_fund').innerText = '฿' + (res.data.fund||0).toLocaleString('th-TH',{minimumFractionDigits:2});
            document.getElementById('ov_cafe').innerText = '฿' + (res.data.cafe||0).toLocaleString('th-TH',{minimumFractionDigits:2});
            document.getElementById('ov_shop').innerText = '฿' + (res.data.shop||0).toLocaleString('th-TH',{minimumFractionDigits:2});
        }
    } catch (e) { console.error(e); }
}

async function fetchData() {
    const tb = document.getElementById('tableBody');
    tb.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-blue-500"><i class="fa-solid fa-spinner fa-spin text-3xl mb-3"></i><br>กำลังดึงข้อมูล...</td></tr>';
    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_data', payload: { module: currentModule } }) })).json();
        if (res.status === 'success') { rawData = res.data; renderData(); }
    } catch (err) { tb.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500">การเชื่อมต่อขัดข้อง</td></tr>`; }
}

function renderData() {
    const tb = document.getElementById('tableBody'); tb.innerHTML = '';
    
    let opInc=0, opExp=0, nonOpInc=0, nonOpExp=0;
    let transferInc = 0; 
    let initBF = 0; 
    let bfFound = false;
    let cMonth={}, pInc={}, pExp={};

    if (rawData.length === 0) {
        tb.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">ยังไม่มีรายการบัญชี</td></tr>';
        updateCards(0, 0, 0, 0); renderCharts(cMonth, pInc, pExp); return;
    }

    // Sort วันที่ให้เรียงจากเก่าไปใหม่ เพื่อป้องกันยอดยกมาเพี้ยน
    let sortedData = [...rawData].sort((a,b) => new Date(a.date) - new Date(b.date));

    sortedData.forEach(r => {
        let amt = Number(r.amount) || 0;
        let d = new Date(r.date);
        let itemStr = String(r.item).trim();
        let sKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        
        if(!cMonth[sKey]) cMonth[sKey] = { label: `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`, inc: 0, exp: 0 };

        if (r.type === 'รายรับ') {
            if (itemStr === 'ยอดยกมา') {
                if (!bfFound) { initBF = amt; bfFound = true; }
            }
            else if (['เบิกเงินกองทุน', 'ถอนเงินกองทุน'].includes(itemStr)) { 
                nonOpInc += amt; 
            } else { 
                opInc += amt; 
                cMonth[sKey].inc += amt; 
                pInc[itemStr] = (pInc[itemStr]||0)+amt; 
                
                // หักเงินโอนออกจากกระแสเงินสดของร้าน
                if (currentModule !== 'Fund' && r.method === 'เงินโอน') {
                    transferInc += amt;
                }
            }
        } else if (r.type === 'รายจ่าย') {
            if (['คืนเงินกองทุน', 'ถอนเงิน'].includes(itemStr)) { 
                nonOpExp += amt; 
            } else { 
                opExp += amt; 
                cMonth[sKey].exp += amt; 
                pExp[itemStr] = (pExp[itemStr]||0)+amt; 
            }
        }

        let act = '-';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            act = `<button onclick="editTx('${r.id}')" class="text-amber-500 mx-1"><i class="fa-solid fa-edit"></i></button><button onclick="delTx('${r.id}')" class="text-red-500 mx-1"><i class="fa-solid fa-trash"></i></button>`;
        }
        let evi = (r.evidence && r.evidence.length > 5) ? `<a href="${r.evidence}" target="_blank" class="text-blue-600 underline text-xs">หลักฐาน</a>` : '-';
        let noteHtml = (currentModule === 'Fund' && r.subItem) ? `<span class="text-blue-600">[${r.subItem}]</span> ${r.department||''} <br> ${r.note}` : r.note;
        
        let methodHtml = '-';
        if(r.method === 'เงินสด') methodHtml = `<span class="bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded text-xs font-semibold">เงินสด</span>`;
        else if(r.method === 'เงินโอน') methodHtml = `<span class="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded text-xs font-semibold">เงินโอน</span>`;

        tb.innerHTML += `<tr class="border-b">
            <td class="p-3">${r.date}</td>
            <td class="p-3"><span class="px-2 py-1 text-xs rounded ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
            <td class="p-3 font-medium">${r.item} <br><span class="text-xs text-slate-500 font-normal">${noteHtml}</span></td>
            <td class="p-3 text-center">${methodHtml}</td>
            <td class="p-3 text-right">฿${amt.toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
            <td class="p-3 text-center">${evi}</td>
            <td class="p-3 text-center">${act}</td>
        </tr>`;
    });

    let profit = opInc - opExp; 
    let cashOnHand = (opInc + nonOpInc + initBF) - (opExp + nonOpExp);
    if (currentModule !== 'Fund') { cashOnHand -= transferInc; } // หักเงินโอน

    document.getElementById('lbl_inc').innerText = currentModule === 'Fund' ? 'รายรับ (เงินโอน/เงินสด)' : 'รายได้ดำเนินงาน (ยอดขาย)';
    updateCards(opInc, opExp, profit, cashOnHand);
    renderCharts(cMonth, pInc, pExp);
}

function updateCards(inc, exp, pro, cash) {
    const f = n => '฿' + (n||0).toLocaleString('th-TH', {minimumFractionDigits:2});
    document.getElementById('c_income').innerText = f(inc); document.getElementById('c_expense').innerText = f(exp);
    document.getElementById('c_profit').innerText = f(pro); document.getElementById('c_profit').className = pro>=0?"text-2xl font-bold text-blue-600 mt-1":"text-2xl font-bold text-red-600 mt-1";
    document.getElementById('c_cash').innerText = f(cash);
}

function renderCharts(m, pI, pE) {
    if(document.getElementById('viewModule').classList.contains('hidden')) return;
    const k = Object.keys(m).sort();
    if(charts.main) charts.main.destroy();
    charts.main = new Chart(document.getElementById('mainChart').getContext('2d'), { data: { labels: k.map(x=>m[x].label), datasets: [ { type: 'line', label: 'ผลประกอบการ', data: k.map(x=>m[x].inc-m[x].exp), borderColor: '#3b82f6', backgroundColor: '#3b82f6' }, { type: 'bar', label: 'รายรับดำเนินงาน', data: k.map(x=>m[x].inc), backgroundColor: '#22c55e' }, { type: 'bar', label: 'รายจ่ายดำเนินงาน', data: k.map(x=>m[x].exp), backgroundColor: '#ef4444' } ] }, options: { responsive: true, maintainAspectRatio: false } });

    const opt = { responsive: true, maintainAspectRatio: false, plugins:{legend:{position:'right'}} };
    if(charts.incPie) charts.incPie.destroy(); charts.incPie = new Chart(document.getElementById('incPieChart').getContext('2d'), { type:'doughnut', data:{labels:Object.keys(pI), datasets:[{data:Object.values(pI), backgroundColor:['#22c55e','#10b981','#eab308']}]}, options:opt});
    if(charts.expPie) charts.expPie.destroy(); charts.expPie = new Chart(document.getElementById('expPieChart').getContext('2d'), { type:'doughnut', data:{labels:Object.keys(pE), datasets:[{data:Object.values(pE), backgroundColor:['#ef4444','#f97316','#8b5cf6']}]}, options:opt});
}

// --- Forms ---
function updateItemOptions() {
    const t = document.getElementById('f_type').value; const el = document.getElementById('f_item'); el.innerHTML = '';
    let opts = currentModule === 'Fund' ? (t==='รายรับ'?['ยอดยกมา','เงินโอน (ปรับสมุด)','เงินสด','อื่นๆ']:['ถอนเงิน','อื่นๆ']) : (t==='รายรับ'?['ยอดยกมา','ยอดขาย','เบิกเงินกองทุน','อื่นๆ']:['เงินเดือน','ซื้อของ','คืนเงินกองทุน','อื่นๆ']);
    opts.forEach(o => el.add(new Option(o,o))); toggleFundExpenseDetails();
}
function toggleFundExpenseDetails() { document.getElementById('fundExpenseDetails').classList.toggle('hidden', !(currentModule==='Fund' && document.getElementById('f_type').value==='รายจ่าย')); }
function toggleEvi() { document.getElementById('f_file').classList.toggle('hidden', document.getElementById('f_eviType').value!=='file'); document.getElementById('f_link').classList.toggle('hidden', document.getElementById('f_eviType').value==='file'); }
function getBase64(f) { return new Promise((res,rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = ()=>res(r.result.replace(/^data:(.*,)?/,'')); r.onerror=rej; }); }

async function submitForm(e) {
    e.preventDefault(); const btn = document.getElementById('btnSave'); btn.innerText = 'กำลังบันทึก...'; btn.disabled = true;
    let pay = { module: currentModule, username: currentUser.username, rowIndex: document.getElementById('f_id').value, date: document.getElementById('f_date').value, type: document.getElementById('f_type').value, item: document.getElementById('f_item').value, method: document.getElementById('f_method').value, amount: document.getElementById('f_amount').value, note: document.getElementById('f_note').value, subItem: document.getElementById('f_subItem').value, department: document.getElementById('f_department').value };
    if(document.getElementById('f_eviType').value === 'file' && document.getElementById('f_file').files[0]) { pay.fileBase64 = await getBase64(document.getElementById('f_file').files[0]); pay.fileName = document.getElementById('f_file').files[0].name; pay.fileMimeType = document.getElementById('f_file').files[0].type; }
    else pay.evidenceLink = document.getElementById('f_link').value;
    try { const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action:'save_tx', payload:pay }) })).json(); if(res.status==='success') { Swal.fire('สำเร็จ', res.message, 'success'); closeModal(); fetchData(); } else Swal.fire('Error', res.message, 'error'); } 
    catch(err) { Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error'); } finally { btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; }
}

function editTx(id) { const r = rawData.find(x => x.id === id); if(!r) return; document.getElementById('f_id').value = r.id; document.getElementById('f_date').value = r.date; document.getElementById('f_type').value = r.type; updateItemOptions(); document.getElementById('f_item').value = r.item; document.getElementById('f_method').value = r.method; document.getElementById('f_amount').value = r.amount; document.getElementById('f_note').value = r.note; document.getElementById('f_subItem').value = r.subItem||''; document.getElementById('f_department').value = r.department||''; toggleFundExpenseDetails(); document.getElementById('txModal').classList.remove('hidden'); }
function delTx(id) { Swal.fire({title:'ลบรายการ?', icon:'warning', showCancelButton:true}).then(async (r) => { if(r.isConfirmed) { const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) })).json(); if(res.status==='success') fetchData(); } }); }
function openModal() { document.getElementById('txModal').classList.remove('hidden'); updateItemOptions(); }
function closeModal() { document.getElementById('txModal').classList.add('hidden'); document.getElementById('txForm').reset(); document.getElementById('f_id').value=''; }
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }

// --- Report Generation ---
function openReportModal() { document.getElementById('reportModal').classList.remove('hidden'); }
function closeReportPreview() { document.getElementById('reportPreviewContainer').classList.add('hidden'); }

function generateReport() {
    document.getElementById('reportModal').classList.add('hidden');
    const m = parseInt(document.getElementById('r_month').value), y = parseInt(document.getElementById('r_year').value);
    const mName = document.getElementById('r_month').options[document.getElementById('r_month').selectedIndex].text;
    const pa = document.getElementById('printArea');
    
    let sortedData = [...rawData].sort((a,b) => new Date(a.date) - new Date(b.date));
    let runningBalance = 0; 
    let monthData = [];
    let hasFoundInitialBF = false;
    
    sortedData.forEach(r => {
        let d = new Date(r.date), amt = Number(r.amount)||0;
        let itemStr = String(r.item).trim();
        
        let actualAmt = amt;
        if (r.type === 'รายรับ' && itemStr === 'ยอดยกมา') {
            if (!hasFoundInitialBF) { hasFoundInitialBF = true; } 
            else { actualAmt = 0; } // ดักจับยอดยกมาซ้ำซ้อน ไม่นำมาคำนวณ
        }

        if(d.getFullYear() < y || (d.getFullYear() === y && d.getMonth()+1 < m)) {
            if(r.type === 'รายรับ') runningBalance += actualAmt; else runningBalance -= actualAmt;
        } else if(d.getFullYear() === y && d.getMonth()+1 === m) {
            // ยอดยกมาไม่ต้องโชว์ในตาราง เพราะใบบัญชีมีช่องให้มันอยู่แล้ว ยกเว้นมันบังเอิญเกิดในเดือนนี้พอดีก็นำไปบวกเป็นฐาน
            if (!(r.type === 'รายรับ' && itemStr === 'ยอดยกมา')) {
                monthData.push(r);
            } else if (actualAmt > 0) {
                runningBalance += actualAmt;
            }
        }
    });

    let bf = runningBalance;
    const f = n => (n||0).toLocaleString('th-TH', {minimumFractionDigits:2});
    
    if(currentModule === 'Fund') { 
        let bal = bf;
        let trs = monthData.map(r => {
            if(r.type === 'รายรับ') bal += Number(r.amount); else bal -= Number(r.amount);
            let desc = r.item + (r.subItem ? ` - ${r.subItem}` : '');
            return `<tr><td style="border:1px solid #000; padding:8px;">${r.date}</td><td style="border:1px solid #000; padding:8px;">${desc}</td><td style="border:1px solid #000; padding:8px; text-align:right;">${r.type==='รายรับ'?f(r.amount):'-'}</td><td style="border:1px solid #000; padding:8px; text-align:right;">${r.type==='รายจ่าย'?f(r.amount):'-'}</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(bal)}</td></tr>`;
        }).join('');
        
        pa.innerHTML = `<div style="font-family:'Sarabun'; color:#000;">
            <h2 style="text-align:center; font-size:24px; font-weight:bold;">บัญชีกองทุนเพื่อผู้ป่วยจิตเวชยากไร้</h2>
            <h3 style="text-align:center; font-size:18px;">Statement ประจำเดือน ${mName} ${y+543}</h3>
            <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:15px;">
                <thead><tr style="background:#f0f0f0;"><th style="border:1px solid #000; padding:8px;">วันที่</th><th style="border:1px solid #000; padding:8px;">รายการ</th><th style="border:1px solid #000; padding:8px;">ฝั่งเข้า (In)</th><th style="border:1px solid #000; padding:8px;">ฝั่งออก (Out)</th><th style="border:1px solid #000; padding:8px;">คงเหลือ (Balance)</th></tr></thead>
                <tbody>
                    <tr><td style="border:1px solid #000; padding:8px;" colspan="4">ยอดยกมา</td><td style="border:1px solid #000; padding:8px; text-align:right; font-weight:bold;">${f(bf)}</td></tr>
                    ${trs}
                </tbody>
            </table>
        </div>`;
    } else { 
        let sCash=0, sTrans=0, sFund=0, eGoods=0, eSal=0, eFund=0;
        monthData.forEach(r => {
            let amt = Number(r.amount)||0;
            let itemStr = String(r.item).trim();
            if(r.type === 'รายรับ') {
                if(itemStr.includes('ขายสินค้า') || itemStr === 'ยอดขาย') {
                    if(r.method === 'เงินสด') sCash += amt;
                    else if(r.method === 'เงินโอน') sTrans += amt;
                }
                else if(itemStr.includes('กองทุน')) sFund += amt;
            } else {
                if(itemStr.includes('ซื้อของ')) eGoods += amt;
                else if(itemStr === 'เงินเดือน') eSal += amt;
                else if(itemStr.includes('คืนเงินกองทุน') || itemStr.includes('ถอนเงิน')) eFund += amt;
            }
        });
        
        let tSales = sCash + sTrans; let tExp = eGoods + eSal; let net = tSales - tExp;
        let tMoney = net + bf + sFund; let cHand = tMoney - sTrans - eFund;

        pa.innerHTML = `<div style="font-family:'Sarabun'; color:#000;">
            <h2 style="text-align:center; font-size:22px; font-weight:bold;">สรุปรายรับ-รายจ่าย ${currentModule==='Cafe'?'ร้านกาแฟสุขใจ':'ร้านผลิตภัณฑ์ฯ'}</h2>
            <h3 style="text-align:center; font-size:18px; margin-bottom:20px;">ประจำเดือน ${mName} ${y+543}</h3>
            <table style="width:100%; border-collapse:collapse; font-size:15px;">
                <tr style="background:#fff4cc; text-align:center;"><th colspan="2" style="border:1px solid #000; padding:8px;">รายรับ</th><th colspan="2" style="border:1px solid #000; padding:8px;">รายจ่าย</th></tr>
                <tr><td style="border:1px solid #000; padding:8px; background:#ffdeb3;">ยอดยกมา</td><td style="border:1px solid #000; padding:8px; text-align:right; background:#ffdeb3;">${f(bf)}</td><td style="border:1px solid #000; padding:8px;">ค่าซื้อของ</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(eGoods)}</td></tr>
                <tr><td style="border:1px solid #000; padding:8px;">ขาย (สด)</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(sCash)}</td><td style="border:1px solid #000; padding:8px;">เงินเดือน</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(eSal)}</td></tr>
                <tr><td style="border:1px solid #000; padding:8px;">ขาย (โอน)</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(sTrans)}</td><td style="border:1px solid #000; padding:8px;">คืนกองทุน</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(eFund)}</td></tr>
                <tr><td style="border:1px solid #000; padding:8px; background:#ffdeb3;">เบิกกองทุน</td><td style="border:1px solid #000; padding:8px; text-align:right; background:#ffdeb3;">${f(sFund)}</td><td style="border:1px solid #000; padding:8px;"></td><td style="border:1px solid #000; padding:8px;"></td></tr>
                <tr style="background:#d4edda; font-weight:bold;"><td style="border:1px solid #000; padding:8px;">รวมรับสิ้น</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(bf+tSales+sFund)}</td><td style="border:1px solid #000; padding:8px;">รวมจ่ายทั้งสิ้น</td><td style="border:1px solid #000; padding:8px; text-align:right;">${f(tExp+eFund)}</td></tr>
                <tr><td colspan="4" style="border:none; padding:10px;"></td></tr>
                <tr><td colspan="2" style="border:1px solid #000; padding:8px;">รายได้ขายรวม</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><u>${f(tSales)}</u></td></tr>
                <tr><td colspan="2" style="border:1px solid #000; padding:8px;">หัก ค่าใช้จ่าย</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><u>${f(tExp)}</u></td></tr>
                <tr style="background:#cce5ff; font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:8px;">กำไร/ขาดทุนสุทธิ</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right; color:red;">${f(net)}</td></tr>
                <tr style="background:#ffdeb3;"><td colspan="2" style="border:1px solid #000; padding:8px;">บวก ยอดยกมา</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><u>${f(bf)}</u></td></tr>
                <tr style="background:#ffdeb3;"><td colspan="2" style="border:1px solid #000; padding:8px;">บวก เบิกกองทุน</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><u>${f(sFund)}</u></td></tr>
                <tr style="background:#d4edda; font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:8px;">รวมเป็นเงินทั้งสิ้น</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;">${f(tMoney)}</td></tr>
                <tr><td colspan="2" style="border:1px solid #000; padding:8px;">หัก คืนกองทุน</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;"><u>${f(eFund)}</u></td></tr>
                <tr style="font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:8px;">คงเหลือเงินสดในมือ (หักโอน)</td><td colspan="2" style="border:1px solid #000; padding:8px; text-align:right;">${f(cHand)}</td></tr>
            </table>
        </div>`;
    }
    
    document.getElementById('reportPreviewContainer').classList.remove('hidden');
}
