// Funciones compartidas por las pantallas (mesas, cocina, administrador, clientes, caja, ventas).
(function () {
  "use strict";
  const U = {};
  U.$ = s => document.querySelector(s);
  U.$$ = s => [...document.querySelectorAll(s)];
  U.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  U.money = n => "$" + U.r2(n).toFixed(2);
  U.money0 = n => n >= 1000 ? "$" + Math.round(n).toLocaleString("es-EC") : U.money(n);
  U.dkey = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  U.todayKey = () => U.dkey(Date.now());
  U.addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return U.dkey(new Date(y, m - 1, d + n)); };
  U.DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  U.MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  U.fmtDay = key => { const [y, m, d] = key.split("-").map(Number); const x = new Date(y, m - 1, d); return U.DIAS[x.getDay()] + " " + d + "/" + m; };
  U.longDay = key => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
  U.hhmm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  U.min = ms => ms == null || !isFinite(ms) ? null : Math.max(0, Math.round(ms / 60000));
  U.dur = ms => { const m = U.min(ms); if (m == null) return "—"; return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; };
  U.rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  U.avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  U.lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  U.lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  U.cleanCode = s => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

  U.CATS = ["Bebidas", "Comida", "Snacks", "Piscina"];
  U.catName = c => c === "Comida" ? "Platos a la carta" : c;
  U.vaACocina = k => k === "Comida";
  U.PAGOS = ["Efectivo", "Transferencia", "Tarjeta"];

  // ---------- avisos ----------
  let toastT;
  U.toast = t => {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3000);
  };
  U.sheet = (html, onMount, wide) => {
    let root = document.getElementById("sheetRoot");
    if (!root) { root = document.createElement("div"); root.id = "sheetRoot"; document.body.appendChild(root); }
    root.innerHTML = `<div class="sheet-bg"><div class="sheet ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    const bg = root.firstElementChild;
    bg.addEventListener("click", e => { if (e.target === bg) close(); });
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    function close() { root.innerHTML = ""; document.removeEventListener("keydown", onKey); }
    onMount && onMount(bg.firstElementChild, close);
    return close;
  };
  // Botón que pide un segundo toque para confirmar.
  U.confirmar = (btn, texto) => {
    if (btn.dataset.armed === "1") { btn.dataset.armed = ""; return true; }
    const orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = texto || "¿Seguro? Toca otra vez";
    btn.classList.add("danger");
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.textContent = orig; btn.classList.remove("danger"); } }, 3500);
    return false;
  };
  // Espera la confirmación del servidor solo unos segundos: sin internet la escritura queda en cola.
  U.guardar = (p, ms = 4000) => Promise.race([p.then(() => "ok"), new Promise(r => setTimeout(() => r("cola"), ms))]);

  // ---------- sonido y notificaciones ----------
  let actx = null;
  U.sonidoListo = () => !!actx && actx.state === "running";
  U.activarSonido = () => {
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {}
    try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {}
    return U.sonidoListo();
  };
  U.beep = (veces = 2, tono = 880) => {
    if (!actx) return;
    for (let i = 0; i < veces; i++) {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.35;
      o.type = "sine"; o.frequency.value = i % 2 ? tono * 1.25 : tono;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
    }
  };
  U.notificar = (titulo, cuerpo) => {
    U.beep(3);
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch {}
    try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(titulo, { body: cuerpo, tag: titulo }); } catch {}
  };
  U.pantallaEncendida = async () => { try { if ("wakeLock" in navigator) await navigator.wakeLock.request("screen"); } catch {} };

  // ---------- clientes ----------
  // Cédula ecuatoriana (10 dígitos, módulo 10). RUC (13) y pasaporte se aceptan sin validar.
  U.cedulaValida = c => {
    c = String(c || "").replace(/\D/g, "");
    if (c.length !== 10) return false;
    const prov = +c.slice(0, 2); if (prov < 1 || (prov > 24 && prov !== 30)) return false;
    if (+c[2] > 5) return false;
    let s = 0; for (let i = 0; i < 9; i++) { let v = +c[i] * (i % 2 ? 1 : 2); if (v > 9) v -= 9; s += v; }
    return (10 - (s % 10)) % 10 === +c[9];
  };
  U.limpiaCed = c => String(c || "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  U.limpiaCel = c => { let x = String(c || "").replace(/\D/g, ""); if (x.startsWith("593")) x = "0" + x.slice(3); return x; };
  U.waCel = c => { const x = U.limpiaCel(c); return x.startsWith("0") ? "593" + x.slice(1) : x; };

  // ---------- cuentas (pedidos) ----------
  U.itemsDe = o => Object.entries(o.items || {}).map(([id, it]) => ({ id, ...it })).sort((a, b) => (a.t || 0) - (b.t || 0));
  U.rondasDe = o => Object.entries(o.rondas || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.t || 0) - (b.t || 0));
  U.totalCuenta = o => U.r2(U.itemsDe(o).reduce((s, i) => s + i.q * i.p, 0));
  U.agrupar = items => {
    const m = {};
    items.forEach(i => { const k = i.c + "|" + i.p; m[k] = m[k] || { c: i.c, n: i.n, k: i.k || "", q: 0, p: Number(i.p) || 0 }; m[k].q += i.q; });
    return Object.values(m);
  };
  U.rondaActiva = r => r.coc && r.est !== "entr" && r.est !== "anul";
  U.etiquetaCuenta = o => o.tipo === "llevar" ? "Para llevar" + (o.mesa ? " · " + o.mesa : "") : o.tipo === "mostrador" ? "Mostrador" + (o.mesa ? " · " + o.mesa : "") : (o.mesa || "Mesa");

  // Agrega una venta al documento del día de esta persona (no choca con otros celulares).
  U.ventaRef = (api, ctx, date) => api.doc("sales/" + (date || U.todayKey()) + "_u" + ctx.uid);
  U.registrarVenta = (batch, api, ctx, sale) => {
    const date = U.dkey(sale.ts);
    batch.set(U.ventaRef(api, ctx, date), { date, device: "u" + ctx.uid, sales: firebase.firestore.FieldValue.arrayUnion(sale) }, { merge: true });
  };
  // Cierra una cuenta: la marca cobrada y la registra como venta.
  U.cerrarCuenta = (api, ctx, o, { pago, prop }) => {
    const items = U.agrupar(U.itemsDe(o));
    const total = U.r2(items.reduce((s, i) => s + i.q * i.p, 0));
    const now = Date.now();
    const sale = { id: o.id, ts: now, items, total, pago, mesa: U.etiquetaCuenta(o), ord: o.id,
      cli: o.cli || null, mes: o.mes || null, caj: { uid: ctx.uid, n: ctx.nombre }, prop: U.r2(prop || 0), pax: o.pax || 0, dur: now - (o.tAbre || now) };
    const b = App.fs.batch();
    const upd = { est: "cerrada", tCierre: now, pago, total, prop: sale.prop, caj: sale.caj };
    if (!U.rondasDe(o).some(U.rondaActiva)) upd.coc = false;
    b.update(api.doc("orders/" + o.id), upd);
    U.registrarVenta(b, api, ctx, sale);
    return { sale, commit: b.commit() };
  };

  // ---------- Google Drive (Apps Script) ----------
  U.drive = {
    _cfg: undefined,
    async cfg(api) {
      if (this._cfg !== undefined) return this._cfg;
      try { const s = await api.doc("config/drive").get(); this._cfg = s.exists && s.data().url ? s.data() : null; } catch { this._cfg = null; }
      return this._cfg;
    },
    // payload: {sub, nombre, tipo:"archivo"|"hoja", mime, base64, filas}
    async enviar(api, payload) {
      const c = await this.cfg(api);
      if (!c) throw new Error("Drive no está configurado. Pídele al administrador que lo active en Administrador → Google Drive.");
      const body = JSON.stringify({ token: c.token || "", ...payload });
      try {
        const r = await fetch(c.url, { method: "POST", body, headers: { "Content-Type": "text/plain;charset=utf-8" }, redirect: "follow" });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error === "token" ? "La clave de Drive no coincide con la del script." : (j.error || "Drive rechazó el archivo"));
        return j;
      } catch (e) {
        if (e instanceof TypeError) { // CORS: se envía igual, sin poder leer la respuesta.
          await fetch(c.url, { method: "POST", body, mode: "no-cors" });
          return { ok: true, sinConfirmar: true };
        }
        throw e;
      }
    }
  };
  U.blobA64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });

  U.cargarScript = src => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src)); document.head.appendChild(s);
  });

  // ---------- inventario ----------
  U.stockDe = (p, ventas) => {
    if (!p || p.track === false || p.cat === "Comida") return null;
    let sold = 0;
    ventas.forEach(s => { if (s.ts > (p.baseAt || 0)) s.items.forEach(it => { if (it.c === p.code) sold += it.q; }); });
    return (Number(p.stockBase) || 0) - sold;
  };
  U.filasInventario = (products, ventas) => {
    const filas = [["Código", "Producto", "Categoría", "Precio", "Stock", "Mínimo", "Estado"]];
    Object.values(products).sort((a, b) => a.code.localeCompare(b.code)).forEach(p => {
      const st = U.stockDe(p, ventas);
      const est = st === null ? (p.cat === "Comida" ? "Se prepara" : "Sin control") : st <= 0 ? "Agotado" : st <= (Number(p.min) || 0) ? "Bajo" : "OK";
      filas.push([p.code, p.name, U.catName(p.cat), Number(p.price) || 0, st === null ? "" : st, p.cat === "Comida" ? "" : (p.min ?? ""), est]);
    });
    return filas;
  };

  // ---------- resumen ejecutivo del día ----------
  // ventas: [{ts, items, total, pago, mes, cli, prop, ...}] del día; cuentas: pedidos del día; dia: cierre de caja (opcional)
  U.resumenDia = ({ nombre, date, ventas, ventasPrev, cuentas, dia, products, todasVentas, metaCocina }) => {
    const meta = metaCocina || 15;
    const total = U.r2(ventas.reduce((s, v) => s + (Number(v.total) || 0), 0));
    const tickets = ventas.length;
    const porPago = {}; ventas.forEach(v => { const k = v.pago || "Efectivo"; porPago[k] = U.r2((porPago[k] || 0) + v.total); });
    const porCat = {}, prod = {}, porHora = {};
    ventas.forEach(v => {
      const h = new Date(v.ts).getHours(); porHora[h] = U.r2((porHora[h] || 0) + v.total);
      v.items.forEach(i => {
        porCat[i.k] = U.r2((porCat[i.k] || 0) + i.q * i.p);
        prod[i.c] = prod[i.c] || { c: i.c, n: i.n, k: i.k, q: 0, v: 0 }; prod[i.c].q += i.q; prod[i.c].v = U.r2(prod[i.c].v + i.q * i.p);
      });
    });
    const top = Object.values(prod).sort((a, b) => b.v - a.v);
    const mes = {};
    ventas.forEach(v => { const k = v.mes && v.mes.n ? v.mes.n : "Mostrador"; mes[k] = mes[k] || { n: k, ventas: 0, cuentas: 0, prop: 0, ent: [], dur: [] }; mes[k].ventas = U.r2(mes[k].ventas + v.total); mes[k].cuentas++; mes[k].prop = U.r2(mes[k].prop + (v.prop || 0)); if (v.dur && v.ord) mes[k].dur.push(v.dur); });
    // tiempos
    const prep = [], espera = [], entrega = [];
    let tarde = 0, rondas = 0;
    (cuentas || []).forEach(o => U.rondasDe(o).forEach(r => {
      if (!r.coc || r.est === "anul") return;
      rondas++;
      if (r.listo) { espera.push(r.listo - r.t); if (r.ini) prep.push(r.listo - r.ini); if (r.listo - r.t > meta * 60000) tarde++; }
      if (r.ent && r.listo) { entrega.push(r.ent - r.listo); const k = o.mes && o.mes.n ? o.mes.n : "Mostrador"; mes[k] = mes[k] || { n: k, ventas: 0, cuentas: 0, prop: 0, ent: [], dur: [] }; mes[k].ent.push(r.ent - r.listo); }
    }));
    const meseros = Object.values(mes).map(m => ({ n: m.n, ventas: m.ventas, cuentas: m.cuentas, prom: m.cuentas ? U.r2(m.ventas / m.cuentas) : 0, prop: m.prop, entrega: U.avg(m.ent), dur: U.avg(m.dur) })).sort((a, b) => b.ventas - a.ventas);
    const clientes = new Set(ventas.filter(v => v.cli && v.cli.ced).map(v => v.cli.ced)).size;
    const anul = [];
    (cuentas || []).forEach(o => (o.anul || []).forEach(a => anul.push({ ...a, cuenta: U.etiquetaCuenta(o) })));
    (cuentas || []).filter(o => o.est === "anulada").forEach(o => anul.push({ n: "Cuenta completa", q: 1, p: U.totalCuenta(o), por: o.anuladaPor || "", cuenta: U.etiquetaCuenta(o) }));
    const gastos = dia ? (dia.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0) : 0;
    const propinas = U.r2(ventas.reduce((s, v) => s + (v.prop || 0), 0) || (dia && dia.tips) || 0);
    const efectivo = porPago.Efectivo || 0;
    const esperado = U.r2(efectivo + propinas - gastos);
    const contado = dia && dia.cashCounted != null ? dia.cashCounted : null;
    const stockBajo = products ? Object.values(products).map(p => ({ p, st: U.stockDe(p, todasVentas || ventas) })).filter(x => x.st !== null && x.st <= (Number(x.p.min) || 0) && x.p.active !== false).map(x => ({ c: x.p.code, n: x.p.name, st: x.st })) : [];
    const totalPrev = ventasPrev ? U.r2(ventasPrev.reduce((s, v) => s + (Number(v.total) || 0), 0)) : null;
    return {
      nombre, date, total, tickets, prom: tickets ? U.r2(total / tickets) : 0, porPago, porCat, top, porHora, meseros, clientes,
      tiempos: { rondas, prep: U.avg(prep), espera: U.avg(espera), max: espera.length ? Math.max(...espera) : null, entrega: U.avg(entrega), tarde, meta },
      anul, gastos: U.r2(gastos), gastosDet: dia ? (dia.expenses || []) : [], propinas, neto: U.r2(total - gastos), esperado, contado,
      diferencia: contado == null ? null : U.r2(contado - esperado), stockBajo, totalPrev, notas: dia ? dia.notes || "" : ""
    };
  };
  U.resumenTexto = d => {
    const L = [];
    L.push("*" + d.nombre + " — Resumen del día*");
    L.push(U.longDay(d.date).replace(/^./, c => c.toUpperCase()));
    L.push("");
    L.push("💰 Ventas: *" + U.money(d.total) + "* en " + d.tickets + " cuentas (promedio " + U.money(d.prom) + ")");
    if (d.totalPrev != null && d.totalPrev > 0) { const p = Math.round((d.total - d.totalPrev) / d.totalPrev * 100); L.push((p >= 0 ? "📈 " : "📉 ") + Math.abs(p) + "% " + (p >= 0 ? "más" : "menos") + " que el mismo día de la semana pasada (" + U.money(d.totalPrev) + ")"); }
    L.push("💳 " + Object.entries(d.porPago).map(([k, v]) => k + " " + U.money(v)).join(" · "));
    if (d.top.length) L.push("⭐ Más vendidos: " + d.top.slice(0, 3).map((x, i) => (i + 1) + ") " + x.n + " (" + x.q + ")").join("  "));
    if (d.meseros.length) L.push("🧑‍🍳 Meseros: " + d.meseros.map(m => m.n + " " + U.money(m.ventas)).join(" · "));
    if (d.tiempos.rondas) L.push("⏱️ Cocina: " + d.tiempos.rondas + " comandas, espera promedio " + U.dur(d.tiempos.espera) + (d.tiempos.tarde ? ", " + d.tiempos.tarde + " pasaron de " + d.tiempos.meta + " min" : ""));
    if (d.clientes) L.push("👥 Clientes registrados atendidos: " + d.clientes);
    L.push("🧾 Gastos " + U.money(d.gastos) + " · Venta menos gastos " + U.money(d.neto));
    if (d.diferencia != null) L.push("💵 Caja: " + (d.diferencia === 0 ? "cuadrada" : (d.diferencia > 0 ? "sobrante " : "faltante ") + U.money(Math.abs(d.diferencia))));
    if (d.anul.length) L.push("⚠️ Anulaciones: " + d.anul.length + " por " + U.money(d.anul.reduce((s, a) => s + a.q * a.p, 0)));
    if (d.stockBajo.length) L.push("📦 Reponer: " + d.stockBajo.slice(0, 6).map(x => x.n + " (" + x.st + ")").join(", "));
    if (d.notas) L.push("📝 " + d.notas);
    return L.join("\n");
  };
  U.imagenDataUrl = src => new Promise(res => {
    if (!src) return res(null);
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { try { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0); res(c.toDataURL("image/jpeg", 0.9)); } catch { res(null); } };
    img.onerror = () => res(null); img.src = src;
  });
  U.resumenPdf = async (d, logo) => {
    await U.cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210, M = 16; let y = 16;
    const verde = [0, 152, 74], cafe = [94, 74, 44], gris = [120, 120, 110];
    const salto = h => { if (y + h > 282) { doc.addPage(); y = 16; } };
    const img = await U.imagenDataUrl(logo);
    if (img) { try { doc.addImage(img, "JPEG", M, y - 2, 22, 22); } catch {} }
    const tx = img ? M + 27 : M;
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...verde); doc.text(d.nombre, tx, y + 5);
    doc.setFontSize(12); doc.setTextColor(...cafe); doc.text("Resumen ejecutivo del día", tx, y + 11);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...gris);
    doc.text(U.longDay(d.date).replace(/^./, c => c.toUpperCase()) + " · generado " + new Date().toLocaleString("es"), tx, y + 16);
    y += 26; doc.setDrawColor(...verde); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 7;
    // indicadores
    const kp = [["Ventas", U.money(d.total)], ["Cuentas", String(d.tickets)], ["Ticket promedio", U.money(d.prom)], ["Venta - gastos", U.money(d.neto)]];
    const bw = (W - 2 * M - 9) / 4;
    kp.forEach(([l, v], i) => {
      const x = M + i * (bw + 3);
      doc.setFillColor(237, 245, 230); doc.roundedRect(x, y, bw, 18, 2, 2, "F");
      doc.setFontSize(8); doc.setTextColor(...gris); doc.text(l.toUpperCase(), x + 3, y + 5);
      doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 42, 27); doc.text(v, x + 3, y + 13); doc.setFont("helvetica", "normal");
    });
    y += 24;
    if (d.totalPrev != null && d.totalPrev > 0) {
      const p = Math.round((d.total - d.totalPrev) / d.totalPrev * 100);
      doc.setFontSize(10); doc.setTextColor(...(p >= 0 ? verde : [215, 20, 30]));
      doc.text((p >= 0 ? "+" : "-") + Math.abs(p) + "% frente al mismo día de la semana pasada (" + U.money(d.totalPrev) + ")", M, y); y += 7;
    }
    const titulo = t => { salto(14); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...cafe); doc.text(t, M, y); doc.setFont("helvetica", "normal"); y += 2; doc.setDrawColor(211, 223, 194); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 5; };
    const tabla = (cols, filas, anchos) => {
      doc.setFontSize(9); doc.setTextColor(...gris);
      let x = M; cols.forEach((c, i) => { doc.text(c, i ? x + anchos[i] - 2 : x, y, { align: i ? "right" : "left" }); x += anchos[i]; }); y += 5;
      doc.setFontSize(10); doc.setTextColor(30, 42, 27);
      filas.forEach(f => { salto(6); x = M; f.forEach((c, i) => { const t = String(c); doc.text(i ? t : doc.splitTextToSize(t, anchos[0] - 2)[0], i ? x + anchos[i] - 2 : x, y, { align: i ? "right" : "left" }); x += anchos[i]; }); y += 5.5; });
      y += 3;
    };
    const ancho = W - 2 * M;
    titulo("Ventas por forma de pago");
    tabla(["Forma de pago", "Monto", "%"], Object.entries(d.porPago).map(([k, v]) => [k, U.money(v), d.total ? Math.round(v / d.total * 100) + "%" : ""]), [ancho - 60, 35, 25]);
    if (d.meseros.length) {
      titulo("Desempeño por mesero");
      tabla(["Mesero", "Cuentas", "Ventas", "Promedio", "Entrega", "Mesa abierta"], d.meseros.map(m => [m.n, m.cuentas, U.money(m.ventas), U.money(m.prom), U.dur(m.entrega), U.dur(m.dur)]), [ancho - 125, 20, 27, 27, 24, 27]);
    }
    titulo("Productos más vendidos");
    tabla(["Producto", "Unidades", "Ventas"], d.top.slice(0, 10).map(x => [x.n, x.q, U.money(x.v)]), [ancho - 60, 30, 30]);
    titulo("Ventas por categoría");
    tabla(["Categoría", "Ventas", "%"], Object.entries(d.porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => [U.catName(k), U.money(v), d.total ? Math.round(v / d.total * 100) + "%" : ""]), [ancho - 60, 35, 25]);
    if (d.tiempos.rondas) {
      titulo("Tiempos de cocina y servicio");
      tabla(["Indicador", "Valor"], [
        ["Comandas enviadas a cocina", d.tiempos.rondas],
        ["Espera promedio (envío a listo)", U.dur(d.tiempos.espera)],
        ["Preparación promedio (inicio a listo)", U.dur(d.tiempos.prep)],
        ["Espera más larga", U.dur(d.tiempos.max)],
        ["Entrega promedio del mesero (listo a la mesa)", U.dur(d.tiempos.entrega)],
        ["Comandas que pasaron de " + d.tiempos.meta + " min", d.tiempos.tarde]], [ancho - 40, 40]);
    }
    titulo("Caja");
    const caja = [["Efectivo vendido", U.money(d.porPago.Efectivo || 0)], ["Propinas", U.money(d.propinas)], ["Gastos pagados", U.money(d.gastos)], ["Efectivo esperado en caja", U.money(d.esperado)]];
    if (d.contado != null) caja.push(["Efectivo contado", U.money(d.contado)], [d.diferencia === 0 ? "Caja cuadrada" : d.diferencia > 0 ? "Sobrante" : "Faltante", U.money(Math.abs(d.diferencia))]);
    tabla(["Concepto", "Monto"], caja, [ancho - 40, 40]);
    if (d.gastosDet.length) { titulo("Detalle de gastos"); tabla(["Concepto", "Monto"], d.gastosDet.map(e => [e.desc || "Gasto", U.money(e.amount)]), [ancho - 40, 40]); }
    if (d.anul.length) { titulo("Anulaciones (control)"); tabla(["Detalle", "Cuenta", "Monto"], d.anul.map(a => [a.q + "× " + a.n + (a.por ? " - " + a.por : ""), a.cuenta, U.money(a.q * a.p)]), [ancho - 75, 45, 30]); }
    if (d.stockBajo.length) { titulo("Productos por reponer"); tabla(["Producto", "Stock"], d.stockBajo.map(x => [x.c + " · " + x.n, x.st]), [ancho - 30, 30]); }
    if (d.notas) { titulo("Notas"); doc.setFontSize(10); doc.setTextColor(30, 42, 27); doc.splitTextToSize(d.notas, ancho).forEach(l => { salto(6); doc.text(l, M, y); y += 5; }); }
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...gris); doc.text(d.nombre + " · Resumen " + d.date + " · pág. " + i + "/" + n, W / 2, 292, { align: "center" }); }
    return doc.output("blob");
  };

  // ---------- carga de datos comunes ----------
  U.ventasDe = docs => {
    const out = [];
    docs.forEach(d => { const v = d.data ? d.data() : d; (v.sales || []).forEach(s => out.push({ ...s, _date: v.date, _doc: d.id })); });
    return out;
  };

  window.U = U;
})();
