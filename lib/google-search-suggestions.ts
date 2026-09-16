// Browser-only validation. Parse in an inert template; never insert unchecked HTML.
const TAGS = new Set(["style", "div", "span", "p", "a", "br", "b", "strong", "svg", "path", "g", "circle", "rect", "title"]);
const ATTRIBUTES = new Set(["class", "style", "href", "target", "rel", "title", "role", "aria-label", "aria-hidden", "xmlns", "width", "height", "viewbox", "fill", "d", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill-rule", "clip-rule", "cx", "cy", "r", "x", "y", "rx", "ry", "opacity", "focusable"]);

export function safeResearchUrl(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function safeCss(value: string) {
  // Google supplies local styles, not external assets, fonts, active CSS or host rules.
  const inspected = value.replace(/\/\*[\s\S]*?\*\//g, "");
  return !/\\|@(?!media\b)|(?:url|image-set|image|src|expression)\s*\(|behavior\s*:|-moz-binding|:host|:root|position\s*:\s*(?:fixed|sticky)/i.test(inspected);
}

export function validateSearchSuggestions(html: string, document: Document): DocumentFragment | null {
  if (!html.trim() || html.length > 100_000) return null;
  const template = document.createElement("template");
  template.innerHTML = html;
  let links = 0;
  const nodes = template.content.querySelectorAll("*");
  if (nodes.length > 500) return null;
  for (const element of nodes) {
    const name = element.localName.toLowerCase();
    if (!TAGS.has(name) || !["http://www.w3.org/1999/xhtml", "http://www.w3.org/2000/svg"].includes(element.namespaceURI || "")) return null;
    for (const attribute of element.attributes) {
      const attr = attribute.name.toLowerCase();
      if (!ATTRIBUTES.has(attr) || (attr === "style" && !safeCss(attribute.value))) return null;
      if (["fill", "stroke"].includes(attr) && !safeCss(attribute.value)) return null;
      if (attr === "href" && (name !== "a" || !safeResearchUrl(attribute.value))) return null;
      if (attr === "target" && !["_blank", "_self"].includes(attribute.value)) return null;
    }
    if (name === "style" && !safeCss(element.textContent || "")) return null;
    if (name === "a") {
      if (!element.hasAttribute("href")) return null;
      // Preserve Google's destination. Add only navigation security attributes.
      element.setAttribute("rel", "noopener noreferrer");
      links++;
    }
  }
  return links ? template.content : null;
}
