import { useState, useEffect, useRef } from "react";

const ATTACK_PATTERNS = [
  { name: "SQL Injection", severity: "critical", count: 47, trend: "+12%" },
  { name: "Port Scan (Nmap)", severity: "high", count: 234, trend: "+5%" },
  { name: "DDoS Attempt", severity: "critical", count: 8, trend: "-3%" },
  { name: "Brute Force SSH", severity: "high", count: 156, trend: "+23%" },
  { name: "XSS Attack", severity: "medium", count: 89, trend: "+1%" },
  { name: "ARP Spoofing", severity: "critical", count: 3, trend: "new" },
  { name: "DNS Tunneling", severity: "high", count: 12, trend: "+8%" },
  { name: "RFI/LFI", severity: "medium", count: 34, trend: "-2%" },
];

const ALERTS = [
  { id: 1, time: "14:32:11", src: "192.168.1.45", dst: "10.0.0.1", type: "Port Scan", rule: "SNORT:1000001", severity: "high" },
  { id: 2, time: "14:31:58", src: "203.45.67.89", dst: "10.0.0.5", type: "SQL Injection", rule: "SURICATA:2006445", severity: "critical" },
  { id: 3, time: "14:31:44", src: "172.16.0.23", dst: "10.0.0.2", type: "Brute Force", rule: "SNORT:2000001", severity: "high" },
  { id: 4, time: "14:31:20", src: "45.33.32.156", dst: "10.0.0.8", type: "CVE-2023-4911", rule: "SURICATA:2045678", severity: "critical" },
  { id: 5, time: "14:30:55", src: "192.168.2.10", dst: "10.0.0.3", type: "DNS Tunnel", rule: "SNORT:2100366", severity: "medium" },
];

const VULN_DATA = [
  { host: "10.0.0.1", os: "Ubuntu 22.04", open: 3, vulns: 2, score: 7.8 },
  { host: "10.0.0.2", os: "Windows Server", open: 12, vulns: 5, score: 9.1 },
  { host: "10.0.0.3", os: "CentOS 7", open: 6, vulns: 3, score: 6.4 },
  { host: "10.0.0.5", os: "Debian 11", open: 2, vulns: 0, score: 0 },
  { host: "10.0.0.8", os: "FreeBSD 13", open: 4, vulns: 1, score: 5.5 },
];

function Sparkline({ data, color }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 30;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrafficGraph({ packets }) {
  const bars = packets.map((v, i) => ({ v, i }));
  const max = Math.max(...packets);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60 }}>
      {bars.map(({ v, i }) => (
        <div key={i} style={{
          flex: 1, background: `rgba(0,255,128,${0.3 + (v / max) * 0.7})`,
          height: `${(v / max) * 100}%`, borderRadius: 2, transition: "height 0.3s"
        }} />
      ))}
    </div>
  );
}

