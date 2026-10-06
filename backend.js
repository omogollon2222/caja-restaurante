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
    auth, fs, ready, firstUser, scoped, resolveCtx, activa, vence, ROLES, SLOTS, limpiaCodigo, correoPersonal, clavePin,
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
