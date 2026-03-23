// ==========================================
// js/app.js - ควบคุมการทำงานของหน้า Dashboard
// ==========================================

// 1. ตรวจสอบสิทธิ์การเข้าสู่ระบบ
let currentUser = JSON.parse(sessionStorage.getItem('user'));
if (!currentUser) window.location.href = 'index.html'; 

let currentModule = 'Overview';
let rawData = [];

// ตัวแปรเก็บ Instance ของกราฟ Chart.js
let overviewChartInst = null;
let modBarInst = null;
let modLineInst = null;
let modPieIncInst = null;
let modPieExpInst = null;

// ตั้งค่าหัวข้อและคำอธิบายการ์ดให้ตรงตามบริบทของแต่ละฝ่าย
const moduleLabels = {
    Fund: { title: 'บัญชีธนาคาร: กองทุนเพื่อผู้ป่วยจิตเวชยากไร้', c1: 'ยอดยกมา / รับเข้า', c2: 'จ่ายออก / สนับสนุน', c3: 'ส่วนต่างเงินทุน', c4: 'คงเหลือในบัญชี' },
    Cafe: { title: 'หน่วยลงทุน: ร้านกาแฟสุขใจ', c1: 'ยอดขาย / รายรับ', c2: 'ต้นทุน / ค่าใช้จ่าย', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' },
    Shop: { title: 'หน่วยลงทุน: ร้านผลิตภัณฑ์ผู้ป่วย', c1: 'ยอดขาย / รายรับ', c2: 'ต้นทุน / ค่าใช้จ่าย', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userDisplay').innerText = `ผู้ใช้งาน: ${currentUser.username} (${currentUser.role})`;
    switchModule('Overview'); // โหลดหน้าแรกเป็นภาพรวมเสมอ
});

// --- การแสดงผล Sidebar สำหรับมือถือ ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('mobileOverlay').classList.toggle('hidden');
}

