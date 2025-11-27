// file: app.js
/**
 * DEPENDENCIAS:
 * npm install whatsapp-web.js@1.34.2 express cookie-parser qrcode qrcode-terminal dotenv fs-extra
 */
const express = require("express");
const cookieParser = require("cookie-parser");
const qrcode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs-extra");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ======================================================================
// LOGIN SIMPLE CON COOKIES
// ======================================================================

const USER = process.env.USER
const PASS = process.env.PASS;

function checkAuth(req, res, next) {
  if (req.cookies.session === "ok") return next();
  return res.redirect("/login");
}

app.get("/login", (_req, res) => {
  res.send(`
  <html><body style="background:#222;color:#eee;font-family:sans-serif;
  display:flex;align-items:center;justify-content:center;height:100vh;">

    <form method="POST" action="/login"
      style="padding:25px;background:#333;border-radius:10px;width:240px;text-align:center;">
      <h2 style="color:#6bf5e0;">Login</h2>

      <input name="user" placeholder="Usuario"
        style="width:100%;padding:8px;margin-top:10px;border-radius:6px;border:none;" />

      <input name="pass" type="password" placeholder="Contraseña"
        style="width:100%;padding:8px;margin-top:10px;border-radius:6px;border:none;" />

      <button style="margin-top:15px;padding:8px 15px;background:#6bf5e0;
        border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
        Entrar
      </button>
    </form>

  </body></html>
  `);
});

app.post("/login", (req, res) => {
  if (req.body.user !== USER || req.body.pass !== PASS) {
    return res.send("Credenciales incorrectas");
  }

  // ✔ cookie de login
  res.cookie("session", "ok", { httpOnly: true });

  // ✔ iniciar WhatsApp DESPUÉS del login
  if (!client) {
    client = createClient();
    client.initialize();
  }

  return res.redirect("/");
});

// ======================================================================
// WHATSAPP WEB.JS CLIENT
// ======================================================================

let qrValue = null;
let waReady = false;
let client = null;

function createClient() {
  const c = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  c.on("qr", (qr) => {
    qrValue = qr;
    waReady = false;
    console.log("🔐 QR nuevo");
    qrcodeTerminal.generate(qr, { small: true });
  });

  c.on("ready", () => {
    waReady = true;
    console.log("✅ WhatsApp conectado");
  });

  return c;
}

// ======================================================================
// HOME
// ======================================================================

app.get("/", checkAuth, async (_req, res) => {
  let html = `<html><body style="background:#222;color:#eee;font-family:sans-serif;
              text-align:center;padding-top:40px;">`;

  html += `<a href="/logout" style="position:absolute;top:20px;right:20px;color:#f77;">Logout</a>`;
  html += `<a href="/unlink" style="position:absolute;top:20px;left:20px;color:#f77;">Desvincular</a>`;

  if (!client) {
    html += `<h2>No hay WhatsApp iniciado</h2>
             <a href="/start" style="color:#6bf5e0;">Iniciar WhatsApp</a>`;
  } else if (waReady) {
    html += `<h1 style="color:#6bf56b;">WhatsApp conectado ✔</h1>
            <button id="btnEntrenar"
                onclick="entrenarAgente()"
                style="margin-top:20px;padding:10px 20px;background:#6bf5e0;
                border:none;border-radius:8px;font-size:16px;font-weight:bold;
                cursor:pointer;">
            Entrenar agente con WhatsApp
            </button>
            <script>
                function entrenarAgente() {
                    const btn = document.getElementById("btnEntrenar");
                    btn.disabled = true;
                    btn.innerText = "Enviando...";

                    fetch("https://n8n.xia.ar/webhook/6b90987a-8166-4e89-8e16-441db8db9ba8", {
                    method: "POST"
                    })
                    .then(() => {
                        btn.innerText = "Entrenamiento enviado ✔";
                        btn.style.background = "#6bf56b";
                    })
                    .catch(() => {
                        btn.disabled = false;
                        btn.innerText = "Error. Reintentar";
                        btn.style.background = "#f77";
                    });
            }
            </script>
            `;
  } else if (qrValue) {
    const img = await qrcode.toDataURL(qrValue);
    html += `<h1 style="color:#6bf5e0;">Escanea este QR</h1>
             <img src="${img}" width="280"
             style="border:3px solid #6bf5e0;border-radius:10px;" />`;
  } else {
    html += `<h2 style="color:#6bf5e0;">Generando QR...</h2>`;
  }

  html += `</body></html>`;
  res.send(html);
});

