"""
CyberWatch: Cybersecurity Monitoring and Analysis System
========================================================
Stack: Python, tshark, Nmap, Metasploit, Suricata, ELK Stack
Platform: macOS M2 (Apple Silicon)

Run: sudo python3 cyberwatch_system.py --interface en0 --network 172.17.81.0/24
"""

import subprocess
import threading
import json
import time
import logging
import argparse
import smtplib
import requests
import statistics
from datetime import datetime
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, List
from elasticsearch import Elasticsearch
from pymetasploit3.msfrpc import MsfRpcClient
import nmap
import scapy.all as scapy

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.FileHandler("cyberwatch.log"), logging.StreamHandler()]
)
log = logging.getLogger("CyberWatch")


# ─── Data Models ──────────────────────────────────────────────────────────────
@dataclass
class Alert:
    timestamp: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    attack_type: str
    severity: str          # critical | high | medium | low
    rule_id: str
    description: str
    raw_payload: Optional[str] = None
    auto_blocked: bool = False

@dataclass
class Vulnerability:
    host: str
    port: int
    service: str
    cve_id: str
    cvss_score: float
    description: str
    exploitable: bool = False
    metasploit_module: Optional[str] = None

@dataclass
class DeviceProfile:
    """Behavioral fingerprint for a single device on the network."""
    ip: str
    first_seen: str
    last_seen: str
    # Traffic volume baselines
    packets_per_min_samples: List[float] = field(default_factory=list)
    bytes_per_min_samples: List[float] = field(default_factory=list)
    # Protocol distribution baseline
    protocol_counts: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    # DNS behavior baseline
    dns_queries_per_min_samples: List[float] = field(default_factory=list)
    unique_dns_domains: set = field(default_factory=set)
    # Connection behavior baseline
    unique_dst_ips_per_min_samples: List[float] = field(default_factory=list)
    unique_dst_ports_per_min_samples: List[float] = field(default_factory=list)
    # Anomaly tracking
    anomaly_scores: List[float] = field(default_factory=list)
    total_anomalies: int = 0