// --- ระบบ Filter กรองวันที่ ---
function applyFilter() {
    if (currentModule === 'Overview') {
        fetchOverview();
    } else {
        fetchData();
    }
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

// --- ระบบสลับเมนู (Switch Module) ---
function switchModule(mod) {
    currentModule = mod;
    
    // เปลี่ยนสีปุ่มเมนูที่ใช้งานอยู่
    document.querySelectorAll('aside nav button').forEach(b => { 
        b.classList.remove('bg-blue-600'); 
        b.classList.add('hover:bg-slate-700'); 
    });
    document.getElementById(`nav-${mod}`).classList.add('bg-blue-600');
    document.getElementById(`nav-${mod}`).classList.remove('hover:bg-slate-700');

    // ปิดเมนูอัตโนมัติเมื่อกดบนมือถือ
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('-translate-x-full');
        document.getElementById('mobileOverlay').classList.add('hidden');
    }

    const btnAdd = document.getElementById('btnAdd');

    if (mod === 'Overview') {
        // แสดงหน้าภาพรวม
        document.getElementById('overviewSection').classList.remove('hidden');
        document.getElementById('moduleSection').classList.add('hidden');
        document.getElementById('moduleTitle').innerText = 'ภาพรวมบัญชีกองทุนและหน่วยลงทุน';
        document.getElementById('mobileTitle').innerText = 'ภาพรวมกองทุน';
        btnAdd.classList.add('hidden'); // ซ่อนปุ่มเพิ่มข้อมูล
        fetchOverview();
    } else {
        // แสดงหน้าจัดการข้อมูลย่อย
        document.getElementById('overviewSection').classList.add('hidden');
        document.getElementById('moduleSection').classList.remove('hidden');
        
        // อัปเดตข้อความบนหน้าจอตามแผนก
        document.getElementById('moduleTitle').innerText = moduleLabels[mod].title;
        document.getElementById('mobileTitle').innerText = moduleLabels[mod].title;
        document.getElementById('lbl_card1').innerText = moduleLabels[mod].c1;
        document.getElementById('lbl_card2').innerText = moduleLabels[mod].c2;
        document.getElementById('lbl_card3').innerText = moduleLabels[mod].c3;
        document.getElementById('lbl_card4').innerText = moduleLabels[mod].c4;

        // เช็คสิทธิ์ว่ามีปุ่ม "บันทึกรายการ" ไหม
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${mod}`) {
            btnAdd.classList.remove('hidden');
        } else {
            btnAdd.classList.add('hidden');
        }
        
        fetchData();
    }
}

// --- โหลดข้อมูลภาพรวม (Overview) ---
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
            document.getElementById('o_fundInc').innerText = fmt(res.data.fund.inc);
            document.getElementById('o_fundExp').innerText = fmt(res.data.fund.exp);
            
            document.getElementById('o_cafeBal').innerText = fmt(res.data.cafe.bal);
            document.getElementById('o_shopBal').innerText = fmt(res.data.shop.bal);
            
            renderOverviewChart(res.data);
            Swal.close();
        }
    } catch (err) { 
        Swal.fire('Error', 'ไม่สามารถโหลดภาพรวมได้', 'error'); 
        console.error(err);
    }
}

function renderOverviewChart(data) {
    // หาเดือนทั้งหมดที่มีข้อมูลจากทั้ง 3 ระบบ
    const allKeys = [...new Set([
        ...Object.keys(data.fund.chart), 
        ...Object.keys(data.cafe.chart), 
        ...Object.keys(data.shop.chart)
    ])].sort();
    
    // ดึงกำไร/ส่วนต่างของแต่ละเดือน
    const fundProfit = allKeys.map(k => (data.fund.chart[k]?.inc || 0) - (data.fund.chart[k]?.exp || 0));
    const cafeProfit = allKeys.map(k => (data.cafe.chart[k]?.inc || 0) - (data.cafe.chart[k]?.exp || 0));
    const shopProfit = allKeys.map(k => (data.shop.chart[k]?.inc || 0) - (data.shop.chart[k]?.exp || 0));

    if(overviewChartInst) overviewChartInst.destroy();
    overviewChartInst = new Chart(document.getElementById('overviewChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: allKeys,
            datasets: [
                { label: 'กองทุนฯ (ส่วนต่าง)', data: fundProfit, backgroundColor: '#3b82f6' },
                { label: 'ร้านกาแฟ (กำไร/ขาดทุน)', data: cafeProfit, backgroundColor: '#f59e0b' },
                { label: 'ร้านผลิตภัณฑ์ (กำไร/ขาดทุน)', data: shopProfit, backgroundColor: '#10b981' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- โหลดข้อมูลแผนกย่อย (Modules) ---
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
    let inc = 0, exp = 0;
    
    if (rawData.length === 0) {
        return tb.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 bg-slate-50">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>';
    }

    rawData.forEach(r => {
        if(r.type === 'รายรับ') inc += Number(r.amount); 
        else exp += Number(r.amount);
        
        let eviHtml = r.evidence ? `<a href="${r.evidence}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 text-xs font-medium"><i class="fa-solid fa-file-pdf"></i> ไฟล์</a>` : '-';
        
        let actionHtml = '-';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            actionHtml = `
                <div class="flex justify-center gap-2">
                    <button onclick='editTx(${JSON.stringify(r)})' class="w-8 h-8 rounded-full bg-amber-50 text-amber-500 hover:bg-amber-100 transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteTx('${r.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        }
        
        tb.innerHTML += `
            <tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="p-3 md:p-4">${r.date}</td>
                <td class="p-3 md:p-4"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
                <td class="p-3 md:p-4"><p class="font-medium text-slate-800">${r.item}</p><p class="text-xs text-slate-500">${r.note || ''}</p></td>
                <td class="p-3 md:p-4 text-right font-semibold ${r.type==='รายรับ'?'text-green-600':'text-red-600'}">฿${Number(r.amount).toLocaleString('th-TH')}</td>
                <td class="p-3 md:p-4 text-center">${eviHtml}</td>
                <td class="p-3 md:p-4 text-center">${actionHtml}</td>
            </tr>`;
    });

    const fmt = n => `฿${Number(n).toLocaleString('th-TH')}`;
    document.getElementById('c_card1').innerText = fmt(inc);
    document.getElementById('c_card2').innerText = fmt(exp);
    document.getElementById('c_card3').innerText = fmt(inc - exp);
    document.getElementById('c_card4').innerText = fmt(inc - exp);
}

