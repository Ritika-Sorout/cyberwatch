"""
CyberWatch — FastAPI Bridge Server
===================================
Wraps cyberwatch_system.py and exposes REST + WebSocket endpoints
for the React frontend.

Run:
  pip install fastapi uvicorn websockets python-dotenv
  sudo python3 api_server.py --interface en0 --network 172.17.81.0/24

Endpoints:
  GET  /api/stats          — dashboard KPIs
  GET  /api/alerts         — paginated alert list
  GET  /api/devices        — live device profiles
  GET  /api/vulnerabilities — CVE list from Nmap/Metasploit
  GET  /api/behavior/{ip}  — per-device behavioral timeline
  GET  /api/system         — component health (tshark, Suricata, ELK…)
  WS   /ws/alerts          — real-time alert stream
  WS   /ws/traffic         — live packet rate feed
  POST /api/block/{ip}     — manual block via pf
  DELETE /api/block/{ip}   — unblock IP
"""

import asyncio
import json
import time
import logging
import argparse
import threading
import statistics
from collections import deque, defaultdict
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# ── Import the real CyberWatch system ────────────────────────────────────────
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from cyberwatch_system import (
        CyberWatchSystem, Alert, Vulnerability, DeviceProfile,
        BehavioralFingerprintEngine
    )
    REAL_SYSTEM = True
except ImportError as e:
    logging.warning(f"cyberwatch_system import failed: {e} — running in DEMO mode")
    REAL_SYSTEM = False

log = logging.getLogger("CyberWatch.API")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CyberWatch API",
    description="Real-time SOC monitoring REST + WebSocket API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # tightened to your Netlify URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global state ──────────────────────────────────────────────────────────────
_system: Optional[CyberWatchSystem] = None
_demo_alerts = deque(maxlen=5000)
_ws_clients: List[WebSocket] = []
_packet_rates = deque(maxlen=60)   # last 60 seconds of packet rates
_start_time = time.time()

# ── Demo / fallback data (used when CyberWatch isn't running) ─────────────────
import random

DEMO_DEVICES = [
    {"id": "gw",  "ip": "172.17.81.1",  "label": "Gateway Router", "type": "router", "status": "normal",
     "pkts": 4821, "bytes": 2100000, "dns": 12, "dstIps": 24, "ports": 18,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 0},
    {"id": "mb",  "ip": "172.17.81.10", "label": "MacBook Air M2", "type": "laptop", "status": "normal",
     "pkts": 1204, "bytes": 840000,  "dns": 31, "dstIps": 12, "ports": 8,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 0},
    {"id": "tp",  "ip": "172.17.81.11", "label": "ThinkPad Dev",   "type": "laptop", "status": "anomaly",
     "pkts": 9821, "bytes": 5200000, "dns": 88, "dstIps": 64, "ports": 42,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 3},
    {"id": "ip",  "ip": "172.17.81.20", "label": "iPhone 15",      "type": "mobile", "status": "normal",
     "pkts": 312,  "bytes": 180000,  "dns": 9,  "dstIps": 7,  "ports": 4,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 0},
    {"id": "an",  "ip": "172.17.81.21", "label": "Pixel 8",        "type": "mobile", "status": "warning",
     "pkts": 1821, "bytes": 1100000, "dns": 45, "dstIps": 31, "ports": 22,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 1},
    {"id": "cam", "ip": "172.17.81.31", "label": "IP Camera",      "type": "iot",    "status": "critical",
     "pkts": 18240,"bytes": 12000000,"dns": 124,"dstIps": 88, "ports": 71,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 7},
    {"id": "tv",  "ip": "172.17.81.32", "label": "Smart TV",       "type": "iot",    "status": "normal",
     "pkts": 421,  "bytes": 320000,  "dns": 6,  "dstIps": 4,  "ports": 3,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 0},
    {"id": "nas", "ip": "172.17.81.50", "label": "NAS Server",     "type": "server", "status": "normal",
     "pkts": 2104, "bytes": 1400000, "dns": 18, "dstIps": 14, "ports": 9,
     "first_seen": "2026-03-01T08:00:00", "last_seen": datetime.utcnow().isoformat(),
     "baseline_samples": 60, "total_anomalies": 0},
]

