// FILE script.js LENGKAP DENGAN PERUBAHAN

const firebaseConfig = {
  apiKey: "AIzaSyDA_T-LRjANUHG1ZLqKG1vwD_Wu9hpzWz4",
  authDomain: "statuspembayaran-b7a1f.firebaseapp.com",
  databaseURL: "https://statuspembayaran-b7a1f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "statuspembayaran-b7a1f",
  storageBucket: "statuspembayaran-b7a1f.firebasestorage.app",
  messagingSenderId: "619692483603",
  appId: "1:619692483603:web:b6c37409717b8ca89bcbe6",
  measurementId: "G-28H2HJGVTC"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxI2Ma8oK6s039PZyS0cIAY5T-70eo9Jp0PofnhBBCtN5SXrfjEeX9_chOeWx_feihmdw/exec';

const kategoriAkunSelect = document.getElementById('kategoriAkun');
const jumlahAkunInput = document.getElementById('jumlahAkun');
const totalHargaDisplay = document.getElementById('totalHargaDisplay');
const jumlahAkunError = document.getElementById('jumlahAkunError');
const tombolProsesBayar = document.getElementById('tombolProsesBayar');

const orderFormContainer = document.getElementById('orderFormContainer');
const paymentSection = document.getElementById('paymentSection');
const paymentNominalDisplay = document.getElementById('paymentNominalDisplay');
const qrisImage = document.getElementById('qrisImage');
const transactionInfo = document.getElementById('transactionInfo');
const paymentStatusDisplay = document.getElementById('paymentStatusDisplay');
const autoLastChecked = document.getElementById('autoLastChecked');
const refreshWarning = document.getElementById('refreshWarning');

const STATIC_QRIS_IMAGE_URL = "https://raw.githubusercontent.com/rasyaacc/Payment-Rasya/276cbd093d09cc76fcdc68b049de91b195a3953c/Qris-SP.jpeg";

const hargaPerBlok = 100000; // Harga ini berlaku untuk kategori yang tersedia
const ukuranBlok = 3;
const STATUS_BERHASIL_DARI_SHEET = "Lunas";

let currentActiveTransactionId = null;
let activePaymentStatusRef = null;
let beforeUnloadListenerAdded = false;

function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = '';
    return 'Apakah Anda yakin ingin meninggalkan halaman ini? Proses pembayaran mungkin belum selesai.';
}

function addBeforeUnloadListener() {
    if (!beforeUnloadListenerAdded) {
        window.addEventListener('beforeunload', handleBeforeUnload);
        beforeUnloadListenerAdded = true;
    }
}

function removeBeforeUnloadListener() {
    if (beforeUnloadListenerAdded) {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        beforeUnloadListenerAdded = false;
    }
}

