/**
 * Dilara & Çağrı - Karşılıklı Mektup Kutusu & Veritabanı Motoru
 * - İki Kişilik Profil Sistemi (Çağrı / Dilara)
 * - Mühürlü Gelen Mektuplar & Açma Animasyonu
 * - Yeni Mektup Yazma & Mühürleyip Gönderme
 * - Mektup Sandığı (Tüm Mektuplar Arşivi)
 * - 4 Nisan 2026 Canlı Aşk Sayacı
 * - Yerel & Bulut Senkronizasyon Altyapısı
 */

// ===================================================================
// 1. BAŞLANGIÇ VERİLERİ & MEKTUP VERİTABANI
// ===================================================================
const DEFAULT_LETTERS = [
  {
    id: "letter_1",
    from: "Çağrı",
    to: "Dilara",
    date: "4 Nisan 2026",
    title: "İlk Mektubum: İyi ki Geldin 💜",
    salutation: "Sevgilim Dilara,",
    body: `<p>4 Nisan 2026... Hayatımın en güzel, en huzurlu dönüm noktası seninle tanıştığım o gün oldu.</p><p>Gözlerinin içine her baktığımda, bana hissettirdiğin o derin güveni ve kalbimin ritmini değiştiren gülüşünü görüyorum. Bu mektup kutusu bizim küçük aşk dünyamız olsun; birbirimize söylemek istediğimiz tüm güzel duyguları buraya mühürleyelim.</p><p>İyi ki varsın, iyi ki hayatımdasın. Seni çok seviyorum...</p>`,
    signature: "Çağrı",
    isRead: false,
    createdAt: new Date("2026-04-04T12:00:00").getTime()
  }
];

let currentUser = null; // 'Çağrı' veya 'Dilara'
let letters = [];
let currentOpenLetter = null;
let coupleKey = localStorage.getItem("couple_sync_key") || "dilara-cagri-0404";

// ── Supabase Bağlantısı (REST API — SDK gerektirmez) ──────────────────
const SUPABASE_URL = "https://ghzzzinpxbvxegnxkfvl.supabase.co";
const SUPABASE_KEY = "sb_publishable_UgaF4znQ1PdYuc9VQzn_Xg_HVy63RSf";
const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation"
};

async function sbFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...SB_HEADERS, ...(options.headers || {}) }
  });
}

