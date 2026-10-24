"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Keyboard, X } from "lucide-react";

/** The browser's own barcode reader (Chrome on Android, Edge, Safari 17+ on macOS). Not in TypeScript's DOM types yet. */
type NativeDetector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type NativeDetectorClass = {
    new(options: { formats: string[] }): NativeDetector;
    getSupportedFormats(): Promise<string[]>;
};

/** Retail codes, warehouse labels and QR codes. */
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code", "data_matrix"];

/** How often the native reader looks at the video. */
const DETECT_EVERY_MS = 150;

type CameraError = "insecure" | "unsupported" | "denied" | "noCamera" | "failed";

interface BarcodeScannerProps {
    open: boolean;
    onClose: () => void;
    /** Called once per opening, with the code read (or typed). The scanner closes itself first. */
    onDetected: (code: string) => void;
}

/**
 * Full-screen camera that reads one barcode or QR code. Uses the browser's BarcodeDetector where it has one and
 * ZXing (loaded only then) everywhere else, e.g. iPhone. The camera needs HTTPS (or localhost): without it, or
 * without permission, the code can still be typed.
 */
export default function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
    const t = useTranslations("scanner");
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<CameraError | null>(null);
    const [starting, setStarting] = useState(true);
    const [typing, setTyping] = useState(false);
    const [typed, setTyped] = useState("");

    // The latest callbacks, so the camera effect doesn't restart when the parent re-renders
    const onDetectedRef = useRef(onDetected);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onDetectedRef.current = onDetected; onCloseRef.current = onClose; });

    useEffect(() => {
        if (!open) return;
        let stopped = false;
        let stream: MediaStream | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let stopZxing: (() => void) | undefined;

        const stop = () => {
            stopped = true;
            clearTimeout(timer);
            stopZxing?.();
            stream?.getTracks().forEach(track => track.stop());
        };
        const found = (code: string) => {
            if (stopped || !code) return;
            stop();
            navigator.vibrate?.(30);
            onCloseRef.current();
            onDetectedRef.current(code.trim());
        };

        (async () => {
            setError(null);
            setStarting(true);
            if (!window.isSecureContext) return setError("insecure");
            if (!navigator.mediaDevices?.getUserMedia) return setError("unsupported");
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
            } catch (e) {
                const name = (e as DOMException).name;
                return setError(name === "NotAllowedError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "noCamera" : "failed");
            }
            const video = videoRef.current;
            if (stopped || !video) return stop();
            video.srcObject = stream;
            await video.play().catch(() => {});
            setStarting(false);

            const Native = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
            const formats = Native ? (await Native.getSupportedFormats().catch(() => [])).filter(f => FORMATS.includes(f)) : [];
            if (Native && formats.length > 0) {
                const detector = new Native({ formats });
                const tick = async () => {
                    if (stopped) return;
                    try {
                        const [code] = video.readyState >= 2 ? await detector.detect(video) : [];
                        if (code?.rawValue) return found(code.rawValue);
                    } catch {
                        // A frame that couldn't be read: try the next one
                    }
                    timer = setTimeout(tick, DETECT_EVERY_MS);
                };
                tick();
            } else {
                const { BrowserMultiFormatReader } = await import("@zxing/browser");
                if (stopped) return;
                const controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video, result => {
                    if (result) found(result.getText());
                });
                stopZxing = () => controls.stop();
                if (stopped) controls.stop();
            }
        })().catch(e => {
            console.error("Scanner error:", e);
            setError("failed");
        });

        return stop;
    }, [open]);

    if (!open) return null;

    const submitTyped = () => {
        const code = typed.trim();
        if (!code) return;
        setTyped("");
        setTyping(false);
        onClose();
        onDetected(code);
    };

    return (
        <div role="dialog" aria-modal="true" aria-label={t("title")} className="fixed inset-0 z-100 flex flex-col bg-black text-white">
            <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
                <p className="text-sm font-black uppercase tracking-widest">{t("title")}</p>
                <button onClick={onClose} aria-label={t("close")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <X size={20} />
                </button>
            </div>

            <div className="relative flex-1 overflow-hidden">
                <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                {!error && (
                    // The frame to aim with: the whole picture is read, it only helps to hold the code close enough
                    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-40 w-72 max-w-[80%] rounded-3xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                    </div>
                )}
                <p className="absolute inset-x-0 bottom-6 px-6 text-center text-sm font-bold" aria-live="polite">
                    {error ? <span className="rounded-xl bg-red-600 px-3 py-2 inline-block">{t(`errors.${error}`)}</span>
                        : starting ? t("starting") : t("hint")}
                </p>
            </div>

            <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {typing || error ? (
                    <form onSubmit={(e) => { e.preventDefault(); submitTyped(); }} className="flex gap-2">
                        <input
                            autoFocus
                            value={typed}
                            onChange={(e) => setTyped(e.target.value)}
                            inputMode="text"
                            autoComplete="off"
                            aria-label={t("typeLabel")}
                            placeholder={t("typeLabel")}
                            className="h-12 min-w-0 flex-1 rounded-2xl bg-white/10 px-4 text-base font-bold text-white placeholder:text-white/50 outline-none focus:ring-2 ring-white/40"
                        />
                        <button type="submit" disabled={!typed.trim()} className="h-12 rounded-2xl bg-white px-5 text-sm font-black uppercase text-black disabled:opacity-40">
                            {t("search")}
                        </button>
                    </form>
                ) : (
                    <button onClick={() => setTyping(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold">
                        <Keyboard size={18} aria-hidden /> {t("typeInstead")}
                    </button>
                )}
            </div>
        </div>
    );
}