function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function perbaruiTotalHarga() {
    const kategoriTerpilih = kategoriAkunSelect.value;
    jumlahAkunError.textContent = ''; // Selalu bersihkan error di awal

    // Reset tampilan total harga dari status "Stok Kosong" jika ada
    totalHargaDisplay.classList.remove('stok-kosong');
    // Kembalikan warna default (akan diambil dari CSS #totalHargaDisplay)
    // Jika Anda mengatur warna default langsung di #totalHargaDisplay di CSS, baris di bawah ini mungkin tidak perlu
    // totalHargaDisplay.style.color = ''; // Atau set ke warna default spesifik jika perlu

    if (kategoriTerpilih === "1000_followers") {
        totalHargaDisplay.textContent = "Stok Kosong";
        totalHargaDisplay.classList.add('stok-kosong'); // Tambahkan kelas untuk styling khusus
        tombolProsesBayar.disabled = true;
        // jumlahAkunInput.value = ''; // Opsional: kosongkan jumlah akun jika stok kosong
        return; // Keluar dari fungsi, tidak perlu kalkulasi harga
    }

    // Jika bukan "1000_followers", lanjutkan dengan validasi dan kalkulasi harga
    const jumlah = parseInt(jumlahAkunInput.value);

    if (isNaN(jumlah) && jumlahAkunInput.value !== "") {
        jumlahAkunError.textContent = 'Masukkan angka yang valid.';
        totalHargaDisplay.textContent = formatRupiah(0);
        tombolProsesBayar.disabled = true;
        return;
    }
    if (jumlahAkunInput.value === "" || isNaN(jumlah)) {
        totalHargaDisplay.textContent = formatRupiah(0);
        tombolProsesBayar.disabled = true;
        return;
    }
    if (jumlah < ukuranBlok) {
        jumlahAkunError.textContent = `Jumlah minimal adalah ${ukuranBlok} akun.`;
        totalHargaDisplay.textContent = formatRupiah(0);
        tombolProsesBayar.disabled = true;
        return;
    }
    if (jumlah % ukuranBlok !== 0) {
        jumlahAkunError.textContent = `Jumlah harus dalam kelipatan ${ukuranBlok}.`;
        totalHargaDisplay.textContent = formatRupiah(0);
        tombolProsesBayar.disabled = true;
        return;
    }

    // Kalkulasi harga hanya untuk kategori yang tersedia (misal "300_followers")
    // Jika ada harga berbeda per kategori, logika bisa ditambahkan di sini
    const totalHarga = (jumlah / ukuranBlok) * hargaPerBlok;
    totalHargaDisplay.textContent = formatRupiah(totalHarga);
    tombolProsesBayar.disabled = false;
}

