// Conecta las pantallas con Firebase.
// Cada restaurante guarda sus datos en restaurantes/{uidDueño}/...
// El dueño entra con su cuenta; el personal (hasta 5 meseros, cocina, caja y un administrador)
// entra con su propia cuenta, enlazada en miembros/{uidPersona} -> {rest, slot, rol, nombre}.
(function () {
  "use strict";
  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  const auth = firebase.auth();
  const fs = firebase.firestore();

  // Funciona sin internet: guarda en el dispositivo y sincroniza al reconectar.
  const ready = fs.enablePersistence({ synchronizeTabs: true }).catch(() => {});

  // ---------- Modo sin internet ----------
  // Firestore aplica cada cambio al instante en el celular, pero su promesa solo termina cuando
  // el servidor confirma. Sin señal eso puede tardar horas y la pantalla se quedaba "pensando".
  // Aquí la escritura se da por hecha en cuanto queda guardada en el celular; el envío al
  // servidor sigue en segundo plano y Firestore lo reintenta solo al volver el internet.
  const SYNC = { pend: 0, ok: 0, listeners: [] };
  const syncAviso = () => SYNC.listeners.forEach(fn => { try { fn(SYNC); } catch {} });
  const espera = ms => new Promise(r => setTimeout(r, ms));
  function rapido(p) {
    SYNC.pend++; syncAviso();
    p.then(() => { SYNC.ok++; }, e => { try { window.dispatchEvent(new CustomEvent("cr-error-escritura", { detail: e })); } catch {} })
     .finally(() => { SYNC.pend = Math.max(0, SYNC.pend - 1); syncAviso(); });
    // Con internet el servidor responde en menos de 1,5 s (y los errores de permisos llegan a quien llamó).
    return Promise.race([p, espera(navigator.onLine ? 1500 : 150)]);
  }
  const FS = firebase.firestore;
  [[FS.DocumentReference, ["set", "update", "delete"]], [FS.WriteBatch, ["commit"]]].forEach(([C, ms]) => {
    if (!C || !C.prototype) return;
    ms.forEach(m => { const o = C.prototype[m]; if (!o || o.__cr) return;
      const f = function (...a) {
        return rapido(o.apply(this, a));
      };
      f.__cr = true; C.prototype[m] = f; });
  });
  // Lecturas: si el servidor no contesta pronto (sin señal o internet muy lento) se usa la copia del celular.
  [FS.DocumentReference, FS.Query].forEach(C => {
    if (!C || !C.prototype) return;
    const o = C.prototype.get; if (!o || o.__cr) return;
    const f = function (opts) {
      if (opts && opts.source) return o.call(this, opts);
      const srv = o.call(this);
      const limite = navigator.onLine ? 5000 : 0;
      return Promise.race([srv, espera(limite).then(() => { throw { code: "cr-lento" }; })]).catch(e => {
        if (e && e.code === "permission-denied") throw e;
        return o.call(this, { source: "cache" }).then(r => { if (C === FS.DocumentReference && !r.exists && e.code === "cr-lento") return srv; return r; },
          () => { if (e.code === "cr-lento") return srv; throw e; });
      });
    };
    f.__cr = true; C.prototype.get = f;
  });
  // Al abrir: ¿quedaron cambios de una sesión anterior sin enviar?
  let pendAnt = false;
  ready.then(() => { let listo = false; fs.waitForPendingWrites().then(() => { listo = true; if (pendAnt) { pendAnt = false; SYNC.ok++; syncAviso(); } }).catch(() => {});
    setTimeout(() => { if (!listo) { pendAnt = true; syncAviso(); } }, 800); });

  // Aviso pequeño en pantalla: sin internet / sincronizando / sincronizado.
  function pintaRed() {
    const off = !navigator.onLine, n = SYNC.pend + (pendAnt ? 1 : 0);
    let el = document.getElementById("crRed");
    if (!el) {
      if (!document.body) return;
      el = document.createElement("div"); el.id = "crRed";
      el.style.cssText = "position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;padding:8px 14px;border-radius:999px;font:600 13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18);max-width:calc(100% - 24px);text-align:center;transition:opacity .3s;pointer-events:none";
      document.body.appendChild(el);
    }
    let t = "", bg = "";
    if (off) { t = "📴 Sin internet · todo se guarda en este celular" + (n ? " (" + (pendAnt && !SYNC.pend ? "cambios" : n + (n === 1 ? " cambio" : " cambios")) + " por enviar)" : "") + " y se sincroniza al volver"; bg = "#5E4A2C"; }
    else if (n) { t = "🔄 Sincronizando cambios guardados sin internet…"; bg = "#7b5cd6"; }
    else if (SYNC.mostrarOk) { t = "✅ Sincronizado"; bg = "#00984A"; }
    el.textContent = t; el.style.background = bg; el.style.color = "#fff"; el.style.opacity = t ? "1" : "0";
  }
  let teniaPend = false, offAntes = !navigator.onLine;
  SYNC.listeners.push(() => {
    const n = SYNC.pend + (pendAnt ? 1 : 0);
    if (n && (!navigator.onLine || offAntes)) teniaPend = true;
    if (!n && teniaPend && navigator.onLine) { teniaPend = false; SYNC.mostrarOk = true; setTimeout(() => { SYNC.mostrarOk = false; pintaRed(); }, 3000); }
    pintaRed();
  });
  window.addEventListener("offline", () => { offAntes = true; if (SYNC.pend) teniaPend = true; pintaRed(); });
  window.addEventListener("online", () => { if (SYNC.pend || pendAnt) teniaPend = true; else if (offAntes) { SYNC.mostrarOk = true; setTimeout(() => { SYNC.mostrarOk = false; pintaRed(); }, 3000); } offAntes = false; pintaRed(); });
  document.addEventListener("DOMContentLoaded", pintaRed);

  const firstUser = new Promise(res => {
    const off = auth.onAuthStateChanged(u => { off(); res(u); });
  });

  const ROLES = { admin: "Administrador", mesero: "Mesero", cocina: "Cocina", caja: "Caja" };
  const SLOTS = [
    { id: "admin", rol: "admin", t: "Administrador" },
    { id: "m1", rol: "mesero", t: "Mesero 1" }, { id: "m2", rol: "mesero", t: "Mesero 2" },
    { id: "m3", rol: "mesero", t: "Mesero 3" }, { id: "m4", rol: "mesero", t: "Mesero 4" },
    { id: "m5", rol: "mesero", t: "Mesero 5" },
    { id: "cocina", rol: "cocina", t: "Cocina" }, { id: "caja", rol: "caja", t: "Caja" }
  ];

  function scoped(uid) {
    const root = fs.collection("restaurantes").doc(uid);
    return {
      doc(path) { const [c, id] = String(path).split("/"); return root.collection(c).doc(id); },
      collection(name) { return root.collection(name); },
      root
    };
  }

  // Averigua a qué restaurante pertenece la cuenta y con qué rol.
  // Devuelve {estado:"ok"|"sin-cuenta"|"error", ctx}
  let ctxPromise = null;
  function resolveCtx(user) {
    if (ctxPromise) return ctxPromise;
    ctxPromise = (async () => {
      await ready;
      if (!user) return { estado: "sin-sesion" };
      const base = { uid: user.uid, email: user.email || "" };
      // 1) ¿Es dueño?
      try {
        const own = await fs.collection("restaurantes").doc(user.uid).get();
        if (own.exists) {
          const r = own.data();
          let nombre = "";
          try { const g = await own.ref.collection("config").doc("general").get(); nombre = g.exists ? g.data().duenoNombre || "" : ""; } catch {}
          return { estado: "ok", ctx: { ...base, rest: user.uid, dueno: true, rol: "admin", slot: "dueno", nombre: nombre || "Administrador", r } };
        }
      } catch (e) {
        if (e && e.code !== "permission-denied") return { estado: "error", error: e };
      }
      // 2) ¿Es parte del personal?
      try {
        const m = await fs.collection("miembros").doc(user.uid).get();
        if (!m.exists) return { estado: "sin-cuenta" };
        const md = m.data();
        const rs = await fs.collection("restaurantes").doc(md.rest).get();
        if (!rs.exists) return { estado: "sin-cuenta" };
        return { estado: "ok", ctx: { ...base, rest: md.rest, dueno: false, rol: md.rol, slot: md.slot, nombre: md.nombre || user.email, r: rs.data() } };
      } catch (e) {
        if (e && e.code === "permission-denied") return { estado: "sin-cuenta" };
        return { estado: "error", error: e };
      }
    })();
    return ctxPromise;
  }

  const vence = r => (r && r.vence && r.vence.toDate ? r.vence.toDate() : null);
  const activa = r => { const v = vence(r); return !!v && v > new Date(); };

  const downloads = {
    save({ filename, data, mime }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      return Promise.resolve();
    }
  };

  // El personal entra con su puesto y un PIN. Por dentro, Firebase usa un correo y una clave
  // derivados del código del restaurante, el puesto y el PIN (nadie tiene que escribirlos).
  const limpiaCodigo = c => String(c || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const correoPersonal = (slot, codigo) => slot + "." + limpiaCodigo(codigo) + "@personal.cajarestaurante.app";
  const clavePin = pin => "pin-" + String(pin) + "-cr";

  const goHome = () => { (window.top || window).location.href = "index.html"; return new Promise(() => {}); };

  window.App = {
    auth, fs, ready, firstUser, SYNC, scoped, resolveCtx, activa, vence, ROLES, SLOTS, limpiaCodigo, correoPersonal, clavePin,
    async ctx() {
      const u = await firstUser;
      const r = await resolveCtx(u);
      return r.estado === "ok" ? r.ctx : null;
    },
    async use(name) {
      if (name === "downloads") return downloads;
      if (name === "db") {
        const u = await firstUser;
        if (!u) return goHome();
        const r = await resolveCtx(u);
        if (r.estado !== "ok") return goHome();
        // Sin suscripción vigente no se abre la app (las reglas de Firestore también lo bloquean).
        if (!activa(r.ctx.r)) return goHome();
        return scoped(r.ctx.rest);
      }
      return null;
    }
  };

  if (window.self !== window.top) document.documentElement.classList.add("embedded");
})();
