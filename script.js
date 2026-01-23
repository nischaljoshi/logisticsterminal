// --- Configuration & State ---
let timeSCCLeft = 30;
let timeBoxLeft = 50;
let barcodeHistory = [];
let saveFavourites = [];
let currentSSCC = "";
let currentBox = "";

const qrDiv = document.getElementById("qr-output");
const qrObj = new QRCode(qrDiv, {
  width: 100,
  height: 100,
  correctLevel: QRCode.CorrectLevel.H,
});

//Toggle Navigation Menu
function toggleMode(event) {
  const clickedTab = event.target.closest(".switch-option");

  // Exit if background or something else was clicked
  if (!clickedTab) return;

  // 1. Update Tab Visuals
  const allTabs = document.querySelectorAll(".switch-option");
  allTabs.forEach((tab) => tab.classList.remove("active"));
  clickedTab.classList.add("active");

  // 2. Update Content Visibility
  const targetId = clickedTab.getAttribute("data-target");

  // Hide all content sections
  const allContent = document.querySelectorAll(".tab-content");
  allContent.forEach((content) => content.classList.remove("active"));

  // Show the specific target section
  document.getElementById(targetId).classList.add("active");
  document.getElementById("page").innerText =
    clickedTab.getAttribute("data-value");
}

// --- Utilities ---
const getFormattedDate = (includeTime = false, addDay = 0) => {
  const now = new Date();
  now.setDate(now.getDate() + addDay);
  const pad = (n) => n.toString().padStart(2, "0");
  const datePart = `${now.getFullYear().toString().slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  if (!includeTime) return datePart;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return datePart + timePart;
};

const getTimestamp = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Manages daily counters in localStorage
function getDailyCounter(keyBase) {
  const todayStr = getFormattedDate();
  const lastDateKey = `${keyBase}_last_date`;
  const countKey = `${keyBase}_daily_counter`;

  let lastDate = localStorage.getItem(lastDateKey);
  let counter = parseInt(localStorage.getItem(countKey)) || 0;

  if (lastDate !== todayStr) {
    counter = 1;
    localStorage.setItem(lastDateKey, todayStr);
  } else {
    counter++;
  }
  localStorage.setItem(countKey, counter);
  return counter;
}

// --- Core Logic ---

function calculateCheckDigit(number) {
  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let digit = parseInt(number.charAt(number.length - 1 - i));
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
}

function updateSSCCBarcode() {
  const serialPart = getFormattedDate(true);
  const base = "39515" + serialPart;
  const sscc = base + calculateCheckDigit(base);

  currentSSCC = "00" + sscc;
  document.getElementById("serial-sscc-debug").innerText = serialPart;

  JsBarcode("#barcode", "\xCF00" + sscc, {
    format: "CODE128",
    displayValue: true,
    text: "(00) " + sscc.replace(/(.{4})/g, "$1 "),
    width: 2.2,
    height: 90,
    fontSize: 18,
    background: "transparent",
  });

  barcodeHistory.push({
    time: getTimestamp(),
    sscc: currentSSCC,
    type: "SSCC",
  });
  renderUI();
  timeSCCLeft = 30;
}

function generateweight() {
  const min = document.getElementById("minwt").value;
  const max = document.getElementById("maxwt").value;

  // 1. Generate random weight with decimals
  // Multiplying by 100 handles the "2 decimal places" logic
  const minScaled = min * 100;
  const maxScaled = max * 100;
  const randomWeight =
    Math.floor(Math.random() * (maxScaled - minScaled + 1)) + minScaled;

  // 2. Pad to 6 digits (GS1 standard requirement)
  return randomWeight.toString().padStart(6, "0");
}

function generateBoxCode(format = "raw") {
  const gtin = (document.getElementById("gtin")?.value || "").padEnd(14, "0");
  const counter = getDailyCounter("box_label");
  const weightValue = generateweight();
  const fullSerial = `17485${counter.toString().padStart(3, "0")}`;
  var usebyDate = ""; // Simplified for logic

  const datemode = document.getElementById("days").value;

  var dateai = "17";

  if (datemode == "0") {
    dateai = "11";
    usebyDate = getFormattedDate();
  } else {
    dateai = "17";
    usebyDate = getFormattedDate(false, datemode);
  }

  const ai = { gtin: "01", weight: "3102", usebyDate: dateai, serial: "21" };

  const rawString = `${ai.gtin}${gtin}${ai.weight}${weightValue}${ai.usebyDate}${usebyDate}${ai.serial}${fullSerial}`;
  const humanReadable = `(${ai.gtin})${gtin}(${ai.weight})${weightValue}(${ai.usebyDate})${usebyDate}(${ai.serial})${fullSerial}`;

  // 5. Update UI
  const serialDebug = document.getElementById("serial-box-debug");
  const stringDebug = document.getElementById("string-box-debug");

  if (serialDebug) serialDebug.innerText = fullSerial;
  if (stringDebug) stringDebug.innerText = `Encoded: ${humanReadable}`;

  return format === "raw" ? rawString : humanReadable;
}

function updateBoxBarcode() {
  currentBox = generateBoxCode("raw");
  qrObj.clear();
  qrObj.makeCode(currentBox);

  barcodeHistory.push({ time: getTimestamp(), sscc: currentBox, type: "Box" });
  renderUI();
  timeBoxLeft = 5;
}

// --- UI Rendering ---

function renderUI() {
  renderList("history-log", barcodeHistory, "log-item");
  renderList("favourites", saveFavourites, "fav-item");
}

function renderList(elementId, dataArray, itemClass) {
  const container = document.getElementById(elementId);
  if (!container || dataArray.length === 0) return;

  container.innerHTML = dataArray
    .slice()
    .reverse()
    .map(
      (item) => `
        <div class="p-2 bg-white border-start border-4 rounded shadow-sm mb-2 ${itemClass}">
            <div class="row">
                <div class="col-4"><div class="qrcode-container"></div></div>
                <div class="col-8">
                    <div class="d-flex justify-content-between">
                        <span class="fw-bold">${item.time}</span>
                        <span class="text-muted small">${item.type || "AI:00"}</span>
                    </div>
                    <div class="text-primary qr-data" style="word-break: break-all;">${item.sscc}</div>
                </div>
            </div>
        </div>
    `,
    )
    .join("");

  generateQRCodes(`.${itemClass}`);
}

function generateQRCodes(selector) {
  document.querySelectorAll(selector).forEach((item) => {
    const data = item.querySelector(".qr-data").textContent;
    const container = item.querySelector(".qrcode-container");
    if (container.innerHTML !== "") return; // Prevent double rendering
    new QRCode(container, {
      text: data,
      width: 60,
      height: 60,
      correctLevel: QRCode.CorrectLevel.H,
    });
  });
}

// --- Actions ---

function saveSSCCFavourite() {
  if (!currentSSCC) return;
  const alreadyssccExists = saveFavourites.some(
    (item) => item.sscc === currentSSCC,
  );

  if (!alreadyssccExists) {
    saveFavourites.push({
      time: getTimestamp(),
      sscc: currentSSCC,
      type: "SSCC",
    });
  }

  navigator.clipboard.writeText(currentSSCC);
  Toastify({
    text: "Copied to Clipboard",
    style: { background: "#198754" },
    duration: 2000,
    gravity: "bottom",
    position: "center",
  }).showToast();

  renderUI();
}

function saveBOXFavourite() {
  if (!currentBox) return;
  const alreadyboxExists = saveFavourites.some(
    (item) => item.sscc === currentBox,
  );

  if (!alreadyboxExists) {
    saveFavourites.push({
      time: getTimestamp(),
      sscc: currentBox,
      type: "Box",
    });
  }

  navigator.clipboard.writeText(currentBox);
  Toastify({
    text: "Copied to Clipboard",
    style: { background: "#198754" },
    duration: 2000,
    gravity: "bottom",
    position: "center",
  }).showToast();

  renderUI();
}

function exportToCSV() {
  if (barcodeHistory.length === 0) return alert("No data recorded");
  let csv =
    "Timestamp,Code\n" +
    barcodeHistory.map((r) => `${r.time},'${r.sscc}`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `Barcode_Report_${getFormattedDate()}.csv`,
  });
  a.click();
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
  updateSSCCBarcode();
  updateBoxBarcode();

  // Combined Timers
  setInterval(() => {
    if (--timeSCCLeft <= 0) updateSSCCBarcode();
    if (--timeBoxLeft <= 0) updateBoxBarcode();

    document.getElementById("timer-sscc-display").innerText = timeSCCLeft;
    document.getElementById("timer-box-display").innerText = timeBoxLeft;
  }, 1000);
});
