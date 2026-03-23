let currentUser = JSON.parse(sessionStorage.getItem('user'));
if (!currentUser) window.location.href = 'index.html'; 

let currentModule = 'Overview';
let rawData = [];

// กำหนดหัวข้อและคำอธิบายการ์ดให้ตรงตามบริบทของแต่ละฝ่าย
const moduleLabels = {
    Fund: { title: 'บัญชีหลัก: กองทุนเพื่อผู้ป่วยจิตเวชยากไร้', c1: 'ยอดยกมา / รับเข้า', c2: 'จ่ายออก / สนับสนุน', c3: 'ส่วนต่างเงินทุน', c4: 'คงเหลือในบัญชี' },
    Cafe: { title: 'หน่วยลงทุน: ร้านกาแฟสุขใจ', c1: 'ยอดขาย / รายรับ', c2: 'ต้นทุน / ค่าใช้จ่าย', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' },
    Shop: { title: 'หน่วยลงทุน: ร้านผลิตภัณฑ์ผู้ป่วย', c1: 'ยอดขาย / รายรับ', c2: 'ต้นทุน / ค่าใช้จ่าย', c3: 'กำไรสุทธิ', c4: 'เงินสดหมุนเวียน' }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userDisplay').innerText = `ผู้ใช้งาน: ${currentUser.username} (${currentUser.role})`;
    switchModule('Overview'); 
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('mobileOverlay').classList.toggle('hidden');
}

function switchModule(mod) {
    currentModule = mod;
    
    document.querySelectorAll('aside nav button').forEach(b => { 
        b.classList.remove('bg-blue-600'); b.classList.add('hover:bg-slate-700'); 
    });
    document.getElementById(`nav-${mod}`).classList.add('bg-blue-600');
    document.getElementById(`nav-${mod}`).classList.remove('hover:bg-slate-700');

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

async function fetchOverview() {
    Swal.showLoading();
    try {
        const res = await (await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_overview' }) })).json();
        if (res.status === 'success') {
            const fmt = n => `฿${Number(n).toLocaleString('th-TH')}`;
            document.getElementById('o_fundBal').innerText = fmt(res.data.fund.bal);
            document.getElementById('o_fundInc').innerText = fmt(res.data.fund.inc);
            document.getElementById('o_fundExp').innerText = fmt(res.data.fund.exp);
            document.getElementById('o_cafeBal').innerText = fmt(res.data.cafe.bal);
            document.getElementById('o_shopBal').innerText = fmt(res.data.shop.bal);
            Swal.close();
        }
    } catch (err) { Swal.fire('Error', 'ไม่สามารถโหลดภาพรวมได้', 'error'); }
}

async function fetchData() {
    document.getElementById('tableBody').innerHTML = '<tr><td colspan="6" class="p-4 text-center py-10"><i class="fa-solid fa-spinner fa-spin text-blue-500 text-3xl mb-2"></i><br>กำลังโหลด...</td></tr>';
    try {
        const res = await (await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_data', payload: { module: currentModule } }) })).json();
        if (res.status === 'success') { rawData = res.data; renderData(); }
    } catch (err) { Swal.fire('Error', 'โหลดข้อมูลล้มเหลว', 'error'); }
}

function renderData() {
    const tb = document.getElementById('tableBody'); tb.innerHTML = '';
    let inc = 0, exp = 0;
    
    if (rawData.length === 0) return tb.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 bg-slate-50">ไม่มีข้อมูลในระบบ</td></tr>';

    rawData.forEach(r => {
        if(r.type === 'รายรับ') inc += Number(r.amount); else exp += Number(r.amount);
        
        let eviHtml = r.evidence ? `<a href="${r.evidence}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 text-xs font-medium"><i class="fa-solid fa-file-pdf"></i> ดูไฟล์</a>` : '<span class="text-slate-300">-</span>';
        
        let actionHtml = '<span class="text-slate-300 text-xs">ดูได้อย่างเดียว</span>';
        if (currentUser.role === 'God_Admin' || currentUser.role === `Admin_${currentModule}`) {
            actionHtml = `
                <div class="flex justify-center gap-2">
                    <button onclick='editTx(${JSON.stringify(r)})' class="w-8 h-8 rounded-full bg-amber-50 text-amber-500 hover:bg-amber-100 transition"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteTx('${r.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        }

        tb.innerHTML += `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                <td class="p-3 md:p-4 whitespace-nowrap">${r.date}</td>
                <td class="p-3 md:p-4 whitespace-nowrap"><span class="px-2.5 py-1 text-xs font-medium rounded-full ${r.type==='รายรับ'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${r.type}</span></td>
                <td class="p-3 md:p-4 min-w-[150px]"><p class="font-medium text-slate-800">${r.item}</p><p class="text-xs text-slate-500 mt-0.5">${r.method !== '-' ? r.method : ''} ${r.note ? `(${r.note})` : ''}</p></td>
                <td class="p-3 md:p-4 text-right font-semibold ${r.type==='รายรับ'?'text-green-600':'text-red-600'}">฿${Number(r.amount).toLocaleString('th-TH')}</td>
                <td class="p-3 md:p-4 text-center whitespace-nowrap">${eviHtml}</td>
                <td class="p-3 md:p-4 text-center">${actionHtml}</td>
            </tr>`;
    });

    const fmt = n => `฿${Number(n).toLocaleString('th-TH')}`;
    document.getElementById('c_card1').innerText = fmt(inc);
    document.getElementById('c_card2').innerText = fmt(exp);
    document.getElementById('c_card3').innerText = fmt(inc - exp);
    document.getElementById('c_card4').innerText = fmt(inc - exp);
}

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
    const btn = document.getElementById('btnSave'); btn.innerText = 'กำลังบันทึก...'; btn.disabled = true;

    let payload = {
        module: currentModule, username: currentUser.username, rowIndex: document.getElementById('f_id').value,
        date: document.getElementById('f_date').value, type: document.getElementById('f_type').value,
        item: document.getElementById('f_item').value, method: document.getElementById('f_method').value,
        amount: document.getElementById('f_amount').value, note: document.getElementById('f_note').value
    };

    if(document.getElementById('f_eviType').value === 'file') {
        const f = document.getElementById('f_file').files[0];
        if(f) {
            if(f.size > 5242880) { Swal.fire('ผิดพลาด', 'ไฟล์ขนาดเกิน 5MB', 'warning'); btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; return; }
            payload.fileBase64 = await getBase64(f); payload.fileName = f.name; payload.fileMimeType = f.type;
        }
    } else payload.evidenceLink = document.getElementById('f_link').value;

    try {
        const res = await (await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'save_tx', payload }) })).json();
        if (res.status === 'success') { Swal.fire({title: 'สำเร็จ', text: res.message, icon: 'success', timer: 1500, showConfirmButton: false}); closeModal(); switchModule(currentModule); }
        else Swal.fire('ผิดพลาด', res.message, 'error');
    } catch (err) { Swal.fire('Error', 'ไม่สามารถเชื่อมต่อได้', 'error'); }
    finally { btn.innerText = 'บันทึกข้อมูล'; btn.disabled = false; }
}

function editTx(r) {
    document.getElementById('modalFormTitle').innerText = 'แก้ไขรายการ';
    document.getElementById('f_id').value = r.id; document.getElementById('f_date').value = r.date;
    document.getElementById('f_type').value = r.type; document.getElementById('f_item').value = r.item;
    document.getElementById('f_method').value = r.method; document.getElementById('f_amount').value = r.amount;
    document.getElementById('f_note').value = r.note; openModal();
}

function deleteTx(id) {
    Swal.fire({ title: 'ยืนยันการลบ?', text: "ข้อมูลที่ลบจะไม่สามารถกู้คืนได้", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#94a3b8', confirmButtonText: 'ใช่, ลบเลย', cancelButtonText: 'ยกเลิก' })
    .then(async (result) => {
        if (result.isConfirmed) {
            const res = await (await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'delete_tx', payload: { module: currentModule, rowIndex: id } }) })).json();
            if(res.status === 'success') { Swal.fire({title: 'ลบแล้ว!', icon: 'success', timer: 1500, showConfirmButton: false}); switchModule(currentModule); } 
            else Swal.fire('ผิดพลาด', res.message, 'error');
        }
    });
}

function openModal() { document.getElementById('txModal').classList.remove('hidden'); document.body.classList.add('overflow-hidden'); }
function closeModal() { document.getElementById('txModal').classList.add('hidden'); document.body.classList.remove('overflow-hidden'); document.getElementById('txForm').reset(); document.getElementById('f_id').value = ''; document.getElementById('modalFormTitle').innerText = 'บันทึกรายการใหม่'; document.getElementById('f_eviType').value = 'file'; toggleEvi(); }
function logout() { sessionStorage.removeItem('user'); window.location.href = 'index.html'; }
