// ==========================================
// js/app.js - ควบคุมการทำงานของหน้า Dashboard
// ==========================================

let currentUser = JSON.parse(sessionStorage.getItem('user'));
if (!currentUser) window.location.href = 'index.html'; 

let currentModule = 'Overview';
let rawData = [];

// ตัวแปรเก็บ Instance ของกราฟ
let overviewChartInst = null;
let modBarInst = null;
let modLineInst = null;
let modPieIncInst = null;
let modPieExpInst = null;

// ป้ายกำกับการ์ดแยกตามแผนก (เน้นคำว่า "ดำเนินงาน")
const moduleLabels = {
    Fund: { title: 'บัญชีธนาคาร: กองทุนเพื่อผู้ป่วยจิตเวชยากไร้', c1: 'รับเข้า (ดำเนินงาน)', c2: 'จ่ายออก (ดำเนินงาน)', c3: 'กำไรจากการดำเนินงาน', c4: 'เงินสดคงเหลือ' },
    Cafe: { title: 'หน่วยลงทุน: ร้านกาแฟสุขใจ', c1: 'รายรับ (ดำเนินงาน)', c2: 'รายจ่าย (ดำเนินงาน)', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' },
    Shop: { title: 'หน่วยลงทุน: ร้านผลิตภัณฑ์ผู้ป่วย', c1: 'รายรับ (ดำเนินงาน)', c2: 'รายจ่าย (ดำเนินงาน)', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userDisplay').innerText = `ผู้ใช้งาน: ${currentUser.username} (${currentUser.role})`;
    switchModule('Overview'); 
});

// --- UI Controls ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('mobileOverlay').classList.toggle('hidden');
}

// --- Date Filter ---
function applyFilter() { 
    if (currentModule === 'Overview') fetchOverview(); 
    else fetchData(); 
}

function clearFilter() { 
    document.getElementById('filterStart').value = ''; 
    document.getElementById('filterEnd').value = ''; 
    applyFilter(); 
}

function getFilterPayload() { 
    return { 
        startDate: document.getElementById('filterStart').value, 
        endDate: document.getElementById('filterEnd').value 
    }; 
}