export default function CyberDashboard() {
  const [packets, setPackets] = useState(Array.from({ length: 30 }, () => Math.random() * 800 + 200));
  const [alerts, setAlerts] = useState(ALERTS);
  const [alertCount, setAlertCount] = useState(583);
  const [bytesProcessed, setBytesProcessed] = useState(4.7);
  const [tick, setTick] = useState(0);
  const [selectedTab, setSelectedTab] = useState("alerts");
  const [blinkCritical, setBlinkCritical] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPackets(p => [...p.slice(1), Math.random() * 900 + 150]);
      setBytesProcessed(b => +(b + Math.random() * 0.03).toFixed(2));
      setAlertCount(c => c + Math.floor(Math.random() * 3));
      setTick(t => t + 1);
      setBlinkCritical(b => !b);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const sev = (s) => ({ critical: "#ff3b5c", high: "#ff8c00", medium: "#ffd700", low: "#00e5ff" }[s] || "#aaa");

  return (
    <div style={{
      background: "#030b14", minHeight: "100vh", color: "#c8ddf0",
      fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      padding: 0, margin: 0
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a1628; } ::-webkit-scrollbar-thumb { background: #0ff; border-radius: 2px; }
        .glow { text-shadow: 0 0 10px currentColor; }
        .card { background: #04111e; border: 1px solid #0a2540; border-radius: 4px; position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, #00ff88, transparent); }
        .crit-blink { animation: blink 1s step-start infinite; }
        @keyframes blink { 50% { opacity: 0.3; } }
        .scan-line { position: relative; overflow: hidden; }
        .scan-line::after { content: ''; position: absolute; top: -100%; left: 0; right: 0; height: 2px; background: linear-gradient(transparent, #00ff88, transparent); animation: scan 3s linear infinite; }
        @keyframes scan { to { top: 200%; } }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 6px 16px; font-family: inherit; font-size: 11px; letter-spacing: 1px; transition: all 0.2s; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        .row-hover:hover { background: rgba(0,255,136,0.05) !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#020a12", borderBottom: "1px solid #0a2540", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 8px #00ff88" }} className="pulse" />
          <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: 18, color: "#00ff88", letterSpacing: 3 }} className="glow">CYBERWATCH</span>
          <span style={{ fontSize: 10, color: "#336", letterSpacing: 2 }}>MONITORING & ANALYSIS SYSTEM v2.4.1</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 11, color: "#4a8fa8" }}>
          <span>SNORT <span style={{ color: "#00ff88" }}>●</span></span>
          <span>SURICATA <span style={{ color: "#00ff88" }}>●</span></span>
          <span>ELK <span style={{ color: "#00ff88" }}>●</span></span>
          <span>NMAP <span style={{ color: "#00ff88" }}>●</span></span>
          <span style={{ color: "#00ff88" }}>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 12 }}>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {[
            { label: "TRAFFIC TODAY", value: `${bytesProcessed} GB`, sub: "of 10GB+ daily", color: "#00ff88" },
            { label: "ALERTS (24H)", value: alertCount.toLocaleString(), sub: "↑ 12% vs yesterday", color: "#ff8c00" },
            { label: "ATTACK DETECT", value: "98.2%", sub: "known patterns", color: "#00e5ff" },
            { label: "VULNS FOUND", value: "15", sub: "critical: 6, high: 9", color: "#ff3b5c" },
            { label: "RESPONSE TIME", value: "−70%", sub: "automated triage", color: "#a855f7" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, color: "#4a8fa8", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, color, fontFamily: "Orbitron, sans-serif" }} className="glow">{value}</div>
              <div style={{ fontSize: 10, color: "#2a5a78", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 12 }}>

          {/* Left column */}
          <div style={{ display: "grid", gap: 12 }}>

            {/* Traffic */}
            <div className="card scan-line" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 10, letterSpacing: 2, color: "#4a8fa8" }}>LIVE PACKET FLOW — DEEP PACKET INSPECTION</span>
                <span style={{ fontSize: 10, color: "#00ff88" }}>{Math.round(packets[packets.length - 1])} pkt/s</span>
              </div>
              <TrafficGraph packets={packets} />
              <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 10, color: "#2a5a78" }}>
                <span>TCP: 67%</span><span>UDP: 21%</span><span>ICMP: 8%</span><span>OTHER: 4%</span>
              </div>
            </div>

            {/* Alerts Table */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 10, letterSpacing: 2, color: "#4a8fa8" }}>IDS/IPS ALERT FEED</span>
                <div style={{ display: "flex", gap: 2 }}>
                  {["alerts", "vulnerabilities", "hosts"].map(t => (
                    <button key={t} className="tab-btn" onClick={() => setSelectedTab(t)}
                      style={{ color: selectedTab === t ? "#00ff88" : "#2a5a78", borderBottom: selectedTab === t ? "1px solid #00ff88" : "none" }}>
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTab === "alerts" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "#2a5a78", borderBottom: "1px solid #0a2540" }}>
                      {["TIME", "SRC IP", "DST IP", "ATTACK TYPE", "RULE", "SEV"].map(h => (
                        <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 9, letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a, i) => (
                      <tr key={a.id} className="row-hover" style={{ borderBottom: "1px solid #0a1e30", background: i === 0 ? "rgba(255,59,92,0.05)" : "transparent" }}>
                        <td style={{ padding: "5px 8px", color: "#4a8fa8" }}>{a.time}</td>
                        <td style={{ padding: "5px 8px", color: "#00e5ff" }}>{a.src}</td>
                        <td style={{ padding: "5px 8px" }}>{a.dst}</td>
                        <td style={{ padding: "5px 8px", color: sev(a.severity) }}>{a.type}</td>
                        <td style={{ padding: "5px 8px", color: "#2a5a78", fontSize: 10 }}>{a.rule}</td>
                        <td style={{ padding: "5px 8px" }}>
                          <span style={{ background: sev(a.severity) + "22", color: sev(a.severity), padding: "2px 6px", borderRadius: 2, fontSize: 9, border: `1px solid ${sev(a.severity)}44` }}>
                            {a.severity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedTab === "vulnerabilities" && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: "#2a5a78", borderBottom: "1px solid #0a2540" }}>
                      {["HOST", "OS", "OPEN PORTS", "VULNS", "CVSS"].map(h => (
                        <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontSize: 9, letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {VULN_DATA.map((v, i) => (
                      <tr key={v.host} className="row-hover" style={{ borderBottom: "1px solid #0a1e30" }}>
                        <td style={{ padding: "5px 8px", color: "#00e5ff" }}>{v.host}</td>
                        <td style={{ padding: "5px 8px", color: "#4a8fa8" }}>{v.os}</td>
                        <td style={{ padding: "5px 8px" }}>{v.open}</td>
                        <td style={{ padding: "5px 8px", color: v.vulns > 3 ? "#ff3b5c" : v.vulns > 0 ? "#ff8c00" : "#00ff88" }}>{v.vulns}</td>
                        <td style={{ padding: "5px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 60, height: 4, background: "#0a2540", borderRadius: 2 }}>
                              <div style={{ width: `${(v.score / 10) * 100}%`, height: "100%", background: v.score >= 9 ? "#ff3b5c" : v.score >= 7 ? "#ff8c00" : "#ffd700", borderRadius: 2 }} />
                            </div>
                            <span style={{ color: v.score >= 9 ? "#ff3b5c" : v.score >= 7 ? "#ff8c00" : "#4a8fa8" }}>{v.score || "—"}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {selectedTab === "hosts" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {VULN_DATA.map(v => (
                    <div key={v.host} style={{ border: "1px solid #0a2540", borderRadius: 4, padding: 10, background: "#020d18" }}>
                      <div style={{ color: "#00e5ff", fontSize: 12, marginBottom: 4 }}>{v.host}</div>
                      <div style={{ color: "#2a5a78", fontSize: 10 }}>{v.os}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, fontSize: 10 }}>
                        <span style={{ color: "#4a8fa8" }}>{v.open} ports</span>
                        <span style={{ color: v.vulns > 0 ? "#ff8c00" : "#00ff88" }}>{v.vulns} vulns</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>

            {/* Attack Patterns */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a8fa8", marginBottom: 12 }}>ATTACK PATTERN MATRIX</div>
              {ATTACK_PATTERNS.map(a => (
                <div key={a.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10 }}>
                    <span style={{ color: a.severity === "critical" ? "#ff3b5c" : a.severity === "high" ? "#ff8c00" : "#ffd700" }}>{a.name}</span>
                    <span style={{ color: "#4a8fa8" }}>{a.count} <span style={{ color: a.trend.startsWith("+") ? "#ff3b5c" : "#00ff88" }}>{a.trend}</span></span>
                  </div>
                  <div style={{ height: 3, background: "#0a2540", borderRadius: 2 }}>
                    <div style={{ width: `${Math.min((a.count / 250) * 100, 100)}%`, height: "100%", background: sev(a.severity), borderRadius: 2, boxShadow: `0 0 6px ${sev(a.severity)}` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tool Status */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#4a8fa8", marginBottom: 12 }}>SYSTEM COMPONENTS</div>
              {[
                { name: "Wireshark/tshark", status: "ACTIVE", detail: "Capturing eth0", color: "#00ff88" },
                { name: "Snort 3.0", status: "ACTIVE", detail: "2847 rules loaded", color: "#00ff88" },
                { name: "Suricata 7.x", status: "ACTIVE", detail: "ET ruleset", color: "#00ff88" },
                { name: "Nmap Scanner", status: "SCANNING", detail: "10.0.0.0/24", color: "#ffd700" },
                { name: "Metasploit", status: "STANDBY", detail: "Vuln verification", color: "#ff8c00" },
                { name: "Elasticsearch", status: "ACTIVE", detail: "47.2M docs", color: "#00ff88" },
                { name: "Kibana", status: "ACTIVE", detail: ":5601", color: "#00ff88" },
                { name: "Logstash", status: "ACTIVE", detail: "3 pipelines", color: "#00ff88" },
              ].map(t => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #0a1e30", fontSize: 10 }}>
                  <span style={{ color: "#c8ddf0" }}>{t.name}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: t.color, fontSize: 9 }}>● {t.status}</div>
                    <div style={{ color: "#2a5a78", fontSize: 9 }}>{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Critical Alert */}
            {blinkCritical && (
              <div style={{ border: "1px solid #ff3b5c", borderRadius: 4, padding: 12, background: "rgba(255,59,92,0.08)" }}>
                <div style={{ color: "#ff3b5c", fontSize: 10, letterSpacing: 2 }}>⚠ CRITICAL ALERT</div>
                <div style={{ color: "#c8ddf0", fontSize: 11, marginTop: 4 }}>CVE-2023-4911 (Looney Tunables) exploit attempt detected on 10.0.0.2</div>
                <div style={{ color: "#4a8fa8", fontSize: 9, marginTop: 4 }}>SRC: 45.33.32.156 | RULE: SURICATA:2045678 | Auto-blocked</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
