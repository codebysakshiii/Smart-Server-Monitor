
const express = require("express");
const { spawn } = require("child_process");
const os = require("os");
const http = require("http");

const app = express();
const PORT = 3000;
const MANAGED_PORT = 5000;
const MAX_RESTARTS = 3;
const RESTART_DELAY = 2000;

app.use(express.json());
app.use(express.static("public"));

let managedServer = null;
let startedAt = null;
let restartCount = 0;
let logs = [];
let serverState = "STOPPED";
let restartTimer = null;
let generation = 0;

function addLog(message) {
  const entry = `[${new Date().toLocaleTimeString()}] ${message}`;
  logs.unshift(entry);
  logs = logs.slice(0, 100);
  console.log(entry);
}

function getStatus() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();

  return {
    running: serverState === "RUNNING",
    state: serverState,
    uptime:
      startedAt && serverState === "RUNNING"
        ? Math.floor((Date.now() - startedAt) / 1000)
        : 0,
    restartCount,
    maxRestarts: MAX_RESTARTS,
    port: MANAGED_PORT,
    cpuCores: os.cpus().length,
    memoryTotal,
    memoryFree,
    memoryUsedPercent: Math.round(
      ((memoryTotal - memoryFree) / memoryTotal) * 100
    ),
    logs
  };
}

// Live system metrics API


function startManagedServer(isAutomatic = false) {
  if (managedServer) return false;

  clearTimeout(restartTimer);
  restartTimer = null;

  const currentGeneration = ++generation;

  const code = `
    const http = require("http");

    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Managed demo server is running!");
    });

    server.listen(${MANAGED_PORT}, "127.0.0.1", () => {
      process.stdout.write("READY\\\\n");
    });
  `;

  serverState = "STARTING";
  startedAt = null;

  addLog(
    isAutomatic
      ? "Automatic recovery: starting demo server"
      : "Starting demo server"
  );

  const child = spawn(process.execPath, ["-e", code], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  managedServer = child;

  let finalized = false;
  let readyBuffer = "";

  function handleExit(code, signal, error = null) {
    if (finalized) return;
    finalized = true;

    if (generation !== currentGeneration || managedServer !== child) {
      return;
    }

    managedServer = null;
    startedAt = null;

    if (error) {
      addLog(`Server process error: ${error.message}`);
    }

    addLog(
      `Demo server exited (code: ${code}, signal: ${signal})`
    );

    handleUnexpectedExit(currentGeneration);
  }

  child.stdout.on("data", (chunk) => {
    if (generation !== currentGeneration || managedServer !== child) {
      return;
    }

    readyBuffer += chunk.toString();

    if (readyBuffer.includes("READY")) {
      serverState = "RUNNING";
      startedAt = Date.now();
      readyBuffer = "";

      addLog(`Demo server is listening on port ${MANAGED_PORT}`);
    }
  });

  child.stderr.on("data", (chunk) => {
    const message = chunk.toString().trim();

    if (message) {
      addLog(`Demo server error output: ${message}`);
    }
  });

  child.once("error", (error) => {
    handleExit(null, null, error);
  });

  child.once("exit", (code, signal) => {
    handleExit(code, signal);
  });

  return true;
}

function handleUnexpectedExit(exitedGeneration) {
  if (exitedGeneration !== generation) return;

  if (restartCount >= MAX_RESTARTS) {
    serverState = "FAILED";
    addLog(
      `Recovery limit reached: ${MAX_RESTARTS} automatic attempts used`
    );
    return;
  }

  restartCount++;
  serverState = "RECOVERING";

  addLog(
    `Crash recovery attempt ${restartCount}/${MAX_RESTARTS} scheduled in 2 seconds`
  );

  restartTimer = setTimeout(() => {
    restartTimer = null;

    if (
      generation === exitedGeneration &&
      serverState === "RECOVERING" &&
      !managedServer
    ) {
      startManagedServer(true);
    }
  }, RESTART_DELAY);
}

function checkHealth() {
  return new Promise((resolve) => {
    if (!managedServer || serverState !== "RUNNING") {
      resolve({
        healthy: false,
        message: `Demo server state: ${serverState}`
      });
      return;
    }

    const request = http.get(
      `http://127.0.0.1:${MANAGED_PORT}`,
      (response) => {
        response.resume();

        resolve({
          healthy: response.statusCode === 200,
          message:
            response.statusCode === 200
              ? "Demo server is responding"
              : `Unexpected HTTP status: ${response.statusCode}`
        });
      }
    );

    request.setTimeout(1500, () => {
      request.destroy();
      resolve({
        healthy: false,
        message: "Health check timed out"
      });
    });

    request.on("error", () => {
      resolve({
        healthy: false,
        message: "Demo server is unreachable"
      });
    });
  });
}

app.get("/api/status", (req, res) => {
  res.json(getStatus());
});

app.get("/api/health", async (req, res) => {
  res.json(await checkHealth());
});

app.get("/api/logs", (req, res) => {
  res.json({ logs });
});

app.post("/api/start", (req, res) => {
  if (managedServer) {
    return res.json({
      success: true,
      message: "Server process is already starting or running"
    });
  }

  if (serverState === "RECOVERING") {
    return res.json({
      success: false,
      message: "Automatic recovery is already scheduled"
    });
  }

  restartCount = 0;

  const success = startManagedServer();

  res.json({
    success,
    message: success ? "Start command sent" : "Unable to start server"
  });
});

app.post("/api/stop", (req, res) => {
  clearTimeout(restartTimer);
  restartTimer = null;

  // Invalidate old process events before stopping it.
  generation++;

  const child = managedServer;
  managedServer = null;
  startedAt = null;
  serverState = "STOPPED";

  if (child) {
    child.kill();
  }

  addLog("Manual stop requested; automatic recovery disabled");

  res.json({
    success: true,
    message: "Server stopped"
  });
});

app.post("/api/restart", (req, res) => {
  clearTimeout(restartTimer);
  restartTimer = null;

  generation++;

  const child = managedServer;
  managedServer = null;
  startedAt = null;
  serverState = "STOPPED";
  restartCount = 0;

  if (child) {
    child.kill();
  }

  addLog("Manual restart requested; recovery counter reset");

  res.json({
    success: true,
    message: "Restart requested"
  });

  setTimeout(() => {
    if (!managedServer && serverState === "STOPPED") {
      startManagedServer();
    }
  }, 500);
});



let previousCpuSnapshot = null;

function getCpuSnapshot() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    for (const time of Object.values(cpu.times)) {
      total += time;
    }
  }

  return { idle, total };
}

function getCpuUsage() {
  const current = getCpuSnapshot();

  if (!previousCpuSnapshot) {
    previousCpuSnapshot = current;
    return null;
  }

  const idleDifference =
    current.idle - previousCpuSnapshot.idle;
  const totalDifference =
    current.total - previousCpuSnapshot.total;

  previousCpuSnapshot = current;

  if (totalDifference <= 0) return null;

  return Math.round(
    (1 - idleDifference / totalDifference) * 100
  );
}

app.get("/api/metrics", (req, res) => {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;

  res.json({
    timestamp: new Date().toISOString(),
    cpuUsagePercent: getCpuUsage(),
    memoryTotal,
    memoryFree,
    memoryUsed,
    memoryUsedPercent: Math.round(
      (memoryUsed / memoryTotal) * 100
    )
  });
});


app.listen(PORT, "127.0.0.1", () => {
  addLog(`Dashboard available at http://localhost:${PORT}`);
  startManagedServer();
});