async function fetchFromSupabase() {
  try {
    const res = await sbFetch("/letters?order=created_at.desc");
    if (!res.ok) return;
    const data = await res.json();
    letters = data.map(row => ({
      id: row.id,
      from: row.sender,
      to: row.recipient,
      date: new Date(row.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
      title: row.title,
      salutation: row.salutation,
      body: row.body,
      signature: row.signature,
      isRead: row.is_read,
      createdAt: new Date(row.created_at).getTime()
    }));
    localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
    updateUI();
    const label = document.getElementById("cloudStatusLabel");
    if (label) label.textContent = "Supabase ✓";
  } catch (e) {}
}

async function insertToSupabase(letter) {
  try {
    const res = await sbFetch("/letters", {
      method: "POST",
      body: JSON.stringify({
        sender: letter.from,
        recipient: letter.to,
        title: letter.title,
        salutation: letter.salutation,
        body: letter.body,
        signature: letter.signature,
        is_read: false
      })
    });
    if (res.ok) {
      fetchFromSupabase();
    }
  } catch (e) {}
}

async function markReadInSupabase(id) {
  try {
    await sbFetch(`/letters?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_read: true })
    });
  } catch (e) {}
}

function loadDatabase() {
  const savedLetters = localStorage.getItem("couple_letters_db_v1");
  if (savedLetters) {
    try { letters = JSON.parse(savedLetters); } catch (e) { letters = []; }
  }

  const savedUser = localStorage.getItem("couple_active_user");
  if (savedUser && (savedUser === "Çağrı" || savedUser === "Dilara")) {
    setUser(savedUser);
  } else {
    showProfileSelection();
  }

  // Supabase'den canlı verileri çek
  fetchFromSupabase();
  // 10 saniyede bir otomatik güncelle
  setInterval(fetchFromSupabase, 10000);
}

function saveDatabase() {
  localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
  updateUI();
}

// ===================================================================
// 2. KULLANICI / PROFİL SEÇİMİ
// ===================================================================
const profileScreen = document.getElementById("profileScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const currentUserNameEl = document.getElementById("currentUserName");
const userPill = document.getElementById("userPill");

function showProfileSelection() {
  profileScreen.classList.remove("hidden");
  dashboardScreen.classList.add("hidden");
  currentUserNameEl.textContent = "Giriş Yapılmadı";
}

function selectUser(name) {
  setUser(name);
  localStorage.setItem("couple_active_user", name);
}

function setUser(name) {
  currentUser = name;
  currentUserNameEl.textContent = name;
  profileScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");

  // Yazma ekranındaki alıcı ve imza alanlarını güncelle
  const partnerName = name === "Çağrı" ? "Dilara" : "Çağrı";
  document.getElementById("writeRecipientName").textContent = partnerName;
  document.getElementById("composeSalutation").value = `Sevgilim ${partnerName},`;
  document.getElementById("composeSignature").value = name;

  // Güncel tarihi ayarla
  const today = new Date();
  const dateStr = today.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("composeCurrentDate").textContent = dateStr;

  updateUI();
}

userPill.addEventListener("click", () => {
  if (confirm("Profili değiştirmek veya çıkış yapmak istiyor musunuz?")) {
    showProfileSelection();
  }
});

// ===================================================================
// 3. SEKMELER (TABS) & ARAYÜZ GÜNCELLEME
// ===================================================================
let activeTab = "inbox";

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.add("hidden"));

  if (tabName === "inbox") {
    document.getElementById("tabInbox").classList.add("active");
    document.getElementById("contentInbox").classList.remove("hidden");
    renderInbox();
  } else if (tabName === "write") {
    document.getElementById("tabWrite").classList.add("active");
    document.getElementById("contentWrite").classList.remove("hidden");
  } else if (tabName === "archive") {
    document.getElementById("tabArchive").classList.add("active");
    document.getElementById("contentArchive").classList.remove("hidden");
    renderArchive();
  }
}

function updateUI() {
  if (!currentUser) return;

  // Bana gelen okunmamış mektup sayısı
  const unreadCount = letters.filter(l => l.to === currentUser && !l.isRead).length;
  const unreadBadge = document.getElementById("unreadBadge");
  if (unreadBadge) {
    if (unreadCount > 0) {
      unreadBadge.textContent = unreadCount;
      unreadBadge.classList.remove("hidden");
    } else {
      unreadBadge.classList.add("hidden");
    }
  }

  if (activeTab === "inbox") renderInbox();
  else if (activeTab === "archive") renderArchive();
}

// ===================================================================
// 4. GELEN KUTUSU (GELEN MÜHÜRLÜ MEKTUBU AÇMA)
// ===================================================================
const inboxEnvelopeView = document.getElementById("inboxEnvelopeView");
const inboxLetterView = document.getElementById("inboxLetterView");
const inboxEmptyState = document.getElementById("inboxEmptyState");
const inboxEnvelopeTrigger = document.getElementById("inboxEnvelopeTrigger");

function renderInbox() {
  if (!currentUser) return;
  const partnerName = currentUser === "Çağrı" ? "Dilara" : "Çağrı";

  // Bana gelen mektuplar (en yeni en başta)
  const incomingLetters = letters
    .filter(l => l.to === currentUser)
    .sort((a, b) => b.createdAt - a.createdAt);

  // Önce okunmamış mektubu göster, yoksa en son gelen mektubu
  const unreadLetter = incomingLetters.find(l => !l.isRead);
  const letterToShow = unreadLetter || incomingLetters[0];

  if (!letterToShow) {
    // Hiç mektup yok
    inboxEnvelopeView.classList.add("hidden");
    inboxLetterView.classList.add("hidden");
    inboxEmptyState.classList.remove("hidden");
    document.getElementById("emptyInboxText").textContent = `${partnerName} henüz yeni bir mektup göndermedi. Ona güzel bir mektup yazmak ister misin?`;
    return;
  }

  inboxEmptyState.classList.add("hidden");
  currentOpenLetter = letterToShow;

  if (!letterToShow.isRead) {
    // Okunmamış: Kapalı zarfı göster
    inboxEnvelopeView.classList.remove("hidden");
    inboxLetterView.classList.add("hidden");
    inboxEnvelopeTrigger.classList.remove("opened");

    document.getElementById("envSenderSubtitle").textContent = `${partnerName}'dan Sana Bir Mektup Var`;
    document.getElementById("envMainTitle").textContent = letterToShow.title || "Yeni Bir Aşk Mektubu";
  } else {
    // Zaten okunmuş: Doğrudan açık mektubu göster
    inboxEnvelopeView.classList.add("hidden");
    displayOpenLetter(letterToShow);
  }
}

function displayOpenLetter(letter) {
  inboxLetterView.classList.remove("hidden");
  document.getElementById("letterSenderTag").textContent = `${letter.from}'dan`;
  document.getElementById("letterDateTag").textContent = letter.date;
  document.getElementById("letterTitleDisplay").textContent = letter.title;
  document.getElementById("letterContentDisplay").innerHTML = letter.body;
  document.getElementById("letterAuthorDisplay").textContent = letter.signature || letter.from;
}

// Zarf Açma & Mührü Kırma Etkileşimi
inboxEnvelopeTrigger.addEventListener("click", () => {
  if (!currentOpenLetter) return;

  playSubtleChime();
  inboxEnvelopeTrigger.classList.add("opened");

  // Melodiyi başlat
  setTimeout(() => {
    if (!isAudioPlaying) toggleAudio();
  }, 400);

  // Mektubu okundu olarak işaretle
  setTimeout(() => {
    currentOpenLetter.isRead = true;
    saveDatabase();
    if (currentOpenLetter.id) markReadInSupabase(currentOpenLetter.id);

    inboxEnvelopeView.style.opacity = "0";
    inboxEnvelopeView.style.transform = "scale(0.95)";

    setTimeout(() => {
      inboxEnvelopeView.classList.add("hidden");
      inboxEnvelopeView.style.opacity = "1";
      inboxEnvelopeView.style.transform = "none";
      displayOpenLetter(currentOpenLetter);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 400);
  }, 900);
});

function startReply() {
  switchTab("write");
  if (currentOpenLetter) {
    document.getElementById("composeTitle").value = `Cevap: ${currentOpenLetter.title}`;
  }
}

// ===================================================================
// 5. YENİ MEKTUP YAZMA & MÜHÜRLEYİP GÖNDERME
// ===================================================================
async function handleSendLetter(event) {
  event.preventDefault();
  if (!currentUser) return;

  const partnerName = currentUser === "Çağrı" ? "Dilara" : "Çağrı";
  const title = document.getElementById("composeTitle").value.trim();
  const salutation = document.getElementById("composeSalutation").value.trim();
  const rawBody = document.getElementById("composeBody").value.trim();
  const signature = document.getElementById("composeSignature").value.trim();

  // Paragraflara ayır
  const formattedBody = rawBody
    .split("\n\n")
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const today = new Date();
  const dateStr = today.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  const newLetter = {
    from: currentUser,
    to: partnerName,
    date: dateStr,
    title: title,
    salutation: salutation,
    body: `<p><em>${salutation}</em></p>` + formattedBody,
    signature: signature,
    isRead: false,
    createdAt: Date.now()
  };

  // Supabase'e kaydet
  await insertToSupabase(newLetter);

  playSubtleChime();
  alert(`Mektubun mühürlendi ve ${partnerName}'ya başarıyla gönderildi! 💜`);

  // Formu temizle ve Sandığa geç
  document.getElementById("composeTitle").value = "";
  document.getElementById("composeBody").value = "";
  switchTab("archive");
}

// ===================================================================
// 6. MEKTUP SANDIĞI (ARŞİV LİSTESİ)
// ===================================================================
function renderArchive() {
  const archiveList = document.getElementById("archiveList");
  if (!archiveList) return;

  archiveList.innerHTML = "";

  if (letters.length === 0) {
    archiveList.innerHTML = `<div class="empty-state"><p>Sandıkta henüz hiç mektup yok.</p></div>`;
    return;
  }

  // En yeni mektup en başta
  const sorted = [...letters].sort((a, b) => b.createdAt - a.createdAt);

  sorted.forEach(letter => {
    const card = document.createElement("div");
    card.className = "archive-card";
    
    const isReceived = letter.to === currentUser;
    const statusTag = !letter.isRead && isReceived ? `<span class="archive-badge unread">Okunmamış ✉️</span>` : `<span class="archive-badge">Okundu ✓</span>`;

    card.innerHTML = `
      <div class="archive-info">
        <span class="archive-sender">${letter.from} ➔ ${letter.to}</span>
        <h4 class="archive-title">${letter.title}</h4>
        <span class="archive-date">${letter.date}</span>
      </div>
      <div class="archive-status">
        ${statusTag}
      </div>
    `;

    card.onclick = () => {
      // Arşivdeki bir mektuba tıklandığında okuma ekranına git
      currentOpenLetter = letter;
      switchTab("inbox");
      inboxEnvelopeView.classList.add("hidden");
      displayOpenLetter(letter);
    };

    archiveList.appendChild(card);
  });
}

// ===================================================================
// 7. CANLI AŞK SAYACI (4 Nisan 2026)
// ===================================================================
const START_DATE = new Date("2026-04-04T00:00:00");

function updateTimer() {
  const now = new Date();
  let diff = now - START_DATE;
  if (diff < 0) diff = 0;

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const dEl = document.getElementById("cntDays");
  const hEl = document.getElementById("cntHours");
  const mEl = document.getElementById("cntMinutes");
  const sEl = document.getElementById("cntSeconds");

  if (dEl) dEl.textContent = days;
  if (hEl) hEl.textContent = hours;
  if (mEl) mEl.textContent = minutes;
  if (sEl) sEl.textContent = seconds < 10 ? "0" + seconds : seconds;
}

setInterval(updateTimer, 1000);
updateTimer();

// ===================================================================
// 8. VERİTABANI DURUM GÖSTERGESİ
// ===================================================================
const cloudModal = document.getElementById("cloudModal");
const cloudSettingsBtn = document.getElementById("cloudSettingsBtn");

function openCloudModal() { cloudModal.classList.add("active"); }
function closeCloudModal() { cloudModal.classList.remove("active"); }

if (cloudSettingsBtn) cloudSettingsBtn.addEventListener("click", openCloudModal);

function saveCloudSettings() {
  closeCloudModal();
  fetchFromSupabase();
}




// ===================================================================
// 9. SES & AMBİYANS PİYANO MOTORU (Web Audio API)
// ===================================================================
let audioCtx = null;
let isAudioPlaying = false;
let audioTimer = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playSubtleChime() {
  try {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.3); // C6

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  } catch (e) {}
}

const PIANO_PROGRESSION = [
  [261.63, 329.63, 392.00, 493.88], // Cmaj7
  [220.00, 261.63, 329.63, 392.00], // Am7
  [174.61, 220.00, 261.63, 329.63], // Fmaj7
  [196.00, 246.94, 293.66, 392.00]  // G7
];

let progStep = 0;

function playAmbientChord() {
  if (!isAudioPlaying || !audioCtx) return;
  const now = audioCtx.currentTime;
  const chord = PIANO_PROGRESSION[progStep % PIANO_PROGRESSION.length];
  progStep++;

  chord.forEach((freq, i) => {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.35);

      gain.gain.setValueAtTime(0.0001, now + i * 0.35);
      gain.gain.linearRampToValueAtTime(0.04, now + i * 0.35 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.35 + 3.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now + i * 0.35);
      osc.stop(now + i * 0.35 + 4.0);
    } catch (e) {}
  });
}

