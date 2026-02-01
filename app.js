let swRegistration = null;
let scheduleData = null; // Guardar datos para actualizaciones
let timerInterval = null; // Intervalo para el contador

console.log("APP.JS CARGADO - Versión Debug Purga 2.0"); // DEBUG VERSIÓN

if ("serviceWorker" in navigator) {
  // Detectar si estamos en GitHub Pages para ajustar la ruta
  const isGitHubPages = window.location.hostname.includes("github.io");
  const basePath = isGitHubPages ? "/horarios-pwa" : "";
  
  navigator.serviceWorker
    .register(`${basePath}/sw.js`)
    .then((registration) => {
      console.log("SW app registrado", registration.scope);
      swRegistration = registration;
    })
    .catch(console.error);
}

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Configuración de API Backend
const IS_LOCALHOST = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
// ⚠️ REEMPLAZA ESTA URL CON LA DE TU PROYECTO EN VERCEL (Ej: https://horarios-pwa-backend.vercel.app)
const PROD_API_URL = "https://horarios-pwa-backend.vercel.app"; 
const API_URL = IS_LOCALHOST ? "http://localhost:3000" : PROD_API_URL;

console.log(`Modo: ${IS_LOCALHOST ? 'Local' : 'Producción'} - API: ${API_URL}`);

// Listener para mensajes en primer plano
messaging.onMessage((payload) => {
  console.log('Mensaje recibido:', payload);
  const { title, body } = payload.notification;
  
  // Usar notificación nativa si es posible
  if (Notification.permission === "granted") {
    const isGitHubPages = window.location.hostname.includes("github.io");
    const iconPath = isGitHubPages ? '/horarios-pwa/icons/icon-192.png' : '/icons/icon-192.png';
    
    new Notification(title, {
      body: body,
      icon: iconPath
    });
  }
});

// --- LÓGICA DE HORARIOS ---
async function loadSchedule() {
  const container = document.getElementById("schedule-container");
  const dateEl = document.getElementById("current-date");
  const seasonEl = document.getElementById("season-badge");

  if (!container || !dateEl || !seasonEl) {
      console.error("Elementos del DOM no encontrados. Revisa el HTML.");
      return;
  }

  try {
    const res = await fetch(`${API_URL}/api/schedule/today`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.error || "Error cargando horario");

    scheduleData = json.data; // Guardar en variable global

    // Actualizar UI básica
    dateEl.textContent = scheduleData.date; 
    seasonEl.textContent = scheduleData.season.name.includes("Verano") ? "☀️ Verano" : "❄️ Invierno";
    
    renderScheduleList(); // Render inicial
    
    // Iniciar intervalo de actualización (cada minuto)
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(renderScheduleList, 60000); // 60s

    // Renderizar info de próximo cambio
    if (scheduleData.nextSeasonChange) {
        const next = scheduleData.nextSeasonChange;
        const nextChangeContainer = document.getElementById('next-change-container');
        const textEl = document.getElementById('next-change-text');
        
        const dateObj = new Date(next.date);
        const dateStr = dateObj.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
        
        textEl.innerHTML = `
            Faltan ${next.daysRemaining} días
            <span style="display:block; font-size: 0.75rem; color: var(--text-secondary); font-weight: normal; margin-top: 4px;">
                (${dateStr} - ${next.nextSeasonName})
            </span>
        `;
        nextChangeContainer.style.display = 'block';
    }

  } catch (err) {
    console.error("Error fetching schedule:", err);
    container.innerHTML = `<p style="color: red; text-align: center;">Error cargando datos.<br><small>${err.message}</small></p>`;
  }
}

