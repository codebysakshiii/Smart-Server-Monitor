# 🚀 Smart Server Monitor

A real-time server monitoring dashboard built with **Node.js, Express.js, HTML, CSS, and JavaScript**. Monitor system CPU and memory usage, manage a demo server, and observe automatic recovery events through a web-based dashboard.

## ✨ Features

- 📊 Live CPU usage monitoring
- 💾 RAM usage statistics
- 📈 Real-time CPU and memory charts
- 💚 Server health-check endpoint
- ▶️ Start, stop, and restart controls
- 🔄 Automatic recovery after unexpected server exits
- 📝 Activity logs and restart tracking
- 🖥️ Web-based monitoring dashboard

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** HTML, CSS, JavaScript
- **System Monitoring:** Node.js OS module
- **Process Management:** Child Process module
- **Version Control:** Git and GitHub

## 📂 Project Structure

```text
Smart-Server-Monitor/
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── server.js
├── package.json
├── package-lock.json
├── Start.bat
├── .gitignore
└── README.md
```

## ⚙️ Run Locally

### Prerequisites
- Node.js installed
- npm installed

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/codebysakshiii/Smart-Server-Monitor.git
   ```

2. Open the project directory:

   ```bash
   cd Smart-Server-Monitor
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the application:

   ```bash
   npm start
   ```

5. Open the dashboard:

   http://localhost:3000

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/status` | Server status and system information |
| GET | `/api/health` | Managed server health check |
| GET | `/api/logs` | Activity logs |
| GET | `/api/metrics` | CPU and memory metrics |
| POST | `/api/start` | Start the managed server |
| POST | `/api/stop` | Stop the managed server |
| POST | `/api/restart` | Restart the managed server |

## 🎯 Learning Outcomes

This project demonstrates practical experience with REST APIs, operating-system metrics, child-process management, health checks, automatic recovery, and dashboard development.

## 👩‍💻 Author

**Sakshi Bari**

GitHub: [@codebysakshiii](https://github.com/codebysakshiii)

---

*Built as a hands-on project to practice Node.js, server monitoring, and backend development.*