function toggleAudio() {
  initAudio();
  const btn = document.getElementById("audioToggleBtn");

  if (!isAudioPlaying) {
    isAudioPlaying = true;
    btn.classList.add("active");
    playAmbientChord();
    audioTimer = setInterval(playAmbientChord, 2800);
  } else {
    isAudioPlaying = false;
    btn.classList.remove("active");
    if (audioTimer) clearInterval(audioTimer);
  }
}

document.getElementById("audioToggleBtn").addEventListener("click", toggleAudio);

// ===================================================================
// 10. AMBİYANS IŞILTILARI CANVAS
// ===================================================================
const canvas = document.getElementById("ambientCanvas");
const ctx = canvas.getContext("2d");

let w = (canvas.width = window.innerWidth);
let h = (canvas.height = window.innerHeight);

window.addEventListener("resize", () => {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
});

const particles = Array.from({ length: 30 }, () => ({
  x: Math.random() * w,
  y: Math.random() * h,
  r: Math.random() * 1.5 + 0.5,
  alpha: Math.random() * 0.5 + 0.2,
  speedY: -(Math.random() * 0.3 + 0.1),
  speedX: (Math.random() - 0.5) * 0.15
}));

function renderAmbient() {
  ctx.clearRect(0, 0, w, h);

  particles.forEach(p => {
    p.y += p.speedY;
    p.x += p.speedX;

    if (p.y < -10) {
      p.y = h + 10;
      p.x = Math.random() * w;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(216, 180, 254, ${p.alpha})`;
    ctx.fill();
  });

  requestAnimationFrame(renderAmbient);
}
renderAmbient();

// Sayfa yüklendiğinde başlat
document.addEventListener("DOMContentLoaded", () => {
  loadDatabase();
});