function renderModuleCharts() {
    let monthly = {}; 
    let pInc = {}; 
    let pExp = {};
    
    // จัดกลุ่มข้อมูล
    rawData.forEach(r => {
        let d = r.date.substring(0, 7); // YYYY-MM
        if(!monthly[d]) monthly[d] = { inc: 0, exp: 0 };
        
        let amt = Number(r.amount);
        if(r.type === 'รายรับ') { 
            monthly[d].inc += amt; 
            pInc[r.item] = (pInc[r.item]||0) + amt; 
        } else { 
            monthly[d].exp += amt; 
            pExp[r.item] = (pExp[r.item]||0) + amt; 
        }
    });

    const mKeys = Object.keys(monthly).sort();
    const mIncData = mKeys.map(k => monthly[k].inc);
    const mExpData = mKeys.map(k => monthly[k].exp);
    const mProfData = mKeys.map(k => monthly[k].inc - monthly[k].exp);

    // 1. Bar Chart (รายรับ-รายจ่าย)
    if(modBarInst) modBarInst.destroy();
    modBarInst = new Chart(document.getElementById('modBarChart').getContext('2d'), { 
        type: 'bar', 
        data: { 
            labels: mKeys, 
            datasets: [
                { label: 'รายรับ', data: mIncData, backgroundColor: '#22c55e'}, 
                { label: 'รายจ่าย', data: mExpData, backgroundColor: '#ef4444'}
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    // 2. Line Chart (กำไร/ส่วนต่าง)
    if(modLineInst) modLineInst.destroy();
    modLineInst = new Chart(document.getElementById('modLineChart').getContext('2d'), { 
        type: 'line', 
        data: { 
            labels: mKeys, 
            datasets: [
                { label: 'กำไร/ส่วนต่าง', data: mProfData, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true, tension: 0.3 }
            ] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    // 3. Pie Chart (สัดส่วนรายรับ)
    if(modPieIncInst) modPieIncInst.destroy();
    modPieIncInst = new Chart(document.getElementById('modPieInc').getContext('2d'), { 
        type: 'doughnut', 
        data: { 
            labels: Object.keys(pInc), 
            datasets: [{ data: Object.values(pInc), backgroundColor: ['#22c55e','#10b981','#84cc16','#eab308']}] 
        }, 
        options: { responsive: true, maintainAspectRatio: false } 
    });

    // 4. Pie Chart (สัดส่วนรายจ่าย)
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
// --- ระบบจัดการฟอร์ม และ CRUD ---
// ==========================================

function toggleEvi() {
    if(document.getElementById('f_eviType').value === 'file') {
        document.getElementById('f_file').classList.remove('hidden');
        document.getElementById('f_link').classList.add('hidden');
    } else {
        document.getElementById('f_file').classList.add('hidden');
        document.getElementById('f_link').classList.remove('hidden');
    }
}

function getBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); 
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.replace(/^data:(.*,)?/, ''));
        reader.onerror = error => reject(error);
    });
}

async function submitForm(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); 
    btn.innerText = 'กำลังบันทึก...'; 
    btn.disabled = true;

    let payload = {
        module: currentModule, 
        username: currentUser.username, 
        rowIndex: document.getElementById('f_id').value,
        date: document.getElementById('f_date').value, 
        type: document.getElementById('f_type').value,
        item: document.getElementById('f_item').value, 
        method: document.getElementById('f_method').value,
        amount: document.getElementById('f_amount').value, 
        note: document.getElementById('f_note').value
    };

    if(document.getElementById('f_eviType').value === 'file') {
        const f = document.getElementById('f_file').files[0];
        if(f) {
            // เช็คขนาดไฟล์ไม่ให้เกิน 5MB ป้องกันระบบค้าง
            if(f.size > 5242880) { 
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
            fetchData(); // รีเฟรชข้อมูลตาราง
        } else {
            Swal.fire('ผิดพลาด', res.message, 'error');
        }
    } catch (err) { 
        Swal.fire('Error', 'ไม่สามารถเชื่อมต่อระบบหลังบ้านได้', 'error'); 
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
    document.getElementById('f_item').value = r.item;
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
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'ลบเลย', 
        cancelButtonText: 'ยกเลิก' 
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const res = await (await fetch(CONFIG.API_URL, { 
                    method: 'POST', 
                    body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) 
                })).json();
                
                if(res.status === 'success') {
                    Swal.fire({title: 'ลบข้อมูลสำเร็จ!', icon: 'success', timer: 1500, showConfirmButton: false});
                    fetchData(); // รีเฟรชตาราง
                } else {
                    Swal.fire('ผิดพลาด', res.message, 'error');
                }
            } catch (err) {
                Swal.fire('Error', 'เชื่อมต่อระบบล้มเหลว', 'error');
            }
        }
    });
}

// ควบคุมการแสดงผล Modal
function openModal() { 
    document.getElementById('txModal').classList.remove('hidden'); 
    document.body.classList.add('overflow-hidden'); // ป้องกันการไถลฉากหลัง
}

function closeModal() { 
    document.getElementById('txModal').classList.add('hidden'); 
    document.body.classList.remove('overflow-hidden'); 
    document.getElementById('txForm').reset(); 
    document.getElementById('f_id').value = ''; 
    document.getElementById('modalFormTitle').innerText = 'บันทึกรายการใหม่';
    document.getElementById('f_eviType').value = 'file';
    toggleEvi();
}

function logout() { 
    sessionStorage.removeItem('user'); 
    window.location.href = 'index.html'; 
}