// --- Module Switcher ---
function switchModule(mod) {
    currentModule = mod;
    
    // เปลี่ยนสีปุ่มเมนู
    document.querySelectorAll('aside nav button').forEach(b => { 
        b.classList.remove('bg-blue-600'); 
        b.classList.add('hover:bg-slate-700'); 
    });
    document.getElementById(`nav-${mod}`).classList.add('bg-blue-600');
    document.getElementById(`nav-${mod}`).classList.remove('hover:bg-slate-700');

    // ปิดเมนูบนมือถือ
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobileOverlay').classList.add('hidden');
    }

    const btnAdd = document.getElementById('btnAdd');

    if (mod === 'Overview') {
        document.getElementById('overviewSection').classList.remove('hidden');
        document.getElementById('moduleSection').classList.add('hidden');
        document.getElementById('moduleTitle').innerText = 'ภาพรวมบัญชีกองทุนและหน่วยลงทุน';
        document.getElementById('mobileTitle').innerText = 'ภาพรวมกองทุน';
        btnAdd.classList.add('hidden'); 
        fetchOverview();
    } else {
        document.getElementById('overviewSection').classList.add('hidden');
        document.getElementById('moduleSection').classList.remove('hidden');
        
        document.getElementById('moduleTitle').innerText = moduleLabels[mod].title;
        document.getElementById('mobileTitle').innerText = moduleLabels[mod].title;
        document.getElementById('lbl_card1').innerText = moduleLabels[mod].c1;
        document.getElementById('lbl_card2').innerText = moduleLabels[mod].c2;
        document.getElementById('lbl_card3').innerText = moduleLabels[mod].c3;
        document.getElementById('lbl_card4').innerText = moduleLabels[mod].c4;

        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${mod}`) {
            btnAdd.classList.remove('hidden');
        } else {
            btnAdd.classList.add('hidden');
        }
        
        fetchData();
    }
}

// --- Overview Fetch & Render ---
async function fetchOverview() {
    Swal.showLoading();
    try {
        let payload = getFilterPayload();
        const res = await (await fetch(CONFIG.API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'get_overview', payload }) 
        })).json();
        
        if (res.status === 'success') {
            const fmt = n => `฿${Number(n).toLocaleString('th-TH')}`;
            
            document.getElementById('o_fundBal').innerText = fmt(res.data.fund.bal); 
            document.getElementById('o_fundProfit').innerText = fmt(res.data.fund.opInc - res.data.fund.opExp); 
            
            document.getElementById('o_cafeBal').innerText = fmt(res.data.cafe.opInc - res.data.cafe.opExp);
            document.getElementById('o_shopBal').innerText = fmt(res.data.shop.opInc - res.data.shop.opExp);
            
            renderOverviewChart(res.data);
            Swal.close();
        }
    } catch (err) { 
        Swal.fire('Error', 'ไม่สามารถโหลดภาพรวมได้', 'error'); 
        console.error(err);
    }
}

function renderOverviewChart(data) {
    const allKeys = [...new Set([
        ...Object.keys(data.fund.chart), 
        ...Object.keys(data.cafe.chart), 
        ...Object.keys(data.shop.chart)
    ])].sort();
    
    const fundProfit = allKeys.map(k => (data.fund.chart[k]?.opInc || 0) - (data.fund.chart[k]?.opExp || 0));
    const cafeProfit = allKeys.map(k => (data.cafe.chart[k]?.opInc || 0) - (data.cafe.chart[k]?.opExp || 0));
    const shopProfit = allKeys.map(k => (data.shop.chart[k]?.opInc || 0) - (data.shop.chart[k]?.opExp || 0));

    if(overviewChartInst) overviewChartInst.destroy();
    overviewChartInst = new Chart(document.getElementById('overviewChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: allKeys,
            datasets: [
                { label: 'บัญชีกองทุนฯ', data: fundProfit, backgroundColor: '#3b82f6' },
                { label: 'ร้านกาแฟ', data: cafeProfit, backgroundColor: '#f59e0b' },
                { label: 'ร้านผลิตภัณฑ์', data: shopProfit, backgroundColor: '#10b981' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- Specific Module Fetch & Render ---
async function fetchData() {
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="p-4 text-center py-10"><i class="fa-solid fa-spinner fa-spin text-blue-500 text-3xl mb-2"></i><br>กำลังโหลด...</td></tr>';
    try {
        let payload = getFilterPayload();
        payload.module = currentModule;
        const res = await (await fetch(CONFIG.API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'get_data', payload }) 
        })).json();
        
        if (res.status === 'success') { 
            rawData = res.data; 
            renderData(); 
            renderModuleCharts(); 
        }
    } catch (err) { 
        Swal.fire('Error', 'โหลดข้อมูลล้มเหลว', 'error'); 
        console.error(err);
    }
}

function renderData() {
    const tb = document.getElementById('tableBody'); 
    tb.innerHTML = '';
    
    let opInc = 0, opExp = 0, capIn = 0, capOut = 0;
    
    if (rawData.length === 0) {
        return tb.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 bg-slate-50">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>';
    }

    rawData.forEach(r => {
        let amt = Number(r.amount);
        let isCapIn = (r.item === 'ยอดยกมา' || r.item === 'ถอนเงินกองทุน');
        let isCapOut = (r.item === 'คืนเงินกองทุน');

        // แยกทุน กับ การดำเนินงาน
        if (r.type === 'รายรับ') {
            if (isCapIn) capIn += amt; else opInc += amt;
        } else {
            if (isCapOut) capOut += amt; else opExp += amt;
        }
        
        let eviHtml = r.evidence ? `<a href="${r.evidence}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 text-xs font-medium"><i class="fa-solid fa-file-pdf"></i> ไฟล์</a>` : '-';
        
        let actionHtml = '-';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            actionHtml = `
                <div class="flex justify-center gap-2">
                    <button onclick='editTx(${JSON.stringify(r)})' class="w-8 h-8 rounded-full bg-amber-50 text-amber-500 hover:bg-amber-100 transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteTx('${r.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        }
        
        let trClass = (isCapIn || isCapOut) ? 'bg-slate-100/50 text-slate-500' : 'hover:bg-slate-50 text-slate-800';
        
        tb.innerHTML += `
            <tr class="${trClass} transition border-b border-slate-50">
                <td class="p-3 md:p-4">${r.date}</td>
                <td class="p-3 md:p-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
                <td class="p-3 md:p-4"><p class="font-medium">${r.item}</p><p class="text-xs text-slate-500">${r.note || ''}</p></td>
                <td class="p-3 md:p-4 text-right font-semibold ${r.type==='รายรับ'?'text-green-600':'text-red-600'}">฿${amt.toLocaleString('th-TH')}</td>
                <td class="p-3 md:p-4 text-center">${eviHtml}</td>
                <td class="p-3 md:p-4 text-center">${actionHtml}</td>
            </tr>`;
    });

    const fmt = n => `฿${Number(n).toLocaleString('th-TH')}`;
    
    document.getElementById('c_card1').innerText = fmt(opInc);
    document.getElementById('c_sub1').innerText = `+ ทุน/ยอดยกมา: ${fmt(capIn)}`;

    document.getElementById('c_card2').innerText = fmt(opExp);
    document.getElementById('c_sub2').innerText = `+ คืนทุนกองทุน: ${fmt(capOut)}`;

    document.getElementById('c_card3').innerText = fmt(opInc - opExp);
    document.getElementById('c_card4').innerText = fmt((opInc + capIn) - (opExp + capOut));
}