function generateTransactionId() {
    const d = new Date();
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    const hours = ('0' + d.getHours()).slice(-2);
    const minutes = ('0' + d.getMinutes()).slice(-2);
    const seconds = ('0' + d.getSeconds()).slice(-2);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TRX${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

async function kirimPesananKeSheet(payload) {
    tombolProsesBayar.disabled = true;
    tombolProsesBayar.textContent = "Memproses...";
    try {
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                 'Content-Type': 'text/plain;charset=UTF-8',
            },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        tombolProsesBayar.disabled = false;
        tombolProsesBayar.textContent = "Lanjut ke Pembayaran";

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gagal menghubungi server Apps Script: ${response.status} ${response.statusText}. Detail: ${errorText}`);
        }

        const resultText = await response.text();
        let result;
        try {
            result = JSON.parse(resultText);
        } catch (e) {
            if (resultText.toLowerCase().includes("script function not found")) {
                 throw new Error(`Fungsi doPost tidak ditemukan atau tidak di-deploy dengan benar di Google Apps Script.`);
            }
            throw new Error(`Respons dari server tidak valid (bukan JSON): ${resultText.substring(0, 200)}...`);
        }

        if (result.status === "success" && result.transactionId) {
            return result.transactionId;
        } else {
            throw new Error(result.message || 'Gagal membuat transaksi di sheet.');
        }
    } catch (error) {
        alert(`Terjadi kesalahan saat mencatat pesanan: ${error.message}`);
        tombolProsesBayar.disabled = false;
        tombolProsesBayar.textContent = "Lanjut ke Pembayaran";
        return null;
    }
}

tombolProsesBayar.addEventListener('click', async function() {
    if (tombolProsesBayar.disabled) return;
    // Tambahan: Cek lagi kategori sebelum proses, untuk jaga-jaga
    if (kategoriAkunSelect.value === "1000_followers") {
        alert("Kategori yang dipilih saat ini stoknya kosong.");
        return;
    }

    const kategoriText = kategoriAkunSelect.options[kategoriAkunSelect.selectedIndex].text;
    const jumlah = parseInt(jumlahAkunInput.value);
    const harga = (jumlah / ukuranBlok) * hargaPerBlok;
    const generatedId = generateTransactionId();

    const pesanan = {
        transactionId: generatedId,
        kategori: kategoriText,
        jumlah: jumlah,
        totalHarga: harga,
        statusAwal: "Menunggu Pembayaran",
        timestampPesan: new Date().toISOString()
    };

    const idTransaksiDariSheet = await kirimPesananKeSheet(pesanan);

    if (idTransaksiDariSheet) {
        currentActiveTransactionId = idTransaksiDariSheet;

        orderFormContainer.style.display = 'none';
        paymentSection.style.display = 'block';

        paymentNominalDisplay.textContent = formatRupiah(harga);
        qrisImage.src = STATIC_QRIS_IMAGE_URL;
        
        transactionInfo.innerHTML = `ID Transaksi Anda:<br>
                                     <strong>${currentActiveTransactionId}</strong>
                                     <div class="transaction-description">Harap selesaikan pembayaran dan simpan ID ini. Status akan terupdate otomatis di bawah.</div>`;
        
        paymentStatusDisplay.textContent = 'Menunggu Pembayaran...';
        paymentStatusDisplay.className = 'paymentStatusDisplay status-pending';
        refreshWarning.style.display = 'block';
        addBeforeUnloadListener();
        mulaiMendengarkanStatusPembayaran(currentActiveTransactionId);
    }
});

function mulaiMendengarkanStatusPembayaran(transactionId) {
    if (activePaymentStatusRef) {
        activePaymentStatusRef.off();
    }
    const path = `pembayaran/${transactionId}`;
    activePaymentStatusRef = database.ref(path);

    activePaymentStatusRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const timestamp = new Date();
        autoLastChecked.textContent = 'Status dicek: ' + timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (data && data.status) {
            if (data.status.trim().toLowerCase() === STATUS_BERHASIL_DARI_SHEET.trim().toLowerCase()) {
                paymentStatusDisplay.textContent = 'Pembayaran Berhasil!';
                paymentStatusDisplay.className = 'paymentStatusDisplay status-success';
                refreshWarning.style.display = 'none';
                removeBeforeUnloadListener();
                if(activePaymentStatusRef) activePaymentStatusRef.off();
            } else {
                paymentStatusDisplay.textContent = `Status: ${data.status}`;
                paymentStatusDisplay.className = 'paymentStatusDisplay status-pending';
                refreshWarning.style.display = 'block'; // Pastikan warning tetap ada jika status belum berhasil
                addBeforeUnloadListener();
            }
        } else if (paymentStatusDisplay.textContent.includes("Menunggu Pembayaran")) {
             // Kondisi awal, warning sudah seharusnya tampil
            refreshWarning.style.display = 'block';
            addBeforeUnloadListener();
        } else {
            // Jika tidak ada data status sama sekali setelah proses pembayaran dimulai
            paymentStatusDisplay.textContent = 'Data transaksi tidak ditemukan/belum update.';
            paymentStatusDisplay.className = 'paymentStatusDisplay status-notfound';
            refreshWarning.style.display = 'block';
            addBeforeUnloadListener();
        }
    }, (error) => {
        console.error("Firebase read error:", error);
        paymentStatusDisplay.textContent = 'Gagal mengambil status dari Firebase.';
        paymentStatusDisplay.className = 'paymentStatusDisplay status-error';
        refreshWarning.style.display = 'block';
        addBeforeUnloadListener();
    });
}

// --- TAMBAHKAN EVENT LISTENER UNTUK SELECT KATEGORI ---
kategoriAkunSelect.addEventListener('change', perbaruiTotalHarga);
// --- AKHIR PENAMBAHAN EVENT LISTENER ---

jumlahAkunInput.addEventListener('input', perbaruiTotalHarga);
window.onload = () => {
    perbaruiTotalHarga(); // Panggil saat halaman dimuat pertama kali
    if (paymentSection.style.display === 'block' && !paymentStatusDisplay.textContent.includes('Pembayaran Berhasil!')) {
         refreshWarning.style.display = 'block';
         addBeforeUnloadListener();
    } else {
         refreshWarning.style.display = 'none';
    }
};
