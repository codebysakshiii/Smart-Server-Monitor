
const $ = (id) => document.getElementById(id);

let toastTimer;

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "--";
  return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

async function postJSON(url) {
  const response = await fetch(url, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
}

async function refreshStatus() {
  try {
    const data = await getJSON("/api/status");

    const state = data.state || (data.running ? "RUNNING" : "STOPPED");

const statusLabels = {
  RUNNING: "Running",
  STARTING: "Starting...",
  STOPPED: "Stopped",
  RECOVERING: "Recovering...",
  FAILED: "Failed"
};

$("serverStatus").textContent = statusLabels[state] || state;
$("statusDetail").textContent = {
  RUNNING: "Process active",
  STARTING: "Starting server process",
  STOPPED: "Process stopped",
  RECOVERING: "Automatic restart in progress",
  FAILED: "Restart limit reached"
}[state] || "Checking status";

$("statusDot").style.background = {
  RUNNING: "#17a875",
  STARTING: "#e6973d",
  STOPPED: "#8791a5",
  RECOVERING: "#e6973d",
  FAILED: "#e55363"
}[state] || "#8791a5";
    $("statusDetail").textContent = data.running ? "Process active" : "Process stopped";
    $("statusDot").style.background = data.running ? "#17a875" : "#e55363";
    $("uptime").textContent = formatUptime(data.uptime);
    $("restarts").textContent = data.restartCount;

    $("memory").textContent = `${data.memoryUsedPercent}%`;
    $("memoryBar").style.width = `${data.memoryUsedPercent}%`;
    $("memoryDetail").textContent =
      `${formatBytes(data.memoryTotal - data.memoryFree)} used of ${formatBytes(data.memoryTotal)}`;

    $("cpuCores").textContent = data.cpuCores;
    $("totalMemory").textContent = formatBytes(data.memoryTotal);
    $("freeMemory").textContent = formatBytes(data.memoryFree);
    $("cpuBar").style.width = "100%";
    $("totalBar").style.width = "100%";
    $("freeBar").style.width =
      `${Math.round((data.memoryFree / data.memoryTotal) * 100)}%`;

    $("serviceState").textContent = data.running ? "RUNNING" : "STOPPED";
    $("serviceState").style.background = data.running ? "#e6f8ef" : "#fff0f1";
    $("serviceState").style.color = data.running ? "#15845c" : "#e55363";

    $("lastUpdated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
    $("footerTime").textContent = `• ${new Date().getFullYear()}`;

    await refreshHealth();
    renderLogs(data.logs || []);
  } catch (error) {
    $("serverStatus").textContent = "Offline";
    $("statusDetail").textContent = "Dashboard API unavailable";
    $("statusDot").style.background = "#e55363";
    $("healthMessage").textContent = "Cannot connect to the monitoring API.";
    $("lastUpdated").textContent = "Connection lost";
  }
}

async function refreshHealth() {
  try {
    const result = await getJSON("/api/health");
    $("healthMessage").textContent = result.message;
    const icon = document.querySelector(".health-icon");
    icon.textContent = result.healthy ? "✓" : "!";
    icon.style.background = result.healthy ? "#e0f7eb" : "#fff0f1";
    icon.style.color = result.healthy ? "#149666" : "#e55363";
  } catch {
    $("healthMessage").textContent = "Health check failed";
  }
}

function renderLogs(logs) {
  const list = $("logsList");
  list.replaceChildren();

  if (!logs.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No activity recorded yet.";
    list.appendChild(empty);
    return;
  }

  logs.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "log-entry";

    const message = document.createElement("span");
    message.className = "log-message";
    message.textContent = entry;

    const time = document.createElement("span");
    time.className = "log-time";
    const match = entry.match(/^\[(.*?)\]/);
    time.textContent = match ? match[1] : "";

    row.append(message, time);
    list.appendChild(row);
  });
}

async function runAction(url, successMessage) {
  const buttons = ["startBtn", "stopBtn", "restartBtn"];
  buttons.forEach((id) => $(id).disabled = true);

  try {
    const result = await postJSON(url);
    showToast(result.message || successMessage);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await refreshStatus();
  } catch (error) {
    showToast(`Error: ${error.message}`);
  } finally {
    buttons.forEach((id) => $(id).disabled = false);
  }
}

$("startBtn").addEventListener("click", () =>
  runAction("/api/start", "Start command sent"));

$("stopBtn").addEventListener("click", () =>
  runAction("/api/stop", "Stop command sent"));

$("restartBtn").addEventListener("click", () =>
  runAction("/api/restart", "Restart command sent"));

$("refreshBtn").addEventListener("click", refreshStatus);
$("logsRefreshBtn").addEventListener("click", refreshStatus);
$("healthBtn").addEventListener("click", refreshHealth);

refreshStatus();
setInterval(refreshStatus, 3000);


// Smart Server Monitor Pro: live CPU/RAM charts
(() => {
  const canvas = document.getElementById("resourceChart");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const history = [];
  const MAX_POINTS = 20;

  const cpuValue = document.getElementById("cpuValue");
  const ramValue = document.getElementById("ramValue");
  const cpuBar = document.getElementById("cpuBar");
  const ramBar = document.getElementById("ramBar");
  const ramDetail = document.getElementById("ramDetail");
  const updated = document.getElementById("metricsUpdated");

  function drawChart() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const left = 32;
    const right = 10;
    const top = 12;
    const bottom = 24;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.font = "11px Arial";
    ctx.fillStyle = "#78859a";
    ctx.strokeStyle = "#e9edf4";
    ctx.lineWidth = 1;

    for (let value = 0; value <= 100; value += 25) {
      const y = top + plotHeight * (1 - value / 100);

      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();

      ctx.fillText(String(value), 3, y + 4);
    }

    function drawLine(key, color) {
      if (history.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      history.forEach((point, index) => {
        const x =
          left +
          (index / (MAX_POINTS - 1)) * plotWidth;

        const y =
          top +
          plotHeight * (1 - point[key] / 100);

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    drawLine("cpu", "#3878f6");
    drawLine("ram", "#13b88a");

    ctx.fillStyle = "#78859a";
    ctx.fillText("60s ago", left, height - 5);
    ctx.fillText("Now", width - right - 23, height - 5);
  }

  async function refreshMetrics() {
    try {
      const response = await fetch("/api/metrics", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Metrics API request failed");
      }

      const data = await response.json();

      const ram = data.memoryUsedPercent;
      const cpu = data.cpuUsagePercent;

      ramValue.textContent = `${ram}%`;
      ramBar.style.width = `${ram}%`;

      const usedGB = (
        data.memoryUsed / (1024 ** 3)
      ).toFixed(2);

      const totalGB = (
        data.memoryTotal / (1024 ** 3)
      ).toFixed(2);

      ramDetail.textContent =
        `${usedGB} GB used of ${totalGB} GB`;

      if (cpu === null) {
        cpuValue.textContent = "Measuring...";
      } else {
        cpuValue.textContent = `${cpu}%`;
        cpuBar.style.width = `${cpu}%`;
      }

      if (cpu !== null) {
        history.push({
          cpu,
          ram,
          time: Date.now()
        });

        if (history.length > MAX_POINTS) {
          history.shift();
        }
      }

      drawChart();

      updated.textContent =
        `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
      updated.textContent =
        "Metrics unavailable. Check that the dashboard server is running.";

      console.error("Metrics error:", error);
    }
  }

  refreshMetrics();
  setInterval(refreshMetrics, 3000);

  window.addEventListener("resize", drawChart);
})();
