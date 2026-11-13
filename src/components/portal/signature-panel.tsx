"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Type, Upload, Eraser } from "lucide-react";
import { signDocumentAction } from "@/lib/actions/portal";
import type { SignatureMethod } from "@/lib/db/types";

interface ExistingSignature {
  signedBy: string;
  method: SignatureMethod;
  image?: string;
  text?: string;
  signedAt: string;
}

const MAX_IMAGE_BYTES = 200 * 1024;

type Tab = "draw" | "type" | "upload";

/**
 * Portal signing panel: draw, type or upload a signature.
 * The captured signature is recorded with a timestamp — it is an
 * electronic acceptance, not a qualified digital certificate.
 */
export function SignaturePanel({
  token,
  documentId,
  requested,
  signature,
  defaultName,
}: {
  token: string;
  documentId: string;
  requested: boolean;
  signature?: ExistingSignature | null;
  defaultName: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tab, setTab] = useState<Tab>("draw");
  const [signedBy, setSignedBy] = useState(defaultName);
  const [typed, setTyped] = useState(defaultName);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState<string>("");
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up the drawing canvas (re-binds when the draw tab remounts it)
  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1C2536";
    setHasInk(false);

    let drawing = false;
    const point = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      drawing = true;
      const p = point(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      setHasInk(true);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const p = point(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };
    const up = () => {
      drawing = false;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
    };
  }, [tab]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
  }

  function onUpload(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Upload a PNG or JPEG image");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Signature image must be under 200KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploaded(typeof reader.result === "string" ? reader.result : null);
      setUploadName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    setError(null);
    if (!signedBy.trim()) {
      setError("Enter the name of the signatory");
      return;
    }
    setBusy(true);
    try {
      let input: { signedBy: string; method: SignatureMethod; image?: string; text?: string };
      if (tab === "draw") {
        if (!hasInk) {
          setError("Draw your signature first");
          setBusy(false);
          return;
        }
        const dataUrl = canvasRef.current?.toDataURL("image/png");
        if (!dataUrl) {
          setError("Could not read the signature");
          setBusy(false);
          return;
        }
        input = { signedBy: signedBy.trim(), method: "drawn", image: dataUrl };
      } else if (tab === "type") {
        if (!typed.trim()) {
          setError("Type your signature");
          setBusy(false);
          return;
        }
        input = { signedBy: signedBy.trim(), method: "typed", text: typed.trim() };
      } else {
        if (!uploaded) {
          setError("Upload a signature image");
          setBusy(false);
          return;
        }
        input = { signedBy: signedBy.trim(), method: "uploaded", image: uploaded };
      }

      const res = await signDocumentAction(token, documentId, input);
      if (!res.ok) setError(res.error ?? "Could not save your signature");
      else router.refresh();
    } catch {
      setError("Could not save your signature");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- already signed ---------- */
  if (signature) {
    const when = new Date(signature.signedAt).toLocaleDateString();
    return (
      <div className="rounded-[3px] border border-forest/30 bg-forest/5 p-4">
        <p className="text-sm font-medium text-forest">Signed</p>
        <div className="mt-2 flex items-end gap-4">
          {signature.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signature.image}
              alt="Signature"
              className="h-14 object-contain"
            />
          ) : (
            <p className="font-serif text-2xl italic text-ink">{signature.text ?? signature.signedBy}</p>
          )}
          <div className="text-xs text-muted">
            <p className="font-medium text-ink">{signature.signedBy}</p>
            <p>
              {signature.method} signature · {when}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          This is an electronic record of your signature captured in the client
          portal. It is not a qualified digital certificate signature.
        </p>
      </div>
    );
  }

  if (!requested) return null;

  /* ---------- signing panel ---------- */
  const tabs: Array<{ id: Tab; label: string; icon: typeof PenLine }> = [
    { id: "draw", label: "Draw", icon: PenLine },
    { id: "type", label: "Type", icon: Type },
    { id: "upload", label: "Upload", icon: Upload },
  ];

  return (
    <div className="rounded-[3px] border border-royal/30 bg-royal/5 p-4">
      <p className="text-sm font-medium text-ink">Signature requested</p>
      <p className="mt-1 text-xs text-muted">
        Review the document, then sign below.
      </p>

      <div className="mt-3 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium ${
              tab === t.id
                ? "border-royal text-royal"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="signed-by" className="text-xs font-medium text-ink">
            Signatory name
          </label>
          <input
            id="signed-by"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            className="mt-1 h-9 w-full rounded-[3px] border border-line bg-white px-3 text-sm text-ink outline-none focus:border-royal"
            placeholder="Your full name"
          />
        </div>

        {tab === "draw" ? (
          <div>
            <canvas
              ref={canvasRef}
              className="h-36 w-full touch-none rounded-[3px] border border-dashed border-line bg-white"
            />
            <button
              type="button"
              onClick={clearCanvas}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
            >
              <Eraser size={12} /> Clear
            </button>
          </div>
        ) : null}

        {tab === "type" ? (
          <div>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-16 w-full rounded-[3px] border border-line bg-white px-3 font-serif text-2xl italic text-ink outline-none focus:border-royal"
              placeholder="Type your name"
            />
            <p className="mt-1 text-[11px] text-muted">
              Your typed name will appear in italics on the document.
            </p>
          </div>
        ) : null}

        {tab === "upload" ? (
          <div>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => onUpload(e.target.files?.[0])}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
            />
            {uploaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploaded}
                alt="Uploaded signature preview"
                className="mt-2 h-16 rounded-[3px] border border-line bg-white p-2 object-contain"
              />
            ) : null}
            <p className="mt-1 text-[11px] text-muted">
              {uploadName ? `${uploadName} · ` : ""}PNG or JPEG, max 200KB.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal/90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          Sign document
        </button>

        {error ? (
          <p className="text-xs text-red" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