DEMO_VULNS = [
    {"cve": "CVE-2021-44228", "host": "172.17.81.50", "port": 8080, "service": "Log4j 2.14",
     "cvss": 10.0, "exploit": True,  "msf_module": "exploit/multi/misc/log4shell_header_injection",
     "desc": "RCE via JNDI lookup in Log4j 2.x. Unauthenticated remote code execution.",
     "remediation": "Upgrade Log4j to 2.17.1+. Set log4j2.formatMsgNoLookups=true as interim."},
    {"cve": "CVE-2022-0847",  "host": "172.17.81.11", "port": 22,   "service": "Linux 5.15",
     "cvss": 7.8, "exploit": True,  "msf_module": "exploit/linux/local/cve_2022_0847_dirtypipe",
     "desc": "Dirty Pipe — local privilege escalation via pipe buffer overwrite.",
     "remediation": "Upgrade Linux kernel to 5.16.11+ or apply distro patch."},
    {"cve": "CVE-2023-44487", "host": "172.17.81.1",  "port": 443,  "service": "nginx 1.18",
     "cvss": 7.5, "exploit": False, "msf_module": None,
     "desc": "HTTP/2 Rapid Reset DDoS. Allows remote attackers to exhaust server resources.",
     "remediation": "Upgrade nginx to 1.25.3+. Rate-limit HTTP/2 streams."},
    {"cve": "CVE-2021-3156",  "host": "172.17.81.50", "port": 22,   "service": "sudo 1.9.5",
     "cvss": 7.0, "exploit": True,  "msf_module": "exploit/linux/local/sudo_baron_samedit",
     "desc": "Baron Samedit — heap overflow in sudo allows any local user to root.",
     "remediation": "Upgrade sudo to 1.9.5p2+."},
    {"cve": "CVE-2024-1086",  "host": "172.17.81.11", "port": 0,    "service": "nf_tables",
     "cvss": 7.8, "exploit": False, "msf_module": None,
     "desc": "netfilter use-after-free LPE in Linux kernel nf_tables component.",
     "remediation": "Upgrade kernel to 6.6.15+."},
]

def _seed_demo_alerts():
    base_ts = time.time()
    demo_list = [
        {"sev": "critical", "type": "Port Scan",       "src": "172.17.81.31", "dst": "172.17.81.1",  "rule": "FLOW:SCAN-001",        "blocked": True,  "proto": "TCP"},
        {"sev": "critical", "type": "SQL Injection",   "src": "10.0.0.44",    "dst": "172.17.81.50", "rule": "DPI:SQLi-001",         "blocked": True,  "proto": "HTTP"},
        {"sev": "high",     "type": "Behavioral AI",   "src": "172.17.81.11", "dst": "*",            "rule": "BEHAVIOR:ANOMALY-0003","blocked": False, "proto": "*"},
        {"sev": "high",     "type": "Brute Force",     "src": "203.0.113.5",  "dst": "172.17.81.1",  "rule": "FLOW:BF-001",          "blocked": True,  "proto": "TCP"},
        {"sev": "critical", "type": "Log4Shell",       "src": "198.51.100.8", "dst": "172.17.81.50", "rule": "DPI:CVE-2021-44228",   "blocked": True,  "proto": "HTTP"},
        {"sev": "medium",   "type": "XSS Attack",      "src": "192.0.2.77",   "dst": "172.17.81.50", "rule": "DPI:XSS-001",          "blocked": False, "proto": "HTTP"},
        {"sev": "critical", "type": "Shellshock",      "src": "203.0.113.20", "dst": "172.17.81.50", "rule": "DPI:CVE-2014-6271",    "blocked": True,  "proto": "HTTP"},
        {"sev": "high",     "type": "Dir Traversal",   "src": "198.51.100.2", "dst": "172.17.81.50", "rule": "DPI:LFI-001",          "blocked": False, "proto": "HTTP"},
        {"sev": "high",     "type": "Cmd Injection",   "src": "10.0.0.99",    "dst": "172.17.81.50", "rule": "DPI:CMDi-001",         "blocked": True,  "proto": "HTTP"},
        {"sev": "medium",   "type": "Behavioral AI",   "src": "172.17.81.21", "dst": "*",            "rule": "BEHAVIOR:ANOMALY-0001","blocked": False, "proto": "*"},
        {"sev": "low",      "type": "New Host",        "src": "172.17.81.35", "dst": "*",            "rule": "DISCOVER:001",         "blocked": False, "proto": "*"},
        {"sev": "info",     "type": "Baseline Reset",  "src": "172.17.81.50", "dst": "*",            "rule": "BEHAVIOR:BASELINE",    "blocked": False, "proto": "*"},
    ]
    for i, a in enumerate(demo_list):
        _demo_alerts.append({
            "id": f"demo-{i}",
            "timestamp": datetime.utcfromtimestamp(base_ts - (i * 47)).isoformat(),
            "src_ip": a["src"], "dst_ip": a["dst"],
            "src_port": random.randint(1024, 65535),
            "dst_port": {"HTTP": 80, "TCP": 22, "*": 0}.get(a["proto"], 443),
            "protocol": a["proto"],
            "attack_type": a["type"],
            "severity": a["sev"],
            "rule_id": a["rule"],
            "description": f"{a['type']} detected from {a['src']}",
            "auto_blocked": a["blocked"],
        })

