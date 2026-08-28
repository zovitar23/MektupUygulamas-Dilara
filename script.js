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

// LocalStorage, SQLite & Cloud DB Yükleme
let isSqliteBackend = false;
let sqliteApiBase = "http://localhost:5500";

async function checkSqliteBackend() {
  const endpoints = ["/api/letters", "http://localhost:5500/api/letters"];
  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        isSqliteBackend = true;
        sqliteApiBase = url.startsWith("http") ? "http://localhost:5500" : "";
        const cloudStatusLabel = document.getElementById("cloudStatusLabel");
        if (cloudStatusLabel) cloudStatusLabel.textContent = "SQLite (letters.db) ✓";
        const data = await res.json();
        if (Array.isArray(data)) {
          letters = data;
          localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
          updateUI();
        }
        return;
      }
    } catch (e) {}
  }
  isSqliteBackend = false;
}

function loadDatabase() {
  const savedLetters = localStorage.getItem("couple_letters_db_v1");
  if (savedLetters) {
    try {
      letters = JSON.parse(savedLetters);
    } catch (e) {
      letters = [...DEFAULT_LETTERS];
    }
  } else {
    letters = [...DEFAULT_LETTERS];
    saveDatabase();
  }

  const savedUser = localStorage.getItem("couple_active_user");
  if (savedUser && (savedUser === "Çağrı" || savedUser === "Dilara")) {
    setUser(savedUser);
  } else {
    showProfileSelection();
  }

  // SQLite sunucusunu kontrol et ve senkronize ol
  checkSqliteBackend();
  syncFromCloud();
}

async function saveDatabase() {
  localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
  updateUI();
  
  if (isSqliteBackend) {
    // SQLite backend aktif olduğunda API otomatik kaydeder
  } else {
    syncToCloud();
  }
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

    if (isSqliteBackend && currentOpenLetter.id) {
      fetch(`/api/letters/${currentOpenLetter.id}/read`, { method: "POST" }).catch(() => null);
    }

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
function handleSendLetter(event) {
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
    id: "letter_" + Date.now(),
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

  letters.push(newLetter);
  saveDatabase();

  // SQLite Backend aktifse veritabanına kaydet
  if (isSqliteBackend) {
    fetch(`${sqliteApiBase}/api/letters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLetter)
    }).catch(() => null);
  }

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
// 8. BULUT & SQL SENKRONİZASYON MOTORU (Supabase PostgreSQL / Cloud)
// ===================================================================
const cloudModal = document.getElementById("cloudModal");
const cloudSettingsBtn = document.getElementById("cloudSettingsBtn");
const inputCoupleKey = document.getElementById("inputCoupleKey");
const inputSupabaseUrl = document.getElementById("inputSupabaseUrl");
const inputSupabaseKey = document.getElementById("inputSupabaseKey");

let supabaseClient = null;
let supabaseUrl = localStorage.getItem("supabase_url") || "";
let supabaseKey = localStorage.getItem("supabase_key") || "";

function initSupabase() {
  if (window.supabase && supabaseUrl && supabaseKey) {
    try {
      supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
      const cloudStatusLabel = document.getElementById("cloudStatusLabel");
      if (cloudStatusLabel) cloudStatusLabel.textContent = "SQL Bağlı ✓";

      // Realtime SQL Tablosu Dinleyicisi
      supabaseClient
        .channel("public:letters")
        .on("postgres_changes", { event: "*", schema: "public", table: "letters" }, () => {
          fetchFromSupabase();
        })
        .subscribe();

      fetchFromSupabase();
    } catch (e) {
      console.log("Supabase başlatılamadı:", e);
    }
  }
}

function openCloudModal() {
  if (inputCoupleKey) inputCoupleKey.value = coupleKey;
  if (inputSupabaseUrl) inputSupabaseUrl.value = supabaseUrl;
  if (inputSupabaseKey) inputSupabaseKey.value = supabaseKey;
  cloudModal.classList.add("active");
}

function closeCloudModal() {
  cloudModal.classList.remove("active");
}

cloudSettingsBtn.addEventListener("click", openCloudModal);

function saveCloudSettings() {
  const key = inputCoupleKey.value.trim();
  const sbUrl = inputSupabaseUrl ? inputSupabaseUrl.value.trim() : "";
  const sbKey = inputSupabaseKey ? inputSupabaseKey.value.trim() : "";

  if (key) {
    coupleKey = key;
    localStorage.setItem("couple_sync_key", coupleKey);
  }

  if (sbUrl && sbKey) {
    supabaseUrl = sbUrl;
    supabaseKey = sbKey;
    localStorage.setItem("supabase_url", sbUrl);
    localStorage.setItem("supabase_key", sbKey);
    initSupabase();
  }

  alert("Ayarlarınız kaydedildi! Veritabanı bağlantısı kuruldu.");
  closeCloudModal();
  syncToCloud();
}

// Supabase SQL'den mektupları çekme
async function fetchFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("letters")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      letters = data.map(row => ({
        id: row.id,
        from: row.sender,
        to: row.recipient,
        date: row.date || new Date(row.created_at).toLocaleDateString("tr-TR"),
        title: row.title,
        salutation: row.salutation,
        body: row.body,
        signature: row.signature,
        isRead: row.is_read,
        createdAt: new Date(row.created_at).getTime()
      }));
      localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
      updateUI();
    }
  } catch (e) {}
}

// SQL & Buluta mektup aktarma
async function syncToCloud() {
  // Eğer Supabase SQL aktifse doğrudan SQL tablosuna yaz
  if (supabaseClient) {
    try {
      const latestLetter = letters[letters.length - 1];
      if (latestLetter) {
        await supabaseClient.from("letters").upsert({
          sender: latestLetter.from,
          recipient: latestLetter.to,
          title: latestLetter.title,
          salutation: latestLetter.salutation,
          body: latestLetter.body,
          signature: latestLetter.signature,
          is_read: latestLetter.isRead
        });
      }
    } catch (e) {}
    return;
  }

  // Yedek bulut depolama
  if (!coupleKey) return;
  try {
    const cloudStatusLabel = document.getElementById("cloudStatusLabel");
    if (cloudStatusLabel) cloudStatusLabel.textContent = "Eşitleniyor...";

    await fetch(`https://api.jsonstorage.net/v1/json/00000000-0000-0000-0000-000000000000/${coupleKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ letters, updatedAt: Date.now() })
    }).catch(() => null);

    if (cloudStatusLabel) cloudStatusLabel.textContent = "Bulut Aktif ✓";
  } catch (e) {}
}

async function syncFromCloud() {
  if (supabaseClient) {
    fetchFromSupabase();
    return;
  }

  if (!coupleKey) return;
  try {
    const res = await fetch(`https://api.jsonstorage.net/v1/json/00000000-0000-0000-0000-000000000000/${coupleKey}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.letters) && data.letters.length > 0) {
        letters = data.letters;
        localStorage.setItem("couple_letters_db_v1", JSON.stringify(letters));
        updateUI();
      }
    }
  } catch (e) {}
}

// 15 saniyede bir kontrol
setInterval(syncFromCloud, 15000);

// Başlangıçta Supabase'i başlat
setTimeout(initSupabase, 500);

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
