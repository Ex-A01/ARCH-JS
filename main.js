import { dotnet } from './_framework/dotnet.js';

async function startApp() {
    try {
        // S'assurer que le DOM est prêt et que le canvas existe
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }

        const canvasElement = document.getElementById('canvas');
        if (!canvasElement) {
            throw new Error("Canvas element with id 'canvas' not found in the DOM.");
        }

        // IMPORTANT : définir Module.canvas AVANT d'initialiser le runtime WASM
        window.Module = window.Module || {};
        window.Module.canvas = canvasElement;

        const { runMain, getAssemblyExports, getConfig } = await dotnet
            .withDiagnosticTracing(false)
            .create();

        // Au cas où : ré-affecter dans l'instance si elle existe (compatibilité)
        if (dotnet.instance && dotnet.instance.Module) {
            dotnet.instance.Module["canvas"] = canvasElement;
        }

        // --- LA MAGIE EST ICI : On récupère les fonctions C# [JSExport] ---
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

        // Initialisation de la bonne taille AVANT runMain()
        resizeCanvas();

        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        await runMain();

    } catch (err) {
        console.error("Erreur critique :", err);
    }
}

window.GameAudio = {
    sounds: {},
    play: function (id, path, loop, volume) {
        if (!this.sounds[id]) {
            this.sounds[id] = new Audio(path);
        }
        const audio = this.sounds[id];
        audio.loop = loop;
        audio.volume = volume;
        audio.play().catch(e => console.warn("[AUDIO] Lecture bloquée par le navigateur (interaction requise) :", e));
    },
    pause: function (id) {
        if (this.sounds[id]) this.sounds[id].pause();
    },
    stop: function (id) {
        if (this.sounds[id]) {
            this.sounds[id].pause();
            this.sounds[id].currentTime = 0;
        }
    },
    setVolume: function (id, volume) {
        if (this.sounds[id]) this.sounds[id].volume = volume;
    }
};

// Lancer l'app (startApp attend que le DOM soit prêt)
startApp();