// ======================================================================
// Iniciar WhatsApp manualmente
// ======================================================================

app.get("/start", checkAuth, (_req, res) => {
  if (!client) {
    client = createClient();
    client.initialize();
  }
  res.redirect("/");
});

// ======================================================================
// DATA JSON
// ======================================================================
function checkApiKey(req, res, next) {
  if (req.query.key === process.env.API_KEY) return next();
  return res.status(401).json({ error: "API Key inválida" });
}


app.get("/data-n8n", checkApiKey, async (req, res) => {
  const chats = await client.getChats();

  const filtered = chats.filter(c => !c.isGroup);

  const result = [];

  for (const chat of filtered) {
    const msgs = await chat.fetchMessages({ limit: 6000 });

    const clean = msgs
      .filter(m => !m.hasMedia)
      .filter(m => !(m.body || "").includes("http"))
      .map(m => ({
        id: m.id._serialized,
        from: m.author || m.from,
        body: m.body,
        timestamp: m.timestamp
      }));

    result.push({
      id: chat.id._serialized,
      name: chat.name || chat.id.user,
      messages: clean
    });
  }

  return res.json(result);
});


// ======================================================================
// LOGOUT APP
// ======================================================================

app.get("/logout", checkAuth, (req, res) => {
  res.clearCookie("session");
  res.send("<h2>Logout correcto</h2><a href='/login'>Login</a>");
});

// ======================================================================
// DESVINCULAR WHATSAPP
// ======================================================================

app.get("/unlink", async (req, res) => {
  try {
    console.log("🔻 Desvinculando WhatsApp...");

    // === 1️⃣ Si existe cliente, cerrarlo completamente ===
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        console.log("⚠ logout falló (ignorable):", e.message);
      }

      try {
        if (client.pupBrowser) {
          await client.pupBrowser.close();
        }
      } catch (e) {
        console.log("⚠ cerrar navegador falló (ignorable):", e.message);
      }

      try {
        await client.destroy();
      } catch (e) {
        console.log("⚠ destroy falló (ignorable):", e.message);
      }

      client = null;
    }

    // === 2️⃣ LIMPIAR LA CARPETA DE SESIÓN SIN BORRARLA ===
    const fs = require("fs-extra");
    const path = require("path");

    const authPath = path.join(__dirname, ".wwebjs_auth");

    console.log("🧹 Limpiando contenido de sesión...");

    if (await fs.pathExists(authPath)) {
      const items = await fs.readdir(authPath);
      for (const item of items) {
        const full = path.join(authPath, item);
        try {
          await fs.remove(full);
        } catch (e) {
          console.log("⚠ No se pudo borrar", full, e.message);
        }
      }
    }

    console.log("🧽 Sesión limpiada sin errores");

    // === 3️⃣ REINICIAR CLIENTE LIMPIO ===
    qrValue = null;
    waReady = false;

    client = createClient();
    client.initialize();

    return res.send("WhatsApp desvinculado correctamente. <a href='/'>Volver</a>");

  } catch (err) {
    console.error("unlink error:", err);
    res.status(500).send("Error al desvincular");
  }
});

// ======================================================================
// UNLINK PARA N8N (con API KEY)
// ======================================================================
app.get("/unlink-n8n", checkApiKey, async (req, res) => {
  try {
    console.log("🔻 Desvinculando WhatsApp...");

    if (client) {
      try { await client.logout(); } catch (e) { console.log("logout err", e); }
      try { await client.destroy(); } catch (e) { console.log("destroy err", e); }
    }

    client = null;

    // 🧼 Borrar la carpeta de sesiones correctamente (sin bloquear)
    const sessPath = path.join(__dirname, ".wwebjs_auth");

    try {
      await fs.remove(sessPath);
    } catch (err) {
      console.log("unlink error:", err);
    }

    qrValue = null;
    waReady = false;

    return res.json({ ok: true, message: "WhatsApp desvinculado correctamente" });

  } catch (err) {
    console.log("unlink fatal", err);
    return res.status(500).json({ ok: false, error: "Error al desvincular" });
  }
});


// ======================================================================
// SERVER
// ======================================================================

app.listen(3000, () => console.log("🌐 Servidor en http://localhost:3000"));
