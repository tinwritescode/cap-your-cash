// Speech-to-text through Lovable AI Gateway (server-only). Shared by the web voice composer and the Telegram bot.
export async function transcribe(audio: Uint8Array<ArrayBuffer>, mime: string, apiKey: string): Promise<string> {
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const fd = new FormData();
  fd.append("file", new Blob([audio], { type: mime.split(";")[0] }), `voice.${ext}`);
  fd.append("model", "openai/gpt-transcribe");
  fd.append("stream", "true");
  fd.append("languages", "vi");
  fd.append("prompt", "Người Việt đọc một khoản thu chi, có thể dùng tiếng lóng như củ, xị, chai, chục, k, rưỡi.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: fd,
  });
  if (!res.ok || !res.body) {
    console.error(`transcribe failed [${res.status}]: ${await res.text().catch(() => "")}`);
    throw Object.assign(new Error("transcribe"), { status: res.status });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", deltas = "", final: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d);
        if (typeof ev.type === "string" && ev.type.endsWith(".delta")) deltas += ev.delta ?? "";
        if (typeof ev.type === "string" && ev.type.endsWith(".done")) final = ev.text ?? deltas;
        if (ev.type === "error") throw Object.assign(new Error("transcribe"), { status: 500 });
      } catch (e) {
        if ((e as { status?: number }).status) throw e;
      }
    }
  }
  return (final ?? deltas).trim();
}