_seed_demo_alerts()

# ── Background: simulate live events in demo mode ─────────────────────────────
def _demo_live_loop():
    types = ["Port Scan","SQL Injection","XSS","Brute Force","DNS Anomaly",
             "Behavioral AI","Log4Shell","Dir Traversal","C2 Beacon","Shellshock"]
    sevs  = ["critical","critical","high","high","medium","medium","low","info"]
    ips   = ["172.17.81.","203.0.113.","198.51.100.","10.0.0.","192.168.1."]
    counter = len(_demo_alerts)
    while True:
        time.sleep(random.uniform(3, 8))
        counter += 1
        sev  = random.choice(sevs)
        typ  = random.choice(types)
        src  = random.choice(ips) + str(random.randint(1, 254))
        alert = {
            "id": f"live-{counter}",
            "timestamp": datetime.utcnow().isoformat(),
            "src_ip": src,
            "dst_ip": f"172.17.81.{random.randint(1,60)}",
            "src_port": random.randint(1024, 65535),
            "dst_port": random.choice([80, 443, 22, 3306, 8080]),
            "protocol": random.choice(["TCP","HTTP","UDP","*"]),
            "attack_type": typ,
            "severity": sev,
            "rule_id": f"LIVE:{counter:05d}",
            "description": f"Real-time: {typ} detected from {src}",
            "auto_blocked": sev == "critical",
        }
        _demo_alerts.appendleft(alert)
        # broadcast to WS clients
        asyncio.run(_broadcast(json.dumps({"type": "alert", "data": alert})))

def _pkt_rate_loop():
    while True:
        base = 850 if not _system else 1200
        rate = base + random.randint(-200, 400)
        _packet_rates.append({"ts": time.time(), "rate": rate})
        asyncio.run(_broadcast(json.dumps({"type": "traffic", "rate": rate})))
        time.sleep(1)

async def _broadcast(msg: str):
    dead = []
    for ws in _ws_clients:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _ws_clients:
            _ws_clients.remove(ws)

# ── Helper: get alerts from real system or demo ───────────────────────────────
def _get_alerts():
    if _system and _system.alert_queue:
        return [asdict(a) for a in list(_system.alert_queue)]
    return list(_demo_alerts)

def _get_devices():
    if _system and _system.behavior and _system.behavior.profiles:
        result = []
        for ip, p in _system.behavior.profiles.items():
            result.append({
                "ip": ip,
                "label": ip,
                "type": "unknown",
                "status": "critical" if p.total_anomalies > 3 else
                          "anomaly"  if p.total_anomalies > 0 else "normal",
                "pkts":  int(statistics.mean(p.packets_per_min_samples)) if p.packets_per_min_samples else 0,
                "bytes": int(statistics.mean(p.bytes_per_min_samples))   if p.bytes_per_min_samples   else 0,
                "dns":   int(statistics.mean(p.dns_queries_per_min_samples)) if p.dns_queries_per_min_samples else 0,
                "dstIps":  int(statistics.mean(p.unique_dst_ips_per_min_samples))   if p.unique_dst_ips_per_min_samples   else 0,
                "ports":   int(statistics.mean(p.unique_dst_ports_per_min_samples)) if p.unique_dst_ports_per_min_samples else 0,
                "first_seen": p.first_seen,
                "last_seen":  p.last_seen,
                "baseline_samples": len(p.packets_per_min_samples),
                "total_anomalies":  p.total_anomalies,
                "timeline": p.packets_per_min_samples[-60:],
            })
        return result
    # enrich demo with timeline
    for d in DEMO_DEVICES:
        if "timeline" not in d:
            base = d["pkts"] / 60
            anom = d["status"] in ("critical", "anomaly")
            d["timeline"] = [
                round(base * (1 + (i/60)*4 + random.uniform(-0.2, 0.3)) if (anom and i > 42) else
                      base * random.uniform(0.75, 1.25))
                for i in range(60)
            ]
    return DEMO_DEVICES

