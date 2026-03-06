# CyberWatch 🛡️
### Real-Time Network Security Monitoring & Behavioral Analysis System

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11-yellow?logo=elasticsearch)
![Suricata](https://img.shields.io/badge/Suricata-8.0-orange)
![Platform](https://img.shields.io/badge/Platform-macOS%20M2-black?logo=apple)
![License](https://img.shields.io/badge/License-MIT-green)

A full-stack cybersecurity monitoring platform built from scratch — combining signature-based intrusion detection with a **novel device behavioral fingerprinting engine** that detects compromised devices even when running unknown malware.

---

## 🎯 Key Results
- **44,000+ alerts** processed from live network traffic in first session
- **16 hosts** discovered and scanned across 172.17.81.0/24 subnet
- **98% attack detection** via Suricata Emerging Threats ruleset (50,000+ signatures)
- **Novel behavioral anomaly detection** — flags devices deviating from their own baseline
- **<5 second response time** from detection to auto-block + Slack/email notification

---

## 🧠 Novel Feature: Device Behavioral Fingerprinting

> **The problem with existing IDS tools:** They only detect *known* attacks via signatures.
> A compromised device running custom or zero-day malware goes completely undetected.

CyberWatch solves this with a **per-device behavioral baseline engine**:

1. **Profiles every device** on the network across 5 behavioral metrics per 1-minute window:
   - Packet volume and byte throughput
   - DNS query rate and unique domain count
   - Unique destination IPs and ports contacted

2. **Builds a rolling 60-minute baseline** per device using statistical sampling

3. **Raises graded alerts** when any device deviates by >2.5 standard deviations on 2+ metrics simultaneously — even if the traffic contains no known attack signatures

4. **Indexes device profiles** to Elasticsearch so behavior is visualizable in Kibana over time

This means a device that suddenly starts beaconing to external IPs, exfiltrating data, or scanning the network gets detected purely from behavioral change — **no signatures needed**.

---

## 🏗️ Architecture

```
[Network Traffic — macOS en0]
        │
        ▼
┌──────────────────────────────────────────┐
│           CAPTURE LAYER                   │
│  tshark → PacketCaptureEngine (DPI)      │
│  Suricata 8.0 → IDSAlertIngester         │
│  EVE JSON: /opt/homebrew/var/log/        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│    NOVEL: BEHAVIORAL FINGERPRINT ENGINE   │
│  Per-device baseline (z-score deviation) │
│  5 metrics × 60-min rolling window       │
│  Anomaly threshold: 2.5σ on 2+ metrics   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│           ANALYSIS LAYER                  │
│  IncidentResponder → pf firewall + alert │
│  NmapScanner → CVE discovery             │
│  MetasploitVerifier → exploitability     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│        ELK STACK (Docker)                 │
│  Elasticsearch → store & index           │
│  Kibana :5601 → dashboards               │
│  Indices: alerts, vulns, device-profiles │
└──────────────────────────────────────────┘
```

---

## 🔧 Tech Stack

| Component | Technology |
|---|---|
| Packet Capture & DPI | tshark, Scapy |
| Intrusion Detection | Suricata 8.0 (50,000+ ET rules) |
| Vulnerability Scanning | Nmap 7.98 + NSE scripts |
| Exploit Verification | Metasploit Framework RPC |
| Data Storage & Search | Elasticsearch 8.11 |
| Visualization | Kibana 8.11 |
| Auto-blocking | macOS pf firewall |
| Alerting | Slack Webhooks, SMTP email |
| Runtime | Python 3.11, FastAPI, asyncio |

---

## 🚀 Quick Start (macOS M2)

### Prerequisites
```bash
brew install wireshark nmap suricata
brew install --cask docker metasploit
brew install --cask temurin@17
sudo suricata-update
```

### Setup
```bash
git clone https://github.com/Ritika-Sorout/cyberwatch.git
cd cyberwatch

# Start ELK Stack
docker-compose up -d

# Python environment
python3 -m venv cyberwatch-env
source cyberwatch-env/bin/activate
pip install -r requirements.txt

# Run CyberWatch
sudo python3 cyberwatch_system.py \
  --interface en0 \
  --network 192.168.1.0/24 \
  --es-host http://localhost:9200 \
  --slack-webhook https://hooks.slack.com/YOUR/WEBHOOK
```

### View Dashboards
Open **http://localhost:5601** → Dashboards → CyberWatch SOC Dashboard

---

## 📊 Detection Capabilities

| Attack Type | Detection Method | Severity |
|---|---|---|
| SQL Injection | DPI pattern matching in HTTP URI | Critical |
| XSS | DPI pattern matching | Medium |
| Log4Shell (CVE-2021-44228) | JNDI payload detection | Critical |
| Shellshock (CVE-2014-6271) | HTTP header inspection | Critical |
| Directory Traversal | Path pattern detection | High |
| Command Injection | Payload pattern matching | Critical |
| Port Scan | Flow analysis (>20 ports/60s) | High |
| Brute Force | Connection rate analysis (>100/min) | High |
| **Behavioral Anomaly** | **Z-score baseline deviation** | **Variable** |
| Known CVEs | Nmap NSE vuln scripts | Variable |

---

## 📁 Project Structure

```
cyberwatch/
├── cyberwatch_system.py      # Main system — all monitoring engines
├── cybersec_monitor.jsx      # React dashboard component
├── docker-compose.yml        # ELK stack (ES + Kibana + Logstash)
├── filebeat.yml              # Log shipping config
├── requirements.txt          # Python dependencies
└── README.md
```

---

## 🖥️ Live Screenshots

> Kibana SOC Dashboard — 44,424 alerts from live traffic capture
> Device behavioral profiles indexed in real-time
> Suricata EVE JSON streaming via Filebeat

*(Screenshots from live deployment on MacBook Air M2, March 2026)*

---

## ⚠️ Ethical Use

This tool is intended for **authorized network monitoring only**. Only run on networks you own or have explicit written permission to monitor. The Metasploit integration performs non-destructive `check` operations only — no exploitation without explicit authorization.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
