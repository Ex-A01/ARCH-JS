import { dotnet } from './_framework/dotnet.js';

async function startApp() {
    try {
        const { runMain, getAssemblyExports, getConfig} = await dotnet
            .withDiagnosticTracing(false)
            .create();

        const canvasElement = document.getElementById('canvas');
        dotnet.instance.Module["canvas"] = canvasElement;

        const exports = await getAssemblyExports(getConfig().mainAssemblyName);
        const interop = exports.Interop;

        function resizeCanvas() {
            const ratio = window.devicePixelRatio || 1.0;
            const displayWidth = canvasElement.clientWidth * ratio;
            const displayHeight = canvasElement.clientHeight * ratio;

            if (canvasElement.width !== displayWidth || canvasElement.height !== displayHeight) {
                canvasElement.width = displayWidth;
                canvasElement.height = displayHeight;
            }
            interop.OnCanvasResize(displayWidth, displayHeight, ratio);
        }

        window.addEventListener('resize', resizeCanvas);

        canvasElement.addEventListener('mousemove', (e) => {
            const ratio = window.devicePixelRatio || 1.0;
            interop.OnMouseMove(e.offsetX * ratio, e.offsetY * ratio);
        });

        canvasElement.addEventListener('mousedown', (e) => {
            interop.OnMouseDown(e.shiftKey, e.ctrlKey, e.altKey, e.button);
        });
        canvasElement.addEventListener('mouseup', (e) => {
            interop.OnMouseUp(e.shiftKey, e.ctrlKey, e.altKey, e.button);
        });

        window.addEventListener('keydown', (e) => {
            interop.OnKeyDown(e.code);
        });
        window.addEventListener('keyup', (e) => {
            interop.OnKeyUp(e.code);
        });

        canvasElement.addEventListener('contextmenu', e => e.preventDefault());

        resizeCanvas();

        const loading = document.getElementById('loading-overlay');
        if (loading) loading.style.display = 'none';

        // =========================================================
        // 🚀 NOUVEAU : SYSTÈME DE COMMUNICATION IFRAME <-> SERVEUR
        // =========================================================

        // 1. Écouter les requêtes venant de ta page PHP
        window.addEventListener('message', (event) => {
            // (En prod, remplace "*" par "https://ton-serveur.com" pour la sécurité)
            if (event.data && event.data.type === 'LOAD_LEVEL') {
                console.log("[WASM] JSON du niveau reçu depuis le PHP ! Envoi au moteur C#...");
                interop.LoadLevelFromWeb(event.data.data);
            }
        });

        globalThis.onLevelFinished = (coinCount) => {
            console.log("[Iframe] Fin du niveau ! Envoi au parent...");
    
            // On envoie un message à la page parente (ton site PHP)
            window.parent.postMessage({
            type: 'LEVEL_FINISHED',
            coins: coinCount
            }, "*"); // Idéalement, remplace "*" par l'URL de ton site web pour plus de sécurité
        };
        
        // 2. Signaler à la page PHP que le moteur est prêt à jouer
        if (window.parent !== window) { 
            console.log("[WASM] Moteur prêt. Envoi du signal GAME_READY au PHP...");
            window.parent.postMessage({ type: 'GAME_READY' }, "*");
        }
        // =========================================================

        // On lance la boucle C#
        await runMain();

    } catch (err) {
        console.error("Erreur critique :", err);
    }
}
/*
// --- SYSTÈME DE COMPTEUR FPS INDÉPENDANT ---
const fpsElement = document.getElementById('fpsCounter');
let lastFpsTime = performance.now();
let frames = 0;

function measureFPS(currentTime) {
    frames++;
    // Si une seconde (1000 ms) s'est écoulée
    if (currentTime - lastFpsTime >= 1000) {
        if (fpsElement) fpsElement.innerText = `FPS: ${frames}`;
        frames = 0; // On remet le compteur à zéro
        lastFpsTime = currentTime;
    }
    // On reboucle à l'infini à la vitesse de rafraîchissement de l'écran
    requestAnimationFrame(measureFPS);
}
// On lance la boucle
requestAnimationFrame(measureFPS);*/

window.GameAudio = {
    sounds: {}, // Dictionnaire pour stocker les balises audio en cours

    play: function (id, path, loop, volume) {
        if (!this.sounds[id]) {
            this.sounds[id] = new Audio(path);
        }
        const audio = this.sounds[id];
        audio.loop = loop;
        audio.volume = volume;

        // Les navigateurs bloquent parfois l'audio si le joueur n'a pas encore cliqué
        audio.play().catch(e => console.warn("[AUDIO] Lecture bloquée par le navigateur (interaction requise) :", e));
    },

    pause: function (id) {
        if (this.sounds[id]) this.sounds[id].pause();
    },

    stop: function (id) {
        if (this.sounds[id]) {
            this.sounds[id].pause();
            this.sounds[id].currentTime = 0; // Remet à zéro
        }
    },

    setVolume: function (id, volume) {
        if (this.sounds[id]) this.sounds[id].volume = volume;
    }
};

startApp();
