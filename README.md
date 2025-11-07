# Network Toolbox – netscan.online

![Network Toolbox](https://netscan.online/screenshot.png)  
*Real-time, web-based network diagnostics powered by Linux tools*

---

**A clean, fast, and open-source browser-based network toolbox**  
Run **real Linux commands** directly in your browser:  
**Ping • WHOIS • NSLookup • DIG • Port Scan • HOST • IPCalc**

Live at: [**https://netscan.online**](https://netscan.online)

---

## Features

| Tool       | Command       | Highlights |
|------------|---------------|----------|
| **Ping**   | `ping`        | Real-time, color-coded latency |
| **WHOIS**  | `whois`       | Domain registration info |
| **NSLookup** | `nslookup`  | DNS server resolution |
| **DIG**    | `dig`         | Full DNS query control |
| **Port Scan** | `nc -vz`   | Fast TCP port check |
| **HOST**   | `host`        | Simple DNS lookup |
| **IPCalc** | `ipcalc`      | Subnet & IP math |

**Smart UX**:
- Click your **public IP** → auto-fills current tool
- Press **Enter** to run, **ESC** to stop instantly
- Live terminal with **color syntax**
- Fully **responsive**, dark theme, mobile-ready

**Real Tools, Real Output**  
No simulation — uses actual system binaries.

---

## License

**MIT License** – Free to use, modify, and distribute.

> **Attribution Required**  
> If you use this code, please include:  
> _"Network Toolbox by Kamil Kaczmarczyk – https://netscan.online"_

See [`LICENSE`](./LICENSE) for full details.

---

## Installation (Debian / Ubuntu)

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y \
  nodejs npm \
  geoip-bin \
  ipcalc \
  netcat-openbsd \
  dnsutils \
  whois \
  bind9-dnsutils
```
**Package Roles:**

- geoip-bin → IP geolocation
- ipcalc → subnet calculator
- netcat-openbsd → port scanning
- dnsutils → dig, nslookup
- whois → domain data
- bind9-dnsutils → host

### 2. Clone & Install

```bash
git clone https://github.com/jacekiwaszkoe/netscan.online.git
cd netscan.online
npm install
```
### 3. Test Run

```bash
node server.js
```

## Run as Systemd Service (Auto-Start)

### 1. Create Service File

```bash
sudo nano /etc/systemd/system/network-toolbox.service
```

```ini
[Unit]
Description=Network Toolbox Web Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/ubuntu/network-toolbox
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=network-toolbox

[Install]
WantedBy=multi-user.target
```

### Customize:

- WorkingDirectory → your project path
- User → www-data, ubuntu, or root (avoid root if possible)

## 2. Enable & Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable network-toolbox.service
sudo systemctl start network-toolbox.service
```

## 3. Check Status

```bash
sudo systemctl status network-toolbox.service
journalctl -u network-toolbox.service -f
```

## Production Tips

- HTTPS: Use Nginx or Apache as reverse proxy
- Firewall: Open port 3000 (or 80/443)
- Domain: Point netscan.online to your server
- Updates:

```bash
cd /path/to/network-toolbox
git pull
sudo systemctl restart network-toolbox
```

## Project Structure
```text
network-toolbox/
├── server.js
├── public/
│   └── index.html
├── package.json
├── LICENSE
└── README.md
```

## Contributing

- Fork the repo
- Create a branch (git checkout -b feature/amazing-tool)
- Commit your changes
- Push & open a Pull Request

## Author
Jacek Iwaszko
https://netscan.online