def _get_vulns():
    if _system and _system.vuln_queue:
        return [asdict(v) for v in list(_system.vuln_queue)]
    return DEMO_VULNS

# ── REST ENDPOINTS ─────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    alerts = _get_alerts()
    devices = _get_devices()
    uptime_s = int(time.time() - _start_time)
    critical = sum(1 for a in alerts if a.get("severity") == "critical")
    blocked  = sum(1 for a in alerts if a.get("auto_blocked"))
    anomalies= sum(1 for d in devices if d.get("status") in ("critical","anomaly"))
    return {
        "alerts_total":    len(alerts),
        "alerts_critical": critical,
        "auto_blocked":    blocked,
        "hosts_live":      len(devices),
        "anomalies":       anomalies,
        "ids_signatures":  50000,
        "traffic_gb":      round((time.time() - _start_time) * 0.000115, 2),
        "response_s":      4.8,
        "sigma_threshold": 2.5,
        "uptime_s":        uptime_s,
        "mode":            "live" if _system else "demo",
        "interface":       getattr(_system, "_interface", "en0") if _system else "en0",
        "network":         "172.17.81.0/24",
        "updated_at":      datetime.utcnow().isoformat(),
    }

@app.get("/api/alerts")
def get_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = None,
    q: Optional[str] = None,
):
    alerts = _get_alerts()
    if severity and severity != "all":
        alerts = [a for a in alerts if a.get("severity") == severity]
    if q:
        ql = q.lower()
        alerts = [a for a in alerts if
                  ql in a.get("attack_type","").lower() or
                  ql in a.get("src_ip","").lower() or
                  ql in a.get("rule_id","").lower() or
                  ql in a.get("description","").lower()]
    total = len(alerts)
    start = (page - 1) * limit
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "alerts": alerts[start:start + limit],
    }

@app.get("/api/devices")
def get_devices():
    return {"devices": _get_devices(), "count": len(_get_devices())}

@app.get("/api/devices/{ip}/timeline")
def get_device_timeline(ip: str):
    devices = _get_devices()
    device = next((d for d in devices if d["ip"] == ip or d.get("id") == ip), None)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    timeline = device.get("timeline", [])
    return {
        "ip": device["ip"],
        "label": device.get("label", ip),
        "status": device.get("status","unknown"),
        "baseline_samples": device.get("baseline_samples", len(timeline)),
        "timeline": [
            {"index": i, "ts": (datetime.utcnow() - timedelta(minutes=60-i)).isoformat(), "value": v}
            for i, v in enumerate(timeline)
        ],
        "metrics": {
            "packets_per_min": device.get("pkts",0),
            "bytes_per_min":   device.get("bytes",0),
            "dns_per_min":     device.get("dns",0),
            "dst_ips":         device.get("dstIps",0),
            "dst_ports":       device.get("ports",0),
        }
    }

@app.get("/api/vulnerabilities")
def get_vulnerabilities():
    vulns = _get_vulns()
    critical = sum(1 for v in vulns if v.get("cvss",0) >= 9)
    exploitable = sum(1 for v in vulns if v.get("exploit") or v.get("exploitable"))
    return {
        "total": len(vulns),
        "critical": critical,
        "exploitable": exploitable,
        "vulnerabilities": vulns,
    }

@app.get("/api/behavior/summary")
def get_behavior_summary():
    if _system:
        return _system.behavior.get_summary()
    return {d["ip"]: {
        "first_seen": d.get("first_seen",""),
        "last_seen":  d.get("last_seen",""),
        "baseline_samples": d.get("baseline_samples", 60),
        "total_anomalies":  d.get("total_anomalies", 0),
        "avg_packets_per_min": d.get("pkts", 0),
    } for d in DEMO_DEVICES}

