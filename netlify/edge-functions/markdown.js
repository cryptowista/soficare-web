// Markdown negotiation pro soficare.cz
//
// Kdyz klient v hlavicce Accept vyslovne pozaduje text/markdown a preferuje ho
// pred HTML, vratime mu misto stranky cistou markdown verzi (obsah /llms.txt).
// Prohlizece dal dostavaji normalni HTML.
//
// Rozhoduje se podle q-hodnot dle RFC 9110. Markdown musi byt uveden vyslovne,
// zastupny znak */* na nej nestaci - jinak by markdown dostal i curl.

function qHodnota(accept, typ, povolitWildcard) {
  let nejlepsi = -1;
  for (const cast of accept.split(",")) {
    const [rawTyp, ...parametry] = cast.trim().split(";");
    const kandidat = rawTyp.trim().toLowerCase();
    if (!kandidat) continue;

    const [hlavni, pod] = typ.split("/");
    const sedi =
      kandidat === typ ||
      (povolitWildcard && (kandidat === `${hlavni}/*` || kandidat === "*/*"));
    if (!sedi) continue;

    let q = 1;
    for (const p of parametry) {
      const m = p.trim().match(/^q=([0-9.]+)$/i);
      if (m) q = parseFloat(m[1]);
    }
    if (q > nejlepsi) nejlepsi = q;
  }
  return nejlepsi;
}

export default async (request, context) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return context.next();
  }

  const accept = request.headers.get("accept") || "";

  const qMarkdown = qHodnota(accept, "text/markdown", false); // jen vyslovne
  const qHtml = qHodnota(accept, "text/html", true);          // i pres */*

  if (qMarkdown <= 0 || qMarkdown <= qHtml) {
    return context.next();
  }

  const odpoved = await fetch(new URL("/llms.txt", request.url));
  if (!odpoved.ok) return context.next();

  const text = await odpoved.text();
  const hlavicky = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Language": "cs",
    "Vary": "Accept",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
    "Link": '</llms.txt>; rel="service-doc"; type="text/markdown"',
    "X-Markdown-Source": "/llms.txt",
  };

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: hlavicky });
  }
  return new Response(text, { status: 200, headers: hlavicky });
};

export const config = { path: ["/", "/index.html"] };