function renderModuleCharts() {
    let monthly = {}; 
    let pInc = {}; 
    let pExp = {};
    
    rawData.forEach(r => {
        let d = r.date.substring(0, 7);
        if(!monthly[d]) monthly[d] = { opInc: 0, opExp: 0 };
        
        let amt = Number(r.amount);
        let isCapIn = (r.item === 'ยอดยกมา' || r.item === 'ถอนเงินกองทุน');
        let isCapOut = (r.item === 'คืนเงินกองทุน');

        // กราฟใช้เฉพาะ Operational
        if(r.type === 'รายรับ' && !isCapIn) { 
            monthly[d].opInc += amt; 
            pInc[r.item] = (pInc[r.item]||0) + amt; 
        }
        else if(r.type === 'รายจ่าย' && !isCapOut) { 
            monthly[d].opExp += amt; 
            pExp[r.item] = (pExp[r.item]||0) + amt; 
        }
    });

    const mKeys = Object.keys(monthly).sort();
    const mIncData = mKeys.map(k => monthly[k].opInc);
    const mExpData = mKeys.map(k => monthly[k].opExp);
    const mProfData = mKeys.map(k => monthly[k].opInc - monthly[k].opExp);

    if(modBarInst) modBarInst.destroy();
    modBarInst = new Chart(document.getElementById('modBarChart').getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: mKeys, 
            datasets: [
                { label: 'รายรับ (ดำเนินงาน)', data: mIncData, backgroundColor: '#22c55e'}, 
                { label: 'รายจ่าย (ดำเนินงาน)', data: mExpData, backgroundColor: '#ef4444'}
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    if(modLineInst) modLineInst.destroy();
    modLineInst = new Chart(document.getElementById('modLineChart').getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: mKeys, 
            datasets: [
                { label: 'กำไรสุทธิ', data: mProfData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true, tension: 0.3 }
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    if(modPieIncInst) modPieIncInst.destroy();
    modPieIncInst = new Chart(document.getElementById('modPieInc').getContext('2d'), { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(pInc), 
            datasets: [{ data: Object.values(pInc), backgroundColor: ['#22c55e','#10b981','#84cc16','#eab308']}] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    if(modPieExpInst) modPieExpInst.destroy();
    modPieExpInst = new Chart(document.getElementById('modPieExp').getContext('2d'), { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(pExp), 
            datasets: [{ data: Object.values(pExp), backgroundColor: ['#ef4444','#f97316','#f43f5e','#a855f7']}] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });
}

// ==========================================
// --- Form, Upload, and CRUD Logic ---
// ==========================================

function updateItemDropdown() {
    const type = document.getElementById('f_type').value;
    const select = document.getElementById('f_item_select');
    select.innerHTML = '';
    
    let options = [];

    // ตรวจสอบว่ากำลังอยู่หน้าโมดูลไหน
    if (currentModule === 'Fund') {
        // ตัวเลือกสำหรับ บัญชีหลักกองทุนฯ (บัญชีธนาคาร)
        if (type === 'รายรับ') {
            options = ['ยอดยกมา', 'เงินฝากธนาคาร', 'อื่นๆ'];
        } else {
            options = ['ถอนเงินจากธนาคาร', 'อื่นๆ'];
        }
    } else {
        // ตัวเลือกสำหรับ ร้านกาแฟ และ ร้านผลิตภัณฑ์
        if (type === 'รายรับ') {
            options = ['ยอดยกมา', 'ขายสินค้า', 'ถอนเงินกองทุน', 'อื่นๆ'];
        } else {
            options = ['ซื้อของ', 'เงินเดือน', 'คืนเงินกองทุน', 'อื่นๆ'];
        }
    }
        
    options.forEach(opt => select.add(new Option(opt, opt)));
    toggleOtherItem();
}

function toggleOtherItem() {
    const select = document.getElementById('f_item_select').value;
    const otherInput = document.getElementById('f_item_other');
    if (select === 'อื่นๆ') {
        otherInput.classList.remove('hidden');
        otherInput.required = true;
    } else {
        otherInput.classList.add('hidden');
        otherInput.required = false;
        otherInput.value = ''; 
    }
}

function toggleEvi() { 
    if (document.getElementById('f_eviType').value === 'file') {
        document.getElementById('f_file').classList.remove('hidden');
        document.getElementById('f_link').classList.add('hidden');
    } else {
        document.getElementById('f_file').classList.add('hidden');
        document.getElementById('f_link').classList.remove('hidden');
    }
}

function getBase64(file) { 
    return new Promise((res, rej) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = () => res(reader.result.replace(/^data:(.*,)?/, '')); 
        reader.onerror = e => rej(e); 
    }); 
}

async function submitForm(e) { 
    e.preventDefault(); 
    const btn = document.getElementById('btnSave'); 
    btn.innerText = 'กำลังบันทึก...'; 
    btn.disabled = true; 
    
    let finalItem = document.getElementById('f_item_select').value;
    if (finalItem === 'อื่นๆ') {
        finalItem = document.getElementById('f_item_other').value;
    }

    let payload = { 
        module: currentModule, 
        username: currentUser.username, 
        rowIndex: document.getElementById('f_id').value, 
        date: document.getElementById('f_date').value, 
        type: document.getElementById('f_type').value, 
        item: finalItem, 
        method: document.getElementById('f_method').value, 
        amount: document.getElementById('f_amount').value, 
        note: document.getElementById('f_note').value 
    }; 
    
    if (document.getElementById('f_eviType').value === 'file') { 
        const f = document.getElementById('f_file').files[0]; 
        if (f) { 
            if (f.size > 5242880) { 
                Swal.fire('ผิดพลาด', 'ไฟล์ขนาดเกิน 5MB', 'warning'); 
                btn.innerText = 'บันทึกข้อมูล'; 
                btn.disabled = false; 
                return; 
            } 
            payload.fileBase64 = await getBase64(f); 
            payload.fileName = f.name; 
            payload.fileMimeType = f.type; 
        } 
    } else {
        payload.evidenceLink = document.getElementById('f_link').value; 
    }
    
    try { 
        const res = await (await fetch(CONFIG.API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'save_tx', payload }) 
        })).json(); 
        
        if (res.status === 'success') { 
            Swal.fire({title: 'สำเร็จ', text: res.message, icon: 'success', timer: 1500, showConfirmButton: false}); 
            closeModal(); 
            fetchData(); 
        } else {
            Swal.fire('ผิดพลาด', res.message, 'error'); 
        }
    } catch (err) { 
        Swal.fire('Error', 'ไม่สามารถเชื่อมต่อได้', 'error'); 
        console.error(err);
    } finally { 
        btn.innerText = 'บันทึกข้อมูล'; 
        btn.disabled = false; 
    } 
}

function editTx(r) { 
    document.getElementById('modalFormTitle').innerText = 'แก้ไขรายการ'; 
    document.getElementById('f_id').value = r.id; 
    document.getElementById('f_date').value = r.date; 
    document.getElementById('f_type').value = r.type; 
    
    updateItemDropdown(); 
    
    const select = document.getElementById('f_item_select');
    const options = Array.from(select.options).map(o => o.value);
    if (options.includes(r.item)) {
        select.value = r.item;
        toggleOtherItem();
    } else {
        select.value = 'อื่นๆ';
        toggleOtherItem();
        document.getElementById('f_item_other').value = r.item;
    }

    document.getElementById('f_method').value = r.method; 
    document.getElementById('f_amount').value = r.amount; 
    document.getElementById('f_note').value = r.note; 
    openModal(); 
}

function deleteTx(id) { 
    Swal.fire({ 
        title: 'ยืนยันการลบ?', 
        text: "ข้อมูลที่ลบจะไม่สามารถกู้คืนได้",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'ลบเลย', 
        cancelButtonText: 'ยกเลิก' 
    }).then(async (result) => { 
        if (result.isConfirmed) { 
            try {
                const res = await (await fetch(CONFIG.API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) 
                })).json(); 
                
                if (res.status === 'success') {
                    Swal.fire({title: 'ลบสำเร็จ', icon: 'success', timer: 1500, showConfirmButton: false});
                    fetchData(); 
                } else {
                    Swal.fire('ผิดพลาด', res.message, 'error'); 
                }
            } catch (err) {
                Swal.fire('Error', 'เชื่อมต่อขัดข้อง', 'error');
            }
        } 
    }); 
}

function openModal() { 
    document.getElementById('txModal').classList.remove('hidden'); 
    if (!document.getElementById('f_id').value) updateItemDropdown(); 
}

function closeModal() { 
    document.getElementById('txModal').classList.add('hidden'); 
    document.getElementById('txForm').reset(); 
    document.getElementById('f_id').value = ''; 
    document.getElementById('f_eviType').value = 'file';
    toggleEvi();
}

function logout() { 
    sessionStorage.removeItem('user'); 
    window.location.href = 'index.html'; 
}