function renderScheduleList() {
    const container = document.getElementById("schedule-container");
    if (!scheduleData || scheduleData.blocks.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-secondary);">Hoy es día libre 🎉</p>`;
      return;
    }

    const getMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const formatTime12h = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let html = '<ul class="schedule-list">';
    
    scheduleData.blocks.forEach(block => {
      const startMin = getMinutes(block.start);
      const endMin = getMinutes(block.end);
      
      // Verificar si es el bloque actual (inicio <= actual < fin)
      const isActive = currentMinutes >= startMin && currentMinutes < endMin;
      
      // Calcular tiempo restante si está activo
      let timeLabel = '';
      if (isActive) {
          const diff = endMin - currentMinutes;
          const h = Math.floor(diff / 60);
          const m = diff % 60;
          const timeLeft = h > 0 ? `${h}h ${m}m` : `${m}m`;
          timeLabel = `<span class="timer-badge">⏳ Faltan ${timeLeft}</span>`;
      }

      const activeClass = isActive ? 'active-block' : '';
      
      html += `
        <li class="schedule-item ${activeClass}">
          <div style="display: flex; flex-direction: column;">
              <span class="entity-name">
                ${block.entity}
              </span>
              ${timeLabel}
          </div>
          <span class="time-block">${formatTime12h(block.start)} - ${formatTime12h(block.end)}</span>
        </li>
      `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// Cargar al inicio cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    loadSchedule();
    updateNotificationUI();

    const btn = document.getElementById("btn-enable-notify");
    if (btn) {
        btn.addEventListener("click", requestPermissionAndGetToken);
    }
    
    const btnTest = document.getElementById("btn-test-notify");
    if (btnTest) {
        btnTest.addEventListener("click", async (e) => {
            e.preventDefault();
            
            const originalText = btnTest.textContent;
            btnTest.textContent = "(Enviando...)";
            btnTest.style.pointerEvents = "none"; // Evitar doble click

            try {
                // 1. Asegurar SW y obtener Token propio
                if (!swRegistration) {
                     swRegistration = await navigator.serviceWorker.ready;
                }
                
                const currentToken = await messaging.getToken({
                    vapidKey: "BJ2Vc28yDrZtyrkhH2k_L-Fl5yFPjiPURaXk7bCAG8bJfUEdeGfWJUHhZfPrF0kXS4HMX1kSMsH_O4rJmqJfftU",
                    serviceWorkerRegistration: swRegistration
                });

                if (!currentToken) {
                    throw new Error("No tienes token activo. Activa notificaciones primero.");
                }

                // 2. Enviar petición de test A MI MISMO
                const res = await fetch(`${API_URL}/api/test-notification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        fcmToken: currentToken,
                        title: "Test Personal",
                        body: "🔔 Esta notificación es solo para ti."
                    })
                });

                const data = await res.json();
                
                if (data.ok) {
                    btnTest.textContent = "(✅ Recibido)";
                } else {
                    btnTest.textContent = "(❌ Error)";
                    console.error(data.error);
                }
            } catch (err) {
                console.error("Error test:", err);
                btnTest.textContent = "(❌ Falló)";
                
                // Manejo específico de errores comunes
                let msg = "Error enviando notificación.";
                
                if (err.code === 'messaging/notifications-blocked' || err.message.includes('permission')) {
                     msg = "Permisos bloqueados. Revisa la configuración del navegador (candado en la URL).";
                } else if (err.code === 'messaging/token-subscribe-failed' || err.message.includes('no active service worker')) {
                     msg = "Error de suscripción. Intenta recargar la página.";
                } else if (navigator.userAgent.includes('Brave') || (navigator.brave && await navigator.brave.isBrave())) {
                     msg = "⚠️ Brave requiere activar 'Servicios de Google para mensajería push' en Configuración -> Privacidad y seguridad.";
                } else {
                     msg = `Error: ${err.message}`;
                }

                alert(msg);
            } finally {
                setTimeout(() => btnTest.textContent = originalText, 3000);
                btnTest.style.pointerEvents = "auto";
            }
        });
    }

const btnPurge = document.getElementById("btn-purge-devices");
    console.log("Buscando botón de purga...", btnPurge); // DEBUG

    if (btnPurge) {
        console.log("Botón de purga encontrado. Agregando listener..."); // DEBUG
        btnPurge.addEventListener("click", async (e) => {
            console.log("🔴 CLICK EN PURGAR DETECTADO"); // DEBUG
            e.preventDefault();
            
            if (!confirm("⚠️ ¿Estás seguro de borrar TODOS los dispositivos registrados? Esto obligará a todos a reactivar notificaciones.")) {
                console.log("Purga cancelada por usuario");
                return;
            }

            console.log("Iniciando petición de purga...");
            const originalText = btnPurge.textContent;
            btnPurge.textContent = "(Borrando...)";
            
            try {
                console.log(`Enviando DELETE a ${API_URL}/api/debug/devices`);
                const res = await fetch(`${API_URL}/api/debug/devices`, { method: "DELETE" });
                console.log("Respuesta status:", res.status);
                
                const data = await res.json();
                console.log("Respuesta data:", data);
                
                alert(data.message || "Purgado exitoso. Ahora puedes Reactivar.");
                
                // 🛠️ FORZAR ESTADO DE UI: Simular que no tenemos notificaciones
                // para permitir al usuario volver a registrarse manualmente.
                const promo = document.getElementById('notification-promo');
                const badge = document.getElementById('notification-badge');
                const btnEnable = document.getElementById('btn-enable-notify');
                
                if (promo && badge && btnEnable) {
                    promo.style.display = 'block'; // Mostrar caja de activación
                    badge.style.display = 'none';  // Ocultar "Activas"
                    btnEnable.textContent = "🔄 Re-sincronizar (Base de Datos vacía)";
                    btnEnable.disabled = false;
                    btnEnable.style.backgroundColor = ""; // Restaurar color
                }

            } catch (err) {
                console.error("Error en fetch de purga:", err);
                alert("Error purgando: " + err.message);
            } finally {
                btnPurge.textContent = originalText;
            }
        });
    } else {
        console.error("❌ NO se encontró el botón 'btn-purge-devices' en el DOM");
    }
});

// --- LÓGICA DE NOTIFICACIONES ---

function updateNotificationUI() {
    const promo = document.getElementById('notification-promo');
    const badge = document.getElementById('notification-badge');
    
    if (Notification.permission === 'granted') {
        promo.style.display = 'none';
        badge.style.display = 'block';
    } else if (Notification.permission === 'denied') {
        // Usuario bloqueó manualmente. Mostrar banner pero texto diferente o ocultar.
        // Por ahora ocultamos para no molestar, o podríamos guiar a configuración.
        promo.style.display = 'block';
        document.getElementById('btn-enable-notify').textContent = "⚠️ Permiso bloqueado (Revisar Config)";
        document.getElementById('btn-enable-notify').disabled = true;
        document.getElementById('btn-enable-notify').style.backgroundColor = "#999";
        badge.style.display = 'none';
    } else {
        // 'default' -> No ha decidido
        promo.style.display = 'block';
        badge.style.display = 'none';
    }
}

async function requestPermissionAndGetToken() {
  const statusEl = document.getElementById("status-msg");
  const btn = document.getElementById("btn-enable-notify");
  
  statusEl.style.display = "block";
  statusEl.textContent = "Iniciando...";
  statusEl.style.color = "#333";
  btn.disabled = true;
  btn.textContent = "Solicitando...";

  try {
    const status = await Notification.requestPermission();
    if (status !== "granted") {
      statusEl.textContent = "Permiso denegado por el usuario.";
      statusEl.style.color = "red";
      btn.textContent = "Denegado";
      updateNotificationUI(); // Actualizar UI
      return;
    }

    // Esperar a que exista el registration
    if (!swRegistration) {
      statusEl.textContent = "Esperando Service Worker...";
      const registration = await navigator.serviceWorker.ready;
      swRegistration = registration;
    }

    statusEl.textContent = "Contactando Firebase...";
    const token = await messaging.getToken({
      vapidKey: "BJ2Vc28yDrZtyrkhH2k_L-Fl5yFPjiPURaXk7bCAG8bJfUEdeGfWJUHhZfPrF0kXS4HMX1kSMsH_O4rJmqJfftU",
      serviceWorkerRegistration: swRegistration
    });
    
    console.log("FCM token:", token);
    
    // Enviar token al backend
    await sendTokenToBackend(token);
    
    // Actualizar UI final
    updateNotificationUI();
    
  } catch (err) {
    console.error("Error obteniendo token", err);
    statusEl.textContent = "Error: " + err.message;
    statusEl.style.color = "red";
    btn.disabled = false;
    btn.textContent = "Reintentar";
  }
}

async function sendTokenToBackend(token) {
  const statusEl = document.getElementById("status-msg");
  try {
    const response = await fetch(`${API_URL}/api/save-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: token,
        userAgent: navigator.userAgent
      }),
    });
    const data = await response.json();
    
    if (response.ok) {
       statusEl.textContent = "✅ Listo! Token registrado.";
       statusEl.style.color = "green";
       setTimeout(() => {
           // Ocultar mensaje de éxito después de unos segundos
           statusEl.style.display = 'none';
       }, 3000);
    } else {
       statusEl.textContent = "⚠️ Token local ok, pero backend falló.";
       statusEl.style.color = "orange";
    }
  } catch (error) {
    console.error("No se pudo enviar el token al backend:", error);
    statusEl.textContent = "⚠️ Token local ok, error de red.";
    statusEl.style.color = "orange";
  }
}