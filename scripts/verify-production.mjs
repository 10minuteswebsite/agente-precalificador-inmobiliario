const baseUrl = process.argv[2] ?? "https://agente-enrutador.vercel.app";
const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`);
if (!response.ok) throw new Error(`health_http_${response.status}`);
const health = await response.json();
const required = ["persistence", "signature_verification", "outbound_messaging"];
const missing = required.filter((key) => health[key] !== true);
console.log(JSON.stringify({ baseUrl, ok: health.ok === true, health, missing }, null, 2));
if (missing.length) process.exitCode = 1;
