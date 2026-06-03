import { useEffect } from "react";
import {
  reactExtension,
  useApplyAttributeChange,
  useAttributes,
  useCartLines,
} from "@shopify/ui-extensions-react/checkout";

const STORAGE_KEY = "utm_tracking:last";
const ATTRIBUTE_KEY = "utm_source";

function UtmCapture() {
  const applyAttributeChange = useApplyAttributeChange();
  const attributes = useAttributes();
  const cartLines = useCartLines();

  useEffect(() => {
    const existing = attributes?.find((a) => a.key === ATTRIBUTE_KEY);
    if (existing?.value) return;

    let slug: string | undefined;

    // Primary: read UTM from line item properties (set by Buy now interception)
    for (const line of cartLines) {
      const attr = line.attributes?.find(
        (a) => a.key === ATTRIBUTE_KEY || a.key === `_${ATTRIBUTE_KEY}`,
      );
      if (attr?.value) {
        slug = attr.value;
        break;
      }
    }

    // Fallback: localStorage (works when checkout is same-origin as storefront)
    if (!slug) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof (parsed as { slug?: unknown }).slug === "string"
          ) {
            slug = (parsed as { slug: string }).slug;
          }
        }
      } catch (e) {
        console.log("[utm] localStorage error:", e);
      }
    }


    if (!slug) return;

    void applyAttributeChange({
      key: ATTRIBUTE_KEY,
      type: "updateAttribute",
      value: slug,
    });
  }, [attributes, cartLines, applyAttributeChange]);

  return null;
}

export default reactExtension("purchase.checkout.block.render", () => (
  <UtmCapture />
));
