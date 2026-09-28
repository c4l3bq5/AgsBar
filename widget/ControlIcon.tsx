import { drawSvgPaths } from "../lib/svgPath";
import { Gtk } from "ags/gtk4"
import { VIEWBOX_SIZE } from "../lib/controlPaths";

type ControlIconProps = {
  paths: string[];
  size?: number;
  color?: [number, number, number];
  flipX?: boolean;
};

export default function ControlIcon({
  paths,
  size = 22,
  color = [1, 1, 1],
  flipX = false,
}: ControlIconProps) {
  const scale = size / VIEWBOX_SIZE;

  return (
    <drawingarea
      widthRequest={size}
      heightRequest={size}
      valign={Gtk.Align.CENTER}
      halign={Gtk.Align.CENTER}
      $={(self) => {
        self.set_draw_func((_area, cr, width, _height) => {
          cr.save();
          if (flipX) {
            cr.translate(width, 0);
            cr.scale(-scale, scale);
          } else {
            cr.scale(scale, scale);
          }
          cr.setSourceRGB(...color);
          drawSvgPaths(cr, paths);
          cr.fill();
          cr.restore();
        });
      }}
    />
  );
}