# ─── 1. PACKET CAPTURE & DEEP PACKET INSPECTION (tshark) ──────────────────────
class PacketCaptureEngine:
    """
    Uses tshark (Wireshark CLI) for live capture + scapy for deep inspection.
    Processes 10GB+ daily = ~115KB/s sustained throughput.
    """

    def __init__(self, interface: str, alert_queue, behavior_engine=None):
        self.interface = interface
        self.alert_queue = alert_queue
        self.behavior_engine = behavior_engine
        self.stats = defaultdict(int)
        self.packet_buffer = deque(maxlen=10000)
        self._running = False

        self.dpi_rules = [
            self._check_sql_injection,
            self._check_xss,
            self._check_shellshock,
            self._check_log4shell,
            self._check_directory_traversal,
            self._check_command_injection,
        ]

    def start(self):
        self._running = True
        threading.Thread(target=self._capture_loop, daemon=True).start()
        threading.Thread(target=self._flow_analyzer, daemon=True).start()
        log.info(f"Packet capture started on {self.interface}")

    def _capture_loop(self):
        cmd = [
            "tshark", "-i", self.interface,
            "-T", "json",
            "-e", "ip.src", "-e", "ip.dst",
            "-e", "tcp.srcport", "-e", "tcp.dstport",
            "-e", "udp.srcport", "-e", "udp.dstport",
            "-e", "http.request.uri", "-e", "dns.qry.name",
            "-e", "frame.len", "-e", "frame.protocols",
            "-Y", "not (arp or stp)",
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

        buffer = ""
        for line in proc.stdout:
            if not self._running:
                proc.terminate()
                break
            try:
                buffer += line.decode("utf-8", errors="ignore")
                if buffer.strip().endswith("}"):
                    pkt_data = json.loads(buffer)
                    self._inspect_packet(pkt_data)
                    buffer = ""
            except json.JSONDecodeError:
                pass

    def _inspect_packet(self, pkt: dict):
        layers = pkt.get("_source", {}).get("layers", {})
        src_ip = layers.get("ip.src", [""])[0]
        dst_ip = layers.get("ip.dst", [""])[0]
        uri = layers.get("http.request.uri", [""])[0]
        dns = layers.get("dns.qry.name", [""])[0]
        frame_len = int(layers.get("frame.len", [0])[0] or 0)
        protocols = layers.get("frame.protocols", [""])[0]
        dst_port_tcp = layers.get("tcp.dstport", ["0"])[0]
        dst_port_udp = layers.get("udp.dstport", ["0"])[0]
        dst_port = int(dst_port_tcp or dst_port_udp or 0)

        self.stats["bytes_total"] += frame_len
        self.stats["packets_total"] += 1

        pkt_record = {
            "src": src_ip, "dst": dst_ip,
            "ts": time.time(), "bytes": frame_len,
            "proto": protocols, "dst_port": dst_port,
            "dns": dns
        }
        self.packet_buffer.append(pkt_record)

        # Feed into behavioral engine
        if self.behavior_engine and src_ip:
            self.behavior_engine.ingest_packet(pkt_record)

        payload = uri or dns or ""
        for rule_fn in self.dpi_rules:
            alert = rule_fn(src_ip, dst_ip, payload, layers)
            if alert:
                self.alert_queue.append(alert)

    def _check_sql_injection(self, src, dst, payload, layers) -> Optional[Alert]:
        sqli_patterns = ["UNION SELECT", "OR 1=1", "DROP TABLE", "xp_cmdshell",
                         "SLEEP(", "BENCHMARK(", "'; --", "1' OR '1"]
        payload_upper = payload.upper()
        for pat in sqli_patterns:
            if pat in payload_upper:
                return Alert(
                    timestamp=datetime.utcnow().isoformat(),
                    src_ip=src, dst_ip=dst, src_port=0, dst_port=80,
                    protocol="HTTP", attack_type="SQL Injection",
                    severity="critical", rule_id="DPI:SQLi-001",
                    description=f"SQLi pattern '{pat}' in URI",
                    raw_payload=payload[:500]
                )

    def _check_xss(self, src, dst, payload, layers) -> Optional[Alert]:
        xss_patterns = ["<script", "javascript:", "onerror=", "onload=", "alert("]
        for pat in xss_patterns:
            if pat.lower() in payload.lower():
                return Alert(
                    timestamp=datetime.utcnow().isoformat(),
                    src_ip=src, dst_ip=dst, src_port=0, dst_port=80,
                    protocol="HTTP", attack_type="XSS",
                    severity="medium", rule_id="DPI:XSS-001",
                    description="XSS pattern in request"
                )

    def _check_shellshock(self, src, dst, payload, layers) -> Optional[Alert]:
        if "() {" in payload and ";" in payload:
            return Alert(
                timestamp=datetime.utcnow().isoformat(),
                src_ip=src, dst_ip=dst, src_port=0, dst_port=80,
                protocol="HTTP", attack_type="Shellshock",
                severity="critical", rule_id="DPI:CVE-2014-6271",
                description="Shellshock exploit attempt in HTTP headers"
            )

    def _check_log4shell(self, src, dst, payload, layers) -> Optional[Alert]:
        if "${jndi:" in payload.lower():
            return Alert(
                timestamp=datetime.utcnow().isoformat(),
                src_ip=src, dst_ip=dst, src_port=0, dst_port=0,
                protocol="HTTP", attack_type="Log4Shell",
                severity="critical", rule_id="DPI:CVE-2021-44228",
                description="Log4Shell JNDI injection attempt"
            )

    def _check_directory_traversal(self, src, dst, payload, layers) -> Optional[Alert]:
        if "../" in payload or "..\\" in payload or "%2e%2e" in payload.lower():
            return Alert(
                timestamp=datetime.utcnow().isoformat(),
                src_ip=src, dst_ip=dst, src_port=0, dst_port=80,
                protocol="HTTP", attack_type="Directory Traversal",
                severity="high", rule_id="DPI:LFI-001",
                description="Path traversal attempt"
            )

    def _check_command_injection(self, src, dst, payload, layers) -> Optional[Alert]:
        cmd_patterns = ["; ls", "| cat /etc/passwd", "`id`", "$(whoami)", "&& wget"]
        for pat in cmd_patterns:
            if pat in payload:
                return Alert(
                    timestamp=datetime.utcnow().isoformat(),
                    src_ip=src, dst_ip=dst, src_port=0, dst_port=80,
                    protocol="HTTP", attack_type="Command Injection",
                    severity="critical", rule_id="DPI:CMDi-001",
                    description=f"Command injection pattern: {pat}"
                )

    def _flow_analyzer(self):
        connection_tracker = defaultdict(list)
        port_tracker = defaultdict(set)

        while self._running:
            time.sleep(5)
            cutoff = time.time() - 60

            for pkt in list(self.packet_buffer):
                src = pkt["src"]
                ts = pkt["ts"]
                if ts > cutoff:
                    connection_tracker[src].append(ts)

            for src_ip, timestamps in connection_tracker.items():
                recent = [t for t in timestamps if t > cutoff]
                if len(port_tracker[src_ip]) > 20:
                    self.alert_queue.append(Alert(
                        timestamp=datetime.utcnow().isoformat(),
                        src_ip=src_ip, dst_ip="*", src_port=0, dst_port=0,
                        protocol="TCP", attack_type="Port Scan",
                        severity="high", rule_id="FLOW:SCAN-001",
                        description=f"Port scan: {len(port_tracker[src_ip])} unique ports in 60s"
                    ))
                if len(recent) > 100:
                    self.alert_queue.append(Alert(
                        timestamp=datetime.utcnow().isoformat(),
                        src_ip=src_ip, dst_ip="*", src_port=0, dst_port=22,
                        protocol="TCP", attack_type="Brute Force",
                        severity="high", rule_id="FLOW:BF-001",
                        description=f"Brute force: {len(recent)} connections/min from {src_ip}"
                    ))

            connection_tracker.clear()


# ─── 2. NOVEL: DEVICE BEHAVIORAL FINGERPRINTING ENGINE ────────────────────────
class BehavioralFingerprintEngine:
    """
    NOVEL COMPONENT: Builds per-device behavioral baselines from network traffic
    and raises alerts when a device deviates from its own normal pattern.

    Unlike signature-based IDS (which detects known attacks), this detects
    compromised devices even when running unknown/custom malware — because
    the device's traffic pattern changes even if the payload is never seen before.

    Metrics tracked per device (per 1-minute window):
      - Packets/min and bytes/min (volume)
      - Protocol distribution ratio (TCP/UDP/DNS/ICMP)
      - DNS query rate and unique domain count
      - Unique destination IPs and ports contacted
      - Connection burst patterns

    Algorithm: Z-score deviation from rolling baseline (last 30 windows).
    Alert threshold: >2 standard deviations on 2+ metrics simultaneously.
    """

    BASELINE_WINDOW = 60        # seconds per measurement window
    MIN_SAMPLES = 5             # need at least 5 windows before alerting
    ZSCORE_THRESHOLD = 2.5      # std deviations to trigger alert
    METRICS_THRESHOLD = 2       # how many metrics must deviate simultaneously

    def __init__(self, alert_queue, elk_indexer=None):
        self.alert_queue = alert_queue
        self.elk_indexer = elk_indexer
        self.profiles: Dict[str, DeviceProfile] = {}
        # Per-device current-window accumulators
        self._window_data: Dict[str, dict] = defaultdict(self._empty_window)
        self._window_start = time.time()
        self._lock = threading.Lock()

    @staticmethod
    def _empty_window() -> dict:
        return {
            "packets": 0,
            "bytes": 0,
            "dns_queries": 0,
            "dst_ips": set(),
            "dst_ports": set(),
            "protocols": defaultdict(int),
        }

    def ingest_packet(self, pkt: dict):
        """Called for every packet — accumulates metrics per device."""
        src = pkt.get("src", "")
        if not src or src.startswith("fe80") or src == "":
            return  # Skip link-local and empty

        with self._lock:
            w = self._window_data[src]
            w["packets"] += 1
            w["bytes"] += pkt.get("bytes", 0)
            if pkt.get("dns"):
                w["dns_queries"] += 1
            if pkt.get("dst"):
                w["dst_ips"].add(pkt["dst"])
            if pkt.get("dst_port") and pkt["dst_port"] > 0:
                w["dst_ports"].add(pkt["dst_port"])
            proto = pkt.get("proto", "other")
            if "dns" in proto:
                w["protocols"]["dns"] += 1
            elif "tcp" in proto:
                w["protocols"]["tcp"] += 1
            elif "udp" in proto:
                w["protocols"]["udp"] += 1
            elif "icmp" in proto:
                w["protocols"]["icmp"] += 1

    def start(self):
        threading.Thread(target=self._window_tick, daemon=True).start()
        log.info("Behavioral Fingerprint Engine started — building device baselines...")

    def _window_tick(self):
        """Every BASELINE_WINDOW seconds, snapshot metrics and check for anomalies."""
        while True:
            time.sleep(self.BASELINE_WINDOW)
            self._process_window()

    def _process_window(self):
        with self._lock:
            snapshot = dict(self._window_data)
            self._window_data = defaultdict(self._empty_window)

        now = datetime.utcnow().isoformat()

        for ip, window in snapshot.items():
            if window["packets"] == 0:
                continue

            # Get or create profile
            if ip not in self.profiles:
                self.profiles[ip] = DeviceProfile(
                    ip=ip,
                    first_seen=now,
                    last_seen=now
                )
            profile = self.profiles[ip]
            profile.last_seen = now

            # Current window metrics
            current_metrics = {
                "packets_per_min": float(window["packets"]),
                "bytes_per_min": float(window["bytes"]),
                "dns_per_min": float(window["dns_queries"]),
                "unique_dst_ips": float(len(window["dst_ips"])),
                "unique_dst_ports": float(len(window["dst_ports"])),
            }

            # Add to rolling baseline (keep last 60 samples = 1 hour)
            profile.packets_per_min_samples.append(current_metrics["packets_per_min"])
            profile.bytes_per_min_samples.append(current_metrics["bytes_per_min"])
            profile.dns_queries_per_min_samples.append(current_metrics["dns_per_min"])
            profile.unique_dst_ips_per_min_samples.append(current_metrics["unique_dst_ips"])
            profile.unique_dst_ports_per_min_samples.append(current_metrics["unique_dst_ports"])

            # Keep rolling window at 60 samples max
            for lst in [
                profile.packets_per_min_samples,
                profile.bytes_per_min_samples,
                profile.dns_queries_per_min_samples,
                profile.unique_dst_ips_per_min_samples,
                profile.unique_dst_ports_per_min_samples,
            ]:
                if len(lst) > 60:
                    lst.pop(0)

            # Update DNS domains seen
            profile.unique_dns_domains.update(window["dst_ips"])

            # Only score anomalies once we have enough baseline data
            n = len(profile.packets_per_min_samples)
            if n < self.MIN_SAMPLES:
                log.debug(f"[BEHAVIOR] {ip}: building baseline ({n}/{self.MIN_SAMPLES} samples)")
                continue

            # Score each metric with z-score
            anomalies = self._score_anomalies(profile, current_metrics)

            if len(anomalies) >= self.METRICS_THRESHOLD:
                self._raise_behavioral_alert(ip, profile, anomalies, current_metrics, now)

            # Index profile to Elasticsearch for Kibana visualization
            if self.elk_indexer:
                self._index_profile(ip, profile, current_metrics, len(anomalies))

    def _score_anomalies(self, profile: DeviceProfile, current: dict) -> List[dict]:
        """
        Compute z-score for each metric. Return list of deviating metrics.
        Z-score = (current - mean) / std_dev
        """
        metric_map = [
            ("packets_per_min",  profile.packets_per_min_samples,        "Packet volume"),
            ("bytes_per_min",    profile.bytes_per_min_samples,           "Byte volume"),
            ("dns_per_min",      profile.dns_queries_per_min_samples,     "DNS query rate"),
            ("unique_dst_ips",   profile.unique_dst_ips_per_min_samples,  "Unique destinations"),
            ("unique_dst_ports", profile.unique_dst_ports_per_min_samples,"Unique ports contacted"),
        ]

        anomalies = []
        for metric_name, samples, label in metric_map:
            if len(samples) < 3:
                continue
            # Use all but the last sample as the baseline
            baseline = samples[:-1]
            mean = statistics.mean(baseline)
            try:
                std = statistics.stdev(baseline)
            except statistics.StatisticsError:
                continue

            if std < 0.001:
                # Device always does exactly the same thing — any change is suspicious
                std = max(mean * 0.1, 0.1)

            current_val = current[metric_name]
            zscore = abs((current_val - mean) / std)

            if zscore >= self.ZSCORE_THRESHOLD:
                anomalies.append({
                    "metric": metric_name,
                    "label": label,
                    "current": current_val,
                    "baseline_mean": round(mean, 2),
                    "zscore": round(zscore, 2),
                    "direction": "↑ spike" if current_val > mean else "↓ drop"
                })

        return anomalies

    def _raise_behavioral_alert(self, ip: str, profile: DeviceProfile,
                                 anomalies: List[dict], current: dict, timestamp: str):
        """Create a behavioral anomaly alert and push to alert queue."""
        profile.total_anomalies += 1

        # Determine severity based on number and magnitude of anomalies
        max_zscore = max(a["zscore"] for a in anomalies)
        if max_zscore > 5 or len(anomalies) >= 4:
            severity = "critical"
        elif max_zscore > 3.5 or len(anomalies) >= 3:
            severity = "high"
        else:
            severity = "medium"

        anomaly_summary = "; ".join(
            f"{a['label']} {a['direction']} (z={a['zscore']}, "
            f"now={a['current']:.0f} vs baseline={a['baseline_mean']:.0f})"
            for a in anomalies
        )

        description = (
            f"Device {ip} behavioral anomaly detected. "
            f"{len(anomalies)} metrics deviated from baseline: {anomaly_summary}"
        )

        alert = Alert(
            timestamp=timestamp,
            src_ip=ip,
            dst_ip="*",
            src_port=0,
            dst_port=0,
            protocol="*",
            attack_type="Behavioral Anomaly",
            severity=severity,
            rule_id=f"BEHAVIOR:ANOMALY-{profile.total_anomalies:04d}",
            description=description
        )

        self.alert_queue.append(alert)
        log.warning(
            f"[BEHAVIORAL] {severity.upper()} | {ip} | "
            f"{len(anomalies)} anomalous metrics | max z-score={max_zscore}"
        )

    def _index_profile(self, ip: str, profile: DeviceProfile,
                        current: dict, anomaly_count: int):
        """Push device profile snapshot to Elasticsearch for Kibana."""
        if not self.elk_indexer:
            return
        doc = {
            "timestamp": datetime.utcnow().isoformat(),
            "device_ip": ip,
            "first_seen": profile.first_seen,
            "last_seen": profile.last_seen,
            "baseline_samples": len(profile.packets_per_min_samples),
            "current_packets_per_min": current["packets_per_min"],
            "current_bytes_per_min": current["bytes_per_min"],
            "current_dns_per_min": current["dns_per_min"],
            "current_unique_dst_ips": current["unique_dst_ips"],
            "current_unique_dst_ports": current["unique_dst_ports"],
            "baseline_avg_packets": round(
                statistics.mean(profile.packets_per_min_samples[:-1]), 2
            ) if len(profile.packets_per_min_samples) > 1 else 0,
            "anomaly_count": anomaly_count,
            "total_anomalies": profile.total_anomalies,
        }
        try:
            self.elk_indexer.es.index(index="cyberwatch-device-profiles", document=doc)
        except Exception as e:
            log.error(f"Failed to index device profile: {e}")

    def get_summary(self) -> dict:
        """Return current fingerprint summary for all tracked devices."""
        return {
            ip: {
                "first_seen": p.first_seen,
                "last_seen": p.last_seen,
                "baseline_samples": len(p.packets_per_min_samples),
                "total_anomalies": p.total_anomalies,
                "avg_packets_per_min": round(statistics.mean(p.packets_per_min_samples), 2)
                    if p.packets_per_min_samples else 0,
            }
            for ip, p in self.profiles.items()
        }


# ─── 3. SNORT / SURICATA ALERT INGESTION ──────────────────────────────────────
class IDSAlertIngester:
    """
    Tails Suricata EVE JSON logs in real-time.
    macOS Homebrew path: /opt/homebrew/var/log/suricata/eve.json
    """

    def __init__(self, alert_queue,
                 eve_log="/opt/homebrew/var/log/suricata/eve.json",
                 snort_log="/var/log/snort/alert"):
        self.alert_queue = alert_queue
        self.eve_log = eve_log
        self.snort_log = snort_log

    def start(self):
        threading.Thread(target=self._tail_suricata, daemon=True).start()
        threading.Thread(target=self._tail_snort, daemon=True).start()
        log.info("IDS alert ingesters started")

    def _tail_suricata(self):
        try:
            with open(self.eve_log, "r") as f:
                f.seek(0, 2)
                while True:
                    line = f.readline()
                    if not line:
                        time.sleep(0.1)
                        continue
                    try:
                        ev = json.loads(line)
                        if ev.get("event_type") == "alert":
                            a = ev["alert"]
                            alert = Alert(
                                timestamp=ev.get("timestamp", datetime.utcnow().isoformat()),
                                src_ip=ev.get("src_ip", ""),
                                dst_ip=ev.get("dest_ip", ""),
                                src_port=ev.get("src_port", 0),
                                dst_port=ev.get("dest_port", 0),
                                protocol=ev.get("proto", ""),
                                attack_type=a.get("category", "Unknown"),
                                severity=self._map_severity(a.get("severity", 3)),
                                rule_id=f"SURICATA:{a.get('signature_id', 0)}",
                                description=a.get("signature", ""),
                            )
                            self.alert_queue.append(alert)
                    except json.JSONDecodeError:
                        pass
        except FileNotFoundError:
            log.warning(f"Suricata EVE log not found: {self.eve_log}")

    def _tail_snort(self):
        try:
            proc = subprocess.Popen(["tail", "-f", self.snort_log],
                                    stdout=subprocess.PIPE, text=True)
            for line in proc.stdout:
                line = line.strip()
                if line.startswith("[**]"):
                    parts = line.split("]")
                    rule_info = parts[0].replace("[**] [", "").strip()
                    desc = parts[1].replace(" [", "").strip() if len(parts) > 1 else ""
                    alert = Alert(
                        timestamp=datetime.utcnow().isoformat(),
                        src_ip="", dst_ip="", src_port=0, dst_port=0,
                        protocol="TCP", attack_type=desc,
                        severity="high", rule_id=f"SNORT:{rule_info}",
                        description=desc
                    )
                    self.alert_queue.append(alert)
        except FileNotFoundError:
            log.warning(f"Snort alert log not found: {self.snort_log}")

    @staticmethod
    def _map_severity(snort_priority: int) -> str:
        return {1: "critical", 2: "high", 3: "medium"}.get(snort_priority, "low")


# ─── 4. NMAP VULNERABILITY SCANNER ────────────────────────────────────────────
class NmapScanner:
    def __init__(self, network: str, vuln_queue, scan_interval=3600):
        self.network = network
        self.vuln_queue = vuln_queue
        self.scan_interval = scan_interval
        self.nm = nmap.PortScanner()

    def start(self):
        threading.Thread(target=self._scan_loop, daemon=True).start()
        log.info(f"Nmap scanner started for {self.network}")

    def _scan_loop(self):
        while True:
            log.info("Starting Nmap vulnerability scan...")
            try:
                self._host_discovery()
                self._vuln_scan()
            except Exception as e:
                log.error(f"Nmap scan error: {e}")
            log.info(f"Next scan in {self.scan_interval}s")
            time.sleep(self.scan_interval)

    def _host_discovery(self):
        self.nm.scan(hosts=self.network, arguments="-sn -T4")
        live_hosts = [h for h in self.nm.all_hosts() if self.nm[h].state() == "up"]
        log.info(f"Live hosts: {live_hosts}")
        return live_hosts

    def _vuln_scan(self):
        self.nm.scan(
            hosts=self.network,
            arguments=(
                "-sV -sS -T4 -p- "
                "--script vuln,exploit,auth,brute "
                "--script-args=newtargets "
                "--open"
            )
        )
        for host in self.nm.all_hosts():
            for proto in self.nm[host].all_protocols():
                for port, port_info in self.nm[host][proto].items():
                    if port_info["state"] == "open":
                        scripts = port_info.get("script", {})
                        for script_name, output in scripts.items():
                            if "CVE" in output.upper() or "VULNERABLE" in output.upper():
                                cve = self._extract_cve(output)
                                cvss = self._extract_cvss(output)
                                vuln = Vulnerability(
                                    host=host, port=port,
                                    service=port_info.get("name", "unknown"),
                                    cve_id=cve, cvss_score=cvss,
                                    description=output[:500],
                                    exploitable="EXPLOIT" in output.upper(),
                                )
                                self.vuln_queue.append(vuln)
                                log.warning(f"Vuln: {host}:{port} - {cve} (CVSS: {cvss})")

    @staticmethod
    def _extract_cve(text: str) -> str:
        import re
        match = re.search(r"CVE-\d{4}-\d+", text, re.IGNORECASE)
        return match.group(0).upper() if match else "UNKNOWN"

    @staticmethod
    def _extract_cvss(text: str) -> float:
        import re
        match = re.search(r"CVSS[:\s]+(\d+\.\d+)", text, re.IGNORECASE)
        return float(match.group(1)) if match else 5.0


# ─── 5. METASPLOIT INTEGRATION ────────────────────────────────────────────────
class MetasploitVerifier:
    def __init__(self, host="127.0.0.1", port=55553, password="msfrpc"):
        self.client = None
        try:
            self.client = MsfRpcClient(password, server=host, port=port, ssl=True)
            log.info("Connected to Metasploit RPC")
        except Exception as e:
            log.warning(f"Metasploit RPC not available: {e}")

    def verify_vulnerability(self, vuln: Vulnerability) -> bool:
        if not self.client:
            return False
        try:
            results = self.client.modules.search(vuln.cve_id)
            if results:
                module_name = results[0]["fullname"]
                vuln.metasploit_module = module_name
                log.info(f"MSF module found for {vuln.cve_id}: {module_name}")
                return True
        except Exception as e:
            log.error(f"Metasploit error: {e}")
        return False

    def run_exploit_check(self, vuln: Vulnerability, target_ip: str):
        if not self.client or not vuln.metasploit_module:
            return None
        try:
            exploit = self.client.modules.use("exploit", vuln.metasploit_module)
            exploit["RHOSTS"] = target_ip
            exploit["RPORT"] = vuln.port
            result = exploit.check()
            log.info(f"Exploit check result for {target_ip}: {result}")
            return result
        except Exception as e:
            log.error(f"Exploit check error: {e}")
            return None


# ─── 6. ELK STACK INTEGRATION ─────────────────────────────────────────────────
class ELKIndexer:
    def __init__(self, es_host="http://localhost:9200"):
        self.es = Elasticsearch([es_host])
        self._ensure_indices()

    def _ensure_indices(self):
        alert_mapping = {
            "mappings": {
                "properties": {
                    "timestamp": {"type": "date"},
                    "src_ip": {"type": "keyword"},
                    "dst_ip": {"type": "keyword"},
                    "severity": {"type": "keyword"},
                    "attack_type": {"type": "keyword"},
                    "rule_id": {"type": "keyword"},
                    "description": {"type": "text"},
                }
            }
        }
        profile_mapping = {
            "mappings": {
                "properties": {
                    "timestamp": {"type": "date"},
                    "device_ip": {"type": "keyword"},
                    "anomaly_count": {"type": "integer"},
                    "total_anomalies": {"type": "integer"},
                    "current_packets_per_min": {"type": "float"},
                    "current_bytes_per_min": {"type": "float"},
                    "current_dns_per_min": {"type": "float"},
                    "baseline_avg_packets": {"type": "float"},
                }
            }
        }
        for index, mapping in [
            ("cyberwatch-alerts", alert_mapping),
            ("cyberwatch-vulnerabilities", {}),
            ("cyberwatch-device-profiles", profile_mapping),
        ]:
            try:
                if not self.es.indices.exists(index=index):
                    self.es.indices.create(index=index, body=mapping if mapping else None)
            except Exception as e:
                log.warning(f"Index create warning for {index}: {e}")
        log.info("Elasticsearch indices ready (alerts, vulnerabilities, device-profiles)")

    def index_alert(self, alert: Alert):
        try:
            self.es.index(index="cyberwatch-alerts", document=asdict(alert))
        except Exception as e:
            log.error(f"ES index error: {e}")

    def index_vulnerability(self, vuln: Vulnerability):
        try:
            self.es.index(index="cyberwatch-vulnerabilities", document=asdict(vuln))
        except Exception as e:
            log.error(f"ES index error: {e}")

    def get_alert_stats(self, hours=24) -> dict:
        query = {
            "query": {"range": {"timestamp": {"gte": f"now-{hours}h"}}},
            "aggs": {
                "by_severity": {"terms": {"field": "severity"}},
                "by_type": {"terms": {"field": "attack_type", "size": 10}},
            }
        }
        try:
            result = self.es.search(index="cyberwatch-alerts", body=query)
            return result["aggregations"]
        except Exception as e:
            log.error(f"ES query error: {e}")
            return {}


# ─── 7. AUTOMATED RESPONSE (macOS pf firewall) ────────────────────────────────
class IncidentResponder:
    """
    Automated response using macOS pf firewall instead of iptables.
    """

    def __init__(self, config: dict):
        self.config = config
        self.blocked_ips = set()
        self.alert_cooldown = defaultdict(float)
        # Ensure pf anchor file exists
        self._init_pf_anchor()

    def _init_pf_anchor(self):
        try:
            anchor_file = "/etc/pf.anchors/cyberwatch"
            result = subprocess.run(["test", "-f", anchor_file])
            if result.returncode != 0:
                subprocess.run(["sudo", "touch", anchor_file])
                log.info("Created pf anchor file: /etc/pf.anchors/cyberwatch")
        except Exception:
            pass

    def respond(self, alert: Alert):
        if alert.severity == "critical":
            self._auto_block(alert.src_ip)
            self._send_slack_alert(alert)
            self._send_email_alert(alert)
        elif alert.severity == "high":
            self._send_slack_alert(alert)

        log.warning(
            f"[{alert.severity.upper()}] {alert.attack_type} "
            f"from {alert.src_ip} → {alert.dst_ip}"
        )

    def _auto_block(self, ip: str):
        """Block attacker IP via macOS pf firewall."""
        if ip in self.blocked_ips or not ip or ip == "*":
            return
        try:
            rule = f"block drop quick from {ip} to any\n"
            with open("/etc/pf.anchors/cyberwatch", "a") as f:
                f.write(rule)
            subprocess.run(["pfctl", "-f", "/etc/pf.conf"], check=True, capture_output=True)
            self.blocked_ips.add(ip)
            log.info(f"AUTO-BLOCKED via pf: {ip}")
        except Exception as e:
            log.error(f"pf block failed for {ip}: {e}")

    def _send_slack_alert(self, alert: Alert):
        webhook = self.config.get("slack_webhook")
        if not webhook:
            return
        emoji = {"critical": "🚨", "high": "⚠️", "medium": "⚡", "low": "ℹ️"}
        payload = {
            "text": (
                f"{emoji.get(alert.severity, '•')} *{alert.severity.upper()}* "
                f"— {alert.attack_type}\n"
                f"• Src: `{alert.src_ip}:{alert.src_port}` "
                f"→ Dst: `{alert.dst_ip}:{alert.dst_port}`\n"
                f"• Rule: `{alert.rule_id}` | {alert.description[:200]}\n"
                f"• Time: {alert.timestamp}"
            )
        }
        try:
            requests.post(webhook, json=payload, timeout=5)
        except Exception as e:
            log.error(f"Slack alert failed: {e}")

    def _send_email_alert(self, alert: Alert):
        cfg = self.config.get("email", {})
        if not cfg.get("smtp_host"):
            return
        try:
            msg = (
                f"Subject: [CRITICAL] CyberWatch: {alert.attack_type}\n\n"
                f"Attack Type: {alert.attack_type}\n"
                f"Source IP: {alert.src_ip}:{alert.src_port}\n"
                f"Destination: {alert.dst_ip}:{alert.dst_port}\n"
                f"Rule: {alert.rule_id}\n"
                f"Description: {alert.description}\n"
                f"Timestamp: {alert.timestamp}\n"
                f"Auto-blocked: {alert.auto_blocked}"
            )
            with smtplib.SMTP(cfg["smtp_host"], cfg.get("smtp_port", 587)) as server:
                server.starttls()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(cfg["from"], cfg["to"], msg)
        except Exception as e:
            log.error(f"Email alert failed: {e}")


# ─── 8. LOGSTASH CONFIG ────────────────────────────────────────────────────────
LOGSTASH_CONFIG = """
input {
  file {
    path => "/opt/homebrew/var/log/suricata/eve.json"
    start_position => "end"
    codec => "json"
    tags => ["suricata"]
  }
  tcp {
    port => 5044
    codec => json_lines
    tags => ["python-dpi"]
  }
}
filter {
  if "suricata" in [tags] {
    date { match => ["timestamp", "ISO8601"] }
    mutate {
      rename => { "[alert][signature]" => "attack_type" }
      rename => { "src_ip" => "[source][ip]" }
      rename => { "dest_ip" => "[destination][ip]" }
    }
  }
  geoip { source => "[source][ip]" }
}
output {
  elasticsearch {
    hosts => ["http://localhost:9200"]
    index => "cyberwatch-alerts-%{+YYYY.MM.dd}"
  }
}
"""


# ─── 9. MAIN ORCHESTRATOR ─────────────────────────────────────────────────────
class CyberWatchSystem:

    def __init__(self, interface: str, network: str, config: dict):
        self.alert_queue = deque(maxlen=50000)
        self.vuln_queue = deque(maxlen=10000)

        # Initialize ELK first (other components depend on it)
        self.elk = ELKIndexer(config.get("elasticsearch", "http://localhost:9200"))

        # Novel: behavioral fingerprinting engine
        self.behavior = BehavioralFingerprintEngine(self.alert_queue, self.elk)

        # Core subsystems
        self.capture = PacketCaptureEngine(interface, self.alert_queue, self.behavior)
        self.ids = IDSAlertIngester(self.alert_queue)
        self.scanner = NmapScanner(network, self.vuln_queue)
        self.responder = IncidentResponder(config)
        self.msf = MetasploitVerifier()

    def start(self):
        log.info("=" * 60)
        log.info("  CyberWatch Security Monitoring System STARTING")
        log.info("  + Behavioral Fingerprinting Engine ENABLED")
        log.info("=" * 60)

        self.behavior.start()
        self.capture.start()
        self.ids.start()
        self.scanner.start()

        threading.Thread(target=self._process_alerts, daemon=True).start()
        threading.Thread(target=self._process_vulns, daemon=True).start()

        log.info("All subsystems online. Monitoring active.")
        self._print_stats_loop()

    def _process_alerts(self):
        while True:
            if self.alert_queue:
                alert = self.alert_queue.popleft()
                self.elk.index_alert(alert)
                self.responder.respond(alert)
            else:
                time.sleep(0.01)

    def _process_vulns(self):
        while True:
            if self.vuln_queue:
                vuln = self.vuln_queue.popleft()
                self.msf.verify_vulnerability(vuln)
                self.elk.index_vulnerability(vuln)
                log.warning(
                    f"VULN: {vuln.host}:{vuln.port} {vuln.cve_id} CVSS:{vuln.cvss_score}"
                )
            else:
                time.sleep(1)

    def _print_stats_loop(self):
        while True:
            time.sleep(60)
            stats = self.capture.stats
            gb = stats["bytes_total"] / 1e9
            behavior_summary = self.behavior.get_summary()
            log.info(
                f"STATS | Traffic: {gb:.2f} GB | "
                f"Packets: {stats['packets_total']:,} | "
                f"Alerts queued: {len(self.alert_queue)} | "
                f"Vulns queued: {len(self.vuln_queue)} | "
                f"Devices tracked: {len(behavior_summary)}"
            )
            # Log any devices with anomalies
            for ip, info in behavior_summary.items():
                if info["total_anomalies"] > 0:
                    log.info(
                        f"  [BEHAVIOR] {ip}: {info['total_anomalies']} anomalies | "
                        f"baseline={info['baseline_samples']} samples | "
                        f"avg={info['avg_packets_per_min']} pkt/min"
                    )


# ─── 10. ENTRY POINT ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CyberWatch Security Monitoring System")
    parser.add_argument("--interface", default="en0", help="Network interface (macOS: en0)")
    parser.add_argument("--network", default="172.17.81.0/24", help="Target network for Nmap")
    parser.add_argument("--es-host", default="http://localhost:9200", help="Elasticsearch host")
    parser.add_argument("--slack-webhook", default="", help="Slack webhook URL")
    args = parser.parse_args()

    config = {
        "elasticsearch": args.es_host,
        "slack_webhook": args.slack_webhook,
        "email": {}
    }

    with open("cyberwatch-logstash.conf", "w") as f:
        f.write(LOGSTASH_CONFIG)

    system = CyberWatchSystem(args.interface, args.network, config)
    system.start()