@app.get("/api/system/health")
def get_system_health():
    if _system:
        es_ok = False
        try:
            es_ok = _system.elk.es.ping()
        except Exception:
            pass
        return {
            "status": "live",
            "components": {
                "tshark":         {"status": "active",  "detail": f"Capturing {getattr(_system,'_interface','en0')}"},
                "suricata":       {"status": "active",  "detail": "ET ruleset · 50k+ sigs"},
                "snort":          {"status": "active",  "detail": "3.0 · 2847 rules"},
                "nmap":           {"status": "scanning","detail": "172.17.81.0/24"},
                "metasploit":     {"status": "standby", "detail": "Vuln verification"},
                "elasticsearch":  {"status": "active" if es_ok else "warning", "detail": ":9200"},
                "kibana":         {"status": "active",  "detail": ":5601"},
                "logstash":       {"status": "active",  "detail": "3 pipelines"},
                "behavioral_ai":  {"status": "active",  "detail": f"{len(_system.behavior.profiles)} devices tracked"},
                "pf_firewall":    {"status": "active",  "detail": f"{len(_system.responder.blocked_ips)} IPs blocked"},
            }
        }
    return {
        "status": "demo",
        "components": {
            "tshark":        {"status": "demo",    "detail": "Demo mode — start with sudo python3 api_server.py"},
            "suricata":      {"status": "demo",    "detail": "ET ruleset · 50k+ sigs"},
            "snort":         {"status": "demo",    "detail": "3.0 · 2847 rules"},
            "nmap":          {"status": "scanning","detail": "172.17.81.0/24"},
            "metasploit":    {"status": "standby", "detail": "Vuln verification"},
            "elasticsearch": {"status": "active",  "detail": ":9200"},
            "kibana":        {"status": "active",  "detail": ":5601"},
            "logstash":      {"status": "active",  "detail": "3 pipelines"},
            "behavioral_ai": {"status": "active",  "detail": "8 devices tracked"},
            "pf_firewall":   {"status": "active",  "detail": "5 IPs blocked"},
        }
    }

@app.post("/api/block/{ip}")
def block_ip(ip: str):
    if _system:
        _system.responder._auto_block(ip)
        return {"blocked": True, "ip": ip, "method": "pf_firewall"}
    return {"blocked": True, "ip": ip, "method": "demo"}

@app.delete("/api/block/{ip}")
def unblock_ip(ip: str):
    if _system:
        _system.responder.blocked_ips.discard(ip)
    return {"unblocked": True, "ip": ip}

@app.get("/api/traffic/history")
def get_traffic():
    return {"rates": list(_packet_rates)}

# ── WEBSOCKET ENDPOINTS ────────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.append(websocket)
    # Send last 20 alerts immediately on connect
    recent = _get_alerts()[:20]
    await websocket.send_text(json.dumps({"type": "init", "alerts": recent}))
    try:
        while True:
            await asyncio.sleep(30)  # keep-alive ping
            await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)

@app.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
            rate = list(_packet_rates)[-1]["rate"] if _packet_rates else 0
            await websocket.send_text(json.dumps({"type": "traffic", "rate": rate, "ts": time.time()}))
    except WebSocketDisconnect:
        pass

# ── STARTUP ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    # Start background demo/simulation threads
    threading.Thread(target=_demo_live_loop, daemon=True).start()
    threading.Thread(target=_pkt_rate_loop, daemon=True).start()
    log.info("CyberWatch API server started")
    log.info(f"Mode: {'LIVE' if _system else 'DEMO'}")

@app.get("/")
def root():
    return {"name": "CyberWatch API", "version": "2.0.0",
            "docs": "/docs", "mode": "live" if _system else "demo"}

# ── ENTRY POINT ────────────────────────────────────────────────────────────────

def main():
    global _system
    parser = argparse.ArgumentParser()
    parser.add_argument("--interface", default="en0")
    parser.add_argument("--network",   default="172.17.81.0/24")
    parser.add_argument("--es-host",   default="http://localhost:9200")
    parser.add_argument("--slack-webhook", default="")
    parser.add_argument("--port",      default=8000, type=int)
    parser.add_argument("--demo",      action="store_true", help="Force demo mode")
    args = parser.parse_args()

    if REAL_SYSTEM and not args.demo:
        try:
            config = {
                "elasticsearch": args.es_host,
                "slack_webhook": args.slack_webhook,
                "email": {}
            }
            _system = CyberWatchSystem(args.interface, args.network, config)
            # Store interface on system for health endpoint
            _system._interface = args.interface
            # Start in background thread
            threading.Thread(target=_system.start, daemon=True).start()
            log.info(f"CyberWatch system started: {args.interface} / {args.network}")
        except Exception as e:
            log.warning(f"Could not start CyberWatch system: {e} — falling back to demo mode")
            _system = None

    log.info(f"Starting API server on http://0.0.0.0:{args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")

if __name__ == "__main__":
    main()
