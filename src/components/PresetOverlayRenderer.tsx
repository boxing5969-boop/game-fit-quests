import React from "react";
import type { PresetVariant } from "@/hooks/usePresetVariants";

interface PresetOverlayRendererProps {
  variants: PresetVariant[];
  /** Selected customization: { gloves: "glove_red", accessory: "sunglasses", ... } */
  selections: Record<string, string>;
  /** Container size in px (the overlay sizes relative to this) */
  containerSize: number;
}

/**
 * Renders DB-driven preset-specific PNG overlays on top of the base boxer sprite.
 * Each overlay is positioned using per-preset anchor/scale/rotation from the DB.
 */
const PresetOverlayRenderer: React.FC<PresetOverlayRendererProps> = ({
  variants,
  selections,
  containerSize,
}) => {
  // Find active variant for each selected category
  const activeOverlays = Object.entries(selections)
    .map(([catCode, optionKey]) => {
      if (!optionKey) return null;
      const variant = variants.find(
        v => v.category_code === catCode && v.option_key === optionKey
      );
      return variant;
    })
    .filter((v): v is PresetVariant => v !== null && !!v.asset_url);

  if (activeOverlays.length === 0) return null;

  return (
    <>
      {activeOverlays.map(variant => {
        const overlayWidth = containerSize * variant.scale;
        const overlayHeight = containerSize * variant.scale;

        return (
          <div
            key={variant.id}
            className="absolute pointer-events-none"
            style={{
              // anchor_x/anchor_y are % of container, centered on the overlay
              left: `${variant.anchor_x}%`,
              top: `${variant.anchor_y}%`,
              width: overlayWidth,
              height: overlayHeight,
              transform: `translate(-50%, -50%) rotate(${variant.rotation}deg)`,
              zIndex: variant.z_order,
            }}
          >
            <img
              src={variant.asset_url!}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
              loading="lazy"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
              }}
            />
          </div>
        );
      })}
    </>
  );
};

export default React.memo(PresetOverlayRenderer);
