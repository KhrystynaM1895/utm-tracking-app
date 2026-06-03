(() => {
  "use strict";

  const UTM_SOURCE_KEY = "utm_source";
  const STORAGE_LAST = "utm_tracking:last";
  const STORAGE_FIRST = "utm_tracking:first";
  const STORAGE_SESSION_ID = "utm_tracking:session_id";
  const STORAGE_SOURCE_MAP = "utm_tracking:source_map";
  const SOURCE_MAP_TTL_MS = 5 * 60 * 1000;
  const DEFAULT_CAPTURE_PATH = "/apps/utm-tracking/capture";
  const DEFAULT_SOURCES_PATH = "/apps/utm-tracking/sources";

  const getConfig = () => {
    const el = document.getElementById("utm-tracker-config");
    if (!el) {
      return {
        capturePath: DEFAULT_CAPTURE_PATH,
        sourcesPath: DEFAULT_SOURCES_PATH,
      };
    }

    try {
      return JSON.parse(el.textContent || "{}");
    } catch {
      return {
        capturePath: DEFAULT_CAPTURE_PATH,
        sourcesPath: DEFAULT_SOURCES_PATH,
      };
    }
  };

  const normalizeSlug = (value) => value.trim().toLowerCase();

  const parseSlugFromUrl = () => {
    const value = new URLSearchParams(window.location.search).get(
      UTM_SOURCE_KEY,
    );

    if (!value) {
      return null;
    }

    return normalizeSlug(value);
  };

  const getSessionId = () => {
    try {
      let id = sessionStorage.getItem(STORAGE_SESSION_ID);
      if (!id) {
        id = crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`;
        sessionStorage.setItem(STORAGE_SESSION_ID, id);
      }
      return id;
    } catch {
      return null;
    }
  };

  const readCachedSourceMap = () => {
    try {
      const cached = sessionStorage.getItem(STORAGE_SOURCE_MAP);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.expiresAt !== "number" ||
        typeof parsed.sources !== "object" ||
        parsed.expiresAt <= Date.now()
      ) {
        return null;
      }

      return parsed.sources;
    } catch {
      return null;
    }
  };

  const writeCachedSourceMap = (sources) => {
    try {
      sessionStorage.setItem(
        STORAGE_SOURCE_MAP,
        JSON.stringify({
          sources,
          expiresAt: Date.now() + SOURCE_MAP_TTL_MS,
        }),
      );
    } catch {
      /* ignore storage errors */
    }
  };

  const fetchSourceMap = async (sourcesPath) => {
    const cached = readCachedSourceMap();
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(sourcesPath, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();

      try {
        const data = JSON.parse(text);
        const sources =
          data && typeof data.sources === "object" ? data.sources : null;

        if (!sources) {
          return null;
        }

        writeCachedSourceMap(sources);
        return sources;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };

  const resolveSourceId = (slug, sourceMap) => {
    if (!slug || !sourceMap) {
      return null;
    }

    const sourceId = sourceMap[slug];
    return typeof sourceId === "number" ? sourceId : null;
  };

  const saveTrackedSource = ({ utm_source_id, slug }) => {
    const payload = JSON.stringify({
      utm_source_id,
      slug,
      capturedAt: new Date().toISOString(),
    });

    try {
      sessionStorage.setItem(STORAGE_LAST, payload);
      localStorage.setItem(STORAGE_LAST, payload);
    } catch {
      /* ignore storage errors */
    }

    try {
      if (!localStorage.getItem(STORAGE_FIRST)) {
        localStorage.setItem(STORAGE_FIRST, payload);
      }
    } catch {
      /* ignore storage errors */
    }
  };

  const readStoredLastTouch = () => {
    try {
      const stored = sessionStorage.getItem(STORAGE_LAST);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (
        typeof parsed.utm_source_id === "number" &&
        typeof parsed.slug === "string"
      ) {
        return { utm_source_id: parsed.utm_source_id, slug: parsed.slug };
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const getLastTouchTrackedSource = () => readStoredLastTouch();

  const syncCartLineItemsUtm = async (slug) => {
    try {
      const cartRes = await fetch("/cart.js", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!cartRes.ok) return;
      const cart = await cartRes.json();
      const items = Array.isArray(cart.items) ? cart.items : [];

      for (const item of items) {
        if (item.properties && item.properties["_utm_source"] === slug) continue;
        await fetch("/cart/change.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            id: item.key,
            properties: { ...item.properties, _utm_source: slug },
          }),
        });
      }
    } catch {
      /* never break storefront */
    }
  };

  const updateCartAttributes = async (slug) => {
    try {
      await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: { utm_source: slug },
        }),
      });
    } catch {
      /* never break storefront */
    }
  };

  const postCapture = async (slug, capturePath) => {
    try {
      const response = await fetch(capturePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          utms: { utm_source: slug },
          landingUrl: window.location.href,
          referrer: document.referrer || null,
          capturedAt: new Date().toISOString(),
          sessionId: getSessionId(),
        }),
      });

      if (!response.ok) {
        return null;
      }

      try {
        const data = await response.json();
        return typeof data?.utmSourceId === "number" ? data.utmSourceId : null;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  };

  const injectLineItemProperty = (slug) => {
    try {
      const key = "properties[_utm_source]";
      document.querySelectorAll('form[action*="/cart/add"]').forEach((form) => {
        if (form.querySelector(`[name="${key}"]`)) return;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = slug;
        form.appendChild(input);
      });
    } catch {
      /* never break storefront */
    }
  };

  const run = async () => {
    try {
      const {
        capturePath = DEFAULT_CAPTURE_PATH,
        sourcesPath = DEFAULT_SOURCES_PATH,
      } = getConfig();

      // Inject line item property immediately (sync) so it's ready
      // before any async operations complete and the user can click
      const earlySlug =
        parseSlugFromUrl() ?? getLastTouchTrackedSource()?.slug ?? null;
      if (earlySlug) {
        injectLineItemProperty(earlySlug);
      }

      const sourceMap = await fetchSourceMap(sourcesPath);
      const urlSlug = parseSlugFromUrl();

      if (urlSlug) {
        const sourceId = resolveSourceId(urlSlug, sourceMap);
        const capturedSourceId = await postCapture(urlSlug, capturePath);
        const resolvedSourceId = sourceId ?? capturedSourceId;

        if (resolvedSourceId) {
          saveTrackedSource({ utm_source_id: resolvedSourceId, slug: urlSlug });
          await updateCartAttributes(urlSlug);
          injectLineItemProperty(urlSlug);
          await syncCartLineItemsUtm(urlSlug);
        }

        return;
      }

      const lastTouch = getLastTouchTrackedSource();
      if (lastTouch) {
        await updateCartAttributes(lastTouch.slug);
        injectLineItemProperty(lastTouch.slug);
      }
    } catch {
      /* never break storefront */
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
