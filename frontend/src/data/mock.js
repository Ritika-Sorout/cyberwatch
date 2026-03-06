export const DEVICES = [
  { id:'gw',  label:'Gateway',      ip:'172.17.81.1',  type:'router', status:'normal',   pkts:4821,  bytes:2.1e6, dns:12, dstIps:24, ports:18 },
  { id:'mb',  label:'MacBook Air',  ip:'172.17.81.10', type:'laptop', status:'normal',   pkts:1204,  bytes:8.4e5, dns:31, dstIps:12, ports:8  },
  { id:'tp',  label:'ThinkPad Dev', ip:'172.17.81.11', type:'laptop', status:'anomaly',  pkts:9821,  bytes:5.2e6, dns:88, dstIps:64, ports:42 },
  { id:'ip',  label:'iPhone 15',    ip:'172.17.81.20', type:'mobile', status:'normal',   pkts:312,   bytes:1.8e5, dns:9,  dstIps:7,  ports:4  },
  { id:'an',  label:'Pixel 8',      ip:'172.17.81.21', type:'mobile', status:'warning',  pkts:1821,  bytes:1.1e6, dns:45, dstIps:31, ports:22 },
  { id:'cam', label:'IP Camera',    ip:'172.17.81.31', type:'iot',    status:'critical', pkts:18240, bytes:1.2e7, dns:124,dstIps:88, ports:71 },
  { id:'tv',  label:'Smart TV',     ip:'172.17.81.32', type:'iot',    status:'normal',   pkts:421,   bytes:3.2e5, dns:6,  dstIps:4,  ports:3  },
  { id:'nas', label:'NAS Server',   ip:'172.17.81.50', type:'server', status:'normal',   pkts:2104,  bytes:1.4e6, dns:18, dstIps:14, ports:9  },
];

export const EDGES = [
  { s:'gw', t:'mb',  traffic:'normal'     },
  { s:'gw', t:'tp',  traffic:'suspicious' },
  { s:'gw', t:'ip',  traffic:'normal'     },
  { s:'gw', t:'an',  traffic:'elevated'   },
  { s:'gw', t:'cam', traffic:'critical'   },
  { s:'gw', t:'tv',  traffic:'normal'     },
  { s:'gw', t:'nas', traffic:'normal'     },
  { s:'mb', t:'nas', traffic:'normal'     },
  { s:'tp', t:'cam', traffic:'critical'   },
];

export const ALERTS = [
  { id:'a1',  ts: Date.now()-12000,  sev:'critical', type:'Port Scan',       src:'172.17.81.31', rule:'ET SCAN Masscan',              blocked:true  },
  { id:'a2',  ts: Date.now()-48000,  sev:'critical', type:'SQL Injection',   src:'10.0.0.44',    rule:'ET WEB_SERVER SQL Injection',   blocked:true  },
  { id:'a3',  ts: Date.now()-91000,  sev:'high',     type:'Behavioral AI',   src:'172.17.81.11', rule:'Anomaly: +4.2σ multi-metric',   blocked:false },
  { id:'a4',  ts: Date.now()-134000, sev:'high',     type:'Brute Force',     src:'203.0.113.5',  rule:'ET POLICY SSH BruteForce',      blocked:true  },
  { id:'a5',  ts: Date.now()-210000, sev:'medium',   type:'XSS Probe',       src:'198.51.100.8', rule:'ET WEB_SERVER XSS Script Tag',  blocked:false },
  { id:'a6',  ts: Date.now()-290000, sev:'medium',   type:'Log4Shell',       src:'192.0.2.77',   rule:'CVE-2021-44228 JNDI Probe',     blocked:true  },
  { id:'a7',  ts: Date.now()-350000, sev:'medium',   type:'Behavioral AI',   src:'172.17.81.21', rule:'Anomaly: +3.1σ DstPort+Bytes',  blocked:false },
  { id:'a8',  ts: Date.now()-420000, sev:'low',      type:'Dir Traversal',   src:'203.0.113.88', rule:'ET WEB_SERVER Path Traversal',  blocked:false },
  { id:'a9',  ts: Date.now()-500000, sev:'low',      type:'Shellshock',      src:'198.51.100.2', rule:'ET WEB_SERVER Shellshock',      blocked:false },
  { id:'a10', ts: Date.now()-610000, sev:'info',     type:'New Host',        src:'172.17.81.35', rule:'Discovery: unknown device',     blocked:false },
];

export const VULNS = [
  { id:'v1', cve:'CVE-2021-44228', host:'172.17.81.50', service:'Log4j 2.14',   cvss:10.0, exploit:true,  desc:'RCE via JNDI lookup' },
  { id:'v2', cve:'CVE-2022-0847',  host:'172.17.81.11', service:'Linux 5.15',   cvss:7.8,  exploit:true,  desc:'Dirty Pipe LPE' },
  { id:'v3', cve:'CVE-2023-44487', host:'172.17.81.1',  service:'nginx 1.18',   cvss:7.5,  exploit:false, desc:'HTTP/2 Rapid Reset DoS' },
  { id:'v4', cve:'CVE-2021-3156',  host:'172.17.81.50', service:'sudo 1.9.5',   cvss:7.0,  exploit:true,  desc:'Baron Samedit heap overflow' },
  { id:'v5', cve:'CVE-2024-1086',  host:'172.17.81.11', service:'nf_tables',    cvss:7.8,  exploit:false, desc:'netfilter use-after-free LPE' },
];

export const STATS = {
  alerts:44424, hosts:16, sigs:50000, trafficGB:10, responseS:5, sigma:2.5, baselineMin:60,
};

// Generate behavioral timeline for a device
export function genTimeline(device, points=60) {
  const base = device.pkts / points;
  return Array.from({length: points}, (_,i) => {
    const anomaly = device.status !== 'normal' && i >= 42;
    const ramp = anomaly ? (i-42)/(points-42) : 0;
    return {
      t: Date.now() - (points-i)*60000,
      v: Math.round(base * (anomaly ? (1 + ramp*4 + Math.random()*1.5) : (0.8+Math.random()*0.4))),
      anomaly,
    };
  });
}
